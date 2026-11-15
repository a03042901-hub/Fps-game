/** Round loop: buy 15s → live 1:55 → end 5s → next. First to 7. */
import {
  BUY_TIME, ROUND_TIME, END_TIME, MATCH_WINS, BOMB_FUSE,
} from './config.js';
import { resetPlayer } from './player.js';
import { makeLoadout, giveWeapon } from './state.js';
import { setupRoundBots } from './bots.js';
import { endRoundPayout, startMatchMoney, rewardPlant } from './economy.js';
import { giveBombTo } from './bomb.js';
import { clearGrenades } from './grenades.js';
import { audio } from './audio.js';

export function startMatch(state, player, bots, map, nav, rng) {
  state.scoreW = 0;
  state.scoreR = 0;
  state.round = 1;
  startMatchMoney(state);
  beginRound(state, player, bots, map, nav, rng);
}

export function beginRound(state, player, bots, map, nav, rng) {
  state.phase = 'buy';
  state.phaseT = BUY_TIME;
  state.winner = 0;
  state.endReason = '';
  state.buyOpen = true;
  state.bomb.planted = false;
  state.bomb.fuse = BOMB_FUSE;
  state.bomb.plantProgress = 0;
  state.bomb.defuseProgress = 0;
  state.bomb.carrier = -1;
  state.feed.length = 0;
  clearGrenades();

  const team = state.playerTeam;
  const spawns = team === 1 ? map.spawns.wardens : map.spawns.raiders;
  resetPlayer(player, spawns[0], team);
  if (!player.loadout) player.loadout = makeLoadout();
  // Keep guns between rounds; ensure sidearm
  if (!player.loadout.sidearm) giveWeapon(player.loadout, 'sidearm');
  player.armor = player.loadout.armor || 0;
  player.hp = 100;
  player.alive = true;

  setupRoundBots(bots, map, nav, team, rng);

  // Give bomb to a raider
  if (team === 2) {
    giveBombTo(state, player);
  } else {
    const carriers = bots.filter((b) => b.team === 2 && b.alive);
    if (carriers.length) giveBombTo(state, carriers[(rng() * carriers.length) | 0]);
  }
  // Drop position for pickup visual when carrier is bot
  if (state.bomb.carrier > 0) {
    const c = bots[state.bomb.carrier - 1];
    state.bomb.x = c.x; state.bomb.z = c.z;
  } else {
    state.bomb.x = player.x; state.bomb.z = player.z;
  }
}

export function tickRound(state, dt, aliveW, aliveR) {
  if (state.phase === 'menu' || state.phase === 'match') return null;
  state.phaseT -= dt;
  if (state.phase === 'buy') {
    if (state.phaseT <= 0) {
      state.phase = 'live';
      state.phaseT = ROUND_TIME;
      state.buyOpen = false;
    }
    return null;
  }
  if (state.phase === 'live') {
    if (aliveW <= 0) return finish(state, 2, 'elimination');
    if (aliveR <= 0) return finish(state, 1, 'elimination');
    if (state.phaseT <= 0) {
      // Time expired: defenders win if bomb not planted
      if (!state.bomb.planted) return finish(state, 1, 'time');
      // else fuse continues — extend somehow: keep ticking fuse via bomb, don't end yet
      state.phaseT = 0.05;
    }
    return null;
  }
  if (state.phase === 'end') {
    if (state.phaseT <= 0) {
      if (state.scoreW >= MATCH_WINS || state.scoreR >= MATCH_WINS) {
        state.phase = 'match';
        state.phaseT = 6;
        return 'match';
      }
      state.round++;
      return 'next';
    }
  }
  if (state.phase === 'match' && state.phaseT <= 0) {
    return 'restart';
  }
  return null;
}

function finish(state, winnerTeam, reason) {
  state.phase = 'end';
  state.phaseT = END_TIME;
  state.winner = winnerTeam;
  state.endReason = reason;
  state.buyOpen = false;
  if (winnerTeam === 1) state.scoreW++;
  else state.scoreR++;
  const playerWon = winnerTeam === state.playerTeam;
  endRoundPayout(state, playerWon);
  audio.roundEnd(playerWon);
  return 'end';
}

export function resolveObjective(state, result) {
  if (state.phase !== 'live' && state.phase !== 'buy') return null;
  if (result === 'detonate') return finish(state, 2, 'bomb');
  if (result === 'defuse') return finish(state, 1, 'defuse');
  if (result === 'plant') {
    rewardPlant(state);
    // Attackers planted — round continues on fuse
    return 'planted';
  }
  return null;
}

export function formatTime(t) {
  const s = Math.max(0, Math.ceil(t));
  const m = (s / 60) | 0;
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}
