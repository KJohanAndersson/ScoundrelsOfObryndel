// Lägg till detta i komponenten

// Ref för animationFrame så vi kan stoppa/starta korrekt
const animationRef = useRef(null);

// Skanning-loop
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
        setRoundPhase('playerTurn'); // Gå tillbaka till nästa runda
      }
    }
  }

  animationRef.current = requestAnimationFrame(scanQRCodeLoop);
};

// Starta kameran och loop
const startCamera = async () => {
  if (!videoRef.current) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setCameraStarted(true);

    // Om vi redan är i scanQR, starta loop direkt
    if (roundPhase === 'scanQR') scanQRCodeLoop();
  } catch (err) {
    console.error('Camera error:', err);
    setCameraError('Camera error: ' + err.message);
  }
};

// När roundPhase ändras till 'scanQR', starta skanning
useEffect(() => {
  if (roundPhase === 'scanQR' && cameraStarted) {
    scanQRCodeLoop();
  }

  return () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };
}, [roundPhase, cameraStarted]);
