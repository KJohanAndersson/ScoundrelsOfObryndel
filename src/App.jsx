import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';

export default function App() {
  const [screen, setScreen] = useState('main'); // main | intro | instructions | game | gameover
  const [playerCount, setPlayerCount] = useState(2);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [scannedCards, setScannedCards] = useState([]);
  const [roundPhase, setRoundPhase] = useState('playerTurn'); // playerTurn | scanQR
  const [cameraStarted, setCameraStarted] = useState(false);
  const [qrData, setQrData] = useState('');
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const availableCharacters = ['Goblin', 'Troll', 'Cyclops', 'Witch'];

  const tileEvents = {
    'Tile-001': 'The world shifts beneath your feet. All players must move one tile in a random direction.',
    'Tile-002': 'You feel a strange pull from the earth. All players are teleported to the nearest water tile.',
    'Tile-003': 'A mystical barrier blocks your path. Find a key or spend 2 action points to break through.',
    'Tile-004': 'Ancient runes glow with power. One player of your choice gains +1 action point this turn.',
    'Tile-005': 'The ground trembles violently. All players lose 1 action point this turn.',
    'Tile-006': 'A healing spring appears. All players restore 2 vitality.',
    'Tile-007': 'Shadow creatures emerge from the darkness. All players must spend 1 action point to escape or lose 1 vitality.',
    'Tile-008': 'A merchant appears offering mysterious items. Each player may spend 1 action point to draw a treasure.',
    'Tile-009': 'The path splits and reforms. Each player must choose a new direction and move one tile.',
    'Tile-010': 'Thunder crashes across the land. Remove one nearby barrier tile.',
    'Tile-011': 'A friendly spirit offers guidance. One player may move to any adjacent tile for free.',
    'Tile-012': 'Poisonous gas fills the air. All players must move two tiles away or lose 2 vitality.',
    'Tile-013': 'You discover an ancient artifact half-buried in the soil. The current player gains one treasure.',
    'Tile-014': 'The temperature drops suddenly. All players lose 1 action point unless they spend 1 vitality.',
    'Tile-015': 'A puzzle door blocks the way forward. Solve it by spending 2 action points or remain in place.',
    'Tile-016': 'Wild magic surges through the area. All players are teleported to random adjacent tiles.',
    'Tile-017': 'You find a hidden cache of supplies. Each player gains 1 vitality.',
    'Tile-018': 'The spirits of Obryndel cry out in anguish. All players must move one tile toward the nearest spirit marker.',
    'Tile-019': 'A powerful guardian stands in your way. The current player must spend 2 action points or retreat one tile.',
    'Tile-020': 'The barrier fragment pulses with energy. The current player gains a barrier shard treasure.',
    'Tile-021': 'Illusions cloud your vision. All players swap positions with the nearest player.',
    'Tile-022': 'A safe haven appears among the ruins. All players may choose to stay and restore 2 vitality.',
    'Tile-023': 'The path behind you crumbles away. Remove the tile you just left from the board.',
    'Tile-024': "You hear Baron Thobrick's laughter echoing. All players lose 1 vitality.",
    'Tile-025': 'Time fractures around you. All players swap one treasure with the player to their left.',
    'Tile-026': 'The ground cracks open, revealing hidden riches. The current player gains one treasure, then the tile collapses and is removed.',
    'Tile-027': 'Reality twists for a moment. All players must move one tile toward the nearest unexplored tile.',
    'Tile-028': 'A rift in time opens before you. A gateway to the vulcano has appeared before you',
    'Tile-029': 'A rift in time opens before you. A gateway to the castle has appeared before you',
    'Tile-030': 'A rift in time opens before you. A gateway to the forest has appeared before you',
  };

  const maxTiles = 15; // Game over efter 15 QR-koder

  // ------------ CAMERA FUNCTIONS ----------------
  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraStarted(true);
      setRoundPhase('scanQR');
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Camera error: ' + err.message);
    }
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
          setScannedCards((prev) => [...prev, code.data]);
          setRoundPhase('playerTurn'); // tillbaka till nästa spelare
        }
      }
    }

    animationRef.current = requestAnimationFrame(scanQRCodeLoop);
  };

  useEffect(() => {
    if (roundPhase === 'scanQR' && cameraStarted) {
      scanQRCodeLoop();
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
      // Alla spelare har spelat → QR-fas
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
    setScreen('main');
    setPlayerCount(2);
    setCurrentPlayer(0);
    setCharacters([]);
    setScannedCards([]);
    setRoundPhase('playerTurn');
    setQrData('');
    setCameraStarted(false);
  };

  // ------------ EXIT BUTTON ----------------
  const ExitButton = ({ onClick }) => (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        top: 20,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: 'rgba(139,69,19,0.8)',
        color: '#F4E4C1',
        fontSize: 24,
        fontWeight: 'bold',
        cursor: 'pointer',
        zIndex: 1000,
      }}
    >
      ×
    </button>
  );

  // ------------ MAIN MENU ----------------
  if (screen === 'main') {
    return (
      <div style={menuStyle}>
        <h1 style={titleStyle}>OBRYNDEL</h1>
        <button style={buttonStyle} onClick={() => setScreen('intro')}>
          Start Game
        </button>
      </div>
    );
  }

  // ------------ INTRO ----------------
  if (screen === 'intro') {
    return (
      <div style={textBoxStyle}>
        <h2 style={{ color: '#FFD700' }}>Welcome to Obryndel!</h2>
        <p>
          Baron Thobrick shattered the magical barrier. Gather the fragments at the Ogre Shrine.
        </p>

        <div style={{ marginTop: 30, marginBottom: 30 }}>
          <label style={{ color: '#F4E4C1', fontSize: '1.2rem', marginBottom: 10, display: 'block' }}>
            Number of Players: {playerCount}
          </label>
          <input
            type="range"
            min="1"
            max="4"
            value={playerCount}
            onChange={(e) => setPlayerCount(parseInt(e.target.value))}
            style={{
              width: '80%',
              maxWidth: 400,
              height: 10,
              borderRadius: 5,
              background: '#8B4513',
              accentColor: '#FFD700',
            }}
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
        <p>
          Shuffle the QR-cards and place them in the holder. Each player has two action points per turn.
        </p>
        <button style={buttonStyle} onClick={() => setScreen('game')}>
          Begin Journey
        </button>
      </div>
    );
  }

  // ------------ GAME OVER ----------------
  if (scannedCards.length >= maxTiles) {
    return (
      <div style={textBoxStyle}>
        <h2 style={{ color: '#FFD700' }}>GAME OVER!</h2>
        <p>You have collected all fragments!</p>
        <button style={buttonStyle} onClick={resetGame}>Main Menu</button>
      </div>
    );
  }

  // ------------ GAME ----------------
  if (screen === 'game') {
    // Character selection
    if (characters.length < playerCount) {
      const availableChars = availableCharacters.filter(c => !characters.includes(c));
      return (
        <div style={textBoxStyle}>
          <ExitButton onClick={resetGame} />
          <h2>Player {currentPlayer + 1}: Choose Character</h2>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            {availableChars.map((char) => (
              <button key={char} style={buttonStyle} onClick={() => selectCharacter(char)}>
                {char}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Main game loop
    return (
      <div style={textBoxStyle}>
        <ExitButton onClick={resetGame} />
        <h2 style={{ color: '#FFD700' }}>Player {currentPlayer + 1}: {characters[currentPlayer]}</h2>
        <p>Scanned Cards: {scannedCards.length}/{maxTiles}</p>

        {/* Camera + canvas */}
        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Camera start button */}
        {!cameraStarted && roundPhase === 'scanQR' && (
          <button style={buttonStyle} onClick={startCamera}>
            Start Camera & Scan QR
          </button>
        )}

        {/* QR result */}
        {qrData && (
          <div style={{ marginTop: 20, padding: 20, border: '2px solid #CD853F', borderRadius: 10, background: '#8B4513' }}>
            <h3 style={{ color: '#FFD700' }}>{qrData}</h3>
            <p style={{ color: '#F4E4C1' }}>{tileEvents[qrData]}</p>
          </div>
        )}

        {/* Next player button */}
        {roundPhase === 'playerTurn' && (
          <button style={buttonStyle} onClick={nextPlayer}>
            End Turn
          </button>
        )}

        {cameraError && <p style={{ color: 'red' }}>{cameraError}</p>}
      </div>
    );
  }

  return null; // fallback
}

// ------------- STYLES ----------------
const menuStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
  fontFamily: "'Cinzel', serif",
};

const titleStyle = {
  fontSize: 'clamp(2rem, 8vw, 4rem)',
  color: '#F4E4C1',
  textAlign: 'center',
  marginBottom: 60,
  textShadow: '3px 3px 6px rgba(0,0,0,0.7)',
  letterSpacing: 3,
};

const buttonStyle = {
  padding: '20px 60px',
  fontSize: '1.5rem',
  background: 'linear-gradient(135deg, #8B4513, #A0522D)',
  border: '3px solid #CD853F',
  borderRadius: 10,
  color: '#F4E4C1',
  cursor: 'pointer',
  fontFamily: "'Cinzel', serif",
  fontWeight: 'bold',
  textTransform: 'uppercase',
  letterSpacing: 2,
  marginTop: 20,
};

const textBoxStyle = {
  minHeight: '100vh',
  padding: 40,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
  fontFamily: "'Cinzel', serif",
  textAlign: 'center',
  color: '#F4E4C1',
};
