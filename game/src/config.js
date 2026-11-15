/** Saltline constants: timing, economy, weapons, palette. */
export const FIXED_DT = 1 / 60;
export const MATCH_WINS = 7;
export const BUY_TIME = 15;
export const ROUND_TIME = 115;
export const END_TIME = 5;
export const BOMB_FUSE = 40;
export const DEFUSE_TIME = 5;
export const PLANT_TIME = 3.5;
export const START_MONEY = 800;
export const WIN_REWARD = 3250;
export const LOSS_BASE = 1400;
export const LOSS_STREAK_BONUS = 500;
export const PLANT_BONUS = 300;
export const MAX_MONEY = 16000;

export const PALETTE = {
  sand: 0xc4a574,
  salt: 0xe8e4dc,
  teal: 0x2a6b6b,
  tealDeep: 0x1a4545,
  orange: 0xd4652a,
  ink: 0x1a1612,
  fog: 0xb8a890,
  sky: 0x8eb4c4,
  warden: 0x3a7a9a,
  raider: 0xb84a3a,
  crate: 0x8b6914,
  metal: 0x6a6560,
  wood: 0x9a7a4a,
  siteA: 0xd4652a,
  siteB: 0x3a9a7a,
};

export const WEAPONS = {
  sidearm: {
    id: 'sidearm', name: 'Reef Pistol', cost: 0, slot: 2,
    damage: 34, headMul: 4, armorPen: 0.7, rpm: 400, mag: 12, reserve: 36,
    reload: 1.8, spread: 0.012, moveSpread: 0.04, recoil: [0.012, -0.004, 0.01, 0.006, -0.008],
    falloffStart: 12, falloffEnd: 40, killReward: 300, walkSpeed: 1,
  },
  smg: {
    id: 'smg', name: 'Salt SMG', cost: 1250, slot: 1,
    damage: 26, headMul: 4, armorPen: 0.55, rpm: 750, mag: 30, reserve: 90,
    reload: 2.2, spread: 0.018, moveSpread: 0.05, recoil: [0.008, 0.01, -0.006, 0.012, -0.004, 0.009],
    falloffStart: 10, falloffEnd: 28, killReward: 300, walkSpeed: 0.95,
  },
  rifle: {
    id: 'rifle', name: 'Harbour Rifle', cost: 2700, slot: 1,
    damage: 30, headMul: 4, armorPen: 0.75, rpm: 600, mag: 30, reserve: 90,
    reload: 2.5, spread: 0.008, moveSpread: 0.055, recoil: [0.014, 0.012, -0.005, 0.016, 0.008, -0.01, 0.011],
    falloffStart: 18, falloffEnd: 55, killReward: 300, walkSpeed: 0.9,
  },
  sniper: {
    id: 'sniper', name: 'Dune Marksman', cost: 4750, slot: 1,
    damage: 80, headMul: 4, armorPen: 0.95, rpm: 50, mag: 5, reserve: 20,
    reload: 3.2, spread: 0.002, moveSpread: 0.12, recoil: [0.04],
    falloffStart: 40, falloffEnd: 120, killReward: 100, walkSpeed: 0.82,
  },
};

export const GRENADES = {
  frag: { id: 'frag', name: 'Frag', cost: 300, max: 1, radius: 5.5, damage: 98 },
  smoke: { id: 'smoke', name: 'Smoke', cost: 300, max: 1, radius: 4.2, duration: 14 },
};

export const ARMOR_COST = 650;
export const ARMOR_HP = 100;

export const BUY_LIST = [
  { kind: 'weapon', key: 'smg' },
  { kind: 'weapon', key: 'rifle' },
  { kind: 'weapon', key: 'sniper' },
  { kind: 'armor' },
  { kind: 'grenade', key: 'frag' },
  { kind: 'grenade', key: 'smoke' },
];
