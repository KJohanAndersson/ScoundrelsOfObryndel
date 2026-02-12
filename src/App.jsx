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
  const animationRef = useRef(null);

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
      setCurrentPlayer(0);
      setRoundPhase('playerTurn');
    }
  };

  const nextPlayer = () => {
    if (currentPlayer < playerCount - 1) {
      setCurrentPlayer(currentPlayer + 1);
    } else {
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
          setRoundPhase('playerTurn');
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
      style={{
        position: 'fixed',
        top: 20,
        left: 20,
        width: 50,
        height: 50,
        borderRadius: '50%',
        fontSize: '28px',
        fontWeight: 'bold',
        color: '#F4E4C1',
        background: 'rgba(139,69,19,0.8)',
        border: '2px solid #8B4513',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'all 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.target.style.background = 'rgba(139,69,19,1)';
        e.target.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.target.style.background = 'rgba(139,69,19,0.8)';
        e.target.style.transform = 'scale(1)';
      }}
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
          zIndex: 2000,
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            padding: 40,
            borderRadius: 20,
            border: '3px solid #8B4513',
            textAlign: 'center',
            minWidth: '300px',
          }}
        >
          <h3 style={{ color: '#F4E4C1', marginBottom: 30 }}>
            Do you wish to go back to the main menu?
          </h3>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
            <button
              onClick={confirmExit}
              style={{
                padding: '12px 30px',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #8B4513, #A0522D)',
                border: '2px solid #CD853F',
                color: '#F4E4C1',
                cursor: 'pointer',
              }}
            >
              Confirm
            </button>
            <button
              onClick={() => setShowExitWarning(false)}
              style={{
                padding: '12px 30px',
                fontSize: '1rem',
                fontWeight: 'bold',
                borderRadius: 10,
                background: 'rgba(139,69,19,0.3)',
                border: '2px solid #8B4513',
                color: '#F4E4C1',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );

  // ---------- SCREENS ----------
  if (scannedCards.length >= maxQRCodes) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
          color: '#F4E4C1',
        }}
      >
        <h1 style={{ fontSize: '4rem', marginBottom: 20 }}>GAME OVER</h1>
        <p style={{ fontSize: '1.5rem', marginBottom: 30 }}>
          All {maxQRCodes} QR cards scanned!
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          <button
            onClick={confirmExit}
            style={{
              padding: '15px 40px',
              fontSize: '1.2rem',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #8B4513, #A0522D)',
              border: '2px solid #CD853F',
              color: '#F4E4C1',
              cursor: 'pointer',
            }}
          >
            Main Menu
          </button>
          <button
            onClick={() => {
              setCharacters([]);
              setCurrentPlayer(0);
              setScannedCards([]);
              setQrData('');
              setRoundPhase('playerTurn');
              setScreen('game');
            }}
            style={{
              padding: '15px 40px',
              fontSize: '1.2rem',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #8B4513, #A0522D)',
              border: '2px solid #CD853F',
              color: '#F4E4C1',
              cursor: 'pointer',
            }}
          >
            Restart
          </button>
        </div>
      </div>
    );
  }

  // --- Main Menu ---
  if (screen === 'main') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
          fontFamily: "'Cinzel', serif",
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(3rem, 8vw, 5rem)',
            color: '#F4E4C1',
            marginBottom: 60,
            textShadow: '3px 3px 10px rgba(0,0,0,0.7)',
          }}
        >
          OBRYNDEL
        </h1>
        <button
          onClick={() => setScreen('intro')}
          style={{
            padding: '20px 60px',
            fontSize: '1.5rem',
            borderRadius: 15,
            background: 'linear-gradient(135deg, #8B4513, #A0522D)',
            border: '3px solid #CD853F',
            color: '#F4E4C1',
            cursor: 'pointer',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}
        >
          Start Game
        </button>
      </div>
    );
  }

  // --- Intro / Instructions / Game --- 
  // Behåller samma struktur som tidigare men med gradients och snyggare knappar

  // ... Resten av skärmarna kan stylas på samma sätt som ovan ...

  return null;
}
