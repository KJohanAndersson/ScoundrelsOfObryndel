import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// GEOMETRY HELPERS (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
const PHI = (1 + Math.sqrt(5)) / 2;

function buildTIVerts() {
  const V = [];
  const push = (x, y, z) => {
    const l = Math.sqrt(x*x+y*y+z*z);
    V.push(new THREE.Vector3(x/l, y/l, z/l));
  };
  const t = PHI;
  for (const s1 of [1,-1]) for (const s2 of [1,-1]) {
    push(0,s1,s2*3*t); push(s1,s2*3*t,0); push(s2*3*t,0,s1);
  }
  const a=2+t, b=2*t;
  for (const s1 of [1,-1]) for (const s2 of [1,-1]) for (const s3 of [1,-1]) {
    push(s1,s2*a,s3*b); push(s2*a,s3*b,s1); push(s3*b,s1,s2*a);
  }
  const c=1+2*t;
  for (const s1 of [1,-1]) for (const s2 of [1,-1]) for (const s3 of [1,-1]) {
    push(s1*2,s2*c,s3*t); push(s2*c,s3*t,s1*2); push(s3*t,s1*2,s2*c);
  }
  return V;
}

function buildTITopology(V) {
  const n = V.length;
  const adj = Array.from({length:n},()=>[]);
  for (let i=0;i<n;i++)
    for (let j=i+1;j<n;j++)
      if (V[i].distanceTo(V[j])<0.46){adj[i].push(j);adj[j].push(i);}

  const sortedAdj = V.map((vi,i)=>{
    let ux=0,uy=1,uz=0;
    if (Math.abs(vi.y)>0.9){ux=1;uy=0;uz=0;}
    const d=ux*vi.x+uy*vi.y+uz*vi.z;
    ux-=d*vi.x;uy-=d*vi.y;uz-=d*vi.z;
    const ul=Math.sqrt(ux*ux+uy*uy+uz*uz);ux/=ul;uy/=ul;uz/=ul;
    const vx=vi.y*uz-vi.z*uy,vy=vi.z*ux-vi.x*uz,vz=vi.x*uy-vi.y*ux;
    return adj[i]
      .map(j=>{const dx=V[j].x-vi.x,dy=V[j].y-vi.y,dz=V[j].z-vi.z;return{j,a:Math.atan2(dx*vx+dy*vy+dz*vz,dx*ux+dy*uy+dz*uz)};})
      .sort((a,b)=>a.a-b.a).map(x=>x.j);
  });

  const faces=[];const used=new Set();
  for (let i=0;i<n;i++){
    for (const j of sortedAdj[i]){
      if (used.has(i*n+j)) continue;
      const face=[i];let u=i,v=j;
      for (let s=0;s<8;s++){
        used.add(u*n+v);face.push(v);
        if (v===i) break;
        const nb=sortedAdj[v];const idx=nb.indexOf(u);
        const next=nb[(idx+1)%nb.length];u=v;v=next;
      }
      if (face[face.length-1]===face[0]){
        face.pop();
        if (face.length===5||face.length===6) faces.push(face);
      }
    }
  }

  const centroids=faces.map(f=>{
    const c=new THREE.Vector3();
    f.forEach(i=>c.add(V[i]));
    return c.divideScalar(f.length).normalize();
  });

  const fAdj=Array.from({length:faces.length},()=>[]);
  for (let i=0;i<faces.length;i++){
    for (let j=i+1;j<faces.length;j++){
      const fi=faces[i],fj=faces[j];
      const shared=fi.filter(v=>fj.includes(v));
      if (shared.length<2) continue;
      const [a,b]=shared;
      const ai=fi.indexOf(a),bi=fi.indexOf(b);
      const consec=Math.abs(ai-bi)===1||(ai===0&&bi===fi.length-1)||(bi===0&&ai===fi.length-1);
      if (consec){fAdj[i].push(j);fAdj[j].push(i);}
    }
  }
  return {faces,centroids,fAdj};
}

function buildGoldberg(targetFaces) {
  if (targetFaces===32) return buildTITopology(buildTIVerts());
  const subdiv=targetFaces===42?2:3;
  const t=(1+Math.sqrt(5))/2;
  const rawVerts=[
    [-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],
    [0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],
    [t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1],
  ].map(([x,y,z])=>{const l=Math.sqrt(x*x+y*y+z*z);return new THREE.Vector3(x/l,y/l,z/l);});

  const icoFaces=[
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];

  const verts=rawVerts.map(v=>v.clone());
  const midCache=new Map();
  const getMid=(a,b)=>{
    const key=a<b?`${a}_${b}`:`${b}_${a}`;
    if (midCache.has(key)) return midCache.get(key);
    const mid=verts[a].clone().add(verts[b]).normalize();
    verts.push(mid);
    const idx=verts.length-1;
    midCache.set(key,idx);
    return idx;
  };

  let triFaces=icoFaces;
  for (let s=0;s<subdiv;s++){
    const nf=[];
    for (const [a,b,c] of triFaces){
      const ab=getMid(a,b),bc=getMid(b,c),ca=getMid(c,a);
      nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);
    }
    triFaces=nf;
  }

  const triCentroids=triFaces.map(f=>{
    const c=new THREE.Vector3();
    f.forEach(i=>c.add(verts[i]));
    return c.divideScalar(f.length).normalize();
  });

  const vertToFaces=new Map();
  triFaces.forEach((f,fi)=>{
    f.forEach(vi=>{
      if (!vertToFaces.has(vi)) vertToFaces.set(vi,[]);
      vertToFaces.get(vi).push(fi);
    });
  });

  const dualFaces=[],dualCentroids=[];
  vertToFaces.forEach((faceIndices,vi)=>{
    if (faceIndices.length<3) return;
    const norm=verts[vi].clone();
    let ux=0,uy=1,uz=0;
    if (Math.abs(norm.y)>0.9){ux=1;uy=0;uz=0;}
    const d2=ux*norm.x+uy*norm.y+uz*norm.z;
    ux-=d2*norm.x;uy-=d2*norm.y;uz-=d2*norm.z;
    const ul=Math.sqrt(ux*ux+uy*uy+uz*uz);ux/=ul;uy/=ul;uz/=ul;
    const vvx=norm.y*uz-norm.z*uy,vvy=norm.z*ux-norm.x*uz,vvz=norm.x*uy-norm.y*ux;
    const sorted=faceIndices
      .map(fi=>{const c=triCentroids[fi];return{fi,angle:Math.atan2(c.x*vvx+c.y*vvy+c.z*vvz,c.x*ux+c.y*uy+c.z*uz)};})
      .sort((a,b)=>a.angle-b.angle).map(x=>x.fi);
    dualFaces.push(sorted);
    const centroid=new THREE.Vector3();
    sorted.forEach(fi=>centroid.add(triCentroids[fi]));
    dualCentroids.push(centroid.divideScalar(sorted.length).normalize());
  });

  const nDual=dualFaces.length;
  const fAdj=Array.from({length:nDual},()=>[]);
  for (let i=0;i<nDual;i++)
    for (let j=i+1;j<nDual;j++)
      if (dualFaces[i].filter(v=>dualFaces[j].includes(v)).length>=2){fAdj[i].push(j);fAdj[j].push(i);}

  return {faces:dualFaces,centroids:dualCentroids,fAdj,verts:triCentroids};
}

function buildTileMesh(face,V,centroid,SR,inset) {
  const norm=centroid.clone();
  let ux=0,uy=1,uz=0;
  if (Math.abs(norm.y)>0.9){ux=1;uy=0;uz=0;}
  const d=ux*norm.x+uy*norm.y+uz*norm.z;
  ux-=d*norm.x;uy-=d*norm.y;uz-=d*norm.z;
  const ul=Math.sqrt(ux*ux+uy*uy+uz*uz);ux/=ul;uy/=ul;uz/=ul;
  const vx=norm.y*uz-norm.z*uy,vy=norm.z*ux-norm.x*uz,vz=norm.x*uy-norm.y*ux;
  const tu=new THREE.Vector3(ux,uy,uz),tv=new THREE.Vector3(vx,vy,vz);
  const center3=centroid.clone().multiplyScalar(SR);
  const verts3=face
    .map(i=>({p:V[i].clone().multiplyScalar(SR)}))
    .map(({p})=>{const d2=p.clone().sub(center3);return{p,angle:Math.atan2(d2.dot(tv),d2.dot(tu))};})
    .sort((a,b)=>a.angle-b.angle).map(x=>x.p);
  const nv=verts3.length;
  const insetVerts=verts3.map(p=>center3.clone().lerp(p,inset).normalize().multiplyScalar(SR));
  const positions=[],normals=[];
  for (let k=0;k<nv;k++){
    const vA=center3,vB=insetVerts[k],vC=insetVerts[(k+1)%nv];
    positions.push(vA.x,vA.y,vA.z,vB.x,vB.y,vB.z,vC.x,vC.y,vC.z);
    [vA,vB,vC].forEach(v=>{const nn=v.clone().normalize();normals.push(nn.x,nn.y,nn.z);});
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  return geo;
}

function bfsPath(fAdj,start,end) {
  if (start===end) return [start];
  const prev=new Array(fAdj.length).fill(-1);
  const vis=new Set([start]);const q=[start];
  while (q.length){
    const cur=q.shift();
    for (const nb of fAdj[cur]){
      if (!vis.has(nb)){
        vis.add(nb);prev[nb]=cur;q.push(nb);
        if (nb===end){const path=[];let c=end;while(c!==-1){path.unshift(c);c=prev[c];}return path;}
      }
    }
  }
  return [start];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS — UPDATED CHARACTER COLORS
// ─────────────────────────────────────────────────────────────────────────────
const SR = 2.5;

// Updated colors: Goblin=green, Orc=red, Cyclops=yellow, Witch=blue
const PH = [0x22cc44, 0xdd2222, 0xeecc00, 0x2266ff];
const PC = ['#22cc44', '#dd2222', '#eecc00', '#2266ff'];
const PN = ['Goblin', 'Orc', 'Cyclops', 'Witch'];
const OFFSETS = [[-0.07,-0.07],[0.07,-0.07],[-0.07,0.07],[0.07,0.07]];
const NUM_CRYSTALS = 4;
const CRYSTAL_COLORS = [0x00ffcc, 0xff00aa, 0x44aaff, 0xffaa00];
const CRYSTAL_PC = ['#00ffcc','#ff00aa','#44aaff','#ffaa00'];

const COL_DEFAULT = new THREE.Color(0x0d1a40);
const COL_HOVER   = new THREE.Color(0x1a3a9a);
const COL_CAPITAL = new THREE.Color(0xffcc00);

// Sandbox placement / interaction modes
const MODE_NONE        = 'none';
const MODE_PLACE       = 'place';
const MODE_REMOVE      = 'remove';
const MODE_MOVE_FROM   = 'move_from';
const MODE_MOVE_TO     = 'move_to';
const MODE_SPRINT      = 'sprint';       // Goblin: click 2nd tile to move again
const MODE_RIFT_TARGET = 'rift_target';  // Witch: click entity tile
const MODE_RIFT_DEST   = 'rift_dest';    // Witch: click destination tile

const ABILITY_COOLDOWN = 8;

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SANDBOX COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SphereQuestSandbox({ onExit }) {
  const mountRef = useRef(null);
  const T = useRef(null);
  const MR = useRef({});
  const GS = useRef(null);
  const rot = useRef({x:0.3,y:0});
  const rotT = useRef({x:0.3,y:0});
  const keys = useRef({});
  const drag = useRef({on:false,x:0,y:0});

  const [ready, setReady] = useState(false);
  const [tileCount, setTileCount] = useState(32);
  const [phase, setPhase] = useState('idle');

  // Sandbox interaction state
  const [mode, setMode] = useState(MODE_NONE);
  const [placeEntity, setPlaceEntity] = useState(null);
  const [moveFromFi, setMoveFromFi] = useState(null);
  const [moveEntity, setMoveEntity] = useState(null);
  // Abilities
  const [abilityCooldowns, setAbilityCooldowns] = useState([0,0,0,0]);
  const [enemyStunned, setEnemyStunned] = useState(0);
  const [taunted, setTaunted] = useState(-1);
  const [tauntRounds, setTauntRounds] = useState(0);
  const [riftTargetEnt, setRiftTargetEnt] = useState(null);
  const [sprintPlayer, setSprintPlayer] = useState(null);
  const [log, setLog] = useState([]);

  // Mirror of GS for UI
  const [ui, setUi] = useState(null);

  const addLog = useCallback((msg, color='#c8b4ff') => {
    setLog(l=>[{msg,color,id:Date.now()+Math.random()},...l].slice(0,8));
  }, []);

  const getQ = () => {
    const q=new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(rot.current.x,rot.current.y,0,'YXZ'));
    return q;
  };

  // ── Three.js setup ──────────────────────────────────────────────────────
  useEffect(()=>{
    const el=mountRef.current;
    const W=el.clientWidth||window.innerWidth;
    const H=el.clientHeight||window.innerHeight;
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
    renderer.setSize(W,H);renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    el.appendChild(renderer.domElement);

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(44,W/H,0.1,200);
    camera.position.z=8.2;

    scene.add(new THREE.AmbientLight(0x4455cc,2.2));
    const dl=new THREE.DirectionalLight(0xaabbff,3.0);dl.position.set(5,8,6);scene.add(dl);
    const rl=new THREE.DirectionalLight(0x8866ff,1.2);rl.position.set(-6,-3,-5);scene.add(rl);

    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(SR-0.01,64,64),
      new THREE.MeshStandardMaterial({color:0x08103a,roughness:0.8,side:THREE.BackSide,emissive:0x060e30,emissiveIntensity:0.5})
    ));

    const sv=new Float32Array(9000);
    for (let i=0;i<sv.length;i++) sv[i]=(Math.random()-0.5)*160;
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sv,3));
    scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0xaabbff,size:0.055})));

    T.current={renderer,scene,camera};
    setReady(true);

    let aid;
    const animate=()=>{
      aid=requestAnimationFrame(animate);
      const spd=0.025;
      if (keys.current['w']||keys.current['W']) rotT.current.x-=spd;
      if (keys.current['s']||keys.current['S']) rotT.current.x+=spd;
      if (keys.current['a']||keys.current['A']) rotT.current.y-=spd;
      if (keys.current['d']||keys.current['D']) rotT.current.y+=spd;
      rotT.current.x=Math.max(-1.5,Math.min(1.5,rotT.current.x));
      rot.current.x+=(rotT.current.x-rot.current.x)*0.1;
      rot.current.y+=(rotT.current.y-rot.current.y)*0.1;
      const q=getQ();
      scene.children.forEach(c=>{
        if (!c.userData.basePos) return;
        c.position.copy(c.userData.basePos.clone().applyQuaternion(q));
        if (c.userData.baseQ) c.quaternion.copy(q).multiply(c.userData.baseQ);
      });
      if (MR.current.tileGroup) MR.current.tileGroup.quaternion.copy(q);

      // Animate crystal pulses
      const gs=GS.current;
      const t2=Date.now()*0.002;
      if (MR.current.crystalMeshes&&gs){
        MR.current.crystalMeshes.forEach((mesh,i)=>{
          if (!mesh||gs.destroyedCrystals.has(i)){mesh&&(mesh.visible=false);return;}
          mesh.visible=true;
          mesh.material.emissiveIntensity=0.5+0.4*Math.sin(t2*2.5+i*1.5);
        });
      }
      if (MR.current.enemy&&gs&&gs.enemyFace>=0){
        MR.current.enemy.material.emissiveIntensity=0.4+0.35*Math.sin(t2*4);
      }
      renderer.render(scene,camera);
    };
    animate();
    T.current.stopAnim=()=>cancelAnimationFrame(aid);

    const onResize=()=>{
      const w2=el.clientWidth,h2=el.clientHeight;
      renderer.setSize(w2,h2);camera.aspect=w2/h2;camera.updateProjectionMatrix();
    };
    window.addEventListener('resize',onResize);
    return ()=>{
      T.current.stopAnim?.();window.removeEventListener('resize',onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  },[]);

  useEffect(()=>{
    const kd=e=>{keys.current[e.key]=true;};
    const ku=e=>{keys.current[e.key]=false;};
    window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);
    return ()=>{window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);};
  },[]);

  useEffect(()=>{
    const el=mountRef.current;
    const onMD=e=>{drag.current={on:true,x:e.clientX,y:e.clientY};};
    const onMM=e=>{
      if (!drag.current.on) return;
      rotT.current.y+=(e.clientX-drag.current.x)*0.008;
      rotT.current.x+=(e.clientY-drag.current.y)*0.008;
      drag.current={on:true,x:e.clientX,y:e.clientY};
    };
    const onMU=()=>{drag.current.on=false;};
    const onTS=e=>{if(e.touches.length===1) drag.current={on:true,x:e.touches[0].clientX,y:e.touches[0].clientY};};
    const onTM=e=>{
      if (!drag.current.on||e.touches.length!==1) return;
      e.preventDefault();
      rotT.current.y+=(e.touches[0].clientX-drag.current.x)*0.008;
      rotT.current.x+=(e.touches[0].clientY-drag.current.y)*0.008;
      drag.current={on:true,x:e.touches[0].clientX,y:e.touches[0].clientY};
    };
    el.addEventListener('mousedown',onMD);window.addEventListener('mousemove',onMM);window.addEventListener('mouseup',onMU);
    el.addEventListener('touchstart',onTS);el.addEventListener('touchmove',onTM,{passive:false});window.addEventListener('touchend',onMU);
    return ()=>{
      el.removeEventListener('mousedown',onMD);window.removeEventListener('mousemove',onMM);window.removeEventListener('mouseup',onMU);
      el.removeEventListener('touchstart',onTS);el.removeEventListener('touchmove',onTM);window.removeEventListener('touchend',onMU);
    };
  },[]);

  // ── Place helpers ────────────────────────────────────────────────────────
  const placeMeshOnFace = useCallback((mesh, fi, heightOffset=0.2) => {
    const gs=GS.current;
    const norm=gs.centroids[fi].clone().normalize();
    const pos=norm.clone().multiplyScalar(SR+heightOffset);
    mesh.userData.basePos=pos.clone();
    mesh.position.copy(pos.clone().applyQuaternion(getQ()));
  },[]);

  const placePlayerMesh = useCallback((mesh, fi, pidx) => {
    const gs=GS.current;
    const norm=gs.centroids[fi].clone().normalize();
    const c=norm.clone().multiplyScalar(SR+0.18);
    const up=Math.abs(norm.y)<0.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
    const tu=new THREE.Vector3().crossVectors(norm,up).normalize();
    const tv=new THREE.Vector3().crossVectors(norm,tu).normalize();
    c.addScaledVector(tu,OFFSETS[pidx][0]).addScaledVector(tv,OFFSETS[pidx][1]);
    mesh.userData.basePos=c.clone();
    mesh.position.copy(c.clone().applyQuaternion(getQ()));
  },[]);

  // ── Sync UI state ────────────────────────────────────────────────────────
  const syncUI = useCallback(() => {
    const gs=GS.current;
    if (!gs) return;
    setUi({
      pp:[...gs.pp],
      enemyFace:gs.enemyFace,
      crystalFaces:[...gs.crystalFaces],
      destroyedCrystals:new Set(gs.destroyedCrystals),
      capitalFace:gs.capitalFace,
    });
  },[]);

  // ── Refresh all visuals ──────────────────────────────────────────────────
  const refreshAll = useCallback((currentMode=MODE_NONE, hoverFi=-1) => {
    const gs=GS.current;
    const mr=MR.current;
    if (!gs||!mr.tiles) return;

    mr.tiles.forEach(mesh=>{
      const fi=mesh.userData.fi;
      const isCapital=fi===gs.capitalFace;
      const crystalIdx=gs.crystalFaces.indexOf(fi);
      const isCrystal=crystalIdx>=0&&!gs.destroyedCrystals.has(crystalIdx);
      const isHover=fi===hoverFi;

      if (isCapital){
        mesh.material.color.setHex(0x2a1800);
        mesh.material.emissive.setHex(0xffcc00);
        mesh.material.emissiveIntensity=0.25;
      } else if (isCrystal){
        mesh.material.color.setHex(0x001a15);
        mesh.material.emissive.setHex(CRYSTAL_COLORS[crystalIdx]);
        mesh.material.emissiveIntensity=0.35;
      } else if (isHover){
        mesh.material.color.copy(COL_HOVER);
        mesh.material.emissive.setHex(0x304080);
        mesh.material.emissiveIntensity=0.5;
      } else {
        mesh.material.color.copy(COL_DEFAULT);
        mesh.material.emissive.setHex(0x050a20);
        mesh.material.emissiveIntensity=0.08;
      }
    });

    // Players
    for (let p=0;p<4;p++){
      if (!mr.players[p]) continue;
      if (gs.pp[p]<0){mr.players[p].visible=false;continue;}
      mr.players[p].visible=true;
      placePlayerMesh(mr.players[p],gs.pp[p],p);
    }

    // Enemy
    if (mr.enemy){
      if (gs.enemyFace<0){mr.enemy.visible=false;}
      else {mr.enemy.visible=true;placeMeshOnFace(mr.enemy,gs.enemyFace,0.28);}
    }

    // Crystals
    if (mr.crystalMeshes){
      mr.crystalMeshes.forEach((mesh,i)=>{
        if (!mesh) return;
        if (gs.destroyedCrystals.has(i)){mesh.visible=false;return;}
        if (gs.crystalFaces[i]<0){mesh.visible=false;return;}
        mesh.visible=true;
        placeMeshOnFace(mesh,gs.crystalFaces[i],0.25);
      });
    }
  },[placeMeshOnFace,placePlayerMesh]);

  // ── Build sphere ─────────────────────────────────────────────────────────
  const buildSphere = useCallback((tc) => {
    const {scene}=T.current||{};
    if (!scene) return;

    scene.children.filter(c=>c.userData.isGame).forEach(c=>scene.remove(c));
    MR.current={};

    const {faces,centroids,fAdj,verts}=buildGoldberg(tc);
    const V=verts||buildTIVerts();
    const q=getQ();

    // Capital: bottom tile
    let capitalFace=0;
    centroids.forEach((c,i)=>{if(c.y<centroids[capitalFace].y) capitalFace=i;});

    // Crystals: 4 spread positions
    const crystalFaces=[];
    const candidates=[];
    for (let i=0;i<faces.length;i++){
      if (i!==capitalFace) candidates.push(i);
    }
    const usedC=new Set([capitalFace]);
    for (let c=0;c<NUM_CRYSTALS&&candidates.length>0;c++){
      let best=-1,bestScore=-Infinity;
      for (const ci of candidates){
        if (usedC.has(ci)) continue;
        let minD=Infinity;
        crystalFaces.forEach(cf=>{const dx=centroids[cf].x-centroids[ci].x,dy=centroids[cf].y-centroids[ci].y,dz=centroids[cf].z-centroids[ci].z;const d=Math.sqrt(dx*dx+dy*dy+dz*dz);if(d<minD)minD=d;});
        if (crystalFaces.length===0) minD=999;
        if (minD>bestScore){bestScore=minD;best=ci;}
      }
      if (best>=0){crystalFaces.push(best);usedC.add(best);}
    }

    // Start: top tile
    let sf=0;
    centroids.forEach((c,i)=>{if(c.y>centroids[sf].y)sf=i;});

    // Tiles
    const tileMeshes=[];
    faces.forEach((face,fi)=>{
      const mat=new THREE.MeshStandardMaterial({roughness:0.45,metalness:0.35,emissive:new THREE.Color(0x050a20),emissiveIntensity:0.08});
      mat.color.copy(COL_DEFAULT);
      const geo=buildTileMesh(face,V,centroids[fi],SR,0.94);
      const mesh=new THREE.Mesh(geo,mat);
      mesh.userData={fi,isGame:true};
      tileMeshes.push(mesh);
    });
    MR.current.tiles=tileMeshes;

    const tileGroup=new THREE.Group();
    tileGroup.userData={isGame:true};
    tileMeshes.forEach(m=>tileGroup.add(m));
    tileGroup.quaternion.copy(q);
    scene.add(tileGroup);
    MR.current.tileGroup=tileGroup;

    // Players
    const players=PH.map((col,p)=>{
      const mesh=new THREE.Mesh(
        new THREE.SphereGeometry(0.09,16,16),
        new THREE.MeshStandardMaterial({color:col,roughness:0.2,metalness:0.55,emissive:col,emissiveIntensity:0.65})
      );
      mesh.userData={isGame:true};
      mesh.visible=false;
      scene.add(mesh);
      return mesh;
    });
    MR.current.players=players;

    // Enemy
    const enemyMesh=new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshStandardMaterial({color:0x110000,emissive:0x660000,emissiveIntensity:0.7,roughness:0.2,metalness:0.9})
    );
    enemyMesh.userData={isGame:true};
    enemyMesh.visible=false;
    scene.add(enemyMesh);
    MR.current.enemy=enemyMesh;

    // Crystals
    const crystalMeshes=crystalFaces.map((cf,i)=>{
      const crystalMesh=new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11,0),
        new THREE.MeshStandardMaterial({color:CRYSTAL_COLORS[i],emissive:CRYSTAL_COLORS[i],emissiveIntensity:0.6,roughness:0.1,metalness:0.5,transparent:true,opacity:0.9})
      );
      crystalMesh.userData={isGame:true};
      crystalMesh.visible=false; // will be shown after placing
      scene.add(crystalMesh);
      return crystalMesh;
    });
    // Fill to 4
    while (crystalMeshes.length<NUM_CRYSTALS){
      const i=crystalMeshes.length;
      const m=new THREE.Mesh(
        new THREE.OctahedronGeometry(0.11,0),
        new THREE.MeshStandardMaterial({color:CRYSTAL_COLORS[i],emissive:CRYSTAL_COLORS[i],emissiveIntensity:0.6,roughness:0.1,metalness:0.5,transparent:true,opacity:0.9})
      );
      m.userData={isGame:true};m.visible=false;
      scene.add(m);crystalMeshes.push(m);
    }
    MR.current.crystalMeshes=crystalMeshes;

    const gs={
      faces,centroids,fAdj,
      pp:[-1,-1,-1,-1], // -1 = not placed
      enemyFace:-1,
      capitalFace,
      crystalFaces:[...crystalFaces], // starting positions
      destroyedCrystals:new Set(),
    };
    GS.current=gs;
    setPhase('sandbox');
    setMode(MODE_NONE);
    setLog([]);
    addLog('🗺 Sandbox ready — place pieces from the panel','#aaffcc');
    syncUI();
    refreshAll();
  },[syncUI,refreshAll,addLog]);

  // ── Handle tile click ────────────────────────────────────────────────────
  const handleTileClick = useCallback((fi) => {
    const gs=GS.current;
    if (!gs) return;

    const currentMode=modeRef.current;
    const currentPlaceEntity=placeEntityRef.current;

    // ── SPRINT: second move for Goblin ──
    if (currentMode===MODE_SPRINT) {
      const p=sprintPlayerRef.current;
      if (p===null) return;
      const gs=GS.current;
      if (!gs.fAdj[gs.pp[p]]?.includes(fi)) { addLog('Sprint: pick an adjacent tile','#22cc44'); return; }
      const crystalIdx=gs.crystalFaces.indexOf(fi);
      if (crystalIdx>=0&&!gs.destroyedCrystals.has(crystalIdx)){
        gs.destroyedCrystals.add(crystalIdx);
        addLog(`💎 Goblin sprint destroyed crystal ${crystalIdx+1}!`,CRYSTAL_PC[crystalIdx]);
      }
      gs.pp[p]=fi;
      addLog(`👟 Goblin sprint → tile ${fi}`,'#22cc44');
      setAbilityCooldowns(cd=>{const n=[...cd];n[0]=ABILITY_COOLDOWN;return n;});
      setSprintPlayer(null);
      setMode(MODE_NONE);
      refreshAll();syncUI();
      return;
    }

    // ── RIFT: pick target entity ──
    if (currentMode===MODE_RIFT_TARGET) {
      let found=null;
      for (let p=0;p<4;p++){if(gs.pp[p]===fi){found=`p${p}`;break;}}
      if (!found&&gs.enemyFace===fi) found='enemy';
      if (found){
        setRiftTargetEnt(found);
        setMode(MODE_RIFT_DEST);
        addLog(`🌀 Now click any empty tile to teleport ${found==='enemy'?'King Thobrick':PN[parseInt(found[1])]}`,'#2266ff');
      } else {
        addLog('Rift: click a player or King Thobrick to teleport','#2266ff');
      }
      return;
    }

    // ── RIFT: pick destination ──
    if (currentMode===MODE_RIFT_DEST) {
      const ent=riftTargetEntRef.current;
      const occupied=gs.pp.some((p,i)=>p===fi)||gs.enemyFace===fi;
      if (occupied){ addLog('Rift: that tile is occupied — pick an empty one','#ff8800'); return; }
      if (ent?.startsWith('p')){
        const p=parseInt(ent[1]);
        const crystalIdx=gs.crystalFaces.indexOf(fi);
        if (crystalIdx>=0&&!gs.destroyedCrystals.has(crystalIdx)){
          gs.destroyedCrystals.add(crystalIdx);
          addLog(`💎 ${PN[p]} rift-landed on crystal ${crystalIdx+1}!`,CRYSTAL_PC[crystalIdx]);
        }
        gs.pp[p]=fi;
        addLog(`🌀 ${PN[p]} teleported to tile ${fi}`,'#2266ff');
      } else if (ent==='enemy'){
        gs.enemyFace=fi;
        addLog(`🌀 King Thobrick teleported to tile ${fi}`,'#2266ff');
      }
      setAbilityCooldowns(cd=>{const n=[...cd];n[3]=ABILITY_COOLDOWN;return n;});
      setRiftTargetEnt(null);
      setMode(MODE_NONE);
      refreshAll();syncUI();
      return;
    }

    // ── PLACE ──
    if (currentMode===MODE_PLACE&&currentPlaceEntity){
      const ent=currentPlaceEntity;
      if (ent.startsWith('p')){
        const p=parseInt(ent[1]);
        gs.pp[p]=fi;
        addLog(`${PN[p]} placed on tile ${fi}`,PC[p]);
      } else if (ent==='enemy'){
        gs.enemyFace=fi;
        addLog(`👁 King Thobrick placed on tile ${fi}`,'#ff5555');
      } else if (ent.startsWith('crystal')){
        const ci=parseInt(ent.replace('crystal',''));
        gs.crystalFaces[ci]=fi;
        gs.destroyedCrystals.delete(ci);
        addLog(`💎 Crystal ${ci+1} placed on tile ${fi}`,CRYSTAL_PC[ci]);
      }
      refreshAll(MODE_NONE,-1);
      syncUI();
      setMode(MODE_NONE);
      setPlaceEntity(null);
      return;
    }

    // ── REMOVE ──
    if (currentMode===MODE_REMOVE){
      let removed=false;
      for (let p=0;p<4;p++){
        if (gs.pp[p]===fi){gs.pp[p]=-1;addLog(`${PN[p]} removed`,'#888888');removed=true;}
      }
      if (gs.enemyFace===fi){gs.enemyFace=-1;addLog('King Thobrick removed','#888888');removed=true;}
      gs.crystalFaces.forEach((cf,ci)=>{
        if (cf===fi&&!gs.destroyedCrystals.has(ci)){gs.crystalFaces[ci]=-1;addLog(`Crystal ${ci+1} removed`,'#888888');removed=true;}
      });
      if (!removed) addLog('Nothing on that tile','#666666');
      refreshAll(MODE_NONE,-1);
      syncUI();
      setMode(MODE_NONE);
      return;
    }

    // ── MOVE FROM ──
    if (currentMode===MODE_MOVE_FROM){
      let found=null;
      for (let p=0;p<4;p++){if(gs.pp[p]===fi){found=`p${p}`;break;}}
      if (!found&&gs.enemyFace===fi) found='enemy';
      if (!found) gs.crystalFaces.forEach((cf,ci)=>{if(cf===fi&&!gs.destroyedCrystals.has(ci)) found=`crystal${ci}`;});
      if (found){
        setMoveEntity(found);
        setMoveFromFi(fi);
        setMode(MODE_MOVE_TO);
        addLog(`Click destination for ${found}`,'#ffcc88');
      } else {
        addLog('No entity on that tile','#666666');
      }
      return;
    }

    // ── MOVE TO ──
    if (currentMode===MODE_MOVE_TO){
      const ent=moveEntityRef.current;
      if (ent){
        if (ent.startsWith('p')){
          const p=parseInt(ent[1]);
          const crystalIdx=gs.crystalFaces.indexOf(fi);
          if (crystalIdx>=0&&!gs.destroyedCrystals.has(crystalIdx)){
            gs.destroyedCrystals.add(crystalIdx);
            addLog(`💎 ${PN[p]} destroyed crystal ${crystalIdx+1}!`,CRYSTAL_PC[crystalIdx]);
          }
          gs.pp[p]=fi;
          addLog(`${PN[p]} moved to tile ${fi}`,PC[p]);
        } else if (ent==='enemy'){
          gs.enemyFace=fi;
          addLog(`King Thobrick moved to tile ${fi}`,'#ff5555');
        } else if (ent.startsWith('crystal')){
          const ci=parseInt(ent.replace('crystal',''));
          gs.crystalFaces[ci]=fi;
          addLog(`Crystal ${ci+1} moved to tile ${fi}`,CRYSTAL_PC[ci]);
        }
      }
      refreshAll(MODE_NONE,-1);
      syncUI();
      setMode(MODE_NONE);
      setMoveEntity(null);
      setMoveFromFi(null);
      return;
    }
  },[addLog,refreshAll,syncUI]);

  // ── Ability: Goblin Sprint ───────────────────────────────────────────────
  const useSprintAbility = useCallback((p) => {
    const gs=GS.current;if(!gs) return;
    if (gs.pp[p]<0){addLog('Place Goblin on the board first','#888');return;}
    if (abilityCooldowns[0]>0){addLog(`Sprint on cooldown (${abilityCooldowns[0]} uses remaining)`,'#888');return;}
    setSprintPlayer(p);
    setMode(MODE_SPRINT);
    addLog(`👟 Goblin Sprint — click an adjacent tile for a bonus move`,'#22cc44');
  },[abilityCooldowns,addLog]);

  // ── Ability: Orc Taunt ───────────────────────────────────────────────────
  const useTauntAbility = useCallback((p) => {
    if (abilityCooldowns[1]>0){addLog(`Taunt on cooldown (${abilityCooldowns[1]} uses remaining)`,'#888');return;}
    const rounds=2;
    setTaunted(p);
    setTauntRounds(rounds);
    setAbilityCooldowns(cd=>{const n=[...cd];n[1]=ABILITY_COOLDOWN;return n;});
    addLog(`😤 Orc Taunt — King Thobrick is fixated on the Orc for ${rounds} actions`,'#dd2222');
  },[abilityCooldowns,addLog]);

  // ── Ability: Cyclops Stun ────────────────────────────────────────────────
  const useStunAbility = useCallback((p) => {
    const gs=GS.current;if(!gs) return;
    if (abilityCooldowns[2]>0){addLog(`Stun on cooldown (${abilityCooldowns[2]} uses remaining)`,'#888');return;}
    if (gs.pp[p]<0){addLog('Place Cyclops on the board first','#888');return;}
    if (gs.enemyFace<0){addLog('King Thobrick is not on the board','#888');return;}
    const adjToPlayer=gs.fAdj[gs.pp[p]]||[];
    const inRange=gs.enemyFace===gs.pp[p]||adjToPlayer.includes(gs.enemyFace);
    if (!inRange){addLog('⚡ King Thobrick is too far to stun (must be adjacent)','#ff8800');return;}
    const stunDuration=2;
    setEnemyStunned(stunDuration);
    setAbilityCooldowns(cd=>{const n=[...cd];n[2]=ABILITY_COOLDOWN;return n;});
    addLog(`⚡ Cyclops Stun — King Thobrick stunned for ${stunDuration} actions!`,'#eecc00');
  },[abilityCooldowns,addLog]);

  // ── Ability: Witch Rift ──────────────────────────────────────────────────
  const useRiftAbility = useCallback(() => {
    if (abilityCooldowns[3]>0){addLog(`Rift on cooldown (${abilityCooldowns[3]} uses remaining)`,'#888');return;}
    setMode(MODE_RIFT_TARGET);
    setRiftTargetEnt(null);
    addLog(`🌀 Witch Rift — click a player or King Thobrick to teleport`,'#2266ff');
  },[abilityCooldowns,addLog]);

  // ── Decrement cooldowns (manual "end round" button) ──────────────────────
  const tickCooldowns = useCallback(() => {
    setAbilityCooldowns(cd=>cd.map(c=>Math.max(0,c-1)));
    setEnemyStunned(s=>Math.max(0,s-1));
    setTauntRounds(r=>{
      const next=Math.max(0,r-1);
      if (next<=0&&taunted>=0){setTaunted(-1);addLog('😈 King Thobrick freed from taunt!','#ffaa44');}
      return next;
    });
    addLog('⏭ Round ticked — cooldowns reduced','#888899');
  },[taunted,addLog]);

  // Refs for mode/placeEntity so click handler always has current values
  const modeRef=useRef(MODE_NONE);
  const placeEntityRef=useRef(null);
  const moveEntityRef=useRef(null);
  const riftTargetEntRef=useRef(null);
  const sprintPlayerRef=useRef(null);
  useEffect(()=>{modeRef.current=mode;},[mode]);
  useEffect(()=>{placeEntityRef.current=placeEntity;},[placeEntity]);
  useEffect(()=>{moveEntityRef.current=moveEntity;},[moveEntity]);
  useEffect(()=>{riftTargetEntRef.current=riftTargetEnt;},[riftTargetEnt]);
  useEffect(()=>{sprintPlayerRef.current=sprintPlayer;},[sprintPlayer]);

  // ── Raycasting ───────────────────────────────────────────────────────────
  useEffect(()=>{
    const {renderer,camera}=T.current||{};
    if (!renderer||phase!=='sandbox') return;
    const rc=new THREE.Raycaster();
    const mo=new THREE.Vector2();
    const handler=e=>{
      const rect=renderer.domElement.getBoundingClientRect();
      mo.x=((e.clientX-rect.left)/rect.width)*2-1;
      mo.y=-((e.clientY-rect.top)/rect.height)*2+1;
      rc.setFromCamera(mo,camera);
      const gs=GS.current;if(!gs) return;
      const hits=rc.intersectObjects(MR.current.tiles||[]);
      if (!hits.length) return;
      const rayDir=rc.ray.direction.clone().normalize();
      const q=MR.current.tileGroup?MR.current.tileGroup.quaternion:new THREE.Quaternion();
      const candidateFis=[...new Set(hits.map(h=>h.object.userData.fi))];
      let bestFi=candidateFis[0],bestDot=-Infinity;
      for (const fi of candidateFis){
        const wc=gs.centroids[fi].clone().applyQuaternion(q);
        const dot=wc.dot(rayDir);
        if (dot>bestDot){bestDot=dot;bestFi=fi;}
      }
      handleTileClick(bestFi);
    };
    renderer.domElement.addEventListener('click',handler);
    return ()=>renderer.domElement.removeEventListener('click',handler);
  },[phase,handleTileClick]);

  // ── Destroy crystal action ───────────────────────────────────────────────
  const destroyCrystal = useCallback((ci) => {
    const gs=GS.current;if(!gs) return;
    if (gs.crystalFaces[ci]<0){addLog(`Crystal ${ci+1} not on board`,'#888');return;}
    if (gs.destroyedCrystals.has(ci)){addLog(`Crystal ${ci+1} already destroyed`,'#888');return;}
    gs.destroyedCrystals.add(ci);
    addLog(`💎 Crystal ${ci+1} destroyed!`,CRYSTAL_PC[ci]);
    refreshAll();syncUI();
  },[addLog,refreshAll,syncUI]);

  const restoreCrystal = useCallback((ci) => {
    const gs=GS.current;if(!gs) return;
    if (!gs.destroyedCrystals.has(ci)){addLog(`Crystal ${ci+1} is already active`,'#888');return;}
    gs.destroyedCrystals.delete(ci);
    addLog(`✨ Crystal ${ci+1} restored`,CRYSTAL_PC[ci]);
    refreshAll();syncUI();
  },[addLog,refreshAll,syncUI]);

  // ── Move entity one step (via BFS adjacent) ──────────────────────────────
  const moveOneStep = useCallback((ent, direction) => {
    const gs=GS.current;if(!gs) return;
    let fi=-1;
    if (ent.startsWith('p')){const p=parseInt(ent[1]);fi=gs.pp[p];}
    else if (ent==='enemy') fi=gs.enemyFace;
    if (fi<0){addLog('Entity not on board','#888');return;}

    const neighbors=gs.fAdj[fi];
    if (!neighbors||neighbors.length===0) return;

    let targetFi;
    if (direction==='random'){
      targetFi=neighbors[Math.floor(Math.random()*neighbors.length)];
    } else if (direction==='toward_capital'){
      const path=bfsPath(gs.fAdj,fi,gs.capitalFace);
      targetFi=path.length>1?path[1]:fi;
    } else if (direction==='away_capital'){
      let bestD=-1,bestNb=neighbors[0];
      for (const nb of neighbors){
        const path=bfsPath(gs.fAdj,nb,gs.capitalFace);
        if (path.length-1>bestD){bestD=path.length-1;bestNb=nb;}
      }
      targetFi=bestNb;
    }

    if (targetFi===undefined||targetFi===fi) return;

    if (ent.startsWith('p')){
      const p=parseInt(ent[1]);
      // Crystal interaction on move
      const crystalIdx=gs.crystalFaces.indexOf(targetFi);
      if (crystalIdx>=0&&!gs.destroyedCrystals.has(crystalIdx)){
        gs.destroyedCrystals.add(crystalIdx);
        addLog(`💎 ${PN[p]} stepped on crystal ${crystalIdx+1}!`,CRYSTAL_PC[crystalIdx]);
      }
      gs.pp[p]=targetFi;
      addLog(`${PN[p]} → tile ${targetFi}`,PC[p]);
    } else if (ent==='enemy'){
      gs.enemyFace=targetFi;
      addLog(`👁 King Thobrick → tile ${targetFi}`,'#ff5555');
    }
    refreshAll();syncUI();
  },[addLog,refreshAll,syncUI]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const modeLabel = () => {
    if (mode===MODE_PLACE) return `Click a tile to place ${placeEntity}`;
    if (mode===MODE_REMOVE) return 'Click a tile to remove its entity';
    if (mode===MODE_MOVE_FROM) return 'Click a tile to pick entity to move';
    if (mode===MODE_MOVE_TO) return `Click destination tile for ${moveEntity}`;
    if (mode===MODE_SPRINT) return `👟 Goblin Sprint — click an adjacent tile for a bonus move`;
    if (mode===MODE_RIFT_TARGET) return `🌀 Witch Rift — click a player or King Thobrick to teleport`;
    if (mode===MODE_RIFT_DEST) return `🌀 Witch Rift — click any empty tile as the destination`;
    return null;
  };

  const cancelMode = () => {
    setMode(MODE_NONE);setPlaceEntity(null);setMoveEntity(null);setMoveFromFi(null);
  };

  // Destroyed crystals count from ui
  const destroyedCount = ui ? ui.destroyedCrystals.size : 0;

  return (
    <div style={{
      width:'100%',height:'100vh',
      background:'radial-gradient(ellipse at 30% 20%, #1a0850 0%, #0d1560 30%, #060a38 60%, #020418 100%)',
      display:'flex',flexDirection:'column',position:'relative',
      fontFamily:"'Cinzel', Georgia, serif",overflow:'hidden',userSelect:'none',
    }}>
      {/* Background glow */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:0,
        background:'radial-gradient(ellipse at 70% 80%, rgba(80,20,140,0.25) 0%, transparent 55%), radial-gradient(ellipse at 20% 60%, rgba(20,60,180,0.2) 0%, transparent 50%)',
      }}/>

      {/* TOP BAR */}
      <div style={{
        position:'absolute',top:0,left:0,right:0,zIndex:10,
        display:'flex',justifyContent:'space-between',alignItems:'center',
        padding:'10px 18px',
        background:'linear-gradient(180deg, rgba(5,3,25,0.97) 0%, transparent 100%)',
        borderBottom:'1px solid rgba(100,120,255,0.12)',
      }}>
        <button onClick={onExit} style={{
          background:'rgba(100,120,255,0.07)',border:'1px solid rgba(100,120,255,0.18)',
          color:'#8899cc',borderRadius:7,padding:'5px 13px',cursor:'pointer',
          fontSize:11,letterSpacing:1,fontFamily:"'Cinzel',Georgia,serif",
        }}>← Exit</button>

        <div style={{textAlign:'center'}}>
          <div style={{color:'rgba(140,160,255,0.5)',fontSize:'0.55rem',letterSpacing:5,textTransform:'uppercase'}}>◈ Sphere Quest</div>
          <div style={{color:'rgba(180,210,255,0.8)',fontSize:'1rem',fontWeight:700,letterSpacing:3,marginTop:2}}>SANDBOX MODE</div>
        </div>

        {phase!=='idle'&&(
          <button onClick={()=>buildSphere(tileCount)} style={{
            background:'rgba(100,120,255,0.07)',border:'1px solid rgba(100,120,255,0.18)',
            color:'rgba(180,190,255,0.5)',borderRadius:7,padding:'5px 12px',
            cursor:'pointer',fontSize:11,letterSpacing:1,fontFamily:"'Cinzel',Georgia,serif",
          }}>↺ Reset</button>
        )}
        {phase==='idle'&&<div style={{width:70}}/>}
      </div>

      {/* MODE INDICATOR */}
      {mode!==MODE_NONE&&(
        <div style={{
          position:'absolute',top:58,left:'50%',transform:'translateX(-50%)',
          zIndex:20,background:'rgba(10,8,40,0.95)',border:'1px solid rgba(255,200,100,0.4)',
          borderRadius:10,padding:'8px 20px',display:'flex',alignItems:'center',gap:14,
          boxShadow:'0 0 20px rgba(255,180,50,0.15)',
        }}>
          <span style={{color:'#ffd080',fontSize:'0.7rem',letterSpacing:1}}>{modeLabel()}</span>
          <button onClick={cancelMode} style={{
            background:'rgba(255,80,80,0.15)',border:'1px solid rgba(255,80,80,0.3)',
            color:'#ff8080',borderRadius:6,padding:'3px 10px',cursor:'pointer',
            fontSize:'0.65rem',fontFamily:"'Cinzel',Georgia,serif",
          }}>✕ Cancel</button>
        </div>
      )}

      {/* CANVAS */}
      <div ref={mountRef} style={{flex:1,position:'relative',zIndex:1}}/>

      {/* HINT */}
      {phase==='sandbox'&&(
        <div style={{
          position:'absolute',bottom:10,left:0,right:0,textAlign:'center',
          color:'rgba(150,170,255,0.2)',fontSize:'0.5rem',letterSpacing:2.5,zIndex:10,pointerEvents:'none',
        }}>WASD / drag to rotate sphere</div>
      )}

      {/* EVENT LOG — bottom left */}
      {phase==='sandbox'&&(
        <div style={{
          position:'absolute',bottom:28,left:14,zIndex:10,
          display:'flex',flexDirection:'column-reverse',gap:2,
          pointerEvents:'none',maxWidth:280,
        }}>
          {log.map((entry,i)=>(
            <div key={entry.id} style={{
              color:entry.color,fontSize:'0.62rem',letterSpacing:0.4,
              opacity:1-i*0.13,
              background:'rgba(5,4,20,0.65)',borderRadius:4,padding:'2px 8px',
              border:'1px solid rgba(100,120,255,0.07)',
            }}>{entry.msg}</div>
          ))}
        </div>
      )}

      {/* SIDE PANEL — right */}
      {phase==='sandbox'&&ui&&(
        <div style={{
          position:'absolute',top:56,right:0,bottom:0,zIndex:10,
          width:224,overflowY:'auto',
          background:'linear-gradient(180deg,rgba(6,4,28,0.98) 0%,rgba(4,3,18,0.98) 100%)',
          borderLeft:'1px solid rgba(100,120,255,0.14)',
          padding:'10px 0 24px',
          display:'flex',flexDirection:'column',gap:0,
        }}>
          <div style={{color:'rgba(160,175,255,0.35)',fontSize:'0.5rem',letterSpacing:4,textAlign:'center',padding:'0 0 10px',borderBottom:'1px solid rgba(100,120,255,0.08)'}}>
            ENTITIES
          </div>

          {/* Global actions */}
          <div style={{padding:'8px 12px',borderBottom:'1px solid rgba(100,120,255,0.08)',display:'flex',flexDirection:'column',gap:5}}>
            <div style={{color:'rgba(160,175,255,0.3)',fontSize:'0.48rem',letterSpacing:3,marginBottom:2}}>GLOBAL</div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              <SbBtn
                label="✎ Place"
                active={mode===MODE_PLACE}
                color="#88aaff"
                onClick={()=>{setMode(MODE_PLACE);setPlaceEntity(null);addLog('Select an entity below to place','#88aaff');}}
              />
              <SbBtn
                label="✕ Remove"
                active={mode===MODE_REMOVE}
                color="#ff8888"
                onClick={()=>{setMode(MODE_REMOVE);setPlaceEntity(null);addLog('Click a tile to remove its entity','#ff8888');}}
              />
              <SbBtn
                label="↔ Move"
                active={mode===MODE_MOVE_FROM}
                color="#ffcc66"
                onClick={()=>{setMode(MODE_MOVE_FROM);setPlaceEntity(null);addLog('Click entity tile, then destination','#ffcc66');}}
              />
            </div>
            <SbBtn
              label="⏭ Tick Round (−1 cooldown)"
              color="#8899bb"
              onClick={tickCooldowns}
            />
          </div>

          {/* Players */}
          {[0,1,2,3].map(p=>{
            const onBoard=ui.pp[p]>=0;
            const ABILITIES = [
              { icon:'👟', name:'Sprint',  desc:'Bonus move to adjacent tile', color:'#22cc44' },
              { icon:'😤', name:'Taunt',   desc:'Fixate King Thobrick on Orc for 2 actions', color:'#dd2222' },
              { icon:'⚡', name:'Stun',    desc:'Stun King Thobrick if adjacent', color:'#eecc00' },
              { icon:'🌀', name:'Rift',    desc:'Teleport any unit to any empty tile', color:'#2266ff' },
            ];
            const abi=ABILITIES[p];
            const cd=abilityCooldowns[p];
            const abilityAvail=cd===0;
            const abilityDisabled=p===0&&!onBoard || p===2&&(!onBoard||ui.enemyFace<0);

            return (
              <div key={p} style={{
                padding:'10px 12px',
                borderBottom:'1px solid rgba(100,120,255,0.07)',
                background:onBoard?`rgba(${hexStrToRgb(PC[p])},0.04)`:'transparent',
              }}>
                {/* Header row */}
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:6}}>
                  <div style={{width:9,height:9,borderRadius:'50%',background:PC[p],boxShadow:`0 0 8px ${PC[p]}`,flexShrink:0}}/>
                  <div style={{color:PC[p],fontSize:'0.65rem',letterSpacing:1.5,fontWeight:700}}>{PN[p]}</div>
                  <div style={{marginLeft:'auto',color:onBoard?'rgba(150,255,150,0.5)':'rgba(200,200,255,0.2)',fontSize:'0.48rem'}}>
                    {onBoard?`tile ${ui.pp[p]}`:'not placed'}
                  </div>
                </div>

                {/* Placement / movement row */}
                <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                  <SbBtn
                    label="Place"
                    active={mode===MODE_PLACE&&placeEntity===`p${p}`}
                    color={PC[p]} small
                    onClick={()=>{setMode(MODE_PLACE);setPlaceEntity(`p${p}`);addLog(`Click tile to place ${PN[p]}`,PC[p]);}}
                  />
                  {onBoard&&<>
                    <SbBtn label="→ Rnd" color={PC[p]} small onClick={()=>moveOneStep(`p${p}`,'random')}/>
                    <SbBtn label="→ Cap" color={PC[p]} small onClick={()=>moveOneStep(`p${p}`,'toward_capital')}/>
                    <SbBtn label="← Cap" color={PC[p]} small onClick={()=>moveOneStep(`p${p}`,'away_capital')}/>
                    <SbBtn label="Remove" color="#ff6666" small onClick={()=>{
                      const gs=GS.current;if(!gs) return;
                      gs.pp[p]=-1;addLog(`${PN[p]} removed`,'#888');refreshAll();syncUI();
                    }}/>
                  </>}
                </div>

                {/* Ability row */}
                <div style={{
                  background:'rgba(0,0,0,0.2)',
                  border:`1px solid ${abilityAvail&&!abilityDisabled?PC[p]+'33':'rgba(100,120,255,0.08)'}`,
                  borderRadius:7,padding:'6px 8px',
                  display:'flex',flexDirection:'column',gap:4,
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <span style={{fontSize:'0.75rem'}}>{abi.icon}</span>
                    <span style={{color:abilityAvail&&!abilityDisabled?PC[p]:'rgba(180,180,255,0.3)',fontSize:'0.58rem',fontWeight:700,letterSpacing:1}}>
                      {abi.name}
                    </span>
                    {cd>0&&(
                      <span style={{marginLeft:'auto',color:'rgba(180,180,255,0.35)',fontSize:'0.5rem',letterSpacing:0.5}}>
                        CD: {cd}
                      </span>
                    )}
                    {cd===0&&!abilityDisabled&&(
                      <span style={{marginLeft:'auto',color:`${PC[p]}99`,fontSize:'0.48rem'}}>ready</span>
                    )}
                  </div>
                  <div style={{color:'rgba(160,175,255,0.3)',fontSize:'0.49rem',lineHeight:1.4}}>{abi.desc}</div>
                  <button
                    onClick={()=>{
                      if (p===0) useSprintAbility(p);
                      else if (p===1) useTauntAbility(p);
                      else if (p===2) useStunAbility(p);
                      else if (p===3) useRiftAbility();
                    }}
                    disabled={cd>0||abilityDisabled}
                    style={{
                      background:cd>0||abilityDisabled?'rgba(255,255,255,0.03)':`rgba(${hexStrToRgb(PC[p])},0.18)`,
                      border:`1px solid ${cd>0||abilityDisabled?'rgba(100,120,255,0.1)':PC[p]+'66'}`,
                      borderRadius:5,padding:'4px 0',cursor:cd>0||abilityDisabled?'default':'pointer',
                      color:cd>0||abilityDisabled?'rgba(150,160,200,0.25)':PC[p],
                      fontSize:'0.6rem',fontFamily:"'Cinzel',Georgia,serif",letterSpacing:1,
                      width:'100%',transition:'all 0.15s',
                      boxShadow:cd===0&&!abilityDisabled?`0 0 8px ${PC[p]}33`:'none',
                    }}
                  >
                    {cd>0 ? `${abi.icon} Cooldown (${cd})` : abilityDisabled ? `${abi.icon} Unavailable` : `${abi.icon} Use ${abi.name}`}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Enemy */}
          {(()=>{
            const onBoard=ui.enemyFace>=0;
            return (
              <div style={{
                padding:'10px 12px',
                borderBottom:'1px solid rgba(100,120,255,0.07)',
                background:onBoard?'rgba(255,30,30,0.05)':'transparent',
              }}>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
                  <div style={{width:9,height:9,background:'#110000',border:'1px solid #ff333466',borderRadius:2,transform:'rotate(45deg)',flexShrink:0}}/>
                  <div style={{color:'#ff5555',fontSize:'0.65rem',letterSpacing:1.5,fontWeight:700}}>King Thobrick</div>
                  <div style={{marginLeft:'auto',color:onBoard?'rgba(150,255,150,0.5)':'rgba(200,200,255,0.2)',fontSize:'0.48rem'}}>
                    {onBoard?`tile ${ui.enemyFace}`:'not placed'}
                  </div>
                </div>

                {/* Status badges */}
                {(enemyStunned>0||taunted>=0)&&(
                  <div style={{display:'flex',gap:5,marginBottom:7,flexWrap:'wrap'}}>
                    {enemyStunned>0&&(
                      <div style={{background:'rgba(170,100,255,0.15)',border:'1px solid rgba(170,100,255,0.4)',borderRadius:5,padding:'2px 8px',color:'#bb77ff',fontSize:'0.52rem'}}>
                        ⚡ Stunned ({enemyStunned})
                      </div>
                    )}
                    {taunted>=0&&(
                      <div style={{background:'rgba(221,34,34,0.12)',border:'1px solid rgba(221,34,34,0.35)',borderRadius:5,padding:'2px 8px',color:'#ff7777',fontSize:'0.52rem'}}>
                        😤 Taunted by {PN[taunted]} ({tauntRounds})
                      </div>
                    )}
                  </div>
                )}

                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  <SbBtn
                    label="Place"
                    active={mode===MODE_PLACE&&placeEntity==='enemy'}
                    color="#ff5555"
                    small
                    onClick={()=>{setMode(MODE_PLACE);setPlaceEntity('enemy');addLog('Click tile to place King Thobrick','#ff5555');}}
                  />
                  {onBoard&&<>
                    <SbBtn label="→ Rnd" color="#ff5555" small onClick={()=>moveOneStep('enemy','random')}/>
                    <SbBtn label="→ Cap" color="#ff5555" small onClick={()=>moveOneStep('enemy','toward_capital')}/>
                    <SbBtn label="Remove" color="#ff6666" small onClick={()=>{
                      const gs=GS.current;if(!gs) return;
                      gs.enemyFace=-1;addLog('King Thobrick removed','#888');refreshAll();syncUI();
                    }}/>
                  </>}
                </div>
              </div>
            );
          })()}

          {/* Crystals */}
          <div style={{padding:'8px 12px 4px'}}>
            <div style={{color:'rgba(0,255,200,0.35)',fontSize:'0.48rem',letterSpacing:3,marginBottom:6}}>CRYSTALS ({destroyedCount}/{NUM_CRYSTALS} destroyed)</div>
            {[0,1,2,3].map(ci=>{
              const onBoard=ui.crystalFaces[ci]>=0;
              const destroyed=ui.destroyedCrystals.has(ci);
              return (
                <div key={ci} style={{
                  marginBottom:8,padding:'8px 0',
                  borderBottom:'1px solid rgba(100,120,255,0.06)',
                  opacity:destroyed?0.5:1,
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                    <div style={{
                      width:9,height:9,background:destroyed?'rgba(255,255,255,0.1)':CRYSTAL_PC[ci],
                      border:`1px solid ${CRYSTAL_PC[ci]}`,borderRadius:2,transform:'rotate(45deg)',
                      flexShrink:0,opacity:destroyed?0.3:1,
                      boxShadow:destroyed?'none':`0 0 6px ${CRYSTAL_PC[ci]}`,
                    }}/>
                    <div style={{color:CRYSTAL_PC[ci],fontSize:'0.6rem',letterSpacing:1}}>Crystal {ci+1}</div>
                    <div style={{marginLeft:'auto',color:destroyed?'#ff6666':onBoard?'rgba(150,255,150,0.5)':'rgba(200,200,255,0.2)',fontSize:'0.48rem'}}>
                      {destroyed?'💥 destroyed':onBoard?`tile ${ui.crystalFaces[ci]}`:'not placed'}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {!destroyed&&<SbBtn
                      label="Place"
                      active={mode===MODE_PLACE&&placeEntity===`crystal${ci}`}
                      color={CRYSTAL_PC[ci]} small
                      onClick={()=>{setMode(MODE_PLACE);setPlaceEntity(`crystal${ci}`);addLog(`Click tile to place crystal ${ci+1}`,CRYSTAL_PC[ci]);}}
                    />}
                    {onBoard&&!destroyed&&<SbBtn label="Destroy" color="#ff8888" small onClick={()=>destroyCrystal(ci)}/>}
                    {destroyed&&<SbBtn label="Restore" color={CRYSTAL_PC[ci]} small onClick={()=>restoreCrystal(ci)}/>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Capital info */}
          <div style={{margin:'4px 12px',padding:'8px 10px',background:'rgba(255,200,0,0.05)',border:'1px solid rgba(255,200,0,0.12)',borderRadius:8}}>
            <div style={{color:'rgba(255,200,50,0.6)',fontSize:'0.5rem',letterSpacing:2,marginBottom:2}}>CAPITAL</div>
            <div style={{color:'rgba(255,220,100,0.5)',fontSize:'0.58rem'}}>Tile {ui?.capitalFace ?? '—'} (fixed)</div>
          </div>
        </div>
      )}

      {/* IDLE / START SCREEN */}
      {phase==='idle'&&(
        <div style={{
          position:'absolute',inset:0,zIndex:5,
          display:'flex',alignItems:'center',justifyContent:'center',
        }}>
          <div style={{textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:28}}>
            <div>
              <div style={{color:'rgba(140,160,255,0.7)',fontSize:'0.75rem',letterSpacing:7,marginBottom:10}}>SANDBOX</div>
              <div style={{color:'rgba(200,210,255,0.85)',fontSize:'2.2rem',fontWeight:700,letterSpacing:6,textShadow:'0 0 40px rgba(100,130,255,0.5)'}}>SPHERE QUEST</div>
              <div style={{color:'rgba(150,165,255,0.35)',fontSize:'0.62rem',letterSpacing:1.5,marginTop:10,lineHeight:2}}>
                Place pieces freely · Move them around · Destroy crystals · No rules
              </div>
            </div>
            <div style={{background:'rgba(10,8,40,0.8)',border:'1px solid rgba(100,120,255,0.2)',borderRadius:14,padding:'20px 28px',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
              <div style={{color:'rgba(160,175,255,0.6)',fontSize:'0.6rem',letterSpacing:3}}>SPHERE SIZE</div>
              <div style={{display:'flex',gap:10}}>
                {[{count:32,label:'32',sub:'Classic'},{count:42,label:'42',sub:'Extended'},{count:72,label:'72',sub:'Vast'}].map(({count,label,sub})=>(
                  <button key={count} onClick={()=>setTileCount(count)} style={{
                    background:tileCount===count?'linear-gradient(180deg, rgba(60,80,220,0.5), rgba(30,40,160,0.5))':'rgba(255,255,255,0.03)',
                    border:tileCount===count?'1px solid rgba(120,150,255,0.6)':'1px solid rgba(100,120,255,0.15)',
                    borderRadius:10,padding:'12px 20px',cursor:'pointer',
                    color:tileCount===count?'#c0d0ff':'rgba(140,155,220,0.5)',
                    fontFamily:"'Cinzel',Georgia,serif",transition:'all 0.2s',minWidth:80,
                    boxShadow:tileCount===count?'0 0 20px rgba(80,100,255,0.25)':'none',
                  }}>
                    <div style={{fontSize:'1.3rem',fontWeight:700,letterSpacing:1}}>{label}</div>
                    <div style={{fontSize:'0.55rem',letterSpacing:2,marginTop:3,opacity:0.7}}>{sub}</div>
                    <div style={{fontSize:'0.5rem',letterSpacing:1,marginTop:2,opacity:0.45}}>tiles</div>
                  </button>
                ))}
              </div>
              <button onClick={()=>buildSphere(tileCount)} style={{
                marginTop:6,padding:'12px 48px',
                background:'linear-gradient(180deg, rgba(60,80,230,0.6), rgba(30,40,180,0.6))',
                border:'1px solid rgba(120,150,255,0.5)',
                color:'#c8d8ff',borderRadius:12,cursor:'pointer',
                fontSize:'0.95rem',letterSpacing:3,fontFamily:"'Cinzel',Georgia,serif",
                boxShadow:'0 0 30px rgba(70,90,255,0.3)',
              }}>▶ Enter Sandbox</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small reusable button ────────────────────────────────────────────────────
function SbBtn({label, onClick, color='#aabbff', active=false, small=false}) {
  return (
    <button
      onClick={onClick}
      style={{
        background:active?`rgba(${hexStrToRgb(color)},0.25)`:'rgba(255,255,255,0.04)',
        border:`1px solid ${active?color+'99':color+'33'}`,
        color:active?color:color+'99',
        borderRadius:5,padding:small?'3px 7px':'5px 11px',
        cursor:'pointer',fontSize:small?'0.52rem':'0.6rem',
        fontFamily:"'Cinzel',Georgia,serif",letterSpacing:0.5,
        transition:'all 0.15s',
        boxShadow:active?`0 0 8px ${color}44`:'none',
      }}
    >{label}</button>
  );
}

function hexStrToRgb(hex) {
  const c=hex.replace('#','');
  const r=parseInt(c.substring(0,2),16);
  const g=parseInt(c.substring(2,4),16);
  const b=parseInt(c.substring(4,6),16);
  return `${r},${g},${b}`;
}
