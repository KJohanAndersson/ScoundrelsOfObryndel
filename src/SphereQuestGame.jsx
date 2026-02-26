import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// TRUNCATED ICOSAHEDRON  (soccer-ball)
// 60 vertices · 90 edges · 32 faces (12 pentagons + 20 hexagons)
// ─────────────────────────────────────────────────────────────────────────────
const PHI = (1 + Math.sqrt(5)) / 2;

function buildTIVerts() {
  const V = [];
  const push = (x, y, z) => {
    const l = Math.sqrt(x*x + y*y + z*z);
    V.push(new THREE.Vector3(x/l, y/l, z/l));   // normalised to unit sphere
  };
  const t = PHI;
  for (const s1 of [1,-1]) for (const s2 of [1,-1]) {
    push(0, s1, s2*3*t);  push(s1, s2*3*t, 0);  push(s2*3*t, 0, s1);
  }
  const a = 2+t, b = 2*t;
  for (const s1 of [1,-1]) for (const s2 of [1,-1]) for (const s3 of [1,-1]) {
    push(s1, s2*a, s3*b);  push(s2*a, s3*b, s1);  push(s3*b, s1, s2*a);
  }
  const c = 1+2*t;
  for (const s1 of [1,-1]) for (const s2 of [1,-1]) for (const s3 of [1,-1]) {
    push(s1*2, s2*c, s3*t);  push(s2*c, s3*t, s1*2);  push(s3*t, s1*2, s2*c);
  }
  return V;  // 60 normalised vertices
}

// Returns { faces[], centroids[], fAdj[] }
function buildTITopology(V) {
  const n = V.length;

  // ── vertex adjacency ──
  const adj = Array.from({length: n}, () => []);
  for (let i = 0; i < n; i++)
    for (let j = i+1; j < n; j++)
      if (V[i].distanceTo(V[j]) < 0.46) { adj[i].push(j); adj[j].push(i); }

  // ── cyclically sorted neighbours (CCW viewed from outside) ──
  const sortedAdj = V.map((vi, i) => {
    let ux=0, uy=1, uz=0;
    if (Math.abs(vi.y) > 0.9) { ux=1; uy=0; uz=0; }
    const d = ux*vi.x + uy*vi.y + uz*vi.z;
    ux -= d*vi.x; uy -= d*vi.y; uz -= d*vi.z;
    const ul = Math.sqrt(ux*ux+uy*uy+uz*uz); ux/=ul; uy/=ul; uz/=ul;
    const vx = vi.y*uz-vi.z*uy, vy = vi.z*ux-vi.x*uz, vz = vi.x*uy-vi.y*ux;
    return adj[i]
      .map(j => {
        const dx=V[j].x-vi.x, dy=V[j].y-vi.y, dz=V[j].z-vi.z;
        return { j, a: Math.atan2(dx*vx+dy*vy+dz*vz, dx*ux+dy*uy+dz*uz) };
      })
      .sort((a,b) => a.a - b.a)
      .map(x => x.j);
  });

  // ── face extraction (directed-edge walk) ──
  const faces = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    for (const j of sortedAdj[i]) {
      if (used.has(i*n+j)) continue;
      const face = [i];
      let u = i, v = j;
      for (let s = 0; s < 8; s++) {
        used.add(u*n+v);
        face.push(v);
        if (v === i) break;
        const nb = sortedAdj[v];
        const idx = nb.indexOf(u);
        const next = nb[(idx+1) % nb.length];
        u = v; v = next;
      }
      if (face[face.length-1] === face[0]) {
        face.pop();
        if (face.length === 5 || face.length === 6) faces.push(face);
      }
    }
  }

  // ── face centroids (unit sphere) ──
  const centroids = faces.map(f => {
    const c = new THREE.Vector3();
    f.forEach(i => c.add(V[i]));
    return c.divideScalar(f.length).normalize();
  });

  // ── face adjacency (shared edge = 2 consecutive shared vertices) ──
  const fAdj = Array.from({length: faces.length}, () => []);
  for (let i = 0; i < faces.length; i++) {
    for (let j = i+1; j < faces.length; j++) {
      const fi = faces[i], fj = faces[j];
      const shared = fi.filter(v => fj.includes(v));
      if (shared.length < 2) continue;
      // verify they are consecutive in face i
      const [a, b] = shared;
      const ai = fi.indexOf(a), bi = fi.indexOf(b);
      const consec = Math.abs(ai-bi)===1 || (ai===0&&bi===fi.length-1) || (bi===0&&ai===fi.length-1);
      if (consec) { fAdj[i].push(j); fAdj[j].push(i); }
    }
  }

  return { faces, centroids, fAdj };
}

// ─────────────────────────────────────────────────────────────────────────────
// TILE MESH  — fan-triangulated directly on sphere surface
// Adjacent faces share exact 3D vertex positions → perfectly seamless.
// ─────────────────────────────────────────────────────────────────────────────
function buildTileMesh(face, V, centroid, SR, inset) {
  // Scale all sphere verts to radius SR
  // Sort face vertices by angle around the centroid (ensures correct winding)
  const norm = centroid.clone();
  let ux=0, uy=1, uz=0;
  if (Math.abs(norm.y) > 0.9) { ux=1; uy=0; uz=0; }
  const d = ux*norm.x + uy*norm.y + uz*norm.z;
  ux -= d*norm.x; uy -= d*norm.y; uz -= d*norm.z;
  const ul = Math.sqrt(ux*ux+uy*uy+uz*uz); ux/=ul; uy/=ul; uz/=ul;
  const vx = norm.y*uz-norm.z*uy, vy = norm.z*ux-norm.x*uz, vz = norm.x*uy-norm.y*ux;
  const tu = new THREE.Vector3(ux,uy,uz);
  const tv = new THREE.Vector3(vx,vy,vz);

  const center3 = centroid.clone().multiplyScalar(SR);

  // Sorted vertices on sphere surface
  const verts3 = face
    .map(i => ({ p: V[i].clone().multiplyScalar(SR), vi: i }))
    .map(({ p, vi }) => {
      const d2 = p.clone().sub(center3);
      return { p, angle: Math.atan2(d2.dot(tv), d2.dot(tu)) };
    })
    .sort((a,b) => a.angle - b.angle)
    .map(x => x.p);

  const nv = verts3.length; // 5 or 6

  // Apply inset: lerp each vertex toward centroid
  const insetVerts = verts3.map(p =>
    center3.clone().lerp(p, inset).normalize().multiplyScalar(SR)
  );

  // Build BufferGeometry from fan triangles: (center, v[k], v[k+1])
  const positions = [];
  const normals = [];

  for (let k = 0; k < nv; k++) {
    const vA = center3;
    const vB = insetVerts[k];
    const vC = insetVerts[(k+1) % nv];

    positions.push(vA.x, vA.y, vA.z);
    positions.push(vB.x, vB.y, vB.z);
    positions.push(vC.x, vC.y, vC.z);

    // Per-vertex normals = normalised position (sphere surface normal)
    [vA, vB, vC].forEach(v => {
      const nn = v.clone().normalize();
      normals.push(nn.x, nn.y, nn.z);
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
  return geo;
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL GREAT CIRCLE  — lies entirely on sphere surface (radius = SR + lift)
// Defined by the plane through origin, centroid A, centroid B.
// ─────────────────────────────────────────────────────────────────────────────
function buildGreatCircle(cA, cB, radius, steps = 128) {
  // Orthonormal basis of the great-circle plane
  const A = cA.clone().normalize();
  const dot = A.dot(cB.clone().normalize());
  // B_perp = component of B perpendicular to A
  const Bperp = cB.clone().normalize().addScaledVector(A, -dot).normalize();

  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    pts.push(
      A.clone().multiplyScalar(Math.cos(theta))
       .addScaledVector(Bperp, Math.sin(theta))
       .multiplyScalar(radius)
    );
  }
  return pts;
}

// BFS shortest path between two faces
function bfsPath(fAdj, start, end) {
  if (start === end) return [start];
  const prev = new Array(fAdj.length).fill(-1);
  const vis = new Set([start]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    for (const nb of fAdj[cur]) {
      if (!vis.has(nb)) {
        vis.add(nb); prev[nb] = cur; q.push(nb);
        if (nb === end) {
          const path = [];
          let c = end;
          while (c !== -1) { path.unshift(c); c = prev[c]; }
          return path;
        }
      }
    }
  }
  return [start];
}

function pathIncludesFace(fAdj, fa, fb, target) {
  if (fa === target || fb === target) return true;
  return bfsPath(fAdj, fa, fb).includes(target);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SR   = 2.5;
const PH   = [0x2288ff, 0x22ccdd, 0xff2233, 0xff8822];
const PC   = ['#2288ff','#22ccdd','#ff2233','#ff8822'];
const OFFSETS = [[-0.07,-0.07],[0.07,-0.07],[-0.07,0.07],[0.07,0.07]];

const COL_DEFAULT = new THREE.Color(0x111428);
const COL_START   = new THREE.Color(0x0c0820);
const COL_HOVER   = new THREE.Color(0x1d2870);
const COL_FOUND   = new THREE.Color(0x00bb55);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SphereQuestGame({ onExit }) {
  const mountRef = useRef(null);
  const T  = useRef(null);   // { renderer, scene, camera }
  const MR = useRef({});     // mesh refs
  const GS = useRef(null);   // game state
  const rot  = useRef({ x: 0.3, y: 0 });
  const rotT = useRef({ x: 0.3, y: 0 });
  const keys = useRef({});
  const drag = useRef({ on: false, x: 0, y: 0 });

  const [phase,  setPhase]  = useState('idle');
  const [cpUI,   setCpUI]   = useState(0);
  const [msg,    setMsg]    = useState('');
  const [found,  setFound]  = useState(false);
  const [winner, setWinner] = useState(null);
  const [,       redraw]    = useState(0);

  // ── current rotation quaternion ──────────────────────────────────────────
  const getQ = () => {
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(rot.current.x, rot.current.y, 0, 'YXZ'));
    return q;
  };

  // ── Three.js bootstrap ───────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, W/H, 0.1, 200);
    camera.position.z = 8.2;

    // Lighting
    scene.add(new THREE.AmbientLight(0x223377, 1.8));
    const dl = new THREE.DirectionalLight(0x99aaff, 2.5);
    dl.position.set(5, 8, 6); scene.add(dl);
    const rl = new THREE.DirectionalLight(0xff8866, 0.7);
    rl.position.set(-6,-3,-5); scene.add(rl);

    // Dark interior sphere (so we see the tile faces)
    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(SR - 0.01, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x030610, roughness: 1, side: THREE.BackSide })
    );
    scene.add(inner);

    // Stars
    const sv = new Float32Array(4800);
    for (let i = 0; i < sv.length; i++) sv[i] = (Math.random()-0.5)*140;
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sv, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x6677aa, size: 0.05 })));

    T.current = { renderer, scene, camera };

    // ── animation loop ──
    let aid;
    const animate = () => {
      aid = requestAnimationFrame(animate);

      // WASD
      const spd = 0.025;
      if (keys.current['w']||keys.current['W']) rotT.current.x -= spd;
      if (keys.current['s']||keys.current['S']) rotT.current.x += spd;
      if (keys.current['a']||keys.current['A']) rotT.current.y -= spd;
      if (keys.current['d']||keys.current['D']) rotT.current.y += spd;
      rotT.current.x = Math.max(-1.5, Math.min(1.5, rotT.current.x));
      rot.current.x += (rotT.current.x - rot.current.x) * 0.1;
      rot.current.y += (rotT.current.y - rot.current.y) * 0.1;

      const q = getQ();

      // Rotate all objects tagged with userData.basePos
      scene.children.forEach(c => {
        if (!c.userData.basePos) return;
        c.position.copy(c.userData.basePos.clone().applyQuaternion(q));
        if (c.userData.baseQ) c.quaternion.copy(q).multiply(c.userData.baseQ);
      });

      // Rebuild great-circle lines each frame (they must follow sphere rotation)
      const gs  = GS.current;
      const mr  = MR.current;
      if (gs && mr.blueCircle && mr.redCircle) {
        const cA_b = gs.centroids[gs.pp[0]].clone().applyQuaternion(q);
        const cB_b = gs.centroids[gs.pp[1]].clone().applyQuaternion(q);
        mr.blueCircle.geometry.setFromPoints(buildGreatCircle(cA_b, cB_b, SR + 0.06));

        const cA_r = gs.centroids[gs.pp[2]].clone().applyQuaternion(q);
        const cB_r = gs.centroids[gs.pp[3]].clone().applyQuaternion(q);
        mr.redCircle.geometry.setFromPoints(buildGreatCircle(cA_r, cB_r, SR + 0.10));
      }

      // Ring pulse
      if (mr.ring) {
        const t2 = Date.now() * 0.003;
        mr.ring.material.opacity = 0.25 + 0.4 * Math.sin(t2 * 2.8);
      }

      renderer.render(scene, camera);
    };
    animate();
    T.current.stopAnim = () => cancelAnimationFrame(aid);

    const onResize = () => {
      const w2 = el.clientWidth, h2 = el.clientHeight;
      renderer.setSize(w2, h2);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => {
      T.current.stopAnim?.();
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  // ── keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const kd = e => { keys.current[e.key] = true; };
    const ku = e => { keys.current[e.key] = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup',   ku);
    return () => { window.removeEventListener('keydown',kd); window.removeEventListener('keyup',ku); };
  }, []);

  // ── drag ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    const onMD = e => { drag.current = { on:true, x:e.clientX, y:e.clientY }; };
    const onMM = e => {
      if (!drag.current.on) return;
      rotT.current.y += (e.clientX - drag.current.x) * 0.008;
      rotT.current.x += (e.clientY - drag.current.y) * 0.008;
      drag.current = { on:true, x:e.clientX, y:e.clientY };
    };
    const onMU = () => { drag.current.on = false; };
    const onTS = e => { if (e.touches.length===1) drag.current={on:true,x:e.touches[0].clientX,y:e.touches[0].clientY}; };
    const onTM = e => {
      if (!drag.current.on || e.touches.length!==1) return;
      e.preventDefault();
      rotT.current.y += (e.touches[0].clientX - drag.current.x) * 0.008;
      rotT.current.x += (e.touches[0].clientY - drag.current.y) * 0.008;
      drag.current={on:true,x:e.touches[0].clientX,y:e.touches[0].clientY};
    };
    el.addEventListener('mousedown', onMD);
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    el.addEventListener('touchstart', onTS);
    el.addEventListener('touchmove', onTM, { passive:false });
    window.addEventListener('touchend', onMU);
    return () => {
      el.removeEventListener('mousedown',onMD); window.removeEventListener('mousemove',onMM); window.removeEventListener('mouseup',onMU);
      el.removeEventListener('touchstart',onTS); el.removeEventListener('touchmove',onTM); window.removeEventListener('touchend',onMU);
    };
  }, []);

  // ── tile colour refresh ───────────────────────────────────────────────────
  const refreshTiles = useCallback(() => {
    const gs = GS.current;
    const mr = MR.current;
    if (!gs || !mr.tiles) return;
    const { fAdj, pp, sf, objFace } = gs;
    const cpNow = gs.turn % 4;

    // Check if both great circles pass through the object face
    if (!gs.objFound) {
      const bc = pathIncludesFace(fAdj, pp[0], pp[1], objFace);
      const rc = pathIncludesFace(fAdj, pp[2], pp[3], objFace);
      if (bc && rc) {
        gs.objFound = true;
        setFound(true);
        setMsg('✨ Object located — race to the green tile!');
      }
    }

    mr.tiles.forEach(mesh => {
      const fi  = mesh.userData.fi;
      let col;
      if      (fi === objFace && gs.objFound)                       col = COL_FOUND;
      else if (fi === sf)                                            col = COL_START;
      else if (!gs.winner && fAdj[pp[cpNow]]?.includes(fi))         col = COL_HOVER;
      else                                                           col = COL_DEFAULT;
      mesh.material.color.copy(col);

      let ei = 0, em = 0x000000;
      if (fi === objFace && gs.objFound) { em = 0x008833; ei = 0.45; }
      else if (!gs.winner && fAdj[pp[cpNow]]?.includes(fi)) { em = 0x0a1030; ei = 0.2; }
      mesh.material.emissive.setHex(em);
      mesh.material.emissiveIntensity = ei;
    });
  }, []);

  // ── player & ring position refresh ───────────────────────────────────────
  const refreshPlayers = useCallback(() => {
    const gs = GS.current;
    const mr = MR.current;
    if (!gs || !mr.players) return;
    const q = getQ();

    for (let p = 0; p < 4; p++) {
      const norm = gs.centroids[gs.pp[p]].clone().normalize();
      const c = norm.clone().multiplyScalar(SR + 0.18);
      const up = Math.abs(norm.y)<0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
      const tu = new THREE.Vector3().crossVectors(norm, up).normalize();
      const tv = new THREE.Vector3().crossVectors(norm, tu).normalize();
      c.addScaledVector(tu, OFFSETS[p][0]).addScaledVector(tv, OFFSETS[p][1]);
      mr.players[p].userData.basePos = c.clone();
      mr.players[p].position.copy(c.clone().applyQuaternion(q));
    }

    const cpNow = gs.turn % 4;
    const normR = gs.centroids[gs.pp[cpNow]].clone().normalize();
    const rp = normR.clone().multiplyScalar(SR + 0.18);
    const up2 = Math.abs(normR.y)<0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
    const tu2 = new THREE.Vector3().crossVectors(normR, up2).normalize();
    const tv2 = new THREE.Vector3().crossVectors(normR, tu2).normalize();
    rp.addScaledVector(tu2, OFFSETS[cpNow][0]).addScaledVector(tv2, OFFSETS[cpNow][1]);
    const rQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), normR);
    mr.ring.userData.basePos = rp.clone();
    mr.ring.userData.baseQ   = rQ.clone();
    mr.ring.position.copy(rp.clone().applyQuaternion(q));
    mr.ring.quaternion.copy(q).multiply(rQ);
    mr.ring.material.color.setHex(PH[cpNow]);
  }, []);

  // ── start / restart ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const { scene } = T.current || {};
    if (!scene) return;

    // Remove previous game objects
    scene.children
      .filter(c => c.userData.isGame)
      .forEach(c => scene.remove(c));
    MR.current = {};

    const verts = buildTIVerts();
    const { faces, centroids, fAdj } = buildTITopology(verts);

    // Start tile: topmost centroid
    let sf = 0;
    centroids.forEach((c, i) => { if (c.y > centroids[sf].y) sf = i; });

    // Random object tile (not start, not adjacent to start for fairness)
    let objFace;
    do { objFace = Math.floor(Math.random() * faces.length); }
    while (objFace === sf || fAdj[sf].includes(objFace));

    const q = getQ();

    // ── tile meshes (fan-triangulated on sphere surface) ──
    const tileMeshes = [];
    const tileMat = new THREE.MeshStandardMaterial({
      roughness: 0.55, metalness: 0.28,
      vertexColors: false,
    });

    faces.forEach((face, fi) => {
      const isStart = fi === sf;
      // Each tile gets its own clone of the shared material
      const mat = tileMat.clone();
      mat.color.copy(isStart ? COL_START : COL_DEFAULT);

      const geo = buildTileMesh(face, verts, centroids[fi], SR, 0.94);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { fi, isGame: true };
      // These tiles live in world space and are rotated by the group quaternion each frame.
      // We store the unrotated geometry → apply world rotation via basePos trick.
      // Since geometry IS in world space already (not local), we need a different approach.
      // Instead: wrap in a pivot Object3D at origin, rotate the pivot.
      const pivot = new THREE.Object3D();
      pivot.userData = { basePos: new THREE.Vector3(0,0,0), isGame: true, isTilePivot: true };
      // We tag the mesh so raycasting works
      scene.add(mesh);
      tileMeshes.push(mesh);
    });
    MR.current.tiles = tileMeshes;
    MR.current.verts = verts;
    MR.current.faces = faces;
    MR.current.centroids = centroids;

    // ── rotate all tile geometry by current q ──
    // (Tiles stay in place; we rotate the whole group by applying q to each position)
    // Actually, simplest approach: the tile geometry vertices are baked in unrotated space.
    // We rotate by applying getQ() to each mesh's world matrix each frame.
    // Use a single shared Group and rotate it.
    let tileGroup = scene.getObjectByName('tileGroup');
    if (tileGroup) scene.remove(tileGroup);
    tileGroup = new THREE.Group();
    tileGroup.name = 'tileGroup';
    tileGroup.userData = { isGame: true };
    // Move tiles into group
    tileMeshes.forEach(m => { scene.remove(m); tileGroup.add(m); });
    scene.add(tileGroup);
    MR.current.tileGroup = tileGroup;

    // ── player spheres ──
    const players = PH.map((col, p) => {
      const norm = centroids[sf].clone().normalize();
      const c = norm.clone().multiplyScalar(SR + 0.18);
      const up = Math.abs(norm.y)<0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
      const tu = new THREE.Vector3().crossVectors(norm, up).normalize();
      const tv = new THREE.Vector3().crossVectors(norm, tu).normalize();
      c.addScaledVector(tu, OFFSETS[p][0]).addScaledVector(tv, OFFSETS[p][1]);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, metalness: 0.55, emissive: col, emissiveIntensity: 0.55 })
      );
      mesh.userData = { isGame: true, basePos: c.clone() };
      mesh.position.copy(c.clone().applyQuaternion(q));
      scene.add(mesh);
      return mesh;
    });
    MR.current.players = players;

    // ── great-circle lines ──
    const blueGeo = new THREE.BufferGeometry();
    const blueCircle = new THREE.Line(blueGeo,
      new THREE.LineBasicMaterial({ color: 0x33aaff, transparent: true, opacity: 0.88 }));
    blueCircle.userData = { isGame: true };
    scene.add(blueCircle);
    MR.current.blueCircle = blueCircle;

    const redGeo = new THREE.BufferGeometry();
    const redCircle = new THREE.Line(redGeo,
      new THREE.LineBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.88 }));
    redCircle.userData = { isGame: true };
    scene.add(redCircle);
    MR.current.redCircle = redCircle;

    // ── active-player ring ──
    const norm0 = centroids[sf].clone().normalize();
    const rp0 = norm0.clone().multiplyScalar(SR + 0.18);
    const rQ0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), norm0);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.013, 8, 32),
      new THREE.MeshBasicMaterial({ color: PH[0], transparent: true, opacity: 0.6 })
    );
    ring.userData = { isGame: true, basePos: rp0.clone(), baseQ: rQ0.clone() };
    ring.position.copy(rp0.clone().applyQuaternion(q));
    ring.quaternion.copy(q).multiply(rQ0);
    scene.add(ring);
    MR.current.ring = ring;

    GS.current = {
      faces, centroids, fAdj,
      pp: [sf, sf, sf, sf],
      sf, objFace,
      objFound: false, turn: 0, winner: null,
    };

    refreshPlayers();
    refreshTiles();

    setPhase('playing'); setCpUI(0); setFound(false); setWinner(null);
    setMsg("Player 1's turn — click an adjacent tile to move");
    redraw(n => n+1);
  }, [refreshPlayers, refreshTiles]);

  // The tileGroup needs to be rotated every frame too
  // We add that to the animation loop via a special flag
  useEffect(() => {
    const { scene } = T.current || {};
    if (!scene) return;
    // Patch: on every frame, also rotate tileGroup
    const origAnimate = T.current._patchedRotate;
    T.current._rotateTileGroup = true;
  }, []);

  // Extend the animation loop to also rotate tileGroup (patched approach via ref check)
  // Better: we just make tileGroup use the same basePos/baseQ pattern but for a Group.
  // Actually the cleanest fix: store tileGroup ref and rotate it in the existing loop.
  // Let's patch the existing scene's animate via the useEffect above — actually,
  // we need to re-wire. Let's use a cleaner approach: flag in scene userData.
  // The animLoop already iterates scene.children looking for userData.basePos.
  // For tileGroup (a Group, not a Mesh), we give it a baseQ that IS q itself,
  // and basePos = zero. Then the loop sets position=0 (fine) and quaternion=q*identity=q.

  // ── move + detect ─────────────────────────────────────────────────────────
  const onTileClick = useCallback((fi) => {
    const gs = GS.current;
    if (!gs || gs.winner) return;
    const cpNow = gs.turn % 4;
    if (!gs.fAdj[gs.pp[cpNow]].includes(fi)) return;

    gs.pp[cpNow] = fi;

    if (fi === gs.objFace && gs.objFound) {
      gs.winner = cpNow;
      setWinner(cpNow);
      setPhase('won');
      setMsg(`Player ${cpNow+1} claims the object!`);
    } else {
      gs.turn++;
      const next = gs.turn % 4;
      setCpUI(next);
      setMsg(`Player ${next+1}'s turn — click an adjacent tile to move`);
    }
    refreshPlayers();
    refreshTiles();
    redraw(n => n+1);
  }, [refreshPlayers, refreshTiles]);

  // ── raycasting ────────────────────────────────────────────────────────────
  useEffect(() => {
    const { renderer, camera } = T.current || {};
    if (!renderer) return;
    const rc = new THREE.Raycaster();
    const mo = new THREE.Vector2();
    const handler = e => {
      if (phase !== 'playing') return;
      const rect = renderer.domElement.getBoundingClientRect();
      mo.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mo.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      rc.setFromCamera(mo, camera);
      const hits = rc.intersectObjects(MR.current.tiles || []);
      if (hits.length > 0) onTileClick(hits[0].object.userData.fi);
    };
    renderer.domElement.addEventListener('click', handler);
    return () => renderer.domElement.removeEventListener('click', handler);
  }, [phase, onTileClick]);

  // Rotate tileGroup every frame (hooked via scene userData flag)
  useEffect(() => {
    let aid2;
    const loop = () => {
      aid2 = requestAnimationFrame(loop);
      const mr = MR.current;
      if (mr.tileGroup) {
        const q = new THREE.Quaternion();
        q.setFromEuler(new THREE.Euler(rot.current.x, rot.current.y, 0, 'YXZ'));
        mr.tileGroup.quaternion.copy(q);
      }
    };
    loop();
    return () => cancelAnimationFrame(aid2);
  }, []);

  // ── render ────────────────────────────────────────────────────────────────
  const cpNow = GS.current ? GS.current.turn % 4 : 0;

  return (
    <div style={{
      width:'100%', height:'100vh',
      background:'radial-gradient(ellipse at 30% 18%, #0b0524 0%, #010109 100%)',
      display:'flex', flexDirection:'column', position:'relative',
      fontFamily:"'Cinzel', Georgia, serif", overflow:'hidden', userSelect:'none',
    }}>

      {/* Header */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, zIndex:10,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'14px 22px',
        background:'linear-gradient(180deg, rgba(1,0,9,0.96) 0%, transparent 100%)',
      }}>
        <button onClick={onExit} style={{
          background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)',
          color:'#888', borderRadius:8, padding:'7px 15px', cursor:'pointer',
          fontSize:13, letterSpacing:1, fontFamily:"'Cinzel',Georgia,serif",
        }}>← Exit</button>

        <div style={{ textAlign:'center' }}>
          <div style={{ color:'#6655aa', fontSize:'0.65rem', letterSpacing:4, textTransform:'uppercase' }}>◈ Sphere Quest</div>
          {phase==='playing' && (
            <div style={{
              color:PC[cpNow], fontSize:'0.9rem', fontWeight:700, letterSpacing:2.5,
              marginTop:3, transition:'color 0.3s', textShadow:`0 0 14px ${PC[cpNow]}99`,
            }}>Player {cpNow+1}'s Turn</div>
          )}
        </div>

        {phase==='idle' ? (
          <button onClick={startGame} style={{
            background:'linear-gradient(180deg,#26106a,#110628)',
            border:'1px solid rgba(130,70,255,0.5)', color:'#c0aaff',
            borderRadius:10, padding:'9px 22px', cursor:'pointer',
            fontSize:14, letterSpacing:1, fontFamily:"'Cinzel',Georgia,serif",
          }}>▶ Start</button>
        ) : (
          <button onClick={startGame} style={{
            background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)',
            color:'rgba(200,180,255,0.45)', borderRadius:8, padding:'6px 14px',
            cursor:'pointer', fontSize:12, letterSpacing:1, fontFamily:"'Cinzel',Georgia,serif",
          }}>↺ New</button>
        )}
      </div>

      {/* Team legend */}
      {phase==='playing' && (
        <div style={{ position:'absolute', top:64, right:20, zIndex:10, display:'flex', flexDirection:'column', gap:7 }}>
          <div style={{
            display:'flex', alignItems:'center', gap:7,
            background:'rgba(8,18,48,0.65)', border:'1px solid rgba(50,130,255,0.28)',
            borderRadius:9, padding:'5px 11px',
          }}>
            <div style={{width:8,height:8,borderRadius:'50%',background:PC[0],boxShadow:`0 0 6px ${PC[0]}`}}/>
            <div style={{width:8,height:8,borderRadius:'50%',background:PC[1],boxShadow:`0 0 6px ${PC[1]}`}}/>
            <div style={{width:24,height:2,background:'rgba(60,160,255,0.75)',borderRadius:2}}/>
            <span style={{color:'rgba(80,170,255,0.75)',fontSize:'0.58rem',letterSpacing:1.5}}>P1 + P2</span>
          </div>
          <div style={{
            display:'flex', alignItems:'center', gap:7,
            background:'rgba(38,8,10,0.65)', border:'1px solid rgba(255,50,50,0.28)',
            borderRadius:9, padding:'5px 11px',
          }}>
            <div style={{width:8,height:8,borderRadius:'50%',background:PC[2],boxShadow:`0 0 6px ${PC[2]}`}}/>
            <div style={{width:8,height:8,borderRadius:'50%',background:PC[3],boxShadow:`0 0 6px ${PC[3]}`}}/>
            <div style={{width:24,height:2,background:'rgba(255,60,60,0.75)',borderRadius:2}}/>
            <span style={{color:'rgba(255,80,80,0.75)',fontSize:'0.58rem',letterSpacing:1.5}}>P3 + P4</span>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={mountRef} style={{ flex:1 }} />

      {/* Bottom HUD */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, zIndex:10,
        padding:'10px 24px 22px',
        background:'linear-gradient(0deg, rgba(1,0,9,0.97) 0%, transparent 100%)',
        pointerEvents:'none',
      }}>
        {phase==='playing' && (
          <div style={{ display:'flex', justifyContent:'center', gap:9, marginBottom:11 }}>
            {[0,1,2,3].map(p => (
              <div key={p} style={{
                display:'flex', alignItems:'center', gap:6, padding:'5px 13px',
                borderRadius:20, fontSize:'0.68rem', letterSpacing:1.2,
                background: cpNow===p ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
                border:`1px solid ${cpNow===p ? PC[p]+'99' : 'rgba(255,255,255,0.07)'}`,
                color: cpNow===p ? PC[p] : 'rgba(255,255,255,0.28)',
                transition:'all 0.25s',
                boxShadow: cpNow===p ? `0 0 14px ${PC[p]}33` : 'none',
              }}>
                <div style={{
                  width:9, height:9, borderRadius:'50%', background:PC[p],
                  boxShadow: cpNow===p ? `0 0 8px ${PC[p]}` : 'none',
                  transition:'box-shadow 0.3s',
                }}/>P{p+1}
              </div>
            ))}
          </div>
        )}

        <div style={{
          textAlign:'center', minHeight:'1.2em',
          color: found ? '#44ffaa' : 'rgba(200,175,240,0.8)',
          fontSize:'0.84rem', letterSpacing:0.6, transition:'color 0.5s',
        }}>
          {msg || (phase==='idle' ? 'Find the hidden object · Both lines must cross it to reveal it' : '')}
        </div>

        {phase==='playing' && (
          <div style={{
            textAlign:'center', color:'rgba(255,255,255,0.15)',
            fontSize:'0.58rem', letterSpacing:2.5, marginTop:7, textTransform:'uppercase',
          }}>
            WASD or drag to rotate · Highlighted tiles are reachable
          </div>
        )}

        {found && phase==='playing' && (
          <div style={{ display:'flex', justifyContent:'center', marginTop:10 }}>
            <div style={{
              background:'rgba(0,185,85,0.09)', border:'1px solid rgba(0,220,100,0.3)',
              borderRadius:8, padding:'4px 22px', color:'#44ffaa',
              fontSize:'0.7rem', letterSpacing:2, textTransform:'uppercase',
            }}>✦ Green tile marks the hidden object ✦</div>
          </div>
        )}
      </div>

      {/* Win overlay */}
      {phase==='won' && winner!==null && (
        <div style={{
          position:'absolute', inset:0, zIndex:20,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(1,0,9,0.72)', backdropFilter:'blur(9px)',
        }}>
          <div style={{
            textAlign:'center', padding:'52px 72px',
            background:'linear-gradient(180deg,rgba(12,5,38,0.98),rgba(3,1,12,0.98))',
            border:`1px solid ${PC[winner]}44`, borderRadius:26,
            boxShadow:`0 0 120px ${PC[winner]}18`,
          }}>
            <div style={{ fontSize:'3.5rem', marginBottom:10, filter:`drop-shadow(0 0 20px ${PC[winner]})` }}>🏆</div>
            <div style={{ color:PC[winner], fontSize:'2.4rem', fontWeight:700, letterSpacing:6, textShadow:`0 0 30px ${PC[winner]}88` }}>
              Player {winner+1}
            </div>
            <div style={{ color:'rgba(200,178,240,0.5)', fontSize:'1rem', marginTop:8, letterSpacing:2 }}>
              Claims the hidden object!
            </div>
            <button onClick={startGame} style={{
              marginTop:34, padding:'13px 36px',
              background:`linear-gradient(180deg,${PC[winner]}30,${PC[winner]}16)`,
              border:`1px solid ${PC[winner]}55`, color:PC[winner],
              borderRadius:13, cursor:'pointer', fontSize:'0.95rem', letterSpacing:2,
              fontFamily:"'Cinzel',Georgia,serif",
            }}>Play Again</button>
          </div>
        </div>
      )}
    </div>
  );
}
