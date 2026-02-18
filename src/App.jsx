import { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';

export default function App() {
  const [screen, setScreen] = useState('start');
  const [playerCount, setPlayerCount] = useState(1);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [characters, setCharacters] = useState([]);
  const [roundPhase, setRoundPhase] = useState('playerTurn'); // playerTurn | scanQR | scanCharacter
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [qrData, setQrData] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ---------------- TTS ----------------
  const speakText = async (text) => {
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error('TTS failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      // fallback
      const utter = new SpeechSynthesisUtterance(text);
      speechSynthesis.speak(utter);
    }
  };

  // ---------------- Camera ----------------
  const startCamera = async (mode = 'environment') => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraStarted(true);
    } catch (err) {
      setCameraError('Camera error: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setCameraStarted(false);
  };

  // ---------------- QR Scan Loop ----------------
  const scanQRCodeLoop = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const scan = () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) {
        requestAnimationFrame(scan);
        return;
      }

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, canvas.width, canvas.height);

      // ---------- CHARACTER SCAN ----------
      if (code && code.data.startsWith('Character-') && roundPhase === 'scanCharacter') {
        stopCamera();

        const map = {
          'Character-001': 'Goblin',
          'Character-002': 'Troll',
          'Character-003': 'Cyclops',
          'Character-004': 'Witch',
        };

        const chosenChar = map[code.data];
        if (!chosenChar) return;

        if (characters.includes(chosenChar)) {
          setQrData(`${chosenChar} is already taken!`);
          speakText(`${chosenChar} is already taken!`);
          return;
        }

        const newChars = [...characters];
        newChars[currentPlayer] = chosenChar;
        setCharacters(newChars);

        speakText(`Player ${currentPlayer + 1} chose ${chosenChar}.`);

        if (currentPlayer < playerCount - 1) {
          setCurrentPlayer(currentPlayer + 1);
          setTimeout(() => startCamera('user'), 800);
        } else {
          setScreen('game');
          setCurrentPlayer(0);
          setCameraStarted(false);
        }
        return;
      }

      // ---------- TILE SCAN ----------
      if (code && code.data.startsWith('Tile-') && roundPhase === 'scanQR') {
        stopCamera();
        setQrData(code.data);
        speakText(`Tile scanned: ${code.data}`);
        setRoundPhase('playerTurn');
        return;
      }

      requestAnimationFrame(scan);
    };

    scan();
  };

  useEffect(() => {
    if (
      (roundPhase === 'scanQR' || roundPhase === 'scanCharacter') &&
      cameraStarted
    ) {
      scanQRCodeLoop();
    }
  }, [roundPhase, cameraStarted]);

  // ---------------- Game Controls ----------------
  const startGame = () => {
    setCharacters(Array(playerCount).fill(null));
    setCurrentPlayer(0);
    setScreen('characterSelect');
  };

  const resetGame = () => {
    stopCamera();
    setScreen('start');
    setCharacters([]);
    setCurrentPlayer(0);
  };

  // ---------------- Screens ----------------

  // START SCREEN
  if (screen === 'start') {
    return (
      <div style={{ padding: 30 }}>
        <h1>Scoundrels of Obryndel</h1>

        <label>Players: </label>
        <select
          value={playerCount}
          onChange={(e) => setPlayerCount(Number(e.target.value))}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>

        <br />
        <br />
        <button onClick={startGame}>Start Game</button>
      </div>
    );
  }

  // CHARACTER SCAN SCREEN
  if (screen === 'characterSelect') {
    useEffect(() => {
      setRoundPhase('scanCharacter');
      startCamera('user');
      speakText(`Player ${currentPlayer + 1}, scan your character.`);
    }, []);

    return (
      <div style={{ padding: 30 }}>
        <h2>Player {currentPlayer + 1}</h2>
        <p>Scan your character card</p>

        <video
          ref={videoRef}
          style={{ width: 260, borderRadius: 12, marginTop: 20 }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {qrData && <p>{qrData}</p>}
      </div>
    );
  }

  // GAME SCREEN
  if (screen === 'game') {
    return (
      <div style={{ padding: 30 }}>
        <h2>Player {currentPlayer + 1}'s turn</h2>
        <p>Character: {characters[currentPlayer]}</p>

        <button
          onClick={() => {
            setRoundPhase('scanQR');
            startCamera('environment');
          }}
        >
          Scan Tile
        </button>

        <br />
        <video
          ref={videoRef}
          style={{ width: 260, borderRadius: 12, marginTop: 20 }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {qrData && <p>{qrData}</p>}
      </div>
    );
  }

  return null;
}
