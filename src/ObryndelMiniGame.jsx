import { useState, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID_SIZE = 10;
const START = { x: 4, y: 4 }; // center-ish white starting square (4,4) to (5,5) — use single tile

const PLAYER_COLORS = ["red", "blue", "yellow", "green"];
const PLAYER_NAMES = ["Red", "Blue", "Yellow", "Green"];
const PLAYER_EMOJIS = ["🔴", "🔵", "🟡", "🟢"];

// Objects placed in each corner
const OBJECTS = [
  { id: "red",    x: 0, y: 0, emoji: "🗡️",  label: "Red Shard"    },
  { id: "blue",   x: 9, y: 0, emoji: "🔮",  label: "Blue Orb"     },
  { id: "yellow", x: 0, y: 9, emoji: "📜",  label: "Yellow Scroll" },
  { id: "green",  x: 9, y: 9, emoji: "🌿",  label: "Green Root"   },
];

const OBJECT_MAP = Object.fromEntries(OBJECTS.map(o => [`${o.x},${o.y}`, o]));
const CORNER_KEYS = new Set(OBJECTS.map(o => `${o.x},${o.y}`));
const START_KEY = `${START.x},${START.y}`;

const PLAYER_STARTS = [
  { x: 4, y: 4 },
  { x: 5, y: 4 },
  { x: 4, y: 5 },
  { x: 5, y: 5 },
];

const COLOR_HEX = {
  red:    "#c0392b",
  blue:   "#2980b9",
  yellow: "#d4a01a",
  green:  "#27ae60",
  white:  "#ede6cf",
  empty:  "#1a1510",
};

const COLOR_BG = {
  red:    "rgba(192,57,43,0.55)",
  blue:   "rgba(41,128,185,0.55)",
  yellow: "rgba(212,160,26,0.55)",
  green:  "rgba(39,174,96,0.55)",
  white:  "rgba(237,230,207,0.85)",
  empty:  "rgba(10,8,6,0.5)",
};

// ─── Generate initial grid ────────────────────────────────────────────────────
function makeGrid(playerCount) {
  const grid = {};
  // Fill non-special squares with random player colors
  const colors = PLAYER_COLORS.slice(0, playerCount);
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const key = `${x},${y}`;
      if (key === START_KEY || CORNER_KEYS.has(key)) {
        grid[key] = "white";
      } else {
        grid[key] = colors[Math.floor(Math.random() * colors.length)];
      }
    }
  }
  return grid;
}

function makeStartPos(playerCount) {
  return PLAYER_STARTS.slice(0, playerCount).map((p, i) => ({ ...p, id: i }));
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const fonts = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');
`;

const css = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #050304; }

.obryndel-game {
  min-height: 100vh;
  background: radial-gradient(ellipse 900px 500px at 50% 0%, rgba(140,80,20,0.07), transparent),
              linear-gradient(180deg, #060404 0%, #0a0608 100%);
  font-family: 'Crimson Pro', Georgia, serif;
  color: #EDE6CF;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 48px;
  user-select: none;
}

h1.title {
  font-family: 'Cinzel', serif;
  font-size: clamp(1.6rem, 5vw, 3rem);
  font-weight: 900;
  color: #F6E6A8;
  letter-spacing: 8px;
  text-transform: uppercase;
  text-shadow: 0 0 40px rgba(220,180,70,0.15);
  margin-bottom: 4px;
}

.subtitle {
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  letter-spacing: 4px;
  color: rgba(180,155,90,0.45);
  text-transform: uppercase;
  margin-bottom: 28px;
}

/* Setup */
.setup-card {
  background: linear-gradient(180deg, rgba(36,24,18,0.9), rgba(6,4,3,0.9));
  border: 1px solid rgba(213,169,62,0.12);
  border-radius: 16px;
  padding: 36px 48px;
  text-align: center;
  box-shadow: 0 28px 100px rgba(0,0,0,0.85);
  max-width: 480px;
  width: 100%;
}

.setup-card h2 {
  font-family: 'Cinzel', serif;
  font-size: 1.3rem;
  color: #D9B65A;
  margin-bottom: 24px;
  letter-spacing: 2px;
}

.player-count-options {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 32px;
}

.pc-btn {
  width: 72px; height: 72px;
  border-radius: 12px;
  border: 1px solid rgba(213,169,62,0.2);
  background: rgba(20,14,8,0.7);
  color: #EFD88B;
  font-family: 'Cinzel', serif;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 140ms ease;
}
.pc-btn:hover { background: rgba(60,40,15,0.8); transform: translateY(-2px); }
.pc-btn.selected {
  border-color: rgba(213,169,62,0.7);
  background: rgba(90,58,20,0.7);
  box-shadow: 0 0 20px rgba(213,169,62,0.2);
}

.start-btn {
  padding: 14px 36px;
  font-family: 'Cinzel', serif;
  font-size: 1rem;
  letter-spacing: 2px;
  background: linear-gradient(180deg,#5a3b1b,#2b1708);
  border: 1px solid rgba(230,185,70,0.22);
  border-radius: 12px;
  color: #FFF8E6;
  cursor: pointer;
  transition: all 140ms ease;
  box-shadow: 0 8px 30px rgba(0,0,0,0.6);
}
.start-btn:hover { transform: translateY(-2px); box-shadow: 0 14px 40px rgba(0,0,0,0.7); }
.start-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* Game layout */
.game-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  width: 100%;
  max-width: 1000px;
  flex-wrap: wrap;
  justify-content: center;
}

/* Grid */
.grid-wrap {
  position: relative;
  flex-shrink: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 2px;
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(213,169,62,0.12);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 20px 80px rgba(0,0,0,0.8);
}

.cell {
  width: clamp(38px, 6vw, 54px);
  height: clamp(38px, 6vw, 54px);
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(14px, 2.5vw, 20px);
  cursor: default;
  position: relative;
  transition: transform 80ms ease, box-shadow 80ms ease;
  border: 1px solid rgba(0,0,0,0.3);
}

.cell.switchable {
  cursor: pointer;
  outline: 2px dashed rgba(255,255,255,0.25);
  outline-offset: -3px;
}
.cell.switchable:hover { transform: scale(1.06); z-index: 2; }
.cell.switch-selected {
  outline: 2px solid rgba(255,220,80,0.9);
  outline-offset: -2px;
  box-shadow: 0 0 14px rgba(255,220,80,0.4);
  transform: scale(1.08);
  z-index: 3;
}

.cell.start-cell {
  box-shadow: 0 0 14px rgba(237,230,207,0.4);
}

/* Sidebar */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 220px;
  max-width: 280px;
  flex: 1;
}

.turn-card {
  background: linear-gradient(180deg, rgba(36,24,18,0.9), rgba(6,4,3,0.9));
  border: 1px solid rgba(213,169,62,0.15);
  border-radius: 14px;
  padding: 18px 20px;
  box-shadow: 0 12px 50px rgba(0,0,0,0.7);
}

.turn-header {
  font-family: 'Cinzel', serif;
  font-size: 0.65rem;
  letter-spacing: 3px;
  color: rgba(180,155,90,0.4);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.player-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.player-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.player-name {
  font-family: 'Cinzel', serif;
  font-size: 1.1rem;
  color: #EFD88B;
  letter-spacing: 1px;
}

.phase-label {
  font-size: 0.8rem;
  color: rgba(200,180,130,0.5);
  letter-spacing: 1px;
  margin-bottom: 12px;
  font-style: italic;
}

.action-btns {
  display: flex;
  gap: 8px;
  flex-direction: column;
}

.action-btn {
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid rgba(213,169,62,0.18);
  background: rgba(20,14,8,0.7);
  color: #EFD88B;
  font-family: 'Cinzel', serif;
  font-size: 0.82rem;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 140ms ease;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;
}
.action-btn:hover { background: rgba(60,40,15,0.9); transform: translateX(3px); }
.action-btn.active {
  background: rgba(90,58,20,0.8);
  border-color: rgba(213,169,62,0.5);
  box-shadow: 0 0 16px rgba(213,169,62,0.15);
}

.wasd-hint {
  display: grid;
  grid-template-columns: repeat(3, 32px);
  grid-template-rows: repeat(2, 32px);
  gap: 4px;
  margin: 10px auto 0;
  justify-content: center;
}
.wasd-key {
  width: 32px; height: 32px;
  background: rgba(30,20,10,0.8);
  border: 1px solid rgba(213,169,62,0.2);
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel', serif;
  font-size: 0.75rem;
  color: rgba(240,215,140,0.6);
}
.wasd-key.active-key {
  background: rgba(90,58,20,0.8);
  border-color: rgba(213,169,62,0.6);
  color: #EFD88B;
}

.switch-hint {
  font-size: 0.78rem;
  color: rgba(180,155,90,0.5);
  font-style: italic;
  line-height: 1.6;
  margin-top: 8px;
}

/* Player list */
.player-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.player-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(10,7,5,0.5);
  border: 1px solid rgba(255,255,255,0.04);
  font-size: 0.85rem;
  transition: all 140ms ease;
}
.player-row.current-player {
  background: rgba(50,33,10,0.7);
  border-color: rgba(213,169,62,0.25);
}
.player-row.done {
  opacity: 0.5;
}

.player-row-icon { font-size: 1.1rem; }
.player-row-info { flex: 1; }
.player-row-name { font-family: 'Cinzel', serif; font-size: 0.8rem; color: #D9B65A; }
.player-row-status { font-size: 0.7rem; color: rgba(180,155,90,0.45); margin-top: 2px; }

/* Legend */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: rgba(180,155,90,0.55);
}
.legend-dot {
  width: 10px; height: 10px; border-radius: 2px;
}

/* Victory */
.victory-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadeIn 0.4s ease;
}
.victory-card {
  background: linear-gradient(180deg, rgba(50,30,10,0.97), rgba(6,4,3,0.97));
  border: 1px solid rgba(213,169,62,0.3);
  border-radius: 20px;
  padding: 48px 56px;
  text-align: center;
  box-shadow: 0 40px 120px rgba(0,0,0,0.95), 0 0 60px rgba(213,169,62,0.1);
  max-width: 480px;
}
.victory-title {
  font-family: 'Cinzel', serif;
  font-size: 2.5rem;
  color: #F6E6A8;
  letter-spacing: 4px;
  margin-bottom: 12px;
  text-shadow: 0 0 30px rgba(220,180,70,0.4);
}
.victory-text {
  color: #cfc1a3;
  font-style: italic;
  line-height: 1.7;
  margin-bottom: 28px;
}

.log-box {
  background: rgba(6,4,3,0.7);
  border: 1px solid rgba(213,169,62,0.08);
  border-radius: 10px;
  padding: 12px 14px;
  max-height: 120px;
  overflow-y: auto;
  font-size: 0.75rem;
  color: rgba(180,155,90,0.6);
  line-height: 1.7;
  font-style: italic;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.victory-card { animation: popIn 0.4s cubic-bezier(0.22,1,0.36,1); }

.divider {
  height: 1px;
  background: rgba(213,169,62,0.08);
  margin: 12px 0;
}
`;

// ─── Player token rendered on grid ───────────────────────────────────────────
function PlayerToken({ color, emoji, atStart }) {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "inherit",
      zIndex: 10,
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))",
      pointerEvents: "none",
    }}>
      {emoji}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function ObryndelMiniGame() {
  const [phase, setPhase] = useState("setup"); // setup | game | victory
  const [playerCount, setPlayerCount] = useState(null);
  const [grid, setGrid] = useState({});
  const [positions, setPositions] = useState([]); // [{x,y}] per player
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [switchFirst, setSwitchFirst] = useState(null); // {x,y} first cell for color swap
  const [inventory, setInventory] = useState([]); // booleans per player - has object
  const [atBase, setAtBase] = useState([]); // booleans - returned to start
  const [log, setLog] = useState([]);

  // inject styles
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = fonts + css;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const addLog = useCallback((msg) => {
    setLog(prev => [msg, ...prev].slice(0, 20));
  }, []);

  const startGame = () => {
    const pc = playerCount;
    const g = makeGrid(pc);
    const pos = PLAYER_STARTS.slice(0, pc).map(p => ({ ...p }));
    // Make starting squares white
    [{ x: 4, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }].forEach(p => {
      g[`${p.x},${p.y}`] = "white";
    });
    setGrid(g);
    setPositions(pos);
    setInventory(Array(pc).fill(false));
    setAtBase(Array(pc).fill(false));
    setCurrentPlayer(0);
    setSwitchFirst(null);
    setLog([]);
    setPhase("game");
    addLog(`Game started with ${pc} player${pc > 1 ? "s" : ""}. Red player goes first!`);
  };

  const getPlayersAt = useCallback((x, y) => {
    return positions.map((p, i) => p.x === x && p.y === y ? i : -1).filter(i => i >= 0);
  }, [positions]);

  const isStartCell = (x, y) => {
    return x >= 4 && x <= 5 && y >= 4 && y <= 5;
  };

  // Movement via WASD — always active during game
  useEffect(() => {
    if (phase !== "game") return;
    const handler = (e) => {
      const dirs = { w: [0,-1], a: [-1,0], s: [0,1], d: [1,0] };
      const dir = dirs[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      const cp = currentPlayer;
      const cur = positions[cp];
      const nx = cur.x + dir[0];
      const ny = cur.y + dir[1];
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
        addLog(`${PLAYER_NAMES[cp]} can't move there — out of bounds!`);
        return;
      }
      const cellColor = grid[`${nx},${ny}`];
      const myColor = PLAYER_COLORS[cp];
      const startHere = isStartCell(nx, ny);
      if (cellColor !== myColor && cellColor !== "white") {
        addLog(`${PLAYER_NAMES[cp]} can't step on a ${cellColor} tile!`);
        return;
      }
      // Move
      const newPositions = positions.map((p, i) => i === cp ? { x: nx, y: ny } : p);
      setPositions(newPositions);
      let newInventory = [...inventory];
      let newAtBase = [...atBase];
      let msg = `${PLAYER_NAMES[cp]} moved.`;
      // Pick up object?
      const objKey = `${nx},${ny}`;
      const obj = OBJECT_MAP[objKey];
      if (obj && obj.id === myColor && !newInventory[cp]) {
        newInventory[cp] = true;
        setInventory(newInventory);
        msg += ` Picked up the ${obj.label}! 🎉`;
      }
      // Return to start with object?
      if (startHere && newInventory[cp] && !newAtBase[cp]) {
        newAtBase[cp] = true;
        setAtBase(newAtBase);
        msg += ` ${PLAYER_NAMES[cp]} returned to base with their object! ✨`;
        // Check victory
        if (newAtBase.every((v, i) => i >= playerCount ? true : v)) {
          addLog(msg);
          setPhase("victory");
          return;
        }
      }
      addLog(msg);
      setSwitchFirst(null);
      nextTurn();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, currentPlayer, positions, grid, inventory, atBase, playerCount]);

  const nextTurn = useCallback(() => {
    const next = (currentPlayer + 1) % playerCount;
    setCurrentPlayer(next);
    setSwitchFirst(null);
    addLog(`— ${PLAYER_NAMES[next]}'s turn —`);
  }, [currentPlayer, playerCount, addLog]);

  const handleCellClick = (x, y) => {
    const key = `${x},${y}`;
    // Can't switch corners, start cells, or occupied cells
    if (CORNER_KEYS.has(key) || isStartCell(x, y)) {
      addLog("That cell can't be switched!");
      return;
    }
    if (getPlayersAt(x, y).length > 0) {
      addLog("A player is standing there — can't switch!");
      return;
    }
    if (!switchFirst) {
      setSwitchFirst({ x, y });
      addLog(`Selected (${x},${y}) — now click the tile to swap with.`);
    } else {
      if (switchFirst.x === x && switchFirst.y === y) {
        setSwitchFirst(null);
        return;
      }
      const key2 = `${x},${y}`;
      if (getPlayersAt(x, y).length > 0) {
        addLog("A player is standing there — can't switch!");
        return;
      }
      const newGrid = { ...grid };
      const tmp = newGrid[`${switchFirst.x},${switchFirst.y}`];
      newGrid[`${switchFirst.x},${switchFirst.y}`] = newGrid[key2];
      newGrid[key2] = tmp;
      setGrid(newGrid);
      addLog(`${PLAYER_NAMES[currentPlayer]} swapped (${switchFirst.x},${switchFirst.y}) ↔ (${x},${y}).`);
      setSwitchFirst(null);
      nextTurn();
    }
  };


  // Render
  if (phase === "setup") {
    return (
      <div className="obryndel-game">
        <h1 className="title">Obryndel</h1>
        <div className="subtitle">The Shard Cooperative</div>
        <div className="setup-card">
          <h2>Choose Your Scoundrels</h2>
          <div style={{ marginBottom: 16, color: "rgba(180,155,90,0.55)", fontSize: "0.88rem", fontStyle: "italic", lineHeight: 1.6 }}>
            Work together to retrieve your colored shards and return to the starting point.
          </div>
          <div className="player-count-options">
            {[2, 3, 4].map(n => (
              <button
                key={n}
                className={`pc-btn${playerCount === n ? " selected" : ""}`}
                onClick={() => setPlayerCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 20, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {(playerCount ? PLAYER_NAMES.slice(0, playerCount) : []).map((name, i) => (
              <div key={i} style={{
                padding: "6px 14px",
                borderRadius: 8,
                background: `${COLOR_BG[PLAYER_COLORS[i]]}`,
                border: `1px solid ${COLOR_HEX[PLAYER_COLORS[i]]}44`,
                color: "#ede6cf",
                fontSize: "0.8rem",
                fontFamily: "'Cinzel', serif",
              }}>
                {PLAYER_EMOJIS[i]} {name}
              </div>
            ))}
          </div>
          <button className="start-btn" disabled={!playerCount} onClick={startGame}>
            Begin Quest
          </button>
          <div style={{ marginTop: 20, fontSize: "0.75rem", color: "rgba(180,155,90,0.35)", lineHeight: 1.8 }}>
            Each player collects their corner shard &amp; returns to the center.<br />
            Move with WASD • Switch tile colors to open new paths.
          </div>
        </div>
      </div>
    );
  }

  if (phase === "game" || phase === "victory") {
    const cp = currentPlayer;
    const cpColor = PLAYER_COLORS[cp];
    const cpPos = positions[cp];

    const allReturned = atBase.slice(0, playerCount).every(Boolean);

    return (
      <div className="obryndel-game">
        <h1 className="title" style={{ fontSize: "clamp(1.2rem, 4vw, 2rem)", marginBottom: 2 }}>Obryndel</h1>
        <div className="subtitle" style={{ marginBottom: 16 }}>The Shard Cooperative</div>

        {phase === "victory" && (
          <div className="victory-overlay">
            <div className="victory-card">
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>⚡</div>
              <div className="victory-title">Victory!</div>
              <div className="victory-text">
                All shards gathered and forged together at the altar.<br />
                The Scoundrels of Obryndel have triumphed!<br /><br />
                <em>Baron Thobrick's power crumbles…</em>
              </div>
              <button className="start-btn" onClick={() => { setPhase("setup"); setPlayerCount(null); }}>
                Play Again
              </button>
            </div>
          </div>
        )}

        <div className="game-layout">
          {/* Grid */}
          <div className="grid-wrap">
            <div className="grid">
              {Array.from({ length: GRID_SIZE }, (_, y) =>
                Array.from({ length: GRID_SIZE }, (_, x) => {
                  const key = `${x},${y}`;
                  const color = grid[key] || "empty";
                  const playersHere = getPlayersAt(x, y);
                  const obj = OBJECT_MAP[key];
                  const isStart = isStartCell(x, y);
                  const isCorner = CORNER_KEYS.has(key);
                  const isSwitchFirst = switchFirst && switchFirst.x === x && switchFirst.y === y;
                  const isSwitchable = !isCorner && !isStart && getPlayersAt(x, y).length === 0;

                  return (
                    <div
                      key={key}
                      className={[
                        "cell",
                        isStart ? "start-cell" : "",
                        isSwitchable ? "switchable" : "",
                        isSwitchFirst ? "switch-selected" : "",
                      ].join(" ")}
                      style={{
                        background: COLOR_BG[color] || COLOR_BG.empty,
                        borderColor: isStart
                          ? "rgba(237,230,207,0.4)"
                          : isCorner
                          ? "rgba(237,230,207,0.2)"
                          : `${COLOR_HEX[color] || "#1a1510"}22`,
                        boxShadow: isStart ? "0 0 10px rgba(237,230,207,0.25)" : undefined,
                        position: "relative",
                      }}
                      onClick={() => handleCellClick(x, y)}
                    >
                      {/* Corner object */}
                      {isCorner && obj && (
                        <span style={{
                          fontSize: "clamp(10px, 2vw, 16px)",
                          opacity: inventory[PLAYER_COLORS.indexOf(obj.id)] ? 0.2 : 0.9,
                          filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))",
                        }}>
                          {obj.emoji}
                        </span>
                      )}
                      {/* Start marker */}
                      {isStart && playersHere.length === 0 && (
                        <span style={{ fontSize: "clamp(8px, 1.5vw, 12px)", opacity: 0.35 }}>✦</span>
                      )}
                      {/* Player tokens */}
                      {playersHere.map(pi => (
                        <div
                          key={pi}
                          style={{
                            position: "absolute",
                            fontSize: playersHere.length > 1
                              ? "clamp(10px, 1.8vw, 14px)"
                              : "clamp(13px, 2.4vw, 20px)",
                            ...(playersHere.length > 1
                              ? {
                                  top: pi % 2 === 0 ? "2px" : undefined,
                                  bottom: pi % 2 === 1 ? "2px" : undefined,
                                  left: Math.floor(pi / 2) === 0 ? "2px" : undefined,
                                  right: Math.floor(pi / 2) === 1 ? "2px" : undefined,
                                }
                              : { inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }
                            ),
                            display: "flex", alignItems: "center", justifyContent: "center",
                            zIndex: 10,
                            filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.9))",
                            animation: pi === cp ? "none" : undefined,
                          }}
                        >
                          {PLAYER_EMOJIS[pi]}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {/* Color legend */}
            <div className="legend" style={{ marginTop: 10 }}>
              {PLAYER_COLORS.slice(0, playerCount).map(c => (
                <div className="legend-item" key={c}>
                  <div className="legend-dot" style={{ background: COLOR_HEX[c] }} />
                  <span style={{ textTransform: "capitalize" }}>{c}</span>
                </div>
              ))}
              <div className="legend-item">
                <div className="legend-dot" style={{ background: "rgba(237,230,207,0.6)", border: "1px solid rgba(237,230,207,0.3)" }} />
                <span>Safe</span>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="sidebar">
            {/* Turn card */}
            <div className="turn-card">
              <div className="turn-header">Current Turn</div>
              <div className="player-indicator">
                <div
                  className="player-dot"
                  style={{ background: COLOR_HEX[cpColor], boxShadow: `0 0 8px ${COLOR_HEX[cpColor]}` }}
                />
                <div className="player-name">{PLAYER_NAMES[cp]} Player</div>
                {inventory[cp] && <span title="Has shard" style={{ fontSize: "0.9rem" }}>⚡</span>}
              </div>

              {!switchFirst ? (
                <>
                  <div className="phase-label">Press WASD to move  •  Click any tile to swap colors</div>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 8 }}>
                    {/* WASD keys */}
                    <div className="wasd-hint" style={{ marginTop: 0, flex: "0 0 auto" }}>
                      <div />
                      <div className="wasd-key">W</div>
                      <div />
                      <div className="wasd-key">A</div>
                      <div className="wasd-key">S</div>
                      <div className="wasd-key">D</div>
                    </div>
                    <div className="switch-hint" style={{ marginTop: 0 }}>
                      Click any open tile on the board to start a color swap.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="phase-label" style={{ color: "rgba(255,220,80,0.7)" }}>
                    Tile selected — click another to swap
                  </div>
                  <div className="switch-hint">
                    Click a second tile to complete the swap, or click the same tile again to cancel.
                  </div>
                </>
              )}
            </div>

            {/* Player status */}
            <div className="turn-card">
              <div className="turn-header">Scoundrels</div>
              <div className="player-list">
                {Array.from({ length: playerCount }, (_, i) => {
                  const obj = OBJECTS[i];
                  const hasObj = inventory[i];
                  const returned = atBase[i];
                  return (
                    <div
                      key={i}
                      className={`player-row${i === cp ? " current-player" : ""}${returned ? " done" : ""}`}
                    >
                      <div className="player-row-icon">{PLAYER_EMOJIS[i]}</div>
                      <div className="player-row-info">
                        <div className="player-row-name" style={{ color: COLOR_HEX[PLAYER_COLORS[i]] }}>
                          {PLAYER_NAMES[i]}
                        </div>
                        <div className="player-row-status">
                          {returned
                            ? "✓ Returned to base!"
                            : hasObj
                            ? `Carrying ${obj.emoji} — head back!`
                            : `Seeking ${obj.emoji} ${obj.label}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Log */}
            <div className="turn-card">
              <div className="turn-header">Event Log</div>
              <div className="log-box">
                {log.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </div>

            <button
              className="start-btn"
              style={{ fontSize: "0.8rem", padding: "10px 20px", opacity: 0.5 }}
              onClick={() => { setPhase("setup"); setPlayerCount(null); }}
            >
              ← Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
