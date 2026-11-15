/** Saltworks: bright sand/salt walls, teal trim, instanced props, A/B signs, crane. */
import * as THREE from 'three';
import { getMaterials } from './materials.js';
import { PALETTE } from './config.js';

const BOXES = [];

function addCollider(x, y, z, sx, sy, sz) {
  const hx = sx * 0.5, hz = sz * 0.5;
  BOXES.push({ minX: x - hx, maxX: x + hx, minY: y, maxY: y + sy, minZ: z - hz, maxZ: z + hz });
}

function wall(scene, mat, trimMat, x, y, z, sx, sy, sz, collides = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  mesh.position.set(x, y + sy * 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  // Teal trim along top
  const trim = new THREE.Mesh(new THREE.BoxGeometry(sx + 0.05, 0.18, sz + 0.05), trimMat);
  trim.position.set(x, y + sy + 0.05, z);
  trim.castShadow = true;
  scene.add(trim);
  if (collides) addCollider(x, y, z, sx, sy, sz);
  return mesh;
}

function solid(scene, mat, x, y, z, sx, sy, sz, collides = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  mesh.position.set(x, y + sy * 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (collides) addCollider(x, y, z, sx, sy, sz);
  return mesh;
}

function makeInstanced(scene, geo, mat, transforms) {
  const mesh = new THREE.InstancedMesh(geo, mat, transforms.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const e = new THREE.Euler();
  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    p.set(t[0], t[1], t[2]);
    e.set(t[6] || 0, t[7] || 0, t[8] || 0);
    q.setFromEuler(e);
    s.set(t[3], t[4], t[5]);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function signLetter(scene, letter, x, z, colorMat) {
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), getMaterials().metal);
  pole.position.set(x, 1.6, z);
  pole.castShadow = true;
  scene.add(pole);
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.12), colorMat);
  board.position.set(x, 3.0, z);
  board.castShadow = true;
  scene.add(board);
  // Letter as extruded bars
  const ink = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.5 });
  if (letter === 'A') {
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.08), ink);
    a1.position.set(x - 0.25, 3.0, z + 0.1); a1.rotation.z = 0.35; scene.add(a1);
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.08), ink);
    a2.position.set(x + 0.25, 3.0, z + 0.1); a2.rotation.z = -0.35; scene.add(a2);
    const a3 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.08), ink);
    a3.position.set(x, 2.85, z + 0.1); scene.add(a3);
  } else {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.08), ink);
    b1.position.set(x - 0.25, 3.0, z + 0.1); scene.add(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.08), ink);
    b2.position.set(x + 0.05, 3.35, z + 0.1); scene.add(b2);
    const b3 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.08), ink);
    b3.position.set(x + 0.05, 3.0, z + 0.1); scene.add(b3);
    const b4 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.08), ink);
    b4.position.set(x + 0.05, 2.65, z + 0.1); scene.add(b4);
  }
}

export function createMap(scene) {
  BOXES.length = 0;
  const M = getMaterials();

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), M.sand);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Outer walls — flat bright salt (no noisy map) + teal trim
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5ebdc, roughness: 0.9, metalness: 0.02 });
  const H = 4.2;
  wall(scene, wallMat, M.teal, 0, 0, -42, 90, H, 1.4);
  wall(scene, wallMat, M.teal, 0, 0, 42, 90, H, 1.4);
  wall(scene, wallMat, M.teal, -44, 0, 0, 1.4, H, 84);
  wall(scene, wallMat, M.teal, 44, 0, 0, 1.4, H, 84);

  // Mid spine — salt/tile buildings
  wall(scene, M.salt, M.tealDeep, 0, 0, 0, 8, 3.4, 14);
  wall(scene, M.tile, M.teal, 0, 0, -18, 6, 3.0, 8);
  wall(scene, M.tile, M.teal, 0, 0, 18, 6, 3.0, 8);
  solid(scene, M.metal, -10, 0, 0, 2, 2.8, 6);
  solid(scene, M.metal, 10, 0, 0, 2, 2.8, 6);
  solid(scene, M.salt, 0, 2.8, 0, 8.2, 0.4, 2); // lintel

  // Long lane cover
  solid(scene, M.wood, 22, 0, -20, 3, 1.6, 10);
  solid(scene, M.crate, 28, 0, -8, 4, 2.2, 3);
  solid(scene, M.wood, 26, 0, 6, 3, 1.4, 8);
  solid(scene, M.salt, 30, 0, 18, 5, 2.4, 4);
  solid(scene, M.metal, 18, 0, 28, 8, 1.8, 3);
  solid(scene, M.salt, 16, 0, -2, 8, 1.2, 8);
  solid(scene, M.crate, 16, 1.2, -2, 1.5, 1.4, 1.5);

  // Mid crates
  for (const [x, z] of [[-6, -10], [6, -10], [-6, 10], [6, 10]]) {
    solid(scene, M.crate, x, 0, z, 2.2, 1.8, 2.2);
  }

  // Tunnels — lighter salt walls, not ink black
  wall(scene, M.salt, M.tealDeep, -28, 0, -16, 14, 2.6, 1.4);
  wall(scene, M.salt, M.tealDeep, -28, 0, 16, 14, 2.6, 1.4);
  wall(scene, M.concrete, M.teal, -34, 0, 0, 1.4, 2.6, 32);
  solid(scene, M.concrete, -22, 0, -6, 1.4, 2.6, 10);
  solid(scene, M.concrete, -22, 0, 6, 1.4, 2.6, 10);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.35, 32), M.concrete);
  roof.position.set(-28, 2.75, 0);
  roof.castShadow = true;
  scene.add(roof);

  // Sites floors
  const siteA = new THREE.Mesh(
    new THREE.CircleGeometry(5.8, 28),
    new THREE.MeshStandardMaterial({ color: PALETTE.siteA, roughness: 0.75, transparent: true, opacity: 0.62 }),
  );
  siteA.rotation.x = -Math.PI / 2; siteA.position.set(32, 0.04, 28); scene.add(siteA);
  const siteB = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 28),
    new THREE.MeshStandardMaterial({ color: PALETTE.siteB, roughness: 0.75, transparent: true, opacity: 0.62 }),
  );
  siteB.rotation.x = -Math.PI / 2; siteB.position.set(-30, 0.04, 28); scene.add(siteB);

  solid(scene, M.crate, 36, 0, 24, 3, 1.5, 3);
  solid(scene, M.wood, 28, 0, 32, 4, 1.2, 2);
  solid(scene, M.metal, 34, 0, 34, 2, 2.8, 2);
  solid(scene, M.crate, -34, 0, 24, 3, 1.6, 3);
  solid(scene, M.wood, -26, 0, 32, 3, 1.3, 2.5);
  solid(scene, M.salt, -32, 0, 34, 2.2, 2.5, 2.2);

  // Spawn shelters
  wall(scene, M.tile, M.teal, 0, 0, 36, 16, 2.4, 2);
  wall(scene, M.tile, M.tealDeep, 0, 0, -36, 16, 2.4, 2);

  signLetter(scene, 'A', 38.5, 28, M.orange);
  signLetter(scene, 'B', -36.5, 28, M.siteB);

  // Harbour gantry + crane at Long
  solid(scene, M.metal, 30, 0, 8, 0.5, 7, 0.5, false);
  solid(scene, M.metal, 38, 0, 8, 0.5, 7, 0.5, false);
  solid(scene, M.metal, 34, 7, 8, 10, 0.4, 0.6, false);
  solid(scene, M.rust, 34, 7.2, 8, 0.4, 0.4, 6, false); // boom
  solid(scene, M.rust, 34, 5.5, 11, 0.8, 1.2, 0.8, false); // hook block
  // Cable
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 4), M.metal);
  cable.position.set(34, 6.4, 11); scene.add(cable);

  // Ramps
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 6), M.metal);
  ramp.position.set(14, 0.55, -2); ramp.rotation.x = -0.22; ramp.castShadow = true; scene.add(ramp);
  addCollider(14, 0, -2, 4, 1.0, 5);

  // ---- Instanced props ----
  // Crates
  const cratePos = [];
  const crateSpots = [
    [12, -28], [-12, -28], [20, 0], [-16, -20], [8, 22], [-8, 22], [24, -28], [-24, -28],
    [32, 20], [30, 30], [-28, 22], [10, -16], [-10, -16], [22, 12], [-20, 8], [6, 28],
    [-6, 28], [18, -10], [-14, 14], [35, 26], [-33, 30], [4, -22], [-4, -22],
  ];
  for (const [x, z] of crateSpots) {
    cratePos.push([x, 0.9, z, 1.8, 1.8, 1.8, 0, Math.random() * 0.5, 0]);
    addCollider(x, 0, z, 1.8, 1.8, 1.8);
  }
  makeInstanced(scene, new THREE.BoxGeometry(1, 1, 1), M.crate, cratePos);

  // Barrels
  const barrels = [];
  for (const [x, z] of [[24, -16], [25, -15], [14, 14], [-18, -8], [33, 22], [-31, 20], [8, -30], [-8, -30], [20, 24], [-22, 26]]) {
    barrels.push([x, 0.7, z, 0.55, 0.7, 0.55, 0, 0, 0]);
    addCollider(x, 0, z, 0.9, 1.4, 0.9);
  }
  makeInstanced(scene, new THREE.CylinderGeometry(1, 1, 2, 8), M.rust, barrels);

  // Pallets (flat)
  const pallets = [];
  for (const [x, z] of [[26, -24], [16, 8], [-12, 4], [30, 26], [-28, 26], [2, -14]]) {
    pallets.push([x, 0.08, z, 1.6, 0.12, 1.2, 0, 0, 0]);
  }
  makeInstanced(scene, new THREE.BoxGeometry(1, 1, 1), M.wood, pallets);

  // Containers
  solid(scene, M.teal, 36, 0, -30, 5, 2.8, 2.4);
  solid(scene, M.tealDeep, -36, 0, -28, 5, 2.8, 2.4);
  solid(scene, M.orange, 38, 0, 0, 2.4, 2.6, 5);

  // Salt piles (cones)
  const pileMat = M.salt;
  for (const [x, z, r] of [[-26, -24, 1.8], [-30, -10, 1.4], [10, 32, 1.2], [22, 32, 1.5]]) {
    const pile = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.9, 8), pileMat);
    pile.position.set(x, r * 0.4, z); pile.castShadow = true; scene.add(pile);
  }

  // Pipes along tunnels
  const pipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 1, 6);
  pipeGeo.rotateZ(Math.PI / 2);
  const pipes = [];
  for (let z = -14; z <= 14; z += 4) pipes.push([-31, 2.1, z, 3.5, 1, 1, 0, 0, 0]);
  makeInstanced(scene, pipeGeo, M.metal, pipes);

  // Lamps
  for (const [x, z] of [[20, -20], [-20, -20], [32, 28], [-30, 28], [0, 0], [0, -30], [0, 30], [28, 8], [-28, 0]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6), M.metal);
    pole.position.set(x, 1.6, z); scene.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffcc66, emissiveIntensity: 0.8 }),
    );
    lamp.position.set(x, 3.3, z); scene.add(lamp);
    const pl = new THREE.PointLight(0xffe0b0, 0.45, 14, 2);
    pl.position.set(x, 3.2, z); scene.add(pl);
  }

  // Site point lights
  const aLight = new THREE.PointLight(0xff8844, 0.7, 16, 2);
  aLight.position.set(32, 3, 28); scene.add(aLight);
  const bLight = new THREE.PointLight(0x44ccaa, 0.65, 16, 2);
  bLight.position.set(-30, 3, 28); scene.add(bLight);

  // Lane landmark pillars
  solid(scene, M.teal, 24, 0, -32, 1.2, 4.5, 1.2, false); // Long marker
  solid(scene, M.orange, 0, 0, -32, 1.2, 4.5, 1.2, false); // Mid marker
  solid(scene, M.siteB, -24, 0, -32, 1.2, 4.5, 1.2, false); // Tunnels marker

  return {
    colliders: BOXES,
    solids: [],
    sites: { A: { x: 32, z: 28, r: 5.5 }, B: { x: -30, z: 28, r: 5.2 } },
    spawns: {
      wardens: [
        { x: -4, z: 34, yaw: Math.PI }, { x: 0, z: 34, yaw: Math.PI }, { x: 4, z: 34, yaw: Math.PI },
        { x: -8, z: 32, yaw: Math.PI }, { x: 8, z: 32, yaw: Math.PI },
      ],
      raiders: [
        { x: -4, z: -34, yaw: 0 }, { x: 0, z: -34, yaw: 0 }, { x: 4, z: -34, yaw: 0 },
        { x: -8, z: -32, yaw: 0 }, { x: 8, z: -32, yaw: 0 },
      ],
    },
  };
}

export function resolveAABB(pos, vel, radius, height, crouch) {
  const h = crouch ? height * 0.6 : height;
  const r = radius;
  if (pos.y < 0) { pos.y = 0; if (vel.y < 0) vel.y = 0; }
  if (pos.x < -42) pos.x = -42;
  if (pos.x > 42) pos.x = 42;
  if (pos.z < -40) pos.z = -40;
  if (pos.z > 40) pos.z = 40;

  for (let i = 0; i < BOXES.length; i++) {
    const b = BOXES[i];
    if (pos.y + h < b.minY || pos.y > b.maxY) continue;
    const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (pos.y + 0.15 >= b.maxY && vel.y <= 0 && pos.y < b.maxY + 0.35) {
      pos.y = b.maxY; vel.y = 0; continue;
    }
    if (d2 < 1e-8) {
      const left = pos.x - b.minX + r, right = b.maxX + r - pos.x;
      const near = pos.z - b.minZ + r, far = b.maxZ + r - pos.z;
      const m = Math.min(left, right, near, far);
      if (m === left) pos.x = b.minX - r;
      else if (m === right) pos.x = b.maxX + r;
      else if (m === near) pos.z = b.minZ - r;
      else pos.z = b.maxZ + r;
    } else {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      pos.x += dx * push; pos.z += dz * push;
    }
  }
}

export function pointInSite(x, z, sites) {
  for (const [name, s] of [['A', sites.A], ['B', sites.B]]) {
    const dx = x - s.x, dz = z - s.z;
    if (dx * dx + dz * dz <= s.r * s.r) return name === 'A' ? 1 : 2;
  }
  return 0;
}
