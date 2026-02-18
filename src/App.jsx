import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';

// Boss sprites
import bossHead from './assets/boss-head.png';
import bossBody from './assets/boss-body.png';
import bossShield from './assets/boss-shield.png';
import bossHeadDamage from './assets/boss-head-damage.png';
import bossBodyDamage from './assets/boss-body-damage.png';
import bossShieldDamage from './assets/boss-shield-damage.png';

export default function App() {
  const [screen, setScreen] = useState('main'); // main | intro | instructions | characterSelect | game | boss
  const [playerCount, setPlayerCount] = useState(2);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [players, setPlayers] = useState([]); // { char, hp, items }
  const [roundsCompleted, setRoundsCompleted] = useState(0); // full rounds (all players)
  const [pendingScanPlayer, setPendingScanPlayer] = useState(null); // which player the upcoming scan applies to
  const [act, setAct] = useState(1);
  const [scannedCards, setScannedCards] = useState([]);
  const [roundPhase, setRoundPhase] = useState('playerTurn');
  const [cameraStarted, setCameraStarted] = useState(false);
  const [qrData, setQrData] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [shardSchedule, setShardSchedule] = useState([]);
  const [nextShardIndex, setNextShardIndex] = useState(0);

  const [boss, setBoss] = useState({ head: 5, body: 5, shield: 5 });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  const availableCharacters = ['Goblin', 'Troll', 'Cyclops', 'Witch'];
  const shardZones = [
    'Village of Obryndel',
    'Forest of Travesy',
    'Charstone Alpines',
    'Mudbrik Castle',
  ];
  const shardOrderNames = ['First', 'Second', 'Third', 'Fourth'];
  const maxTiles = 15;

  const shuffleArray = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const createShardSchedule = () => {
    const rounds = shuffleArray([1, 2, 3, 4, 5]).slice(0, 4).sort((a, b) => a - b);
    const zones = shuffleArray(shardZones);
    return rounds.map((round, index) => ({
      round,
      zone: zones[index],
      orderName: shardOrderNames[index],
    }));
  };

  const maybeGetShardMessage = (currentRound) => {
    if (nextShardIndex >= shardSchedule.length) return null;
    const nextShard = shardSchedule[nextShardIndex];
    if (!nextShard || nextShard.round !== currentRound) return null;
    setNextShardIndex(prev => prev + 1);
    return `${nextShard.orderName} shard appeared in ${nextShard.zone}.`;
  };

  // ------------ CAMERA FUNCTIONS ----------------
  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraStarted(true);
      setRoundPhase('scanQR');
    } catch (err) {
      setCameraError('Camera error: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraStarted(false);
  };

  const scanQRCodeLoop = () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (roundPhase !== 'scanQR') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data.startsWith('Tile-')) {
        if (!scannedCards.includes(code.data)) {
          setScannedCards(prev => [...prev, code.data]);

          stopCamera();

          const parts = code.data.split('-');
          const num = parseInt(parts[1], 10);

          if (num === 30) {
            const msg = 'Scoundrels! Forging that cursed artifact have you? I shall smite ye, for I am Thobrick the Glorious knight of the realm and this is my domain! Face me in combat if ye dare!';
            setQrData(msg);
            try { speakText(msg); } catch (e) {}
            setScreen('boss');
            setAct(3);
            return;
          }

          // Handle event tiles 1..29
          if (num >= 1 && num <= 29) {
            const targetPlayer = pendingScanPlayer != null ? pendingScanPlayer : currentPlayer;
            const eventMsg = handleTileEvent(num, targetPlayer);
            const currentRound = roundsCompleted + 1;
            const shardMsg = maybeGetShardMessage(currentRound);
            const combinedMsg = [eventMsg, shardMsg].filter(Boolean).join(' ');
            
            // Set message and speak immediately
            if (combinedMsg) {
              setQrData(combinedMsg);
              speakText(combinedMsg);
            }

            // advance currentPlayer after handling
            if (targetPlayer < playerCount - 1) {
              setCurrentPlayer(targetPlayer + 1);
            } else {
              setCurrentPlayer(0);
              setRoundsCompleted(prev => prev + 1);
            }

            setPendingScanPlayer(null);
            setRoundPhase('playerTurn');
          } else {
            // default behavior for unexpected tiles
            setQrData(code.data);
            setRoundPhase('playerTurn');
          }
        }
      }
    }

    animationRef.current = requestAnimationFrame(scanQRCodeLoop);
  };

  useEffect(() => {
    if (roundPhase === 'scanQR' && cameraStarted) {
      animationRef.current = requestAnimationFrame(scanQRCodeLoop);
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [roundPhase, cameraStarted]);

  // ------------ PLAYER FUNCTIONS ----------------
  const nextPlayer = () => {
    // Trigger a scan for the player who is ending their turn
    setPendingScanPlayer(currentPlayer);
    setRoundPhase('scanQR');
    setQrData('');
  };

  const selectCharacter = (char) => {
    const newChars = [...characters];
    newChars[currentPlayer] = char;
    setCharacters(newChars);
    if (currentPlayer < playerCount - 1) {
      setCurrentPlayer(currentPlayer + 1);
    } else {
      // All players selected → start game
      setScreen('game');
      setCurrentPlayer(0);
    }
  };

  // Initialize players when entering the game screen
  useEffect(() => {
    if (screen === 'game') {
      const init = Array.from({ length: playerCount }).map((_, i) => ({
        char: characters[i] || null,
        hp: 5,
        items: []
      }));
      setPlayers(init);
      setRoundsCompleted(0);
      setAct(1);
      setPendingScanPlayer(null);
      setRoundPhase('playerTurn');
      setCurrentPlayer(0);
      setShardSchedule(createShardSchedule());
      setNextShardIndex(0);
    }
  }, [screen]);

  // Update act when roundsCompleted changes or boss screen
  useEffect(() => {
    if (screen === 'boss') {
      setAct(3);
      return;
    }
    if (roundsCompleted >= 7) setAct(2);
    else setAct(1);
  }, [roundsCompleted, screen]);

  const handleTileEvent = (tileNum, playerIndex) => {
    // tiles 1..29 produce events; returns the event message string
    if (tileNum < 1 || tileNum > 29) return null;

    const zone = Math.min(2, act); // zone corresponds to act 1 or 2
    // Items and traps are scarcer; neutral events are most common.
    // Act 1 leans slightly toward items, Act 2 toward traps.
    const weights = act === 1
      ? { item: 0.22, trap: 0.18 } // neutral 60%
      : { item: 0.18, trap: 0.22 }; // neutral 60%
    const roll = Math.random();
    const outcome = roll < weights.item
      ? 'item'
      : roll < weights.item + weights.trap
        ? 'trap'
        : 'neutral';

    setPlayers(prev => {
      const copy = [...prev];
      if (!copy[playerIndex]) return prev;
      if (outcome === 'trap') {
        copy[playerIndex] = { ...copy[playerIndex], hp: Math.max(copy[playerIndex].hp - 1, 0) };
      } else if (outcome === 'item') {
        // add a generic treasure from the zone
        const newItem = `Treasure (Zone ${zone})`;
        copy[playerIndex] = { ...copy[playerIndex], items: [...copy[playerIndex].items, newItem] };
      }
      return copy;
    });

    // return the message for the scan result (to be spoken immediately)
    if (outcome === 'trap') {
      return `Player ${playerIndex + 1} triggered a trap and lost 1 HP.`;
    }
    if (outcome === 'item') {
      return `Player ${playerIndex + 1} found a treasure! Take an item from the loot table for Zone you are in.`;
    }
    return `Player ${playerIndex + 1} scouts ahead, but the room is eerily calm. Nothing happens.`;
  };

  const resetGame = () => {
    stopCamera();
    setScreen('main');
    setPlayerCount(2);
    setCurrentPlayer(0);
    setCharacters([]);
    setScannedCards([]);
    setRoundPhase('playerTurn');
    setQrData('');
    setBoss({ head: 5, body: 5, shield: 5 });
    setShardSchedule([]);
    setNextShardIndex(0);
  };

  // ------------ BOSS DAMAGE ----------------
  const damageBoss = (part) => {
    setBoss(prev => ({ ...prev, [part]: Math.max(prev[part] - 1, 0) }));
  };

  // ------------ SPEECH (ElevenLabs fantasy AI voice) ----------------
  const speakWithBrowser = (text) => {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const speakText = (text) => {
    console.log('TTS: Speaking:', text);

    fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text
      })
    })
      .then(async res => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`TTS API error: ${res.status} ${res.statusText} - ${errorText}`);
        }
        return res.arrayBuffer();
      })
      .then(arrayBuffer => {
        const audio = new Audio();
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        audio.src = URL.createObjectURL(blob);
        audio.play().catch(e => {
          console.error('Audio play error:', e);
          speakWithBrowser(text);
        });
      })
      .catch(e => {
        console.error('ElevenLabs TTS error:', e);
        speakWithBrowser(text);
      });
  };

  // ------------ EXIT BUTTON ----------------
  const ExitButton = ({ onClick }) => (
    <button onClick={onClick} style={exitStyle}>×</button>
  );

  // ------------ MAIN MENU ----------------
  if (screen === 'main') {
    return (
      <div style={menuStyle}>
        <h1 style={titleStyle}>OBRYNDEL</h1>
        <button style={buttonStyle} onClick={() => setScreen('intro')}>Start Game</button>
      </div>
    );
  }

  // ------------ INTRO ----------------
  if (screen === 'intro') {
    return (
      <div style={textBoxStyle}>
        <h2 style={{ color: '#FFD700' }}>Welcome to Obryndel!</h2>
        <p>Choose number of players:</p>

        <div style={{ marginTop: 20, marginBottom: 30 }}>
          <label style={{ fontSize: '1.2rem' }}>Players: {playerCount}</label>
          <input
            type="range"
            min="1"
            max="4"
            value={playerCount}
            onChange={e => setPlayerCount(parseInt(e.target.value))}
            style={{ width: 250 }}
          />
        </div>

        <button style={buttonStyle} onClick={() => setScreen('characterSelect')}>
          Continue
        </button>
      </div>
    );
  }

  // ------------ CHARACTER SELECTION ----------------
  if (screen === 'characterSelect') {
    // Determine remaining characters
    const pickedChars = characters.filter(c => c);
    const remainingChars = availableCharacters.map(c => ({
      name: c,
      disabled: pickedChars.includes(c)
    }));

    return (
      <div style={textBoxStyle}>
        <ExitButton onClick={resetGame} />
        <div style={{ ...cardStyle, width: '100%', maxWidth: 720, padding: 28 }}>
          <h2 style={{ color: '#D9B65A', marginTop: 0, fontFamily: "'Merriweather', Georgia, serif" }}>Player {currentPlayer + 1}: Choose Your Champion</h2>
          <p style={{ color: '#cfc1a3', marginTop: 6 }}>Each class can only be chosen once.</p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
            {remainingChars.map(c => (
              <div key={c.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <button
                  style={{
                    ...buttonStyle,
                    minWidth: 140,
                    opacity: c.disabled ? 0.45 : 1,
                    cursor: c.disabled ? 'not-allowed' : 'pointer',
                    background: c.disabled ? 'linear-gradient(180deg,#2a2a2a,#1b1714)' : 'linear-gradient(180deg,#3a1f1f,#2b1313)',
                    border: c.disabled ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(213,169,62,0.9)'
                  }}
                  disabled={c.disabled}
                  onClick={() => selectCharacter(c.name)}
                >
                  {c.name}
                </button>
                <div style={{ marginTop: 8, color: '#cfc1a3', fontSize: 12 }}>{c.disabled ? 'Taken' : 'Available'}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {characters.map((c, i) => (
              <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.35)', color: '#e6d8ad', minWidth: 120 }}>
                {c ? `${c} — Player ${i + 1}` : `Player ${i + 1} — ?`}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ------------ BOSS PHASE ----------------
  if (screen === 'boss') {
    const bossDead = boss.head === 0 && boss.body === 0 && boss.shield === 0;

    const flashDamage = (part) => {
      const el = document.getElementById(part + 'Damage');
      if (!el) return;
      el.style.opacity = 1;
      setTimeout(() => { el.style.opacity = 0; }, 1000);
    };

    const handleDamage = (part) => {
      damageBoss(part);
      flashDamage(part);
    };

    return (
      <div style={textBoxStyle}>
        <ExitButton onClick={resetGame} />
        <h2 style={{ color: '#FFD700', marginBottom: 10 }}>ACT 3: FINAL BOSS</h2>

        {bossDead ? (
          <>
            <h2>Victory!</h2>
            <button style={buttonStyle} onClick={resetGame}>Main Menu</button>
          </>
        ) : (
          <>
            {/* Boss Sprite Container: centered layers with altar styling */}
            <div style={{ ...cardStyle, width: 320, height: 340, margin: '0 auto 18px', padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {/* Body */}
              {boss.body > 0 && (
                <>
                  <img
                    src={bossBody}
                    alt="body"
                    style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 1 }}
                  />
                  <img
                    id="bodyDamage"
                    src={bossBodyDamage}
                    alt="body damage"
                    style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 2, opacity: 0 }}
                  />
                </>
              )}
              {/* Shield */}
              {boss.shield > 0 && (
                <>
                  <img
                    src={bossShield}
                    alt="shield"
                    style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 3 }}
                  />
                  <img
                    id="shieldDamage"
                    src={bossShieldDamage}
                    alt="shield damage"
                    style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 4, opacity: 0 }}
                  />
                </>
              )}
              {/* Head */}
              {boss.head > 0 && (
                <>
                  <img
                    src={bossHead}
                    alt="head"
                    style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 5 }}
                  />
                  <img
                    id="headDamage"
                    src={bossHeadDamage}
                    alt="head damage"
                    style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 6, opacity: 0 }}
                  />
                </>
              )}
              </div>
            </div>

            {/* HP Text */}
            <div style={{ textAlign: 'center', marginTop: 30, marginBottom: 10 }}>
              <p>Head HP: {boss.head}</p>
              <p>Body HP: {boss.body}</p>
              <p>Shield HP: {boss.shield}</p>
            </div>

            {/* Buttons */}
            <div style={bossButtonBar}>
              <button style={buttonStyle} onClick={() => handleDamage('head')}>Hit Head</button>
              <button style={buttonStyle} onClick={() => handleDamage('body')}>Hit Body</button>
              <button style={buttonStyle} onClick={() => handleDamage('shield')}>Hit Shield</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ------------ GAME ----------------
  if (screen === 'game') {
    return (
      <div style={textBoxStyle}>
        <div style={{ position: 'absolute', top: 24, right: 28, color: '#D9B65A', fontWeight: 700 }}>ACT {act}</div>
        {/* Event/scan result card */}
        {qrData && (
          <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
            <div style={{ ...cardStyle, maxWidth: 720, padding: 24 }}>
              <h3 style={{ marginTop: 0, color: '#EFD88B' }}>Event</h3>
              <p style={{ color: '#EDE6CF' }}>{qrData}</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <button onClick={() => { setQrData(''); }} style={buttonStyle}>Continue</button>
              </div>
            </div>
          </div>
        )}
        <ExitButton onClick={resetGame} />
        <h2>Player {currentPlayer + 1}</h2>

        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {!cameraStarted && roundPhase === 'scanQR' && (
          <button style={buttonStyle} onClick={startCamera}>Scan QR</button>
        )}

        {roundPhase === 'playerTurn' && (
          <button style={buttonStyle} onClick={nextPlayer}>End Turn</button>
        )}

        {cameraError && <p style={{ color: 'red' }}>{cameraError}</p>}
      </div>
    );
  }

  return null;
}

// ------------ STYLES ----------------
const menuStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(800px 400px at 15% 10%, rgba(120,40,20,0.06), transparent), linear-gradient(180deg, #020203 0%, #09070a 60%, #0b0508 100%)',
  fontFamily: "'Cinzel', 'Merriweather', Georgia, serif",
  padding: 28,
};

const titleStyle = {
  fontSize: '4rem',
  color: '#F6E6A8',
  marginBottom: 12,
  letterSpacing: 6,
  lineHeight: 1,
  textTransform: 'uppercase',
  textShadow: '0 12px 40px rgba(0,0,0,0.75), 0 0 18px rgba(220,180,70,0.08)',
};

const buttonStyle = {
  padding: '14px 26px',
  fontSize: '1.05rem',
  background: 'linear-gradient(180deg,#5a3b1b,#2b1708)',
  border: '1px solid rgba(230,185,70,0.18)',
  borderRadius: 14,
  color: '#FFF8E6',
  cursor: 'pointer',
  margin: 10,
  boxShadow: '0 14px 40px rgba(5,3,2,0.75), inset 0 1px 0 rgba(255,255,255,0.02)',
  transition: 'transform 140ms cubic-bezier(.2,.8,.2,1), box-shadow 140ms ease',
};

const textBoxStyle = {
  width: '100%',
  maxWidth: 980,
  minHeight: '100vh',
  padding: 36,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  background: 'linear-gradient(180deg, rgba(10,8,6,0.6), rgba(4,3,2,0.6))',
  color: '#EDE6CF',
  textAlign: 'center',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.02)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.02)',
};

const exitStyle = {
  position: 'fixed',
  top: 18,
  left: 18,
  width: 44,
  height: 44,
  borderRadius: 10,
  background: 'linear-gradient(180deg, rgba(255,235,180,0.04), rgba(0,0,0,0.2))',
  color: '#EFD88B',
  fontSize: 20,
  cursor: 'pointer',
  border: '1px solid rgba(213,169,62,0.12)',
  boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
};

const bossButtonBar = {
  position: 'fixed',
  // lift buttons above phone bottom bars; use env() when available with a fallback
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 18,
  zIndex: 60,
};

// Small reusable card style used for grouped controls (parchment/altar feel)
const cardStyle = {
  background: 'linear-gradient(180deg, rgba(36,24,18,0.9), rgba(6,4,3,0.9))',
  border: '1px solid rgba(213,169,62,0.12)',
  padding: 22,
  borderRadius: 14,
  boxShadow: '0 28px 100px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.02)',
};

// Utility for HP boxes
const hpBox = {
  display: 'inline-block',
  padding: '8px 14px',
  borderRadius: 8,
  background: 'linear-gradient(180deg,#2b1f18,#14100d)',
  color: '#F4E6C2',
  border: '1px solid rgba(213,169,62,0.12)',
  boxShadow: '0 8px 26px rgba(0,0,0,0.7)'
};
