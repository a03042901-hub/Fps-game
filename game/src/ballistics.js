/** Hitscan raycast vs capsule hitboxes (head/body/legs), armor, falloff. */
import * as THREE from 'three';
import { WEAPONS } from './config.js';

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _hit = new THREE.Vector3();

/** Capsule segments relative to feet: legs, body, head */
const PARTS = [
  { y0: 0.05, y1: 0.7, r: 0.28, part: 'legs', mul: 0.75 },
  { y0: 0.7, y1: 1.35, r: 0.32, part: 'body', mul: 1 },
  { y0: 1.35, y1: 1.7, r: 0.18, part: 'head', mul: 4 },
];

function distRayCapsule(ox, oy, oz, dx, dy, dz, cx, cy0, cy1, cz, r) {
  // Closest approach between ray and vertical capsule axis
  const ax = cx - ox, az = cz - oz;
  // Project onto horizontal + clamp Y
  const tHoriz = dx * ax + dz * az;
  const denom = dx * dx + dz * dz;
  let t = denom > 1e-8 ? tHoriz / denom : 0;
  if (t < 0) t = 0;
  const py = oy + dy * t;
  let cy = py;
  if (cy < cy0) cy = cy0;
  if (cy > cy1) cy = cy1;
  // Recompute t for 3D point on axis
  const qx = cx - ox, qy = cy - oy, qz = cz - oz;
  const td = dx * qx + dy * qy + dz * qz;
  t = td;
  if (t < 0) t = 0;
  const hx = ox + dx * t - cx;
  const hy = oy + dy * t - cy;
  const hz = oz + dz * t - cz;
  const dist = Math.sqrt(hx * hx + hy * hy + hz * hz);
  return { t, dist, hit: dist <= r };
}

export function hitscan(ox, oy, oz, dx, dy, dz, actors, skipTeam, maxDist) {
  let best = null;
  let bestT = maxDist;
  for (let i = 0; i < actors.length; i++) {
    const a = actors[i];
    if (!a.alive || a.team === skipTeam) continue;
    const crouchScale = a.crouch ? 0.65 : 1;
    for (let p = 0; p < PARTS.length; p++) {
      const part = PARTS[p];
      const y0 = a.y + part.y0 * crouchScale;
      const y1 = a.y + part.y1 * crouchScale;
      const r = part.r * (a.crouch ? 1.05 : 1);
      const res = distRayCapsule(ox, oy, oz, dx, dy, dz, a.x, y0, y1, a.z, r);
      if (!res.hit || res.t < 0 || res.t >= bestT) continue;
      bestT = res.t;
      best = { actor: a, part: part.part, mul: part.mul, t: res.t, index: i };
    }
  }
  if (!best) return null;
  best.x = ox + dx * best.t;
  best.y = oy + dy * best.t;
  best.z = oz + dz * best.t;
  return best;
}

export function computeDamage(weaponId, dist, partMul, targetArmor) {
  const w = WEAPONS[weaponId];
  if (!w) return { dmg: 0, armorDmg: 0 };
  let dmg = w.damage * partMul;
  if (dist > w.falloffStart) {
    const t = Math.min(1, (dist - w.falloffStart) / (w.falloffEnd - w.falloffStart));
    dmg *= 1 - t * 0.55;
  }
  let armorDmg = 0;
  if (targetArmor > 0) {
    const absorbed = dmg * (1 - w.armorPen) * 0.5;
    armorDmg = Math.min(targetArmor, absorbed);
    dmg -= armorDmg * 0.85;
  }
  return { dmg: Math.max(1, dmg | 0), armorDmg: armorDmg | 0 };
}

export function applySpread(dx, dy, dz, spread, rng, out) {
  // Orthonormal basis
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len; dy /= len; dz /= len;
  let bx = 0, by = 1, bz = 0;
  if (Math.abs(dy) > 0.9) { bx = 1; by = 0; }
  // cross b × d
  let rx = by * dz - bz * dy;
  let ry = bz * dx - bx * dz;
  let rz = bx * dy - by * dx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  // up = d × r
  const ux = dy * rz - dz * ry;
  const uy = dz * rx - dx * rz;
  const uz = dx * ry - dy * rx;
  const ang = rng() * Math.PI * 2;
  const rad = rng() * spread;
  const ox = Math.cos(ang) * rad;
  const oy = Math.sin(ang) * rad;
  out.x = dx + rx * ox + ux * oy;
  out.y = dy + ry * ox + uy * oy;
  out.z = dz + rz * ox + uz * oy;
  const ol = Math.hypot(out.x, out.y, out.z) || 1;
  out.x /= ol; out.y /= ol; out.z /= ol;
  return out;
}

export { _o as tmpOrigin, _d as tmpDir, _hit as tmpHit };
