import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// TRUNCATED ICOSAHEDRON geometry helpers
// ─────────────────────────────────────────────────────────────────────────────
const PHI = (1 + Math.sqrt(5)) / 2;

function buildTIVerts() {
  const V = [];
  const push = (x, y, z) => {
    const l = Math.sqrt(x * x + y * y + z * z);
    V.push(new THREE.Vector3(x / l, y / l, z / l));
  };
  const t = PHI;
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
    push(0, s1, s2 * 3 * t); push(s1, s2 * 3 * t, 0); push(s2 * 3 * t, 0, s1);
  }
  const a = 2 + t, b = 2 * t;
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) for (const s3 of [1, -1]) {
    push(s1, s2 * a, s3 * b); push(s2 * a, s3 * b, s1); push(s3 * b, s1, s2 * a);
  }
  const c = 1 + 2 * t;
  for (const s1 of [1, -1]) for (const s2 of [1, -1]) for (const s3 of [1, -1]) {
    push(s1 * 2, s2 * c, s3 * t); push(s2 * c, s3 * t, s1 * 2); push(s3 * t, s1 * 2, s2 * c);
  }
  return V;
}

function buildTITopology(V) {
  const n = V.length;
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (V[i].distanceTo(V[j]) < 0.46) { adj[i].push(j); adj[j].push(i); }

  const sortedAdj = V.map((vi, i) => {
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(vi.y) > 0.9) { ux = 1; uy = 0; uz = 0; }
    const d = ux * vi.x + uy * vi.y + uz * vi.z;
    ux -= d * vi.x; uy -= d * vi.y; uz -= d * vi.z;
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= ul; uy /= ul; uz /= ul;
    const vx = vi.y * uz - vi.z * uy, vy = vi.z * ux - vi.x * uz, vz = vi.x * uy - vi.y * ux;
    return adj[i]
      .map(j => { const dx = V[j].x - vi.x, dy = V[j].y - vi.y, dz = V[j].z - vi.z; return { j, a: Math.atan2(dx * vx + dy * vy + dz * vz, dx * ux + dy * uy + dz * uz) }; })
      .sort((a, b) => a.a - b.a).map(x => x.j);
  });

  const faces = [];
  const used = new Set();
  for (let i = 0; i < n; i++) {
    for (const j of sortedAdj[i]) {
      if (used.has(i * n + j)) continue;
      const face = [i]; let u = i, v = j;
      for (let s = 0; s < 8; s++) {
        used.add(u * n + v); face.push(v);
        if (v === i) break;
        const nb = sortedAdj[v]; const idx = nb.indexOf(u);
        const next = nb[(idx + 1) % nb.length]; u = v; v = next;
      }
      if (face[face.length - 1] === face[0]) {
        face.pop();
        if (face.length === 5 || face.length === 6) faces.push(face);
      }
    }
  }

  const centroids = faces.map(f => {
    const c = new THREE.Vector3();
    f.forEach(i => c.add(V[i]));
    return c.divideScalar(f.length).normalize();
  });

  const fAdj = Array.from({ length: faces.length }, () => []);
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const fi = faces[i], fj = faces[j];
      const shared = fi.filter(v => fj.includes(v));
      if (shared.length < 2) continue;
      const [a, b] = shared;
      const ai = fi.indexOf(a), bi = fi.indexOf(b);
      const consec = Math.abs(ai - bi) === 1 || (ai === 0 && bi === fi.length - 1) || (bi === 0 && ai === fi.length - 1);
      if (consec) { fAdj[i].push(j); fAdj[j].push(i); }
    }
  }
  return { faces, centroids, fAdj };
}

// ── Geodesic sphere builder for 42 and 72 tiles ───────────────────────────
function buildGeodesicSphere(subdivisions) {
  // Build icosahedron vertices
  const t = (1 + Math.sqrt(5)) / 2;
  const rawVerts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => { const l = Math.sqrt(x*x+y*y+z*z); return new THREE.Vector3(x/l, y/l, z/l); });

  const icoFaces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];

  // Subdivide
  const verts = [...rawVerts];
  const midCache = new Map();
  const getMid = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (midCache.has(key)) return midCache.get(key);
    const mid = verts[a].clone().add(verts[b]).normalize();
    verts.push(mid);
    const idx = verts.length - 1;
    midCache.set(key, idx);
    return idx;
  };

  let faces = icoFaces;
  for (let s = 0; s < subdivisions; s++) {
    const newFaces = [];
    for (const [a, b, c] of faces) {
      const ab = getMid(a, b), bc = getMid(b, c), ca = getMid(c, a);
      newFaces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = newFaces;
  }

  // Group triangular faces into larger polygons by proximity
  // For gameplay we treat each triangle as a tile
  const centroids = faces.map(f => {
    const c = new THREE.Vector3();
    f.forEach(i => c.add(verts[i]));
    return c.divideScalar(f.length).normalize();
  });

  const n = faces.length;
  const fAdj = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const shared = faces[i].filter(v => faces[j].includes(v));
      if (shared.length >= 2) { fAdj[i].push(j); fAdj[j].push(i); }
    }
  }

  return { faces, centroids, fAdj, verts };
}

// ── Goldberg polyhedron for exact 42/72 tile counts ───────────────────────
function buildGoldberg(targetFaces) {
  // We'll use the TI topology but with extra subdivisions for variety
  // For 42: use a different geodesic approach
  // Simple approach: build sphere with approximately right number of triangular faces
  // then group them. For simplicity, use subdivided icosahedron tiles directly.
  // sub=1 -> 20 triangles, sub=2 -> 80 triangles
  // We'll use the triangle faces directly as "tiles" grouped by centroid proximity

  // Actually let's build a proper Goldberg GP(1,1) = 12 pentagons + 20 hexagons = 32 (truncated icosahedron) ✓
  // GP(2,0) = 12 pentagons + 30 hexagons = 42 ✓
  // GP(2,2) = 12 pentagons + 60 hexagons = 72 ✓

  if (targetFaces === 32) {
    return buildTITopology(buildTIVerts());
  }

  // For 42 and 72, subdivide icosahedron triangles and then dual them
  const subdiv = targetFaces === 42 ? 2 : 3;

  const t = (1 + Math.sqrt(5)) / 2;
  const rawVerts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map(([x, y, z]) => { const l = Math.sqrt(x*x+y*y+z*z); return new THREE.Vector3(x/l, y/l, z/l); });

  const icoFaces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];

  const verts = rawVerts.map(v => v.clone());
  const midCache = new Map();
  const getMid = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (midCache.has(key)) return midCache.get(key);
    const mid = verts[a].clone().add(verts[b]).normalize();
    verts.push(mid);
    const idx = verts.length - 1;
    midCache.set(key, idx);
    return idx;
  };

  let triFaces = icoFaces;
  for (let s = 0; s < subdiv; s++) {
    const nf = [];
    for (const [a, b, c] of triFaces) {
      const ab = getMid(a, b), bc = getMid(b, c), ca = getMid(c, a);
      nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    triFaces = nf;
  }

  // Build dual: each original vertex -> one dual face
  // Dual of subdivided icosahedron gives Goldberg polyhedron
  // Vertices of dual = centroids of triangular faces
  const triCentroids = triFaces.map(f => {
    const c = new THREE.Vector3();
    f.forEach(i => c.add(verts[i]));
    return c.divideScalar(f.length).normalize();
  });

  // For each original vertex, find all triangle faces containing it
  const vertToFaces = new Map();
  triFaces.forEach((f, fi) => {
    f.forEach(vi => {
      if (!vertToFaces.has(vi)) vertToFaces.set(vi, []);
      vertToFaces.get(vi).push(fi);
    });
  });

  // Each vertex -> one dual face (polygon whose vertices are the triangle centroids)
  const dualFaces = [];
  const dualCentroids = [];

  vertToFaces.forEach((faceIndices, vi) => {
    if (faceIndices.length < 3) return;
    // Sort face indices around the vertex
    const norm = verts[vi].clone();
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(norm.y) > 0.9) { ux = 1; uy = 0; uz = 0; }
    const d2 = ux * norm.x + uy * norm.y + uz * norm.z;
    ux -= d2 * norm.x; uy -= d2 * norm.y; uz -= d2 * norm.z;
    const ul = Math.sqrt(ux*ux+uy*uy+uz*uz); ux /= ul; uy /= ul; uz /= ul;
    const vvx = norm.y*uz-norm.z*uy, vvy = norm.z*ux-norm.x*uz, vvz = norm.x*uy-norm.y*ux;

    const sorted = faceIndices
      .map(fi => {
        const c = triCentroids[fi];
        return { fi, angle: Math.atan2(c.x*vvx+c.y*vvy+c.z*vvz, c.x*ux+c.y*uy+c.z*uz) };
      })
      .sort((a, b) => a.angle - b.angle)
      .map(x => x.fi);

    dualFaces.push(sorted);
    const centroid = new THREE.Vector3();
    sorted.forEach(fi => centroid.add(triCentroids[fi]));
    dualCentroids.push(centroid.divideScalar(sorted.length).normalize());
  });

  // Build face adjacency for dual faces
  const nDual = dualFaces.length;
  const fAdj = Array.from({ length: nDual }, () => []);
  for (let i = 0; i < nDual; i++) {
    for (let j = i + 1; j < nDual; j++) {
      const shared = dualFaces[i].filter(v => dualFaces[j].includes(v));
      if (shared.length >= 2) { fAdj[i].push(j); fAdj[j].push(i); }
    }
  }

  // Convert dualFaces (which are indices into triCentroids) to a format compatible with buildTileMesh
  // We need faces as arrays of vertex indices, and a verts array
  // triCentroids serve as our verts
  const faces = dualFaces;
  const verts2 = triCentroids;
  const centroids = dualCentroids;

  return { faces, centroids, fAdj, verts: verts2 };
}

function buildTileMesh(face, V, centroid, SR, inset) {
  const norm = centroid.clone();
  let ux = 0, uy = 1, uz = 0;
  if (Math.abs(norm.y) > 0.9) { ux = 1; uy = 0; uz = 0; }
  const d = ux * norm.x + uy * norm.y + uz * norm.z;
  ux -= d * norm.x; uy -= d * norm.y; uz -= d * norm.z;
  const ul = Math.sqrt(ux * ux + uy * uy + uz * uz); ux /= ul; uy /= ul; uz /= ul;
  const vx = norm.y * uz - norm.z * uy, vy = norm.z * ux - norm.x * uz, vz = norm.x * uy - norm.y * ux;
  const tu = new THREE.Vector3(ux, uy, uz);
  const tv = new THREE.Vector3(vx, vy, vz);
  const center3 = centroid.clone().multiplyScalar(SR);
  const verts3 = face
    .map(i => ({ p: V[i].clone().multiplyScalar(SR) }))
    .map(({ p }) => { const d2 = p.clone().sub(center3); return { p, angle: Math.atan2(d2.dot(tv), d2.dot(tu)) }; })
    .sort((a, b) => a.angle - b.angle).map(x => x.p);
  const nv = verts3.length;
  const insetVerts = verts3.map(p => center3.clone().lerp(p, inset).normalize().multiplyScalar(SR));
  const positions = [], normals = [];
  for (let k = 0; k < nv; k++) {
    const vA = center3, vB = insetVerts[k], vC = insetVerts[(k + 1) % nv];
    positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
    [vA, vB, vC].forEach(v => { const nn = v.clone().normalize(); normals.push(nn.x, nn.y, nn.z); });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geo;
}

// BFS shortest path
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
          const path = []; let c = end;
          while (c !== -1) { path.unshift(c); c = prev[c]; }
          return path;
        }
      }
    }
  }
  return [start];
}

function bfsDist(fAdj, start, end) {
  return bfsPath(fAdj, start, end).length - 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const SR = 2.5;
const PH = [0x2288ff, 0x22ddbb, 0xff2233, 0xff9900];
const PC = ['#2288ff', '#22ddbb', '#ff2233', '#ff9900'];
const PN = ['Vanguard', 'Lure', 'Stasis', 'Rift'];
const OFFSETS = [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07]];
const MAX_LIVES = 3;
const ABILITY_COOLDOWN = 8;

// Updated tile colors - brighter blue/purple palette
const COL_DEFAULT = new THREE.Color(0x0d1a40);
const COL_HOVER = new THREE.Color(0x1a3a9a);
const COL_ENEMY_ADJ = new THREE.Color(0x3a0820);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function SphereQuestGame({ onExit }) {
  const mountRef = useRef(null);
  const T = useRef(null);
  const MR = useRef({});
  const GS = useRef(null);
  const rot = useRef({ x: 0.3, y: 0 });
  const rotT = useRef({ x: 0.3, y: 0 });
  const keys = useRef({});
  const drag = useRef({ on: false, x: 0, y: 0 });

  const [phase, setPhase] = useState('idle');
  const [uiState, setUiState] = useState(null);
  const [log, setLog] = useState([]);
  const [score, setScore] = useState(0);
  const [tileCount, setTileCount] = useState(32);

  const addLog = useCallback((msg, color = 'rgba(200,180,255,0.9)') => {
    setLog(l => [{ msg, color, id: Date.now() + Math.random() }, ...l].slice(0, 5));
  }, []);

  const getQ = () => {
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(rot.current.x, rot.current.y, 0, 'YXZ'));
    return q;
  };

  // ── Three.js setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current;
    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, W / H, 0.1, 200);
    camera.position.z = 8.2;

    scene.add(new THREE.AmbientLight(0x4455cc, 2.2));
    const dl = new THREE.DirectionalLight(0xaabbff, 3.0); dl.position.set(5, 8, 6); scene.add(dl);
    const rl = new THREE.DirectionalLight(0x8866ff, 1.2); rl.position.set(-6, -3, -5); scene.add(rl);

    // Inner sphere - bright blue/purple
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(SR - 0.01, 64, 64),
      new THREE.MeshStandardMaterial({ color: 0x08103a, roughness: 0.8, side: THREE.BackSide, emissive: 0x060e30, emissiveIntensity: 0.5 })
    ));

    // Stars - more and brighter
    const sv = new Float32Array(9000);
    for (let i = 0; i < sv.length; i++) sv[i] = (Math.random() - 0.5) * 160;
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sv, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xaabbff, size: 0.055 })));

    // Extra bright star cluster
    const sv2 = new Float32Array(1500);
    for (let i = 0; i < sv2.length; i++) sv2[i] = (Math.random() - 0.5) * 160;
    const sg2 = new THREE.BufferGeometry(); sg2.setAttribute('position', new THREE.BufferAttribute(sv2, 3));
    scene.add(new THREE.Points(sg2, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 })));

    T.current = { renderer, scene, camera };

    let aid;
    const animate = () => {
      aid = requestAnimationFrame(animate);
      const spd = 0.025;
      if (keys.current['w'] || keys.current['W']) rotT.current.x -= spd;
      if (keys.current['s'] || keys.current['S']) rotT.current.x += spd;
      if (keys.current['a'] || keys.current['A']) rotT.current.y -= spd;
      if (keys.current['d'] || keys.current['D']) rotT.current.y += spd;
      rotT.current.x = Math.max(-1.5, Math.min(1.5, rotT.current.x));
      rot.current.x += (rotT.current.x - rot.current.x) * 0.1;
      rot.current.y += (rotT.current.y - rot.current.y) * 0.1;
      const q = getQ();
      scene.children.forEach(c => {
        if (!c.userData.basePos) return;
        c.position.copy(c.userData.basePos.clone().applyQuaternion(q));
        if (c.userData.baseQ) c.quaternion.copy(q).multiply(c.userData.baseQ);
      });
      if (MR.current.tileGroup) MR.current.tileGroup.quaternion.copy(q);
      const gs = GS.current;
      if (gs && MR.current.tiles) {
        const t2 = Date.now() * 0.002;
        MR.current.tiles.forEach(mesh => {
          const fi = mesh.userData.fi;
          if (fi === gs.targetFace) {
            const pulse = 0.35 + 0.35 * Math.sin(t2 * 3.5);
            mesh.material.emissiveIntensity = pulse;
          }
        });
        if (MR.current.enemy && gs.enemyStunned <= 0) {
          const pulse = 0.4 + 0.35 * Math.sin(t2 * 4);
          MR.current.enemy.material.emissiveIntensity = pulse;
        }
      }
      if (MR.current.ring) {
        const t3 = Date.now() * 0.003;
        MR.current.ring.material.opacity = 0.3 + 0.45 * Math.sin(t3 * 2.8);
      }
      renderer.render(scene, camera);
    };
    animate();
    T.current.stopAnim = () => cancelAnimationFrame(aid);

    const onResize = () => {
      const w2 = el.clientWidth, h2 = el.clientHeight;
      renderer.setSize(w2, h2); camera.aspect = w2 / h2; camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    return () => {
      T.current.stopAnim?.(); window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const kd = e => { keys.current[e.key] = true; };
    const ku = e => { keys.current[e.key] = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, []);

  useEffect(() => {
    const el = mountRef.current;
    const onMD = e => { drag.current = { on: true, x: e.clientX, y: e.clientY }; };
    const onMM = e => {
      if (!drag.current.on) return;
      rotT.current.y += (e.clientX - drag.current.x) * 0.008;
      rotT.current.x += (e.clientY - drag.current.y) * 0.008;
      drag.current = { on: true, x: e.clientX, y: e.clientY };
    };
    const onMU = () => { drag.current.on = false; };
    const onTS = e => { if (e.touches.length === 1) drag.current = { on: true, x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onTM = e => {
      if (!drag.current.on || e.touches.length !== 1) return;
      e.preventDefault();
      rotT.current.y += (e.touches[0].clientX - drag.current.x) * 0.008;
      rotT.current.x += (e.touches[0].clientY - drag.current.y) * 0.008;
      drag.current = { on: true, x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    el.addEventListener('mousedown', onMD); window.addEventListener('mousemove', onMM); window.addEventListener('mouseup', onMU);
    el.addEventListener('touchstart', onTS); el.addEventListener('touchmove', onTM, { passive: false }); window.addEventListener('touchend', onMU);
    return () => {
      el.removeEventListener('mousedown', onMD); window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU);
      el.removeEventListener('touchstart', onTS); el.removeEventListener('touchmove', onTM); window.removeEventListener('touchend', onMU);
    };
  }, []);

  // ── Place mesh on sphere ───────────────────────────────────────────────────
  const placeMeshOnFace = useCallback((mesh, faceIdx) => {
    const gs = GS.current;
    const norm = gs.centroids[faceIdx].clone().normalize();
    const pos = norm.clone().multiplyScalar(SR + 0.2);
    mesh.userData.basePos = pos.clone();
    mesh.position.copy(pos.clone().applyQuaternion(getQ()));
  }, []);

  const placePlayerMesh = useCallback((mesh, faceIdx, playerIdx) => {
    const gs = GS.current;
    const norm = gs.centroids[faceIdx].clone().normalize();
    const c = norm.clone().multiplyScalar(SR + 0.18);
    const up = Math.abs(norm.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tu = new THREE.Vector3().crossVectors(norm, up).normalize();
    const tv = new THREE.Vector3().crossVectors(norm, tu).normalize();
    c.addScaledVector(tu, OFFSETS[playerIdx][0]).addScaledVector(tv, OFFSETS[playerIdx][1]);
    mesh.userData.basePos = c.clone();
    mesh.position.copy(c.clone().applyQuaternion(getQ()));
  }, []);

  // ── Refresh all visuals ────────────────────────────────────────────────────
  const refreshAll = useCallback(() => {
    const gs = GS.current;
    const mr = MR.current;
    if (!gs || !mr.tiles) return;
    const { fAdj, pp, enemyFace, targetFace, targetPlayer, enemyStunned } = gs;
    const cpNow = gs.turnPlayerIdx;
    const alive = gs.lives.map(l => l > 0);

    mr.tiles.forEach(mesh => {
      const fi = mesh.userData.fi;
      const isTarget = fi === targetFace;
      const isEnemyAdj = fAdj[enemyFace]?.includes(fi) || fi === enemyFace;

      if (isTarget) {
        const col = new THREE.Color(PH[targetPlayer]);
        mesh.material.color.copy(col.clone().multiplyScalar(0.3));
        mesh.material.emissive.copy(col);
        mesh.material.emissiveIntensity = 0.5;
      } else if (!alive[cpNow]) {
        mesh.material.color.copy(COL_DEFAULT);
        mesh.material.emissive.setHex(0);
        mesh.material.emissiveIntensity = 0;
      } else if (gs.riftMode) {
        const isOccupied = pp.some((p, i) => alive[i] && p === fi) || fi === enemyFace;
        if (!isOccupied) {
          mesh.material.color.setHex(0x331500);
          mesh.material.emissive.setHex(0x441800);
          mesh.material.emissiveIntensity = 0.3;
        } else {
          mesh.material.color.copy(COL_DEFAULT);
          mesh.material.emissive.setHex(0);
          mesh.material.emissiveIntensity = 0;
        }
      } else if (fAdj[pp[cpNow]]?.includes(fi)) {
        mesh.material.color.copy(COL_HOVER);
        mesh.material.emissive.setHex(0x102060);
        mesh.material.emissiveIntensity = 0.3;
      } else if (isEnemyAdj && !isTarget) {
        mesh.material.color.copy(COL_ENEMY_ADJ);
        mesh.material.emissive.setHex(0x300010);
        mesh.material.emissiveIntensity = 0.15;
      } else {
        mesh.material.color.copy(COL_DEFAULT);
        mesh.material.emissive.setHex(0x050a20);
        mesh.material.emissiveIntensity = 0.08;
      }
    });

    for (let p = 0; p < 4; p++) {
      if (mr.players[p]) {
        mr.players[p].visible = alive[p];
        placePlayerMesh(mr.players[p], pp[p], p);
      }
    }

    if (mr.enemy) {
      placeMeshOnFace(mr.enemy, enemyFace);
      const stunned = enemyStunned > 0;
      mr.enemy.material.color.setHex(stunned ? 0x4400aa : 0x000000);
      mr.enemy.material.emissive.setHex(stunned ? 0x220066 : 0x330000);
      mr.enemy.material.emissiveIntensity = stunned ? 0.7 : 0.5;
    }

    if (mr.ring && alive[cpNow]) {
      const norm = gs.centroids[pp[cpNow]].clone().normalize();
      const rp = norm.clone().multiplyScalar(SR + 0.18);
      const up2 = Math.abs(norm.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const tu2 = new THREE.Vector3().crossVectors(norm, up2).normalize();
      const tv2 = new THREE.Vector3().crossVectors(norm, tu2).normalize();
      rp.addScaledVector(tu2, OFFSETS[cpNow][0]).addScaledVector(tv2, OFFSETS[cpNow][1]);
      const rQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
      mr.ring.userData.basePos = rp.clone();
      mr.ring.userData.baseQ = rQ.clone();
      mr.ring.position.copy(rp.clone().applyQuaternion(getQ()));
      mr.ring.quaternion.copy(getQ()).multiply(rQ);
      mr.ring.material.color.setHex(PH[cpNow]);
      mr.ring.visible = true;
    } else if (mr.ring) {
      mr.ring.visible = false;
    }
  }, [placeMeshOnFace, placePlayerMesh]);

  const syncUI = useCallback(() => {
    const gs = GS.current;
    if (!gs) return;
    setUiState({
      lives: [...gs.lives],
      abilityCooldowns: [...gs.abilityCooldowns],
      turnPlayerIdx: gs.turnPlayerIdx,
      phase: gs.phase,
      enemyStunned: gs.enemyStunned,
      taunted: gs.taunted,
      riftMode: gs.riftMode,
      riftTarget: gs.riftTarget,
      sprintActive: gs.sprintActive,
      targetPlayer: gs.targetPlayer,
    });
  }, []);

  const pickTarget = useCallback((gs) => {
    const alive = gs.lives.map(l => l > 0);
    const alivePlayers = [0, 1, 2, 3].filter(p => alive[p]);
    if (alivePlayers.length === 0) return;
    const tp = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    let tf;
    let tries = 0;
    do { tf = Math.floor(Math.random() * gs.faces.length); tries++; }
    while ((tf === gs.targetFace || gs.pp.includes(tf) || tf === gs.enemyFace) && tries < 60);
    gs.targetPlayer = tp;
    gs.targetFace = tf;
    return tp;
  }, []);

  const moveEnemy = useCallback(() => {
    const gs = GS.current;
    if (!gs) return;

    if (gs.enemyStunned > 0) {
      gs.enemyStunned--;
      addLog(`⚡ Enemy stunned (${gs.enemyStunned} rounds left)`, '#aa66ff');
      return;
    }

    const alive = gs.lives.map(l => l > 0);
    const alivePlayers = [0, 1, 2, 3].filter(p => alive[p]);
    if (alivePlayers.length === 0) return;

    let targetP;
    if (gs.taunted >= 0 && alive[gs.taunted]) {
      targetP = gs.taunted;
      gs.tauntRounds--;
      if (gs.tauntRounds <= 0) {
        addLog(`😈 Enemy freed from taunt!`, '#ffaa44');
        gs.taunted = -1;
        gs.tauntRounds = 0;
      }
    } else {
      let minDist = Infinity;
      alivePlayers.forEach(p => {
        const d = bfsDist(gs.fAdj, gs.enemyFace, gs.pp[p]);
        if (d < minDist) { minDist = d; targetP = p; }
      });
    }

    const path = bfsPath(gs.fAdj, gs.enemyFace, gs.pp[targetP]);
    if (path.length > 1) gs.enemyFace = path[1];

    alivePlayers.forEach(p => {
      if (gs.enemyFace === gs.pp[p]) {
        gs.lives[p] = Math.max(0, gs.lives[p] - 1);
        addLog(`💀 Enemy caught Player ${p + 1}! -1 life`, '#ff3333');
        if (gs.lives[p] <= 0) addLog(`☠ Player ${p + 1} eliminated!`, '#ff1111');
      }
    });

    gs.roundCounter++;
    gs.abilityCooldowns = gs.abilityCooldowns.map(cd => Math.max(0, cd - 1));
  }, [addLog]);

  const nextTurn = useCallback(() => {
    const gs = GS.current;
    if (!gs) return;

    const alive = gs.lives.map(l => l > 0);
    let next = (gs.turnPlayerIdx + 1) % 4;
    let loops = 0;
    while (!alive[next] && loops < 4) { next = (next + 1) % 4; loops++; }

    const didWrap = next <= gs.turnPlayerIdx || loops >= 4;
    if (didWrap && alive.some(a => a)) moveEnemy();

    if (!gs.lives.some(l => l > 0)) {
      gs.phase = 'gameover';
      setPhase('gameover');
      return;
    }

    const alive2 = gs.lives.map(l => l > 0);
    let next2 = next;
    let loops2 = 0;
    while (!alive2[next2] && loops2 < 4) { next2 = (next2 + 1) % 4; loops2++; }

    gs.turnPlayerIdx = next2;
    gs.sprintActive = false;
    gs.riftMode = false;
    gs.riftTarget = -1;

    syncUI();
    refreshAll();
  }, [moveEnemy, syncUI, refreshAll]);

  // ── START GAME ─────────────────────────────────────────────────────────────
  const startGame = useCallback((selectedTileCount) => {
    const { scene } = T.current || {};
    if (!scene) return;
    const tc = selectedTileCount || tileCount;

    scene.children.filter(c => c.userData.isGame).forEach(c => scene.remove(c));
    MR.current = {};

    const { faces, centroids, fAdj, verts } = buildGoldberg(tc);
    const V = verts || buildTIVerts();

    let sf = 0;
    centroids.forEach((c, i) => { if (c.y > centroids[sf].y) sf = i; });
    let ef = 0;
    centroids.forEach((c, i) => { if (c.y < centroids[ef].y) ef = i; });

    const q = getQ();

    const tileMeshes = [];
    faces.forEach((face, fi) => {
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.45,
        metalness: 0.35,
        emissive: new THREE.Color(0x050a20),
        emissiveIntensity: 0.08,
      });
      mat.color.copy(COL_DEFAULT);
      const geo = buildTileMesh(face, V, centroids[fi], SR, 0.94);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { fi, isGame: true };
      tileMeshes.push(mesh);
    });
    MR.current.tiles = tileMeshes;

    let tileGroup = new THREE.Group();
    tileGroup.name = 'tileGroup';
    tileGroup.userData = { isGame: true };
    tileMeshes.forEach(m => tileGroup.add(m));
    tileGroup.quaternion.copy(q);
    scene.add(tileGroup);
    MR.current.tileGroup = tileGroup;

    const players = PH.map((col, p) => {
      const norm = centroids[sf].clone().normalize();
      const c = norm.clone().multiplyScalar(SR + 0.18);
      const up = Math.abs(norm.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const tu = new THREE.Vector3().crossVectors(norm, up).normalize();
      const tv = new THREE.Vector3().crossVectors(norm, tu).normalize();
      c.addScaledVector(tu, OFFSETS[p][0]).addScaledVector(tv, OFFSETS[p][1]);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, metalness: 0.55, emissive: col, emissiveIntensity: 0.65 })
      );
      mesh.userData = { isGame: true, basePos: c.clone() };
      mesh.position.copy(c.clone().applyQuaternion(q));
      scene.add(mesh);
      return mesh;
    });
    MR.current.players = players;

    const enemyNorm = centroids[ef].clone().normalize();
    const enemyPos = enemyNorm.clone().multiplyScalar(SR + 0.2);
    const enemyMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14),
      new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x330000, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.8 })
    );
    enemyMesh.userData = { isGame: true, basePos: enemyPos.clone() };
    enemyMesh.position.copy(enemyPos.clone().applyQuaternion(q));
    scene.add(enemyMesh);
    MR.current.enemy = enemyMesh;

    const norm0 = centroids[sf].clone().normalize();
    const rp0 = norm0.clone().multiplyScalar(SR + 0.18);
    const rQ0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm0);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.013, 8, 32),
      new THREE.MeshBasicMaterial({ color: PH[0], transparent: true, opacity: 0.7 })
    );
    ring.userData = { isGame: true, basePos: rp0.clone(), baseQ: rQ0.clone() };
    ring.position.copy(rp0.clone().applyQuaternion(q));
    ring.quaternion.copy(q).multiply(rQ0);
    scene.add(ring);
    MR.current.ring = ring;

    const gs = {
      faces, centroids, fAdj,
      pp: [sf, sf, sf, sf],
      enemyFace: ef,
      targetFace: -1,
      targetPlayer: 0,
      lives: [MAX_LIVES, MAX_LIVES, MAX_LIVES, MAX_LIVES],
      abilityCooldowns: [0, 0, 0, 0],
      turnPlayerIdx: 0,
      phase: 'playing',
      enemyStunned: 0,
      taunted: -1,
      tauntRounds: 0,
      roundCounter: 0,
      sprintActive: false,
      sprintFirstFace: -1,
      riftMode: false,
      riftTarget: -1,
    };
    GS.current = gs;

    const tp = pickTarget(gs);

    setPhase('playing');
    setScore(0);
    setLog([]);
    syncUI();
    refreshAll();
    addLog(`🎯 Quest! ${PN[tp]} must reach the glowing tile`, PC[tp]);
  }, [tileCount, pickTarget, syncUI, refreshAll, addLog]);

  // ── CHECK QUEST ────────────────────────────────────────────────────────────
  const checkQuest = useCallback(() => {
    const gs = GS.current;
    if (!gs) return;
    if (gs.pp[gs.targetPlayer] === gs.targetFace && gs.targetFace >= 0) {
      setScore(s => s + 10);
      addLog(`✨ ${PN[gs.targetPlayer]} scored! +10`, PC[gs.targetPlayer]);
      const tp = pickTarget(gs);
      addLog(`🎯 New quest for ${PN[tp]}!`, PC[tp]);
      refreshAll();
    }
  }, [addLog, pickTarget, refreshAll]);

  const nextTurnWithQuest = useCallback(() => {
    checkQuest();
    nextTurn();
  }, [checkQuest, nextTurn]);

  const nextTurnRef = useRef(nextTurnWithQuest);
  useEffect(() => { nextTurnRef.current = nextTurnWithQuest; }, [nextTurnWithQuest]);
  const checkQuestRef = useRef(checkQuest);
  useEffect(() => { checkQuestRef.current = checkQuest; }, [checkQuest]);

  // ── HANDLE TILE CLICK ─────────────────────────────────────────────────────
  const handleTileClick = useCallback((fi) => {
    const gs = GS.current;
    if (!gs || gs.phase !== 'playing') return;
    const cp = gs.turnPlayerIdx;
    const alive = gs.lives.map(l => l > 0);
    if (!alive[cp]) return;

    if (gs.riftMode) {
      if (gs.riftTarget === -1) {
        const pOnTile = [0, 1, 2, 3].find(p => alive[p] && gs.pp[p] === fi);
        if (pOnTile !== undefined) {
          gs.riftTarget = pOnTile;
          addLog(`↔ Select destination for Player ${pOnTile + 1}`, PC[pOnTile]);
          refreshAll(); syncUI(); return;
        } else if (fi === gs.enemyFace) {
          gs.riftTarget = 99;
          addLog(`↔ Select destination for the Enemy`, '#ff4444');
          refreshAll(); syncUI(); return;
        }
      } else {
        const isOccupied = gs.pp.some((p, i) => alive[i] && p === fi) || fi === gs.enemyFace;
        if (isOccupied) { addLog('That tile is occupied!', '#ff8800'); return; }
        if (gs.riftTarget === 99) {
          gs.enemyFace = fi;
          addLog(`🌀 Enemy teleported!`, '#ff6600');
        } else {
          gs.pp[gs.riftTarget] = fi;
          addLog(`🌀 Player ${gs.riftTarget + 1} teleported!`, PC[gs.riftTarget]);
        }
        gs.riftMode = false; gs.riftTarget = -1;
        gs.abilityCooldowns[3] = ABILITY_COOLDOWN;
        checkQuestRef.current();
        refreshAll(); syncUI();
        nextTurnRef.current();
        return;
      }
      return;
    }

    if (!gs.fAdj[gs.pp[cp]].includes(fi)) return;
    gs.pp[cp] = fi;

    if (gs.sprintActive) {
      gs.sprintActive = false;
      checkQuestRef.current();
      refreshAll(); syncUI();
      addLog(`👟 Sprint! Move again`, PC[cp]);
      return;
    }

    checkQuestRef.current();
    refreshAll(); syncUI();
    nextTurnRef.current();
  }, [addLog, refreshAll, syncUI]);

  // ── ABILITY HANDLERS ─────────────────────────────────────────────────────
  const useAbility = useCallback((playerIdx) => {
    const gs = GS.current;
    if (!gs || gs.phase !== 'playing') return;
    if (gs.turnPlayerIdx !== playerIdx) { addLog('Not your turn!', '#ff8800'); return; }
    if (gs.abilityCooldowns[playerIdx] > 0) { addLog(`Ability on cooldown (${gs.abilityCooldowns[playerIdx]} rounds)`, '#ff8800'); return; }
    const alive = gs.lives.map(l => l > 0);
    if (!alive[playerIdx]) return;

    if (playerIdx === 0) {
      gs.sprintActive = true;
      gs.abilityCooldowns[0] = ABILITY_COOLDOWN;
      addLog(`👟 ${PN[0]} sprints! Click twice`, PC[0]);
      syncUI(); refreshAll();
    } else if (playerIdx === 1) {
      gs.taunted = 1; gs.tauntRounds = 2;
      gs.abilityCooldowns[1] = ABILITY_COOLDOWN;
      addLog(`😤 ${PN[1]} taunts the enemy!`, PC[1]);
      syncUI(); refreshAll();
      nextTurnRef.current();
    } else if (playerIdx === 2) {
      const enemyAdj = gs.fAdj[gs.pp[2]];
      if (gs.enemyFace === gs.pp[2] || enemyAdj.includes(gs.enemyFace)) {
        gs.enemyStunned = 2;
        gs.abilityCooldowns[2] = ABILITY_COOLDOWN;
        addLog(`⚡ ${PN[2]} stunned the enemy for 2 rounds!`, PC[2]);
        syncUI(); refreshAll();
        nextTurnRef.current();
      } else {
        addLog(`Enemy too far for stun!`, '#ff8800');
      }
    } else if (playerIdx === 3) {
      gs.riftMode = true; gs.riftTarget = -1;
      addLog(`🌀 ${PN[3]} opens a rift — click a player or the enemy`, PC[3]);
      syncUI(); refreshAll();
    }
  }, [addLog, syncUI, refreshAll]);

  // ── RAYCASTING ────────────────────────────────────────────────────────────
  useEffect(() => {
    const { renderer, camera } = T.current || {};
    if (!renderer) return;
    const rc = new THREE.Raycaster();
    const mo = new THREE.Vector2();
    const handler = e => {
      if (phase !== 'playing') return;
      const rect = renderer.domElement.getBoundingClientRect();
      mo.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mo.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      rc.setFromCamera(mo, camera);
      const gs = GS.current;
      if (gs?.riftMode && gs.riftTarget === -1) {
        const enemyHits = rc.intersectObject(MR.current.enemy);
        if (enemyHits.length > 0) { handleTileClick(gs.enemyFace); return; }
      }
      const hits = rc.intersectObjects(MR.current.tiles || []);
      if (hits.length > 0) handleTileClick(hits[0].object.userData.fi);
    };
    renderer.domElement.addEventListener('click', handler);
    return () => renderer.domElement.removeEventListener('click', handler);
  }, [phase, handleTileClick]);

  // ── RENDER ────────────────────────────────────────────────────────────────
  const gs = GS.current;
  const cp = uiState?.turnPlayerIdx ?? 0;
  const alive = uiState ? uiState.lives.map(l => l > 0) : [false, false, false, false];

  const ABILITY_INFO = [
    { name: 'Sprint', desc: 'Move 2 tiles this turn', icon: '👟' },
    { name: 'Taunt', desc: 'Enemy chases you 2 rounds', icon: '😤' },
    { name: 'Stun', desc: 'Stun enemy if nearby', icon: '⚡' },
    { name: 'Rift', desc: 'Teleport enemy or player', icon: '🌀' },
  ];

  return (
    <div style={{
      width: '100%', height: '100vh',
      background: 'radial-gradient(ellipse at 30% 20%, #1a0850 0%, #0d1560 30%, #060a38 60%, #020418 100%)',
      display: 'flex', flexDirection: 'column', position: 'relative',
      fontFamily: "'Cinzel', Georgia, serif", overflow: 'hidden', userSelect: 'none',
    }}>
      {/* Subtle nebula layer */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 70% 80%, rgba(80,20,140,0.25) 0%, transparent 55%), radial-gradient(ellipse at 20% 60%, rgba(20,60,180,0.2) 0%, transparent 50%)',
      }} />

      {/* TOP BAR */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px',
        background: 'linear-gradient(180deg, rgba(5,3,25,0.97) 0%, transparent 100%)',
        borderBottom: '1px solid rgba(100,120,255,0.12)',
      }}>
        <button onClick={onExit} style={{
          background: 'rgba(100,120,255,0.07)', border: '1px solid rgba(100,120,255,0.18)',
          color: '#8899cc', borderRadius: 7, padding: '6px 14px', cursor: 'pointer',
          fontSize: 12, letterSpacing: 1, fontFamily: "'Cinzel',Georgia,serif",
        }}>← Exit</button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'rgba(140,160,255,0.5)', fontSize: '0.6rem', letterSpacing: 5, textTransform: 'uppercase' }}>◈ Sphere Quest</div>
          {phase === 'playing' && uiState && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, justifyContent: 'center' }}>
              <div style={{
                color: alive[cp] ? PC[cp] : '#555', fontSize: '0.85rem', fontWeight: 700, letterSpacing: 2.5,
                textShadow: alive[cp] ? `0 0 14px ${PC[cp]}aa` : 'none',
              }}>
                {alive[cp] ? `${PN[cp]}'s Turn` : 'Skipped...'}
              </div>
              {uiState.sprintActive && <span style={{ color: PC[0], fontSize: '0.65rem', background: 'rgba(34,136,255,0.15)', border: '1px solid rgba(34,136,255,0.4)', borderRadius: 6, padding: '2px 8px' }}>SPRINT: move again</span>}
              {uiState.riftMode && <span style={{ color: PC[3], fontSize: '0.65rem', background: 'rgba(255,153,0,0.15)', border: '1px solid rgba(255,153,0,0.4)', borderRadius: 6, padding: '2px 8px' }}>RIFT: {uiState.riftTarget === -1 ? 'select target' : 'select destination'}</span>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(180,190,255,0.3)', fontSize: '0.55rem', letterSpacing: 3 }}>SCORE</div>
            <div style={{ color: '#ffe066', fontSize: '1.4rem', fontWeight: 700, letterSpacing: 2, textShadow: '0 0 20px #ffcc0088' }}>{score}</div>
          </div>
          {phase !== 'idle' && (
            <button onClick={() => startGame()} style={{
              background: 'rgba(100,120,255,0.07)', border: '1px solid rgba(100,120,255,0.18)',
              color: 'rgba(180,190,255,0.45)', borderRadius: 7, padding: '5px 12px',
              cursor: 'pointer', fontSize: 11, letterSpacing: 1, fontFamily: "'Cinzel',Georgia,serif",
            }}>↺ New</button>
          )}
        </div>
      </div>

      {/* PLAYER CARDS — right */}
      {phase === 'playing' && uiState && (
        <div style={{ position: 'absolute', top: 68, right: 14, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3].map(p => {
            const isActive = cp === p;
            const isAlive = uiState.lives[p] > 0;
            const cd = uiState.abilityCooldowns[p];
            const abi = ABILITY_INFO[p];
            return (
              <div key={p} style={{
                borderRadius: 10, overflow: 'hidden',
                border: isActive && isAlive ? `1px solid ${PC[p]}88` : '1px solid rgba(100,120,255,0.1)',
                background: isActive && isAlive ? `rgba(8,12,40,0.95)` : 'rgba(4,6,22,0.82)',
                opacity: isAlive ? 1 : 0.35,
                transition: 'all 0.2s',
                boxShadow: isActive && isAlive ? `0 0 22px ${PC[p]}30, inset 0 0 12px ${PC[p]}10` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px 5px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: PC[p], boxShadow: isActive ? `0 0 12px ${PC[p]}` : 'none', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: isAlive ? (isActive ? PC[p] : 'rgba(180,190,255,0.5)') : '#445', fontSize: '0.62rem', letterSpacing: 1.5, marginBottom: 3 }}>
                      {isAlive ? '' : '☠ '}{PN[p]}
                    </div>
                    {/* Prominent hearts */}
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {Array.from({ length: MAX_LIVES }).map((_, i) => (
                        <span key={i} style={{
                          fontSize: '0.9rem',
                          filter: uiState.lives[p] > i
                            ? `drop-shadow(0 0 4px ${PC[p]}) drop-shadow(0 0 8px ${PC[p]}88)`
                            : 'none',
                          opacity: uiState.lives[p] > i ? 1 : 0.15,
                          color: uiState.lives[p] > i ? (uiState.lives[p] === 1 ? '#ff4444' : PC[p]) : '#334',
                          transition: 'all 0.3s',
                          lineHeight: 1,
                        }}>♥</span>
                      ))}
                    </div>
                  </div>
                  {isAlive && isActive && (
                    <button
                      onClick={() => useAbility(p)}
                      disabled={cd > 0}
                      style={{
                        background: cd > 0 ? 'rgba(255,255,255,0.03)' : `rgba(${p === 0 ? '34,136,255' : p === 1 ? '34,221,187' : p === 2 ? '255,34,51' : '255,153,0'},0.18)`,
                        border: `1px solid ${cd > 0 ? 'rgba(100,120,255,0.12)' : PC[p] + '66'}`,
                        borderRadius: 6, padding: '3px 8px', cursor: cd > 0 ? 'default' : 'pointer',
                        color: cd > 0 ? 'rgba(150,160,200,0.3)' : PC[p],
                        fontSize: '0.7rem', fontFamily: "'Cinzel',Georgia,serif",
                        transition: 'all 0.15s',
                      }}
                      title={abi.desc}
                    >
                      {abi.icon} {cd > 0 ? cd : abi.name}
                    </button>
                  )}
                </div>
                {isActive && isAlive && (
                  <div style={{ padding: '0 10px 6px', color: 'rgba(160,175,255,0.3)', fontSize: '0.52rem', letterSpacing: 0.5 }}>
                    {abi.desc}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ENEMY STATUS — left */}
      {phase === 'playing' && uiState && gs && (
        <div style={{
          position: 'absolute', top: 68, left: 14, zIndex: 10,
          background: 'rgba(4,2,16,0.88)', border: '1px solid rgba(255,30,30,0.2)',
          borderRadius: 10, padding: '8px 12px', minWidth: 110,
        }}>
          <div style={{ color: 'rgba(255,80,80,0.7)', fontSize: '0.55rem', letterSpacing: 3, marginBottom: 4 }}>ENEMY</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, background: '#000', border: '1px solid #ff333466', borderRadius: 2, transform: 'rotate(45deg)' }} />
            <div style={{
              color: uiState.enemyStunned > 0 ? '#bb77ff' : '#ff5555',
              fontSize: '0.65rem', letterSpacing: 1,
            }}>
              {uiState.enemyStunned > 0 ? `⚡ Stunned (${uiState.enemyStunned})` : uiState.taunted >= 0 ? `😤 Taunted (${gs.tauntRounds})` : '👁 Hunting'}
            </div>
          </div>
        </div>
      )}

      {/* EVENT LOG — bottom left */}
      {phase === 'playing' && (
        <div style={{
          position: 'absolute', bottom: 90, left: 16, zIndex: 10,
          display: 'flex', flexDirection: 'column-reverse', gap: 3,
          pointerEvents: 'none', maxWidth: 260,
        }}>
          {log.map((entry, i) => (
            <div key={entry.id} style={{
              color: entry.color,
              fontSize: '0.68rem', letterSpacing: 0.5,
              opacity: 1 - i * 0.18,
              background: 'rgba(5,4,20,0.6)',
              borderRadius: 4, padding: '3px 8px',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(100,120,255,0.08)',
            }}>{entry.msg}</div>
          ))}
        </div>
      )}

      {/* QUEST STATUS — bottom center */}
      {phase === 'playing' && gs && (
        <div style={{
          position: 'absolute', bottom: 56, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', zIndex: 10, pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(5,3,22,0.88)', border: `1px solid ${gs.targetPlayer >= 0 ? PC[gs.targetPlayer] + '55' : 'rgba(100,120,255,0.15)'}`,
            borderRadius: 20, padding: '5px 18px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: PC[gs.targetPlayer ?? 0], boxShadow: `0 0 10px ${PC[gs.targetPlayer ?? 0]}` }} />
            <span style={{ color: 'rgba(180,190,255,0.5)', fontSize: '0.65rem', letterSpacing: 1.5 }}>
              Quest: <span style={{ color: PC[gs.targetPlayer ?? 0] }}>{PN[gs.targetPlayer ?? 0]}</span> must reach the glowing tile
            </span>
          </div>
        </div>
      )}

      {/* CANVAS */}
      <div ref={mountRef} style={{ flex: 1, position: 'relative', zIndex: 1 }} />

      {/* HINT */}
      {phase === 'playing' && (
        <div style={{
          position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center',
          color: 'rgba(150,170,255,0.2)', fontSize: '0.55rem', letterSpacing: 2.5, zIndex: 10, pointerEvents: 'none',
        }}>
          WASD / drag to rotate · Click highlighted tiles to move · Use abilities on your turn
        </div>
      )}

      {/* IDLE / START SCREEN */}
      {phase === 'idle' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
            <div>
              <div style={{ color: 'rgba(140,160,255,0.7)', fontSize: '0.75rem', letterSpacing: 7, marginBottom: 10, textTransform: 'uppercase' }}>Co-op Survival</div>
              <div style={{
                color: 'rgba(200,210,255,0.85)', fontSize: '2.2rem', fontWeight: 700, letterSpacing: 6,
                textShadow: '0 0 40px rgba(100,130,255,0.5), 0 0 80px rgba(80,50,200,0.3)',
              }}>SPHERE QUEST</div>
              <div style={{ color: 'rgba(150,165,255,0.35)', fontSize: '0.65rem', letterSpacing: 2, marginTop: 10, lineHeight: 2 }}>
                Reach colored tiles to score · Survive the enemy · Use abilities to help your team
              </div>
            </div>

            {/* Tile Count Selector */}
            <div style={{
              background: 'rgba(10,8,40,0.8)', border: '1px solid rgba(100,120,255,0.2)',
              borderRadius: 14, padding: '20px 28px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            }}>
              <div style={{ color: 'rgba(160,175,255,0.6)', fontSize: '0.6rem', letterSpacing: 3, textTransform: 'uppercase' }}>
                Sphere Size
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { count: 32, label: '32', sub: 'Classic' },
                  { count: 42, label: '42', sub: 'Extended' },
                  { count: 72, label: '72', sub: 'Vast' },
                ].map(({ count, label, sub }) => (
                  <button
                    key={count}
                    onClick={() => setTileCount(count)}
                    style={{
                      background: tileCount === count
                        ? 'linear-gradient(180deg, rgba(60,80,220,0.5), rgba(30,40,160,0.5))'
                        : 'rgba(255,255,255,0.03)',
                      border: tileCount === count
                        ? '1px solid rgba(120,150,255,0.6)'
                        : '1px solid rgba(100,120,255,0.15)',
                      borderRadius: 10,
                      padding: '12px 20px',
                      cursor: 'pointer',
                      color: tileCount === count ? '#c0d0ff' : 'rgba(140,155,220,0.5)',
                      fontFamily: "'Cinzel',Georgia,serif",
                      transition: 'all 0.2s',
                      minWidth: 80,
                      boxShadow: tileCount === count ? '0 0 20px rgba(80,100,255,0.25)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: 1 }}>{label}</div>
                    <div style={{ fontSize: '0.55rem', letterSpacing: 2, marginTop: 3, opacity: 0.7 }}>{sub}</div>
                    <div style={{ fontSize: '0.5rem', letterSpacing: 1, marginTop: 2, opacity: 0.45 }}>tiles</div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => startGame(tileCount)}
                style={{
                  marginTop: 6,
                  padding: '12px 48px',
                  background: 'linear-gradient(180deg, rgba(60,80,230,0.6), rgba(30,40,180,0.6))',
                  border: '1px solid rgba(120,150,255,0.5)',
                  color: '#c8d8ff',
                  borderRadius: 12, cursor: 'pointer',
                  fontSize: '0.95rem', letterSpacing: 3, fontFamily: "'Cinzel',Georgia,serif",
                  boxShadow: '0 0 30px rgba(70,90,255,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                ▶ Launch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER */}
      {phase === 'gameover' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(2,1,18,0.85)', backdropFilter: 'blur(14px)',
        }}>
          <div style={{
            textAlign: 'center', padding: '52px 72px',
            background: 'linear-gradient(180deg,rgba(14,6,40,0.99),rgba(4,2,18,0.99))',
            border: '1px solid rgba(255,40,40,0.25)', borderRadius: 26,
            boxShadow: '0 0 120px rgba(200,30,30,0.1), 0 0 60px rgba(80,30,200,0.1)',
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>💀</div>
            <div style={{ color: 'rgba(255,80,80,0.9)', fontSize: '2.2rem', fontWeight: 700, letterSpacing: 5 }}>All Fallen</div>
            <div style={{ color: 'rgba(180,190,255,0.45)', fontSize: '1rem', marginTop: 10, letterSpacing: 2 }}>The enemy consumed the sphere</div>
            <div style={{ color: '#ffe066', fontSize: '2rem', fontWeight: 700, marginTop: 18, letterSpacing: 2, textShadow: '0 0 24px #ffcc0088' }}>
              Final Score: {score}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32 }}>
              <button onClick={() => startGame(tileCount)} style={{
                padding: '12px 34px',
                background: 'rgba(60,80,220,0.15)', border: '1px solid rgba(100,130,255,0.25)',
                color: 'rgba(180,200,255,0.8)', borderRadius: 12, cursor: 'pointer',
                fontSize: '0.95rem', letterSpacing: 2, fontFamily: "'Cinzel',Georgia,serif",
              }}>Play Again</button>
              <button onClick={() => { setPhase('idle'); GS.current = null; }} style={{
                padding: '12px 24px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(100,120,255,0.12)',
                color: 'rgba(150,165,220,0.5)', borderRadius: 12, cursor: 'pointer',
                fontSize: '0.85rem', letterSpacing: 2, fontFamily: "'Cinzel',Georgia,serif",
              }}>Change Size</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
