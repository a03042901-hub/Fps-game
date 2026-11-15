/** Frag arc with bounce + radius damage; smoke blocks bot vision. */
import * as THREE from 'three';
import { GRENADES } from './config.js';
import { resolveAABB } from './map.js';
import { audio } from './audio.js';

const POOL = 12;
const frags = [];
const smokes = [];

function alloc(pool, make) {
  while (pool.length < POOL) pool.push(make());
}

export function initGrenades(scene) {
  alloc(frags, () => ({
    alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, team: 0, mesh: null,
  }));
  alloc(smokes, () => ({
    alive: false, x: 0, y: 0, z: 0, t: 0, radius: 0, mesh: null,
  }));
  const fragMat = new THREE.MeshStandardMaterial({ color: 0x4a4030, roughness: 0.7 });
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0xd8d4cc, transparent: true, opacity: 0.5, depth: 1, depthWrite: false, roughness: 1,
  });
  for (const f of frags) {
    f.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), fragMat);
    f.mesh.visible = false;
    scene.add(f.mesh);
  }
  for (const s of smokes) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.7 + i * 0.25, 10, 8), smokeMat.clone());
      puff.position.set((i - 1) * 0.5, 0.4 + i * 0.35, (i % 2) * 0.4);
      g.add(puff);
    }
    g.visible = false;
    scene.add(g);
    s.mesh = g;
  }
}

export function throwFrag(ox, oy, oz, dx, dy, dz, team) {
  const f = frags.find((g) => !g.alive);
  if (!f) return false;
  f.alive = true;
  f.x = ox; f.y = oy; f.z = oz;
  const sp = 14;
  f.vx = dx * sp; f.vy = dy * sp + 3; f.vz = dz * sp;
  f.t = 1.7;
  f.team = team;
  f.mesh.visible = true;
  return true;
}

export function throwSmoke(ox, oy, oz, dx, dy, dz) {
  // Instant lob: travel then deploy
  const s = smokes.find((g) => !g.alive);
  if (!s) return false;
  const dist = 12;
  s.alive = true;
  s.x = ox + dx * dist;
  s.y = 0.5;
  s.z = oz + dz * dist;
  // Clamp to map
  if (s.x < -40) s.x = -40;
  if (s.x > 40) s.x = 40;
  if (s.z < -38) s.z = -38;
  if (s.z > 38) s.z = 38;
  s.t = GRENADES.smoke.duration;
  s.radius = GRENADES.smoke.radius;
  s.mesh.scale.setScalar(s.radius * 0.55);
  s.mesh.position.set(s.x, s.y + 0.2, s.z);
  s.mesh.visible = true;
  return true;
}

export function tickGrenades(dt, actors, onFragDamage, onBoom) {
  for (let i = 0; i < frags.length; i++) {
    const f = frags[i];
    if (!f.alive) continue;
    f.vy -= 18 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.z += f.vz * dt;
    const pos = { x: f.x, y: f.y, z: f.z };
    const vel = { x: f.vx, y: f.vy, z: f.vz };
    const beforeY = f.y;
    resolveAABB(pos, vel, 0.12, 0.24, false);
    if (pos.y <= 0.05 || (beforeY > pos.y + 0.01 && vel.y === 0)) {
      // bounce
      f.vy = Math.abs(f.vy) * 0.35;
      f.vx *= 0.55;
      f.vz *= 0.55;
      if (pos.y < 0.05) pos.y = 0.05;
    }
    // wall bounce approx
    if (Math.abs(pos.x - f.x) > 0.01) f.vx *= -0.5;
    if (Math.abs(pos.z - f.z) > 0.01) f.vz *= -0.5;
    f.x = pos.x; f.y = pos.y; f.z = pos.z;
    f.vx = vel.x; f.vy = Math.max(vel.y, f.vy); f.vz = vel.z;
    f.mesh.position.set(f.x, f.y, f.z);
    f.t -= dt;
    if (f.t <= 0) {
      explodeFrag(f, actors, onFragDamage);
      if (onBoom) onBoom(f.x, f.y, f.z);
      f.alive = false;
      f.mesh.visible = false;
    }
  }
  for (let i = 0; i < smokes.length; i++) {
    const s = smokes[i];
    if (!s.alive) continue;
    s.t -= dt;
    const op = Math.min(0.5, s.t * 0.1);
    s.mesh.traverse((c) => { if (c.material) c.material.opacity = op; });
    s.mesh.rotation.y += dt * 0.15;
    if (s.t <= 0) {
      s.alive = false;
      s.mesh.visible = false;
    }
  }
}

function explodeFrag(f, actors, onFragDamage) {
  audio.explode();
  const R = GRENADES.frag.radius;
  const R2 = R * R;
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i];
    if (!a.alive) continue;
    const dx = a.x - f.x, dy = (a.y + 0.9) - f.y, dz = a.z - f.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > R2) continue;
    const d = Math.sqrt(d2);
    const fall = 1 - d / R;
    const dmg = (GRENADES.frag.damage * fall * fall) | 0;
    if (onFragDamage) onFragDamage(a, dmg, f);
  }
}

export function smokeBlocks(x0, z0, x1, z1) {
  for (let i = 0; i < smokes.length; i++) {
    const s = smokes[i];
    if (!s.alive) continue;
    // Segment vs circle
    const r = s.radius * 0.85;
    const r2 = r * r;
    let dx = x1 - x0, dz = z1 - z0;
    const len2 = dx * dx + dz * dz;
    let t = 0;
    if (len2 > 1e-6) {
      t = ((s.x - x0) * dx + (s.z - z0) * dz) / len2;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
    }
    const px = x0 + dx * t - s.x;
    const pz = z0 + dz * t - s.z;
    if (px * px + pz * pz < r2) return true;
  }
  return false;
}

export function clearGrenades() {
  for (const f of frags) { f.alive = false; if (f.mesh) f.mesh.visible = false; }
  for (const s of smokes) { s.alive = false; if (s.mesh) s.mesh.visible = false; }
}
