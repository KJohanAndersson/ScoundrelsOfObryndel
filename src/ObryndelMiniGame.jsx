import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_COLORS = ["red", "blue", "yellow", "green"];
const PLAYER_NAMES  = ["Red", "Blue", "Yellow", "Green"];
const PLAYER_EMOJIS = ["🔴", "🔵", "🟡", "🟢"];

const OBJECT_DEFS = [
  { id: "red",    emoji: "🗡️", label: "Red Shard"     },
  { id: "blue",   emoji: "🔮", label: "Blue Orb"      },
  { id: "yellow", emoji: "📜", label: "Yellow Scroll" },
  { id: "green",  emoji: "🌿", label: "Green Root"    },
];

const CHARACTERS = [
  {
    id: "gribberth",
    name: "Gribberth Twelvetoe",
    race: "Goblin",
    emoji: "👺",
    abilityName: "Quick Toes",
    abilityDesc: "Move three steps this turn. You may sprint past an enemy without being caught.",
    abilityCooldown: 3,
    color: "#7ec850",
  },
  {
    id: "craglasha",
    name: "Craglasha Rawrolgh",
    race: "Orc",
    emoji: "👹",
    abilityName: "Roar of the Mother",
    abilityDesc: "Enemies within 2 steps flee in fear for 2 rounds.",
    abilityCooldown: 3,
    color: "#b35c2e",
  },
  {
    id: "brontarox",
    name: "Brontarox of Mount Lroth",
    race: "Cyclops",
    emoji: "🌀",
    abilityName: "Boulder Throw",
    abilityDesc: "Stun an enemy within 3 steps for 2 rounds.",
    abilityCooldown: 3,
    color: "#8888aa",
  },
  {
    id: "rithea",
    name: "Rithea Wartwaggle",
    race: "Witch",
    emoji: "🧙",
    abilityName: "Zap!",
    abilityDesc: "Teleport an enemy within 2 steps to a random location on the map.",
    abilityCooldown: 3,
    color: "#c050c0",
  },
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

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(213,169,62,${alpha})`;
  const raw = hex.replace("#", "");
  const full = raw.length === 3
    ? raw.split("").map(ch => ch + ch).join("")
    : raw;
  const value = parseInt(full, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const EVENT_CARDS = [
  { id: "teleport", icon: "🌀", name: "Teleportation Trap!", desc: "You are teleported to a random location on the map!" },
  { id: "stun",     icon: "💫", name: "Brick to the Head!", desc: "You are stunned and skip your next turn!" },
  { id: "motivation",icon:"⚡", name: "Sudden Motivation!", desc: "You may make one extra move this turn!" },
];

const cellKey = (x, y) => `${x},${y}`;

// ─── Maze generation (Recursive Backtracker) ──────────────────────────────────
function generateMaze(W, H) {
  const visited = new Set();
  const walls = new Set();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < W-1) walls.add(`${x},${y}|${x+1},${y}`);
      if (y < H-1) walls.add(`${x},${y}|${x},${y+1}`);
    }
  }
  const carved = new Set();
  function carve(x, y) {
    visited.add(cellKey(x,y));
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]].sort(()=>Math.random()-0.5);
    for (const [dx,dy] of dirs) {
      const nx=x+dx, ny=y+dy;
      if (nx<0||nx>=W||ny<0||ny>=H) continue;
      if (visited.has(cellKey(nx,ny))) continue;
      const wk = `${Math.min(x,nx)},${Math.min(y,ny)}|${Math.max(x,nx)},${Math.max(y,ny)}`;
      carved.add(wk);
      carve(nx,ny);
    }
  }
  carve(0,0);
  const remaining = new Set([...walls].filter(w => !carved.has(w)));
  return remaining;
}

function wallKey(x, y, dx, dy) {
  const nx=x+dx, ny=y+dy;
  return `${Math.min(x,nx)},${Math.min(y,ny)}|${Math.max(x,nx)},${Math.max(y,ny)}`;
}

function bfsMaze(from, to, mazeWalls, vanishedSet, gridSize, blockedCells) {
  const queue = [[from.x, from.y, null]];
  const visited = new Set([cellKey(from.x,from.y)]);
  while (queue.length) {
    const [cx,cy,firstStep] = queue.shift();
    for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx=cx+dx, ny=cy+dy;
      if (nx<0||nx>=gridSize||ny<0||ny>=gridSize) continue;
      const nk=cellKey(nx,ny);
      if (visited.has(nk)) continue;
      if (vanishedSet && vanishedSet.has(nk)) continue;
      if (blockedCells && blockedCells.has(nk)) continue;
      if (mazeWalls && mazeWalls.has(wallKey(cx,cy,dx,dy))) continue;
      visited.add(nk);
      const step = firstStep||{x:nx,y:ny};
      if (nx===to.x&&ny===to.y) return step;
      queue.push([nx,ny,step]);
    }
  }
  return null;
}

function bfsDist(from, to, mazeWalls, vanishedSet, gridSize) {
  const queue = [[from.x, from.y, 0]];
  const visited = new Set([cellKey(from.x,from.y)]);
  while (queue.length) {
    const [cx,cy,d] = queue.shift();
    if (cx===to.x&&cy===to.y) return d;
    for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx=cx+dx, ny=cy+dy;
      if (nx<0||nx>=gridSize||ny<0||ny>=gridSize) continue;
      const nk=cellKey(nx,ny);
      if (visited.has(nk)) continue;
      if (vanishedSet&&vanishedSet.has(nk)) continue;
      if (mazeWalls&&mazeWalls.has(wallKey(cx,cy,dx,dy))) continue;
      visited.add(nk);
      queue.push([nx,ny,d+1]);
    }
  }
  return Infinity;
}

// Get all cells within BFS distance N (respecting walls)
function bfsVisibleCells(from, dist, mazeWalls, vanishedSet, gridSize) {
  const visible = new Set();
  const queue = [[from.x, from.y, 0]];
  const visited = new Set([cellKey(from.x,from.y)]);
  visible.add(cellKey(from.x,from.y));
  while (queue.length) {
    const [cx,cy,d] = queue.shift();
    if (d >= dist) continue;
    for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx=cx+dx, ny=cy+dy;
      if (nx<0||nx>=gridSize||ny<0||ny>=gridSize) continue;
      const nk=cellKey(nx,ny);
      if (mazeWalls&&mazeWalls.has(wallKey(cx,cy,dx,dy))) continue;
      if (!visited.has(nk)) {
        visited.add(nk);
        visible.add(nk);
        queue.push([nx,ny,d+1]);
      }
    }
  }
  return visible;
}

// ─── Place objects near the edges ─────────────────────────────────────────────
function placeObjects(gridSize, startCX, startCY, mazeWalls, playerCount) {
  const centerCell = { x: startCX, y: startCY };
  const placed = [];
  const usedKeys = new Set();
  for (let dy=-2;dy<=0;dy++) for(let dx=-2;dx<=2;dx++) {
    const px=startCX+dx, py=startCY+dy;
    if (px>=0&&px<gridSize&&py>=0&&py<gridSize) usedKeys.add(cellKey(px,py));
  }

  const isNearEdge = (x, y) =>
    x <= 1 || x >= gridSize-2 || y <= 1 || y >= gridSize-2;

  for (let i = 0; i < playerCount; i++) {
    const candidates = [];
    for (let y=0; y<gridSize; y++) {
      for (let x=0; x<gridSize; x++) {
        const k = cellKey(x,y);
        if (usedKeys.has(k)) continue;
        if (!isNearEdge(x,y)) continue;
        candidates.push({x,y});
      }
    }
    candidates.sort(()=>Math.random()-.5);
    let best = null;
    for (const c of candidates) {
      const d = bfsDist(centerCell, c, mazeWalls, new Set(), gridSize);
      if (d < Infinity) { best = c; break; }
    }
    if (best) {
      placed.push({ ...OBJECT_DEFS[i], x: best.x, y: best.y });
      usedKeys.add(cellKey(best.x, best.y));
    }
  }
  return placed;
}

// ─── Grid generation ──────────────────────────────────────────────────────────
function makeGrid(gridSize, playerCount, bwMode, hasMaze, hasColors) {
  const grid = {};
  let colors;
  if (!hasColors) colors = ["white"];
  else if (bwMode) colors = ["white","black"];
  else colors = PLAYER_COLORS.slice(0, playerCount);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      grid[cellKey(x,y)] = colors[Math.floor(Math.random()*colors.length)];
    }
  }
  return grid;
}

const KINGDOM_ROWS = 5;

function buildChallengeRoom(chars, playerCount) {
  const gs = 10;
  const grid = {};
  for (let y = 0; y < gs; y++) {
    for (let x = 0; x < gs; x++) {
      grid[cellKey(x, y)] = "white";
    }
  }

  const laneByChar = {
    gribberth: 2,
    craglasha: 4,
    brontarox: 6,
    rithea: 8,
  };
  const defaultLanes = [2, 4, 6, 8];
  const secondRowFromTop = 1;

  const gap = { x: laneByChar.gribberth, y: secondRowFromTop };
  const crackedWall = { x: laneByChar.craglasha, y: secondRowFromTop, broken: false };
  const button = { x: laneByChar.brontarox, y: secondRowFromTop, activated: false, flash: false };
  const ball = { x: laneByChar.rithea, y: secondRowFromTop };
  grid[cellKey(gap.x, gap.y)] = "empty";
  grid[cellKey(crackedWall.x, crackedWall.y)] = "black";

  const startY = gs - 1;
  const usedLanes = new Set();
  const startCells = Array.from({ length: playerCount }, (_, i) => {
    const preferred = laneByChar[chars?.[i]];
    let lane = preferred;
    if (lane == null || usedLanes.has(lane)) {
      lane = defaultLanes.find(v => !usedLanes.has(v)) ?? Math.min(gs - 1, i + 1);
    }
    usedLanes.add(lane);
    return { x: lane, y: startY };
  });

  const instructions = [
    "Click a character portrait to control that character.",
    "Move with WASD. There is no turn order in this mode.",
    "Press SPACE to target an ability. Red outlined tiles are valid targets.",
    "Press SPACE again to cancel targeting.",
    "Goblin: jump one or two tiles in a cardinal direction.",
    "Orc: target one adjacent tile (up, down, left, right); only cracked walls are affected.",
    "Cyclops: throw one to four tiles in a cardinal direction; only the button reacts.",
    "Witch: target in straight lines (up, down, left, right) until an obstacle blocks line of sight.",
  ];

  return {
    grid,
    startCells,
    gap,
    crackedWall,
    button,
    ball,
    completed: {
      goblin: false,
      orc: false,
      cyclops: false,
      witch: false,
    },
    instructions,
  };
}

function getStartCenter(gridSize) {
  return { x: Math.floor(gridSize/2), y: gridSize - 1 };
}

function getStartCells(gridSize) {
  const cx = Math.floor(gridSize/2);
  const cy = gridSize - 1;
  return [
    {x:cx-1, y:cy-1}, {x:cx, y:cy-1},
    {x:cx-1, y:cy},   {x:cx, y:cy},
  ];
}

function isStartCellFn(x, y, gridSize) {
  const cx = Math.floor(gridSize/2);
  const cy = gridSize - 1;
  return (x===cx-1||x===cx) && (y===cy-1||y===cy);
}

function makeKingdomGrid(gridSize) {
  const kg = {};
  for (let y = 0; y < KINGDOM_ROWS; y++) {
    for (let x = 0; x < gridSize; x++) {
      kg[cellKey(x, y)] = "white";
    }
  }
  return kg;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');`;
const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#050304;color:#EDE6CF}
.og{position:relative;min-height:100vh;background:radial-gradient(1200px 520px at 50% -10%,rgba(218,166,69,.15),transparent),radial-gradient(900px 460px at 0% 100%,rgba(36,96,130,.13),transparent),linear-gradient(180deg,#050406 0%,#09060a 52%,#0d0607 100%);font-family:'Crimson Pro',Georgia,serif;color:#EDE6CF;display:flex;flex-direction:column;align-items:center;padding:24px 16px 48px;user-select:none;overflow:hidden}
.og::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.01) 0,rgba(255,255,255,.01) 2px,transparent 2px,transparent 16px);pointer-events:none}
h1.og-title{position:relative;font-family:'Cinzel',serif;font-size:clamp(1.6rem,5vw,3rem);font-weight:900;color:#F6E6A8;letter-spacing:8px;text-transform:uppercase;text-shadow:0 0 50px rgba(220,180,70,.22),0 10px 30px rgba(0,0,0,.6);margin-bottom:4px}
.og-sub{position:relative;font-family:'Cinzel',serif;font-size:.75rem;letter-spacing:4px;color:rgba(210,186,122,.55);text-transform:uppercase;margin-bottom:24px}
.setup-card{position:relative;background:linear-gradient(180deg,rgba(38,24,18,.93),rgba(10,6,4,.95));border:1px solid rgba(213,169,62,.2);border-radius:18px;padding:30px 38px;text-align:center;box-shadow:0 32px 110px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.06);max-width:600px;width:100%}
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
.start-btn{padding:12px 30px;font-family:'Cinzel',serif;font-size:1rem;letter-spacing:2px;background:linear-gradient(180deg,#6a4420,#2b1708);border:1px solid rgba(230,185,70,.32);border-radius:12px;color:#FFF8E6;cursor:pointer;transition:all 140ms ease;box-shadow:0 12px 36px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.06)}
.start-btn:hover{transform:translateY(-2px);box-shadow:0 16px 48px rgba(0,0,0,.78),0 0 18px rgba(230,185,70,.14)}
.start-btn:disabled{opacity:.3;cursor:not-allowed}
.game-layout{position:relative;display:grid;grid-template-columns:minmax(360px,1fr) minmax(250px,300px);gap:18px;align-items:flex-start;width:100%;max-width:1220px}
.grid-wrap{position:relative;flex-shrink:0;padding:10px;border-radius:16px;background:linear-gradient(180deg,rgba(21,14,9,.82),rgba(7,4,3,.88));border:1px solid rgba(213,169,62,.18);box-shadow:0 22px 90px rgba(0,0,0,.82),inset 0 1px 0 rgba(255,255,255,.04)}
.grid-wrap::before{content:'';position:absolute;inset:0;border-radius:16px;pointer-events:none;background:linear-gradient(180deg,rgba(255,220,170,.06),transparent 24%,transparent 70%,rgba(0,0,0,.3))}
.grid-wrap::after{content:'';position:absolute;inset:0;border-radius:16px;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),inset 0 0 65px rgba(0,0,0,.45)}
.grid-container{display:flex;flex-direction:column;gap:0;align-items:center}
.iso-board{position:relative;transform:none;transform-style:flat}
.iso-board.wilderness-board{filter:drop-shadow(0 14px 18px rgba(0,0,0,.55))}
.iso-board.kingdom-board{filter:drop-shadow(0 12px 15px rgba(0,0,0,.5))}
.grid{display:grid;gap:0;background:linear-gradient(180deg,rgba(12,9,7,.92),rgba(5,4,3,.94));border:1px solid rgba(213,169,62,.24);padding:4px;box-shadow:0 14px 46px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.04)}
.grid-wilderness{border-radius:10px 10px 0 0;border-bottom:none;padding-bottom:0;background:
  radial-gradient(circle at 20% 18%,rgba(150,115,72,.14),transparent 42%),
  radial-gradient(circle at 78% 72%,rgba(70,100,88,.12),transparent 45%),
  repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0 2px,transparent 2px 8px),
  linear-gradient(180deg,#231b14,#15100c)}
.grid-kingdom{border-radius:0 0 10px 10px;border-top:none;padding-top:0;background:
  radial-gradient(circle at 30% 20%,rgba(190,155,105,.14),transparent 42%),
  repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0 2px,transparent 2px 7px),
  linear-gradient(180deg,#322213,#1e150d)}
.kingdom-grid-outer{background:transparent !important;border:none !important;box-shadow:none !important;border-radius:0 !important}
.actor-layer{position:absolute;top:4px;left:4px;pointer-events:none;z-index:40}
.actor-node{position:absolute;transform:translate(-50%,-58%);transition:left 260ms cubic-bezier(.2,.9,.2,1),top 260ms cubic-bezier(.2,.9,.2,1),transform 220ms ease;will-change:left,top,transform}
.actor-node.current{transform:translate(-50%,-62%)}
.actor-node.mini{transform:translate(-50%,-52%)}
.actor-node.dead{transform:translate(-50%,-46%)}
.challenge-object-layer{z-index:30}
.challenge-obj{transform:translate(-50%,-54%)}
.challenge-obj-token{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(25,20,16,.75);border:1px solid rgba(213,169,62,.38);box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 8px rgba(0,0,0,.4);font-size:.86rem;transition:transform 220ms ease, box-shadow 220ms ease, background 220ms ease}
.challenge-obj-token.active{background:rgba(20,48,24,.82);border-color:rgba(110,255,150,.68);box-shadow:0 0 0 1px rgba(0,0,0,.45),0 0 12px rgba(90,255,130,.48)}
.challenge-obj-token.flash{animation:buttonFlash 420ms ease-out}
.cell{position:relative;display:flex;align-items:center;justify-content:center;font-size:clamp(9px,1.5vw,15px);cursor:default;transition:transform 90ms ease,opacity 350ms ease,box-shadow 120ms ease;border:1px solid rgba(0,0,0,.3);overflow:hidden}
.cell::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.2;background-image:radial-gradient(circle at 22% 28%,rgba(255,255,255,.18) 0 1px,transparent 2px),radial-gradient(circle at 74% 64%,rgba(0,0,0,.24) 0 1px,transparent 2px),repeating-linear-gradient(35deg,rgba(255,255,255,.03) 0 1px,transparent 1px 6px)}
.cell::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.28;background:linear-gradient(160deg,rgba(255,255,255,.1),transparent 40%,rgba(0,0,0,.22) 100%)}
.cell.gone{opacity:0;pointer-events:none}
.cell.sw-able{cursor:pointer;outline:2px dashed rgba(255,255,255,.2);outline-offset:-3px}
.cell.sw-able:hover{transform:scale(1.07);z-index:2}
.cell.sw-sel{outline:2px solid rgba(255,220,80,.9);outline-offset:-2px;box-shadow:0 0 14px rgba(255,220,80,.4);transform:scale(1.09);z-index:3}
.cell.start-cell{box-shadow:inset 0 0 0 1px rgba(237,230,207,.35),0 0 16px rgba(237,230,207,.38)}
.cell.kingdom-cell{border-color:rgba(213,169,62,.3) !important}
.cell.dark-cell{background:#0a0806 !important;border-color:rgba(0,0,0,.8) !important}
.cell.dark-edge{filter:brightness(0.45)}
.cell.dark-cell::before,.cell.dark-cell::after,.cell.gone::before,.cell.gone::after{display:none}
.tile-red::after{opacity:.38;background:linear-gradient(165deg,rgba(230,130,110,.16),transparent 46%),repeating-linear-gradient(35deg,rgba(255,255,255,.04) 0 2px,transparent 2px 7px)}
.tile-blue::after{opacity:.38;background:linear-gradient(165deg,rgba(118,158,210,.18),transparent 46%),repeating-linear-gradient(35deg,rgba(255,255,255,.04) 0 2px,transparent 2px 7px)}
.tile-yellow::after{opacity:.38;background:linear-gradient(165deg,rgba(215,185,118,.16),transparent 46%),repeating-linear-gradient(35deg,rgba(255,255,255,.04) 0 2px,transparent 2px 7px)}
.tile-green::after{opacity:.38;background:linear-gradient(165deg,rgba(110,170,125,.16),transparent 46%),repeating-linear-gradient(35deg,rgba(255,255,255,.04) 0 2px,transparent 2px 7px)}
.tile-white::after{opacity:.28;background:linear-gradient(165deg,rgba(245,235,215,.2),transparent 45%),repeating-linear-gradient(35deg,rgba(255,255,255,.05) 0 2px,transparent 2px 8px)}
.tile-black::after{opacity:.16;background:linear-gradient(165deg,rgba(255,255,255,.07),transparent 45%),repeating-linear-gradient(35deg,rgba(255,255,255,.03) 0 2px,transparent 2px 8px)}
.tile-kingdom::after{opacity:.35;background:linear-gradient(165deg,rgba(235,195,135,.16),transparent 45%),repeating-linear-gradient(35deg,rgba(255,255,255,.04) 0 2px,transparent 2px 8px)}
.kingdom-locked::after{opacity:.2;background:repeating-linear-gradient(45deg,rgba(210,120,255,.08) 0 2px,transparent 2px 8px)}
.tile-hazard-spike::after{opacity:.5;background:linear-gradient(165deg,rgba(255,170,170,.25),transparent 45%),repeating-linear-gradient(45deg,rgba(255,200,200,.08) 0 2px,transparent 2px 6px)}
.tile-hazard-gap::after{opacity:.08;background:repeating-linear-gradient(45deg,rgba(255,255,255,.04) 0 2px,transparent 2px 9px)}
.tile-start-sigil::before{opacity:.35;background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,.26) 0 15%,transparent 35%),repeating-conic-gradient(from 0deg,rgba(255,255,255,.08) 0deg 10deg,transparent 10deg 20deg)}
.cell.ab-target{outline:2px solid rgba(255,80,80,.95);outline-offset:-2px;box-shadow:inset 0 0 0 2px rgba(255,70,70,.35),0 0 10px rgba(255,70,70,.35);animation:targetPulse .9s ease-in-out infinite}
.cell-wall-top{border-top:2px solid rgba(85,85,85,.95) !important}
.cell-wall-right{border-right:2px solid rgba(85,85,85,.95) !important}
.cell-wall-bottom{border-bottom:2px solid rgba(85,85,85,.95) !important}
.cell-wall-left{border-left:2px solid rgba(85,85,85,.95) !important}
.sidebar{display:flex;flex-direction:column;gap:10px;min-width:220px;max-width:300px;flex:1}
.s-card{background:linear-gradient(180deg,rgba(34,23,18,.93),rgba(8,5,4,.93));border:1px solid rgba(213,169,62,.2);border-radius:13px;padding:15px 17px;box-shadow:0 12px 52px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.04)}
.s-hdr{font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:3px;color:rgba(208,183,122,.55);text-transform:uppercase;margin-bottom:8px}
.p-ind{display:flex;align-items:center;gap:9px;margin-bottom:11px;flex-wrap:wrap}
.p-dot{width:13px;height:13px;border-radius:50%;flex-shrink:0}
.p-nm{font-family:'Cinzel',serif;font-size:1rem;color:#EFD88B;letter-spacing:1px}
.ph-lbl{font-size:.76rem;color:rgba(200,180,130,.5);letter-spacing:.4px;margin-bottom:9px;font-style:italic}
.wasd-g{display:grid;grid-template-columns:repeat(3,29px);grid-template-rows:repeat(2,29px);gap:3px;justify-content:center;margin:5px auto 0}
.wk{width:29px;height:29px;background:rgba(30,20,10,.8);border:1px solid rgba(213,169,62,.2);border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:.7rem;color:rgba(240,215,140,.6)}
.sw-hint{font-size:.72rem;color:rgba(180,155,90,.5);font-style:italic;line-height:1.5;margin-top:5px}
.p-list{display:flex;flex-direction:column;gap:6px}
.p-row{display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:10px;background:rgba(10,7,5,.56);border:1px solid rgba(255,255,255,.05);font-size:.8rem;transition:all 140ms ease}
.p-row.cur{background:rgba(64,40,15,.74);border-color:rgba(213,169,62,.34);box-shadow:0 0 0 1px rgba(213,169,62,.12)}
.p-row.done{opacity:.4}
.p-row.ded{opacity:.32;border-color:rgba(200,50,50,.18);background:rgba(40,5,5,.5)}
.p-ri{font-size:.95rem;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.p-rn{font-family:'Cinzel',serif;font-size:.76rem}
.p-rs{font-size:.66rem;color:rgba(180,155,90,.42);margin-top:1px}
.legend{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:10px;padding:8px 10px;border-radius:10px;background:rgba(8,5,4,.55);border:1px solid rgba(213,169,62,.12)}
.leg-i{display:flex;align-items:center;gap:5px;font-size:.66rem;color:rgba(195,168,106,.7)}
.leg-d{width:9px;height:9px;border-radius:2px}
.log-box{background:rgba(6,4,3,.78);border:1px solid rgba(213,169,62,.12);border-radius:9px;padding:9px 11px;max-height:130px;overflow-y:auto;font-size:.72rem;color:rgba(196,168,104,.74);line-height:1.6;font-style:italic}
.drop-btn{width:100%;padding:8px;margin-top:7px;border-radius:8px;border:1px solid rgba(220,60,60,.28);background:rgba(80,10,10,.6);color:rgba(255,150,150,.8);font-family:'Cinzel',serif;font-size:.72rem;cursor:pointer;transition:all 140ms ease;letter-spacing:.4px}
.drop-btn:hover{background:rgba(120,20,20,.8)}
.ability-btn{width:100%;padding:8px;margin-top:5px;border-radius:8px;border:1px solid rgba(100,200,255,.28);background:rgba(10,30,60,.6);color:rgba(150,210,255,.9);font-family:'Cinzel',serif;font-size:.72rem;cursor:pointer;transition:all 140ms ease;letter-spacing:.4px}
.ability-btn:hover:not(:disabled){background:rgba(20,60,100,.8)}
.ability-btn:disabled{opacity:.3;cursor:not-allowed}
.eby{animation:pulse .75s ease infinite}
.victory-overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;z-index:100;animation:fadeIn .4s ease}
.victory-card{background:linear-gradient(180deg,rgba(50,30,10,.97),rgba(6,4,3,.97));border:1px solid rgba(213,169,62,.3);border-radius:20px;padding:42px 50px;text-align:center;box-shadow:0 40px 120px rgba(0,0,0,.95),0 0 60px rgba(213,169,62,.1);max-width:450px;animation:popIn .4s cubic-bezier(.22,1,.36,1)}
.v-title{font-family:'Cinzel',serif;font-size:2.3rem;color:#F6E6A8;letter-spacing:4px;margin-bottom:11px;text-shadow:0 0 30px rgba(220,180,70,.4)}
.v-text{color:#cfc1a3;font-style:italic;line-height:1.7;margin-bottom:24px}
.event-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:90;animation:fadeIn .3s ease}
.event-card{background:linear-gradient(180deg,rgba(60,10,60,.97),rgba(6,4,3,.97));border:1px solid rgba(180,80,220,.4);border-radius:18px;padding:32px 40px;text-align:center;box-shadow:0 30px 100px rgba(0,0,0,.95),0 0 40px rgba(180,80,220,.15);max-width:380px;animation:popIn .4s cubic-bezier(.22,1,.36,1)}
.event-icon{font-size:3rem;margin-bottom:12px}
.event-name{font-family:'Cinzel',serif;font-size:1.4rem;color:#e080ff;letter-spacing:2px;margin-bottom:8px}
.event-desc{color:#cfc1a3;font-style:italic;line-height:1.7;margin-bottom:20px}
.char-select{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-bottom:20px}
.char-card{width:135px;border-radius:14px;padding:14px 12px;text-align:center;cursor:pointer;transition:all 180ms ease;border:2px solid rgba(213,169,62,.1);background:rgba(15,10,6,.8);position:relative}
.char-card:hover{transform:translateY(-3px);border-color:rgba(213,169,62,.35)}
.char-card.chosen{border-color:rgba(213,169,62,.8);box-shadow:0 0 20px rgba(213,169,62,.2);transform:translateY(-3px)}
.char-card.taken{opacity:.3;cursor:not-allowed;pointer-events:none}
.char-emoji{font-size:2.2rem;margin-bottom:6px}
.char-name{font-family:'Cinzel',serif;font-size:.68rem;color:#EFD88B;letter-spacing:.5px;margin-bottom:3px;line-height:1.3}
.char-race{font-size:.62rem;color:rgba(180,155,90,.5);margin-bottom:7px;font-style:italic}
.char-ability{font-size:.6rem;color:rgba(200,180,130,.6);line-height:1.4}
.char-ability-name{font-family:'Cinzel',serif;font-size:.65rem;color:rgba(150,210,255,.7);margin-bottom:2px}
.phase-banner{background:linear-gradient(90deg,rgba(50,30,5,.0),rgba(50,30,5,.8),rgba(50,30,5,.0));border-top:1px solid rgba(213,169,62,.2);border-bottom:1px solid rgba(213,169,62,.2);padding:8px 24px;text-align:center;font-family:'Cinzel',serif;font-size:.75rem;color:#EFD88B;letter-spacing:2px;margin-bottom:14px;width:100%}
.slider-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;justify-content:space-between}
.slider-lbl{font-family:'Cinzel',serif;font-size:.72rem;color:#D9B65A;letter-spacing:.5px;white-space:nowrap}
.slider-val{font-family:'Cinzel',serif;font-size:.9rem;color:#F6E6A8;min-width:38px;text-align:right}
input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;background:rgba(213,169,62,.3);outline:none;cursor:pointer;flex:1}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#D9B65A;cursor:pointer;box-shadow:0 0 6px rgba(213,169,62,.6)}
.all-gathered-banner{background:linear-gradient(180deg,rgba(80,30,120,.9),rgba(30,10,50,.9));border:1px solid rgba(180,80,220,.4);border-radius:12px;padding:12px 16px;text-align:center;font-family:'Cinzel',serif;font-size:.78rem;color:#e080ff;letter-spacing:1px;line-height:1.6;margin-bottom:8px;box-shadow:0 0 30px rgba(180,80,220,.15);animation:popIn .5s ease}
.obj-token{display:inline-block;animation:objHover 2.2s ease-in-out infinite}
.enemy-token{display:flex;align-items:center;justify-content:center}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
@keyframes objHover{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes targetPulse{0%,100%{box-shadow:inset 0 0 0 2px rgba(255,70,70,.25),0 0 8px rgba(255,70,70,.2)}50%{box-shadow:inset 0 0 0 2px rgba(255,70,70,.5),0 0 14px rgba(255,70,70,.45)}}
@keyframes buttonFlash{0%{opacity:0}30%{opacity:.85}100%{opacity:0}}
.maze-wall-n{border-top:2px solid rgba(85,85,85,.95) !important}
.maze-wall-e{border-right:2px solid rgba(85,85,85,.95) !important}
.maze-wall-s{border-bottom:2px solid rgba(85,85,85,.95) !important}
.maze-wall-w{border-left:2px solid rgba(85,85,85,.95) !important}
.stun-badge{background:rgba(255,220,0,.15);border:1px solid rgba(255,220,0,.4);border-radius:5px;padding:1px 6px;font-size:.6rem;color:rgba(255,220,0,.8);margin-left:4px}
.turn-avatar{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(20,16,12,.75);border:1px solid rgba(213,169,62,.45);box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 10px rgba(213,169,62,.2);font-size:1rem}
.board-piece{--piece-glow:rgba(213,169,62,.3);--piece-glow-strong:rgba(213,169,62,.55);--piece-stroke:rgba(213,169,62,.4);width:82%;height:82%;max-width:28px;max-height:28px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.24),rgba(0,0,0,.05));border:1px solid rgba(237,230,207,.32);box-shadow:0 0 0 1px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.6),0 0 12px var(--piece-glow);border-radius:50%;font-size:1em;line-height:1;transform-origin:center 75%;animation:pieceFloat 2.3s ease-in-out infinite,pieceEnter .25s cubic-bezier(.2,.9,.2,1)}
.board-piece.current{box-shadow:0 0 0 1px var(--piece-stroke),0 0 14px var(--piece-glow-strong),0 3px 8px rgba(0,0,0,.72);animation:pieceFloat 1.6s ease-in-out infinite,piecePulse 1.8s ease-in-out infinite,pieceEnter .25s cubic-bezier(.2,.9,.2,1)}
.board-piece.dead{opacity:.35;filter:grayscale(1);animation:none}
.board-piece.mini{width:14px;height:14px;font-size:.56em;animation:pieceEnter .2s ease-out}
@media (max-width: 1020px){
  .game-layout{grid-template-columns:1fr;max-width:760px}
  .sidebar{max-width:none}
  .iso-board.wilderness-board,.iso-board.kingdom-board{transform:none;filter:none}
}
@keyframes pieceEnter{0%{transform:translateY(6px) scale(.6);opacity:0}100%{transform:translateY(0) scale(1);opacity:1}}
@keyframes pieceFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.8px)}}
@keyframes piecePulse{0%,100%{filter:drop-shadow(0 0 0 transparent)}50%{filter:drop-shadow(0 0 8px var(--piece-glow-strong))}}
`;

function ModToggle({ active, icon, label, desc, onClick }) {
  return (
    <div className={`mod-row${active?" on":""}`} onClick={onClick}>
      <div className="mod-chk">{active?"✓":""}</div>
      <div>
        <div className="mod-title">{icon} {label}</div>
        <div className="mod-desc">{desc}</div>
      </div>
    </div>
  );
}

function CharacterCard({ char, chosen, taken, onChoose }) {
  return (
    <div className={`char-card${chosen?" chosen":""}${taken?" taken":""}`}
      style={{ borderColor: chosen ? char.color+"aa" : undefined, boxShadow: chosen ? `0 0 20px ${char.color}44` : undefined }}
      onClick={!taken ? onChoose : undefined}>
      <div className="char-emoji">{char.emoji}</div>
      <div className="char-name">{char.name}</div>
      <div className="char-race">{char.race}</div>
      <div className="char-ability-name">✦ {char.abilityName}</div>
      <div className="char-ability">{char.abilityDesc}</div>
      {chosen && <div style={{marginTop:6,fontSize:".6rem",color:"#F6E6A8",fontFamily:"'Cinzel',serif"}}>✓ Chosen</div>}
      {taken && <div style={{marginTop:6,fontSize:".6rem",color:"rgba(255,100,100,.7)"}}>Taken</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ObryndelMiniGame({ onExit }) {
  // Setup state
  const [phase,        setPhase]        = useState("setup");
  const [playerCount,  setPlayerCount]  = useState(null);
  const [setupPlayer,  setSetupPlayer]  = useState(0);
  const [charChoices,  setCharChoices]  = useState([]);

  // Modifiers
  const [modVanish,  setModVanish]  = useState(false);
  const [modEnemy,   setModEnemy]   = useState(false);
  const [modBW,      setModBW]      = useState(false);
  const [modMaze,    setModMaze]    = useState(false);
  const [modExplore, setModExplore] = useState(false);
  const [modEvents,  setModEvents]  = useState(false);
  const [modColors,  setModColors]  = useState(true);
  const [modChallengeRooms, setModChallengeRooms] = useState(false);
  const [darkRadius, setDarkRadius] = useState(3);
  const [gridSize,   setGridSize]   = useState(10);

  // Game state
  const [grid,        setGrid]        = useState({});
  const [mazeWalls,   setMazeWalls]   = useState(null);
  const [objects,     setObjects]     = useState([]);
  const [vanished,    setVanished]    = useState(new Set());
  const [discoveredCells, setDiscoveredCells] = useState(new Set());
  const [positions,   setPositions]   = useState([]);
  const [inKingdom,   setInKingdom]   = useState([]);
  const [kPositions,  setKPositions]  = useState([]);
  const [curPlayer,   setCurPlayer]   = useState(0);
  const [swFirst,     setSwFirst]     = useState(null);
  const [inventory,   setInventory]   = useState([]);
  const [dropped,     setDropped]     = useState([]);
  const [droppedPos,  setDroppedPos]  = useState([]);
  const [atBase,      setAtBase]      = useState([]);
  const [dead,        setDead]        = useState([]);
  const [stunned,     setStunned]     = useState([]);
  const [enemies,     setEnemies]     = useState([]);
  const [enemyActive, setEnemyActive] = useState(false);
  const [abilityCooldown, setAbilityCooldown] = useState([]);
  const [abilityStepsLeft,setAbilityStepsLeft]= useState(0);
  const [log,         setLog]         = useState([]);
  const [eventCard,   setEventCard]   = useState(null);
  const [allGathered, setAllGathered] = useState(false);
  const [extraMove,   setExtraMove]   = useState(false);
  const [kingdomGrid, setKingdomGrid] = useState({});
  const [challengeState, setChallengeState] = useState(null);
  const [challengeAbilityMode, setChallengeAbilityMode] = useState(false);
  const [challengeAbilityTargets, setChallengeAbilityTargets] = useState(new Set());
  const [challengeAbilityMeta, setChallengeAbilityMeta] = useState({});

  const stateRef = useRef({});
  
  // Update ref for access in callbacks
  useEffect(() => {
    stateRef.current = {
      curPlayer, positions, inKingdom, kPositions, grid, inventory, atBase, dead, stunned,
      dropped, droppedPos, vanished, discoveredCells, enemies, enemyActive, playerCount,
      modBW, modVanish, modEnemy, modMaze, modExplore, modEvents, modColors, modChallengeRooms,
      darkRadius, gridSize, mazeWalls, objects, abilityCooldown,
      abilityStepsLeft, charChoices, extraMove, allGathered, kingdomGrid,
      challengeState, challengeAbilityMode, challengeAbilityTargets, challengeAbilityMeta,
    };
  });

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = fonts + css;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const addLog = useCallback((msg) => {
    setLog(prev => [msg, ...prev].slice(0, 30));
  }, []);

  // ─── FIX: Calculate visibility safely with useMemo ───────────────────────
  const visibleCells = useMemo(() => {
    if (!modExplore) return null;
    if (inKingdom[curPlayer]) return null;
    
    const pos = positions[curPlayer];
    if (!pos) return null;
    
    return bfsVisibleCells(pos, darkRadius, mazeWalls, vanished, gridSize);
  }, [modExplore, curPlayer, positions, inKingdom, darkRadius, mazeWalls, vanished, gridSize]);

  // Update discovered cells in useEffect to avoid render-loop
  useEffect(() => {
    if (!visibleCells) return;
    
    setDiscoveredCells(prev => {
      const next = new Set(prev);
      let changed = false;
      visibleCells.forEach(k => {
        if (!next.has(k)) {
          next.add(k);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [visibleCells]);

  useEffect(() => {
    if (!modChallengeRooms) return;
    setChallengeAbilityMode(false);
    setChallengeAbilityTargets(new Set());
    setChallengeAbilityMeta({});
  }, [curPlayer, modChallengeRooms]);

  // ── Character selection ───────────────────────────────────────────────────
  const beginCharSelect = () => {
    setCharChoices(Array(playerCount).fill(null));
    setSetupPlayer(0);
    setPhase("charselect");
  };

  const chooseChar = (charId) => {
    const next = [...charChoices];
    next[setupPlayer] = charId;
    setCharChoices(next);
    if (setupPlayer < playerCount - 1) {
      setSetupPlayer(setupPlayer + 1);
    } else {
      startGame(next);
    }
  };

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = (chars) => {
    const pc = playerCount;
    const gs = modChallengeRooms ? 10 : gridSize;
    if (modChallengeRooms) setGridSize(10);

    if (modChallengeRooms) {
      const challenge = buildChallengeRoom(chars, pc);
      setGrid(challenge.grid);
      setMazeWalls(null);
      setObjects([
        { id: "challenge-ball", emoji: "⚪", label: "Round Ball", x: challenge.ball.x, y: challenge.ball.y, pullable: true },
        { id: "challenge-button", emoji: "🔘", label: "Stone Button", x: challenge.button.x, y: challenge.button.y, pullable: false },
      ]);
      setKingdomGrid({});
      setChallengeState(challenge);
      setVanished(new Set());
      setDiscoveredCells(new Set());
      setPositions(challenge.startCells.map(p => ({ ...p })));
      setInKingdom(Array(pc).fill(false));
      setKPositions(Array(pc).fill(null));
      setInventory(Array(pc).fill(false));
      setDropped(Array(pc).fill(false));
      setDroppedPos(Array(pc).fill(null));
      setAtBase(Array(pc).fill(false));
      setDead(Array(pc).fill(false));
      setStunned(Array(pc).fill(0));
      setEnemies([]);
      setEnemyActive(false);
      setAbilityCooldown(Array(pc).fill(0));
      setAbilityStepsLeft(0);
      setCurPlayer(0);
      setSwFirst(null);
      setLog([]);
      setEventCard(null);
      setAllGathered(false);
      setExtraMove(false);
      setChallengeAbilityMode(false);
      setChallengeAbilityTargets(new Set());
      setChallengeAbilityMeta({});
      setPhase("game");
      addLog(`Challenge begins with ${pc} scoundrel${pc>1?"s":""}!`);
      addLog("Co-op Ability Challenge: no turns, select any character and solve the puzzle.");
      challenge.instructions.forEach(line => addLog(`• ${line}`));
      return;
    }

    let mWalls = null;
    if (modMaze) {
      mWalls = generateMaze(gs, gs);
      const startCells = getStartCells(gs);
      for (const sc of startCells) {
        for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
          const wk = wallKey(sc.x,sc.y,dx,dy);
          mWalls.delete(wk);
        }
      }
      setMazeWalls(mWalls);
    } else {
      setMazeWalls(null);
    }

    const g = makeGrid(gs, pc, modBW, modMaze, modColors);
    const sc = getStartCells(gs);
    sc.forEach(c => { g[cellKey(c.x,c.y)] = "white"; });

    const ctr = getStartCenter(gs);
    const objs = placeObjects(gs, ctr.x, ctr.y, mWalls, pc);
    setObjects(objs);

    if (modColors) {
      objs.forEach(o => { g[cellKey(o.x, o.y)] = "white"; });
    }

    setGrid(g);
    setKingdomGrid(makeKingdomGrid(gs));
    setVanished(new Set());
    setDiscoveredCells(new Set());

    const starts = getStartCells(gs).slice(0, pc);
    setPositions(starts.map(p => ({...p})));
    setInKingdom(Array(pc).fill(false));
    setKPositions(Array(pc).fill(null));
    setInventory(Array(pc).fill(false));
    setDropped(Array(pc).fill(false));
    setDroppedPos(Array(pc).fill(null));
    setAtBase(Array(pc).fill(false));
    setDead(Array(pc).fill(false));
    setStunned(Array(pc).fill(0));
    setEnemies([]);
    setEnemyActive(false);
    setAbilityCooldown(Array(pc).fill(0));
    setAbilityStepsLeft(0);
    setCurPlayer(0);
    setSwFirst(null);
    setLog([]);
    setEventCard(null);
    setAllGathered(false);
    setExtraMove(false);
    setChallengeState(null);
    setChallengeAbilityMode(false);
    setChallengeAbilityTargets(new Set());
    setChallengeAbilityMeta({});
    setPhase("game");
    addLog(`Quest begins with ${pc} scoundrel${pc>1?"s":""}!`);
    addLog("🏰 Bring all relics to the altar to shatter the barrier sealing Obryndel!");
    if (modMaze) addLog("🏚️ A maze has formed around you…");
    if (modExplore) addLog(`🌑 Exploration mode — you can see ${darkRadius} steps ahead.`);
    if (modEvents) addLog("🃏 Event cards are in play — drawn each turn!");
  };

  // ── Trigger event card ────────────────────────────────────────────────────
  const clearChallengeAbilitySelection = useCallback(() => {
    setChallengeAbilityMode(false);
    setChallengeAbilityTargets(new Set());
    setChallengeAbilityMeta({});
  }, []);

  const isChallengeBlockedCell = useCallback((x, y, cs) => {
    if (!cs) return false;
    if (cs.gap && cs.gap.x === x && cs.gap.y === y) return true;
    if (cs.crackedWall && !cs.crackedWall.broken && cs.crackedWall.x === x && cs.crackedWall.y === y) return true;
    return false;
  }, []);

  const computeChallengeAbilityTargets = useCallback((snapshot = stateRef.current) => {
    const targets = new Set();
    const meta = {};
    if (!snapshot.modChallengeRooms || !snapshot.challengeState) return { targets, meta };

    const cp = snapshot.curPlayer;
    const charId = snapshot.charChoices[cp];
    const pos = snapshot.positions[cp];
    const cs = snapshot.challengeState;
    if (!pos || !charId) return { targets, meta };

    const inBounds = (x, y) => x >= 0 && x < snapshot.gridSize && y >= 0 && y < snapshot.gridSize;
    const occupiedByOthers = new Set(
      snapshot.positions
        .map((p, i) => (i !== cp && p && !snapshot.dead[i] ? cellKey(p.x, p.y) : null))
        .filter(Boolean)
    );
    const addTarget = (x, y, info) => {
      const k = cellKey(x, y);
      targets.add(k);
      meta[k] = info;
    };
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]];

    if (charId === "gribberth") {
      [1, 2].forEach((distance) => {
        dirs.forEach(([dx, dy]) => {
          const tx = pos.x + dx * distance;
          const ty = pos.y + dy * distance;
          if (!inBounds(tx, ty)) return;
          if (isChallengeBlockedCell(tx, ty, cs)) return;
          if (occupiedByOthers.has(cellKey(tx, ty))) return;
          addTarget(tx, ty, { type: "jump", distance, from: { x: pos.x, y: pos.y } });
        });
      });
    } else if (charId === "craglasha") {
      dirs.forEach(([dx, dy]) => {
        const tx = pos.x + dx;
        const ty = pos.y + dy;
        if (!inBounds(tx, ty)) return;
        addTarget(tx, ty, { type: "breakWall" });
      });
    } else if (charId === "brontarox") {
      dirs.forEach(([dx, dy]) => {
        for (let distance = 1; distance <= 4; distance++) {
          const tx = pos.x + dx * distance;
          const ty = pos.y + dy * distance;
          if (!inBounds(tx, ty)) continue;
          addTarget(tx, ty, { type: "throw", distance });
        }
      });
    } else if (charId === "rithea") {
      dirs.forEach(([dx, dy]) => {
        for (let step = 1; step < snapshot.gridSize; step++) {
          const tx = pos.x + dx * step;
          const ty = pos.y + dy * step;
          if (!inBounds(tx, ty)) break;
          if (isChallengeBlockedCell(tx, ty, cs)) break;
          addTarget(tx, ty, { type: "pull" });
          if (snapshot.objects.some(o => o.x === tx && o.y === ty)) break;
        }
      });
    }

    return { targets, meta };
  }, [isChallengeBlockedCell]);

  const openChallengeAbilitySelection = useCallback(() => {
    const result = computeChallengeAbilityTargets(stateRef.current);
    setChallengeAbilityTargets(result.targets);
    setChallengeAbilityMeta(result.meta);
    setChallengeAbilityMode(true);
    if (result.targets.size === 0) addLog("No valid targets for that ability right now.");
  }, [computeChallengeAbilityTargets, addLog]);

  const maybeFinishChallenge = useCallback((nextState) => {
    if (!nextState) return;
    const done = Object.values(nextState.completed || {}).every(Boolean);
    if (!done) return;
    setAllGathered(true);
    addLog("All challenge objectives solved!");
    setTimeout(() => setPhase("victory"), 320);
  }, [addLog, clearChallengeAbilitySelection, openChallengeAbilitySelection]);

  const executeChallengeAbilityAt = useCallback((x, y) => {
    const s = stateRef.current;
    if (!s.modChallengeRooms || !s.challengeState || !s.challengeAbilityMode) return;
    const key = cellKey(x, y);
    const targetMeta = s.challengeAbilityMeta[key];
    if (!targetMeta) return;

    const cp = s.curPlayer;
    const cpPos = s.positions[cp];
    const cpChar = CHARACTERS.find(c => c.id === s.charChoices[cp]);
    let nextCs = { ...s.challengeState, completed: { ...s.challengeState.completed } };
    let used = false;

    if (targetMeta.type === "jump") {
      if (!cpPos) return;
      setPositions(prev => prev.map((p, i) => i === cp ? { x, y } : p));
      const jumpedTwo = Math.abs(cpPos.x - x) + Math.abs(cpPos.y - y) === 2;
      if (jumpedTwo && nextCs.gap) {
        const midX = cpPos.x + Math.sign(x - cpPos.x);
        const midY = cpPos.y + Math.sign(y - cpPos.y);
        if (midX === nextCs.gap.x && midY === nextCs.gap.y) {
          nextCs.completed.goblin = true;
        }
      }
      addLog(`${cpChar?.emoji || "👺"} ${cpChar?.name || PLAYER_NAMES[cp]} jumps ${targetMeta.distance || 1} tile${(targetMeta.distance || 1) > 1 ? "s" : ""}.`);
      used = true;
    }

    if (targetMeta.type === "breakWall") {
      if (nextCs.crackedWall && !nextCs.crackedWall.broken && nextCs.crackedWall.x === x && nextCs.crackedWall.y === y) {
        nextCs.crackedWall = { ...nextCs.crackedWall, broken: true };
        setGrid(prev => ({ ...prev, [cellKey(nextCs.crackedWall.x, nextCs.crackedWall.y)]: "white" }));
        nextCs.completed.orc = true;
        addLog(`${cpChar?.emoji || "👹"} ${cpChar?.name || PLAYER_NAMES[cp]} smashes the cracked wall.`);
      } else {
        addLog(`${cpChar?.emoji || "👹"} ${cpChar?.name || PLAYER_NAMES[cp]} punches the ground. Only cracked walls break.`);
      }
      used = true;
    }

    if (targetMeta.type === "throw") {
      if (nextCs.button && nextCs.button.x === x && nextCs.button.y === y) {
        nextCs.button = { ...nextCs.button, activated: true, flash: true };
        nextCs.completed.cyclops = true;
        addLog(`${cpChar?.emoji || "🌀"} ${cpChar?.name || PLAYER_NAMES[cp]} activates the button with a boulder throw!`);
        setTimeout(() => {
          setChallengeState(prev => {
            if (!prev) return prev;
            return { ...prev, button: { ...prev.button, flash: false } };
          });
        }, 420);
      } else {
        addLog(`${cpChar?.emoji || "🌀"} ${cpChar?.name || PLAYER_NAMES[cp]} hurls a boulder, but only the button reacts.`);
      }
      used = true;
    }

    if (targetMeta.type === "pull") {
      if (!cpPos) return;
      const ballObj = s.objects.find(o => o.id === "challenge-ball");
      if (ballObj && ballObj.x === x && ballObj.y === y) {
        const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
        let destination = null;
        for (const [dx, dy] of dirs) {
          const tx = cpPos.x + dx;
          const ty = cpPos.y + dy;
          if (tx < 0 || tx >= s.gridSize || ty < 0 || ty >= s.gridSize) continue;
          if (isChallengeBlockedCell(tx, ty, s.challengeState)) continue;
          if (s.positions.some((p, i) => i !== cp && p.x === tx && p.y === ty && !s.dead[i])) continue;
          if (s.objects.some(o => o.id !== "challenge-ball" && o.x === tx && o.y === ty)) continue;
          destination = { x: tx, y: ty };
          break;
        }
        if (!destination) {
          addLog("No free adjacent tile to pull the ball into.");
        } else {
          setObjects(prev => prev.map(o => o.id === "challenge-ball" ? { ...o, x: destination.x, y: destination.y } : o));
          nextCs.ball = { x: destination.x, y: destination.y };
          nextCs.completed.witch = true;
          addLog(`${cpChar?.emoji || "🧙"} ${cpChar?.name || PLAYER_NAMES[cp]} pulls the round ball closer.`);
        }
      } else {
        addLog(`${cpChar?.emoji || "🧙"} ${cpChar?.name || PLAYER_NAMES[cp]} casts pull, but only the round ball is affected.`);
      }
      used = true;
    }

    if (!used) return;
    setChallengeState(nextCs);
    clearChallengeAbilitySelection();
    maybeFinishChallenge(nextCs);
  }, [addLog, clearChallengeAbilitySelection, isChallengeBlockedCell, maybeFinishChallenge]);

  const triggerEventCard = useCallback(() => {
    const card = EVENT_CARDS[Math.floor(Math.random()*EVENT_CARDS.length)];
    setEventCard(card);
  }, []);

  const resolveEvent = useCallback(() => {
    const s = stateRef.current;
    const card = eventCard;
    const cp = s.curPlayer;
    setEventCard(null);

    if (card.id === "teleport") {
      let nx,ny;
      for (let i=0;i<200;i++) {
        nx = Math.floor(Math.random()*s.gridSize);
        ny = Math.floor(Math.random()*s.gridSize);
        const k = cellKey(nx,ny);
        if (!s.vanished.has(k) && !s.positions.some((p,pi)=>p.x===nx&&p.y===ny&&pi!==cp)) break;
      }
      const np = [...s.positions]; np[cp]={x:nx,y:ny};
      setPositions(np);
      addLog(`🌀 ${PLAYER_NAMES[cp]} was teleported!`);
      advanceTurnState(cp, s.dead, s.stunned, s.playerCount);
    } else if (card.id === "stun") {
      const ns = [...s.stunned]; ns[cp] = 1;
      setStunned(ns);
      addLog(`💫 ${PLAYER_NAMES[cp]} is stunned next turn!`);
      advanceTurnState(cp, s.dead, s.stunned, s.playerCount);
    } else if (card.id === "motivation") {
      setExtraMove(true);
      addLog(`\u26A1 ${PLAYER_NAMES[cp]} gets an extra move!`);
    }
  }, [eventCard, addLog]);

  const advanceTurnState = (cp, deadArr, stunnedArr, pc) => {
    if (stateRef.current.modChallengeRooms) return;
    let next = (cp+1) % pc;
    let guard = 0;
    while ((deadArr[next]) && guard < pc) { next=(next+1)%pc; guard++; }
    const ns2 = [...stunnedArr];
    if (ns2[next] > 0) {
      addLog(`💫 ${PLAYER_NAMES[next]} is stunned and loses their turn!`);
      ns2[next]--;
      setStunned(ns2);
      let skip = (next+1)%pc; guard=0;
      while (deadArr[skip] && guard<pc) { skip=(skip+1)%pc; guard++; }
      setCurPlayer(skip);
      addLog(`— ${PLAYER_NAMES[skip]}'s turn —`);
    } else {
      setCurPlayer(next);
      addLog(`— ${PLAYER_NAMES[next]}'s turn —`);
    }
    setAbilityCooldown(prev => {
      const n=[...prev]; if(n[next]>0) n[next]--; return n;
    });

    if (stateRef.current.enemyActive) {
      moveEnemies(next);
    }
  };

  // ── Move enemies ──────────────────────────────────────────────────────────
  const moveEnemies = useCallback((nextPlayer) => {
    const s = stateRef.current;
    if (!s.enemyActive) return;

    setEnemies(prev => {
      return prev.map(enemy => {
        if (enemy.stunned > 0) return {...enemy, stunned: enemy.stunned-1};
        if (enemy.fleeing > 0) {
          const nearest = s.positions.reduce((best,p,i)=>{
            if (s.dead[i] || s.inKingdom[i]) return best;
            const d = Math.abs(p.x-enemy.x)+Math.abs(p.y-enemy.y);
            return d < best.d ? {d,p} : best;
          },{d:Infinity,p:null});
          if (nearest.p) {
            const dx = enemy.x - nearest.p.x, dy = enemy.y - nearest.p.y;
            const dirs = [[0,-1],[1,0],[0,1],[-1,0]].sort((a,b)=>{
              const da=Math.abs(a[0]-Math.sign(dx))+Math.abs(a[1]-Math.sign(dy));
              const db=Math.abs(b[0]-Math.sign(dx))+Math.abs(b[1]-Math.sign(dy));
              return da-db;
            });
            for (const [ddx,ddy] of dirs) {
              const nx=enemy.x+ddx, ny=enemy.y+ddy;
              if (nx<0||nx>=s.gridSize||ny<0||ny>=s.gridSize) continue;
              if (s.mazeWalls&&s.mazeWalls.has(wallKey(enemy.x,enemy.y,ddx,ddy))) continue;
              return {...enemy, x:nx, y:ny, fleeing: enemy.fleeing-1};
            }
          }
          return {...enemy, fleeing: enemy.fleeing-1};
        }

        const carriers = s.positions.map((p,i)=>({p,i})).filter(({i})=>s.inventory[i]&&!s.dead[i]&&!s.inKingdom[i]);
        if (carriers.length === 0) return enemy;

        let bestStep=null, bestDist=Infinity;
        for (const {p} of carriers) {
          const step = bfsMaze(enemy, p, s.mazeWalls, s.vanished, s.gridSize, null);
          if (step) {
            const d=Math.abs(p.x-enemy.x)+Math.abs(p.y-enemy.y);
            if (d<bestDist) { bestDist=d; bestStep=step; }
          }
        }
        if (!bestStep) return enemy;
        const newEnemy = {...enemy, x:bestStep.x, y:bestStep.y};

        const caughtIdx = s.positions.findIndex((p,i)=>
          p.x===bestStep.x&&p.y===bestStep.y&&s.inventory[i]&&!s.dead[i]
        );
        if (caughtIdx>=0) {
          setDead(prev=>{const n=[...prev];n[caughtIdx]=true;return n;});
          setInventory(prev=>{const n=[...prev];n[caughtIdx]=false;return n;});
          setDropped(prev=>{const n=[...prev];n[caughtIdx]=true;return n;});
          setDroppedPos(prev=>{const n=[...prev];n[caughtIdx]={x:bestStep.x,y:bestStep.y};return n;});
          addLog(`💀 The Shadow caught ${PLAYER_NAMES[caughtIdx]}! Shard dropped.`);
        }
        return newEnemy;
      });
    });
  }, [addLog]);

  // ── Use ability ───────────────────────────────────────────────────────────
  const useAbility = useCallback(() => {
    const s = stateRef.current;
    const cp = s.curPlayer;
    const charId = s.charChoices[cp];
    const char = CHARACTERS.find(c=>c.id===charId);
    if (!char) return;
    if (!s.modChallengeRooms && s.abilityCooldown[cp] > 0) return;

    const pos = s.positions[cp];
    const gs = s.gridSize;
    let used = false;

    if (s.modChallengeRooms) {
      if (s.challengeAbilityMode) clearChallengeAbilitySelection();
      else openChallengeAbilitySelection();
      return;
    }

    if (charId === "gribberth") {
      setAbilityStepsLeft(3);
      addLog(`${char.emoji} ${PLAYER_NAMES[cp]} activates Quick Toes — 3 steps!`);
      used = true;
    } else if (charId === "craglasha") {
      setEnemies(prev => prev.map(e => {
        const d = Math.abs(e.x-pos.x)+Math.abs(e.y-pos.y);
        if (d<=2) return {...e, fleeing:2};
        return e;
      }));
      addLog(`${char.emoji} Roar of the Mother! Nearby enemies flee!`);
      used = true;
    } else if (charId === "brontarox") {
      let hit = false;
      setEnemies(prev => prev.map(e => {
        const d = Math.abs(e.x-pos.x)+Math.abs(e.y-pos.y);
        if (d<=3 && !hit) { hit=true; return {...e, stunned:2}; }
        return e;
      }));
      addLog(hit ? `${char.emoji} Boulder Throw! Enemy stunned for 2 rounds!` : `${char.emoji} No enemy in range for Boulder Throw!`);
      used = true;
    } else if (charId === "rithea") {
      let hit = false;
      setEnemies(prev => prev.map(e => {
        const d = Math.abs(e.x-pos.x)+Math.abs(e.y-pos.y);
        if (d<=2 && !hit) {
          hit=true;
          return {...e, x:Math.floor(Math.random()*gs), y:Math.floor(Math.random()*gs)};
        }
        return e;
      }));
      addLog(hit ? `${char.emoji} Zap! Enemy teleported away!` : `${char.emoji} No enemy close enough to Zap!`);
      used = true;
    }

    if (used) {
      const nc = [...s.abilityCooldown]; nc[cp] = char.abilityCooldown;
      setAbilityCooldown(nc);
      if (charId !== "gribberth" || s.modChallengeRooms) {
        setSwFirst(null);
        advanceTurnState(cp, s.dead, s.stunned, s.playerCount);
      }
    }
  }, [addLog]);

  // ── WASD handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "game" || eventCard) return;
    const handler = (e) => {
      const key = e.key.toLowerCase();
      const isSpace = e.code === "Space" || key === " ";
      const dirs = { w:[0,-1], a:[-1,0], s:[0,1], d:[1,0] };
      const dir = dirs[key];
      if (!dir && !isSpace) return;
      e.preventDefault();

      const s = stateRef.current;
      const cp = s.curPlayer;
      const gs = s.gridSize;

      if (s.dead[cp]) { addLog(`${PLAYER_NAMES[cp]} is dead!`); return; }

      if (s.modChallengeRooms) {
        if (isSpace) {
          if (s.challengeAbilityMode) clearChallengeAbilitySelection();
          else openChallengeAbilitySelection();
          return;
        }
        if (!dir) return;
        if (!s.challengeState) return;
        if (s.challengeAbilityMode) {
          addLog("Select a red target tile, or press SPACE to cancel ability targeting.");
          return;
        }
        const cs = s.challengeState;
        const cur = s.positions[cp];
        const nx = cur.x + dir[0], ny = cur.y + dir[1];
        if (nx < 0 || nx >= gs || ny < 0 || ny >= gs) { addLog("Wall."); return; }
        if (isChallengeBlockedCell(nx, ny, cs)) { addLog("An obstacle blocks that tile."); return; }
        if (s.positions.some((p, i) => i !== cp && p.x === nx && p.y === ny && !s.dead[i])) {
          addLog("Another character is standing there.");
          return;
        }
        setPositions(prev => prev.map((p, i) => i === cp ? { x: nx, y: ny } : p));
        setSwFirst(null);
        addLog(`${CHARACTERS.find(c => c.id === s.charChoices[cp])?.name || PLAYER_NAMES[cp]} moves.`);
        return;
      }

      if (!dir) return;

      const isInKingdom = s.inKingdom[cp];

      if (isInKingdom) {
        const kpos = s.kPositions[cp];
        const nx = kpos.x + dir[0], ny = kpos.y + dir[1];
        if (nx<0||nx>=gs||ny<0||ny>=KINGDOM_ROWS) {
          if (ny < 0) {
            const wX = kpos.x, wY = gs-1;
            const newInK = [...s.inKingdom]; newInK[cp] = false;
            const newKP = [...s.kPositions]; newKP[cp] = null;
            const newPos = [...s.positions]; newPos[cp] = {x: wX, y: wY};
            setInKingdom(newInK); setKPositions(newKP); setPositions(newPos);
            addLog(`${PLAYER_NAMES[cp]} returned to the wilderness.`);
            advanceTurnState(cp, s.dead, s.stunned, s.playerCount);
          } else {
            addLog("Out of bounds!");
          }
          return;
        }
        const newKP = [...s.kPositions]; newKP[cp] = {x:nx,y:ny};
        setKPositions(newKP);
        addLog(`${PLAYER_NAMES[cp]} moves through Obryndel.`);

        if (ny >= 2) {
          setPhase("victory"); return;
        }

        if (s.abilityStepsLeft > 1) { setAbilityStepsLeft(s.abilityStepsLeft-1); return; }
        else if (s.abilityStepsLeft === 1) { setAbilityStepsLeft(0); }
        if (s.extraMove) { setExtraMove(false); return; }
        advanceTurnState(cp, s.dead, s.stunned, s.playerCount);
        return;
      }

      const cur = s.positions[cp];
      const nx = cur.x + dir[0], ny = cur.y + dir[1];

      if (ny >= gs) {
        if (!s.allGathered) {
          addLog("⚔️ A magical barrier seals the Kingdom of Obryndel! Bring all relics to the altar first."); return;
        }
        const kx = Math.max(0, Math.min(gs-1, cur.x));
        const newInK = [...s.inKingdom]; newInK[cp] = true;
        const newKP = [...s.kPositions]; newKP[cp] = {x:kx, y:0};
        setInKingdom(newInK); setKPositions(newKP);
        addLog(`${PLAYER_NAMES[cp]} enters the Kingdom of Obryndel! \u26A1`);
        if (s.abilityStepsLeft > 1) { setAbilityStepsLeft(s.abilityStepsLeft-1); return; }
        else if (s.abilityStepsLeft === 1) { setAbilityStepsLeft(0); }
        if (s.extraMove) { setExtraMove(false); return; }
        advanceTurnState(cp, s.dead, s.stunned, s.playerCount);
        return;
      }

      if (nx<0||nx>=gs||ny<0) { addLog("Out of bounds!"); return; }
      const nk = cellKey(nx,ny);
      if (s.vanished.has(nk)) { addLog("That tile has crumbled!"); return; }

      if (s.mazeWalls && s.mazeWalls.has(wallKey(cur.x,cur.y,dir[0],dir[1]))) {
        addLog("A wall blocks your path!"); return;
      }

      const cellColor = s.grid[nk];
      if (s.modColors || s.modBW) {
        if (s.modBW) {
          if (cellColor !== "white") { addLog(`${PLAYER_NAMES[cp]} cannot walk on black tiles!`); return; }
        } else if (s.modColors) {
          const myColor = PLAYER_COLORS[cp];
          if (cellColor !== myColor && cellColor !== "white") { addLog(`${PLAYER_NAMES[cp]} can't step on ${cellColor}!`); return; }
        }
      }

      const charId = s.charChoices[cp];
      const isGribberth = charId === "gribberth";
      const enemyAtDest = s.enemies.some(e=>e.x===nx&&e.y===ny&&e.stunned===0&&e.fleeing===0);
      if (enemyAtDest && !isGribberth) { addLog("The Shadow blocks your path!"); return; }

      let newPositions = s.positions.map((p,i)=>i===cp?{x:nx,y:ny}:p);
      let newInventory = [...s.inventory];
      let newDropped = [...s.dropped];
      let newDroppedPos = [...s.droppedPos];
      let newAtBase = [...s.atBase];
      let newDead = [...s.dead];
      let newGrid = s.grid;
      let newVanished = s.vanished;
      let newObjects = s.objects;
      let newEnemyActive = s.enemyActive;
      let msg = `${PLAYER_NAMES[cp]} moved.`;

      if (s.modEnemy) {
        newDead.forEach((isDead, i) => {
          if (isDead && i!==cp && s.positions[i].x===nx && s.positions[i].y===ny) {
            newDead[i]=false; msg+=` 💫 Revived ${PLAYER_NAMES[i]}!`;
          }
        });
      }

      const objIdx = newObjects.findIndex(o=>o.x===nx&&o.y===ny&&!newInventory[cp]);
      if (objIdx>=0) {
        const obj = newObjects[objIdx];
        const myColor = PLAYER_COLORS[cp];
        if (obj.id===myColor) {
          newInventory[cp]=true;
          msg+=` Picked up ${obj.label}! 🎉`;

          if (!newEnemyActive && s.modEnemy) {
            newEnemyActive = true;
            const cx = Math.floor(gs/2);
            setEnemies([{x: cx, y: gs-1, fleeing:0, stunned:0}]);
            setEnemyActive(true);
            addLog("👁️ A Shadow emerges from the Kingdom gates — it hunts those who carry relics!");
          }

          if (s.modVanish) {
            const totalCarried = newInventory.filter(Boolean).length;
            const count = totalCarried * 2;
            const candidates=[];
            for (let y2=0;y2<gs;y2++) for(let x2=0;x2<gs;x2++) {
              const k=cellKey(x2,y2);
              if (isStartCellFn(x2,y2,gs)||newObjects.some(o=>o.x===x2&&o.y===y2)||newVanished.has(k)) continue;
              if (newPositions.some((p,i)=>!newDead[i]&&p.x===x2&&p.y===y2)) continue;
              candidates.push(k);
            }
            const toVanish = candidates.sort(()=>Math.random()-.5).slice(0,count);
            newVanished = new Set([...newVanished,...toVanish]);
            const vg={...newGrid}; toVanish.forEach(k=>{vg[k]="empty";}); newGrid=vg;
            if (toVanish.length) msg+=` ${toVanish.length} tile${toVanish.length>1?"s":""} crumble away…`;
          }
        }
      }

      if (s.modEnemy && newDropped[cp] && !newInventory[cp]) {
        const dp = newDroppedPos[cp];
        if (dp&&dp.x===nx&&dp.y===ny) {
          newInventory[cp]=true; newDropped[cp]=false; newDroppedPos[cp]=null;
          msg+=` Reclaimed your shard! 🎉`;
        }
      }

      if (isStartCellFn(nx,ny,gs) && newInventory[cp] && !newAtBase[cp]) {
        newAtBase[cp]=true;
        newInventory[cp]=false;
        msg+=` ${PLAYER_NAMES[cp]} delivered their relic to the altar! ✨`;
        const myColor = PLAYER_COLORS[cp];
        const sc = getStartCells(gs);
        const startPos = sc[cp % sc.length];
        newObjects = newObjects.map(o => o.id===myColor ? {...o, x:startPos.x, y:startPos.y} : o);
        const totalDone = newAtBase.filter(Boolean).length;
        if (totalDone >= s.playerCount && !s.allGathered) {
          setAllGathered(true);
          addLog("\u26A1 You've gathered all the artifacts to summon the power of the Void! The magic barrier has been shattered! Enter the Kingdom of Obryndel!");
        }
      }

      setPositions(newPositions);
      setInventory(newInventory);
      setDropped(newDropped);
      setDroppedPos(newDroppedPos);
      setAtBase(newAtBase);
      setDead(newDead);
      setGrid(newGrid);
      setVanished(newVanished);
      setObjects(newObjects);
      setSwFirst(null);
      addLog(msg);

      if (s.abilityStepsLeft > 1) {
        setAbilityStepsLeft(s.abilityStepsLeft-1);
        return;
      } else if (s.abilityStepsLeft === 1) {
        setAbilityStepsLeft(0);
      }

      if (s.extraMove) {
        setExtraMove(false);
        return;
      }

      if (s.modEvents) {
        triggerEventCard();
        return;
      }

      advanceTurnState(cp, newDead, s.stunned, s.playerCount);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, eventCard, addLog, triggerEventCard, moveEnemies, clearChallengeAbilitySelection, openChallengeAbilitySelection, isChallengeBlockedCell]);

  // ── Cell click (swap) ─────────────────────────────────────────────────────
  const handleCellClick = useCallback((x, y) => {
    const s = stateRef.current;
    if (phase!=="game"||eventCard) return;
    if (s.modChallengeRooms) {
      if (!s.challengeAbilityMode) return;
      const key = cellKey(x, y);
      if (!s.challengeAbilityTargets.has(key)) return;
      executeChallengeAbilityAt(x, y);
      return;
    }
    if (!s.modColors) return;
    const key=cellKey(x,y);
    if (s.vanished.has(key)) return;
    if (isStartCellFn(x,y,s.gridSize) || s.objects.some(o=>o.x===x&&o.y===y)) {
      addLog("Can't swap that tile."); return;
    }
    if (s.positions.some((p,i)=>!s.dead[i]&&p.x===x&&p.y===y)) {
      addLog("A player is there!"); return;
    }
    if (!swFirst) {
      setSwFirst({x,y}); addLog(`Selected (${x},${y}) — click another to swap.`);
    } else {
      if (swFirst.x===x&&swFirst.y===y) { setSwFirst(null); return; }
      const newGrid={...s.grid};
      const k1=cellKey(swFirst.x,swFirst.y);
      const tmp=newGrid[k1]; newGrid[k1]=newGrid[key]; newGrid[key]=tmp;
      setGrid(newGrid);
      addLog(`${PLAYER_NAMES[s.curPlayer]} swapped tiles.`);
      setSwFirst(null);
      if (s.modEvents) { triggerEventCard(); return; }
      advanceTurnState(s.curPlayer, s.dead, s.stunned, s.playerCount);
    }
  }, [phase, swFirst, eventCard, addLog, triggerEventCard, executeChallengeAbilityAt]);

  const handleDrop = useCallback(() => {
    const s = stateRef.current;
    const cp = s.curPlayer;
    if (!s.inventory[cp]) return;
    const pos = s.positions[cp];
    const ni=[...s.inventory]; ni[cp]=false;
    const nd=[...s.dropped]; nd[cp]=true;
    const ndp=[...s.droppedPos]; ndp[cp]={...pos};
    setInventory(ni); setDropped(nd); setDroppedPos(ndp);
    setSwFirst(null);
    addLog(`${PLAYER_NAMES[cp]} dropped their shard!`);
    advanceTurnState(cp, s.dead, s.stunned, s.playerCount);
  }, [addLog]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  if (phase==="setup") {
    return (
      <div className="og">
        <h1 className="og-title">Obryndel</h1>
        <div className="og-sub">The Shard Cooperative</div>
        <div className="setup-card">
          <h2>Choose Your Scoundrels</h2>
          <div className="pc-opts">
            {[1,2,3,4].map(n=>(
              <button
                key={n}
                className={`pc-btn${playerCount===n?" sel":""}`}
                onClick={()=>!modChallengeRooms&&setPlayerCount(n)}
                disabled={modChallengeRooms}
                style={modChallengeRooms ? { opacity: 0.35, cursor: "not-allowed" } : undefined}
              >
                {n}
              </button>
            ))}
          </div>

          <div style={{borderTop:"1px solid rgba(213,169,62,.08)",paddingTop:16,marginBottom:16}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:3,color:"rgba(180,155,90,.32)",textTransform:"uppercase",marginBottom:11}}>Map Settings</div>
            <div className="slider-row">
              <span className="slider-lbl">Map Size</span>
              <input type="range" min={10} max={20} value={gridSize} disabled={modChallengeRooms} onChange={e=>setGridSize(Number(e.target.value))} />
              <span className="slider-val">{modChallengeRooms ? "10x10" : `${gridSize}x${gridSize}`}</span>
            </div>
            {modExplore && (
              <div className="slider-row">
                <span className="slider-lbl">Vision Range</span>
                <input type="range" min={1} max={8} value={darkRadius} onChange={e=>setDarkRadius(Number(e.target.value))} />
                <span className="slider-val">{darkRadius} steps</span>
              </div>
            )}
          </div>

          <div style={{borderTop:"1px solid rgba(213,169,62,.08)",paddingTop:16,marginBottom:18}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:3,color:"rgba(180,155,90,.32)",textTransform:"uppercase",marginBottom:11}}>Modifiers</div>
            <div className="mods">
              <ModToggle
                active={modChallengeRooms}
                onClick={() => {
                  setModChallengeRooms(v => {
                    const next = !v;
                    if (next) {
                      setModColors(false);
                      setModMaze(false);
                      setModExplore(false);
                      setModVanish(false);
                      setModEnemy(false);
                      setModBW(false);
                      setModEvents(false);
                      setGridSize(10);
                      setPlayerCount(4);
                    } else {
                      setModColors(true);
                    }
                    return next;
                  });
                }}
                icon="🚪"
                label="Ability Challenge"
                desc="10x10 co-op puzzle mode with no turn order: select a hero, move with WASD, press Space to target abilities."
              />
              <ModToggle active={modColors} onClick={()=>!modChallengeRooms&&setModColors(v=>!v)} icon="🎨" label="Colored Tiles" desc="The board is filled with colored tiles. Players may only walk on their own color or white tiles. Click tiles to swap colors and open new paths." />
              <ModToggle active={modMaze} onClick={()=>!modChallengeRooms&&setModMaze(v=>!v)} icon="🏚️" label="Maze" desc="A labyrinth fills the board. Walls block movement and vision. Objects are placed near the edges of the map." />
              <ModToggle active={modExplore} onClick={()=>!modChallengeRooms&&setModExplore(v=>!v)} icon="🌑" label="Exploration Mode" desc="The map is shrouded in darkness. Tiles you've visited stay visible for all players. Discover the world as you venture out." />
              <ModToggle active={modVanish} onClick={()=>!modChallengeRooms&&setModVanish(v=>!v)} icon="💨" label="Vanishing Tiles" desc="Each relic collected causes tiles to crumble. Occupied tiles are always safe." />
              <ModToggle active={modEnemy} onClick={()=>!modChallengeRooms&&setModEnemy(v=>!v)} icon="👁️" label="The Shadow" desc="An enemy spawns at the kingdom entrance when the first relic is picked up. It hunts relic carriers. Allies can revive the fallen." />
              <ModToggle active={modBW} onClick={()=>!modChallengeRooms&&setModBW(v=>!v)} icon="🖤" label="Black & White" desc="Only white tiles may be walked on. Color-swapping carves new paths." />
              <ModToggle active={modEvents} onClick={()=>!modChallengeRooms&&setModEvents(v=>!v)} icon="🃏" label="Event Cards" desc="At the end of every turn, draw an event card! Teleportation traps, stuns, and sudden bursts of speed await…" />
            </div>
          </div>

          <button className="start-btn" disabled={!playerCount} onClick={beginCharSelect}>Choose Characters →</button>
          <div style={{marginTop:14,fontSize:"0.7rem",color:"rgba(180,155,90,.28)",lineHeight:1.8}}>
            {modChallengeRooms
              ? "Co-op Ability Challenge: 10x10 board, no turns. Click a character to control, move with WASD, press Space to target abilities."
              : <>Collect your relic &amp; return to the centre altar.<br/>WASD to move{modColors ? " · Click tiles to swap colors" : ""}.</>}
          </div>
        </div>
      </div>
    );
  }

  if (phase==="charselect") {
    const takenIds = charChoices.filter(Boolean);
    return (
      <div className="og">
        <h1 className="og-title">Obryndel</h1>
        <div className="og-sub">Choose Your Champion</div>
        <div className="setup-card" style={{maxWidth:680}}>
          <h2 style={{color:COLOR_HEX[PLAYER_COLORS[setupPlayer]]}}>
            {PLAYER_EMOJIS[setupPlayer]} {PLAYER_NAMES[setupPlayer]} — Choose Your Character
          </h2>
          <div className="char-select">
            {CHARACTERS.map(char=>(
              <CharacterCard
                key={char.id}
                char={char}
                chosen={charChoices[setupPlayer]===char.id}
                taken={takenIds.includes(char.id)&&charChoices[setupPlayer]!==char.id}
                onChoose={()=>chooseChar(char.id)}
              />
            ))}
          </div>
          <div style={{fontSize:".7rem",color:"rgba(180,155,90,.38)",fontStyle:"italic"}}>
            {setupPlayer < playerCount-1
              ? `After choosing, Player ${setupPlayer+2} will pick their character.`
              : "After choosing, the quest begins!"}
          </div>
        </div>
      </div>
    );
  }

  // ── Game render ────────────────────────────────────────────────────────────
  if (phase==="game"||phase==="victory") {
    const cp = curPlayer;
    const cpColor = PLAYER_COLORS[cp];
    const playerChars = Array.from({ length: playerCount }, (_, i) =>
      CHARACTERS.find(c => c.id === charChoices[i]) || null
    );
    const cpChar = playerChars[cp];
    const challengeAbilityText = {
      gribberth: "Jump 1 or 2 tiles in a cardinal direction.",
      craglasha: "Target one adjacent tile (up, down, left, right); only cracked walls are affected.",
      brontarox: "Throw 1 to 4 tiles in cardinal directions; only the button reacts.",
      rithea: "Target in straight lines until an obstacle blocks line of sight; only the round ball is affected.",
    };
    const challengeObjectiveByChar = {
      gribberth: "goblin",
      craglasha: "orc",
      brontarox: "cyclops",
      rithea: "witch",
    };
    const challengeObjectiveText = {
      goblin: "Jump over the map gap",
      orc: "Break the cracked wall",
      cyclops: "Activate the distant button",
      witch: "Pull the round ball",
    };
    const objectiveForActiveChar = cpChar ? challengeObjectiveByChar[cpChar.id] : null;
    const gs = gridSize;
    const cellPx = Math.max(20, Math.min(44, Math.floor(560/gs)));

    const getPlayerToken = (playerIndex) => {
      const char = playerChars[playerIndex];
      if (char) return char.emoji;
      return PLAYER_NAMES[playerIndex].charAt(0);
    };

    const renderPlayerLayer = (boardType) => {
      const inK = boardType === "kingdom";
      const rows = inK ? KINGDOM_ROWS : gs;
      const groupOffsets = [
        { x: 0, y: 0 },
        { x: -0.2, y: -0.15 },
        { x: 0.2, y: -0.15 },
        { x: -0.2, y: 0.15 },
        { x: 0.2, y: 0.15 },
      ];

      const boardPlayers = [];
      for (let i = 0; i < playerCount; i++) {
        if (inK ? !inKingdom[i] : inKingdom[i]) continue;
        const pos = inK ? kPositions[i] : positions[i];
        if (!pos) continue;
        if (pos.x < 0 || pos.x >= gs || pos.y < 0 || pos.y >= rows) continue;
        boardPlayers.push({ i, x: pos.x, y: pos.y });
      }

      const grouped = {};
      boardPlayers.forEach(p => {
        const k = cellKey(p.x, p.y);
        if (!grouped[k]) grouped[k] = [];
        grouped[k].push(p.i);
      });

      return (
        <div
          className={`actor-layer ${inK ? "kingdom-layer" : "wilderness-layer"}`}
          style={{ width: gs * cellPx, height: rows * cellPx }}
        >
          {boardPlayers.map(p => {
            const g = grouped[cellKey(p.x, p.y)] || [p.i];
            const gIdx = Math.max(0, g.indexOf(p.i));
            const offset = g.length > 1 ? groupOffsets[gIdx % groupOffsets.length] : groupOffsets[0];
            const left = (p.x + 0.5 + offset.x) * cellPx;
            const top = (p.y + 0.5 + offset.y) * cellPx;
            const mini = g.length > 1;

            return (
              <div
                key={`${boardType}-actor-${p.i}`}
                className={`actor-node${p.i===cp?" current":""}${dead[p.i]?" dead":""}${mini?" mini":""}`}
                style={{ left, top }}
              >
                <div className={`board-piece${p.i===cp?" current":""}${dead[p.i]?" dead":""}${mini?" mini":""}`} style={{
                  "--piece-glow": hexToRgba(playerChars[p.i]?.color || COLOR_HEX[PLAYER_COLORS[p.i]], 0.32),
                  "--piece-glow-strong": hexToRgba(playerChars[p.i]?.color || COLOR_HEX[PLAYER_COLORS[p.i]], 0.58),
                  "--piece-stroke": hexToRgba(playerChars[p.i]?.color || COLOR_HEX[PLAYER_COLORS[p.i]], 0.62),
                }}>
                  {getPlayerToken(p.i)}
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    const renderChallengeObjectLayer = () => {
      if (!modChallengeRooms || !challengeState) return null;
      return (
        <div className="actor-layer challenge-object-layer" style={{ width: gs * cellPx, height: gs * cellPx }}>
          {objects.map((obj) => (
            <div
              key={obj.id}
              className="actor-node challenge-obj"
              style={{ left: (obj.x + 0.5) * cellPx, top: (obj.y + 0.5) * cellPx }}
            >
              <div className={`challenge-obj-token${obj.id === "challenge-button" && challengeState.button?.activated ? " active" : ""}${obj.id === "challenge-button" && challengeState.button?.flash ? " flash" : ""}`}>
                {obj.emoji}
              </div>
            </div>
          ))}
        </div>
      );
    };

    const objMapXY = {};
    objects.forEach(o => { objMapXY[cellKey(o.x,o.y)] = o; });

    const renderWilderness = () => {
      return Array.from({length:gs},(_,y)=>
        Array.from({length:gs},(_,x)=>{
          const key = cellKey(x,y);
          const challenge = modChallengeRooms ? challengeState : null;
          const isGapCell = !!(challenge && challenge.gap && challenge.gap.x === x && challenge.gap.y === y);
          const isCrackedWallCell = !!(challenge && challenge.crackedWall && !challenge.crackedWall.broken && challenge.crackedWall.x === x && challenge.crackedWall.y === y);
          const isButtonCell = !!(challenge && challenge.button && challenge.button.x === x && challenge.button.y === y);
          const isAbilityTarget = !!(modChallengeRooms && challengeAbilityMode && challengeAbilityTargets.has(key));
          const color = grid[key]||"empty";
          const isGone = vanished.has(key);
          const isStart = modChallengeRooms
            ? (challenge ? challenge.startCells.some(p=>p.x===x&&p.y===y) : false)
            : isStartCellFn(x,y,gs);
          const isObj = !!objMapXY[key];
          const obj = objMapXY[key];

          let isDark = false, isEdge = false, isDiscovered = false;
          if (modExplore && !inKingdom[cp]) {
            const inView = visibleCells && visibleCells.has(key);
            const playerHere = positions.some((p,i)=>!inKingdom[i]&&p.x===x&&p.y===y);
            isDiscovered = discoveredCells.has(key);
            
            isDark = !inView && !playerHere && !isDiscovered;
            
            if (inView && visibleCells) {
              const d = bfsDist(positions[cp],{x,y},mazeWalls,vanished,gs);
              if (d===darkRadius) isEdge=true;
            }
          }

          const playersHere = positions.map((p,i)=>!inKingdom[i]&&p.x===x&&p.y===y?i:-1).filter(i=>i>=0);
          const enemiesHere = enemyActive ? enemies.filter(e=>e.x===x&&e.y===y) : [];
          const challengeEnemiesHere = [];
          const enemyVisible = (
            (enemiesHere && enemiesHere.length>0) || challengeEnemiesHere.length>0
          ) && (!modExplore || !visibleCells || visibleCells.has(key));
          const droppedHere = dropped.map((d,i)=>{
            const dp=droppedPos[i]; return d&&dp&&dp.x===x&&dp.y===y?i:-1;
          }).filter(i=>i>=0);

          const wallN = mazeWalls && mazeWalls.has(wallKey(x,y,0,-1));
          const wallE = mazeWalls && mazeWalls.has(wallKey(x,y,1,0));
          const wallS = mazeWalls && mazeWalls.has(wallKey(x,y,0,1));
          const wallW = mazeWalls && mazeWalls.has(wallKey(x,y,-1,0));

          const isSwSel = swFirst&&swFirst.x===x&&swFirst.y===y;
          const isSwAble = modColors && !isStart && !isObj && !isGone
            && !positions.some((p,i)=>!dead[i]&&!inKingdom[i]&&p.x===x&&p.y===y)
            && !(enemyActive && enemies.some(e=>e.x===x&&e.y===y));

          const wallClasses = [
            wallN?"maze-wall-n":"", wallE?"maze-wall-e":"",
            wallS?"maze-wall-s":"", wallW?"maze-wall-w":""
          ].filter(Boolean).join(" ");

          const isBottomRow = y === gs-1;
          const cx2 = Math.floor(gs/2);
          const isEntranceCell = isBottomRow && (x===cx2-1||x===cx2);

          return (
            <div
              key={key}
              className={[
                "cell",
                isGone?"gone":"",
                isStart?"start-cell":"",
                isStart?"tile-start-sigil":"",
                isSwAble&&!isDark?"sw-able":"",
                isSwSel?"sw-sel":"",
                isDark?"dark-cell":"",
                isEdge&&!isDark?"dark-edge":"",
                !isDark&&!isGone?`tile-${color}`:"",
                modChallengeRooms && isGapCell ? "tile-hazard-gap" : "",
                modChallengeRooms && isCrackedWallCell ? "tile-hazard-spike" : "",
                isAbilityTarget ? "ab-target" : "",
                wallClasses,
              ].join(" ")}
              style={{
                width:cellPx, height:cellPx,
                background: isDark ? "#080604"
                  : isGone ? "transparent"
                  : modChallengeRooms && isCrackedWallCell ? "rgba(56,44,36,0.95)"
                  : modChallengeRooms && isGapCell ? "radial-gradient(circle at 50% 50%,rgba(0,0,0,.98),rgba(18,10,8,.92))"
                  : color==="black" ? COLOR_BG.black
                  : COLOR_BG[color]||COLOR_BG.empty,
                borderColor: modChallengeRooms && (isCrackedWallCell || isGapCell) ? "rgba(20,20,20,.9)"
                  : isStart?"rgba(237,230,207,.4)"
                  : isEntranceCell&&allGathered?"rgba(213,169,62,.6)"
                  : isObj?"rgba(237,230,207,.2)"
                  : color==="black"?"rgba(255,255,255,.03)"
                  : `${COLOR_HEX[color]||"#1a1510"}22`,
                borderBottom: isEntranceCell ? "none" : "2px solid rgba(85,85,85,.95)",
                boxShadow: isStart ? "0 0 14px rgba(237,230,207,.4)"
                  : isEntranceCell&&allGathered ? "0 0 12px rgba(213,169,62,.4)"
                  : undefined,
                filter: (isDiscovered&&(!visibleCells||!visibleCells.has(key))) ? "brightness(0.38) saturate(0.4)" : undefined,
                fontSize: cellPx<28?"8px":cellPx<36?"10px":"13px",
              }}
              onClick={()=>handleCellClick(x,y)}
            >
              {!modChallengeRooms && isObj && obj && !isGone && !isDark && (
                <span className="obj-token" style={{opacity: inventory[PLAYER_COLORS.indexOf(obj.id)] ? 0.12 : 0.9, filter:"drop-shadow(0 1px 3px rgba(0,0,0,.8))"}}>
                  {obj.emoji}
                </span>
              )}
              {modChallengeRooms && isCrackedWallCell && (
                <span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.86em",opacity:.9}}>🪨</span>
              )}
              {modChallengeRooms && isButtonCell && (
                <span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8em",opacity:.95}}>🔘</span>
              )}
              {modChallengeRooms && isButtonCell && challenge?.button?.flash && (
                <span style={{position:"absolute",inset:0,display:"block",background:"rgba(90,255,120,0.55)",animation:"buttonFlash 420ms ease-out"}} />
              )}
              {isStart && playersHere.length===0 && !enemyVisible && (
                <span style={{fontSize:"0.7em",opacity:.28}}>✦</span>
              )}
              {isEntranceCell && allGathered && playersHere.length===0 && (
                <span style={{fontSize:"0.7em",opacity:.6,filter:"drop-shadow(0 0 4px rgba(213,169,62,.8))"}}>↓</span>
              )}
              {!isDark && droppedHere.map(di=>(
                <span key={di} style={{position:"absolute",top:1,right:1,fontSize:"0.65em",opacity:.8,zIndex:8}}>
                  {OBJECT_DEFS[di].emoji}
                </span>
              ))}
              {enemyVisible && enemiesHere.map((en,ei)=>(
                <div key={ei} className="eby enemy-token" style={{position:"absolute",inset:0,fontSize:"1em",zIndex:20,filter:`drop-shadow(0 0 6px rgba(200,20,20,.95))${en.stunned>0?" grayscale(1)":""}`}}>
                  👁️
                </div>
              ))}
              {modChallengeRooms && challengeEnemiesHere.map((en,ei)=>( 
                <div key={`ce-${ei}`} className="eby enemy-token" style={{position:"absolute",inset:0,fontSize:"1em",zIndex:20,filter:(en.fleeing>0||en.returnIn>0)?"grayscale(1) drop-shadow(0 0 6px rgba(200,20,20,.95))":"drop-shadow(0 0 6px rgba(200,20,20,.95))"}}>
                  👁️
                </div>
              ))}
            </div>
          );
        })
      );
    };

    const renderKingdom = () => {
      const locked = !allGathered;
      const cx = Math.floor(gs/2);
      return Array.from({length:KINGDOM_ROWS},(_,ky)=>
        Array.from({length:gs},(_,kx)=>{
          const key = cellKey(kx,ky);
          const isCastle = kx===cx && ky===Math.floor(KINGDOM_ROWS/2);
          const isEntrance = ky===0 && (kx===cx-1||kx===cx);
          const isTopRow = ky===0;
          const isWall = isTopRow && !isEntrance;

          return (
            <div
              key={key}
              className={`cell kingdom-cell tile-kingdom${locked ? " kingdom-locked" : ""}`}
              style={{
                width:cellPx, height:cellPx,
                background: locked
                  ? isEntrance?"rgba(60,10,80,0.6)"
                    : isTopRow?"rgba(80,20,100,0.9)":"rgba(50,10,70,0.85)"
                  : isEntrance?"rgba(237,220,160,0.45)":"rgba(190,165,100,0.18)",
                borderColor: locked?"rgba(180,80,220,0.35)":"rgba(213,169,62,0.28)",
                borderTop: isEntrance ? "none" : undefined,
                borderTopWidth: isWall ? "2px" : undefined,
                borderTopColor: isWall ? (locked?"rgba(180,80,220,0.8)":"rgba(213,169,62,0.7)") : undefined,
                boxShadow: isEntrance&&!locked
                  ? "inset 0 6px 12px rgba(213,169,62,.15)"
                  : locked&&isTopRow&&!isEntrance?"inset 0 0 10px rgba(180,80,220,0.4)":undefined,
                fontSize: cellPx<28?"8px":cellPx<36?"10px":"13px",
                cursor:"default",
              }}
            >
              {locked && !isEntrance && (
                <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(45deg,rgba(180,80,220,0.08) 0px,rgba(180,80,220,0.08) 2px,transparent 2px,transparent 8px)",pointerEvents:"none",zIndex:1}}/>
              )}
              {locked && isEntrance && kx===cx && (
                <span style={{position:"absolute",fontSize:"1.1em",opacity:.85,zIndex:2,filter:"drop-shadow(0 0 8px rgba(180,80,220,1))"}}>🔒</span>
              )}
              {!locked && isEntrance && (
                <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(237,210,120,.2),transparent)",pointerEvents:"none",zIndex:1}}/>
              )}
              {isCastle && !locked && (
                <span style={{position:"absolute",fontSize:"1.3em",opacity:.9,zIndex:2,filter:"drop-shadow(0 0 8px rgba(213,169,62,1))"}}>🏰</span>
              )}
            </div>
          );
        })
      );
    };

    return (
      <div className="og">
        <h1 className="og-title" style={{fontSize:"clamp(1.1rem,3.5vw,1.8rem)",marginBottom:2}}>Obryndel</h1>
        <div className="og-sub" style={{marginBottom:13}}>The Shard Cooperative</div>

        {eventCard && (
          <div className="event-overlay">
            <div className="event-card">
              <div className="event-icon">{eventCard.icon}</div>
              <div className="event-name">{eventCard.name}</div>
              <div className="event-desc">{eventCard.desc}</div>
              <button className="start-btn" onClick={resolveEvent}>Resolve</button>
            </div>
          </div>
        )}

        {phase==="victory" && (
          <div className="victory-overlay">
            <div className="victory-card">
              <div style={{fontSize:"2.6rem",marginBottom:10}}>{"\u26A1"}</div>
              <div className="v-title">Victory!</div>
              <div className="v-text">
                {modChallengeRooms ? (
                  <>
                    All four co-op objectives are complete.<br/>
                    The room's trial is solved!
                  </>
                ) : (
                  <>
                    All shards forged at the altar.<br/>
                    The Scoundrels of Obryndel have triumphed!<br/><br/>
                    <em>Baron Thobrick's power crumbles...</em>
                  </>
                )}
              </div>
              <button className="start-btn" onClick={()=>{setPhase("setup");setPlayerCount(null);if(onExit)onExit();}}>
                Play Again
              </button>
            </div>
          </div>
        )}

        {allGathered && !modChallengeRooms && (
          <div className="all-gathered-banner" style={{width:"100%",maxWidth:700,marginBottom:8}}>
            You've gathered all the artifacts to summon the power of the Void!<br/>
            The magic barrier has been shattered! Enter the Kingdom of Obryndel to claim victory!
          </div>
        )}

        <div className="game-layout">
          <div className="grid-wrap">
            <div className="grid-container">
              <div className="iso-board wilderness-board">
                <div className="grid grid-wilderness" style={{gridTemplateColumns:`repeat(${gs},${cellPx}px)`,gridTemplateRows:`repeat(${gs},${cellPx}px)`}}>
                  {renderWilderness()}
                </div>
                {renderChallengeObjectLayer()}
                {renderPlayerLayer("wilderness")}
              </div>

              {!modChallengeRooms && (
              <>
              <div style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"3px 0",zIndex:5,position:"relative"}}>
                <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(213,169,62,.4),transparent)"}}/>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:".6rem",letterSpacing:"3px",color:"rgba(213,169,62,.55)",textTransform:"uppercase",whiteSpace:"nowrap"}}>
                  {allGathered ? "\u26A1 Kingdom of Obryndel" : "\u{1F512} Kingdom of Obryndel"}
                </div>
                <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,rgba(213,169,62,.4),transparent)"}}/>
              </div>

              <div className="iso-board kingdom-board">
                <div className="grid grid-kingdom kingdom-grid-outer" style={{gridTemplateColumns:`repeat(${gs},${cellPx}px)`,gridTemplateRows:`repeat(${KINGDOM_ROWS},${cellPx}px)`}}>
                  {renderKingdom()}
                </div>
                {renderPlayerLayer("kingdom")}
              </div>
              </>
              )}
            </div>

            <div className="legend">
              {modColors && !modBW && PLAYER_COLORS.slice(0,playerCount).map(c=>(
                <div className="leg-i" key={c}><div className="leg-d" style={{background:COLOR_HEX[c]}}/><span style={{textTransform:"capitalize"}}>{c}</span></div>
              ))}
              {modColors && modBW && <>
                <div className="leg-i"><div className="leg-d" style={{background:"#e8e2d0",border:"1px solid #888"}}/><span>Walkable</span></div>
                <div className="leg-i"><div className="leg-d" style={{background:"#111"}}/><span>Blocked</span></div>
              </>}
              <div className="leg-i"><div className="leg-d" style={{background:"rgba(237,230,207,.65)",border:"1px solid rgba(237,230,207,.3)"}}/><span>Safe</span></div>
              {modEnemy && enemyActive && <div className="leg-i"><span style={{fontSize:"0.9em"}}>👁️</span><span>The Shadow</span></div>}
              {modVanish && <div className="leg-i"><span style={{fontSize:"0.9em"}}>💨</span><span>{vanished.size} gone</span></div>}
              {modExplore && <div className="leg-i"><span style={{fontSize:"0.9em"}}>🌑</span><span>Vision: {darkRadius}</span></div>}
            </div>
          </div>

          <div className="sidebar">
            <div className="s-card">
              <div className="s-hdr">{modChallengeRooms ? "Active Character" : "Current Turn"}</div>
              {modEnemy&&enemyActive&&inventory[cp]&&(
                <div style={{display:"inline-block",background:"rgba(180,20,20,.28)",border:"1px solid rgba(220,60,60,.28)",borderRadius:6,padding:"2px 8px",fontSize:"0.66rem",color:"rgba(255,120,120,.8)",marginBottom:8}}>
                  👁️ The Shadow hunts you!
                </div>
              )}
              <div className="p-ind">
                <div className="turn-avatar" style={{
                  borderColor: hexToRgba(cpChar?.color || COLOR_HEX[cpColor], 0.72),
                  boxShadow: `0 0 0 1px rgba(0,0,0,.6), 0 0 12px ${hexToRgba(cpChar?.color || COLOR_HEX[cpColor], 0.42)}`
                }}>{getPlayerToken(cp)}</div>
                <div className="p-dot" style={{background:COLOR_HEX[cpColor],boxShadow:`0 0 8px ${COLOR_HEX[cpColor]}`}}/>
                <div className="p-nm">{cpChar?cpChar.name:PLAYER_NAMES[cp]}</div>
                {!modChallengeRooms && inventory[cp]&&<span style={{fontSize:"0.82rem"}} title="Carrying relic">{"\u26A1"}</span>}
                {!modChallengeRooms && dead[cp]&&<span style={{fontSize:"0.7rem",color:"rgba(255,80,80,.7)",marginLeft:4}}>💀 Dead</span>}
                {!modChallengeRooms && stunned[cp]>0&&<span className="stun-badge">💫 Stunned</span>}
                {!modChallengeRooms && abilityStepsLeft>0&&<span style={{fontSize:"0.68rem",color:"rgba(100,255,200,.8)",marginLeft:4}}>{"\u26A1"} {abilityStepsLeft} steps left</span>}
                {!modChallengeRooms && extraMove&&<span style={{fontSize:"0.68rem",color:"rgba(255,220,0,.8)",marginLeft:4}}>{"\u26A1"} Extra move!</span>}
              </div>

              {cpChar && (
                <div style={{padding:"6px 8px",borderRadius:7,background:"rgba(10,20,40,.6)",border:`1px solid ${cpChar.color}33`,marginBottom:7,fontSize:".65rem",color:"rgba(180,210,240,.7)"}}>
                  <span style={{fontFamily:"'Cinzel',serif",color:cpChar.color}}>{modChallengeRooms ? "Challenge Ability" : cpChar.abilityName}</span> - {modChallengeRooms ? challengeAbilityText[cpChar.id] : cpChar.abilityDesc}
                  {!modChallengeRooms&&abilityCooldown[cp]>0&&<span style={{color:"rgba(255,150,100,.7)",marginLeft:6}}>(cooldown: {abilityCooldown[cp]})</span>}
                  {modChallengeRooms && objectiveForActiveChar && challengeState && (
                    <span style={{display:"block",marginTop:6,color:challengeState.completed?.[objectiveForActiveChar] ? "rgba(120,255,165,.86)" : "rgba(245,190,120,.82)"}}>
                      Objective: {challengeObjectiveText[objectiveForActiveChar]} {challengeState.completed?.[objectiveForActiveChar] ? "✓" : "•"}
                    </span>
                  )}
                </div>
              )}

              {!swFirst ? (
                <>
                  <div className="ph-lbl">{modChallengeRooms ? "No turn order - click a character, move with WASD, Space targets abilities." : `WASD to move${modColors ? " | Click tile to swap" : ""}`}</div>
                  <div style={{display:"flex",gap:9,alignItems:"flex-start",marginTop:5}}>
                    <div className="wasd-g" style={{marginTop:0,flexShrink:0}}>
                      <div/><div className="wk">W</div><div/>
                      <div className="wk">A</div><div className="wk">S</div><div className="wk">D</div>
                    </div>
                    {modChallengeRooms ? <div className="sw-hint">{challengeAbilityMode ? "Red outlined tiles are valid ability targets. Click one, or press Space to cancel." : "Press Space to enter ability targeting mode."}</div> : modColors && <div className="sw-hint">Click any open tile to start a color swap.</div>}
                  </div>
                  {modEnemy&&inventory[cp]&&!dead[cp]&&(
                    <button className="drop-btn" onClick={handleDrop}>💧 Drop Relic — stop the Shadow</button>
                  )}
                  {cpChar&&!dead[cp]&&(
                    modChallengeRooms
                      ? <button className="ability-btn" onClick={useAbility}>{challengeAbilityMode ? "Cancel Ability Targeting (Space)" : "Use Ability (Space)"}</button>
                      : abilityCooldown[cp]===0 && <button className="ability-btn" onClick={useAbility}>✦ {cpChar.abilityName}</button>
                  )}
                </>
              ) : (
                <>
                  <div className="ph-lbl" style={{color:"rgba(255,220,80,.72)"}}>Tile selected — click another</div>
                  <div className="sw-hint">Click a second tile to swap, or same tile to cancel.</div>
                </>
              )}
            </div>

            <div className="s-card">
              <div className="s-hdr">Scoundrels</div>
              <div className="p-list">
                {Array.from({length:playerCount},(_,i)=>{
                  const obj = objects[i]||OBJECT_DEFS[i];
                  const hasObj = inventory[i];
                  const isDone = atBase[i];
                  const isDead = dead[i];
                  const hasDrop = dropped[i];
                  const char = CHARACTERS.find(c=>c.id===charChoices[i]);
                  const objectiveId = char ? challengeObjectiveByChar[char.id] : null;
                  const objectiveDone = !!(modChallengeRooms && challengeState && objectiveId && challengeState.completed?.[objectiveId]);
                  return (
                    <div
                      key={i}
                      className={`p-row${i===cp?" cur":""}${(modChallengeRooms ? objectiveDone : isDone)?" done":""}${isDead?" ded":""}`}
                      onClick={modChallengeRooms ? () => setCurPlayer(i) : undefined}
                      style={modChallengeRooms ? {cursor:"pointer"} : undefined}
                      title={modChallengeRooms ? "Click to control this character" : undefined}
                    >
                      <div className="p-ri">{isDead?"💀":char?char.emoji:PLAYER_NAMES[i].charAt(0)}</div>
                      <div style={{flex:1}}>
                        <div className="p-rn" style={{color:COLOR_HEX[PLAYER_COLORS[i]]}}>{char?char.name:PLAYER_NAMES[i]}</div>
                        <div className="p-rs">
                          {modChallengeRooms
                            ? (objectiveId
                              ? `${objectiveDone ? "✓" : "○"} ${challengeObjectiveText[objectiveId]}`
                              : "Objective unavailable.")
                            : (isDead ? "Dead - move onto them to revive"
                              : isDone ? (allGathered ? "Enter the Kingdom of Obryndel!" : "Relic delivered to altar!")
                              : hasObj ? `Carrying ${obj.emoji} - return to the altar!`
                              : hasDrop ? `${obj.emoji} dropped - reclaim it!`
                              : `Seeking ${obj.emoji} ${obj.label}`)}
                        </div>
                        {!modChallengeRooms && abilityCooldown[i]>0&&<div style={{fontSize:".58rem",color:"rgba(100,200,255,.4)"}}>Ability cooldown: {abilityCooldown[i]}</div>}
                        {modChallengeRooms && i !== cp && <div style={{fontSize:".58rem",color:"rgba(140,170,210,.52)"}}>Click to control</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {modChallengeRooms && challengeState && (
              <div className="s-card">
                <div className="s-hdr">Challenge Brief</div>
                <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:"0.68rem",color:"rgba(210,190,140,.72)"}}>
                  {challengeState.instructions.map((line, idx)=>(
                    <div key={`brief-${idx}`}>{line}</div>
                  ))}
                  <div style={{marginTop:5,color:challengeState.completed.goblin ? "rgba(120,255,165,.86)" : "rgba(230,160,120,.72)"}}>
                    {challengeState.completed.goblin ? "✓" : "○"} Gap jump solved
                  </div>
                  <div style={{color:challengeState.completed.orc ? "rgba(120,255,165,.86)" : "rgba(120,200,255,.72)"}}>
                    {challengeState.completed.orc ? "✓" : "○"} Cracked wall destroyed
                  </div>
                  <div style={{color:challengeState.completed.cyclops ? "rgba(120,255,165,.86)" : "rgba(255,140,80,.72)"}}>
                    {challengeState.completed.cyclops ? "✓" : "○"} Button activated by throw
                  </div>
                  <div style={{color:challengeState.completed.witch ? "rgba(120,255,165,.86)" : "rgba(205,170,245,.72)"}}>
                    {challengeState.completed.witch ? "✓" : "○"} Round ball pulled
                  </div>
                </div>
              </div>
            )}

            {(modColors||modVanish||modEnemy||modBW||modMaze||modExplore||modEvents||modChallengeRooms) && (
              <div className="s-card">
                <div className="s-hdr">Active Modifiers</div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {modChallengeRooms && <div style={{fontSize:"0.7rem",color:"rgba(180,180,180,.6)"}}>🚪 Ability Challenge mode</div>}
                  {modColors && <div style={{fontSize:"0.7rem",color:"rgba(213,160,50,.5)"}}>🎨 Colored Tiles + Swapping</div>}
                  {modMaze && <div style={{fontSize:"0.7rem",color:"rgba(200,160,80,.5)"}}>🏚️ Maze is active</div>}
                  {modExplore && <div style={{fontSize:"0.7rem",color:"rgba(150,150,200,.5)"}}>🌑 Exploration — vision {darkRadius} steps</div>}
                  {modVanish && <div style={{fontSize:"0.7rem",color:"rgba(180,155,90,.48)"}}>💨 Vanishing Tiles ({vanished.size} gone)</div>}
                  {modEnemy && <div style={{fontSize:"0.7rem",color:"rgba(255,100,100,.48)"}}>👁️ The Shadow {enemyActive?"is hunting":"awaits first relic"}</div>}
                  {modBW && <div style={{fontSize:"0.7rem",color:"rgba(200,200,200,.38)"}}>🖤 Black &amp; White mode</div>}
                  {modEvents && <div style={{fontSize:"0.7rem",color:"rgba(200,100,220,.48)"}}>🃏 Event Cards active</div>}
                </div>
              </div>
            )}

            <div className="s-card">
              <div className="s-hdr">Event Log</div>
              <div className="log-box">
                {log.map((l,i)=><div key={i}>{l}</div>)}
              </div>
            </div>

            <button className="start-btn" style={{fontSize:"0.76rem",padding:"8px 16px",opacity:.42}}
              onClick={()=>{setPhase("setup");setPlayerCount(null);if(onExit)onExit();}}>
              ← Main Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
