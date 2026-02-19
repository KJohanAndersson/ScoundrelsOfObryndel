import React, { useEffect, useRef, useState, useMemo } from "react";

// ─── Shape definitions (all sizes in px, will be scaled to screen) ───────────
const SHAPES = [
  { id: "purple-square",  label: "Purple square",    color: "#a855f7", type: "rect",     w: 800, h: 800  },
  { id: "blue-rect",      label: "Blue rectangle",   color: "#3b82f6", type: "rect",     w: 600, h: 1000 },
  { id: "green-triangle", label: "Green triangle",   color: "#22c55e", type: "triangle", s: 800          },
  { id: "red-rect",       label: "Red rectangle",    color: "#ef4444", type: "rect",     w: 200, h: 1200 },
];

// ─── Pattern recipes ──────────────────────────────────────────────────────────
// Each pattern picks a subset of shapes and assigns them positions/rotations
// relative to a virtual 1000×1000 canvas (scaled to screen at runtime).
// `x` and `y` are the top-left corner of the bounding box of each shape.
const PATTERNS = [
  {
    name: "The Fortress",
    shapes: [
      { id: "blue-rect",      x: 200, y: 0,   rot: 0   },
      { id: "red-rect",       x: 0,   y: 100, rot: 90  },
    ],
  },
  {
    name: "The Peak",
    shapes: [
      { id: "green-triangle", x: 100, y: 0,   rot: 0   },
      { id: "red-rect",       x: 380, y: 400, rot: 0   },
    ],
  },
  {
    name: "The Cross",
    shapes: [
      { id: "blue-rect",      x: 200, y: 0,   rot: 0   },
      { id: "red-rect",       x: 0,   y: 300, rot: 90  },
    ],
  },
  {
    name: "The Pyramid",
    shapes: [
      { id: "green-triangle", x: 100, y: 0,   rot: 0   },
      { id: "purple-square",  x: 50,  y: 500, rot: 0   },
    ],
  },
  {
    name: "The Tower",
    shapes: [
      { id: "red-rect",       x: 400, y: 0,   rot: 0   },
      { id: "purple-square",  x: 200, y: 600, rot: 0   },
    ],
  },
  {
    name: "All Together",
    shapes: [
      { id: "purple-square",  x: 0,   y: 0,   rot: 0   },
      { id: "blue-rect",      x: 400, y: 0,   rot: 0   },
      { id: "green-triangle", x: 0,   y: 600, rot: 0   },
      { id: "red-rect",       x: 700, y: 200, rot: 0   },
    ],
  },
];

const VIRTUAL = 1000; // virtual canvas size patterns are designed against
const BATTLE_SECONDS = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickPattern(excludeIndex) {
  let idx;
  do { idx = Math.floor(Math.random() * PATTERNS.length); }
  while (PATTERNS.length > 1 && idx === excludeIndex);
  return idx;
}

// Build an SVG <path> d-string for each shape slot, already scaled to screen px
function shapeToSVGPath(slot, shape, scale) {
  const x = slot.x * scale;
  const y = slot.y * scale;
  const rot = slot.rot || 0;

  if (shape.type === "rect") {
    const w = shape.w * scale;
    const h = shape.h * scale;
    // Centre for rotation
    const cx = x + w / 2;
    const cy = y + h / 2;
    return { d: `M${x},${y} h${w} v${h} h${-w} Z`, cx, cy, rot };
  }

  if (shape.type === "triangle") {
    const s = shape.s * scale;
    const half = s / 2;
    const height = (Math.sqrt(3) / 2) * s;
    const tx = x + half;
    const ty = y;
    const cx = x + half;
    const cy = y + height / 3;
    return {
      d: `M${tx},${ty} L${x + s},${y + height} L${x},${y + height} Z`,
      cx, cy, rot,
    };
  }
  return null;
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function PatternTest({ onExit }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef  = useRef(null);
  const countdownRef = useRef(null);

  const [phase, setPhase]         = useState("prepare"); // prepare | battle | result
  const [result, setResult]       = useState("");
  const [timeLeft, setTimeLeft]   = useState(BATTLE_SECONDS);
  const [patternIdx, setPatternIdx] = useState(() => pickPattern(-1));
  const [screenSize, setScreenSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const pattern = PATTERNS[patternIdx];

  // Fit the virtual 1000×1000 design into the screen
  const scale = Math.min(screenSize.w, screenSize.h) / VIRTUAL;

  // Resolve shape objects for each slot
  const resolvedSlots = useMemo(() =>
    pattern.shapes.map(slot => ({
      slot,
      shape: SHAPES.find(s => s.id === slot.id),
    })),
  [patternIdx]);

  // SVG paths
  const svgPaths = useMemo(() =>
    resolvedSlots
      .map(({ slot, shape }) => ({ path: shapeToSVGPath(slot, shape, scale), shape }))
      .filter(p => p.path),
  [resolvedSlots, scale]);

  // ── Camera ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    startCamera();
    const onResize = () => setScreenSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => {
      stopCamera();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }, // back camera
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    clearTimeout(timerRef.current);
    clearInterval(countdownRef.current);
  };

  // ── Phase transitions ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === "prepare") {
      setTimeLeft(BATTLE_SECONDS);
      timerRef.current = setTimeout(() => setPhase("battle"), 2500);
    }
    if (phase === "battle") {
      setTimeLeft(BATTLE_SECONDS);
      countdownRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(countdownRef.current);
            analyzeFrame();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [phase]);

  // ── Detection ──────────────────────────────────────────────────────────────
  const analyzeFrame = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) { setResult("Boss -1 HP"); setPhase("result"); return; }

    const ctx = canvas.getContext("2d");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const data   = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const vw     = canvas.width;
    const vh     = canvas.height;

    // Map the virtual pattern bounding box to the video frame coordinate space
    const vidScale = Math.min(vw, vh) / VIRTUAL;

    // Count colored pixels inside vs. total colored pixels
    let insideColored = 0;
    let totalColored  = 0;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // "colored" = not near-white (background) and not near-black (shadow)
      const isColored = !(r > 200 && g > 200 && b > 200) && (r + g + b > 60);
      if (!isColored) continue;

      totalColored++;

      const px = (i / 4) % vw;
      const py = Math.floor((i / 4) / vw);

      // Check if this pixel falls inside any of the pattern shape zones
      const inside = resolvedSlots.some(({ slot, shape }) => {
        const sx = slot.x * vidScale;
        const sy = slot.y * vidScale;
        if (shape.type === "rect") {
          return px >= sx && px <= sx + shape.w * vidScale &&
                 py >= sy && py <= sy + shape.h * vidScale;
        }
        if (shape.type === "triangle") {
          const s = shape.s * vidScale;
          const h = (Math.sqrt(3) / 2) * s;
          // point-in-triangle test (upward equilateral)
          const relX = px - sx;
          const relY = py - sy;
          if (relY < 0 || relY > h) return false;
          const halfBase = (relY / h) * (s / 2);
          const mid = s / 2;
          return relX >= mid - halfBase && relX <= mid + halfBase;
        }
        return false;
      });

      if (inside) insideColored++;
    }

    const ratio = totalColored > 0 ? insideColored / totalColored : 0;
    // If more than 55% of colored pixels are inside the zones → success
    setResult(ratio > 0.55 ? "Boss -1 HP! 💥" : "Players -1 HP 💀");
    setPhase("result");
  };

  // ── Next round ─────────────────────────────────────────────────────────────
  const nextRound = () => {
    setPatternIdx(prev => pickPattern(prev));
    setResult("");
    setPhase("prepare");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>

      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline muted
        style={styles.video}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* PREPARE phase */}
      {phase === "prepare" && (
        <div style={styles.overlay}>
          <div style={styles.prepareCard}>
            <h1 style={styles.patternName}>{pattern.name}</h1>
            <p style={styles.prepareSubtitle}>Place your shapes:</p>
            <div style={styles.shapeList}>
              {resolvedSlots.map(({ shape }) => (
                <div key={shape.id} style={{ ...styles.shapeTag, background: shape.color }}>
                  {shape.label}
                </div>
              ))}
            </div>
            <p style={styles.prepareHint}>Get ready…</p>
          </div>
        </div>
      )}

      {/* BATTLE phase — red overlay with transparent shape cutouts */}
      {phase === "battle" && (
        <>
          {/* SVG mask overlay — red everywhere except the shape zones */}
          <svg
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            viewBox={`0 0 ${screenSize.w} ${screenSize.h}`}
            preserveAspectRatio="none"
          >
            <defs>
              <mask id="shapeMask">
                {/* White = show red; Black = transparent (cut out) */}
                <rect width="100%" height="100%" fill="white" />
                {svgPaths.map(({ path, shape }, i) => (
                  <g key={i} transform={`rotate(${path.rot}, ${path.cx}, ${path.cy})`}>
                    <path d={path.d} fill="black" />
                  </g>
                ))}
              </mask>
            </defs>
            {/* Red overlay applied only where mask is white */}
            <rect
              width="100%" height="100%"
              fill="rgba(220,30,30,0.55)"
              mask="url(#shapeMask)"
            />
            {/* Shape outlines so players can see the target zones clearly */}
            {svgPaths.map(({ path, shape }, i) => (
              <g key={i} transform={`rotate(${path.rot}, ${path.cx}, ${path.cy})`}>
                <path
                  d={path.d}
                  fill="none"
                  stroke={shape.color}
                  strokeWidth={4}
                  strokeDasharray="12 6"
                  opacity={0.9}
                />
              </g>
            ))}
          </svg>

          {/* HUD */}
          <div style={styles.hud}>
            <span style={styles.patternNameSmall}>{pattern.name}</span>
            <span style={{ ...styles.timer, color: timeLeft <= 5 ? "#ff4444" : "#fff" }}>
              {timeLeft}s
            </span>
          </div>

          {/* Shape labels floating near each zone */}
          {svgPaths.map(({ path, shape }, i) => {
            const slot = resolvedSlots[i].slot;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: slot.x * scale,
                  top: Math.max(0, slot.y * scale - 32),
                  color: shape.color,
                  fontWeight: 700,
                  fontSize: 14,
                  textShadow: "0 1px 4px #000",
                  pointerEvents: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {shape.label}
              </div>
            );
          })}
        </>
      )}

      {/* RESULT phase */}
      {phase === "result" && (
        <div style={styles.overlay}>
          <div style={styles.resultCard}>
            <h1 style={{
              ...styles.resultText,
              color: result.includes("Boss") ? "#4ade80" : "#f87171",
            }}>
              {result}
            </h1>
            <button style={styles.btn} onClick={nextRound}>Next Round</button>
            <button style={{ ...styles.btn, background: "#374151" }} onClick={onExit}>Exit</button>
          </div>
        </div>
      )}

      {/* Exit button (always visible) */}
      {phase !== "result" && (
        <button style={styles.exitBtn} onClick={onExit}>×</button>
      )}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "#000",
  },
  video: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  prepareCard: {
    background: "rgba(15,15,20,0.95)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: "36px 48px",
    textAlign: "center",
    maxWidth: 480,
  },
  patternName: {
    color: "#fff",
    fontSize: "2.2rem",
    fontWeight: 800,
    margin: "0 0 8px",
    letterSpacing: 1,
  },
  prepareSubtitle: {
    color: "#9ca3af",
    fontSize: "1rem",
    margin: "0 0 16px",
  },
  shapeList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginBottom: 20,
  },
  shapeTag: {
    padding: "6px 14px",
    borderRadius: 999,
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
  },
  prepareHint: {
    color: "#6b7280",
    fontSize: "0.9rem",
    margin: 0,
  },
  hud: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    background: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
  },
  patternNameSmall: {
    color: "#e5e7eb",
    fontWeight: 700,
    fontSize: "1.1rem",
    textShadow: "0 1px 4px #000",
  },
  timer: {
    fontWeight: 800,
    fontSize: "1.8rem",
    textShadow: "0 2px 8px #000",
    fontVariantNumeric: "tabular-nums",
  },
  resultCard: {
    background: "rgba(10,10,15,0.97)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "48px 60px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  resultText: {
    fontSize: "2.5rem",
    fontWeight: 900,
    margin: 0,
  },
  btn: {
    padding: "14px 32px",
    fontSize: "1.1rem",
    fontWeight: 700,
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },
  exitBtn: {
    position: "fixed",
    top: 16,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    fontSize: 22,
    cursor: "pointer",
    zIndex: 100,
  },
};
