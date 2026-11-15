/** Fire, reload, recoil pattern, spread from movement. */
import { WEAPONS } from './config.js';
import { activeGun } from './player.js';
import { applySpread, hitscan, computeDamage } from './ballistics.js';
import { audio } from './audio.js';

const _dir = { x: 0, y: 0, z: 0 };

export function currentDef(loadout) {
  const g = loadout.active === 'primary' && loadout.primary ? loadout.primary : loadout.sidearm;
  return g ? WEAPONS[g.id] : null;
}

export function switchSlot(loadout, slot) {
  if (slot === 1 && loadout.primary) loadout.active = 'primary';
  if (slot === 2) loadout.active = 'sidearm';
}

export function beginReload(loadout) {
  if (loadout.reloading > 0) return;
  const g = loadout.active === 'primary' && loadout.primary ? loadout.primary : loadout.sidearm;
  if (!g) return;
  const def = WEAPONS[g.id];
  if (g.mag >= def.mag || g.reserve <= 0) return;
  loadout.reloading = def.reload;
  audio.reload();
}

export function tickWeapons(loadout, dt) {
  if (loadout.fireCd > 0) loadout.fireCd -= dt;
  if (loadout.spread > 0.002) loadout.spread *= Math.pow(0.2, dt);
  else loadout.spread = 0;
  if (loadout.reloading > 0) {
    loadout.reloading -= dt;
    if (loadout.reloading <= 0) {
      loadout.reloading = 0;
      finishReload(loadout);
    }
  }
}

function finishReload(loadout) {
  const g = loadout.active === 'primary' && loadout.primary ? loadout.primary : loadout.sidearm;
  if (!g) return;
  const def = WEAPONS[g.id];
  const need = def.mag - g.mag;
  const take = Math.min(need, g.reserve);
  g.mag += take;
  g.reserve -= take;
  loadout.recoilIdx = 0;
}

export function weaponSpread(loadout, mover) {
  const def = currentDef(loadout);
  if (!def) return 0.02;
  let s = def.spread + loadout.spread;
  const moving = Math.hypot(mover.vx, mover.vz) > 0.5;
  if (moving) s += def.moveSpread;
  if (!mover.grounded) s += def.moveSpread * 1.4;
  if (mover.crouch && !moving) s *= 0.55;
  if (mover.walking && moving) s *= 0.75;
  return s;
}

export function tryFire(actor, loadout, lookOx, lookOy, lookOz, ldx, ldy, ldz, actors, rng, onHit) {
  if (!actor.alive || loadout.reloading > 0 || loadout.fireCd > 0) return false;
  const g = loadout.active === 'primary' && loadout.primary ? loadout.primary : loadout.sidearm;
  if (!g || g.mag <= 0) return false;
  const def = WEAPONS[g.id];
  g.mag -= 1;
  loadout.fireCd = 60 / def.rpm;
  const pattern = def.recoil;
  const ri = loadout.recoilIdx % pattern.length;
  loadout.recoilIdx++;
  loadout.spread += Math.abs(pattern[ri]) * 0.6 + 0.004;

  const spread = weaponSpread(loadout, actor);
  applySpread(ldx, ldy, ldz, spread, rng, _dir);
  // Add patterned vertical kick into pitch-ish dir
  _dir.y += pattern[ri];
  const ol = Math.hypot(_dir.x, _dir.y, _dir.z) || 1;
  _dir.x /= ol; _dir.y /= ol; _dir.z /= ol;

  audio.shot(def.id === 'sniper' || def.id === 'rifle');
  const hit = hitscan(lookOx, lookOy, lookOz, _dir.x, _dir.y, _dir.z, actors, actor.team, 120);
  if (!hit) return true;
  const dist = hit.t;
  const mul = hit.part === 'head' ? def.headMul : (hit.part === 'legs' ? 0.75 : 1);
  const { dmg, armorDmg } = computeDamage(g.id, dist, mul, hit.actor.armor || 0);
  hit.actor.armor = Math.max(0, (hit.actor.armor || 0) - armorDmg);
  hit.actor.hp -= dmg;
  if (onHit) onHit(hit, dmg, g.id);
  return true;
}

export function refillSidearm(loadout) {
  const def = WEAPONS.sidearm;
  loadout.sidearm = { id: 'sidearm', mag: def.mag, reserve: def.reserve, jammed: 0 };
}
