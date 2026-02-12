import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';

export default function ObryndelGame() {
  // ---------- STATE ----------
  const [screen, setScreen] = useState('main');
  const [playerCount, setPlayerCount] = useState(2);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [scannedCards, setScannedCards] = useState([]);
  const [roundPhase, setRoundPhase] = useState('playerTurn'); // 'playerTurn' | 'scanQR'
  const [qrData, setQrData] = useState('');
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [showExitWarning, setShowExitWarning] = useState(false);

  const maxQRCodes = 15; // Game Over efter 15 QR-koder
  const availableCharacters = ['Goblin', 'Troll', 'Cyclops', 'Witch'];

  const tileEvents = {
    'Tile-001': 'The world shifts beneath your feet.',
    'Tile-002': "You're all cursed and must cleanse yourselves in water.",
    'Tile-003': 'A mystical barrier blocks your path. Find the key to proceed.',
    'Tile-004': 'Ancient runes glow with power.',
    'Tile-005': 'The ground trembles.',
    'Tile-006': 'A healing spring appears.',
    'Tile-007': 'Shadow creatures emerge.',
    'Tile-008': 'A merchant appears.',
    'Tile-009': 'The path splits.',
    'Tile-010': 'Thunder crashes.',
    'Tile-030': 'The final fragment reveals itself!',
  };

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null); // För requestAnimationFrame

  // ---------- EXIT HANDLERS ----------
  const handleExitClick = () => setShowExitWarning(true);
  const confirmExit = () => {
    setScreen('main');
    setShowExitWarning(false);
    setPlayerCount(2);
    setCurrentPlayer(0);
    setCharacters([]);
    setScannedCards([]);
    setQrData('');
    setRoundPhase('playerTurn');
    stopCamera();
    setCameraStarted(false);
  };

  // ---------- CHARACTER SELECTION ----------
  const selectCharacter = (character) => {
    const newCharacters = [...characters];
    newCharacters[currentPlayer] = character;
    setCharacters(newCharacters);

    if (currentPlayer < playerCount - 1) {
      setCurrentPlayer(currentPlayer + 1);
    } else {
      // Alla spelare har valt → starta första runda
      setCurrentPlayer(0);
      setRoundPhase('playerTurn');
    }
  };

  const nextPlayer = () => {
    if (currentPlayer < playerCount - 1) {
      setCurrentPlayer(currentPlayer + 1);
    } else {
      // Alla spelare har spelat → nästa QR
      setCurrentPlayer(0);
      setRoundPhase('scanQR');
      setQrData('');
    }
  };

  // ---------- CAMERA + QR SCANNING ----------
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
          setRoundPhase('playerTurn'); // Nästa runda börjar
        }
      }
    }

    animationRef.current = requestAnimationFrame(scanQRCodeLoop);
  };

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraStarted(true);

      if (roundPhase === 'scanQR') scanQRCodeLoop();
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Camera error: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  // Starta skanning automatiskt när roundPhase ändras
  useEffect(() => {
    if (roundPhase === 'scanQR' && cameraStarted) {
      scanQRCodeLoop();
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [roundPhase, cameraStarted]);

  useEffect(() => stopCamera, []);

  // ---------- EXIT MODAL ----------
  const ExitButton = () => (
    <button
      onClick={handleExitClick}
      style={{ position: 'fixed', top: 20, left: 20, width: 40, height: 40 }}
    >
      ×
    </button>
  );

  const ExitWarningModal = () =>
    showExitWarning && (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ background: '#1a1a2e', padding: 40, borderRadius: 15 }}>
          <h3>Do you wish to go back to the main menu?</h3>
          <button onClick={confirmExit}>Confirm</button>
          <button onClick={() => setShowExitWarning(false)}>Cancel</button>
        </div>
      </div>
    );

  // ---------- SCREENS ----------
  if (scannedCards.length >= maxQRCodes) {
    return (
      <div style={{ minHeight: '100vh', padding: 40, textAlign: 'center' }}>
        <h1>GAME OVER</h1>
        <p>All {maxQRCodes} QR cards scanned!</p>
        <button onClick={confirmExit}>Main Menu</button>
        <button
          onClick={() => {
            setCharacters([]);
            setCurrentPlayer(0);
            setScannedCards([]);
            setQrData('');
            setRoundPhase('playerTurn');
            setScreen('game');
          }}
        >
          Restart
        </button>
      </div>
    );
  }

  // --- Main Menu ---
  if (screen === 'main') {
    return (
      <div style={{ minHeight: '100vh', padding: 40 }}>
        <h1>OBRYNDEL</h1>
        <button onClick={() => setScreen('intro')}>Start Game</button>
      </div>
    );
  }

  // --- Intro ---
  if (screen === 'intro') {
    return (
      <div style={{ minHeight: '100vh', padding: 40 }}>
        <ExitButton />
        <p>The land of Obryndel is in shatters. Gather the fragments!</p>
        <label>Players: {playerCount}</label>
        <input
          type="range"
          min="1"
          max="4"
          value={playerCount}
          onChange={(e) => setPlayerCount(parseInt(e.target.value))}
        />
        <button onClick={() => setScreen('instructions')}>Begin Journey</button>
        <ExitWarningModal />
      </div>
    );
  }

  // --- Instructions ---
  if (screen === 'instructions') {
    return (
      <div style={{ minHeight: '100vh', padding: 40 }}>
        <ExitButton />
        <p>Shuffle QR cards. Each player has two actions per turn. Draw a card after each round.</p>
        <button onClick={() => setScreen('game')}>Begin Act 1</button>
        <ExitWarningModal />
      </div>
    );
  }

  // --- Game ---
  if (screen === 'game') {
    // Character selection
    if (characters.length < playerCount) {
      const availableChars = availableCharacters.filter((c) => !characters.includes(c));
      return (
        <div style={{ minHeight: '100vh', padding: 40 }}>
          <ExitButton />
          <h2>Player {currentPlayer + 1}: Choose Character</h2>
          {availableChars.map((c) => (
            <button key={c} onClick={() => selectCharacter(c)}>
              {c}
            </button>
          ))}
          <ExitWarningModal />
        </div>
      );
    }

    // Main gameplay
    return (
      <div style={{ minHeight: '100vh', padding: 40 }}>
        <ExitButton />

        {!cameraStarted && <button onClick={startCamera}>Start Camera</button>}

        <video ref={videoRef} style={{ display: 'none' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <h2>Player {currentPlayer + 1}: {characters[currentPlayer]}</h2>
        <p>Cards scanned: {scannedCards.length}/{maxQRCodes}</p>
        {qrData && <p>{tileEvents[qrData] || 'Unknown event...'}</p>}
        {cameraError && <p style={{ color: 'red' }}>{cameraError}</p>}

        {roundPhase === 'playerTurn' && <button onClick={nextPlayer}>End Turn</button>}
        {roundPhase === 'scanQR' && <p>Scan a new QR card for this round...</p>}

        <ExitWarningModal />
      </div>
    );
  }

  return null;
}
