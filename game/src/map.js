/** Saltworks map: salt-mine harbour, 3 lanes, sites A/B, colliders + styled geometry. */
import * as THREE from 'three';
import { PALETTE } from './config.js';

const BOXES = []; // AABB colliders {minX,maxX,minY,maxY,minZ,maxZ}
const SOLIDS = []; // raycast meshes

function addBox(scene, mats, x, y, z, sx, sy, sz, mat, collides = true, cast = true) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y + sy * 0.5, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (collides) {
    const hx = sx * 0.5, hy = sy, hz = sz * 0.5;
    BOXES.push({ minX: x - hx, maxX: x + hx, minY: y, maxY: y + hy, minZ: z - hz, maxZ: z + hz });
  }
  SOLIDS.push(mesh);
  return mesh;
}

function makeMat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
}

export function createMap(scene) {
  BOXES.length = 0;
  SOLIDS.length = 0;

  const sand = makeMat(PALETTE.sand, 0.95);
  const salt = makeMat(PALETTE.salt, 0.7);
  const teal = makeMat(PALETTE.teal, 0.6);
  const tealDeep = makeMat(PALETTE.tealDeep, 0.55);
  const crate = makeMat(PALETTE.crate, 0.9);
  const metal = makeMat(PALETTE.metal, 0.45);
  const wood = makeMat(PALETTE.wood, 0.88);
  const ink = makeMat(PALETTE.ink, 0.9);

  // Ground planes (non-colliding visual; floor Y=0 collision via player)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), sand);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Outer walls
  const W = 1.2, H = 4.5;
  addBox(scene, null, 0, 0, -42, 90, H, W, tealDeep);
  addBox(scene, null, 0, 0, 42, 90, H, W, tealDeep);
  addBox(scene, null, -44, 0, 0, W, H, 84, tealDeep);
  addBox(scene, null, 44, 0, 0, W, H, 84, tealDeep);

  // Mid spine buildings
  addBox(scene, null, 0, 0, 0, 8, 3.2, 14, salt);
  addBox(scene, null, 0, 0, -18, 6, 2.8, 8, teal);
  addBox(scene, null, 0, 0, 18, 6, 2.8, 8, teal);

  // Long lane (east) cover
  addBox(scene, null, 22, 0, -20, 3, 1.6, 10, wood);
  addBox(scene, null, 28, 0, -8, 4, 2.2, 3, crate);
  addBox(scene, null, 26, 0, 6, 3, 1.4, 8, wood);
  addBox(scene, null, 30, 0, 18, 5, 2.4, 4, salt);
  addBox(scene, null, 18, 0, 28, 8, 1.8, 3, metal);

  // Mid lane crates / doorways
  addBox(scene, null, -6, 0, -10, 2.2, 1.8, 2.2, crate);
  addBox(scene, null, 6, 0, -10, 2.2, 1.8, 2.2, crate);
  addBox(scene, null, -6, 0, 10, 2.2, 1.8, 2.2, crate);
  addBox(scene, null, 6, 0, 10, 2.2, 1.8, 2.2, crate);
  addBox(scene, null, -10, 0, 0, 2, 2.6, 6, metal); // doorway wall left
  addBox(scene, null, 10, 0, 0, 2, 2.6, 6, metal);

  // Tunnels (west) — low ceiling corridor walls
  addBox(scene, null, -28, 0, -16, 14, 2.4, 1.4, ink);
  addBox(scene, null, -28, 0, 16, 14, 2.4, 1.4, ink);
  addBox(scene, null, -34, 0, 0, 1.4, 2.4, 32, ink);
  addBox(scene, null, -22, 0, -6, 1.4, 2.4, 10, tealDeep);
  addBox(scene, null, -22, 0, 6, 1.4, 2.4, 10, tealDeep);
  // Tunnel roof visual
  const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 32), ink);
  roof.position.set(-28, 2.6, 0);
  roof.castShadow = true;
  scene.add(roof);

  // Height: raised platform mid-east
  addBox(scene, null, 16, 0, -2, 8, 1.2, 8, salt);
  addBox(scene, null, 16, 1.2, -2, 1.5, 1.4, 1.5, crate);

  // Site A (east harbour) — orange floor decal + cover
  const siteA = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 24),
    new THREE.MeshStandardMaterial({ color: PALETTE.siteA, roughness: 0.8, transparent: true, opacity: 0.55 }),
  );
  siteA.rotation.x = -Math.PI / 2;
  siteA.position.set(32, 0.03, 28);
  scene.add(siteA);
  addBox(scene, null, 36, 0, 24, 3, 1.5, 3, crate);
  addBox(scene, null, 28, 0, 32, 4, 1.2, 2, wood);
  addBox(scene, null, 34, 0, 34, 2, 2.8, 2, metal);

  // Site B (west salt yard) — teal marker
  const siteB = new THREE.Mesh(
    new THREE.CircleGeometry(5.2, 24),
    new THREE.MeshStandardMaterial({ color: PALETTE.siteB, roughness: 0.8, transparent: true, opacity: 0.55 }),
  );
  siteB.rotation.x = -Math.PI / 2;
  siteB.position.set(-30, 0.03, 28);
  scene.add(siteB);
  addBox(scene, null, -34, 0, 24, 3, 1.6, 3, crate);
  addBox(scene, null, -26, 0, 32, 3, 1.3, 2.5, wood);
  addBox(scene, null, -32, 0, 34, 2.2, 2.5, 2.2, salt);

  // Spawn shelters
  addBox(scene, null, 0, 0, 36, 16, 2.2, 2, teal); // warden spawn north-ish? Wardens defend sites so spawn near sites (north +Z)
  addBox(scene, null, 0, 0, -36, 16, 2.2, 2, tealDeep); // raider spawn south -Z

  // Scattered crates for corners
  const crateSpots = [
    [12, -28], [-12, -28], [20, 0], [-16, -20], [8, 22], [-8, 22], [24, -28], [-24, -28],
  ];
  for (const [cx, cz] of crateSpots) {
    addBox(scene, null, cx, 0, cz, 1.8, 1.6, 1.8, crate);
  }

  // Site marker pillars (tall readable silhouettes)
  addBox(scene, null, 38, 0, 28, 0.7, 5.5, 0.7, makeMat(PALETTE.orange), true, true);
  addBox(scene, null, -36, 0, 28, 0.7, 5.5, 0.7, makeMat(PALETTE.siteB), true, true);
  // Harbour gantry (long lane sightline break)
  addBox(scene, null, 34, 2.4, 8, 10, 0.35, 0.8, metal, false, true);
  addBox(scene, null, 30, 0, 8, 0.6, 2.4, 0.6, metal);
  addBox(scene, null, 38, 0, 8, 0.6, 2.4, 0.6, metal);
  // Mid doorway lintels
  addBox(scene, null, 0, 2.4, 0, 8, 0.5, 1.2, salt, false, true);

  return {
    colliders: BOXES,
    solids: SOLIDS,
    sites: {
      A: { x: 32, z: 28, r: 5.5 },
      B: { x: -30, z: 28, r: 5.2 },
    },
    spawns: {
      wardens: [
        { x: -4, z: 34, yaw: Math.PI },
        { x: 0, z: 34, yaw: Math.PI },
        { x: 4, z: 34, yaw: Math.PI },
        { x: -8, z: 32, yaw: Math.PI },
        { x: 8, z: 32, yaw: Math.PI },
      ],
      raiders: [
        { x: -4, z: -34, yaw: 0 },
        { x: 0, z: -34, yaw: 0 },
        { x: 4, z: -34, yaw: 0 },
        { x: -8, z: -32, yaw: 0 },
        { x: 8, z: -32, yaw: 0 },
      ],
    },
  };
}

export function resolveAABB(pos, vel, radius, height, crouch) {
  const h = crouch ? height * 0.6 : height;
  const r = radius;
  // Floor
  if (pos.y < 0) { pos.y = 0; if (vel.y < 0) vel.y = 0; }
  // World bounds soft
  if (pos.x < -42) pos.x = -42;
  if (pos.x > 42) pos.x = 42;
  if (pos.z < -40) pos.z = -40;
  if (pos.z > 40) pos.z = 40;

  for (let i = 0; i < BOXES.length; i++) {
    const b = BOXES[i];
    const minY = 0;
    const maxY = h;
    if (pos.y + maxY < b.minY || pos.y > b.maxY) continue;
    const nx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const nz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    // Standing on top?
    if (pos.y + 0.15 >= b.maxY && vel.y <= 0 && pos.y < b.maxY + 0.35) {
      pos.y = b.maxY;
      vel.y = 0;
      continue;
    }
    if (d2 < 1e-8) {
      // Center inside — push out by nearest face
      const left = pos.x - b.minX + r;
      const right = b.maxX + r - pos.x;
      const near = pos.z - b.minZ + r;
      const far = b.maxZ + r - pos.z;
      const m = Math.min(left, right, near, far);
      if (m === left) pos.x = b.minX - r;
      else if (m === right) pos.x = b.maxX + r;
      else if (m === near) pos.z = b.minZ - r;
      else pos.z = b.maxZ + r;
    } else {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      pos.x += dx * push;
      pos.z += dz * push;
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
