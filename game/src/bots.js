/** Bot AI: nav roles, hold angles, vision cone, hearing, aim error, plant/defuse. */
import { nearestNode, findPath, nodesByTag } from './nav.js';
import { resolveAABB } from './map.js';
import { tryFire, tickWeapons, beginReload } from './weapons.js';
import { makeLoadout, giveWeapon } from './state.js';
import { smokeBlocks } from './grenades.js';
import { canPlant, canDefuse, pickupBomb } from './bomb.js';
import { createSoldierMesh, updateSoldier, setSoldierTeam, flashSoldier } from './soldiers.js';

const SPEED = 4.6;
const VIEW_DIST = 42;
const VIEW_COS = Math.cos((72 * Math.PI) / 180);
const HEAR_SHOT = 38;
const HEAR_STEP = 10;
const REACT = 0.28;

const _dir = { x: 0, y: 0, z: 0 };
const meshes = [];

export function createBots(scene, count) {
  meshes.length = 0;
  const bots = [];
  for (let i = 0; i < count; i++) {
    const root = createSoldierMesh(1);
    scene.add(root);
    meshes.push(root);
    bots.push(makeBot(i));
  }
  return bots;
}

export function getBotMesh(i) { return meshes[i]; }
export function flashBot(i) { flashSoldier(meshes[i]); }

function makeBot(i) {
  return {
    botIndex: i,
    isPlayer: false,
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0,
    hp: 100, armor: 0,
    crouch: false, grounded: true, walking: false, alive: true,
    team: 1,
    role: 'entry', // entry | lurker | anchor
    loadout: makeLoadout(),
    path: [],
    pathI: 0,
    targetNode: -1,
    aimYaw: 0, aimPitch: 0,
    seeT: 0,
    reactT: 0,
    memoryX: 0, memoryZ: 0, memoryT: 0,
    shootAt: null,
    planting: false,
    defusing: false,
    holdYaw: 0,
    rng: null,
  };
}

export function setupRoundBots(bots, map, nav, playerTeam, rng) {
  const wSpawns = map.spawns.wardens;
  const rSpawns = map.spawns.raiders;
  let wi = 0, ri = 0;
  // Skip first spawn slot reserved for the player
  if (playerTeam === 1) wi = 1; else ri = 1;
  const rolesW = ['anchor', 'anchor', 'rotate', 'lurker'];
  const rolesR = ['entry', 'entry', 'lurker', 'entry'];
  let rw = 0, rr = 0;
  // Allies first (4), enemies last (5) → player + 4 vs 5
  for (let i = 0; i < bots.length; i++) {
    const b = bots[i];
    const ally = i < 4;
    b.team = ally ? playerTeam : (playerTeam === 1 ? 2 : 1);
    b.alive = true;
    b.hp = 100;
    b.armor = rng() > 0.4 ? 100 : 0;
    b.path = [];
    b.pathI = 0;
    b.seeT = 0;
    b.reactT = 0;
    b.memoryT = 0;
    b.shootAt = null;
    b.planting = false;
    b.defusing = false;
    b.crouch = false;
    const spawn = b.team === 1 ? wSpawns[wi++ % wSpawns.length] : rSpawns[ri++ % rSpawns.length];
    b.x = spawn.x + (rng() - 0.5) * 0.6;
    b.y = 0; b.z = spawn.z + (rng() - 0.5) * 0.6;
    b.yaw = spawn.yaw; b.aimYaw = spawn.yaw;
    b.vx = 0; b.vy = 0; b.vz = 0;
    if (b.team === 1) b.role = rolesW[rw++ % rolesW.length];
    else b.role = rolesR[rr++ % rolesR.length];
    // Loadouts
    if (rng() > 0.35) giveWeapon(b.loadout, 'rifle');
    else if (rng() > 0.5) giveWeapon(b.loadout, 'smg');
    else giveWeapon(b.loadout, 'sidearm');
    if (b.armor) b.loadout.armor = b.armor;
    setSoldierTeam(meshes[i], b.team);
    meshes[i].userData.dead = false;
    meshes[i].userData.deathT = 0;
    meshes[i].visible = true;
    meshes[i].rotation.x = 0;
  }
}

export function syncBotMeshes(bots, dt) {
  const step = dt || 1 / 60;
  for (let i = 0; i < bots.length; i++) {
    updateSoldier(meshes[i], bots[i], step);
  }
}

export function hearEvent(bots, x, z, radius, kind) {
  for (let i = 0; i < bots.length; i++) {
    const b = bots[i];
    if (!b.alive) continue;
    const dx = b.x - x, dz = b.z - z;
    if (dx * dx + dz * dz > radius * radius) continue;
    b.memoryX = x; b.memoryZ = z; b.memoryT = kind === 'shot' ? 4 : 2.5;
  }
}

function pickGoal(b, nav, state, rng) {
  if (b.team === 2) {
    if (state.bomb.planted) {
      // Retreat / hide near site
      const sites = nodesByTag(nav, state.bomb.site === 1 ? 'siteA' : 'siteB');
      return sites[(rng() * sites.length) | 0] ?? nearestNode(b.x, b.z, nav);
    }
    if (state.bomb.carrier === b.botIndex + 1) {
      const sites = rng() > 0.45 ? nodesByTag(nav, 'siteA') : nodesByTag(nav, 'siteB');
      return sites[0] ?? nearestNode(32, 28, nav);
    }
    if (b.role === 'lurker') {
      const lurk = nodesByTag(nav, 'lurk');
      return lurk[(rng() * lurk.length) | 0] ?? nearestNode(b.x, b.z, nav);
    }
    const entry = nodesByTag(nav, 'entry');
    const mid = nav.nodes.filter((n) => n.lane === 'mid').map((n) => n.i);
    const pool = entry.concat(mid);
    return pool[(rng() * pool.length) | 0] ?? 0;
  }
  // Wardens
  if (state.bomb.planted) {
    return nearestNode(state.bomb.x, state.bomb.z, nav);
  }
  if (b.role === 'anchor') {
    const a = nodesByTag(nav, rng() > 0.5 ? 'siteA' : 'siteB');
    return a[(rng() * a.length) | 0] ?? 0;
  }
  if (b.role === 'rotate') {
    const r = nodesByTag(nav, 'rotate').concat(nodesByTag(nav, 'anchor'));
    return r[(rng() * r.length) | 0] ?? 0;
  }
  const lurk = nodesByTag(nav, 'lurk');
  return lurk[(rng() * lurk.length) | 0] ?? 0;
}

function ensurePath(b, nav, state, rng) {
  if (b.path.length && b.pathI < b.path.length) return;
  const goal = pickGoal(b, nav, state, rng);
  const from = nearestNode(b.x, b.z, nav);
  b.path = findPath(from, goal, nav);
  b.pathI = 0;
  b.holdYaw = Math.atan2(-(nav.nodes[goal].x - b.x), -(nav.nodes[goal].z - b.z));
}

function canSee(b, tx, ty, tz) {
  const dx = tx - b.x, dy = ty - (b.y + 1.4), dz = tz - b.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > VIEW_DIST || dist < 0.2) return false;
  if (smokeBlocks(b.x, b.z, tx, tz)) return false;
  const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw);
  const dot = (fx * dx + fz * dz) / dist;
  if (dot < VIEW_COS && dist > 4) return false;
  return dist;
}

export function stepBots(bots, player, actors, nav, state, map, dt, rng, onBotKill) {
  for (let i = 0; i < bots.length; i++) {
    const b = bots[i];
    if (!b.alive) continue;
    tickWeapons(b.loadout, dt);
    if (b.memoryT > 0) b.memoryT -= dt;
    if (b.reactT > 0) b.reactT -= dt;

    // Low HP retreat
    const retreat = b.hp < 28;
    if (retreat) b.crouch = true;

    // Acquire target
    let target = null;
    let tDist = 0;
    // Check player
    if (player.alive && player.team !== b.team) {
      const d = canSee(b, player.x, player.y + player.eye, player.z);
      if (d) { target = player; tDist = d; }
    }
    for (let j = 0; j < bots.length; j++) {
      if (j === i) continue;
      const o = bots[j];
      if (!o.alive || o.team === b.team) continue;
      const d = canSee(b, o.x, o.y + 1.4, o.z);
      if (d && (!target || d < tDist)) { target = o; tDist = d; }
    }

    b.planting = false;
    b.defusing = false;

    if (target) {
      b.seeT += dt;
      b.memoryX = target.x; b.memoryZ = target.z; b.memoryT = 3;
      const dx = target.x - b.x, dz = target.z - b.z;
      const desiredYaw = Math.atan2(-dx, -dz);
      const desiredPitch = Math.atan2((target.y + 1.2) - (b.y + 1.4), Math.hypot(dx, dz));
      // Aim error
      const err = 0.04 + (1 - Math.min(1, b.seeT / 1.2)) * 0.12;
      b.aimYaw += angleDiff(desiredYaw + (rng() - 0.5) * err, b.aimYaw) * Math.min(1, 6 * dt);
      b.aimPitch += (desiredPitch - b.aimPitch) * Math.min(1, 5 * dt);
      b.yaw = b.aimYaw;
      b.pitch = b.aimPitch;
      if (b.reactT <= 0 && b.seeT > REACT) {
        const ox = b.x, oy = b.y + 1.4, oz = b.z;
        const cp = Math.cos(b.pitch), sp = Math.sin(b.pitch);
        const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
        _dir.x = -sy * cp; _dir.y = sp; _dir.z = -cy * cp;
        tryFire(b, b.loadout, ox, oy, oz, _dir.x, _dir.y, _dir.z, actors, rng, (hit, dmg, wid) => {
          if (!hit) return;
          if (hit.actor.hp <= 0) {
            hit.actor.alive = false;
            hit.actor.hp = 0;
            if (onBotKill) onBotKill(b, hit.actor, wid, hit.part);
          }
        });
        // Reload if empty
        const g = b.loadout.active === 'primary' && b.loadout.primary ? b.loadout.primary : b.loadout.sidearm;
        if (g && g.mag === 0) beginReload(b.loadout);
      }
      // Strafe while shooting
      if (!retreat) {
        const side = (i & 1) ? 1 : -1;
        b.vx += Math.cos(b.yaw) * side * 3 * dt;
        b.vz += -Math.sin(b.yaw) * side * 3 * dt;
      }
    } else {
      b.seeT = 0;
      // Objective / navigate
      if (b.team === 2 && state.bomb.carrier < 0 && !state.bomb.planted) {
        pickupBomb(state, b);
      }
      if (b.team === 2 && state.bomb.carrier === b.botIndex + 1 && canPlant(state, b, map.sites)) {
        b.planting = true;
        b.vx *= 0.1; b.vz *= 0.1;
      } else if (b.team === 1 && state.bomb.planted && canDefuse(state, b)) {
        b.defusing = true;
        b.vx *= 0.1; b.vz *= 0.1;
      } else {
        ensurePath(b, nav, state, rng);
        if (b.memoryT > 0 && !retreat) {
          moveToward(b, b.memoryX, b.memoryZ, dt, SPEED * 0.9);
          b.yaw += angleDiff(Math.atan2(-(b.memoryX - b.x), -(b.memoryZ - b.z)), b.yaw) * Math.min(1, 4 * dt);
        } else if (b.path.length) {
          const node = nav.nodes[b.path[Math.min(b.pathI, b.path.length - 1)]];
          const dx = node.x - b.x, dz = node.z - b.z;
          if (dx * dx + dz * dz < 1.2) {
            b.pathI++;
            if (b.pathI >= b.path.length) {
              b.path = [];
              // Hold angle at destination
              b.yaw += angleDiff(b.holdYaw, b.yaw) * Math.min(1, 3 * dt);
              b.crouch = b.role === 'anchor';
            }
          } else {
            moveToward(b, node.x, node.z, dt, retreat ? SPEED * 1.1 : SPEED);
            b.yaw += angleDiff(Math.atan2(-dx, -dz), b.yaw) * Math.min(1, 5 * dt);
          }
        }
      }
    }

    // Physics
    const hs = Math.hypot(b.vx, b.vz);
    const maxSp = SPEED * (b.crouch ? 0.55 : 1);
    if (hs > maxSp) { b.vx *= maxSp / hs; b.vz *= maxSp / hs; }
    b.vx *= Math.max(0, 1 - 6 * dt);
    b.vz *= Math.max(0, 1 - 6 * dt);
    b.vy -= 18 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    const pos = { x: b.x, y: b.y, z: b.z };
    const vel = { x: b.vx, y: b.vy, z: b.vz };
    resolveAABB(pos, vel, 0.35, 1.7, b.crouch);
    b.x = pos.x; b.y = pos.y; b.z = pos.z;
    b.vx = vel.x; b.vy = vel.y; b.vz = vel.z;
    b.grounded = b.y <= 0.02;
    if (b.grounded) { b.y = 0; b.vy = 0; }
  }
}

function moveToward(b, x, z, dt, speed) {
  const dx = x - b.x, dz = z - b.z;
  const d = Math.hypot(dx, dz) || 1;
  b.vx += (dx / d) * speed * 3 * dt;
  b.vz += (dz / d) * speed * 3 * dt;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export { HEAR_SHOT, HEAR_STEP };
