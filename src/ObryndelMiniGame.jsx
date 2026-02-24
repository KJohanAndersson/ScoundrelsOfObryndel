import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID_SIZE = 10;
const PLAYER_COLORS = ["red", "blue", "yellow", "green"];
const PLAYER_NAMES  = ["Red", "Blue", "Yellow", "Green"];
const PLAYER_EMOJIS = ["🔴", "🔵", "🟡", "🟢"];

const OBJECTS = [
  { id: "red",    x: 0, y: 0, emoji: "🗡️", label: "Red Shard"     },
  { id: "blue",   x: 9, y: 0, emoji: "🔮", label: "Blue Orb"      },
  { id: "yellow", x: 0, y: 9, emoji: "📜", label: "Yellow Scroll" },
  { id: "green",  x: 9, y: 9, emoji: "🌿", label: "Green Root"    },
];
const OBJECT_MAP  = Object.fromEntries(OBJECTS.map(o => [`${o.x},${o.y}`, o]));
const CORNER_KEYS = new Set(OBJECTS.map(o => `${o.x},${o.y}`));

const PLAYER_STARTS = [
  { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 },
];

const COLOR_HEX = {
  red: "#c0392b", blue: "#2980b9", yellow: "#d4a01a", green: "#27ae60",
  white: "#ede6cf", black: "#111111", empty: "#1a1510",
};
const COLOR_BG = {
  red:    "rgba(192,57,43,0.55)",
  blue:   "rgba(41,128,185,0.55)",
  yellow: "rgba(212,160,26,0.55)",
  green:  "rgba(39,174,96,0.55)",
  white:  "rgba(237,230,207,0.85)",
  black:  "rgba(8,8,8,0.95)",
  empty:  "rgba(0,0,0,0)",
};

const isStartCell = (x, y) => x >= 4 && x <= 5 && y >= 4 && y <= 5;
const cellKey = (x, y) => `${x},${y}`;

// ─── Grid generation ──────────────────────────────────────────────────────────
function makeGrid(playerCount, bwMode) {
  const grid = {};
  const colors = bwMode
    ? ["white", "black"]
    : PLAYER_COLORS.slice(0, playerCount);
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const key = cellKey(x, y);
      if (isStartCell(x, y) || CORNER_KEYS.has(key)) {
        grid[key] = "white";
      } else {
        grid[key] = colors[Math.floor(Math.random() * colors.length)];
      }
    }
  }
  return grid;
}

// ─── BFS for enemy movement ───────────────────────────────────────────────────
function bfsStep(from, to, grid, bwMode, vanishedSet) {
  const key = (x, y) => cellKey(x, y);
  const queue = [[from.x, from.y, null]];
  const visited = new Set([key(from.x, from.y)]);
  while (queue.length) {
    const [cx, cy, firstStep] = queue.shift();
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
      const nk = key(nx, ny);
      if (visited.has(nk)) continue;
      if (vanishedSet.has(nk)) continue;
      const cellColor = grid[nk];
      if (bwMode && cellColor === "black") continue;
      visited.add(nk);
      const step = firstStep || { x: nx, y: ny };
      if (nx === to.x && ny === to.y) return step;
      queue.push([nx, ny, step]);
    }
  }
  return null;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');`;
const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#050304}
.og{min-height:100vh;background:radial-gradient(ellipse 900px 500px at 50% 0%,rgba(140,80,20,.07),transparent),linear-gradient(180deg,#060404 0%,#0a0608 100%);font-family:'Crimson Pro',Georgia,serif;color:#EDE6CF;display:flex;flex-direction:column;align-items:center;padding:24px 16px 48px;user-select:none}
h1.og-title{font-family:'Cinzel',serif;font-size:clamp(1.6rem,5vw,3rem);font-weight:900;color:#F6E6A8;letter-spacing:8px;text-transform:uppercase;text-shadow:0 0 40px rgba(220,180,70,.15);margin-bottom:4px}
.og-sub{font-family:'Cinzel',serif;font-size:.75rem;letter-spacing:4px;color:rgba(180,155,90,.45);text-transform:uppercase;margin-bottom:24px}
.setup-card{background:linear-gradient(180deg,rgba(36,24,18,.9),rgba(6,4,3,.9));border:1px solid rgba(213,169,62,.12);border-radius:16px;padding:30px 38px;text-align:center;box-shadow:0 28px 100px rgba(0,0,0,.85);max-width:540px;width:100%}
.setup-card h2{font-family:'Cinzel',serif;font-size:1.2rem;color:#D9B65A;margin-bottom:18px;letter-spacing:2px}
.pc-opts{display:flex;gap:12px;justify-content:center;margin-bottom:24px}
.pc-btn{width:68px;height:68px;border-radius:12px;border:1px solid rgba(213,169,62,.2);background:rgba(20,14,8,.7);color:#EFD88B;font-family:'Cinzel',serif;font-size:1.5rem;cursor:pointer;transition:all 140ms ease}
.pc-btn:hover{background:rgba(60,40,15,.8);transform:translateY(-2px)}
.pc-btn.sel{border-color:rgba(213,169,62,.7);background:rgba(90,58,20,.7);box-shadow:0 0 20px rgba(213,169,62,.2)}
.mods{display:flex;flex-direction:column;gap:9px;margin-bottom:22px;text-align:left}
.mod-row{display:flex;align-items:flex-start;gap:11px;padding:11px 13px;border-radius:10px;background:rgba(10,7,5,.5);border:1px solid rgba(255,255,255,.04);cursor:pointer;transition:all 140ms ease}
.mod-row:hover{background:rgba(30,20,8,.7);border-color:rgba(213,169,62,.1)}
.mod-row.on{background:rgba(50,33,10,.7);border-color:rgba(213,169,62,.28)}
.mod-chk{width:20px;height:20px;border-radius:5px;border:1px solid rgba(213,169,62,.3);background:rgba(0,0,0,.4);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;margin-top:2px;transition:all 140ms ease}
.mod-row.on .mod-chk{background:rgba(90,58,20,.8);border-color:rgba(213,169,62,.7)}
.mod-title{font-family:'Cinzel',serif;font-size:.8rem;color:#D9B65A;letter-spacing:.5px;margin-bottom:3px}
.mod-desc{font-size:.7rem;color:rgba(180,155,90,.42);line-height:1.5}
.start-btn{padding:12px 30px;font-family:'Cinzel',serif;font-size:1rem;letter-spacing:2px;background:linear-gradient(180deg,#5a3b1b,#2b1708);border:1px solid rgba(230,185,70,.22);border-radius:12px;color:#FFF8E6;cursor:pointer;transition:all 140ms ease;box-shadow:0 8px 30px rgba(0,0,0,.6)}
.start-btn:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(0,0,0,.7)}
.start-btn:disabled{opacity:.3;cursor:not-allowed}
.game-layout{display:flex;gap:18px;align-items:flex-start;width:100%;max-width:1060px;flex-wrap:wrap;justify-content:center}
.grid-wrap{position:relative;flex-shrink:0}
.grid{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;background:rgba(0,0,0,.6);border:1px solid rgba(213,169,62,.12);border-radius:10px;padding:6px;box-shadow:0 20px 80px rgba(0,0,0,.8)}
.cell{width:clamp(34px,5.2vw,50px);height:clamp(34px,5.2vw,50px);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:clamp(11px,2vw,17px);cursor:default;position:relative;transition:transform 80ms ease,opacity 350ms ease;border:1px solid rgba(0,0,0,.3)}
.cell.gone{opacity:0;pointer-events:none}
.cell.sw-able{cursor:pointer;outline:2px dashed rgba(255,255,255,.2);outline-offset:-3px}
.cell.sw-able:hover{transform:scale(1.07);z-index:2}
.cell.sw-sel{outline:2px solid rgba(255,220,80,.9);outline-offset:-2px;box-shadow:0 0 14px rgba(255,220,80,.4);transform:scale(1.09);z-index:3}
.cell.start-cell{box-shadow:0 0 14px rgba(237,230,207,.4)}
.sidebar{display:flex;flex-direction:column;gap:9px;min-width:200px;max-width:262px;flex:1}
.s-card{background:linear-gradient(180deg,rgba(36,24,18,.9),rgba(6,4,3,.9));border:1px solid rgba(213,169,62,.15);border-radius:13px;padding:15px 17px;box-shadow:0 12px 50px rgba(0,0,0,.7)}
.s-hdr{font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:3px;color:rgba(180,155,90,.4);text-transform:uppercase;margin-bottom:7px}
.p-ind{display:flex;align-items:center;gap:9px;margin-bottom:11px;flex-wrap:wrap}
.p-dot{width:13px;height:13px;border-radius:50%;flex-shrink:0}
.p-nm{font-family:'Cinzel',serif;font-size:1rem;color:#EFD88B;letter-spacing:1px}
.ph-lbl{font-size:.76rem;color:rgba(200,180,130,.5);letter-spacing:.4px;margin-bottom:9px;font-style:italic}
.wasd-g{display:grid;grid-template-columns:repeat(3,29px);grid-template-rows:repeat(2,29px);gap:3px;justify-content:center;margin:5px auto 0}
.wk{width:29px;height:29px;background:rgba(30,20,10,.8);border:1px solid rgba(213,169,62,.2);border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:.7rem;color:rgba(240,215,140,.6)}
.sw-hint{font-size:.72rem;color:rgba(180,155,90,.5);font-style:italic;line-height:1.5;margin-top:5px}
.p-list{display:flex;flex-direction:column;gap:6px}
.p-row{display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:9px;background:rgba(10,7,5,.5);border:1px solid rgba(255,255,255,.04);font-size:.8rem;transition:all 140ms ease}
.p-row.cur{background:rgba(50,33,10,.7);border-color:rgba(213,169,62,.22)}
.p-row.done{opacity:.4}
.p-row.ded{opacity:.32;border-color:rgba(200,50,50,.18);background:rgba(40,5,5,.5)}
.p-ri{font-size:.95rem}
.p-rn{font-family:'Cinzel',serif;font-size:.76rem}
.p-rs{font-size:.66rem;color:rgba(180,155,90,.42);margin-top:1px}
.legend{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:7px}
.leg-i{display:flex;align-items:center;gap:5px;font-size:.66rem;color:rgba(180,155,90,.55)}
.leg-d{width:9px;height:9px;border-radius:2px}
.log-box{background:rgba(6,4,3,.7);border:1px solid rgba(213,169,62,.08);border-radius:9px;padding:9px 11px;max-height:110px;overflow-y:auto;font-size:.7rem;color:rgba(180,155,90,.6);line-height:1.6;font-style:italic}
.drop-btn{width:100%;padding:8px;margin-top:7px;border-radius:8px;border:1px solid rgba(220,60,60,.28);background:rgba(80,10,10,.6);color:rgba(255,150,150,.8);font-family:'Cinzel',serif;font-size:.72rem;cursor:pointer;transition:all 140ms ease;letter-spacing:.4px}
.drop-btn:hover{background:rgba(120,20,20,.8)}
.eby{animation:pulse .75s ease infinite}
.victory-overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;z-index:100;animation:fadeIn .4s ease}
.victory-card{background:linear-gradient(180deg,rgba(50,30,10,.97),rgba(6,4,3,.97));border:1px solid rgba(213,169,62,.3);border-radius:20px;padding:42px 50px;text-align:center;box-shadow:0 40px 120px rgba(0,0,0,.95),0 0 60px rgba(213,169,62,.1);max-width:450px;animation:popIn .4s cubic-bezier(.22,1,.36,1)}
.v-title{font-family:'Cinzel',serif;font-size:2.3rem;color:#F6E6A8;letter-spacing:4px;margin-bottom:11px;text-shadow:0 0 30px rgba(220,180,70,.4)}
.v-text{color:#cfc1a3;font-style:italic;line-height:1.7;margin-bottom:24px}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
`;

// ─── Modifier toggle ──────────────────────────────────────────────────────────
function ModToggle({ active, icon, label, desc, onClick }) {
  return (
    <div className={`mod-row${active ? " on" : ""}`} onClick={onClick}>
      <div className="mod-chk">{active ? "✓" : ""}</div>
      <div>
        <div className="mod-title">{icon} {label}</div>
        <div className="mod-desc">{desc}</div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ObryndelMiniGame({ onExit }) {
  // ── Setup ──
  const [phase,      setPhase]      = useState("setup");
  const [playerCount,setPlayerCount]= useState(null);
  const [modVanish,  setModVanish]  = useState(false);
  const [modEnemy,   setModEnemy]   = useState(false);
  const [modBW,      setModBW]      = useState(false);

  // ── Game ──
  const [grid,       setGrid]       = useState({});
  const [vanished,   setVanished]   = useState(new Set());
  const [positions,  setPositions]  = useState([]);
  const [curPlayer,  setCurPlayer]  = useState(0);
  const [swFirst,    setSwFirst]    = useState(null);
  const [inventory,  setInventory]  = useState([]); // bool: carrying shard
  const [dropped,    setDropped]    = useState([]); // bool: shard on floor
  const [droppedPos, setDroppedPos] = useState([]); // {x,y}|null per player
  const [atBase,     setAtBase]     = useState([]);
  const [dead,       setDead]       = useState([]);
  const [enemyPos,   setEnemyPos]   = useState({ x: 4, y: 4 });
  const [log,        setLog]        = useState([]);

  // Refs to avoid stale closures inside keydown
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = {
      curPlayer, positions, grid, inventory, atBase, dead,
      dropped, droppedPos, vanished, enemyPos, playerCount,
      modBW, modVanish, modEnemy,
    };
  });

  // Inject CSS once
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = fonts + css;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const addLog = useCallback((msg) => {
    setLog(prev => [msg, ...prev].slice(0, 25));
  }, []);

  // ── Start ────────────────────────────────────────────────────────────────────
  const startGame = () => {
    const pc = playerCount;
    const g  = makeGrid(pc, modBW);
    setGrid(g);
    setVanished(new Set());
    setPositions(PLAYER_STARTS.slice(0, pc).map(p => ({ ...p })));
    setInventory(Array(pc).fill(false));
    setDropped(Array(pc).fill(false));
    setDroppedPos(Array(pc).fill(null));
    setAtBase(Array(pc).fill(false));
    setDead(Array(pc).fill(false));
    setEnemyPos({ x: 4, y: 4 });
    setCurPlayer(0);
    setSwFirst(null);
    setLog([]);
    setPhase("game");
    addLog(`Quest begins with ${pc} scoundrel${pc > 1 ? "s" : ""}. Red goes first!`);
    if (modEnemy)  addLog("👁️ A Shadow lurks — it hunts shard-carriers…");
    if (modVanish) addLog("💨 Claimed tiles will crumble with each shard found…");
    if (modBW)     addLog("🖤 Only white tiles may be walked on. Switch to survive.");
  };

  // ── WASD handler ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "game") return;
    const handler = (e) => {
      const dirs = { w:[0,-1], a:[-1,0], s:[0,1], d:[1,0] };
      const dir = dirs[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();

      // Read everything from ref to avoid stale closures
      const s = stateRef.current;
      const cp = s.curPlayer;

      if (s.dead[cp]) {
        addLog(`${PLAYER_NAMES[cp]} is dead. Others must reach them to revive.`);
        return;
      }

      const cur = s.positions[cp];
      const nx = cur.x + dir[0], ny = cur.y + dir[1];

      if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
        addLog(`Out of bounds!`); return;
      }
      const nk = cellKey(nx, ny);
      if (s.vanished.has(nk)) {
        addLog(`${PLAYER_NAMES[cp]}: that tile has crumbled away!`); return;
      }
      const cellColor = s.grid[nk];
      if (s.modBW) {
        if (cellColor !== "white") {
          addLog(`${PLAYER_NAMES[cp]} cannot walk on black tiles!`); return;
        }
      } else {
        const myColor = PLAYER_COLORS[cp];
        if (cellColor !== myColor && cellColor !== "white") {
          addLog(`${PLAYER_NAMES[cp]} can't step on ${cellColor}!`); return;
        }
      }

      // ── Apply move ──
      let newPositions  = s.positions.map((p, i) => i === cp ? { x: nx, y: ny } : p);
      let newInventory  = [...s.inventory];
      let newDropped    = [...s.dropped];
      let newDroppedPos = [...s.droppedPos];
      let newAtBase     = [...s.atBase];
      let newDead       = [...s.dead];
      let newGrid       = s.grid;
      let newVanished   = s.vanished;
      let msg = `${PLAYER_NAMES[cp]} moved.`;

      // Revive dead allies on same square
      if (s.modEnemy) {
        newDead.forEach((isDead, i) => {
          if (isDead && i !== cp && s.positions[i].x === nx && s.positions[i].y === ny) {
            newDead[i] = false;
            msg += ` 💫 Revived ${PLAYER_NAMES[i]}!`;
          }
        });
      }

      // Pick up shard from corner
      const myColor = PLAYER_COLORS[cp];
      const obj = OBJECT_MAP[nk];
      if (obj && obj.id === myColor && !newInventory[cp]) {
        newInventory[cp] = true;
        msg += ` Picked up ${obj.label}! 🎉`;

        // Vanish tiles
        if (s.modVanish) {
          const totalCarried = newInventory.filter(Boolean).length;
          const count = totalCarried * 2;
          const candidates = [];
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              const k = cellKey(x, y);
              if (isStartCell(x, y) || CORNER_KEYS.has(k) || newVanished.has(k)) continue;
              if (newPositions.some((p, i) => !newDead[i] && p.x === x && p.y === y)) continue;
              if (s.modEnemy && s.enemyPos.x === x && s.enemyPos.y === y) continue;
              candidates.push(k);
            }
          }
          const toVanish = candidates.sort(() => Math.random() - 0.5).slice(0, count);
          newVanished = new Set([...newVanished, ...toVanish]);
          const vg = { ...newGrid };
          toVanish.forEach(k => { vg[k] = "empty"; });
          newGrid = vg;
          if (toVanish.length) msg += ` ${toVanish.length} tile${toVanish.length > 1 ? "s" : ""} crumble away…`;
        }
      }

      // Pick up own dropped shard from floor
      if (s.modEnemy && newDropped[cp] && !newInventory[cp]) {
        const dp = newDroppedPos[cp];
        if (dp && dp.x === nx && dp.y === ny) {
          newInventory[cp] = true;
          newDropped[cp] = false;
          newDroppedPos[cp] = null;
          msg += ` Reclaimed your shard! 🎉`;
        }
      }

      // Return to base
      if (isStartCell(nx, ny) && newInventory[cp] && !newAtBase[cp]) {
        newAtBase[cp] = true;
        msg += ` ${PLAYER_NAMES[cp]} forged their shard at the altar! ✨`;
      }

      // Apply state
      setPositions(newPositions);
      setInventory(newInventory);
      setDropped(newDropped);
      setDroppedPos(newDroppedPos);
      setAtBase(newAtBase);
      setDead(newDead);
      setGrid(newGrid);
      setVanished(newVanished);
      setSwFirst(null);
      addLog(msg);

      // Victory check
      if (newAtBase.slice(0, s.playerCount).every(Boolean)) {
        setPhase("victory");
        return;
      }

      // ── Move enemy ──
      let newEnemyPos = s.enemyPos;
      if (s.modEnemy) {
        // Find nearest shard-carrier
        const carriers = newPositions
          .map((p, i) => ({ p, i }))
          .filter(({ i }) => newInventory[i] && !newDead[i]);

        if (carriers.length > 0) {
          let bestStep = null, bestDist = Infinity;
          for (const { p } of carriers) {
            const step = bfsStep(s.enemyPos, p, newGrid, s.modBW, newVanished);
            if (step) {
              const dx = p.x - s.enemyPos.x, dy = p.y - s.enemyPos.y;
              const dist = Math.abs(dx) + Math.abs(dy);
              if (dist < bestDist) { bestDist = dist; bestStep = step; }
            }
          }
          if (bestStep) {
            newEnemyPos = bestStep;
            setEnemyPos(bestStep);
            // Check if enemy lands on a carrier
            const caughtIdx = newPositions.findIndex(
              (p, i) => p.x === bestStep.x && p.y === bestStep.y
                     && newInventory[i] && !newDead[i]
            );
            if (caughtIdx >= 0) {
              const nd2 = [...newDead]; nd2[caughtIdx] = true;
              const ni2 = [...newInventory]; ni2[caughtIdx] = false;
              const ndr = [...newDropped]; ndr[caughtIdx] = true;
              const ndp = [...newDroppedPos];
              ndp[caughtIdx] = { x: bestStep.x, y: bestStep.y };
              setDead(nd2);
              setInventory(ni2);
              setDropped(ndr);
              setDroppedPos(ndp);
              addLog(`💀 The Shadow caught ${PLAYER_NAMES[caughtIdx]}! They drop their shard. Allies can revive them.`);
            }
          }
        }
      }

      // ── Advance turn (skip dead) ──
      let next = (cp + 1) % s.playerCount;
      let guard = 0;
      while (newDead[next] && guard < s.playerCount) {
        next = (next + 1) % s.playerCount; guard++;
      }
      setCurPlayer(next);
      addLog(`— ${PLAYER_NAMES[next]}'s turn —`);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, addLog]); // intentionally minimal deps — state read via ref

  // ── Cell click (swap colors) ─────────────────────────────────────────────────
  const handleCellClick = useCallback((x, y) => {
    const s = stateRef.current;
    if (phase !== "game") return;
    const key = cellKey(x, y);
    if (s.vanished.has(key)) return;
    if (CORNER_KEYS.has(key) || isStartCell(x, y)) { addLog("Can't swap that tile."); return; }
    if (s.positions.some((p, i) => !s.dead[i] && p.x === x && p.y === y)) {
      addLog("A player is there — can't swap!"); return;
    }
    if (s.modEnemy && s.enemyPos.x === x && s.enemyPos.y === y) {
      addLog("The Shadow is there — can't swap!"); return;
    }

    if (!swFirst) {
      setSwFirst({ x, y });
      addLog(`Selected (${x},${y}) — click another to swap.`);
    } else {
      if (swFirst.x === x && swFirst.y === y) { setSwFirst(null); return; }
      if (s.positions.some((p, i) => !s.dead[i] && p.x === x && p.y === y)) {
        addLog("A player is there — can't swap!"); setSwFirst(null); return;
      }
      const newGrid = { ...s.grid };
      const k1 = cellKey(swFirst.x, swFirst.y);
      const tmp = newGrid[k1]; newGrid[k1] = newGrid[key]; newGrid[key] = tmp;
      setGrid(newGrid);
      addLog(`${PLAYER_NAMES[s.curPlayer]} swapped (${swFirst.x},${swFirst.y}) ↔ (${x},${y}).`);
      setSwFirst(null);
      // Advance turn
      const cp = s.curPlayer;
      let next = (cp + 1) % s.playerCount;
      let guard = 0;
      while (s.dead[next] && guard < s.playerCount) { next=(next+1)%s.playerCount; guard++; }
      setCurPlayer(next);
      addLog(`— ${PLAYER_NAMES[next]}'s turn —`);
    }
  }, [phase, swFirst, addLog]);

  // ── Drop shard ───────────────────────────────────────────────────────────────
  const handleDrop = useCallback(() => {
    const s = stateRef.current;
    const cp = s.curPlayer;
    if (!s.inventory[cp]) return;
    const pos = s.positions[cp];
    const ni = [...s.inventory]; ni[cp] = false;
    const nd = [...s.dropped]; nd[cp] = true;
    const ndp = [...s.droppedPos]; ndp[cp] = { ...pos };
    setInventory(ni); setDropped(nd); setDroppedPos(ndp);
    setSwFirst(null);
    addLog(`${PLAYER_NAMES[cp]} dropped their shard! The Shadow loses interest…`);
    let next = (cp + 1) % s.playerCount;
    let guard = 0;
    while (s.dead[next] && guard < s.playerCount) { next=(next+1)%s.playerCount; guard++; }
    setCurPlayer(next);
    addLog(`— ${PLAYER_NAMES[next]}'s turn —`);
  }, [addLog]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Setup screen ──
  if (phase === "setup") {
    return (
      <div className="og">
        <h1 className="og-title">Obryndel</h1>
        <div className="og-sub">The Shard Cooperative</div>
        <div className="setup-card">
          <h2>Choose Your Scoundrels</h2>

          <div className="pc-opts">
            {[2, 3, 4].map(n => (
              <button key={n} className={`pc-btn${playerCount===n?" sel":""}`} onClick={() => setPlayerCount(n)}>{n}</button>
            ))}
          </div>

          {playerCount && (
            <div style={{ display:"flex", gap:7, justifyContent:"center", flexWrap:"wrap", marginBottom:20 }}>
              {PLAYER_NAMES.slice(0, playerCount).map((name, i) => (
                <div key={i} style={{ padding:"5px 12px", borderRadius:7, background:COLOR_BG[PLAYER_COLORS[i]], border:`1px solid ${COLOR_HEX[PLAYER_COLORS[i]]}44`, color:"#ede6cf", fontSize:"0.77rem", fontFamily:"'Cinzel',serif" }}>
                  {PLAYER_EMOJIS[i]} {name}
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop:"1px solid rgba(213,169,62,.08)", paddingTop:16, marginBottom:18 }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:3, color:"rgba(180,155,90,.32)", textTransform:"uppercase", marginBottom:11 }}>
              Modifiers
            </div>
            <div className="mods">
              <ModToggle
                active={modVanish} onClick={() => setModVanish(v => !v)}
                icon="💨" label="Vanishing Tiles"
                desc="Each shard collected makes more tiles crumble away. Occupied tiles and the starting point are always safe."
              />
              <ModToggle
                active={modEnemy} onClick={() => setModEnemy(v => !v)}
                icon="👁️" label="The Shadow"
                desc="An enemy hunts players carrying shards. Drop your shard to stop it. Allies can move onto a dead player to revive them."
              />
              <ModToggle
                active={modBW} onClick={() => setModBW(v => !v)}
                icon="🖤" label="Black & White"
                desc="The board is black and white only. Nobody can walk on black squares — only color-swapping can open new paths."
              />
            </div>
          </div>

          <button className="start-btn" disabled={!playerCount} onClick={startGame}>Begin Quest</button>

          <div style={{ marginTop:14, fontSize:"0.7rem", color:"rgba(180,155,90,.28)", lineHeight:1.8 }}>
            Collect your corner shard &amp; return to the centre.<br />
            WASD to move · Click tiles to swap colors.
          </div>
        </div>
      </div>
    );
  }

  // ── Game / Victory screen ──
  if (phase === "game" || phase === "victory") {
    const cp      = curPlayer;
    const cpColor = PLAYER_COLORS[cp];

    return (
      <div className="og">
        <h1 className="og-title" style={{ fontSize:"clamp(1.1rem,3.5vw,1.8rem)", marginBottom:2 }}>Obryndel</h1>
        <div className="og-sub" style={{ marginBottom:13 }}>The Shard Cooperative</div>

        {phase === "victory" && (
          <div className="victory-overlay">
            <div className="victory-card">
              <div style={{ fontSize:"2.6rem", marginBottom:10 }}>⚡</div>
              <div className="v-title">Victory!</div>
              <div className="v-text">
                All shards forged at the altar.<br />
                The Scoundrels of Obryndel have triumphed!<br /><br />
                <em>Baron Thobrick's power crumbles…</em>
              </div>
              <button className="start-btn" onClick={() => { setPhase("setup"); setPlayerCount(null); if (onExit) onExit(); }}>
                Play Again
              </button>
            </div>
          </div>
        )}

        <div className="game-layout">

          {/* ── Grid ── */}
          <div className="grid-wrap">
            <div className="grid">
              {Array.from({ length: GRID_SIZE }, (_, y) =>
                Array.from({ length: GRID_SIZE }, (_, x) => {
                  const key      = cellKey(x, y);
                  const color    = grid[key] || "empty";
                  const isGone   = vanished.has(key);
                  const isStart  = isStartCell(x, y);
                  const isCorner = CORNER_KEYS.has(key);
                  const isBlack  = color === "black";
                  const isSwSel  = swFirst && swFirst.x === x && swFirst.y === y;
                  const isSwAble = !isCorner && !isStart && !isGone
                                && !positions.some((p, i) => !dead[i] && p.x===x && p.y===y)
                                && !(modEnemy && enemyPos.x===x && enemyPos.y===y);
                  const playersHere  = positions.map((p,i) => p.x===x && p.y===y ? i : -1).filter(i=>i>=0);
                  const enemyHere    = modEnemy && enemyPos.x===x && enemyPos.y===y;
                  const droppedHere  = modEnemy
                    ? dropped.map((d,i) => { const dp=droppedPos[i]; return d&&dp&&dp.x===x&&dp.y===y?i:-1; }).filter(i=>i>=0)
                    : [];
                  const obj = OBJECT_MAP[key];

                  return (
                    <div
                      key={key}
                      className={[
                        "cell",
                        isGone   ? "gone"     : "",
                        isStart  ? "start-cell" : "",
                        isSwAble ? "sw-able"  : "",
                        isSwSel  ? "sw-sel"   : "",
                      ].join(" ")}
                      style={{
                        background: isGone ? "transparent"
                          : isBlack ? COLOR_BG.black
                          : COLOR_BG[color] || COLOR_BG.empty,
                        borderColor: isStart  ? "rgba(237,230,207,.4)"
                          : isCorner ? "rgba(237,230,207,.2)"
                          : isBlack  ? "rgba(255,255,255,.03)"
                          : `${COLOR_HEX[color]||"#1a1510"}22`,
                        boxShadow: isStart ? "0 0 10px rgba(237,230,207,.25)" : undefined,
                        position: "relative",
                      }}
                      onClick={() => handleCellClick(x, y)}
                    >
                      {/* Corner shard */}
                      {isCorner && obj && !isGone && (
                        <span style={{ fontSize:"clamp(9px,1.7vw,14px)", opacity: inventory[PLAYER_COLORS.indexOf(obj.id)] ? 0.12 : 0.9, filter:"drop-shadow(0 1px 3px rgba(0,0,0,.8))" }}>
                          {obj.emoji}
                        </span>
                      )}
                      {/* Start marker */}
                      {isStart && playersHere.length===0 && !enemyHere && (
                        <span style={{ fontSize:"clamp(7px,1.2vw,10px)", opacity:.28 }}>✦</span>
                      )}
                      {/* Dropped shards on floor */}
                      {droppedHere.map(di => (
                        <span key={di} style={{ position:"absolute", top:2, right:2, fontSize:"clamp(6px,1vw,9px)", opacity:.75, filter:"drop-shadow(0 1px 2px rgba(0,0,0,.9))", zIndex:8 }}>
                          {OBJECTS[di].emoji}
                        </span>
                      ))}
                      {/* Enemy */}
                      {enemyHere && (
                        <div className="eby" style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"clamp(11px,2vw,17px)", zIndex:20, filter:"drop-shadow(0 0 6px rgba(200,20,20,.95))" }}>
                          👁️
                        </div>
                      )}
                      {/* Players */}
                      {playersHere.map(pi => (
                        <div key={pi} style={{
                          position:"absolute",
                          fontSize: playersHere.length>1 ? "clamp(7px,1.3vw,11px)" : "clamp(10px,1.9vw,16px)",
                          ...(playersHere.length>1
                            ? { top:pi%2===0?"2px":undefined, bottom:pi%2===1?"2px":undefined,
                                left:Math.floor(pi/2)===0?"2px":undefined, right:Math.floor(pi/2)===1?"2px":undefined }
                            : { inset:0, display:"flex", alignItems:"center", justifyContent:"center" }),
                          display:"flex", alignItems:"center", justifyContent:"center",
                          zIndex:10,
                          opacity: dead[pi] ? 0.25 : 1,
                          filter: dead[pi] ? "grayscale(1) drop-shadow(0 1px 3px rgba(0,0,0,.8))" : "drop-shadow(0 1px 4px rgba(0,0,0,.9))",
                        }}>
                          {PLAYER_EMOJIS[pi]}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            {/* Legend */}
            <div className="legend">
              {!modBW && PLAYER_COLORS.slice(0, playerCount).map(c => (
                <div className="leg-i" key={c}>
                  <div className="leg-d" style={{ background: COLOR_HEX[c] }} />
                  <span style={{ textTransform:"capitalize" }}>{c}</span>
                </div>
              ))}
              {modBW && <>
                <div className="leg-i"><div className="leg-d" style={{ background:"#e8e2d0", border:"1px solid #888" }} /><span>Walkable</span></div>
                <div className="leg-i"><div className="leg-d" style={{ background:"#111" }} /><span>Blocked</span></div>
              </>}
              <div className="leg-i">
                <div className="leg-d" style={{ background:"rgba(237,230,207,.65)", border:"1px solid rgba(237,230,207,.3)" }} />
                <span>Safe</span>
              </div>
              {modEnemy && <div className="leg-i"><span style={{ fontSize:"0.9em" }}>👁️</span><span>The Shadow</span></div>}
              {modVanish && <div className="leg-i"><span style={{ fontSize:"0.9em" }}>💨</span><span>{vanished.size} gone</span></div>}
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="sidebar">

            {/* Turn card */}
            <div className="s-card">
              <div className="s-hdr">Current Turn</div>
              {modEnemy && inventory[cp] && (
                <div style={{ display:"inline-block", background:"rgba(180,20,20,.28)", border:"1px solid rgba(220,60,60,.28)", borderRadius:6, padding:"2px 8px", fontSize:"0.66rem", color:"rgba(255,120,120,.8)", marginBottom:8 }}>
                  👁️ The Shadow hunts you!
                </div>
              )}
              <div className="p-ind">
                <div className="p-dot" style={{ background: COLOR_HEX[cpColor], boxShadow:`0 0 8px ${COLOR_HEX[cpColor]}` }} />
                <div className="p-nm">{PLAYER_NAMES[cp]}</div>
                {inventory[cp] && <span style={{ fontSize:"0.82rem" }} title="Carrying shard">⚡</span>}
                {dead[cp]      && <span style={{ fontSize:"0.7rem", color:"rgba(255,80,80,.7)", marginLeft:4 }}>💀 Dead</span>}
              </div>

              {!swFirst ? (
                <>
                  <div className="ph-lbl">WASD to move · Click tile to swap colors</div>
                  <div style={{ display:"flex", gap:9, alignItems:"flex-start", marginTop:5 }}>
                    <div className="wasd-g" style={{ marginTop:0, flexShrink:0 }}>
                      <div /><div className="wk">W</div><div />
                      <div className="wk">A</div><div className="wk">S</div><div className="wk">D</div>
                    </div>
                    <div className="sw-hint">Click any open tile to start a color swap.</div>
                  </div>
                  {modEnemy && inventory[cp] && !dead[cp] && (
                    <button className="drop-btn" onClick={handleDrop}>
                      💧 Drop Shard — stop the Shadow
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="ph-lbl" style={{ color:"rgba(255,220,80,.72)" }}>Tile selected — click another to swap</div>
                  <div className="sw-hint">Click a second tile to swap, or same tile to cancel.</div>
                </>
              )}
            </div>

            {/* Players list */}
            <div className="s-card">
              <div className="s-hdr">Scoundrels</div>
              <div className="p-list">
                {Array.from({ length: playerCount }, (_, i) => {
                  const obj     = OBJECTS[i];
                  const hasObj  = inventory[i];
                  const isDone  = atBase[i];
                  const isDead  = dead[i];
                  const hasDrop = dropped[i];
                  return (
                    <div key={i} className={`p-row${i===cp?" cur":""}${isDone?" done":""}${isDead?" ded":""}`}>
                      <div className="p-ri">{isDead ? "💀" : PLAYER_EMOJIS[i]}</div>
                      <div style={{ flex:1 }}>
                        <div className="p-rn" style={{ color: COLOR_HEX[PLAYER_COLORS[i]] }}>{PLAYER_NAMES[i]}</div>
                        <div className="p-rs">
                          {isDead  ? "Dead — move onto them to revive"
                          : isDone ? "✓ Shard forged at the altar!"
                          : hasObj ? `Carrying ${obj.emoji} — return to base!`
                          : hasDrop? `${obj.emoji} dropped — reclaim it!`
                          : `Seeking ${obj.emoji} ${obj.label}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active modifiers */}
            {(modVanish || modEnemy || modBW) && (
              <div className="s-card">
                <div className="s-hdr">Active Modifiers</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {modVanish && <div style={{ fontSize:"0.7rem", color:"rgba(180,155,90,.48)" }}>💨 Vanishing Tiles ({vanished.size} gone)</div>}
                  {modEnemy  && <div style={{ fontSize:"0.7rem", color:"rgba(255,100,100,.48)" }}>👁️ The Shadow is active</div>}
                  {modBW     && <div style={{ fontSize:"0.7rem", color:"rgba(200,200,200,.38)" }}>🖤 Black &amp; White mode</div>}
                </div>
              </div>
            )}

            {/* Log */}
            <div className="s-card">
              <div className="s-hdr">Event Log</div>
              <div className="log-box">
                {log.map((l, i) => <div key={i}>{l}</div>)}
              </div>
            </div>

            <button className="start-btn" style={{ fontSize:"0.76rem", padding:"8px 16px", opacity:.42 }}
              onClick={() => { setPhase("setup"); setPlayerCount(null); if (onExit) onExit(); }}>
              ← Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
