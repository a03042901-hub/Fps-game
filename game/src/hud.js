/** HUD: health, armor, ammo, money, timer, score, feed, crosshair, bomb, minimap, hit, dmg. */
import { BUY_LIST } from './config.js';
import { itemName, priceLabel } from './economy.js';
import { formatTime } from './rounds.js';
import { currentDef, weaponSpread } from './weapons.js';

export function createHud() {
  const root = document.getElementById('hud');
  return {
    root,
    setCrosshair(spreadPx) {
      const ch = document.getElementById('crosshair');
      const g = Math.min(28, 6 + spreadPx * 400);
      ch.style.setProperty('--gap', g + 'px');
    },
    flashHit() {
      const h = document.getElementById('hitmarker');
      h.classList.add('on');
      clearTimeout(h._t);
      h._t = setTimeout(() => h.classList.remove('on'), 90);
    },
    pushFeed(text) {
      const el = document.getElementById('feed');
      const row = document.createElement('div');
      row.textContent = text;
      el.prepend(row);
      while (el.children.length > 5) el.lastChild.remove();
      setTimeout(() => row.remove(), 4500);
    },
    setDmg(dirs) {
      const ring = document.getElementById('dmg');
      for (let i = 0; i < 8; i++) {
        const seg = ring.children[i];
        if (!seg) continue;
        seg.style.opacity = Math.min(1, dirs[i]).toFixed(2);
      }
    },
    update(state, player, bots, map) {
      const hp = document.getElementById('hp');
      const ar = document.getElementById('armor');
      const ammo = document.getElementById('ammo-mag');
      const res = document.getElementById('ammo-reserve');
      const money = document.getElementById('money');
      const timer = document.getElementById('timer');
      const score = document.getElementById('scoreboard');
      const bomb = document.getElementById('bomb-status');
      const phase = document.getElementById('phase');

      hp.textContent = String(Math.max(0, player.hp | 0));
      ar.textContent = String(Math.max(0, player.armor | 0));
      money.textContent = '$' + state.money;
      score.textContent = 'W ' + state.scoreW + '  :  ' + state.scoreR + ' R';
      phase.textContent = state.phase.toUpperCase() + '  R' + state.round;

      let tShow = state.phaseT;
      if (state.bomb.planted && state.phase === 'live') tShow = state.bomb.fuse;
      timer.textContent = formatTime(tShow);
      timer.classList.toggle('urgent', state.bomb.planted && state.bomb.fuse < 10);

      const lo = player.loadout;
      if (lo) {
        const g = lo.active === 'primary' && lo.primary ? lo.primary : lo.sidearm;
        ammo.textContent = g ? String(g.mag) : '0';
        res.textContent = '/ ' + (g ? g.reserve : 0);
        const def = currentDef(lo);
        document.getElementById('gun-name').textContent = def ? def.name : '';
        const sp = weaponSpread(lo, player);
        this.setCrosshair(sp);
      }

      // Bomb status
      let bs = '';
      if (state.bomb.planted) {
        bs = 'BOMB ' + (state.bomb.site === 1 ? 'A' : 'B') + '  ' + formatTime(state.bomb.fuse);
        if (state.bomb.defuseProgress > 0) bs += '  DEF ' + ((state.bomb.defuseProgress / 5) * 100 | 0) + '%';
      } else if (state.bomb.carrier === 0) {
        bs = 'YOU CARRY BOMB';
        if (state.bomb.plantProgress > 0) bs += '  PLANT ' + ((state.bomb.plantProgress / 3.5) * 100 | 0) + '%';
      } else if (state.bomb.carrier > 0) bs = 'BOMB WITH ALLY';
      bomb.textContent = bs;

      // Buy menu (never during end/match overlays)
      const buy = document.getElementById('buy');
      const showBuy = (state.phase === 'buy' || state.buyOpen) && state.phase !== 'end' && state.phase !== 'match' && state.phase !== 'menu';
      buy.hidden = !showBuy;
      if (showBuy) {
        const list = document.getElementById('buy-list');
        if (!list._built) {
          list.innerHTML = '';
          BUY_LIST.forEach((item, i) => {
            const row = document.createElement('div');
            row.className = 'buy-row';
            row.innerHTML = '<kbd>' + (i + 1) + '</kbd><span>' + itemName(item) + '</span><b>$' + priceLabel(item) + '</b>';
            list.appendChild(row);
          });
          list._built = true;
        }
      }

      // Overlays
      const end = document.getElementById('end-overlay');
      const match = document.getElementById('match-overlay');
      const menu = document.getElementById('overlay');
      menu.hidden = state.phase !== 'menu';
      end.hidden = state.phase !== 'end';
      match.hidden = state.phase !== 'match';
      if (state.phase === 'end') {
        const title = state.winner === state.playerTeam ? 'ROUND WON' : 'ROUND LOST';
        document.getElementById('end-title').textContent = title;
        document.getElementById('end-detail').textContent =
          reasonText(state) + '  ·  Wardens ' + state.scoreW + ' — Raiders ' + state.scoreR;
      }
      if (state.phase === 'match') {
        const pw = state.scoreW >= state.scoreR ? 'WARDENS' : 'RAIDERS';
        document.getElementById('match-title').textContent = pw + ' WIN THE MATCH';
        document.getElementById('match-detail').textContent =
          'Final  ' + state.scoreW + ' — ' + state.scoreR + '  ·  restarting…';
      }

      drawMinimap(state, player, bots, map);
      this.setDmg(state.dmgDirs);
    },
  };
}

function reasonText(state) {
  switch (state.endReason) {
    case 'elimination': return 'Team eliminated';
    case 'bomb': return 'Bomb detonated';
    case 'defuse': return 'Bomb defused';
    case 'time': return 'Time expired';
    default: return state.endReason || '';
  }
}

function drawMinimap(state, player, bots, map) {
  const c = document.getElementById('minimap');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(26,22,18,0.72)';
  ctx.fillRect(0, 0, W, H);
  const scale = 1.35;
  const ox = W / 2, oy = H / 2;
  const tx = (x) => ox + x * scale;
  const ty = (z) => oy + z * scale;
  // Sites
  ctx.fillStyle = 'rgba(212,101,42,0.55)';
  ctx.beginPath(); ctx.arc(tx(map.sites.A.x), ty(map.sites.A.z), map.sites.A.r * scale, 0, 6.28); ctx.fill();
  ctx.fillStyle = 'rgba(58,154,122,0.55)';
  ctx.beginPath(); ctx.arc(tx(map.sites.B.x), ty(map.sites.B.z), map.sites.B.r * scale, 0, 6.28); ctx.fill();
  // Bots
  for (const b of bots) {
    if (!b.alive) continue;
    ctx.fillStyle = b.team === 1 ? '#3a7a9a' : '#b84a3a';
    ctx.fillRect(tx(b.x) - 2, ty(b.z) - 2, 4, 4);
  }
  // Player
  ctx.fillStyle = '#e8e4dc';
  ctx.beginPath();
  ctx.arc(tx(player.x), ty(player.z), 3, 0, 6.28);
  ctx.fill();
  ctx.strokeStyle = '#e8e4dc';
  ctx.beginPath();
  ctx.moveTo(tx(player.x), ty(player.z));
  ctx.lineTo(tx(player.x) - Math.sin(player.yaw) * 8, ty(player.z) - Math.cos(player.yaw) * 8);
  ctx.stroke();
  // Bomb
  if (state.bomb.planted) {
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(tx(state.bomb.x) - 3, ty(state.bomb.z) - 3, 6, 6);
  }
}
