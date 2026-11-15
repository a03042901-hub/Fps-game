/** Player movement: accel/friction, walk, crouch, jump, AABB collision. */
import { resolveAABB } from './map.js';
import { WEAPONS } from './config.js';

const RADIUS = 0.35;
const HEIGHT = 1.7;
const SPEED = 5.4;
const CROUCH_MUL = 0.55;
const WALK_MUL = 0.48;
const ACCEL = 28;
const FRICTION = 14;
const AIR_ACCEL = 8;
const JUMP_V = 6.2;
const GRAVITY = 18;
const SENS = 0.0022;

export function createPlayer(spawn) {
  return {
    x: spawn.x, y: 0, z: spawn.z,
    vx: 0, vy: 0, vz: 0,
    yaw: spawn.yaw, pitch: 0,
    hp: 100, armor: 0,
    crouch: false, grounded: true, walking: false,
    alive: true,
    eye: 1.55,
    stepT: 0,
    team: 1,
    loadout: null,
  };
}

export function resetPlayer(p, spawn, team) {
  p.x = spawn.x; p.y = 0; p.z = spawn.z;
  p.vx = 0; p.vy = 0; p.vz = 0;
  p.yaw = spawn.yaw; p.pitch = 0;
  p.hp = 100; p.alive = true;
  p.crouch = false; p.grounded = true;
  p.team = team;
  p.eye = 1.55;
}

export function applyLook(p, dx, dy) {
  p.yaw -= dx * SENS;
  p.pitch -= dy * SENS;
  if (p.pitch > 1.4) p.pitch = 1.4;
  if (p.pitch < -1.4) p.pitch = -1.4;
}

export function stepPlayer(p, input, dt, collidersIgnored) {
  if (!p.alive) return;
  const m = input.consumeMouse();
  applyLook(p, m.dx, m.dy);

  p.crouch = input.pressed('ControlLeft') || input.pressed('ControlRight') || input.pressed('KeyC');
  p.walking = input.pressed('ShiftLeft') || input.pressed('AltLeft');
  p.eye = p.crouch ? 1.05 : 1.55;

  let ix = 0, iz = 0;
  if (input.pressed('KeyW')) iz -= 1;
  if (input.pressed('KeyS')) iz += 1;
  if (input.pressed('KeyA')) ix -= 1;
  if (input.pressed('KeyD')) ix += 1;
  const len = Math.hypot(ix, iz);
  if (len > 0) { ix /= len; iz /= len; }

  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
  const wishX = ix * cy + iz * sy;
  const wishZ = -ix * sy + iz * cy;

  let speedMul = 1;
  const gun = activeGun(p);
  if (gun) {
    const def = WEAPONS[gun.id];
    if (def) speedMul *= def.walkSpeed;
  }
  if (p.crouch) speedMul *= CROUCH_MUL;
  else if (p.walking) speedMul *= WALK_MUL;
  const maxSp = SPEED * speedMul;
  const accel = p.grounded ? ACCEL : AIR_ACCEL;

  if (len > 0) {
    p.vx += wishX * accel * dt;
    p.vz += wishZ * accel * dt;
  }
  // Clamp horizontal
  const hs = Math.hypot(p.vx, p.vz);
  if (hs > maxSp) {
    const s = maxSp / hs;
    p.vx *= s; p.vz *= s;
  }
  if (p.grounded && len === 0) {
    const f = Math.max(0, 1 - FRICTION * dt);
    p.vx *= f; p.vz *= f;
  }

  if (p.grounded && input.pressed('Space') && !p.crouch) {
    p.vy = JUMP_V;
    p.grounded = false;
  }

  p.vy -= GRAVITY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;

  const pos = { x: p.x, y: p.y, z: p.z };
  const vel = { x: p.vx, y: p.vy, z: p.vz };
  resolveAABB(pos, vel, RADIUS, HEIGHT, p.crouch);
  p.x = pos.x; p.y = pos.y; p.z = pos.z;
  p.vx = vel.x; p.vy = vel.y; p.vz = vel.z;
  p.grounded = p.y <= 0.02 && p.vy <= 0;
  if (p.grounded) p.y = 0;

  const moving = Math.hypot(p.vx, p.vz) > 0.4;
  if (moving && p.grounded) {
    p.stepT += dt * (p.walking || p.crouch ? 2.2 : 3.6);
  }
}

export function activeGun(p) {
  if (!p.loadout) return null;
  return p.loadout.active === 'primary' && p.loadout.primary
    ? p.loadout.primary
    : p.loadout.sidearm;
}

export function eyePos(p, out) {
  out.x = p.x;
  out.y = p.y + p.eye;
  out.z = p.z;
  return out;
}

export function lookDir(p, out) {
  const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
  out.x = -sy * cp;
  out.y = sp;
  out.z = -cy * cp;
  return out;
}

export const PLAYER_RADIUS = RADIUS;
export const PLAYER_HEIGHT = HEIGHT;
