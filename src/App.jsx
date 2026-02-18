import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';

// Boss sprites
import bossHead from './assets/boss-head.png';
import bossBody from './assets/boss-body.png';
import bossShield from './assets/boss-shield.png';
import bossHeadDamage from './assets/boss-head-damage.png';
import bossBodyDamage from './assets/boss-body-damage.png';
import bossShieldDamage from './assets/boss-shield-damage.png';

// ─── Narration lines ───────────────────────────────────────────────────────────
const NARRATION = {
  intro:
    "Baron Thobrick's quest to shatter the Mythical Crystal of the Ogre has been successful. " +
    "Now that the Crystal has been shattered the magical barrier shielding the foul creatures of Obryndel is crumbling. " +
    "Humankind may now live long in a world of peace, devoid of horrible creatures… " +
    "Unless… " +
    "You, Scoundrels of Obryndel! " +
    "It's up to you to gather the four shards, forge them together once more and slay Thobrick! " +
    "Choose the amount of scoundrels to proceed.",

  charSelectOpen:
    "Ah… I see… You dare challenge me? Scoundrels! One by one, show yourself to me!",

  charSelectNudge1:
    "Sigh… Are you daft? Pick a character card and present it to me.",

  charSelectNudge2:
    "Do I really have to spell it out for you? Pick a character and scan the QR-code…",

  afterChar: [
    null,
    "Scoundrel number 2, present thy self before me!",
    "Go on… scoundrel number 3.",
    "Ah…. Finally… What might this last scoundrel be?",
  ],

  charScanned: {
    'Character-001': "BAH! A Goblin?! I shall flatten ye with my boot.",
    'Character-002': "Eugh…. A troll… So that's where that wretched stench was coming from…",
    'Character-003': "Hah! A cyclops?! You look like a one eyed thumb…",
    'Character-004': "Witch! I shall wack ye with your own broom!",
  },

  allCharsSelected:
    "You really think you can stop me? Well then… Have at it!",

  firstRound:
    "Gah… Do I really have to explain everything for thee? " +
    "You certainly are a sad excuse of a creature… " +
    "Very well then… " +
    "You! Scoundrel number one, this is your turn to take action. " +
    "You may choose to move or use an item, of which you have none right at this very moment. " +
    "You must take two actions during your round. " +
    "After these are made you shall discard the frontmost card in the deck, which will determine what event will take place. " +
    "After this, Scoundrel number two will go through the same procedure and so on… " +
    "Good luck finding those wicked crystal shards, they appear at random throughout the realm! HA HA HA. " +
    "Your silly little quest is most certainly going to fail. " +
    "There is simply no chance for you mouth breathing rotten creatures to gather the four shards and forge them together at your cursed altar in your cursed village before the magic barrier is broken… " +
    "Ta ta!",

  itemFound:
    "Oh? So you found yourself an item? Surely you will need all the help you can possibly find to even last a second against me! " +
    "You may take an item from the bag.",

  trapTriggered:
    "You absolute fool! You have truly done it now! " +
    "You have stepped right into my trap, draining one health point from you!",

  bossEntrance:
    "Scoundrels! You dimwitted sods! Foiling my work are we? " +
    "Very well… I shall take care of you on a whim… " +
    "I present to you… Me! Lord Baron Thobrick the first! Huzza! " +
    "And now… You die.",

  bossHeadZero:
    "My head! My glorious head! …. Who needs a head anyways?",

  bossBodyZero:
    "What!? You've destroyed my body? My entire body? Shame on you…",

  bossShieldZero:
    "My shield! That was expensive! You shall pay for this!",

  bossDefeated:
    "Curse you, foul beasts! You've won this time… " +
    "But know this, for every drop of blood spilled here, a thousand more will rise! " +
    "With all my might I shall find a way to raise from my grave and vanquish your kind! " +
    "Ugh… …I am dead now.",
};

export default function App() {
  const [screen, setScreen] = useState('main');
  const [playerCount, setPlayerCount] = useState(2);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [players, setPlayers] = useState([]);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [pendingScanPlayer, setPendingScanPlayer] = useState(null);
  const [act, setAct] = useState(1);
  const [scannedCards, setScannedCards] = useState([]);
  const [roundPhase, setRoundPhase] = useState('playerTurn');
  const [cameraStarted, setCameraStarted] = useState(false);
  const [qrData, setQrData] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [shardSchedule, setShardSchedule] = useState([]);
  const [nextShardIndex, setNextShardIndex] = useState(0);
  const [boss, setBoss] = useState({ head: 5, body: 5, shield: 5 });
  const [bossDefeated, setBossDefeated] = useState(false);

  // Character selection camera state
  const [charCameraStarted, setCharCameraStarted] = useState(false);
  const [charCameraError, setCharCameraError] = useState('');
  const [charScanFeedback, setCharScanFeedback] = useState('');

  // Game camera refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  // Character camera refs
  const charVideoRef = useRef(null);
  const charCanvasRef = useRef(null);
  const charAnimRef = useRef(null);
  const charStreamRef = useRef(null);

  // Nudge timers
  const nudge1Ref = useRef(null);
  const nudge2Ref = useRef(null);

  const availableCharacters = ['Goblin', 'Troll', 'Cyclops', 'Witch'];

  const characterQRMap = {
    'Character-001': 'Goblin',
    'Character-002': 'Troll',
    'Character-003': 'Cyclops',
    'Character-004': 'Witch',
  };

  const shardZones = [
    'Village of Obryndel',
    'Forest of Travesy',
    'Charstone Alpines',
    'Mudbrik Castle',
  ];
  const shardOrderNames = ['First', 'Second', 'Third', 'Fourth'];

  // ─── Speech ────────────────────────────────────────────────────────────────
  const speakWithBrowser = (text) => {
    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const speakText = (text) => {
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
      .then(async res => {
        if (!res.ok) throw new Error(`TTS error: ${res.status}`);
        return res.arrayBuffer();
      })
      .then(buf => {
        const blob = new Blob([buf], { type: 'audio/mpeg' });
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play().catch(() => speakWithBrowser(text));
      })
      .catch(() => speakWithBrowser(text));
  };

  // ─── Nudge timers ──────────────────────────────────────────────────────────
  const clearNudgeTimers = () => {
    if (nudge1Ref.current) { clearTimeout(nudge1Ref.current); nudge1Ref.current = null; }
    if (nudge2Ref.current) { clearTimeout(nudge2Ref.current); nudge2Ref.current = null; }
  };

  const startNudgeTimers = () => {
    clearNudgeTimers();
    nudge1Ref.current = setTimeout(() => {
      speakText(NARRATION.charSelectNudge1);
      nudge2Ref.current = setTimeout(() => {
        speakText(NARRATION.charSelectNudge2);
      }, 5000);
    }, 5000);
  };

  // ─── Shard schedule ────────────────────────────────────────────────────────
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

  // ─── Game camera ───────────────────────────────────────────────────────────
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
      streamRef.current.getTracks().forEach(t => t.stop());
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
            const msg = NARRATION.bossEntrance;
            setQrData(msg);
            speakText(msg);
            setScreen('boss');
            setAct(3);
            return;
          }

          if (num >= 1 && num <= 29) {
            const targetPlayer = pendingScanPlayer != null ? pendingScanPlayer : currentPlayer;
            const eventMsg = handleTileEvent(num, targetPlayer);
            const currentRound = roundsCompleted + 1;
            const shardMsg = maybeGetShardMessage(currentRound);
            const combinedMsg = [eventMsg, shardMsg].filter(Boolean).join(' ');
            if (combinedMsg) {
              setQrData(combinedMsg);
              speakText(combinedMsg);
            }
            if (targetPlayer < playerCount - 1) {
              setCurrentPlayer(targetPlayer + 1);
            } else {
              setCurrentPlayer(0);
              setRoundsCompleted(prev => prev + 1);
            }
            setPendingScanPlayer(null);
            setRoundPhase('playerTurn');
          } else {
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
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [roundPhase, cameraStarted]);

  // ─── Character camera ──────────────────────────────────────────────────────
  const startCharacterCamera = async () => {
    if (!charVideoRef.current) return;
    setCharCameraError('');
    setCharScanFeedback('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      charStreamRef.current = stream;
      charVideoRef.current.srcObject = stream;
      await charVideoRef.current.play();
      setCharCameraStarted(true);
    } catch (err) {
      setCharCameraError('Camera error: ' + err.message);
    }
  };

  const stopCharacterCamera = () => {
    if (charStreamRef.current) {
      charStreamRef.current.getTracks().forEach(t => t.stop());
      charStreamRef.current = null;
    }
    setCharCameraStarted(false);
    if (charAnimRef.current) cancelAnimationFrame(charAnimRef.current);
  };

  const scanCharacterQRLoop = () => {
    if (!charVideoRef.current || !charCanvasRef.current) return;
    const video = charVideoRef.current;
    const canvas = charCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && characterQRMap[code.data]) {
        const charName = characterQRMap[code.data];
        const alreadyPicked = characters.filter(c => c).includes(charName);
        if (alreadyPicked) {
          setCharScanFeedback(`${charName} is already taken! Try a different card.`);
        } else {
          clearNudgeTimers();
          // Speak character taunt, then after a pause speak the next player prompt
          speakText(NARRATION.charScanned[code.data]);
          stopCharacterCamera();
          setCharScanFeedback('');
          selectCharacter(charName, code.data);
          return;
        }
      }
    }
    charAnimRef.current = requestAnimationFrame(scanCharacterQRLoop);
  };

  useEffect(() => {
    if (charCameraStarted) {
      charAnimRef.current = requestAnimationFrame(scanCharacterQRLoop);
    }
    return () => { if (charAnimRef.current) cancelAnimationFrame(charAnimRef.current); };
  }, [charCameraStarted, characters]);

  // Stop char camera when leaving that screen
  useEffect(() => {
    if (screen !== 'characterSelect') {
      stopCharacterCamera();
      clearNudgeTimers();
    }
  }, [screen]);

  // Speak opening narration when character select screen mounts for the first time
  useEffect(() => {
    if (screen === 'characterSelect') {
      speakText(NARRATION.charSelectOpen);
      startNudgeTimers();
    }
  }, [screen]);

  // ─── Player / character functions ──────────────────────────────────────────
  const nextPlayer = () => {
    setPendingScanPlayer(currentPlayer);
    setRoundPhase('scanQR');
    setQrData('');
  };

  const selectCharacter = (char) => {
    const newChars = [...characters];
    newChars[currentPlayer] = char;
    setCharacters(newChars);

    const nextPlayerIndex = currentPlayer + 1;

    if (nextPlayerIndex < playerCount) {
      const promptLine = NARRATION.afterChar[nextPlayerIndex];
      if (promptLine) {
        setTimeout(() => {
          speakText(promptLine);
          startNudgeTimers();
        }, 2800);
      }
      setCurrentPlayer(nextPlayerIndex);
    } else {
      // All players chosen
      setTimeout(() => speakText(NARRATION.allCharsSelected), 2800);
      setTimeout(() => {
        setScreen('game');
        setCurrentPlayer(0);
      }, 5500);
    }
  };

  // ─── Init game ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'game') {
      const init = Array.from({ length: playerCount }).map((_, i) => ({
        char: characters[i] || null,
        hp: 5,
        items: [],
      }));
      setPlayers(init);
      setRoundsCompleted(0);
      setAct(1);
      setPendingScanPlayer(null);
      setRoundPhase('playerTurn');
      setCurrentPlayer(0);
      setBossDefeated(false);
      setShardSchedule(createShardSchedule());
      setNextShardIndex(0);

      // First round narration fires once on game start
      setTimeout(() => speakText(NARRATION.firstRound), 800);
    }
  }, [screen]);

  // ─── Act update ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'boss') { setAct(3); return; }
    if (roundsCompleted >= 7) setAct(2);
    else setAct(1);
  }, [roundsCompleted, screen]);

  // ─── Tile events ───────────────────────────────────────────────────────────
  const handleTileEvent = (tileNum, playerIndex) => {
    if (tileNum < 1 || tileNum > 29) return null;
    const zone = Math.min(2, act);
    const weights = act === 1
      ? { item: 0.22, trap: 0.18 }
      : { item: 0.18, trap: 0.22 };
    const roll = Math.random();
    const outcome = roll < weights.item ? 'item'
      : roll < weights.item + weights.trap ? 'trap'
      : 'neutral';

    setPlayers(prev => {
      const copy = [...prev];
      if (!copy[playerIndex]) return prev;
      if (outcome === 'trap') {
        copy[playerIndex] = { ...copy[playerIndex], hp: Math.max(copy[playerIndex].hp - 1, 0) };
      } else if (outcome === 'item') {
        const newItem = `Treasure (Zone ${zone})`;
        copy[playerIndex] = { ...copy[playerIndex], items: [...copy[playerIndex].items, newItem] };
      }
      return copy;
    });

    if (outcome === 'trap') return NARRATION.trapTriggered;
    if (outcome === 'item') return NARRATION.itemFound;
    return `Player ${playerIndex + 1} scouts ahead, but the room is eerily calm. Nothing happens.`;
  };

  // ─── Reset ─────────────────────────────────────────────────────────────────
  const resetGame = () => {
    stopCamera();
    stopCharacterCamera();
    clearNudgeTimers();
    setScreen('main');
    setPlayerCount(2);
    setCurrentPlayer(0);
    setCharacters([]);
    setScannedCards([]);
    setRoundPhase('playerTurn');
    setQrData('');
    setBoss({ head: 5, body: 5, shield: 5 });
    setBossDefeated(false);
    setShardSchedule([]);
    setNextShardIndex(0);
    setCharScanFeedback('');
    setCharCameraError('');
  };

  // ─── Boss damage ───────────────────────────────────────────────────────────
  const damageBoss = (part) => {
    setBoss(prev => {
      const newVal = Math.max(prev[part] - 1, 0);
      const updated = { ...prev, [part]: newVal };

      if (newVal === 0) {
        const allDead = Object.keys(updated).every(k => updated[k] === 0);
        if (allDead) {
          setBossDefeated(true);
          speakText(NARRATION.bossDefeated);
        } else {
          if (part === 'head') speakText(NARRATION.bossHeadZero);
          if (part === 'body') speakText(NARRATION.bossBodyZero);
          if (part === 'shield') speakText(NARRATION.bossShieldZero);
        }
      }

      return updated;
    });
  };

  // ─── Exit button ───────────────────────────────────────────────────────────
  const ExitButton = ({ onClick }) => (
    <button onClick={onClick} style={exitStyle}>×</button>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREENS
  // ═══════════════════════════════════════════════════════════════════════════

  if (screen === 'main') {
    return (
      <div style={menuStyle}>
        <h1 style={titleStyle}>OBRYNDEL</h1>
        <button
          style={buttonStyle}
          onClick={() => {
            speakText(NARRATION.intro);
            setScreen('intro');
          }}
        >
          Start Game
        </button>
      </div>
    );
  }

  if (screen === 'intro') {
    return (
      <div style={textBoxStyle}>
        <h2 style={{ color: '#FFD700' }}>Welcome to Obryndel!</h2>
        <p>Choose number of players:</p>
        <div style={{ marginTop: 20, marginBottom: 30 }}>
          <label style={{ fontSize: '1.2rem' }}>Players: {playerCount}</label>
          <input
            type="range" min="1" max="4" value={playerCount}
            onChange={e => setPlayerCount(parseInt(e.target.value))}
            style={{ width: 250, display: 'block', margin: '12px auto 0' }}
          />
        </div>
        <button
          style={buttonStyle}
          onClick={() => {
            setCurrentPlayer(0);
            setCharacters([]);
            setScreen('characterSelect');
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  if (screen === 'characterSelect') {
    const pickedChars = characters.filter(c => c);
    const remaining = availableCharacters.filter(c => !pickedChars.includes(c));

    return (
      <div style={textBoxStyle}>
        <ExitButton onClick={() => { stopCharacterCamera(); resetGame(); }} />

        <div style={{ ...cardStyle, width: '100%', maxWidth: 720, padding: 28 }}>
          <h2 style={{ color: '#D9B65A', marginTop: 0, fontFamily: "'Merriweather', Georgia, serif" }}>
            Player {currentPlayer + 1}: Scan Your Character Card
          </h2>
          <p style={{ color: '#cfc1a3', marginTop: 6, marginBottom: 18 }}>
            Hold your character QR card up to the{' '}
            <strong style={{ color: '#EFD88B' }}>front camera</strong>.
          </p>

          {/* Camera viewfinder */}
          <div style={{
            position: 'relative', width: 280, height: 280,
            margin: '0 auto 18px', borderRadius: 14, overflow: 'hidden',
            border: '2px solid rgba(213,169,62,0.35)', background: '#000',
          }}>
            <video
              ref={charVideoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              muted
              playsInline
            />
            {charCameraStarted && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{ width: 160, height: 160, border: '2px solid rgba(213,169,62,0.75)', borderRadius: 10 }} />
              </div>
            )}
            {!charCameraStarted && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6a5a3a', fontSize: 14,
              }}>
                Camera off
              </div>
            )}
          </div>
          <canvas ref={charCanvasRef} style={{ display: 'none' }} />

          <div style={{ marginBottom: 18 }}>
            {!charCameraStarted ? (
              <button style={buttonStyle} onClick={startCharacterCamera}>Start Scanning</button>
            ) : (
              <button style={{ ...buttonStyle, opacity: 0.65 }} onClick={stopCharacterCamera}>Stop Camera</button>
            )}
          </div>

          {charScanFeedback && (
            <p style={{ color: '#ff9a60', marginBottom: 12, fontSize: 14 }}>{charScanFeedback}</p>
          )}
          {charCameraError && (
            <p style={{ color: '#ff7070', marginBottom: 12, fontSize: 14 }}>{charCameraError}</p>
          )}

          <div style={{ marginBottom: 18, color: '#9a8a6a', fontSize: 12, lineHeight: 1.7 }}>
            <strong style={{ color: '#b09a6a' }}>Card codes:</strong><br />
            Character-001 → Goblin &nbsp;|&nbsp;
            Character-002 → Troll &nbsp;|&nbsp;
            Character-003 → Cyclops &nbsp;|&nbsp;
            Character-004 → Witch
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {Array.from({ length: playerCount }).map((_, i) => (
              <div key={i} style={{
                padding: '8px 14px', borderRadius: 8,
                background: characters[i] ? 'rgba(60,40,10,0.7)' : 'rgba(0,0,0,0.3)',
                color: characters[i] ? '#e6d8ad' : '#6a5a3a',
                border: characters[i]
                  ? '1px solid rgba(213,169,62,0.2)'
                  : '1px solid rgba(255,255,255,0.04)',
                minWidth: 120, fontSize: 13,
              }}>
                {characters[i] ? `✓ ${characters[i]}` : `Player ${i + 1} — ?`}
              </div>
            ))}
          </div>

          {remaining.length > 0 && (
            <p style={{ color: '#7a6a4a', fontSize: 12, marginTop: 14 }}>
              Still available: {remaining.join(', ')}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'boss') {
    const flashDamage = (part) => {
      const el = document.getElementById(part + 'Damage');
      if (!el) return;
      el.style.opacity = 1;
      setTimeout(() => { el.style.opacity = 0; }, 1000);
    };
    const handleDamage = (part) => { damageBoss(part); flashDamage(part); };

    return (
      <div style={textBoxStyle}>
        <ExitButton onClick={resetGame} />
        <h2 style={{ color: '#FFD700', marginBottom: 10 }}>ACT 3: FINAL BOSS</h2>

        {bossDefeated ? (
          <>
            <p style={{
              color: '#EDE6CF', maxWidth: 560, lineHeight: 1.8,
              fontStyle: 'italic', marginBottom: 24,
            }}>
              {NARRATION.bossDefeated}
            </p>
            <h2 style={{ color: '#FFD700' }}>Victory!</h2>
            <button style={buttonStyle} onClick={resetGame}>Main Menu</button>
          </>
        ) : (
          <>
            <div style={{
              ...cardStyle, width: 320, height: 340,
              margin: '0 auto 18px', padding: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {boss.body > 0 && (
                  <>
                    <img src={bossBody} alt="body" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 1 }} />
                    <img id="bodyDamage" src={bossBodyDamage} alt="body damage" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 2, opacity: 0 }} />
                  </>
                )}
                {boss.shield > 0 && (
                  <>
                    <img src={bossShield} alt="shield" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 3 }} />
                    <img id="shieldDamage" src={bossShieldDamage} alt="shield damage" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 4, opacity: 0 }} />
                  </>
                )}
                {boss.head > 0 && (
                  <>
                    <img src={bossHead} alt="head" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 5 }} />
                    <img id="headDamage" src={bossHeadDamage} alt="head damage" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '100%', zIndex: 6, opacity: 0 }} />
                  </>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: 30, marginBottom: 10 }}>
              <p>Head HP: {boss.head}</p>
              <p>Body HP: {boss.body}</p>
              <p>Shield HP: {boss.shield}</p>
            </div>

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

  if (screen === 'game') {
    return (
      <div style={textBoxStyle}>
        <div style={{ position: 'absolute', top: 24, right: 28, color: '#D9B65A', fontWeight: 700 }}>
          ACT {act}
        </div>

        {qrData && (
          <div style={{
            position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80,
          }}>
            <div style={{ ...cardStyle, maxWidth: 720, padding: 24 }}>
              <h3 style={{ marginTop: 0, color: '#EFD88B' }}>Event</h3>
              <p style={{ color: '#EDE6CF' }}>{qrData}</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <button onClick={() => setQrData('')} style={buttonStyle}>Continue</button>
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

// ─── Styles ────────────────────────────────────────────────────────────────────
const menuStyle = {
  minHeight: '100vh', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  background: 'radial-gradient(800px 400px at 15% 10%, rgba(120,40,20,0.06), transparent), linear-gradient(180deg, #020203 0%, #09070a 60%, #0b0508 100%)',
  fontFamily: "'Cinzel', 'Merriweather', Georgia, serif", padding: 28,
};

const titleStyle = {
  fontSize: '4rem', color: '#F6E6A8', marginBottom: 12, letterSpacing: 6,
  lineHeight: 1, textTransform: 'uppercase',
  textShadow: '0 12px 40px rgba(0,0,0,0.75), 0 0 18px rgba(220,180,70,0.08)',
};

const buttonStyle = {
  padding: '14px 26px', fontSize: '1.05rem',
  background: 'linear-gradient(180deg,#5a3b1b,#2b1708)',
  border: '1px solid rgba(230,185,70,0.18)', borderRadius: 14,
  color: '#FFF8E6', cursor: 'pointer', margin: 10,
  boxShadow: '0 14px 40px rgba(5,3,2,0.75), inset 0 1px 0 rgba(255,255,255,0.02)',
  transition: 'transform 140ms cubic-bezier(.2,.8,.2,1), box-shadow 140ms ease',
};

const textBoxStyle = {
  width: '100%', maxWidth: 980, minHeight: '100vh', padding: 36,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
  background: 'linear-gradient(180deg, rgba(10,8,6,0.6), rgba(4,3,2,0.6))',
  color: '#EDE6CF', textAlign: 'center', borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.02)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.02)',
};

const exitStyle = {
  position: 'fixed', top: 18, left: 18, width: 44, height: 44,
  borderRadius: 10, background: 'linear-gradient(180deg, rgba(255,235,180,0.04), rgba(0,0,0,0.2))',
  color: '#EFD88B', fontSize: 20, cursor: 'pointer',
  border: '1px solid rgba(213,169,62,0.12)', boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
};

const bossButtonBar = {
  position: 'fixed',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 56px)',
  left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 18, zIndex: 60,
};

const cardStyle = {
  background: 'linear-gradient(180deg, rgba(36,24,18,0.9), rgba(6,4,3,0.9))',
  border: '1px solid rgba(213,169,62,0.12)', padding: 22, borderRadius: 14,
  boxShadow: '0 28px 100px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.02)',
};
