/** Single mutable game state. All systems read/write here. */
import { START_MONEY, WEAPONS } from './config.js';

export function createState() {
  return {
    phase: 'menu', // menu | buy | live | end | match
    phaseT: 0,
    round: 1,
    scoreW: 0,
    scoreR: 0,
    winner: 0, // 0 none, 1 wardens, 2 raiders
    endReason: '',
    money: START_MONEY,
    lossStreak: 0,
    seed: 1,
    shot: null,
    frozen: false,
    playerTeam: 1, // 1 wardens defend, 2 raiders attack
    bomb: {
      carrier: -1, // -1 none, 0 player, >0 bot index+1
      planted: false,
      site: 0, // 1 A, 2 B
      fuse: 0,
      plantProgress: 0,
      defuseProgress: 0,
      x: 0, y: 0, z: 0,
    },
    feed: [],
    hitMarker: 0,
    dmgDirs: [0, 0, 0, 0, 0, 0, 0, 0],
    buyOpen: false,
    smokeZones: [],
  };
}

export function makeLoadout() {
  return {
    primary: null,
    sidearm: { ...cloneGun(WEAPONS.sidearm) },
    active: 'sidearm',
    armor: 0,
    frag: 0,
    smoke: 0,
    recoilIdx: 0,
    spread: 0,
    fireCd: 0,
    reloading: 0,
  };
}

function cloneGun(w) {
  return { id: w.id, mag: w.mag, reserve: w.reserve, jammed: 0 };
}

export function giveWeapon(loadout, key) {
  const def = WEAPONS[key];
  if (!def) return;
  if (def.slot === 2) {
    loadout.sidearm = { id: key, mag: def.mag, reserve: def.reserve, jammed: 0 };
  } else {
    loadout.primary = { id: key, mag: def.mag, reserve: def.reserve, jammed: 0 };
    loadout.active = 'primary';
  }
}
