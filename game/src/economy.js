/** Round economy: start money, kill rewards, win/loss, plant bonus, buy. */
import {
  START_MONEY, WIN_REWARD, LOSS_BASE, LOSS_STREAK_BONUS, PLANT_BONUS,
  MAX_MONEY, WEAPONS, GRENADES, ARMOR_COST, ARMOR_HP, BUY_LIST,
} from './config.js';
import { giveWeapon } from './state.js';
import { audio } from './audio.js';

export function startMatchMoney(state) {
  state.money = START_MONEY;
  state.lossStreak = 0;
}

export function rewardKill(state, weaponId) {
  const w = WEAPONS[weaponId];
  state.money = Math.min(MAX_MONEY, state.money + (w ? w.killReward : 300));
}

export function rewardPlant(state) {
  state.money = Math.min(MAX_MONEY, state.money + PLANT_BONUS);
}

export function endRoundPayout(state, playerWon) {
  if (playerWon) {
    state.money = Math.min(MAX_MONEY, state.money + WIN_REWARD);
    state.lossStreak = 0;
  } else {
    const bonus = Math.min(3, state.lossStreak) * LOSS_STREAK_BONUS;
    state.money = Math.min(MAX_MONEY, state.money + LOSS_BASE + bonus);
    state.lossStreak++;
  }
}

export function buyItem(state, player, index) {
  if (state.phase !== 'buy' && !state.buyOpen) return false;
  const item = BUY_LIST[index];
  if (!item) return false;
  const lo = player.loadout;
  if (item.kind === 'weapon') {
    const w = WEAPONS[item.key];
    if (state.money < w.cost) return false;
    state.money -= w.cost;
    giveWeapon(lo, item.key);
    audio.buy();
    return true;
  }
  if (item.kind === 'armor') {
    if (state.money < ARMOR_COST || player.armor >= ARMOR_HP) return false;
    state.money -= ARMOR_COST;
    player.armor = ARMOR_HP;
    lo.armor = ARMOR_HP;
    audio.buy();
    return true;
  }
  if (item.kind === 'grenade') {
    const g = GRENADES[item.key];
    if (state.money < g.cost) return false;
    if (item.key === 'frag' && lo.frag >= g.max) return false;
    if (item.key === 'smoke' && lo.smoke >= g.max) return false;
    state.money -= g.cost;
    if (item.key === 'frag') lo.frag++;
    else lo.smoke++;
    audio.buy();
    return true;
  }
  return false;
}

export function priceLabel(item) {
  if (item.kind === 'weapon') return WEAPONS[item.key].cost;
  if (item.kind === 'armor') return ARMOR_COST;
  return GRENADES[item.key].cost;
}

export function itemName(item) {
  if (item.kind === 'weapon') return WEAPONS[item.key].name;
  if (item.kind === 'armor') return 'Plate Armor';
  return GRENADES[item.key].name;
}
