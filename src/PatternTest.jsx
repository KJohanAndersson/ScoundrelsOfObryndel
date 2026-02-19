import React, { useEffect, useRef, useState } from "react";

export default function PatternTest({ onExit }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState("prepare"); 
  // prepare → battle → result
  const [result, setResult] = useState("");

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();

    setTimeout(() => {
      setPhase("battle");
      setTimeout(analyzeFrame, 15000);
    }, 2000);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // Simple color detection
  const analyzeFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const zoneRadius = Math.min(canvas.width, canvas.height) * 0.25;

    let outsideDetected = false;

    for (let i = 0; i < data.length; i += 40) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // detect strong colors (not white background)
      const isColored =
        r < 240 || g < 240 || b < 240;

      if (!isColored) continue;

      const px = ((i / 4) % canvas.width);
      const py = Math.floor((i / 4) / canvas.width);

      const dx = px - centerX;
      const dy = py - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > zoneRadius) {
        outsideDetected = true;
        break;
      }
    }

    if (outsideDetected) {
      setResult("Players -1 HP");
    } else {
      setResult("Boss -1 HP");
    }

    setPhase("result");
  };

  const startNextRound = () => {
    setPhase("prepare");
    setResult("");

    setTimeout(() => {
      setPhase("battle");
      setTimeout(analyzeFrame, 15000);
    }, 2000);
  };

  return (
    <div style={container}>
      <button style={exit} onClick={onExit}>×</button>

      <video
        ref={videoRef}
        style={{ width: "100%", maxWidth: 500, borderRadius: 12 }}
        playsInline
        muted
      />

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {phase === "prepare" && (
        <h2 style={text}>Prepare for battle</h2>
      )}

      {phase === "battle" && (
        <div style={overlayWrapper}>
          <div style={redOverlay} />
          <div style={safeZone} />
        </div>
      )}

      {phase === "result" && (
        <>
          <h2 style={text}>{result}</h2>
          <button style={button} onClick={startNextRound}>
            Continue
          </button>
        </>
      )}
    </div>
  );
}

const container = {
  minHeight: "100vh",
  background: "#000",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 20,
};

const text = {
  color: "#fff",
  fontSize: "2rem",
};

const button = {
  padding: "12px 24px",
  fontSize: "1.2rem",
};

const exit = {
  position: "fixed",
  top: 20,
  left: 20,
  fontSize: 24,
};

const overlayWrapper = {
  position: "absolute",
  width: "100%",
  height: "100%",
  pointerEvents: "none",
};

const redOverlay = {
  position: "absolute",
  inset: 0,
  background: "rgba(255,0,0,0.25)",
};

const safeZone = {
  position: "absolute",
  width: "50%",
  height: "50%",
  left: "25%",
  top: "25%",
  borderRadius: "50%",
  background: "rgba(0,0,0,0)",
  boxShadow: "0 0 0 9999px rgba(255,0,0,0.25)",
};
