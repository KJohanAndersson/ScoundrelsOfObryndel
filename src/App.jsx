import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';

export default function ObryndelGame() {
  const [screen, setScreen] = useState('main');
  const [playerCount, setPlayerCount] = useState(2);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [scannedCards, setScannedCards] = useState([]);
  const [act, setAct] = useState(1);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [qrData, setQrData] = useState('');
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const availableCharacters = ['Goblin', 'Troll', 'Cyclops', 'Witch'];

  // QR scanning setup
  useEffect(() => {
    let animationId;

    const startCamera = async () => {
      if (screen === 'game' && videoRef.current) {
        try {
          setCameraError('');
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          scanQRCode();
        } catch (err) {
          console.error('Camera error:', err);
          if (err.name === 'NotAllowedError') {
            setCameraError(
              'Camera permission denied. Please allow camera access and refresh.'
            );
          } else if (err.name === 'NotFoundError') {
            setCameraError('No camera found on this device.');
          } else if (err.name === 'NotSupportedError') {
            setCameraError(
              'Camera requires HTTPS. Deploy to Vercel to use camera.'
            );
          } else {
            setCameraError('Camera error: ' + err.message);
          }
        }
      }
    };

    const scanQRCode = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const video = videoRef.current;
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
          }
        }
      }

      animationId = requestAnimationFrame(scanQRCode);
    };

    if (screen === 'game') {
      startCamera();
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, [screen, scannedCards]);

  // Act transitions
  useEffect(() => {
    if (scannedCards.length === 5 && act === 1) setAct(2);
    else if (scannedCards.length === 10 && act === 2) setAct(3);
  }, [scannedCards, act]);

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

  const handleExitClick = () => setShowExitWarning(true);

  const confirmExit = () => {
    setScreen('main');
    setShowExitWarning(false);
    setPlayerCount(2);
    setCurrentPlayer(0);
    setCharacters([]);
    setScannedCards([]);
    setAct(1);
    setQrData('');
  };

  const selectCharacter = (character) => {
    const newCharacters = [...characters];
    newCharacters[currentPlayer] = character;
    setCharacters(newCharacters);

    if (currentPlayer < playerCount - 1) {
      setCurrentPlayer(currentPlayer + 1);
    }
  };

  const nextPlayer = () =>
    setCurrentPlayer((currentPlayer + 1) % playerCount);

  const ExitButton = () => (
    <button
      onClick={handleExitClick}
      style={{
        position: 'fixed',
        top: '20px',
        left: '20px',
        width: '40px',
        height: '40px',
        background: 'rgba(139, 69, 19, 0.8)',
        border: '2px solid #8B4513',
        borderRadius: '50%',
        color: '#F4E4C1',
        fontSize: '24px',
        cursor: 'pointer',
        zIndex: 1000,
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
            background: '#1a1a2e',
            padding: '40px',
            borderRadius: '15px',
            border: '3px solid #8B4513',
            textAlign: 'center',
          }}
        >
          <h3 style={{ color: '#F4E4C1', marginBottom: '20px' }}>
            Do you wish to go back to the main menu?
          </h3>

          <button onClick={confirmExit} style={{ marginRight: '15px' }}>
            Confirm
          </button>
          <button onClick={() => setShowExitWarning(false)}>Cancel</button>
        </div>
      </div>
    );

  // MAIN MENU
  if (screen === 'main') {
    return (
      <div style={{ minHeight: '100vh', padding: 40 }}>
        <h1>OBRYNDEL</h1>
        <button onClick={() => setScreen('intro')}>Start Game</button>
      </div>
    );
  }

  // INTRO
  if (screen === 'intro') {
    return (
      <>
        <div style={{ minHeight: '100vh', padding: 40 }}>
          <ExitButton />
          <p>
            The land of Obryndel is in shatters. Gather the fragments at the
            Shrine of the Ogre.
          </p>

          <label>Players: {playerCount}</label>
          <input
            type="range"
            min="1"
            max="4"
            value={playerCount}
            onChange={(e) => setPlayerCount(parseInt(e.target.value))}
          />

          <button onClick={() => setScreen('instructions')}>
            Begin Journey
          </button>
        </div>
        <ExitWarningModal />
      </>
    );
  }

  // INSTRUCTIONS
  if (screen === 'instructions') {
    return (
      <>
        <div style={{ minHeight: '100vh', padding: 40 }}>
          <ExitButton />
          <p>
            Shuffle the QR cards. Each player has two actions per turn. Draw a
            card after each round.
          </p>

          <button onClick={() => setScreen('game')}>
            Begin Act 1
          </button>
        </div>
        <ExitWarningModal />
      </>
    );
  }

  // GAME
  if (screen === 'game') {
    if (characters.length < playerCount) {
      const availableChars = availableCharacters.filter(
        (c) => !characters.includes(c)
      );

      return (
        <>
          <div style={{ minHeight: '100vh', padding: 40 }}>
            <ExitButton />
            <h2>
              Player {currentPlayer + 1}: Choose Character
            </h2>

            {availableChars.map((c) => (
              <button key={c} onClick={() => selectCharacter(c)}>
                {c}
              </button>
            ))}
          </div>
          <ExitWarningModal />
        </>
      );
    }

    return (
      <>
        <div style={{ minHeight: '100vh', padding: 40 }}>
          <ExitButton />

          <video ref={videoRef} style={{ display: 'none' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <h2>Act {act}</h2>
          <p>
            Player {currentPlayer + 1}: {characters[currentPlayer]}
          </p>
          <p>Cards: {scannedCards.length}/30</p>

          {qrData && <p>{tileEvents[qrData]}</p>}

          <button onClick={nextPlayer}>End Turn</button>
        </div>
        <ExitWarningModal />
      </>
    );
  }

  return null;
}
