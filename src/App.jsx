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
  const [screen, setScreen] = useState('main'); // main | intro | instructions | game | boss
  const [playerCount, setPlayerCount] = useState(2);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [scannedCards, setScannedCards] = useState([]);
  const [roundPhase, setRoundPhase] = useState('playerTurn');
  const [cameraStarted, setCameraStarted] = useState(false);
  const [qrData, setQrData] = useState('');
  const [cameraError, setCameraError] = useState('');

  const [boss, setBoss] = useState({ head: 5, body: 5, shield: 5 });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  const availableCharacters = ['Goblin', 'Troll', 'Cyclops', 'Witch'];
  const maxTiles = 15;

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
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code && code.data.startsWith('Tile-')) {
        if (!scannedCards.includes(code.data)) {
          setQrData(code.data);
          setScannedCards(prev => [...prev, code.data]);

          stopCamera();

          if (code.data === 'Tile-030') {
            setScreen('boss');
          } else {
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
    if (currentPlayer < playerCount - 1) {
      setCurrentPlayer(currentPlayer + 1);
    } else {
      setCurrentPlayer(0);
      setRoundPhase('scanQR');
      setQrData('');
    }
  };

  const selectCharacter = (char) => {
    const newChars = [...characters];
    newChars[currentPlayer] = char;
    setCharacters(newChars);
    if (currentPlayer < playerCount - 1) {
      setCurrentPlayer(currentPlayer + 1);
    }
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
  };

  // ------------ BOSS DAMAGE ----------------
  const damageBoss = (part) => {
    setBoss(prev => ({ ...prev, [part]: Math.max(prev[part] - 1, 0) }));
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

        <button style={buttonStyle} onClick={() => setScreen('instructions')}>
          Continue
        </button>
      </div>
    );
  }

  // ------------ INSTRUCTIONS ----------------
  if (screen === 'instructions') {
    return (
      <div style={textBoxStyle}>
        <ExitButton onClick={() => setScreen('main')} />
        <p>Each player has two actions. Scan tiles to progress.</p>
        <button style={buttonStyle} onClick={() => setScreen('game')}>
          Begin Journey
        </button>
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
            <div style={{ position: 'relative', width: 250, height: 250, marginTop: -30 }}>
              {boss.body > 0 && (
                <>
                  <img src={bossBody} style={layerStyle} alt="body" />
                  <img id="bodyDamage" src={bossBodyDamage} style={{ ...layerStyle, opacity: 0 }} alt="body damage" />
                </>
              )}
              {boss.shield > 0 && (
                <>
                  <img src={bossShield} style={layerStyle} alt="shield" />
                  <img id="shieldDamage" src={bossShieldDamage} style={{ ...layerStyle, opacity: 0 }} alt="shield damage" />
                </>
              )}
              {boss.head > 0 && (
                <>
                  <img src={bossHead} style={layerStyle} alt="head" />
                  <img id="headDamage" src={bossHeadDamage} style={{ ...layerStyle, opacity: 0 }} alt="head damage" />
                </>
              )}
            </div>

            <div style={{ marginTop: 40 }}>
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

  // ------------ GAME ----------------
  if (screen === 'game') {
    return (
      <div style={textBoxStyle}>
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
  background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
};

const titleStyle = {
  fontSize: '3rem',
  color: '#F4E4C1',
  marginBottom: 40,
};

const buttonStyle = {
  padding: '15px 30px',
  fontSize: '1.2rem',
  background: '#8B4513',
  border: '2px solid #CD853F',
  borderRadius: 10,
  color: '#F4E4C1',
  cursor: 'pointer',
  margin: 10,
};

const textBoxStyle = {
  minHeight: '100vh',
  padding: 40,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
  color: '#F4E4C1',
  textAlign: 'center',
};

const exitStyle = {
  position: 'fixed',
  top: 20,
  left: 20,
  width: 40,
  height: 40,
  borderRadius: '50%',
  background: 'rgba(139,69,19,0.8)',
  color: '#F4E4C1',
  fontSize: 24,
  cursor: 'pointer',
};

const layerStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
};

const bossButtonBar = {
  position: 'fixed',
  bottom: 20,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 20,
};
