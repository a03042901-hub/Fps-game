/** Bomb plant / fuse / defuse. Plant 3.5s hold, fuse 40s, defuse 5s (move/damage interrupt). */
import { PLANT_TIME, DEFUSE_TIME, BOMB_FUSE } from './config.js';
import { pointInSite } from './map.js';
import { audio } from './audio.js';

export function canPlant(state, actor, sites) {
  if (state.bomb.planted || state.bomb.carrier !== carrierId(actor)) return false;
  if (actor.team !== 2) return false;
  return pointInSite(actor.x, actor.z, sites) > 0;
}

export function canDefuse(state, actor) {
  if (!state.bomb.planted || actor.team !== 1) return false;
  const dx = actor.x - state.bomb.x;
  const dz = actor.z - state.bomb.z;
  return dx * dx + dz * dz < 1.6 * 1.6;
}

function carrierId(actor) {
  return actor.isPlayer ? 0 : (actor.botIndex + 1);
}

export function tickBomb(state, actors, sites, dt, holdingE, player) {
  const b = state.bomb;
  if (b.planted) {
    b.fuse -= dt;
    // Beep cadence
    const urgent = b.fuse < 10;
    const interval = urgent ? 0.35 : (b.fuse < 20 ? 0.7 : 1.2);
    b._beep = (b._beep || 0) - dt;
    if (b._beep <= 0) {
      b._beep = interval;
      audio.plantBeep(urgent);
    }
    if (b.fuse <= 0) {
      audio.explode();
      return 'detonate';
    }
    // Defuse
    if (player.alive && canDefuse(state, player) && holdingE) {
      const moving = Math.hypot(player.vx, player.vz) > 0.2;
      if (moving) b.defuseProgress = 0;
      else {
        player.vx = 0; player.vz = 0;
        b.defuseProgress += dt;
        if (b.defuseProgress >= DEFUSE_TIME) return 'defuse';
      }
    } else if (!(holdingE && canDefuse(state, player))) {
      // bots may defuse too
      let botDef = false;
      for (let i = 0; i < actors.length; i++) {
        const a = actors[i];
        if (!a.alive || a.isPlayer || a.team !== 1) continue;
        if (canDefuse(state, a) && a.defusing) {
          botDef = true;
          b.defuseProgress += dt * 0.9;
          if (b.defuseProgress >= DEFUSE_TIME) return 'defuse';
          break;
        }
      }
      if (!botDef && !(holdingE && player.alive && canDefuse(state, player))) {
        // decay slowly when interrupted only if damaged recently handled outside
      }
    }
    return null;
  }

  // Planting
  if (player.alive && canPlant(state, player, sites) && holdingE) {
    const moving = Math.hypot(player.vx, player.vz) > 0.2;
    if (moving) b.plantProgress = 0;
    else {
      player.vx = 0; player.vz = 0;
      b.plantProgress += dt;
      if (b.plantProgress >= PLANT_TIME) {
        doPlant(state, player, sites);
        return 'plant';
      }
    }
  } else {
    // Bot plant
    for (let i = 0; i < actors.length; i++) {
      const a = actors[i];
      if (!a.alive || a.isPlayer || a.team !== 2) continue;
      if (b.carrier !== carrierId(a)) continue;
      if (!canPlant(state, a, sites) || !a.planting) continue;
      b.plantProgress += dt;
      if (b.plantProgress >= PLANT_TIME) {
        doPlant(state, a, sites);
        return 'plant';
      }
    }
    if (!holdingE) b.plantProgress = Math.max(0, b.plantProgress - dt * 2);
  }
  return null;
}

function doPlant(state, actor, sites) {
  const site = pointInSite(actor.x, actor.z, sites);
  state.bomb.planted = true;
  state.bomb.site = site;
  state.bomb.fuse = BOMB_FUSE;
  state.bomb.x = actor.x;
  state.bomb.y = 0.1;
  state.bomb.z = actor.z;
  state.bomb.carrier = -1;
  state.bomb.plantProgress = 0;
  state.bomb.defuseProgress = 0;
  state.bomb._beep = 0;
  actor.planting = false;
}

export function interruptDefuse(state) {
  state.bomb.defuseProgress = 0;
}

export function dropBomb(state, actor) {
  if (state.bomb.carrier !== carrierId(actor)) return;
  state.bomb.carrier = -1;
  state.bomb.x = actor.x;
  state.bomb.z = actor.z;
}

export function pickupBomb(state, actor) {
  if (state.bomb.planted || state.bomb.carrier >= 0) return false;
  if (actor.team !== 2) return false;
  const dx = actor.x - state.bomb.x, dz = actor.z - state.bomb.z;
  if (dx * dx + dz * dz > 2.2 * 2.2) return false;
  state.bomb.carrier = carrierId(actor);
  return true;
}

export function giveBombTo(state, actor) {
  state.bomb.carrier = carrierId(actor);
  state.bomb.planted = false;
}
