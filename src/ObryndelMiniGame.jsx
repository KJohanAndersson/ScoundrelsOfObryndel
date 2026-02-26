import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as THREE from "three";

// ─── Constants ────────────────────────────────────────────────────────────────
const PLAYER_COLORS = ["red", "blue", "yellow", "green"];
const PLAYER_NAMES  = ["Red", "Blue", "Yellow", "Green"];
const PLAYER_EMOJIS = ["🔴", "🔵", "🟡", "🟢"];
const COLOR_HEX = {
  red:"#c0392b", blue:"#2980b9", yellow:"#d4a01a", green:"#27ae60",
  white:"#c8b896", black:"#1a1218", empty:"#050304",
};
const COLOR_THREE = {
  red:0xc0392b, blue:0x2980b9, yellow:0xd4a01a, green:0x27ae60,
  white:0xc8b896, black:0x1a1218, empty:0x050304,
};
const CHAR_COLORS = {
  gribberth:0x5ab832, craglasha:0x9b4020, brontarox:0x7878a8, rithea:0xb030c0,
};
const OBJECT_DEFS = [
  { id:"red",    label:"Red Shard"     },
  { id:"blue",   label:"Blue Orb"      },
  { id:"yellow", label:"Yellow Scroll" },
  { id:"green",  label:"Green Root"    },
];
const CHARACTERS = [
  { id:"gribberth", name:"Gribberth Twelvetoe", race:"Goblin", abilityName:"Quick Toes", abilityDesc:"Move three steps this turn.", abilityCooldown:3, color:"#5ab832" },
  { id:"craglasha",  name:"Craglasha Rawrolgh",  race:"Orc",    abilityName:"Roar of the Mother", abilityDesc:"Enemies within 2 flee for 2 rounds.", abilityCooldown:3, color:"#9b4020" },
  { id:"brontarox",  name:"Brontarox of Mt Lroth",race:"Cyclops",abilityName:"Boulder Throw", abilityDesc:"Stun enemy within 3 for 2 rounds.", abilityCooldown:3, color:"#7878a8" },
  { id:"rithea",     name:"Rithea Wartwaggle",    race:"Witch",  abilityName:"Zap!", abilityDesc:"Teleport enemy within 2 to random location.", abilityCooldown:3, color:"#b030c0" },
];
const EVENT_CARDS = [
  { id:"teleport", icon:"🌀", name:"Teleportation Trap!", desc:"You are teleported!" },
  { id:"stun",     icon:"💫", name:"Brick to the Head!", desc:"Skip your next turn!" },
  { id:"motivation",icon:"⚡",name:"Sudden Motivation!", desc:"One extra move this turn!" },
];

const cellKey=(x,y)=>`${x},${y}`;
function wallKey(x,y,dx,dy){const nx=x+dx,ny=y+dy;return`${Math.min(x,nx)},${Math.min(y,ny)}|${Math.max(x,nx)},${Math.max(y,ny)}`;}

// ─── Maze ─────────────────────────────────────────────────────────────────────
function generateMaze(W,H){
  const visited=new Set(),walls=new Set();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(x<W-1)walls.add(`${x},${y}|${x+1},${y}`);if(y<H-1)walls.add(`${x},${y}|${x},${y+1}`);}
  const carved=new Set();
  function carve(x,y){visited.add(cellKey(x,y));const dirs=[[0,-1],[1,0],[0,1],[-1,0]].sort(()=>Math.random()-.5);for(const[dx,dy]of dirs){const nx=x+dx,ny=y+dy;if(nx<0||nx>=W||ny<0||ny>=H||visited.has(cellKey(nx,ny)))continue;carved.add(`${Math.min(x,nx)},${Math.min(y,ny)}|${Math.max(x,nx)},${Math.max(y,ny)}`);carve(nx,ny);}}
  carve(0,0);return new Set([...walls].filter(w=>!carved.has(w)));
}
function bfsDist(from,to,mazeWalls,vanishedSet,gridSize){
  const q=[[from.x,from.y,0]],vis=new Set([cellKey(from.x,from.y)]);
  while(q.length){const[cx,cy,d]=q.shift();if(cx===to.x&&cy===to.y)return d;for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){const nx=cx+dx,ny=cy+dy;if(nx<0||nx>=gridSize||ny<0||ny>=gridSize)continue;const nk=cellKey(nx,ny);if(vis.has(nk)||vanishedSet?.has(nk)||mazeWalls?.has(wallKey(cx,cy,dx,dy)))continue;vis.add(nk);q.push([nx,ny,d+1]);}}return Infinity;
}
function bfsMaze(from,to,mazeWalls,vanishedSet,gridSize){
  const q=[[from.x,from.y,null]],vis=new Set([cellKey(from.x,from.y)]);
  while(q.length){const[cx,cy,first]=q.shift();for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){const nx=cx+dx,ny=cy+dy;if(nx<0||nx>=gridSize||ny<0||ny>=gridSize)continue;const nk=cellKey(nx,ny);if(vis.has(nk)||vanishedSet?.has(nk)||mazeWalls?.has(wallKey(cx,cy,dx,dy)))continue;vis.add(nk);const step=first||{x:nx,y:ny};if(nx===to.x&&ny===to.y)return step;q.push([nx,ny,step]);}}return null;
}
function bfsVisible(from,dist,mazeWalls,vanishedSet,gridSize){
  const vis=new Set([cellKey(from.x,from.y)]),q=[[from.x,from.y,0]],seen=new Set([cellKey(from.x,from.y)]);
  while(q.length){const[cx,cy,d]=q.shift();if(d>=dist)continue;for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]]){const nx=cx+dx,ny=cy+dy;if(nx<0||nx>=gridSize||ny<0||ny>=gridSize)continue;const nk=cellKey(nx,ny);if(seen.has(nk)||mazeWalls?.has(wallKey(cx,cy,dx,dy)))continue;seen.add(nk);vis.add(nk);q.push([nx,ny,d+1]);}}return vis;
}
function placeObjects(gs,cx,cy,mazeWalls,pc){
  const center={x:cx,y:cy},placed=[],used=new Set();
  for(let dy=-2;dy<=0;dy++)for(let dx=-2;dx<=2;dx++){const px=cx+dx,py=cy+dy;if(px>=0&&px<gs&&py>=0&&py<gs)used.add(cellKey(px,py));}
  const isEdge=(x,y)=>x<=1||x>=gs-2||y<=1||y>=gs-2;
  for(let i=0;i<pc;i++){
    const cands=[];for(let y=0;y<gs;y++)for(let x=0;x<gs;x++){const k=cellKey(x,y);if(!used.has(k)&&isEdge(x,y))cands.push({x,y});}
    cands.sort(()=>Math.random()-.5);let best=null;
    for(const c of cands){if(bfsDist(center,c,mazeWalls,new Set(),gs)<Infinity){best=c;break;}}
    if(best){placed.push({...OBJECT_DEFS[i],x:best.x,y:best.y});used.add(cellKey(best.x,best.y));}
  }
  return placed;
}
function makeGrid(gs,pc,bw,hasMaze,hasColors){
  const g={};const colors=!hasColors?["white"]:bw?["white","black"]:PLAYER_COLORS.slice(0,pc);
  for(let y=0;y<gs;y++)for(let x=0;x<gs;x++)g[cellKey(x,y)]=colors[Math.floor(Math.random()*colors.length)];
  return g;
}
const KINGDOM_ROWS=5;
function getStartCenter(gs){return{x:Math.floor(gs/2),y:gs-1};}
function getStartCells(gs){const cx=Math.floor(gs/2),cy=gs-1;return[{x:cx-1,y:cy-1},{x:cx,y:cy-1},{x:cx-1,y:cy},{x:cx,y:cy}];}
function isStartCellFn(x,y,gs){const cx=Math.floor(gs/2),cy=gs-1;return(x===cx-1||x===cx)&&(y===cy-1||y===cy);}
function makeKingdomGrid(gs){const kg={};for(let y=0;y<KINGDOM_ROWS;y++)for(let x=0;x<gs;x++)kg[cellKey(x,y)]="white";return kg;}

function buildChallengeRoom(chars,pc){
  const gs=10,grid={};for(let y=0;y<gs;y++)for(let x=0;x<gs;x++)grid[cellKey(x,y)]="white";
  const laneByChar={gribberth:2,craglasha:4,brontarox:6,rithea:8},defaultLanes=[2,4,6,8],secondRow=1;
  const gap={x:2,y:secondRow},crackedWall={x:4,y:secondRow,broken:false},button={x:6,y:secondRow,activated:false,flash:false},ball={x:8,y:secondRow};
  grid[cellKey(gap.x,gap.y)]="empty";grid[cellKey(crackedWall.x,crackedWall.y)]="black";
  const startY=gs-1,usedLanes=new Set();
  const startCells=Array.from({length:pc},(_,i)=>{const preferred=laneByChar[chars?.[i]];let lane=preferred;if(lane==null||usedLanes.has(lane))lane=defaultLanes.find(v=>!usedLanes.has(v))??i+1;usedLanes.add(lane);return{x:lane,y:startY};});
  return{grid,startCells,gap,crackedWall,button,ball,completed:{goblin:false,orc:false,cyclops:false,witch:false},
    instructions:["Click scoundrel to control","WASD moves, SPACE targets ability","Goblin: jump 1-2 tiles","Orc: punch cracked wall","Cyclops: throw boulder at button","Witch: beam to pull round ball"]};
}

// ─── 3D Scene Builder ─────────────────────────────────────────────────────────
const TILE_SIZE = 1.0;
const TILE_HEIGHT = 0.18;
const WALL_H = 0.55;

function hexColor(hex){ return new THREE.Color(hex); }

// Low-poly character builders
function buildGoblin(scene, color){
  const grp = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({color:c});
  const skinC = color||0x5ab832, darkC=0x2a5010, eyeC=0xffffff, pupilC=0x102008;
  // legs
  const legG=new THREE.BoxGeometry(0.09,0.18,0.09);
  const l1=new THREE.Mesh(legG,mat(skinC));l1.position.set(-0.07,-0.22,0);grp.add(l1);
  const l2=new THREE.Mesh(legG,mat(skinC));l2.position.set(0.07,-0.22,0);grp.add(l2);
  // feet
  const footG=new THREE.BoxGeometry(0.1,0.05,0.13);
  const f1=new THREE.Mesh(footG,mat(0x1a0a00));f1.position.set(-0.07,-0.32,0.02);grp.add(f1);
  const f2=new THREE.Mesh(footG,mat(0x1a0a00));f2.position.set(0.07,-0.32,0.02);grp.add(f2);
  // body
  const bodyG=new THREE.BoxGeometry(0.22,0.22,0.18);
  const body=new THREE.Mesh(bodyG,mat(skinC));body.position.set(0,-0.02,0);grp.add(body);
  // arms
  const armG=new THREE.BoxGeometry(0.07,0.18,0.07);
  const a1=new THREE.Mesh(armG,mat(skinC));a1.position.set(-0.15,-0.02,0);grp.add(a1);
  const a2=new THREE.Mesh(armG,mat(skinC));a2.position.set(0.15,-0.02,0);grp.add(a2);
  // hands
  const handG=new THREE.SphereGeometry(0.05,5,4);
  const h1=new THREE.Mesh(handG,mat(skinC));h1.position.set(-0.15,-0.12,0);grp.add(h1);
  const h2=new THREE.Mesh(handG,mat(skinC));h2.position.set(0.15,-0.12,0);grp.add(h2);
  // neck
  const neckG=new THREE.CylinderGeometry(0.05,0.06,0.07,6);
  const neck=new THREE.Mesh(neckG,mat(skinC));neck.position.set(0,0.13,0);grp.add(neck);
  // head
  const headG=new THREE.BoxGeometry(0.2,0.18,0.18);
  const head=new THREE.Mesh(headG,mat(skinC));head.position.set(0,0.25,0);grp.add(head);
  // ears (points)
  const earG=new THREE.ConeGeometry(0.04,0.1,4);
  const e1=new THREE.Mesh(earG,mat(skinC));e1.position.set(-0.12,0.3,0);e1.rotation.z=Math.PI/2*-1;grp.add(e1);
  const e2=new THREE.Mesh(earG,mat(skinC));e2.position.set(0.12,0.3,0);e2.rotation.z=Math.PI/2;grp.add(e2);
  // eyes
  const eyeG=new THREE.BoxGeometry(0.055,0.055,0.02);
  const ey1=new THREE.Mesh(eyeG,mat(eyeC));ey1.position.set(-0.055,0.27,0.09);grp.add(ey1);
  const ey2=new THREE.Mesh(eyeG,mat(eyeC));ey2.position.set(0.055,0.27,0.09);grp.add(ey2);
  const pupG=new THREE.BoxGeometry(0.03,0.03,0.02);
  const p1=new THREE.Mesh(pupG,mat(pupilC));p1.position.set(-0.055,0.27,0.1);grp.add(p1);
  const p2=new THREE.Mesh(pupG,mat(pupilC));p2.position.set(0.055,0.27,0.1);grp.add(p2);
  // hat brim
  const brimG=new THREE.BoxGeometry(0.28,0.03,0.24);
  const brim=new THREE.Mesh(brimG,mat(darkC));brim.position.set(0,0.35,0);grp.add(brim);
  // hat top
  const hatG=new THREE.BoxGeometry(0.18,0.14,0.16);
  const hat=new THREE.Mesh(hatG,mat(darkC));hat.position.set(0,0.45,0);grp.add(hat);
  return grp;
}

function buildOrc(scene, color){
  const grp=new THREE.Group();
  const mat=(c)=>new THREE.MeshLambertMaterial({color:c});
  const skinC=color||0x9b4020, darkC=0x2a0800, toothC=0xf0e8d0, eyeC=0xd03010;
  // thick legs
  const legG=new THREE.BoxGeometry(0.13,0.2,0.13);
  const l1=new THREE.Mesh(legG,mat(skinC));l1.position.set(-0.08,-0.22,0);grp.add(l1);
  const l2=new THREE.Mesh(legG,mat(skinC));l2.position.set(0.08,-0.22,0);grp.add(l2);
  // feet
  const footG=new THREE.BoxGeometry(0.14,0.06,0.15);
  const f1=new THREE.Mesh(footG,mat(0x1a0800));f1.position.set(-0.08,-0.33,0.02);grp.add(f1);
  const f2=new THREE.Mesh(footG,mat(0x1a0800));f2.position.set(0.08,-0.33,0.02);grp.add(f2);
  // loincloth
  const loinG=new THREE.BoxGeometry(0.24,0.1,0.05);
  const loin=new THREE.Mesh(loinG,mat(0x3a2010));loin.position.set(0,-0.14,0.07);grp.add(loin);
  // massive body
  const bodyG=new THREE.BoxGeometry(0.32,0.25,0.22);
  const body=new THREE.Mesh(bodyG,mat(skinC));body.position.set(0,0.0,0);grp.add(body);
  // shoulder pads (round bumps)
  const shG=new THREE.SphereGeometry(0.1,6,5);
  const sh1=new THREE.Mesh(shG,mat(skinC));sh1.position.set(-0.19,0.07,0);grp.add(sh1);
  const sh2=new THREE.Mesh(shG,mat(skinC));sh2.position.set(0.19,0.07,0);grp.add(sh2);
  // arms
  const armG=new THREE.BoxGeometry(0.11,0.2,0.1);
  const a1=new THREE.Mesh(armG,mat(skinC));a1.position.set(-0.22,-0.03,0);grp.add(a1);
  const a2=new THREE.Mesh(armG,mat(skinC));a2.position.set(0.22,-0.03,0);grp.add(a2);
  // fists
  const fistG=new THREE.BoxGeometry(0.1,0.1,0.1);
  const fi1=new THREE.Mesh(fistG,mat(skinC));fi1.position.set(-0.22,-0.15,0);grp.add(fi1);
  const fi2=new THREE.Mesh(fistG,mat(skinC));fi2.position.set(0.22,-0.15,0);grp.add(fi2);
  // short neck
  const neckG=new THREE.CylinderGeometry(0.07,0.09,0.06,6);
  const neck=new THREE.Mesh(neckG,mat(skinC));neck.position.set(0,0.15,0);grp.add(neck);
  // square head
  const headG=new THREE.BoxGeometry(0.28,0.22,0.22);
  const head=new THREE.Mesh(headG,mat(skinC));head.position.set(0,0.3,0);grp.add(head);
  // brow ridge
  const browG=new THREE.BoxGeometry(0.26,0.05,0.06);
  const brow=new THREE.Mesh(browG,mat(darkC));brow.position.set(0,0.36,0.09);grp.add(brow);
  // eyes (red)
  const eyeG=new THREE.BoxGeometry(0.07,0.05,0.02);
  const ey1=new THREE.Mesh(eyeG,mat(eyeC));ey1.position.set(-0.07,0.3,0.12);grp.add(ey1);
  const ey2=new THREE.Mesh(eyeG,mat(eyeC));ey2.position.set(0.07,0.3,0.12);grp.add(ey2);
  // tusks
  const tuskG=new THREE.CylinderGeometry(0.015,0.025,0.09,4);
  const tu1=new THREE.Mesh(tuskG,mat(toothC));tu1.position.set(-0.06,0.21,0.1);tu1.rotation.x=0.3;grp.add(tu1);
  const tu2=new THREE.Mesh(tuskG,mat(toothC));tu2.position.set(0.06,0.21,0.1);tu2.rotation.x=0.3;grp.add(tu2);
  // mohawk
  for(let i=0;i<4;i++){const sG=new THREE.BoxGeometry(0.05,0.1+i%2*0.04,0.04);const s=new THREE.Mesh(sG,mat(0x5a2000));s.position.set(-0.06+i*0.04,0.46,0);s.rotation.z=(i-1.5)*0.15;grp.add(s);}
  return grp;
}

function buildCyclops(scene, color){
  const grp=new THREE.Group();
  const mat=(c)=>new THREE.MeshLambertMaterial({color:c});
  const skinC=color||0x7878a8, eyeC=0xffffff, irisC=0x4488cc;
  // columnar legs
  const legG=new THREE.BoxGeometry(0.15,0.22,0.15);
  const l1=new THREE.Mesh(legG,mat(skinC));l1.position.set(-0.1,-0.24,0);grp.add(l1);
  const l2=new THREE.Mesh(legG,mat(skinC));l2.position.set(0.1,-0.24,0);grp.add(l2);
  // huge feet
  const footG=new THREE.BoxGeometry(0.18,0.07,0.2);
  const f1=new THREE.Mesh(footG,mat(0x28284a));f1.position.set(-0.1,-0.36,0.03);grp.add(f1);
  const f2=new THREE.Mesh(footG,mat(0x28284a));f2.position.set(0.1,-0.36,0.03);grp.add(f2);
  // kilt/belt
  const kiltG=new THREE.BoxGeometry(0.38,0.1,0.1);
  const kilt=new THREE.Mesh(kiltG,mat(0x3a3050));kilt.position.set(0,-0.1,0.06);grp.add(kilt);
  // MASSIVE body
  const bodyG=new THREE.BoxGeometry(0.42,0.3,0.28);
  const body=new THREE.Mesh(bodyG,mat(skinC));body.position.set(0,0.05,0);grp.add(body);
  // huge shoulder bumps
  const shG=new THREE.SphereGeometry(0.14,6,5);
  const sh1=new THREE.Mesh(shG,mat(skinC));sh1.position.set(-0.24,0.1,0);grp.add(sh1);
  const sh2=new THREE.Mesh(shG,mat(skinC));sh2.position.set(0.24,0.1,0);grp.add(sh2);
  // arms
  const armG=new THREE.BoxGeometry(0.13,0.22,0.12);
  const a1=new THREE.Mesh(armG,mat(skinC));a1.position.set(-0.28,-0.04,0);grp.add(a1);
  const a2=new THREE.Mesh(armG,mat(skinC));a2.position.set(0.28,-0.04,0);grp.add(a2);
  // huge hands
  const handG=new THREE.SphereGeometry(0.09,5,4);
  const h1=new THREE.Mesh(handG,mat(skinC));h1.position.set(-0.28,-0.17,0);grp.add(h1);
  const h2=new THREE.Mesh(handG,mat(skinC));h2.position.set(0.28,-0.17,0);grp.add(h2);
  // no real neck
  const neckG=new THREE.CylinderGeometry(0.1,0.12,0.05,6);
  const neck=new THREE.Mesh(neckG,mat(skinC));neck.position.set(0,0.22,0);grp.add(neck);
  // large head
  const headG=new THREE.BoxGeometry(0.3,0.27,0.26);
  const head=new THREE.Mesh(headG,mat(skinC));head.position.set(0,0.38,0);grp.add(head);
  // single HUGE eye
  const eyeG=new THREE.SphereGeometry(0.09,8,7);
  const eye=new THREE.Mesh(eyeG,mat(eyeC));eye.position.set(0,0.4,0.13);grp.add(eye);
  const irisG=new THREE.SphereGeometry(0.065,8,7);
  const iris=new THREE.Mesh(irisG,mat(irisC));iris.position.set(0,0.4,0.17);grp.add(iris);
  const pupilG=new THREE.SphereGeometry(0.04,6,5);
  const pupil=new THREE.Mesh(pupilG,mat(0x080820));pupil.position.set(0,0.4,0.2);grp.add(pupil);
  // stone crown
  for(let i=0;i<5;i++){const cG=new THREE.BoxGeometry(0.05,0.06+i%2*0.04,0.04);const c=new THREE.Mesh(cG,mat(0x5a5a7a));c.position.set(-0.12+i*0.06,0.58,0);grp.add(c);}
  return grp;
}

function buildWitch(scene, color){
  const grp=new THREE.Group();
  const mat=(c)=>new THREE.MeshLambertMaterial({color:c});
  const skinC=color||0xb030c0, robeC=0x2a0a4a, hatC=0x1a0a2a, wardC=0x4a2a1a;
  // robe (tapered)
  const robeG=new THREE.CylinderGeometry(0.09,0.18,0.38,6);
  const robe=new THREE.Mesh(robeG,mat(robeC));robe.position.set(0,-0.13,0);grp.add(robe);
  // belt
  const beltG=new THREE.CylinderGeometry(0.1,0.1,0.04,8);
  const belt=new THREE.Mesh(beltG,mat(0xd4a01a));belt.position.set(0,-0.02,0);grp.add(belt);
  // left arm
  const armLG=new THREE.BoxGeometry(0.06,0.18,0.06);
  const armL=new THREE.Mesh(armLG,mat(robeC));armL.position.set(-0.14,-0.04,0);grp.add(armL);
  const hL=new THREE.SphereGeometry(0.045,5,4);
  const handL=new THREE.Mesh(hL,mat(skinC));handL.position.set(-0.14,-0.14,0);grp.add(handL);
  // right arm + wand
  const armRG=new THREE.BoxGeometry(0.06,0.16,0.06);
  const armR=new THREE.Mesh(armRG,mat(robeC));armR.position.set(0.14,-0.04,0.03);armR.rotation.x=-0.3;grp.add(armR);
  const handR=new THREE.Mesh(new THREE.SphereGeometry(0.045,5,4),mat(skinC));handR.position.set(0.14,-0.12,0.07);grp.add(handR);
  // wand
  const wandG=new THREE.CylinderGeometry(0.012,0.018,0.24,5);
  const wand=new THREE.Mesh(wandG,mat(wardC));wand.position.set(0.18,-0.04,0.1);wand.rotation.x=-0.5;wand.rotation.z=0.2;grp.add(wand);
  const orbG=new THREE.SphereGeometry(0.038,7,6);
  const orb=new THREE.Mesh(orbG,mat(0x9040a0));orb.position.set(0.22,0.06,0.16);grp.add(orb);
  // neck
  const neckG=new THREE.CylinderGeometry(0.045,0.055,0.06,6);
  const neck=new THREE.Mesh(neckG,mat(skinC));neck.position.set(0,0.12,0);grp.add(neck);
  // head
  const headG=new THREE.BoxGeometry(0.18,0.18,0.16);
  const head=new THREE.Mesh(headG,mat(skinC));head.position.set(0,0.24,0);grp.add(head);
  // eyes
  const eyeG=new THREE.BoxGeometry(0.045,0.04,0.02);
  const ey1=new THREE.Mesh(eyeG,mat(0x400040));ey1.position.set(-0.045,0.26,0.08);grp.add(ey1);
  const ey2=new THREE.Mesh(eyeG,mat(0x400040));ey2.position.set(0.045,0.26,0.08);grp.add(ey2);
  // big hooked nose
  const noseG=new THREE.BoxGeometry(0.05,0.08,0.06);
  const nose=new THREE.Mesh(noseG,mat(skinC));nose.position.set(0,0.22,0.1);nose.rotation.x=-0.3;grp.add(nose);
  // hat brim
  const brimG=new THREE.CylinderGeometry(0.2,0.2,0.03,8);
  const brim=new THREE.Mesh(brimG,mat(hatC));brim.position.set(0,0.35,0);grp.add(brim);
  // hat cone (tall)
  const coneG=new THREE.CylinderGeometry(0.02,0.15,0.38,7);
  const cone=new THREE.Mesh(coneG,mat(hatC));cone.position.set(0,0.54,0);grp.add(cone);
  // hat band
  const bandG=new THREE.CylinderGeometry(0.153,0.153,0.04,8);
  const band=new THREE.Mesh(bandG,mat(0x9040a0));band.position.set(0,0.37,0);grp.add(band);
  return grp;
}

function buildCharacter(charId, color){
  switch(charId){
    case "gribberth": return buildGoblin(null, color ? parseInt(color.replace("#",""),16) : CHAR_COLORS.gribberth);
    case "craglasha":  return buildOrc(null,   color ? parseInt(color.replace("#",""),16) : CHAR_COLORS.craglasha);
    case "brontarox":  return buildCyclops(null,color ? parseInt(color.replace("#",""),16) : CHAR_COLORS.brontarox);
    case "rithea":     return buildWitch(null,  color ? parseInt(color.replace("#",""),16) : CHAR_COLORS.rithea);
    default:
      const g=new THREE.Group();
      const m=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.4,0.2),new THREE.MeshLambertMaterial({color:color?parseInt(color.replace("#",""),16):0xffffff}));
      g.add(m);return g;
  }
}

// 3D Object models
function buildShard(color){ // Red shard - crystal
  const g=new THREE.Group();
  const mat=new THREE.MeshLambertMaterial({color:color||0xff3030,emissive:new THREE.Color(color||0xff3030).multiplyScalar(0.3)});
  const cG=new THREE.CylinderGeometry(0,0.06,0.25,5);
  const c1=new THREE.Mesh(cG,mat);c1.position.y=0.12;g.add(c1);
  const c2=new THREE.Mesh(new THREE.CylinderGeometry(0.04,0,0.12,5),mat);c2.position.y=-0.06;c2.rotation.x=Math.PI;g.add(c2);
  return g;
}
function buildOrb(){ // Blue orb
  const g=new THREE.Group();
  const mat=new THREE.MeshLambertMaterial({color:0x2060d8,emissive:new THREE.Color(0x1030a0)});
  const sphere=new THREE.Mesh(new THREE.SphereGeometry(0.1,10,8),mat);g.add(sphere);
  const ringG=new THREE.TorusGeometry(0.13,0.015,6,16);
  const ring=new THREE.Mesh(ringG,new THREE.MeshLambertMaterial({color:0x80b0ff}));ring.rotation.x=0.4;g.add(ring);
  return g;
}
function buildScroll(){ // Yellow scroll
  const g=new THREE.Group();
  const mat=new THREE.MeshLambertMaterial({color:0xd4a01a});
  const rollG=new THREE.CylinderGeometry(0.035,0.035,0.16,8);
  const r1=new THREE.Mesh(rollG,mat);r1.position.set(-0.09,0,0);r1.rotation.z=Math.PI/2;g.add(r1);
  const r2=new THREE.Mesh(rollG,mat);r2.position.set(0.09,0,0);r2.rotation.z=Math.PI/2;g.add(r2);
  const papG=new THREE.BoxGeometry(0.18,0.12,0.005);
  const pap=new THREE.Mesh(papG,new THREE.MeshLambertMaterial({color:0xeedd99}));g.add(pap);
  return g;
}
function buildRoot(){ // Green root
  const g=new THREE.Group();
  const mat=new THREE.MeshLambertMaterial({color:0x2a8040});
  const rootG=new THREE.CylinderGeometry(0.02,0.035,0.18,6);
  const root=new THREE.Mesh(rootG,mat);root.rotation.z=0.4;g.add(root);
  const leafG=new THREE.SphereGeometry(0.07,6,5);leafG.scale(1,0.5,1);
  const leaf=new THREE.Mesh(leafG,new THREE.MeshLambertMaterial({color:0x40c060}));leaf.position.set(0.04,0.1,0);g.add(leaf);
  return g;
}
function buildBall(){
  const g=new THREE.Group();
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.1,10,8),new THREE.MeshLambertMaterial({color:0xdddddd}));g.add(m);
  return g;
}
function buildButton(){
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.04,8),new THREE.MeshLambertMaterial({color:0x888888}));g.add(base);
  const top=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.06,8),new THREE.MeshLambertMaterial({color:0xcc3333}));top.position.y=0.05;g.add(top);
  return g;
}
function buildEnemy(){
  const g=new THREE.Group();
  // shadow wisp shape
  const mat=new THREE.MeshLambertMaterial({color:0x600080,emissive:new THREE.Color(0x300040)});
  const body=new THREE.Mesh(new THREE.SphereGeometry(0.12,8,7),mat);g.add(body);
  const eyeMat=new THREE.MeshLambertMaterial({color:0xe040ff,emissive:new THREE.Color(0xc020e0)});
  const eye=new THREE.Mesh(new THREE.SphereGeometry(0.07,8,7),eyeMat);eye.position.set(0,0.03,0.1);g.add(eye);
  const pupil=new THREE.Mesh(new THREE.SphereGeometry(0.04,6,5),new THREE.MeshLambertMaterial({color:0x100010}));pupil.position.set(0,0.03,0.16);g.add(pupil);
  // tentacles
  for(let i=0;i<5;i++){const tG=new THREE.CylinderGeometry(0.006,0.02,0.18,4);const t=new THREE.Mesh(tG,mat);const a=i/5*Math.PI*2;t.position.set(Math.cos(a)*0.08,-0.14,Math.sin(a)*0.08);t.rotation.x=0.4+i*0.1;t.rotation.z=a*0.3;g.add(t);}
  return g;
}

// CSS
const fonts=`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');`;
const css=`
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#050304;color:#EDE6CF}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes objHover{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.og{position:relative;min-height:100vh;background:radial-gradient(1200px 520px at 50% -10%,rgba(218,166,69,.12),transparent),linear-gradient(180deg,#050406,#09060a 52%,#0d0607);font-family:'Crimson Pro',Georgia,serif;color:#EDE6CF;display:flex;flex-direction:column;align-items:center;padding:24px 16px 48px;user-select:none;overflow:hidden}
.og::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.008) 0,rgba(255,255,255,.008) 2px,transparent 2px,transparent 16px);pointer-events:none}
h1.og-title{font-family:'Cinzel',serif;font-size:clamp(1.6rem,5vw,3rem);font-weight:900;color:#F6E6A8;letter-spacing:8px;text-transform:uppercase;text-shadow:0 0 50px rgba(220,180,70,.22),0 10px 30px rgba(0,0,0,.6);margin-bottom:4px}
.og-sub{font-family:'Cinzel',serif;font-size:.75rem;letter-spacing:4px;color:rgba(210,186,122,.5);text-transform:uppercase;margin-bottom:24px}
.setup-card{position:relative;background:linear-gradient(180deg,rgba(38,24,18,.95),rgba(10,6,4,.97));border:1px solid rgba(213,169,62,.22);border-radius:18px;padding:30px 38px;text-align:center;box-shadow:0 32px 110px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.05);max-width:620px;width:100%}
.setup-card h2{font-family:'Cinzel',serif;font-size:1.2rem;color:#D9B65A;margin-bottom:18px;letter-spacing:2px}
.pc-opts{display:flex;gap:12px;justify-content:center;margin-bottom:24px}
.pc-btn{width:68px;height:68px;border-radius:12px;border:1px solid rgba(213,169,62,.2);background:rgba(20,14,8,.7);color:#EFD88B;font-family:'Cinzel',serif;font-size:1.5rem;cursor:pointer;transition:all 140ms ease}
.pc-btn:hover{background:rgba(60,40,15,.8);transform:translateY(-2px)}
.pc-btn.sel{border-color:rgba(213,169,62,.7);background:rgba(90,58,20,.7);box-shadow:0 0 20px rgba(213,169,62,.2)}
.mods{display:flex;flex-direction:column;gap:9px;margin-bottom:22px;text-align:left}
.mod-row{display:flex;align-items:flex-start;gap:11px;padding:11px 13px;border-radius:10px;background:rgba(10,7,5,.5);border:1px solid rgba(255,255,255,.04);cursor:pointer;transition:all 140ms ease}
.mod-row:hover{background:rgba(30,20,8,.7)}
.mod-row.on{background:rgba(50,33,10,.7);border-color:rgba(213,169,62,.28)}
.mod-chk{width:20px;height:20px;border-radius:5px;border:1px solid rgba(213,169,62,.3);background:rgba(0,0,0,.4);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;margin-top:2px}
.mod-row.on .mod-chk{background:rgba(90,58,20,.8);border-color:rgba(213,169,62,.7)}
.mod-title{font-family:'Cinzel',serif;font-size:.8rem;color:#D9B65A;letter-spacing:.5px;margin-bottom:3px}
.mod-desc{font-size:.7rem;color:rgba(180,155,90,.42);line-height:1.5}
.start-btn{padding:12px 30px;font-family:'Cinzel',serif;font-size:1rem;letter-spacing:2px;background:linear-gradient(180deg,#6a4420,#2b1708);border:1px solid rgba(230,185,70,.32);border-radius:12px;color:#FFF8E6;cursor:pointer;transition:all 140ms ease;box-shadow:0 12px 36px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.06)}
.start-btn:hover{transform:translateY(-2px);box-shadow:0 16px 48px rgba(0,0,0,.78),0 0 18px rgba(230,185,70,.14)}
.start-btn:disabled{opacity:.3;cursor:not-allowed}
.game-layout{display:grid;grid-template-columns:1fr minmax(240px,280px);gap:18px;align-items:flex-start;width:100%;max-width:1240px}
.canvas-wrap{position:relative;border-radius:18px;background:linear-gradient(180deg,rgba(6,4,3,.9),rgba(3,2,2,.95));border:1px solid rgba(213,169,62,.18);box-shadow:0 22px 90px rgba(0,0,0,.85);overflow:hidden}
.canvas-wrap canvas{display:block}
.sidebar{display:flex;flex-direction:column;gap:10px;min-width:220px;max-width:280px;flex:1}
.s-card{background:linear-gradient(180deg,rgba(34,23,18,.95),rgba(8,5,4,.95));border:1px solid rgba(213,169,62,.2);border-radius:13px;padding:15px 17px;box-shadow:0 12px 52px rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.04)}
.s-hdr{font-family:'Cinzel',serif;font-size:.6rem;letter-spacing:3px;color:rgba(208,183,122,.55);text-transform:uppercase;margin-bottom:8px}
.p-ind{display:flex;align-items:center;gap:9px;margin-bottom:11px;flex-wrap:wrap}
.p-dot{width:13px;height:13px;border-radius:50%;flex-shrink:0}
.p-nm{font-family:'Cinzel',serif;font-size:1rem;color:#EFD88B;letter-spacing:1px}
.ph-lbl{font-size:.76rem;color:rgba(200,180,130,.5);font-style:italic;margin-bottom:9px}
.wasd-g{display:grid;grid-template-columns:repeat(3,29px);grid-template-rows:repeat(2,29px);gap:3px;justify-content:center;margin:5px auto 0}
.wk{width:29px;height:29px;background:rgba(30,20,10,.8);border:1px solid rgba(213,169,62,.2);border-radius:5px;display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-size:.7rem;color:rgba(240,215,140,.6)}
.sw-hint{font-size:.72rem;color:rgba(180,155,90,.5);font-style:italic;line-height:1.5;margin-top:5px}
.p-list{display:flex;flex-direction:column;gap:6px}
.p-row{display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:10px;background:rgba(10,7,5,.56);border:1px solid rgba(255,255,255,.05);font-size:.8rem;transition:all 140ms ease}
.p-row.cur{background:rgba(64,40,15,.74);border-color:rgba(213,169,62,.34)}
.p-row.done{opacity:.4}
.p-row.ded{opacity:.32;border-color:rgba(200,50,50,.18)}
.p-ri{font-size:.85rem;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
.p-rn{font-family:'Cinzel',serif;font-size:.76rem}
.p-rs{font-size:.66rem;color:rgba(180,155,90,.42);margin-top:1px}
.log-box{background:rgba(6,4,3,.78);border:1px solid rgba(213,169,62,.12);border-radius:9px;padding:9px 11px;max-height:120px;overflow-y:auto;font-size:.72rem;color:rgba(196,168,104,.74);line-height:1.6;font-style:italic}
.drop-btn{width:100%;padding:8px;margin-top:7px;border-radius:8px;border:1px solid rgba(220,60,60,.28);background:rgba(80,10,10,.6);color:rgba(255,150,150,.8);font-family:'Cinzel',serif;font-size:.72rem;cursor:pointer;transition:all 140ms ease}
.drop-btn:hover{background:rgba(120,20,20,.8)}
.ability-btn{width:100%;padding:9px;margin-top:5px;border-radius:8px;border:1px solid rgba(100,200,255,.28);background:linear-gradient(180deg,rgba(20,50,90,.7),rgba(8,18,40,.8));color:rgba(150,210,255,.9);font-family:'Cinzel',serif;font-size:.72rem;cursor:pointer;transition:all 140ms ease}
.ability-btn:hover:not(:disabled){background:linear-gradient(180deg,rgba(30,70,130,.8),rgba(12,28,60,.9))}
.ability-btn:disabled{opacity:.3;cursor:not-allowed}
.ability-btn.active-target{border-color:rgba(255,80,80,.6);background:linear-gradient(180deg,rgba(80,10,10,.8),rgba(40,5,5,.9));color:rgba(255,160,160,.9)}
.char-select{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-bottom:20px}
.char-card{width:145px;border-radius:14px;padding:14px 12px;text-align:center;cursor:pointer;transition:all 180ms ease;border:2px solid rgba(213,169,62,.1);background:rgba(15,10,6,.85)}
.char-card:hover{transform:translateY(-3px);border-color:rgba(213,169,62,.35)}
.char-card.chosen{border-color:rgba(213,169,62,.8);box-shadow:0 0 24px rgba(213,169,62,.25);transform:translateY(-3px)}
.char-card.taken{opacity:.3;cursor:not-allowed;pointer-events:none}
.char-name{font-family:'Cinzel',serif;font-size:.68rem;color:#EFD88B;letter-spacing:.5px;margin-bottom:3px;line-height:1.3}
.char-race{font-size:.62rem;color:rgba(180,155,90,.5);margin-bottom:7px;font-style:italic}
.char-ability{font-size:.6rem;color:rgba(200,180,130,.6);line-height:1.4}
.char-ability-name{font-family:'Cinzel',serif;font-size:.65rem;color:rgba(150,210,255,.7);margin-bottom:2px}
.slider-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;justify-content:space-between}
.slider-lbl{font-family:'Cinzel',serif;font-size:.72rem;color:#D9B65A;white-space:nowrap}
.slider-val{font-family:'Cinzel',serif;font-size:.9rem;color:#F6E6A8;min-width:38px;text-align:right}
input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;background:rgba(213,169,62,.3);outline:none;cursor:pointer;flex:1}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#D9B65A;cursor:pointer}
.banner{background:linear-gradient(180deg,rgba(80,30,120,.9),rgba(30,10,50,.9));border:1px solid rgba(180,80,220,.4);border-radius:12px;padding:10px 16px;text-align:center;font-family:'Cinzel',serif;font-size:.78rem;color:#e080ff;letter-spacing:1px;margin-bottom:8px;animation:popIn .5s ease}
.stun-badge{background:rgba(255,220,0,.15);border:1px solid rgba(255,220,0,.4);border-radius:5px;padding:1px 6px;font-size:.6rem;color:rgba(255,220,0,.8);margin-left:4px}
.eby{animation:pulse .75s ease infinite}
.victory-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:100;animation:fadeIn .4s ease}
.victory-card{background:linear-gradient(180deg,rgba(50,30,10,.97),rgba(6,4,3,.97));border:1px solid rgba(213,169,62,.3);border-radius:20px;padding:42px 50px;text-align:center;box-shadow:0 40px 120px rgba(0,0,0,.95);animation:popIn .4s cubic-bezier(.22,1,.36,1);max-width:420px}
.v-title{font-family:'Cinzel',serif;font-size:2.3rem;color:#F6E6A8;letter-spacing:4px;margin-bottom:11px}
.v-text{color:#cfc1a3;font-style:italic;line-height:1.7;margin-bottom:24px}
.event-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:90}
.event-card{background:linear-gradient(180deg,rgba(60,10,60,.97),rgba(6,4,3,.97));border:1px solid rgba(180,80,220,.4);border-radius:18px;padding:32px 40px;text-align:center;box-shadow:0 30px 100px rgba(0,0,0,.95);max-width:360px;animation:popIn .4s cubic-bezier(.22,1,.36,1)}
.char-icon-3d{font-size:2.2rem;margin-bottom:6px;height:56px;display:flex;align-items:center;justify-content:center}
@media(max-width:980px){.game-layout{grid-template-columns:1fr;max-width:700px}.sidebar{max-width:none}}
`;

function ModToggle({active,icon,label,desc,onClick}){
  return<div className={`mod-row${active?" on":""}`} onClick={onClick}><div className="mod-chk">{active?"✓":""}</div><div><div className="mod-title">{icon} {label}</div><div className="mod-desc">{desc}</div></div></div>;
}

// ─── 3D BOARD COMPONENT ───────────────────────────────────────────────────────
function Board3D({
  grid, mazeWalls, gridSize, objects, vanished, positions, inKingdom, kPositions,
  dead, stunned, inventory, atBase, dropped, droppedPos, enemies, enemyActive,
  allGathered, curPlayer, playerCount, charChoices,
  modExplore, modColors, modBW, visibleCells, discoveredCells,
  modChallengeRooms, challengeState, challengeAbilityTargets, challengeAbilityMode,
  onCellClick,
}){
  const mountRef=useRef(null);
  const threeRef=useRef({});
  const animRef=useRef(null);

  // abilityAnimRef used for flyovers
  const abilityAnimRef=useRef(null);
  const [abilityAnim, setAbilityAnim]=useState(null);

  // Expose setter for parent
  Board3D.triggerAnim=(anim)=>{ abilityAnimRef.current=anim; };

  useEffect(()=>{
    const mount=mountRef.current; if(!mount) return;
    const W=mount.clientWidth, H=mount.clientHeight;

    // Scene
    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x0a0608);
    scene.fog=new THREE.Fog(0x0a0608,18,38);

    // Renderer
    const renderer=new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(W,H);renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Camera — isometric-ish perspective from above-front
    const camera=new THREE.PerspectiveCamera(38,W/H,0.1,100);
    const gs=gridSize;
    const cx=gs*TILE_SIZE/2, cz=gs*TILE_SIZE/2;
    camera.position.set(cx, gs*0.72, cz+gs*0.65);
    camera.lookAt(cx, 0, cz-gs*0.08);

    // Lighting
    const ambient=new THREE.AmbientLight(0x9988aa,0.7);scene.add(ambient);
    const sun=new THREE.DirectionalLight(0xffeebb,1.2);
    sun.position.set(cx+8,20,cz-10);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.near=0.5;sun.shadow.camera.far=60;
    sun.shadow.camera.left=-gs;sun.shadow.camera.right=gs;sun.shadow.camera.top=gs;sun.shadow.camera.bottom=-gs;
    scene.add(sun);
    const fill=new THREE.DirectionalLight(0x8899ff,0.3);fill.position.set(cx-10,8,cz+8);scene.add(fill);
    // Torch-like point lights at altar
    const torch=new THREE.PointLight(0xffaa44,1.2,8);
    const sc=getStartCells(gs);torch.position.set((sc[0].x+sc[3].x)/2*TILE_SIZE+TILE_SIZE/2,1,(sc[0].y+sc[3].y)/2*TILE_SIZE+TILE_SIZE/2);scene.add(torch);

    // ── Build board ──────────────────────────────────────────────────────────
    const tileGroup=new THREE.Group();scene.add(tileGroup);
    const wallGroup=new THREE.Group();scene.add(wallGroup);
    const markerGroup=new THREE.Group();scene.add(markerGroup);

    // Tile materials
    const tileMats={};
    const makeTileMat=(color,emissive=0x000000)=>{
      const hex=COLOR_THREE[color]||COLOR_THREE.white;
      return new THREE.MeshLambertMaterial({color:hex,emissive:new THREE.Color(emissive)});
    };
    PLAYER_COLORS.forEach(c=>{ tileMats[c]=makeTileMat(c); });
    tileMats.white=makeTileMat("white");
    tileMats.black=makeTileMat("black");
    tileMats.empty=new THREE.MeshLambertMaterial({color:0x060404,transparent:true,opacity:0.1});
    tileMats.start=new THREE.MeshLambertMaterial({color:0xc8b896,emissive:new THREE.Color(0x443310)});
    tileMats.altar=new THREE.MeshLambertMaterial({color:0xd4a01a,emissive:new THREE.Color(0x4a2a00)});
    tileMats.dark=new THREE.MeshLambertMaterial({color:0x080506});
    tileMats.dim=new THREE.MeshLambertMaterial({color:0x302828});
    tileMats.kingdom=new THREE.MeshLambertMaterial({color:0xb8903a,emissive:new THREE.Color(0x1a0a00)});
    tileMats.target=new THREE.MeshLambertMaterial({color:0xff3020,emissive:new THREE.Color(0x440000)});

    const tileGeo=new THREE.BoxGeometry(TILE_SIZE*0.97,TILE_HEIGHT,TILE_SIZE*0.97);
    const wallGeo=new THREE.BoxGeometry(TILE_SIZE*0.06,WALL_H,TILE_SIZE);
    const wallGeoH=new THREE.BoxGeometry(TILE_SIZE,WALL_H,TILE_SIZE*0.06);
    const wallMat=new THREE.MeshLambertMaterial({color:0x666666});

    const tileMeshMap={}; // cellKey -> mesh

    for(let row=0;row<gs;row++){
      for(let col=0;col<gs;col++){
        const k=cellKey(col,row);
        const color=grid[k]||"empty";
        const isStart=isStartCellFn(col,row,gs);
        const isGone=vanished?.has(k);
        let mat;
        if(isGone) mat=tileMats.empty;
        else if(isStart) mat=tileMats.start;
        else mat=tileMats[color]||tileMats.white;

        const tMesh=new THREE.Mesh(tileGeo,mat.clone());
        tMesh.position.set(col*TILE_SIZE+TILE_SIZE/2, -TILE_HEIGHT/2, row*TILE_SIZE+TILE_SIZE/2);
        tMesh.receiveShadow=true;
        tMesh.userData={col,row,key:k};
        tileGroup.add(tMesh);
        tileMeshMap[k]=tMesh;

        // Altar sigil disc
        if(isStart&&!isGone){
          const disc=new THREE.Mesh(new THREE.CylinderGeometry(TILE_SIZE*0.35,TILE_SIZE*0.35,0.02,12),new THREE.MeshLambertMaterial({color:0xd4a01a,emissive:new THREE.Color(0x3a2000)}));
          disc.position.set(col*TILE_SIZE+TILE_SIZE/2,0.01,row*TILE_SIZE+TILE_SIZE/2);
          tileGroup.add(disc);
        }

        // Maze walls
        if(mazeWalls){
          if(mazeWalls.has(wallKey(col,row,1,0))){
            const wm=new THREE.Mesh(wallGeo,wallMat);
            wm.position.set((col+1)*TILE_SIZE, WALL_H/2-TILE_HEIGHT/2, row*TILE_SIZE+TILE_SIZE/2);
            wallGroup.add(wm);
          }
          if(mazeWalls.has(wallKey(col,row,0,1))){
            const wm=new THREE.Mesh(wallGeoH,wallMat);
            wm.position.set(col*TILE_SIZE+TILE_SIZE/2, WALL_H/2-TILE_HEIGHT/2, (row+1)*TILE_SIZE);
            wallGroup.add(wm);
          }
        }
      }
    }

    // Kingdom board (below main board, separated by gap)
    const KINGDOM_OFFSET_Z = gs*TILE_SIZE + 1.2;
    const kingdomTileMeshMap={};
    for(let row=0;row<KINGDOM_ROWS;row++){
      for(let col=0;col<gs;col++){
        const k=`k_${cellKey(col,row)}`;
        const cx2=Math.floor(gs/2);
        const isEntrance=row===0&&(col===cx2-1||col===cx2);
        const isLocked=!allGathered;
        const matColor=isLocked?(isEntrance?0x3a0550:0x500a70):0xb8903a;
        const emitC=isLocked?0x180020:0x1a0a00;
        const m=new THREE.Mesh(tileGeo,new THREE.MeshLambertMaterial({color:matColor,emissive:new THREE.Color(emitC)}));
        m.position.set(col*TILE_SIZE+TILE_SIZE/2,-TILE_HEIGHT/2,KINGDOM_OFFSET_Z+row*TILE_SIZE+TILE_SIZE/2);
        m.receiveShadow=true;
        tileGroup.add(m);
        kingdomTileMeshMap[cellKey(col,row)]=m;
      }
    }
    // Kingdom gateway arch (locked indicator)
    if(!allGathered){
      const gateG=new THREE.BoxGeometry(2*TILE_SIZE,1.2,0.12);
      const gate=new THREE.Mesh(gateG,new THREE.MeshLambertMaterial({color:0x400060,emissive:new THREE.Color(0x200030)}));
      const cx2=Math.floor(gs/2);
      gate.position.set((cx2-0.5)*TILE_SIZE+TILE_SIZE/2,0.6-TILE_HEIGHT/2,KINGDOM_OFFSET_Z-0.06);
      scene.add(gate);
    }

    // ── Click detection ──────────────────────────────────────────────────────
    const raycaster=new THREE.Raycaster();
    const mouse=new THREE.Vector2();
    const onMouseDown=(e)=>{
      const rect=renderer.domElement.getBoundingClientRect();
      mouse.x=((e.clientX-rect.left)/rect.width)*2-1;
      mouse.y=-((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(mouse,camera);
      const hits=raycaster.intersectObjects(tileGroup.children);
      if(hits.length){
        const {col,row}=hits[0].object.userData;
        if(col!==undefined) onCellClick?.(col,row);
      }
    };
    renderer.domElement.addEventListener("mousedown",onMouseDown);

    // ── Character meshes ─────────────────────────────────────────────────────
    const charMeshes=[];
    const objectMeshes={};
    const enemyMeshes=[];

    const buildObjMesh=(obj)=>{
      let g;
      switch(obj.id){
        case "red":    g=buildShard(0xff3030);break;
        case "blue":   g=buildOrb();break;
        case "yellow": g=buildScroll();break;
        case "green":  g=buildRoot();break;
        case "challenge-ball": g=buildBall();break;
        case "challenge-button": g=buildButton();break;
        default: g=new THREE.Group();g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08),new THREE.MeshLambertMaterial({color:0xffffff})));
      }
      g.position.set(obj.x*TILE_SIZE+TILE_SIZE/2,0.22,obj.y*TILE_SIZE+TILE_SIZE/2);
      g.userData={objId:obj.id};scene.add(g);
      return g;
    };

    objects.forEach(o=>{objectMeshes[o.id]=buildObjMesh(o);});

    // build character groups
    for(let i=0;i<playerCount;i++){
      const charId=charChoices?.[i];
      const charDef=CHARACTERS.find(c=>c.id===charId);
      const group=buildCharacter(charId,charDef?.color);
      group.userData={playerIdx:i};
      group.castShadow=true;
      // position
      const pos=positions?.[i];
      if(pos){
        group.position.set(pos.x*TILE_SIZE+TILE_SIZE/2,0,pos.y*TILE_SIZE+TILE_SIZE/2);
      }
      group.scale.setScalar(0.58);
      scene.add(group);
      charMeshes.push(group);
    }

    // enemy
    if(enemyActive&&enemies?.length>0){
      enemies.forEach(e=>{
        const eg=buildEnemy();eg.position.set(e.x*TILE_SIZE+TILE_SIZE/2,0,e.y*TILE_SIZE+TILE_SIZE/2);eg.scale.setScalar(0.65);scene.add(eg);enemyMeshes.push(eg);
      });
    }

    // ── Ability VFX particles ────────────────────────────────────────────────
    let boulderMesh=null, beamLine=null, particlesG=null;
    let animProgress=0, animDuration=0, animData=null;

    // ── Animate loop ─────────────────────────────────────────────────────────
    let t=0;
    const animate=()=>{
      animRef.current=requestAnimationFrame(animate);
      t+=0.016;

      // Update tile highlights for ability targets
      for(const[k,mesh] of Object.entries(tileMeshMap)){
        const parts=k.split(",");const col=parseInt(parts[0]),row=parseInt(parts[1]);
        const isTarget=challengeAbilityMode&&challengeAbilityTargets?.has(k);
        if(isTarget){
          mesh.material.emissive.setHex(0x440000+Math.floor(Math.abs(Math.sin(t*3))*0x220000));
        }
      }

      // Float objects
      for(const[id,mesh] of Object.entries(objectMeshes)){
        if(mesh){mesh.position.y=0.22+Math.sin(t*1.8+id.length)*0.05;mesh.rotation.y+=0.012;}
      }

      // Idle animations for characters
      charMeshes.forEach((grp,i)=>{
        if(!grp||dead?.[i]) return;
        const isCurrent=i===curPlayer;
        grp.position.y=Math.sin(t*2+i)*0.015+(isCurrent?0.04:0);
        if(isCurrent) grp.rotation.y+=0.01;
      });

      // Enemy bob
      enemyMeshes.forEach((eg,i)=>{
        eg.position.y=Math.sin(t*3+i*2.1)*0.06+0.05;
        eg.rotation.y+=0.025;
      });

      // Torch flicker
      torch.intensity=1.0+Math.sin(t*7)*0.25+Math.sin(t*13.7)*0.1;

      // ── Ability animation ────────────────────────────────────────────────
      const anim=abilityAnimRef.current;
      if(anim&&!anim._done){
        animProgress+=0.04;
        const prog=Math.min(animProgress,1);

        if(anim.type==="boulder"){
          if(!boulderMesh){
            boulderMesh=new THREE.Mesh(new THREE.SphereGeometry(0.14,8,6),new THREE.MeshLambertMaterial({color:0x7a7a9a}));
            scene.add(boulderMesh);
          }
          const fx=anim.fromX*TILE_SIZE+TILE_SIZE/2, fz=anim.fromY*TILE_SIZE+TILE_SIZE/2;
          const tx=anim.toX*TILE_SIZE+TILE_SIZE/2, tz=anim.toY*TILE_SIZE+TILE_SIZE/2;
          boulderMesh.position.set(fx+(tx-fx)*prog, Math.sin(prog*Math.PI)*2.5+0.3, fz+(tz-fz)*prog);
          boulderMesh.rotation.x+=0.12; boulderMesh.rotation.z+=0.08;
          if(prog>=1){ scene.remove(boulderMesh); boulderMesh=null; anim._done=true; abilityAnimRef.current=null; animProgress=0; }
        }
        else if(anim.type==="beam"){
          // Draw line from wand to target
          if(!beamLine){
            const pts=[
              new THREE.Vector3(anim.fromX*TILE_SIZE+TILE_SIZE/2,0.5,anim.fromY*TILE_SIZE+TILE_SIZE/2),
              new THREE.Vector3(anim.toX*TILE_SIZE+TILE_SIZE/2,0.5,anim.toY*TILE_SIZE+TILE_SIZE/2)
            ];
            const geo=new THREE.BufferGeometry().setFromPoints(pts);
            beamLine=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xe060ff,linewidth:3}));
            scene.add(beamLine);
          }
          beamLine.material.opacity=Math.abs(Math.sin(t*15));
          if(prog>=1){ scene.remove(beamLine); beamLine=null; anim._done=true; abilityAnimRef.current=null; animProgress=0; }
        }
        else if(anim.type==="jump"){
          // Move the character mesh along arc
          const grp=charMeshes[anim.playerIdx];
          if(grp){
            const fx=anim.fromX*TILE_SIZE+TILE_SIZE/2, fz=anim.fromY*TILE_SIZE+TILE_SIZE/2;
            const tx=anim.toX*TILE_SIZE+TILE_SIZE/2, tz=anim.toY*TILE_SIZE+TILE_SIZE/2;
            grp.position.set(fx+(tx-fx)*prog, Math.sin(prog*Math.PI)*1.8, fz+(tz-fz)*prog);
          }
          if(prog>=1){ anim._done=true; abilityAnimRef.current=null; animProgress=0; }
        }
        else if(anim.type==="punch"){
          // Camera shake
          camera.position.x=cx+Math.sin(t*50)*(1-prog)*0.08;
          if(prog>=1){ camera.position.x=cx; anim._done=true; abilityAnimRef.current=null; animProgress=0; }
        }
      }

      renderer.render(scene,camera);
    };
    animate();

    // Expose updatePositions fn
    threeRef.current={
      scene, renderer, camera, charMeshes, objectMeshes, enemyMeshes,
      tileMeshMap, kingdomTileMeshMap, tileGroup, KINGDOM_OFFSET_Z,
    };

    const handleResize=()=>{
      const W=mount.clientWidth,H=mount.clientHeight;
      camera.aspect=W/H;camera.updateProjectionMatrix();renderer.setSize(W,H);
    };
    window.addEventListener("resize",handleResize);

    return()=>{
      cancelAnimationFrame(animRef.current);
      renderer.domElement.removeEventListener("mousedown",onMouseDown);
      window.removeEventListener("resize",handleResize);
      renderer.dispose();
      if(mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  },[]);// intentionally only run once

  // ── Sync positions each render ─────────────────────────────────────────────
  useEffect(()=>{
    const {charMeshes,enemyMeshes,objectMeshes,tileMeshMap,kingdomTileMeshMap,scene,KINGDOM_OFFSET_Z}=threeRef.current;
    if(!charMeshes||!scene) return;
    const gs=gridSize;

    // Characters
    for(let i=0;i<(playerCount||0);i++){
      const grp=charMeshes[i]; if(!grp) continue;
      const isInK=inKingdom?.[i];
      const pos=isInK?kPositions?.[i]:positions?.[i];
      if(!pos) continue;
      const targetX=pos.x*TILE_SIZE+TILE_SIZE/2;
      const targetZ=(isInK?KINGDOM_OFFSET_Z:0)+pos.y*TILE_SIZE+TILE_SIZE/2;
      // Smooth movement
      grp.position.x+=(targetX-grp.position.x)*0.25;
      grp.position.z+=(targetZ-grp.position.z)*0.25;
      grp.visible=!dead?.[i]?true:true;
      grp.scale.setScalar(dead?.[i]?0.3:i===curPlayer?0.64:0.58);
    }

    // Objects
    objects?.forEach(o=>{
      const m=objectMeshes?.[o.id];
      if(!m) return;
      const wasCarried=inventory?.[PLAYER_COLORS.indexOf(o.id)];
      if(wasCarried){ m.visible=false; return; }
      m.visible=true;
      m.position.x=o.x*TILE_SIZE+TILE_SIZE/2;
      m.position.z=o.y*TILE_SIZE+TILE_SIZE/2;
    });

    // Tile colours & darkness
    if(tileMeshMap){
      for(const[k,mesh] of Object.entries(tileMeshMap)){
        const parts=k.split(",");const col=parseInt(parts[0]),row=parseInt(parts[1]);
        const color=grid?.[k]||"empty";
        const isStart=isStartCellFn(col,row,gs);
        const isGone=vanished?.has(k);
        const isTarget=challengeAbilityMode&&challengeAbilityTargets?.has(k);
        let c;
        if(isGone) c=0x060404;
        else if(isTarget) c=0xcc2010;
        else if(isStart) c=0xc8b896;
        else c=COLOR_THREE[color]||0xc8b896;
        mesh.material.color.setHex(c);
        // Fog of war
        if(modExplore&&!inKingdom?.[curPlayer]){
          const inView=visibleCells?.has(k);
          const isDisc=discoveredCells?.has(k);
          if(!inView&&!isDisc) mesh.material.color.setHex(0x0a0808);
          else if(!inView&&isDisc){ const cur=mesh.material.color;cur.r*=0.4;cur.g*=0.4;cur.b*=0.4; }
        }
      }
    }
  });

  return <div ref={mountRef} className="canvas-wrap" style={{width:"100%",height:540}} />;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ObryndelMiniGame({onExit}){
  const [phase,setPhase]=useState("setup");
  const [playerCount,setPlayerCount]=useState(null);
  const [setupPlayer,setSetupPlayer]=useState(0);
  const [charChoices,setCharChoices]=useState([]);

  const [modVanish,setModVanish]=useState(false);
  const [modEnemy,setModEnemy]=useState(false);
  const [modBW,setModBW]=useState(false);
  const [modMaze,setModMaze]=useState(false);
  const [modExplore,setModExplore]=useState(false);
  const [modEvents,setModEvents]=useState(false);
  const [modColors,setModColors]=useState(true);
  const [modChallengeRooms,setModChallengeRooms]=useState(false);
  const [darkRadius,setDarkRadius]=useState(3);
  const [gridSize,setGridSize]=useState(10);

  const [grid,setGrid]=useState({});
  const [mazeWalls,setMazeWalls]=useState(null);
  const [objects,setObjects]=useState([]);
  const [vanished,setVanished]=useState(new Set());
  const [discoveredCells,setDiscoveredCells]=useState(new Set());
  const [positions,setPositions]=useState([]);
  const [inKingdom,setInKingdom]=useState([]);
  const [kPositions,setKPositions]=useState([]);
  const [curPlayer,setCurPlayer]=useState(0);
  const [swFirst,setSwFirst]=useState(null);
  const [inventory,setInventory]=useState([]);
  const [dropped,setDropped]=useState([]);
  const [droppedPos,setDroppedPos]=useState([]);
  const [atBase,setAtBase]=useState([]);
  const [dead,setDead]=useState([]);
  const [stunned,setStunned]=useState([]);
  const [enemies,setEnemies]=useState([]);
  const [enemyActive,setEnemyActive]=useState(false);
  const [abilityCooldown,setAbilityCooldown]=useState([]);
  const [abilityStepsLeft,setAbilityStepsLeft]=useState(0);
  const [log,setLog]=useState([]);
  const [eventCard,setEventCard]=useState(null);
  const [allGathered,setAllGathered]=useState(false);
  const [extraMove,setExtraMove]=useState(false);
  const [challengeState,setChallengeState]=useState(null);
  const [challengeAbilityMode,setChallengeAbilityMode]=useState(false);
  const [challengeAbilityTargets,setChallengeAbilityTargets]=useState(new Set());
  const [challengeAbilityMeta,setChallengeAbilityMeta]=useState({});

  const stateRef=useRef({});
  useEffect(()=>{
    stateRef.current={
      curPlayer,positions,inKingdom,kPositions,grid,inventory,atBase,dead,stunned,
      dropped,droppedPos,vanished,discoveredCells,enemies,enemyActive,playerCount,
      modBW,modVanish,modEnemy,modMaze,modExplore,modEvents,modColors,modChallengeRooms,
      darkRadius,gridSize,mazeWalls,objects,abilityCooldown,abilityStepsLeft,
      charChoices,extraMove,allGathered,challengeState,challengeAbilityMode,
      challengeAbilityTargets,challengeAbilityMeta,
    };
  });

  useEffect(()=>{
    const el=document.createElement("style");el.textContent=fonts+css;document.head.appendChild(el);
    return()=>document.head.removeChild(el);
  },[]);

  const addLog=useCallback((msg)=>{setLog(prev=>[msg,...prev].slice(0,30));},[]);

  const visibleCells=useMemo(()=>{
    if(!modExplore||inKingdom[curPlayer]) return null;
    const pos=positions[curPlayer];if(!pos) return null;
    return bfsVisible(pos,darkRadius,mazeWalls,vanished,gridSize);
  },[modExplore,curPlayer,positions,inKingdom,darkRadius,mazeWalls,vanished,gridSize]);

  useEffect(()=>{
    if(!visibleCells) return;
    setDiscoveredCells(prev=>{const next=new Set(prev);let c=false;visibleCells.forEach(k=>{if(!next.has(k)){next.add(k);c=true;}});return c?next:prev;});
  },[visibleCells]);

  useEffect(()=>{
    if(!modChallengeRooms) return;
    setChallengeAbilityMode(false);setChallengeAbilityTargets(new Set());setChallengeAbilityMeta({});
  },[curPlayer,modChallengeRooms]);

  const beginCharSelect=()=>{setCharChoices(Array(playerCount).fill(null));setSetupPlayer(0);setPhase("charselect");};

  const chooseChar=(charId)=>{
    const next=[...charChoices];next[setupPlayer]=charId;setCharChoices(next);
    if(setupPlayer<playerCount-1)setSetupPlayer(setupPlayer+1);
    else startGame(next);
  };

  const startGame=(chars)=>{
    const pc=playerCount;const gs=modChallengeRooms?10:gridSize;
    if(modChallengeRooms)setGridSize(10);

    if(modChallengeRooms){
      const ch=buildChallengeRoom(chars,pc);setGrid(ch.grid);setMazeWalls(null);
      setObjects([{id:"challenge-ball",emoji:"⚪",label:"Round Ball",x:ch.ball.x,y:ch.ball.y},{id:"challenge-button",emoji:"🔘",label:"Stone Button",x:ch.button.x,y:ch.button.y}]);
      setChallengeState(ch);setVanished(new Set());setDiscoveredCells(new Set());
      setPositions(ch.startCells.map(p=>({...p})));setInKingdom(Array(pc).fill(false));setKPositions(Array(pc).fill(null));
      setInventory(Array(pc).fill(false));setDropped(Array(pc).fill(false));setDroppedPos(Array(pc).fill(null));
      setAtBase(Array(pc).fill(false));setDead(Array(pc).fill(false));setStunned(Array(pc).fill(0));
      setEnemies([]);setEnemyActive(false);setAbilityCooldown(Array(pc).fill(0));setAbilityStepsLeft(0);
      setCurPlayer(0);setSwFirst(null);setLog([]);setEventCard(null);setAllGathered(false);setExtraMove(false);
      setChallengeAbilityMode(false);setChallengeAbilityTargets(new Set());setChallengeAbilityMeta({});
      setPhase("game");addLog("Co-op Ability Challenge begins!");return;
    }
    let mWalls=null;
    if(modMaze){mWalls=generateMaze(gs,gs);const sc=getStartCells(gs);for(const s of sc)for(const[dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])mWalls.delete(wallKey(s.x,s.y,dx,dy));setMazeWalls(mWalls);}
    else setMazeWalls(null);
    const g=makeGrid(gs,pc,modBW,modMaze,modColors);
    const sc=getStartCells(gs);sc.forEach(c=>{g[cellKey(c.x,c.y)]="white";});
    const ctr=getStartCenter(gs);const objs=placeObjects(gs,ctr.x,ctr.y,mWalls,pc);
    setObjects(objs);if(modColors)objs.forEach(o=>{g[cellKey(o.x,o.y)]="white";});
    setGrid(g);setVanished(new Set());setDiscoveredCells(new Set());
    const starts=getStartCells(gs).slice(0,pc);
    setPositions(starts.map(p=>({...p})));setInKingdom(Array(pc).fill(false));setKPositions(Array(pc).fill(null));
    setInventory(Array(pc).fill(false));setDropped(Array(pc).fill(false));setDroppedPos(Array(pc).fill(null));
    setAtBase(Array(pc).fill(false));setDead(Array(pc).fill(false));setStunned(Array(pc).fill(0));
    setEnemies([]);setEnemyActive(false);setAbilityCooldown(Array(pc).fill(0));setAbilityStepsLeft(0);
    setCurPlayer(0);setSwFirst(null);setLog([]);setEventCard(null);setAllGathered(false);setExtraMove(false);
    setChallengeState(null);setChallengeAbilityMode(false);setChallengeAbilityTargets(new Set());setChallengeAbilityMeta({});
    setPhase("game");
    addLog(`Quest begins with ${pc} scoundrel${pc>1?"s":""}!`);
    addLog("🏰 Bring all relics to the altar!");
    if(modMaze)addLog("🏚️ A maze surrounds you…");
    if(modExplore)addLog(`🌑 Exploration mode — ${darkRadius} steps vision.`);
  };

  const clearChallengeAbility=useCallback(()=>{setChallengeAbilityMode(false);setChallengeAbilityTargets(new Set());setChallengeAbilityMeta({});},[]);

  const isChallengeBlocked=useCallback((x,y,cs)=>{
    if(!cs)return false;
    if(cs.gap&&cs.gap.x===x&&cs.gap.y===y)return true;
    if(cs.crackedWall&&!cs.crackedWall.broken&&cs.crackedWall.x===x&&cs.crackedWall.y===y)return true;
    return false;
  },[]);

  const computeChallengeTargets=useCallback((s=stateRef.current)=>{
    const targets=new Set(),meta={};
    if(!s.modChallengeRooms||!s.challengeState) return{targets,meta};
    const cp=s.curPlayer,charId=s.charChoices[cp],pos=s.positions[cp],cs=s.challengeState;
    if(!pos||!charId)return{targets,meta};
    const inBounds=(x,y)=>x>=0&&x<s.gridSize&&y>=0&&y<s.gridSize;
    const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
    const add=(x,y,info)=>{const k=cellKey(x,y);targets.add(k);meta[k]=info;};
    if(charId==="gribberth")[1,2].forEach(d=>dirs.forEach(([dx,dy])=>{const tx=pos.x+dx*d,ty=pos.y+dy*d;if(!inBounds(tx,ty)||isChallengeBlocked(tx,ty,cs))return;add(tx,ty,{type:"jump",distance:d,from:{x:pos.x,y:pos.y}});}));
    else if(charId==="craglasha")dirs.forEach(([dx,dy])=>{const tx=pos.x+dx,ty=pos.y+dy;if(!inBounds(tx,ty))return;add(tx,ty,{type:"breakWall"});});
    else if(charId==="brontarox")dirs.forEach(([dx,dy])=>{for(let d=1;d<=4;d++){const tx=pos.x+dx*d,ty=pos.y+dy*d;if(!inBounds(tx,ty))continue;add(tx,ty,{type:"throw",distance:d});}});
    else if(charId==="rithea")dirs.forEach(([dx,dy])=>{for(let st=1;st<s.gridSize;st++){const tx=pos.x+dx*st,ty=pos.y+dy*st;if(!inBounds(tx,ty))break;if(isChallengeBlocked(tx,ty,cs))break;add(tx,ty,{type:"pull"});if(s.objects.some(o=>o.x===tx&&o.y===ty))break;}});
    return{targets,meta};
  },[isChallengeBlocked]);

  const openChallengeAbility=useCallback(()=>{
    const r=computeChallengeTargets(stateRef.current);
    setChallengeAbilityTargets(r.targets);setChallengeAbilityMeta(r.meta);setChallengeAbilityMode(true);
    if(r.targets.size===0)addLog("No valid targets.");
  },[computeChallengeTargets,addLog]);

  const maybeFinishChallenge=useCallback((ns)=>{
    if(!ns)return;
    if(Object.values(ns.completed||{}).every(Boolean)){setAllGathered(true);addLog("All objectives solved!");setTimeout(()=>setPhase("victory"),320);}
  },[addLog]);

  const triggerAnim=(anim)=>{ if(Board3D.triggerAnim) Board3D.triggerAnim(anim); };

  const executeChallengeAbilityAt=useCallback((x,y)=>{
    const s=stateRef.current;
    if(!s.modChallengeRooms||!s.challengeState||!s.challengeAbilityMode)return;
    const key=cellKey(x,y);const tm=s.challengeAbilityMeta[key];if(!tm)return;
    const cp=s.curPlayer,cpPos=s.positions[cp],cpChar=CHARACTERS.find(c=>c.id===s.charChoices[cp]);
    let nextCs={...s.challengeState,completed:{...s.challengeState.completed}};

    if(tm.type==="jump"){
      const jumpedTwo=Math.abs(cpPos.x-x)+Math.abs(cpPos.y-y)===2;
      triggerAnim({type:"jump",fromX:cpPos.x,fromY:cpPos.y,toX:x,toY:y,playerIdx:cp});
      if(jumpedTwo&&nextCs.gap){const mx=cpPos.x+Math.sign(x-cpPos.x),my=cpPos.y+Math.sign(y-cpPos.y);if(mx===nextCs.gap.x&&my===nextCs.gap.y)nextCs.completed.goblin=true;}
      setTimeout(()=>setPositions(prev=>prev.map((p,i)=>i===cp?{x,y}:p)),500);
      addLog(`${cpChar?.name} leaps over!`);
    }
    if(tm.type==="breakWall"){
      triggerAnim({type:"punch",fromX:cpPos.x,fromY:cpPos.y,toX:x,toY:y,playerIdx:cp});
      if(nextCs.crackedWall&&!nextCs.crackedWall.broken&&nextCs.crackedWall.x===x&&nextCs.crackedWall.y===y){
        setTimeout(()=>{nextCs.crackedWall={...nextCs.crackedWall,broken:true};setGrid(prev=>({...prev,[cellKey(x,y)]:"white"}));nextCs.completed.orc=true;setChallengeState(nextCs);maybeFinishChallenge(nextCs);},550);
        addLog(`${cpChar?.name} shatters the wall!`);clearChallengeAbility();return;
      } else addLog(`${cpChar?.name} punches — nothing breaks.`);
    }
    if(tm.type==="throw"){
      triggerAnim({type:"boulder",fromX:cpPos.x,fromY:cpPos.y,toX:x,toY:y,playerIdx:cp});
      if(nextCs.button&&nextCs.button.x===x&&nextCs.button.y===y){
        setTimeout(()=>{nextCs.button={...nextCs.button,activated:true};nextCs.completed.cyclops=true;setChallengeState(nextCs);maybeFinishChallenge(nextCs);},660);
        addLog(`${cpChar?.name} hits the button!`);
      } else { setTimeout(()=>setChallengeState(nextCs),660);addLog(`${cpChar?.name} misses.`); }
      clearChallengeAbility();return;
    }
    if(tm.type==="pull"){
      triggerAnim({type:"beam",fromX:cpPos.x,fromY:cpPos.y,toX:x,toY:y,playerIdx:cp});
      const ballObj=s.objects.find(o=>o.id==="challenge-ball");
      if(ballObj&&ballObj.x===x&&ballObj.y===y){
        const dirs=[[0,-1],[1,0],[0,1],[-1,0]];let dest=null;
        for(const[dx,dy]of dirs){const tx=cpPos.x+dx,ty=cpPos.y+dy;if(tx<0||tx>=s.gridSize||ty<0||ty>=s.gridSize)continue;if(isChallengeBlocked(tx,ty,s.challengeState))continue;dest={x:tx,y:ty};break;}
        if(dest){
          setTimeout(()=>{setObjects(prev=>prev.map(o=>o.id==="challenge-ball"?{...o,x:dest.x,y:dest.y}:o));nextCs.completed.witch=true;setChallengeState(nextCs);maybeFinishChallenge(nextCs);},620);
          addLog(`${cpChar?.name} pulls the ball!`);
        } else addLog("No room.");
      } else addLog(`${cpChar?.name} beams — only the ball reacts.`);
      clearChallengeAbility();return;
    }
    clearChallengeAbility();setChallengeState(nextCs);maybeFinishChallenge(nextCs);
  },[addLog,clearChallengeAbility,isChallengeBlocked,maybeFinishChallenge]);

  const triggerEvent=useCallback(()=>setEventCard(EVENT_CARDS[Math.floor(Math.random()*EVENT_CARDS.length)]),[]);

  const advanceTurn=(cp,deadArr,stunnedArr,pc)=>{
    if(stateRef.current.modChallengeRooms)return;
    let next=(cp+1)%pc;let g=0;while(deadArr[next]&&g<pc){next=(next+1)%pc;g++;}
    const ns=[...stunnedArr];
    if(ns[next]>0){addLog(`💫 ${PLAYER_NAMES[next]} stunned!`);ns[next]--;setStunned(ns);let skip=(next+1)%pc;g=0;while(deadArr[skip]&&g<pc){skip=(skip+1)%pc;g++;}setCurPlayer(skip);addLog(`— ${PLAYER_NAMES[skip]}'s turn —`);}
    else{setCurPlayer(next);addLog(`— ${PLAYER_NAMES[next]}'s turn —`);}
    setAbilityCooldown(prev=>{const n=[...prev];if(n[next]>0)n[next]--;return n;});
    if(stateRef.current.enemyActive)moveEnemies(next);
  };

  const moveEnemies=useCallback((nextPlayer)=>{
    const s=stateRef.current;if(!s.enemyActive)return;
    setEnemies(prev=>prev.map(enemy=>{
      if(enemy.stunned>0)return{...enemy,stunned:enemy.stunned-1};
      if(enemy.fleeing>0){
        const nr=s.positions.reduce((b,p,i)=>{if(s.dead[i]||s.inKingdom[i])return b;const d=Math.abs(p.x-enemy.x)+Math.abs(p.y-enemy.y);return d<b.d?{d,p}:b;},{d:Infinity,p:null});
        if(nr.p){const dx=enemy.x-nr.p.x,dy=enemy.y-nr.p.y;const dirs=[[0,-1],[1,0],[0,1],[-1,0]].sort((a,b)=>Math.abs(a[0]-Math.sign(dx))+Math.abs(a[1]-Math.sign(dy))-(Math.abs(b[0]-Math.sign(dx))+Math.abs(b[1]-Math.sign(dy))));for(const[ddx,ddy]of dirs){const nx=enemy.x+ddx,ny=enemy.y+ddy;if(nx<0||nx>=s.gridSize||ny<0||ny>=s.gridSize)continue;if(s.mazeWalls?.has(wallKey(enemy.x,enemy.y,ddx,ddy)))continue;return{...enemy,x:nx,y:ny,fleeing:enemy.fleeing-1};}}
        return{...enemy,fleeing:enemy.fleeing-1};
      }
      const carriers=s.positions.map((p,i)=>({p,i})).filter(({i})=>s.inventory[i]&&!s.dead[i]&&!s.inKingdom[i]);
      if(!carriers.length)return enemy;
      let bs=null,bd=Infinity;
      for(const{p}of carriers){const step=bfsMaze(enemy,p,s.mazeWalls,s.vanished,s.gridSize);if(step){const d=Math.abs(p.x-enemy.x)+Math.abs(p.y-enemy.y);if(d<bd){bd=d;bs=step;}}}
      if(!bs)return enemy;
      const ne={...enemy,x:bs.x,y:bs.y};
      const ci=s.positions.findIndex((p,i)=>p.x===bs.x&&p.y===bs.y&&s.inventory[i]&&!s.dead[i]);
      if(ci>=0){setDead(p=>{const n=[...p];n[ci]=true;return n;});setInventory(p=>{const n=[...p];n[ci]=false;return n;});setDropped(p=>{const n=[...p];n[ci]=true;return n;});setDroppedPos(p=>{const n=[...p];n[ci]={x:bs.x,y:bs.y};return n;});addLog(`💀 Shadow caught ${PLAYER_NAMES[ci]}!`);}
      return ne;
    }));
  },[addLog]);

  const useAbility=useCallback(()=>{
    const s=stateRef.current;const cp=s.curPlayer;const charId=s.charChoices[cp];const char=CHARACTERS.find(c=>c.id===charId);
    if(!char)return;
    if(!s.modChallengeRooms&&s.abilityCooldown[cp]>0)return;
    const pos=s.positions[cp];const gs=s.gridSize;
    if(s.modChallengeRooms){if(s.challengeAbilityMode)clearChallengeAbility();else openChallengeAbility();return;}
    let used=false;
    if(charId==="gribberth"){setAbilityStepsLeft(3);addLog(`${PLAYER_NAMES[cp]}: Quick Toes — 3 steps!`);used=true;}
    else if(charId==="craglasha"){setEnemies(prev=>prev.map(e=>Math.abs(e.x-pos.x)+Math.abs(e.y-pos.y)<=2?{...e,fleeing:2}:e));triggerAnim({type:"punch",fromX:pos.x,fromY:pos.y,toX:pos.x,toY:pos.y-1,playerIdx:cp});addLog(`Roar of the Mother!`);used=true;}
    else if(charId==="brontarox"){let hit=false,he=null;setEnemies(prev=>prev.map(e=>{const d=Math.abs(e.x-pos.x)+Math.abs(e.y-pos.y);if(d<=3&&!hit){hit=true;he={...e};return{...e,stunned:2};}return e;}));if(hit&&he){triggerAnim({type:"boulder",fromX:pos.x,fromY:pos.y,toX:he.x,toY:he.y,playerIdx:cp});addLog(`Boulder Throw!`);}else addLog(`No enemy in range.`);used=true;}
    else if(charId==="rithea"){let hit=false,he=null;setEnemies(prev=>prev.map(e=>{const d=Math.abs(e.x-pos.x)+Math.abs(e.y-pos.y);if(d<=2&&!hit){hit=true;he={...e};return{...e,x:Math.floor(Math.random()*gs),y:Math.floor(Math.random()*gs)};}return e;}));if(hit&&he){triggerAnim({type:"beam",fromX:pos.x,fromY:pos.y,toX:he.x,toY:he.y,playerIdx:cp});addLog(`Zap!`);}else addLog(`No enemy close.`);used=true;}
    if(used){const nc=[...s.abilityCooldown];nc[cp]=char.abilityCooldown;setAbilityCooldown(nc);if(charId!=="gribberth"){setSwFirst(null);advanceTurn(cp,s.dead,s.stunned,s.playerCount);}}
  },[addLog,clearChallengeAbility,openChallengeAbility]);

  // WASD
  useEffect(()=>{
    if(phase!=="game"||eventCard) return;
    const handler=(e)=>{
      const key=e.key.toLowerCase();const isSpace=e.code==="Space"||key===" ";
      const dirs={w:[0,-1],a:[-1,0],s:[0,1],d:[1,0]};const dir=dirs[key];
      if(!dir&&!isSpace)return;e.preventDefault();
      const s=stateRef.current;const cp=s.curPlayer;const gs=s.gridSize;
      if(s.dead[cp]){addLog(`${PLAYER_NAMES[cp]} is dead!`);return;}
      if(s.modChallengeRooms){
        if(isSpace){if(s.challengeAbilityMode)clearChallengeAbility();else openChallengeAbility();return;}
        if(!dir||!s.challengeState)return;
        if(s.challengeAbilityMode){addLog("Select a target or SPACE to cancel.");return;}
        const cs=s.challengeState;const cur=s.positions[cp];
        const nx=cur.x+dir[0],ny=cur.y+dir[1];
        if(nx<0||nx>=gs||ny<0||ny>=gs){addLog("Blocked.");return;}
        if(isChallengeBlocked(nx,ny,cs)){addLog("Obstacle.");return;}
        if(s.positions.some((p,i)=>i!==cp&&p.x===nx&&p.y===ny&&!s.dead[i])){addLog("Someone is there.");return;}
        setPositions(prev=>prev.map((p,i)=>i===cp?{x:nx,y:ny}:p));setSwFirst(null);return;
      }
      if(!dir)return;
      const isInK=s.inKingdom[cp];
      if(isInK){
        const kpos=s.kPositions[cp];const nx=kpos.x+dir[0],ny=kpos.y+dir[1];
        if(nx<0||nx>=gs||ny<0||ny>=KINGDOM_ROWS){if(ny<0){const ni=[...s.inKingdom];ni[cp]=false;const nk=[...s.kPositions];nk[cp]=null;const np=[...s.positions];np[cp]={x:kpos.x,y:gs-1};setInKingdom(ni);setKPositions(nk);setPositions(np);addLog(`${PLAYER_NAMES[cp]} returned.`);advanceTurn(cp,s.dead,s.stunned,s.playerCount);}else addLog("Out of bounds!");return;}
        const nk=[...s.kPositions];nk[cp]={x:nx,y:ny};setKPositions(nk);
        if(ny>=2){setPhase("victory");return;}
        if(s.abilityStepsLeft>1){setAbilityStepsLeft(s.abilityStepsLeft-1);return;}else if(s.abilityStepsLeft===1)setAbilityStepsLeft(0);
        if(s.extraMove){setExtraMove(false);return;}
        advanceTurn(cp,s.dead,s.stunned,s.playerCount);return;
      }
      const cur=s.positions[cp];const nx=cur.x+dir[0],ny=cur.y+dir[1];
      if(ny>=gs){
        if(!s.allGathered){addLog("⚔️ Barrier sealed! Bring relics first.");return;}
        const kx=Math.max(0,Math.min(gs-1,cur.x));const ni=[...s.inKingdom];ni[cp]=true;const nk=[...s.kPositions];nk[cp]={x:kx,y:0};setInKingdom(ni);setKPositions(nk);addLog(`${PLAYER_NAMES[cp]} enters the Kingdom! ⚡`);
        if(s.abilityStepsLeft>1){setAbilityStepsLeft(s.abilityStepsLeft-1);return;}else if(s.abilityStepsLeft===1)setAbilityStepsLeft(0);
        if(s.extraMove){setExtraMove(false);return;}
        advanceTurn(cp,s.dead,s.stunned,s.playerCount);return;
      }
      if(nx<0||nx>=gs||ny<0){addLog("Out of bounds!");return;}
      const nk2=cellKey(nx,ny);
      if(s.vanished.has(nk2)){addLog("That tile crumbled!");return;}
      if(s.mazeWalls?.has(wallKey(cur.x,cur.y,dir[0],dir[1]))){addLog("Wall blocks you!");return;}
      const cc=s.grid[nk2];
      if(s.modColors||s.modBW){
        if(s.modBW&&cc!=="white"){addLog(`Can't walk on black!`);return;}
        else if(s.modColors&&!s.modBW&&cc!==PLAYER_COLORS[cp]&&cc!=="white"){addLog(`${PLAYER_NAMES[cp]} can't step on ${cc}!`);return;}
      }
      const charId=s.charChoices[cp];const isGrib=charId==="gribberth";
      if(s.enemies.some(e=>e.x===nx&&e.y===ny&&e.stunned===0&&e.fleeing===0)&&!isGrib){addLog("Shadow blocks you!");return;}

      let npos=s.positions.map((p,i)=>i===cp?{x:nx,y:ny}:p);
      let ninv=[...s.inventory];let ndrop=[...s.dropped];let ndrp=[...s.droppedPos];
      let nbase=[...s.atBase];let ndead=[...s.dead];let ng=s.grid;let nvan=s.vanished;let nobj=s.objects;let nea=s.enemyActive;
      let msg=`${PLAYER_NAMES[cp]} moved.`;

      if(s.modEnemy)ndead.forEach((d,i)=>{if(d&&i!==cp&&s.positions[i].x===nx&&s.positions[i].y===ny){ndead[i]=false;msg+=` Revived ${PLAYER_NAMES[i]}!`;}});

      const oi=nobj.findIndex(o=>o.x===nx&&o.y===ny&&!ninv[cp]);
      if(oi>=0){const o=nobj[oi];if(o.id===PLAYER_COLORS[cp]){ninv[cp]=true;msg+=` Picked up ${o.label}!`;
        if(!nea&&s.modEnemy){nea=true;const cx=Math.floor(gs/2);setEnemies([{x:cx,y:gs-1,fleeing:0,stunned:0}]);setEnemyActive(true);addLog("👁️ A Shadow emerges!");}
        if(s.modVanish){const count=ninv.filter(Boolean).length*2;const cands=[];for(let y=0;y<gs;y++)for(let x=0;x<gs;x++){const k=cellKey(x,y);if(isStartCellFn(x,y,gs)||nobj.some(o=>o.x===x&&o.y===y)||nvan.has(k))continue;if(npos.some((p,i)=>!ndead[i]&&p.x===x&&p.y===y))continue;cands.push(k);}
          const tv=cands.sort(()=>Math.random()-.5).slice(0,count);nvan=new Set([...nvan,...tv]);const vg={...ng};tv.forEach(k=>{vg[k]="empty";});ng=vg;if(tv.length)msg+=` ${tv.length} tiles crumble…`;}
      }}
      if(s.modEnemy&&ndrop[cp]&&!ninv[cp]){const dp=ndrp[cp];if(dp&&dp.x===nx&&dp.y===ny){ninv[cp]=true;ndrop[cp]=false;ndrp[cp]=null;msg+=` Reclaimed shard!`;}}
      if(isStartCellFn(nx,ny,gs)&&ninv[cp]&&!nbase[cp]){nbase[cp]=true;ninv[cp]=false;msg+=` ${PLAYER_NAMES[cp]} delivered! ✨`;const myC=PLAYER_COLORS[cp];const sc2=getStartCells(gs);const sp=sc2[cp%sc2.length];nobj=nobj.map(o=>o.id===myC?{...o,x:sp.x,y:sp.y}:o);
        if(nbase.filter(Boolean).length>=s.playerCount&&!s.allGathered){setAllGathered(true);addLog("⚡ All relics gathered! Barrier shattered!");}}
      setPositions(npos);setInventory(ninv);setDropped(ndrop);setDroppedPos(ndrp);setAtBase(nbase);setDead(ndead);setGrid(ng);setVanished(nvan);setObjects(nobj);setSwFirst(null);addLog(msg);
      if(s.abilityStepsLeft>1){setAbilityStepsLeft(s.abilityStepsLeft-1);return;}else if(s.abilityStepsLeft===1)setAbilityStepsLeft(0);
      if(s.extraMove){setExtraMove(false);return;}
      if(s.modEvents){triggerEvent();return;}
      advanceTurn(cp,ndead,s.stunned,s.playerCount);
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[phase,eventCard,addLog,triggerEvent,moveEnemies,clearChallengeAbility,openChallengeAbility,isChallengeBlocked]);

  const resolveEvent=useCallback(()=>{
    const s=stateRef.current;const card=eventCard;const cp=s.curPlayer;setEventCard(null);
    if(card.id==="teleport"){let nx,ny;for(let i=0;i<200;i++){nx=Math.floor(Math.random()*s.gridSize);ny=Math.floor(Math.random()*s.gridSize);if(!s.vanished.has(cellKey(nx,ny))&&!s.positions.some((p,pi)=>p.x===nx&&p.y===ny&&pi!==cp))break;}const np=[...s.positions];np[cp]={x:nx,y:ny};setPositions(np);addLog(`🌀 ${PLAYER_NAMES[cp]} teleported!`);advanceTurn(cp,s.dead,s.stunned,s.playerCount);}
    else if(card.id==="stun"){const ns=[...s.stunned];ns[cp]=1;setStunned(ns);addLog(`💫 ${PLAYER_NAMES[cp]} stunned!`);advanceTurn(cp,s.dead,s.stunned,s.playerCount);}
    else if(card.id==="motivation"){setExtraMove(true);addLog(`⚡ Extra move!`);}
  },[eventCard,addLog]);

  const handleCellClick=useCallback((x,y)=>{
    const s=stateRef.current;
    if(phase!=="game"||eventCard)return;
    if(s.modChallengeRooms){if(!s.challengeAbilityMode)return;const k=cellKey(x,y);if(!s.challengeAbilityTargets.has(k))return;executeChallengeAbilityAt(x,y);return;}
    if(!s.modColors)return;
    const k=cellKey(x,y);if(s.vanished.has(k)||isStartCellFn(x,y,s.gridSize)||s.objects.some(o=>o.x===x&&o.y===y)){addLog("Can't swap that.");return;}
    if(s.positions.some((p,i)=>!s.dead[i]&&p.x===x&&p.y===y)){addLog("A player is there!");return;}
    if(!swFirst){setSwFirst({x,y});addLog(`Selected (${x},${y}) — click another.`);}
    else{if(swFirst.x===x&&swFirst.y===y){setSwFirst(null);return;}const ng={...s.grid};const k1=cellKey(swFirst.x,swFirst.y);const tmp=ng[k1];ng[k1]=ng[k];ng[k]=tmp;setGrid(ng);addLog(`Tiles swapped.`);setSwFirst(null);if(s.modEvents){triggerEvent();return;}advanceTurn(s.curPlayer,s.dead,s.stunned,s.playerCount);}
  },[phase,swFirst,eventCard,addLog,triggerEvent,executeChallengeAbilityAt]);

  const handleDrop=useCallback(()=>{
    const s=stateRef.current;const cp=s.curPlayer;if(!s.inventory[cp])return;
    const pos=s.positions[cp];const ni=[...s.inventory];ni[cp]=false;const nd=[...s.dropped];nd[cp]=true;const ndp=[...s.droppedPos];ndp[cp]={...pos};
    setInventory(ni);setDropped(nd);setDroppedPos(ndp);setSwFirst(null);addLog(`${PLAYER_NAMES[cp]} dropped shard!`);advanceTurn(cp,s.dead,s.stunned,s.playerCount);
  },[addLog]);

  // ─── SETUP SCREEN ─────────────────────────────────────────────────────────
  if(phase==="setup"){
    return(
      <div className="og">
        <h1 className="og-title">Obryndel</h1>
        <div className="og-sub">The Shard Cooperative</div>
        <div className="setup-card">
          <h2>Choose Your Scoundrels</h2>
          <div className="pc-opts">
            {[1,2,3,4].map(n=>(
              <button key={n} className={`pc-btn${playerCount===n?" sel":""}`}
                onClick={()=>!modChallengeRooms&&setPlayerCount(n)} disabled={modChallengeRooms}
                style={modChallengeRooms?{opacity:.35,cursor:"not-allowed"}:undefined}>{n}</button>
            ))}
          </div>
          <div style={{borderTop:"1px solid rgba(213,169,62,.08)",paddingTop:16,marginBottom:16}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:".65rem",letterSpacing:3,color:"rgba(180,155,90,.32)",textTransform:"uppercase",marginBottom:11}}>Map Settings</div>
            <div className="slider-row"><span className="slider-lbl">Map Size</span><input type="range" min={8} max={16} value={gridSize} disabled={modChallengeRooms} onChange={e=>setGridSize(Number(e.target.value))}/><span className="slider-val">{modChallengeRooms?"10x10":`${gridSize}×${gridSize}`}</span></div>
            {modExplore&&<div className="slider-row"><span className="slider-lbl">Vision Range</span><input type="range" min={1} max={8} value={darkRadius} onChange={e=>setDarkRadius(Number(e.target.value))}/><span className="slider-val">{darkRadius} steps</span></div>}
          </div>
          <div style={{borderTop:"1px solid rgba(213,169,62,.08)",paddingTop:16,marginBottom:18}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:".65rem",letterSpacing:3,color:"rgba(180,155,90,.32)",textTransform:"uppercase",marginBottom:11}}>Modifiers</div>
            <div className="mods">
              <ModToggle active={modChallengeRooms} onClick={()=>setModChallengeRooms(v=>{const n=!v;if(n){setModColors(false);setModMaze(false);setModExplore(false);setModVanish(false);setModEnemy(false);setModBW(false);setModEvents(false);setGridSize(10);setPlayerCount(4);}else setModColors(true);return n;})} icon="🚪" label="Ability Challenge" desc="Co-op puzzle: WASD moves, SPACE targets abilities." />
              <ModToggle active={modColors} onClick={()=>!modChallengeRooms&&setModColors(v=>!v)} icon="🎨" label="Colored Tiles" desc="Players walk on their color or white. Click tiles to swap." />
              <ModToggle active={modMaze} onClick={()=>!modChallengeRooms&&setModMaze(v=>!v)} icon="🏚️" label="Maze" desc="Walls block movement through the labyrinth." />
              <ModToggle active={modExplore} onClick={()=>!modChallengeRooms&&setModExplore(v=>!v)} icon="🌑" label="Exploration Mode" desc="Map is dark. Discover it as you venture out." />
              <ModToggle active={modVanish} onClick={()=>!modChallengeRooms&&setModVanish(v=>!v)} icon="💨" label="Vanishing Tiles" desc="Tiles crumble as relics are collected." />
              <ModToggle active={modEnemy} onClick={()=>!modChallengeRooms&&setModEnemy(v=>!v)} icon="👁️" label="The Shadow" desc="An enemy hunts relic carriers." />
              <ModToggle active={modBW} onClick={()=>!modChallengeRooms&&setModBW(v=>!v)} icon="🖤" label="Black & White" desc="Only white tiles are walkable." />
              <ModToggle active={modEvents} onClick={()=>!modChallengeRooms&&setModEvents(v=>!v)} icon="🃏" label="Event Cards" desc="Draw a card each turn." />
            </div>
          </div>
          <button className="start-btn" disabled={!playerCount} onClick={beginCharSelect}>Choose Characters →</button>
          <div style={{marginTop:12,fontSize:".68rem",color:"rgba(180,155,90,.25)",fontStyle:"italic"}}>Fully rendered in 3D using Three.js</div>
        </div>
      </div>
    );
  }

  if(phase==="charselect"){
    const takenIds=charChoices.filter(Boolean);
    const charIcons={"gribberth":"🪖","craglasha":"🗿","brontarox":"🌀","rithea":"🎩"};
    return(
      <div className="og">
        <h1 className="og-title">Obryndel</h1>
        <div className="og-sub">Choose Your Champion</div>
        <div className="setup-card" style={{maxWidth:700}}>
          <h2 style={{color:COLOR_HEX[PLAYER_COLORS[setupPlayer]]}}>{PLAYER_EMOJIS[setupPlayer]} {PLAYER_NAMES[setupPlayer]} — Choose</h2>
          <div className="char-select">
            {CHARACTERS.map(char=>(
              <div key={char.id} className={`char-card${charChoices[setupPlayer]===char.id?" chosen":""}${takenIds.includes(char.id)&&charChoices[setupPlayer]!==char.id?" taken":""}`}
                style={{borderColor:charChoices[setupPlayer]===char.id?char.color+"aa":undefined,boxShadow:charChoices[setupPlayer]===char.id?`0 0 24px ${char.color}44`:undefined}}
                onClick={takenIds.includes(char.id)&&charChoices[setupPlayer]!==char.id?undefined:()=>chooseChar(char.id)}>
                <div className="char-icon-3d" style={{fontSize:"2.5rem"}}>{charIcons[char.id]}</div>
                <div className="char-name">{char.name}</div>
                <div className="char-race">{char.race}</div>
                <div className="char-ability-name">✦ {char.abilityName}</div>
                <div className="char-ability">{char.abilityDesc}</div>
                {charChoices[setupPlayer]===char.id&&<div style={{marginTop:6,fontSize:".6rem",color:"#F6E6A8",fontFamily:"'Cinzel',serif"}}>✓ Chosen</div>}
              </div>
            ))}
          </div>
          <div style={{fontSize:".7rem",color:"rgba(180,155,90,.38)",fontStyle:"italic"}}>
            {setupPlayer<playerCount-1?`Player ${setupPlayer+2} chooses next.`:"After choosing, quest begins!"}
          </div>
        </div>
      </div>
    );
  }

  // ─── GAME ─────────────────────────────────────────────────────────────────
  if(phase==="game"||phase==="victory"){
    const cp=curPlayer;
    const cpChar=CHARACTERS.find(c=>c.id===charChoices[cp]);
    const gs=gridSize;
    const challengeObjectiveByChar={gribberth:"goblin",craglasha:"orc",brontarox:"cyclops",rithea:"witch"};
    const challengeObjectiveText={goblin:"Jump over the gap",orc:"Break the cracked wall",cyclops:"Activate the button",witch:"Pull the round ball"};
    const objectiveForActive=cpChar?challengeObjectiveByChar[cpChar.id]:null;

    return(
      <div className="og">
        <h1 className="og-title" style={{fontSize:"clamp(1.1rem,3.5vw,1.8rem)",marginBottom:2}}>Obryndel</h1>
        <div className="og-sub" style={{marginBottom:12}}>The Shard Cooperative</div>

        {eventCard&&(
          <div className="event-overlay">
            <div className="event-card">
              <div style={{fontSize:"3rem",marginBottom:12}}>{eventCard.icon}</div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:"1.4rem",color:"#e080ff",letterSpacing:2,marginBottom:8}}>{eventCard.name}</div>
              <div style={{color:"#cfc1a3",fontStyle:"italic",lineHeight:1.7,marginBottom:20}}>{eventCard.desc}</div>
              <button className="start-btn" onClick={resolveEvent}>Resolve</button>
            </div>
          </div>
        )}

        {phase==="victory"&&(
          <div className="victory-overlay">
            <div className="victory-card">
              <div style={{fontSize:"2.8rem",marginBottom:10}}>⚡</div>
              <div className="v-title">Victory!</div>
              <div className="v-text">{modChallengeRooms?"All four objectives solved!":"All shards forged. Obryndel is free!"}</div>
              <button className="start-btn" onClick={()=>{setPhase("setup");setPlayerCount(null);onExit?.();}}>Play Again</button>
            </div>
          </div>
        )}

        {allGathered&&!modChallengeRooms&&(
          <div className="banner" style={{width:"100%",maxWidth:700,marginBottom:8}}>
            ⚡ Barrier shattered! Enter the Kingdom of Obryndel!
          </div>
        )}

        <div className="game-layout">
          <Board3D
            grid={grid} mazeWalls={mazeWalls} gridSize={gs}
            objects={objects} vanished={vanished}
            positions={positions} inKingdom={inKingdom} kPositions={kPositions}
            dead={dead} stunned={stunned} inventory={inventory} atBase={atBase}
            dropped={dropped} droppedPos={droppedPos}
            enemies={enemies} enemyActive={enemyActive}
            allGathered={allGathered} curPlayer={curPlayer}
            playerCount={playerCount} charChoices={charChoices}
            modExplore={modExplore} modColors={modColors} modBW={modBW}
            visibleCells={visibleCells} discoveredCells={discoveredCells}
            modChallengeRooms={modChallengeRooms} challengeState={challengeState}
            challengeAbilityTargets={challengeAbilityTargets}
            challengeAbilityMode={challengeAbilityMode}
            onCellClick={handleCellClick}
          />

          <div className="sidebar">
            <div className="s-card">
              <div className="s-hdr">{modChallengeRooms?"Active Character":"Current Turn"}</div>
              {modEnemy&&enemyActive&&inventory[cp]&&<div style={{display:"inline-block",background:"rgba(180,20,20,.28)",border:"1px solid rgba(220,60,60,.28)",borderRadius:6,padding:"2px 8px",fontSize:".66rem",color:"rgba(255,120,120,.8)",marginBottom:8}}>👁️ Shadow hunts you!</div>}
              <div className="p-ind">
                <div className="p-dot" style={{background:COLOR_HEX[PLAYER_COLORS[cp]],width:14,height:14,boxShadow:`0 0 8px ${COLOR_HEX[PLAYER_COLORS[cp]]}`}}/>
                <div className="p-nm">{cpChar?cpChar.name:PLAYER_NAMES[cp]}</div>
                {!modChallengeRooms&&inventory[cp]&&<span>⚡</span>}
                {!modChallengeRooms&&dead[cp]&&<span style={{fontSize:".7rem",color:"rgba(255,80,80,.7)",marginLeft:4}}>💀</span>}
                {!modChallengeRooms&&stunned[cp]>0&&<span className="stun-badge">💫</span>}
                {!modChallengeRooms&&abilityStepsLeft>0&&<span style={{fontSize:".68rem",color:"rgba(100,255,200,.8)",marginLeft:4}}>⚡{abilityStepsLeft}</span>}
                {!modChallengeRooms&&extraMove&&<span style={{fontSize:".68rem",color:"rgba(255,220,0,.8)",marginLeft:4}}>⚡Bonus</span>}
              </div>

              {cpChar&&(
                <div style={{padding:"6px 8px",borderRadius:7,background:"rgba(10,20,40,.6)",border:`1px solid ${cpChar.color}33`,marginBottom:7,fontSize:".65rem",color:"rgba(180,210,240,.7)"}}>
                  <span style={{fontFamily:"'Cinzel',serif",color:cpChar.color}}>{cpChar.abilityName}</span> — {cpChar.abilityDesc}
                  {!modChallengeRooms&&abilityCooldown[cp]>0&&<span style={{color:"rgba(255,150,100,.7)",marginLeft:6}}>(CD:{abilityCooldown[cp]})</span>}
                  {modChallengeRooms&&objectiveForActive&&challengeState&&(
                    <span style={{display:"block",marginTop:5,color:challengeState.completed?.[objectiveForActive]?"rgba(120,255,165,.86)":"rgba(245,190,120,.82)"}}>
                      Obj: {challengeObjectiveText[objectiveForActive]} {challengeState.completed?.[objectiveForActive]?"✓":"•"}
                    </span>
                  )}
                </div>
              )}

              <div className="ph-lbl">{modChallengeRooms?"No turns — click scoundrel, WASD, SPACE ability":`WASD move${modColors?" | Click tile swap":""}`}</div>
              <div style={{display:"flex",gap:9,alignItems:"flex-start",marginTop:4}}>
                <div className="wasd-g" style={{marginTop:0,flexShrink:0}}>
                  <div/><div className="wk">W</div><div/>
                  <div className="wk">A</div><div className="wk">S</div><div className="wk">D</div>
                </div>
                {modChallengeRooms&&<div className="sw-hint">{challengeAbilityMode?"Click a lit target (red) or SPACE to cancel.":"Press SPACE to enter ability targeting."}</div>}
              </div>
              {modEnemy&&inventory[cp]&&!dead[cp]&&<button className="drop-btn" onClick={handleDrop}>💧 Drop Relic</button>}
              {cpChar&&!dead[cp]&&(
                modChallengeRooms
                  ?<button className={`ability-btn${challengeAbilityMode?" active-target":""}`} onClick={useAbility}>{challengeAbilityMode?"⟨ Cancel (Space)":"✦ Use Ability (Space)"}</button>
                  :abilityCooldown[cp]===0&&<button className="ability-btn" onClick={useAbility}>✦ {cpChar.abilityName}</button>
              )}
            </div>

            <div className="s-card">
              <div className="s-hdr">Scoundrels</div>
              <div className="p-list">
                {Array.from({length:playerCount},(_,i)=>{
                  const obj=objects[i]||OBJECT_DEFS[i];const hasObj=inventory[i];const isDone=atBase[i];const isDead=dead[i];const hasDrop=dropped[i];const char=CHARACTERS.find(c=>c.id===charChoices[i]);
                  const oid=char?challengeObjectiveByChar[char.id]:null;const odone=!!(modChallengeRooms&&challengeState&&oid&&challengeState.completed?.[oid]);
                  return(
                    <div key={i} className={`p-row${i===cp?" cur":""}${(modChallengeRooms?odone:isDone)?" done":""}${isDead?" ded":""}`}
                      onClick={modChallengeRooms?()=>setCurPlayer(i):undefined} style={modChallengeRooms?{cursor:"pointer"}:undefined}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:COLOR_HEX[PLAYER_COLORS[i]],flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div className="p-rn" style={{color:COLOR_HEX[PLAYER_COLORS[i]]}}>{char?char.name:PLAYER_NAMES[i]}</div>
                        <div className="p-rs">{modChallengeRooms?(oid?`${odone?"✓":"○"} ${challengeObjectiveText[oid]}`:"..."):isDead?"Dead — ally revives":isDone?(allGathered?"Enter Obryndel!":"Relic delivered!"):hasObj?`Carrying — return!`:hasDrop?`Shard dropped!`:`Seek ${OBJECT_DEFS[i]?.label}`}</div>
                        {modChallengeRooms&&i!==cp&&<div style={{fontSize:".58rem",color:"rgba(140,170,210,.4)"}}>Click to control</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {modChallengeRooms&&challengeState&&(
              <div className="s-card">
                <div className="s-hdr">Objectives</div>
                <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:".7rem"}}>
                  {Object.entries(challengeObjectiveText).map(([k,v])=>(
                    <div key={k} style={{color:challengeState.completed[k]?"rgba(120,255,165,.86)":"rgba(210,180,120,.7)"}}>{challengeState.completed[k]?"✓":"○"} {v}</div>
                  ))}
                </div>
              </div>
            )}

            {(modColors||modVanish||modEnemy||modBW||modMaze||modExplore||modEvents||modChallengeRooms)&&(
              <div className="s-card">
                <div className="s-hdr">Modifiers</div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {modChallengeRooms&&<div style={{fontSize:".7rem",color:"rgba(180,180,180,.5)"}}>🚪 Ability Challenge</div>}
                  {modColors&&<div style={{fontSize:".7rem",color:"rgba(213,160,50,.5)"}}>🎨 Colored Tiles</div>}
                  {modMaze&&<div style={{fontSize:".7rem",color:"rgba(200,160,80,.5)"}}>🏚️ Maze</div>}
                  {modExplore&&<div style={{fontSize:".7rem",color:"rgba(150,150,200,.5)"}}>🌑 Vision {darkRadius}</div>}
                  {modVanish&&<div style={{fontSize:".7rem",color:"rgba(180,155,90,.45)"}}>💨 Vanishing ({vanished.size})</div>}
                  {modEnemy&&<div style={{fontSize:".7rem",color:"rgba(255,100,100,.45)"}}>👁️ Shadow {enemyActive?"hunting":"dormant"}</div>}
                  {modBW&&<div style={{fontSize:".7rem",color:"rgba(200,200,200,.35)"}}>🖤 B&W</div>}
                  {modEvents&&<div style={{fontSize:".7rem",color:"rgba(200,100,220,.45)"}}>🃏 Events</div>}
                </div>
              </div>
            )}

            <div className="s-card">
              <div className="s-hdr">Event Log</div>
              <div className="log-box">{log.map((l,i)=><div key={i}>{l}</div>)}</div>
            </div>

            <button className="start-btn" style={{fontSize:".76rem",padding:"8px 16px",opacity:.4}} onClick={()=>{setPhase("setup");setPlayerCount(null);onExit?.();}}>← Main Menu</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
