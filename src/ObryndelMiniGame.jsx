import { useState, useEffect, useCallback, useRef } from "react";

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

const EVENT_CARDS = [
  { id: "teleport", icon: "🌀", name: "Teleportation Trap!", desc: "You are teleported to a random location on the map!" },
  { id: "stun",     icon: "💫", name: "Brick to the Head!", desc: "You are stunned and skip your next turn!" },
  { id: "motivation",icon:"⚡", name: "Sudden Motivation!", desc: "You may make one extra move this turn!" },
];

const cellKey = (x, y) => `${x},${y}`;

// ─── Maze generation (Recursive Backtracker) ──────────────────────────────────
function generateMaze(W, H) {
  // Returns set of wall keys between cells
  // Each cell is a node; walls between adjacent cells
  const visited = new Set();
  const walls = new Set();
  // Initialize all walls
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < W-1) walls.add(`${x},${y}|${x+1},${y}`);
      if (y < H-1) walls.add(`${x},${y}|${x},${y+1}`);
    }
  }
  // Carve passages
  const carved = new Set();
  function carve(x, y) {
    visited.add(cellKey(x,y));
    const dirs = [[0,-1],[1,0],[0,1],[-1,0]].sort(()=>Math.random()-0.5);
    for (const [dx,dy] of dirs) {
      const nx=x+dx, ny=y+dy;
      if (nx<0||nx>=W||ny<0||ny>=H) continue;
      if (visited.has(cellKey(nx,ny))) continue;
      // Remove wall between (x,y) and (nx,ny)
      const wk = `${Math.min(x,nx)},${Math.min(y,ny)}|${Math.max(x,nx)},${Math.max(y,ny)}`;
      carved.add(wk);
      carve(nx,ny);
    }
  }
  carve(0,0);
  // walls that remain = walls not carved
  const remaining = new Set([...walls].filter(w => !carved.has(w)));
  return remaining;
}

// Wall between (x,y) and (x+dx,y+dy)
function wallKey(x, y, dx, dy) {
  const nx=x+dx, ny=y+dy;
  return `${Math.min(x,nx)},${Math.min(y,ny)}|${Math.max(x,nx)},${Math.max(y,ny)}`;
}

function hasWall(mazeWalls, x, y, dx, dy) {
  if (!mazeWalls) return false;
  return mazeWalls.has(wallKey(x, y, dx, dy));
}

// BFS respecting maze walls
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

// BFS distance
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
      // Check wall
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

// ─── Place objects near the edges of the wilderness (within 2 squares of edge), reachable ───
function placeObjects(gridSize, startCX, startCY, mazeWalls, playerCount) {
  const centerCell = { x: startCX, y: startCY };
  const placed = [];
  const usedKeys = new Set();
  // Reserve start area
  for (let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) {
    usedKeys.add(cellKey(startCX+dx, startCY+dy));
  }

  // Wilderness rows only (exclude kingdom rows at bottom)
  const wildernessRows = gridSize - KINGDOM_ROWS;

  // A cell is "near edge" if within 2 of top/left/right border, or within 2 of wilderness bottom
  const isNearEdge = (x, y) =>
    x <= 1 || x >= gridSize-2 || y <= 1 || y >= wildernessRows-2;

  for (let i = 0; i < playerCount; i++) {
    const candidates = [];
    for (let y=0; y<wildernessRows; y++) {
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
    if (!best) {
      for (const c of candidates) {
        const d = bfsDist(centerCell, c, mazeWalls, new Set(), gridSize);
        if (d < Infinity) { best = c; break; }
      }
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

  const totalRows = gridSize; // kingdom rows are the bottom KINGDOM_ROWS of gridSize
  for (let y = 0; y < totalRows; y++) {
    for (let x = 0; x < gridSize; x++) {
      // Kingdom rows are always white
      if (isKingdomCell(y, gridSize)) {
        grid[cellKey(x,y)] = "white";
      } else {
        grid[cellKey(x,y)] = colors[Math.floor(Math.random()*colors.length)];
      }
    }
  }
  return grid;
}

// Kingdom occupies the bottom KINGDOM_ROWS rows of the unified grid
const KINGDOM_ROWS = 4;

// Start area is at the bottom center of the wilderness (just above kingdom)
function getStartCenter(gridSize) {
  return { x: Math.floor(gridSize/2), y: gridSize - KINGDOM_ROWS - 1 };
}

function getStartCells(gridSize) {
  const cx = Math.floor(gridSize/2);
  const cy = gridSize - KINGDOM_ROWS - 1;
  // 2x2 block centered on cx,cy (entrance row + one above)
  return [
    {x:cx-1, y:cy-1}, {x:cx, y:cy-1},
    {x:cx-1, y:cy},   {x:cx, y:cy},
  ];
}

function isStartCellFn(x, y, gridSize) {
  const cx = Math.floor(gridSize/2);
  const cy = gridSize - KINGDOM_ROWS - 1;
  return (x===cx-1||x===cx) && (y===cy-1||y===cy);
}

// Kingdom rows: bottom KINGDOM_ROWS rows of the grid
function isKingdomCell(y, gridSize) {
  return y >= gridSize - KINGDOM_ROWS;
}

// The barrier row is the first kingdom row
function isBarrierRow(y, gridSize) {
  return y === gridSize - KINGDOM_ROWS;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const fonts = `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');`;
const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#050304}
.og{min-height:100vh;background:radial-gradient(ellipse 900px 500px at 50% 0%,rgba(140,80,20,.07),transparent),linear-gradient(180deg,#060404 0%,#0a0608 100%);font-family:'Crimson Pro',Georgia,serif;color:#EDE6CF;display:flex;flex-direction:column;align-items:center;padding:24px 16px 48px;user-select:none}
h1.og-title{font-family:'Cinzel',serif;font-size:clamp(1.6rem,5vw,3rem);font-weight:900;color:#F6E6A8;letter-spacing:8px;text-transform:uppercase;text-shadow:0 0 40px rgba(220,180,70,.15);margin-bottom:4px}
.og-sub{font-family:'Cinzel',serif;font-size:.75rem;letter-spacing:4px;color:rgba(180,155,90,.45);text-transform:uppercase;margin-bottom:24px}
.setup-card{background:linear-gradient(180deg,rgba(36,24,18,.9),rgba(6,4,3,.9));border:1px solid rgba(213,169,62,.12);border-radius:16px;padding:30px 38px;text-align:center;box-shadow:0 28px 100px rgba(0,0,0,.85);max-width:600px;width:100%}
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
.game-layout{display:flex;gap:18px;align-items:flex-start;width:100%;max-width:1200px;flex-wrap:wrap;justify-content:center}
.grid-wrap{position:relative;flex-shrink:0}
.grid-container{display:flex;flex-direction:column;gap:4px;align-items:center}
.grid{display:grid;gap:0;background:rgba(0,0,0,.8);border:1px solid rgba(213,169,62,.12);border-radius:10px;padding:4px;box-shadow:0 20px 80px rgba(0,0,0,.8)}
.kingdom-separator{width:100%;display:flex;align-items:center;gap:12px;padding:6px 0}
.kingdom-sep-line{flex:1;height:1px;background:linear-gradient(90deg,transparent,rgba(213,169,62,.5),transparent)}
.kingdom-sep-text{font-family:'Cinzel',serif;font-size:.65rem;letter-spacing:3px;color:rgba(213,169,62,.6);text-transform:uppercase;white-space:nowrap}
.kingdom-grid{display:grid;gap:0;background:rgba(80,50,20,.15);border:1px solid rgba(213,169,62,.3);border-radius:10px;padding:4px;box-shadow:0 0 30px rgba(213,169,62,.08)}
.kingdom-locked{opacity:.3;filter:grayscale(1)}
.kingdom-unlocked{animation:kingdomReveal 1s ease}
@keyframes kingdomReveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.cell{position:relative;display:flex;align-items:center;justify-content:center;font-size:clamp(9px,1.5vw,15px);cursor:default;transition:transform 80ms ease,opacity 350ms ease;border:1px solid rgba(0,0,0,.3);overflow:hidden}
.cell.gone{opacity:0;pointer-events:none}
.cell.sw-able{cursor:pointer;outline:2px dashed rgba(255,255,255,.2);outline-offset:-3px}
.cell.sw-able:hover{transform:scale(1.07);z-index:2}
.cell.sw-sel{outline:2px solid rgba(255,220,80,.9);outline-offset:-2px;box-shadow:0 0 14px rgba(255,220,80,.4);transform:scale(1.09);z-index:3}
.cell.start-cell{box-shadow:0 0 14px rgba(237,230,207,.4)}
.cell.kingdom-cell{border-color:rgba(213,169,62,.3) !important}
.cell.kingdom-barrier{cursor:not-allowed}
.cell.dark-cell{background:#0a0806 !important;border-color:rgba(0,0,0,.8) !important}
.cell.dark-edge{filter:brightness(0.45)}
.cell-wall-top{border-top:2px solid rgba(255,220,120,.7) !important}
.cell-wall-right{border-right:2px solid rgba(255,220,120,.7) !important}
.cell-wall-bottom{border-bottom:2px solid rgba(255,220,120,.7) !important}
.cell-wall-left{border-left:2px solid rgba(255,220,120,.7) !important}
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
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
.maze-wall-n{border-top:2px solid rgba(200,160,80,.8) !important}
.maze-wall-e{border-right:2px solid rgba(200,160,80,.8) !important}
.maze-wall-s{border-bottom:2px solid rgba(200,160,80,.8) !important}
.maze-wall-w{border-left:2px solid rgba(200,160,80,.8) !important}
.stun-badge{background:rgba(255,220,0,.15);border:1px solid rgba(255,220,0,.4);border-radius:5px;padding:1px 6px;font-size:.6rem;color:rgba(255,220,0,.8);margin-left:4px}
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
  const [phase,        setPhase]        = useState("setup"); // setup | charselect | game | victory
  const [playerCount,  setPlayerCount]  = useState(null);
  const [setupPlayer,  setSetupPlayer]  = useState(0); // which player is picking char
  const [charChoices,  setCharChoices]  = useState([]); // char id per player

  // Modifiers
  const [modVanish,  setModVanish]  = useState(false);
  const [modEnemy,   setModEnemy]   = useState(false);
  const [modBW,      setModBW]      = useState(false);
  const [modMaze,    setModMaze]    = useState(false);
  const [modDark,    setModDark]    = useState(false);
  const [modEvents,  setModEvents]  = useState(false);
  const [modColors,  setModColors]  = useState(true); // colored tiles + swapping
  const [darkRadius, setDarkRadius] = useState(3);
  const [gridSize,   setGridSize]   = useState(10);

  // Game state
  const [grid,        setGrid]        = useState({});
  const [mazeWalls,   setMazeWalls]   = useState(null);
  const [objects,     setObjects]     = useState([]); // [{id,emoji,label,x,y}]
  const [vanished,    setVanished]    = useState(new Set());
  const [positions,   setPositions]   = useState([]);
  const [curPlayer,   setCurPlayer]   = useState(0);
  const [swFirst,     setSwFirst]     = useState(null);
  const [inventory,   setInventory]   = useState([]);
  const [dropped,     setDropped]     = useState([]);
  const [droppedPos,  setDroppedPos]  = useState([]);
  const [atBase,      setAtBase]      = useState([]);
  const [dead,        setDead]        = useState([]);
  const [stunned,     setStunned]     = useState([]); // rounds remaining
  const [enemies,     setEnemies]     = useState([]); // [{x,y,fleeing:0,stunned:0}]
  const [enemyActive, setEnemyActive] = useState(false);
  const [abilityCooldown, setAbilityCooldown] = useState([]); // turns remaining
  const [abilityStepsLeft,setAbilityStepsLeft]= useState(0); // Gribberth extra steps
  const [log,         setLog]         = useState([]);
  const [eventCard,   setEventCard]   = useState(null); // current event to show
  const [eventQueue,  setEventQueue]  = useState([]);
  const [allGathered, setAllGathered] = useState(false);
  const [kingdomUnlocked, setKingdomUnlocked] = useState(false);
  const [extraMove,   setExtraMove]   = useState(false);
  const [kingdomGrid, setKingdomGrid] = useState({});

  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = {
      curPlayer, positions, grid, inventory, atBase, dead, stunned,
      dropped, droppedPos, vanished, enemies, enemyActive, playerCount,
      modBW, modVanish, modEnemy, modMaze, modDark, modEvents, modColors,
      darkRadius, gridSize, mazeWalls, objects, abilityCooldown,
      abilityStepsLeft, charChoices, extraMove, allGathered, kingdomGrid,
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

  // Compute visibility for current player
  const computeVisible = useCallback((playerIdx, posArr, mWalls, gs, dr) => {
    if (!stateRef.current.modDark) return null; // null = all visible
    const pos = posArr[playerIdx];
    return bfsVisibleCells(pos, dr, mWalls, new Set(), gs);
  }, []);

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
    const gs = gridSize;
    let mWalls = null;
    if (modMaze) {
      mWalls = generateMaze(gs, gs);
      // Open up start area walls
      const startCells = getStartCells(gs);
      for (const sc of startCells) {
        for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
          const wk = wallKey(sc.x,sc.y,dx,dy);
          mWalls.delete(wk);
        }
      }
      // Open walls in kingdom rows so they're freely traversable
      for (let y = gs - KINGDOM_ROWS; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
            mWalls.delete(wallKey(x,y,dx,dy));
          }
        }
      }
      setMazeWalls(mWalls);
    } else {
      setMazeWalls(null);
    }

    const g = makeGrid(gs, pc, modBW, modMaze, modColors);
    // Force start area white
    const sc = getStartCells(gs);
    sc.forEach(c => { g[cellKey(c.x,c.y)] = "white"; });

    const ctr = getStartCenter(gs);
    const objs = placeObjects(gs, ctr.x, ctr.y, mWalls, pc);
    setObjects(objs);

    // When colored tiles are active, object cells must be white (walkable by all)
    if (modColors) {
      objs.forEach(o => { g[cellKey(o.x, o.y)] = "white"; });
    }

    setGrid(g);
    setKingdomGrid({}); // no longer used separately
    setVanished(new Set());

    const starts = getStartCells(gs).slice(0, pc);
    setPositions(starts.map(p => ({...p})));
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
    setEventQueue([]);
    setAllGathered(false);
    setKingdomUnlocked(false);
    setExtraMove(false);
    setPhase("game");
    addLog(`Quest begins with ${pc} scoundrel${pc>1?"s":""}!`);
    addLog("🏰 Bring all relics to the altar to shatter the barrier sealing Obryndel!");
    if (modMaze) addLog("🏚️ A maze has formed around you…");
    if (modDark) addLog(`🌑 Darkness falls — you can see ${darkRadius} steps.`);
    if (modEvents) addLog("🃏 Event cards are in play…");
  };

  // ── Trigger event card ────────────────────────────────────────────────────
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
      // Teleport to random open cell
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
    } else if (card.id === "stun") {
      const ns = [...s.stunned]; ns[cp] = 1;
      setStunned(ns);
      addLog(`💫 ${PLAYER_NAMES[cp]} is stunned next turn!`);
      // Advance turn
      advanceTurn(cp, s.dead, [...s.stunned], s.playerCount);
    } else if (card.id === "motivation") {
      setExtraMove(true);
      addLog(`⚡ ${PLAYER_NAMES[cp]} gets an extra move!`);
    }
  }, [eventCard, addLog]);

  const advanceTurn = (cp, deadArr, stunnedArr, pc) => {
    let next = (cp+1) % pc;
    let guard = 0;
    while ((deadArr[next]) && guard < pc) { next=(next+1)%pc; guard++; }
    // Apply stun
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
    // Tick cooldowns
    setAbilityCooldown(prev => {
      const n=[...prev]; if(n[next]>0) n[next]--; return n;
    });
    // Tick enemy
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
          // Move away from nearest player
          const nearest = s.positions.reduce((best,p,i)=>{
            if (s.dead[i]) return best;
            const d = Math.abs(p.x-enemy.x)+Math.abs(p.y-enemy.y);
            return d < best.d ? {d,p} : best;
          },{d:Infinity,p:null});
          if (nearest.p) {
            // Move opposite direction
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

        // Hunt shard carriers
        const carriers = s.positions.map((p,i)=>({p,i})).filter(({i})=>s.inventory[i]&&!s.dead[i]);
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

        // Check catch
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
    if (!char || s.abilityCooldown[cp] > 0) return;

    const pos = s.positions[cp];
    const gs = s.gridSize;
    let used = false;

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
      if (charId !== "gribberth") {
        // Advance turn for non-movement abilities
        setSwFirst(null);
        advanceTurnState(cp, s.dead, s.stunned, s.playerCount);
      }
    }
  }, [addLog]);

  const advanceTurnState = (cp, deadArr, stunnedArr, pc) => {
    let next = (cp+1) % pc;
    let guard = 0;
    while (deadArr[next] && guard < pc) { next=(next+1)%pc; guard++; }
    const ns2 = [...stunnedArr];
    if (ns2[next] > 0) {
      addLog(`💫 ${PLAYER_NAMES[next]} is stunned!`);
      ns2[next]--;
      setStunned(ns2);
      let skip=(next+1)%pc; guard=0;
      while(deadArr[skip]&&guard<pc){skip=(skip+1)%pc;guard++;}
      setCurPlayer(skip);
      addLog(`— ${PLAYER_NAMES[skip]}'s turn —`);
    } else {
      setCurPlayer(next);
      addLog(`— ${PLAYER_NAMES[next]}'s turn —`);
    }
    setAbilityCooldown(prev => {
      const n=[...prev]; if(n[next]>0) n[next]--; return n;
    });
    if (stateRef.current.enemyActive) moveEnemies(next);
  };

  // ── WASD handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "game" || eventCard) return;
    const handler = (e) => {
      const dirs = { w:[0,-1], a:[-1,0], s:[0,1], d:[1,0] };
      const dir = dirs[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();

      const s = stateRef.current;
      const cp = s.curPlayer;
      const gs = s.gridSize;

      if (s.dead[cp]) { addLog(`${PLAYER_NAMES[cp]} is dead!`); return; }

      const cur = s.positions[cp];
      const nx = cur.x + dir[0], ny = cur.y + dir[1];

      if (nx<0||nx>=gs||ny<0||ny>=gs) { addLog("Out of bounds!"); return; }
      const nk = cellKey(nx,ny);
      if (s.vanished.has(nk)) { addLog("That tile has crumbled!"); return; }

      // Block entry into kingdom rows until barrier is shattered
      if (isKingdomCell(ny, gs) && !s.allGathered) {
        addLog("⚔️ A magical barrier seals the Kingdom of Obryndel! Bring all relics to the altar first."); return;
      }

      // Check maze wall
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

      // Check if Gribberth can pass enemy (sprint)
      const charId = s.charChoices[cp];
      const isGribberth = charId === "gribberth";
      const enemyAtDest = s.enemies.some(e=>e.x===nx&&e.y===ny&&e.stunned===0&&e.fleeing===0);
      if (enemyAtDest && !isGribberth) { addLog("The Shadow blocks your path!"); return; }

      // Apply move
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
      let newEnemies = s.enemies;
      let msg = `${PLAYER_NAMES[cp]} moved.`;

      // Revive dead allies
      if (s.modEnemy) {
        newDead.forEach((isDead, i) => {
          if (isDead && i!==cp && s.positions[i].x===nx && s.positions[i].y===ny) {
            newDead[i]=false; msg+=` 💫 Revived ${PLAYER_NAMES[i]}!`;
          }
        });
      }

      // Pick up object from map
      const objIdx = newObjects.findIndex(o=>o.x===nx&&o.y===ny&&!newInventory[cp]);
      if (objIdx>=0) {
        const obj = newObjects[objIdx];
        const myColor = PLAYER_COLORS[cp];
        if (obj.id===myColor) {
          newInventory[cp]=true;
          msg+=` Picked up ${obj.label}! 🎉`;

          // Spawn enemy on first pickup
          if (!newEnemyActive && s.modEnemy) {
            newEnemyActive = true;
            const ectr = getStartCenter(gs);
            newEnemies = [{x:ectr.x+2,y:ectr.y+2,fleeing:0,stunned:0}];
            setEnemyActive(true);
            setEnemies(newEnemies);
            addLog("👁️ A Shadow awakens — it hunts those who carry relics!");
          }

          // Event card on pickup
          if (s.modEvents) {
            triggerEventCard();
          }

          // Vanish tiles
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

      // Reclaim dropped shard
      if (s.modEnemy && newDropped[cp] && !newInventory[cp]) {
        const dp = newDroppedPos[cp];
        if (dp&&dp.x===nx&&dp.y===ny) {
          newInventory[cp]=true; newDropped[cp]=false; newDroppedPos[cp]=null;
          msg+=` Reclaimed your shard! 🎉`;
        }
      }

      // Return to base with shard
      if (isStartCellFn(nx,ny,gs) && newInventory[cp] && !newAtBase[cp]) {
        newAtBase[cp]=true;
        newInventory[cp]=false;
        msg+=` ${PLAYER_NAMES[cp]} delivered their relic to the altar! ✨`;
        const totalDone = newAtBase.filter(Boolean).length;
        if (totalDone >= s.playerCount && !s.allGathered) {
          setAllGathered(true);
          setKingdomUnlocked(true);
          addLog("⚡ You've gathered all the artifacts to summon the power of the Void! The magic barrier has been shattered! Enter the Kingdom of Obryndel!");
        }
      }

      // Victory: all relics delivered AND at least one player has entered the kingdom
      if (newAtBase.filter(Boolean).length >= s.playerCount) {
        const anyInKingdom = newPositions.some((p,i) => !newDead[i] && isKingdomCell(p.y, gs));
        if (anyInKingdom) {
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
          setPhase("victory");
          return;
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
      setSwFirst(null);
      addLog(msg);

      // Handle Gribberth extra steps
      if (s.abilityStepsLeft > 1) {
        setAbilityStepsLeft(s.abilityStepsLeft-1);
        return; // don't advance turn
      } else if (s.abilityStepsLeft === 1) {
        setAbilityStepsLeft(0);
      }

      // Handle extra move from motivation card
      if (s.extraMove) {
        setExtraMove(false);
        return;
      }

      // Don't advance if event card is pending
      if (s.modEvents && eventCard) return;

      // Advance turn
      advanceTurnState(cp, newDead, s.stunned, s.playerCount);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, eventCard, addLog, triggerEventCard, moveEnemies]);

  // ── Cell click (swap) ─────────────────────────────────────────────────────
  const handleCellClick = useCallback((x, y) => {
    const s = stateRef.current;
    if (phase!=="game"||eventCard) return;
    if (!s.modColors) return; // swapping only available with colored tiles
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
      advanceTurnState(s.curPlayer, s.dead, s.stunned, s.playerCount);
    }
  }, [phase, swFirst, eventCard, addLog]);

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
            {[2,3,4].map(n=>(
              <button key={n} className={`pc-btn${playerCount===n?" sel":""}`} onClick={()=>setPlayerCount(n)}>{n}</button>
            ))}
          </div>

          {/* Map Size */}
          <div style={{borderTop:"1px solid rgba(213,169,62,.08)",paddingTop:16,marginBottom:16}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:3,color:"rgba(180,155,90,.32)",textTransform:"uppercase",marginBottom:11}}>Map Settings</div>
            <div className="slider-row">
              <span className="slider-lbl">Map Size</span>
              <input type="range" min={10} max={20} value={gridSize} onChange={e=>setGridSize(Number(e.target.value))} />
              <span className="slider-val">{gridSize}×{gridSize}</span>
            </div>
            {modDark && (
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
              <ModToggle active={modColors} onClick={()=>setModColors(v=>!v)} icon="🎨" label="Colored Tiles" desc="The board is filled with colored tiles. Players may only walk on their own color or white tiles. Click tiles to swap colors and open new paths." />
              <ModToggle active={modMaze} onClick={()=>setModMaze(v=>!v)} icon="🏚️" label="Maze" desc="A labyrinth fills the board. Walls block movement and vision. Objects are placed near the edges of the map." />
              <ModToggle active={modDark} onClick={()=>setModDark(v=>!v)} icon="🌑" label="Darkness" desc="Players can only see N steps ahead. Vision is blocked by maze walls. Enemy only visible when in your field of view." />
              <ModToggle active={modVanish} onClick={()=>setModVanish(v=>!v)} icon="💨" label="Vanishing Tiles" desc="Each relic collected causes tiles to crumble. Occupied tiles are always safe." />
              <ModToggle active={modEnemy} onClick={()=>setModEnemy(v=>!v)} icon="👁️" label="The Shadow" desc="An enemy spawns when the first relic is picked up. It hunts relic carriers. Allies can revive the fallen." />
              <ModToggle active={modBW} onClick={()=>setModBW(v=>!v)} icon="🖤" label="Black & White" desc="Only white tiles may be walked on. Color-swapping carves new paths." />
              <ModToggle active={modEvents} onClick={()=>setModEvents(v=>!v)} icon="🃏" label="Event Cards" desc="Random events trigger when you pick up a relic! Teleportation traps, stuns, and sudden bursts of speed await…" />
            </div>
          </div>

          <button className="start-btn" disabled={!playerCount} onClick={beginCharSelect}>Choose Characters →</button>
          <div style={{marginTop:14,fontSize:"0.7rem",color:"rgba(180,155,90,.28)",lineHeight:1.8}}>
            Collect your relic &amp; return to the centre altar.<br/>WASD to move{modColors ? " · Click tiles to swap colors" : ""}.
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
    const cpChar = CHARACTERS.find(c=>c.id===charChoices[cp]);
    const gs = gridSize;
    const cellPx = Math.max(20, Math.min(44, Math.floor(560/gs)));

    // Compute visible cells for dark mode
    let visibleCells = null;
    if (modDark) {
      // Union of all living players' visibility
      // But each player only sees during THEIR turn
      const pos = positions[cp];
      if (pos) {
        visibleCells = bfsVisibleCells(pos, darkRadius, mazeWalls, vanished, gs);
        // Always show other players' positions regardless
      }
    }

    // Build object map for quick lookup
    const objMapXY = {};
    objects.forEach(o => { objMapXY[cellKey(o.x,o.y)] = o; });

    const renderGrid = () => {
      return Array.from({length:gs},(_,y)=>
        Array.from({length:gs},(_,x)=>{
          const key = cellKey(x,y);
          const color = grid[key]||"empty";
          const isGone = vanished.has(key);
          const isStart = isStartCellFn(x,y,gs);
          const isKingdom = isKingdomCell(y,gs);
          const isBarrier = !allGathered && isKingdom; // visually sealed
          const isObj = !!objMapXY[key];
          const obj = objMapXY[key];

          // Dark mode visibility
          let isDark = false, isEdge = false;
          if (modDark && visibleCells) {
            isDark = !visibleCells.has(key);
            if (positions.some(p=>p.x===x&&p.y===y)) isDark=false;
            if (!isDark && visibleCells.has(key)) {
              const d = bfsDist({x:positions[cp].x,y:positions[cp].y},{x,y},mazeWalls,vanished,gs);
              if (d===darkRadius) isEdge=true;
            }
          }

          const playersHere = positions.map((p,i)=>p.x===x&&p.y===y?i:-1).filter(i=>i>=0);
          const enemiesHere = enemyActive && enemies.filter(e=>e.x===x&&e.y===y);
          const enemyVisible = enemiesHere && enemiesHere.length>0 && (!modDark || (visibleCells && visibleCells.has(key)));
          const droppedHere = dropped.map((d,i)=>{
            const dp=droppedPos[i]; return d&&dp&&dp.x===x&&dp.y===y?i:-1;
          }).filter(i=>i>=0);

          // Maze walls (none in kingdom rows since we cleared them)
          const wallN = mazeWalls && mazeWalls.has(wallKey(x,y,0,-1));
          const wallE = mazeWalls && mazeWalls.has(wallKey(x,y,1,0));
          const wallS = mazeWalls && mazeWalls.has(wallKey(x,y,0,1));
          const wallW = mazeWalls && mazeWalls.has(wallKey(x,y,-1,0));

          const isSwSel = swFirst&&swFirst.x===x&&swFirst.y===y;
          const isSwAble = modColors && !isKingdom && !isStart && !isObj && !isGone
            && !positions.some((p,i)=>!dead[i]&&p.x===x&&p.y===y)
            && !(enemyActive && enemies.some(e=>e.x===x&&e.y===y));

          const wallClasses = [
            wallN?"maze-wall-n":"", wallE?"maze-wall-e":"",
            wallS?"maze-wall-s":"", wallW?"maze-wall-w":""
          ].filter(Boolean).join(" ");

          // Kingdom cell styling
          const kingdomBg = isBarrier
            ? "rgba(60,10,80,0.85)"   // sealed: dark purple
            : "rgba(213,185,120,0.25)"; // open: warm gold-white
          const kingdomBorder = isBarrier
            ? "rgba(180,80,220,0.4)"
            : "rgba(213,169,62,0.35)";

          // Castle icon in center of kingdom
          const isCastleCell = isKingdom && x===Math.floor(gs/2) && y===gs-Math.floor(KINGDOM_ROWS/2)-1;

          return (
            <div
              key={key}
              className={[
                "cell",
                isGone?"gone":"",
                isStart?"start-cell":"",
                isKingdom?"kingdom-cell":"",
                isBarrier?"kingdom-barrier":"",
                isSwAble&&!isDark?"sw-able":"",
                isSwSel?"sw-sel":"",
                isDark&&!isKingdom?"dark-cell":"",
                isEdge&&!isDark&&!isKingdom?"dark-edge":"",
                wallClasses,
              ].join(" ")}
              style={{
                width:cellPx, height:cellPx,
                background: (isDark&&!isKingdom) ? "#080604"
                  : isGone ? "transparent"
                  : isKingdom ? kingdomBg
                  : color==="black" ? COLOR_BG.black
                  : COLOR_BG[color]||COLOR_BG.empty,
                borderColor: isKingdom ? kingdomBorder
                  : isStart?"rgba(237,230,207,.4)"
                  : isObj?"rgba(237,230,207,.2)"
                  : color==="black"?"rgba(255,255,255,.03)"
                  : `${COLOR_HEX[color]||"#1a1510"}22`,
                boxShadow: isStart ? "0 0 14px rgba(237,230,207,.4)"
                  : isBarrier ? "inset 0 0 8px rgba(180,80,220,0.3)"
                  : isKingdom&&!isBarrier ? "inset 0 0 6px rgba(213,169,62,0.15)"
                  : undefined,
                fontSize: cellPx<28?"8px":cellPx<36?"10px":"13px",
              }}
              onClick={()=>handleCellClick(x,y)}
            >
              {/* Barrier shimmer overlay */}
              {isBarrier && !isDark && (
                <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(45deg,rgba(180,80,220,0.08) 0px,rgba(180,80,220,0.08) 2px,transparent 2px,transparent 8px)",pointerEvents:"none",zIndex:1}}/>
              )}
              {/* Barrier rune */}
              {isBarrier && x===Math.floor(gs/2) && y===gs-KINGDOM_ROWS && (
                <span style={{position:"absolute",fontSize:"1.1em",opacity:.5,zIndex:2,filter:"drop-shadow(0 0 4px rgba(180,80,220,0.9))"}}>🔒</span>
              )}
              {/* Castle icon */}
              {isCastleCell && !isBarrier && (
                <span style={{position:"absolute",fontSize:"1.2em",opacity:.85,zIndex:2,filter:"drop-shadow(0 0 6px rgba(213,169,62,0.9))"}}>🏰</span>
              )}
              {/* Object icon */}
              {isObj && obj && !isGone && !isDark && (
                <span style={{opacity: inventory[PLAYER_COLORS.indexOf(obj.id)] ? 0.12 : 0.9, filter:"drop-shadow(0 1px 3px rgba(0,0,0,.8))"}}>
                  {obj.emoji}
                </span>
              )}
              {isStart && playersHere.length===0 && !enemyVisible && (
                <span style={{fontSize:"0.7em",opacity:.28}}>✦</span>
              )}
              {/* Dropped shards */}
              {!isDark && droppedHere && droppedHere.map(di=>(
                <span key={di} style={{position:"absolute",top:1,right:1,fontSize:"0.65em",opacity:.8,zIndex:8}}>
                  {OBJECT_DEFS[di].emoji}
                </span>
              ))}
              {/* Enemy */}
              {enemyVisible && enemiesHere.map((en,ei)=>(
                <div key={ei} className="eby" style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1em",zIndex:20,filter:`drop-shadow(0 0 6px rgba(200,20,20,.95))${en.stunned>0?" grayscale(1)":""}`}}>
                  👁️
                </div>
              ))}
              {/* Players */}
              {playersHere.map(pi=>(
                <div key={pi} style={{
                  position:"absolute",
                  fontSize:playersHere.length>1?"0.7em":"0.95em",
                  ...(playersHere.length>1
                    ?{top:pi%2===0?"1px":undefined,bottom:pi%2===1?"1px":undefined,left:Math.floor(pi/2)===0?"1px":undefined,right:Math.floor(pi/2)===1?"1px":undefined}
                    :{inset:0,display:"flex",alignItems:"center",justifyContent:"center"}),
                  display:"flex",alignItems:"center",justifyContent:"center",
                  zIndex:10,
                  opacity:dead[pi] ? 0.25 : 1,
                  filter:dead[pi]?"grayscale(1)":"drop-shadow(0 1px 4px rgba(0,0,0,.9))",
                }}>
                  {cpChar&&pi===cp?cpChar.emoji:PLAYER_EMOJIS[pi]}
                </div>
              ))}
            </div>
          );
        })
      );
    };

    return (
      <div className="og">
        <h1 className="og-title" style={{fontSize:"clamp(1.1rem,3.5vw,1.8rem)",marginBottom:2}}>Obryndel</h1>
        <div className="og-sub" style={{marginBottom:13}}>The Shard Cooperative</div>

        {/* Event card overlay */}
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

        {/* Victory overlay */}
        {phase==="victory" && (
          <div className="victory-overlay">
            <div className="victory-card">
              <div style={{fontSize:"2.6rem",marginBottom:10}}>⚡</div>
              <div className="v-title">Victory!</div>
              <div className="v-text">
                All shards forged at the altar.<br/>
                The Scoundrels of Obryndel have triumphed!<br/><br/>
                <em>Baron Thobrick's power crumbles…</em>
              </div>
              <button className="start-btn" onClick={()=>{setPhase("setup");setPlayerCount(null);if(onExit)onExit();}}>
                Play Again
              </button>
            </div>
          </div>
        )}

        {allGathered && (
          <div className="all-gathered-banner" style={{width:"100%",maxWidth:700,marginBottom:8}}>
            ⚡ You've gathered all the artifacts to summon the power of the Void!<br/>
            The magic barrier has been shattered! Enter the Kingdom of Obryndel to claim victory!
          </div>
        )}

        <div className="game-layout">
          {/* Grid area */}
          <div className="grid-wrap">
            <div className="grid-container">
              {/* Unified grid — kingdom rows are at the bottom */}
              <div className="grid" style={{gridTemplateColumns:`repeat(${gs},${cellPx}px)`,gridTemplateRows:`repeat(${gs},${cellPx}px)`}}>
                {renderGrid()}
              </div>
            </div>

            {/* Legend */}
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
              {modDark && <div className="leg-i"><span style={{fontSize:"0.9em"}}>🌑</span><span>Vision: {darkRadius}</span></div>}
            </div>
          </div>

          {/* Sidebar */}
          <div className="sidebar">
            {/* Turn card */}
            <div className="s-card">
              <div className="s-hdr">Current Turn</div>
              {modEnemy&&enemyActive&&inventory[cp]&&(
                <div style={{display:"inline-block",background:"rgba(180,20,20,.28)",border:"1px solid rgba(220,60,60,.28)",borderRadius:6,padding:"2px 8px",fontSize:"0.66rem",color:"rgba(255,120,120,.8)",marginBottom:8}}>
                  👁️ The Shadow hunts you!
                </div>
              )}
              <div className="p-ind">
                <div className="p-dot" style={{background:COLOR_HEX[cpColor],boxShadow:`0 0 8px ${COLOR_HEX[cpColor]}`}}/>
                <div className="p-nm">{cpChar?cpChar.name:PLAYER_NAMES[cp]}</div>
                {inventory[cp]&&<span style={{fontSize:"0.82rem"}} title="Carrying relic">⚡</span>}
                {dead[cp]&&<span style={{fontSize:"0.7rem",color:"rgba(255,80,80,.7)",marginLeft:4}}>💀 Dead</span>}
                {stunned[cp]>0&&<span className="stun-badge">💫 Stunned</span>}
                {abilityStepsLeft>0&&<span style={{fontSize:"0.68rem",color:"rgba(100,255,200,.8)",marginLeft:4}}>⚡ {abilityStepsLeft} steps left</span>}
                {extraMove&&<span style={{fontSize:"0.68rem",color:"rgba(255,220,0,.8)",marginLeft:4}}>⚡ Extra move!</span>}
              </div>

              {cpChar && (
                <div style={{padding:"6px 8px",borderRadius:7,background:"rgba(10,20,40,.6)",border:`1px solid ${cpChar.color}33`,marginBottom:7,fontSize:".65rem",color:"rgba(180,210,240,.7)"}}>
                  <span style={{fontFamily:"'Cinzel',serif",color:cpChar.color}}>{cpChar.abilityName}</span> — {cpChar.abilityDesc}
                  {abilityCooldown[cp]>0&&<span style={{color:"rgba(255,150,100,.7)",marginLeft:6}}>(cooldown: {abilityCooldown[cp]})</span>}
                </div>
              )}

              {!swFirst ? (
                <>
                  <div className="ph-lbl">WASD to move{modColors ? " · Click tile to swap" : ""}</div>
                  <div style={{display:"flex",gap:9,alignItems:"flex-start",marginTop:5}}>
                    <div className="wasd-g" style={{marginTop:0,flexShrink:0}}>
                      <div/><div className="wk">W</div><div/>
                      <div className="wk">A</div><div className="wk">S</div><div className="wk">D</div>
                    </div>
                    {modColors && <div className="sw-hint">Click any open tile to start a color swap.</div>}
                  </div>
                  {modEnemy&&inventory[cp]&&!dead[cp]&&(
                    <button className="drop-btn" onClick={handleDrop}>💧 Drop Relic — stop the Shadow</button>
                  )}
                  {cpChar&&abilityCooldown[cp]===0&&!dead[cp]&&(
                    <button className="ability-btn" onClick={useAbility}>✦ {cpChar.abilityName}</button>
                  )}
                </>
              ) : (
                <>
                  <div className="ph-lbl" style={{color:"rgba(255,220,80,.72)"}}>Tile selected — click another</div>
                  <div className="sw-hint">Click a second tile to swap, or same tile to cancel.</div>
                </>
              )}
            </div>

            {/* Scoundrels list */}
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
                  return (
                    <div key={i} className={`p-row${i===cp?" cur":""}${isDone?" done":""}${isDead?" ded":""}`}>
                      <div className="p-ri">{isDead?"💀":char?char.emoji:PLAYER_EMOJIS[i]}</div>
                      <div style={{flex:1}}>
                        <div className="p-rn" style={{color:COLOR_HEX[PLAYER_COLORS[i]]}}>{char?char.name:PLAYER_NAMES[i]}</div>
                        <div className="p-rs">
                          {isDead?"Dead — move onto them to revive"
                          :isDone?(allGathered?"⚔️ Enter the Kingdom of Obryndel!":"✓ Relic delivered to altar!")
                          :hasObj?`Carrying ${obj.emoji} — return to the altar!`
                          :hasDrop?`${obj.emoji} dropped — reclaim it!`
                          :`Seeking ${obj.emoji} ${obj.label}`}
                        </div>
                        {abilityCooldown[i]>0&&<div style={{fontSize:".58rem",color:"rgba(100,200,255,.4)"}}>Ability cooldown: {abilityCooldown[i]}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active modifiers */}
            {(modColors||modVanish||modEnemy||modBW||modMaze||modDark||modEvents) && (
              <div className="s-card">
                <div className="s-hdr">Active Modifiers</div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {modColors && <div style={{fontSize:"0.7rem",color:"rgba(213,160,50,.5)"}}>🎨 Colored Tiles + Swapping</div>}
                  {modMaze && <div style={{fontSize:"0.7rem",color:"rgba(200,160,80,.5)"}}>🏚️ Maze is active</div>}
                  {modDark && <div style={{fontSize:"0.7rem",color:"rgba(150,150,200,.5)"}}>🌑 Darkness — vision {darkRadius} steps</div>}
                  {modVanish && <div style={{fontSize:"0.7rem",color:"rgba(180,155,90,.48)"}}>💨 Vanishing Tiles ({vanished.size} gone)</div>}
                  {modEnemy && <div style={{fontSize:"0.7rem",color:"rgba(255,100,100,.48)"}}>👁️ The Shadow {enemyActive?"is hunting":"awaits first relic"}</div>}
                  {modBW && <div style={{fontSize:"0.7rem",color:"rgba(200,200,200,.38)"}}>🖤 Black &amp; White mode</div>}
                  {modEvents && <div style={{fontSize:"0.7rem",color:"rgba(200,100,220,.48)"}}>🃏 Event Cards active</div>}
                </div>
              </div>
            )}

            {/* Log */}
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
