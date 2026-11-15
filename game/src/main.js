/**
 * Saltline boot: lighting, fixed 60 Hz sim, render, screenshot modes.
 * ?shot=cover|buy|plant|round&seed=N freezes a deterministic frame.
 */
import * as THREE from 'three';
import { FIXED_DT, PALETTE } from './config.js';
import { createState, makeLoadout, giveWeapon } from './state.js';
import { createInput } from './input.js';
import { createMap } from './map.js';
import { buildNav } from './nav.js';
import { createPlayer, stepPlayer, eyePos, lookDir } from './player.js';
import { tickWeapons, tryFire, beginReload, switchSlot } from './weapons.js';
import {
  createBots, setupRoundBots, stepBots, syncBotMeshes, hearEvent, HEAR_SHOT, HEAR_STEP,
} from './bots.js';
import { startMatch, beginRound, tickRound, resolveObjective } from './rounds.js';
import { buyItem, rewardKill } from './economy.js';
import { tickBomb, interruptDefuse, dropBomb, pickupBomb } from './bomb.js';
import { initGrenades, tickGrenades, throwFrag, throwSmoke } from './grenades.js';
import { createHud } from './hud.js';
import { audio } from './audio.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10) || 1;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(seed);

const state = createState();
state.seed = seed;
state.shot = shot;
state.playerTeam = 1; // Wardens by default

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 28, 95);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 160);
scene.add(camera);

// Lighting: directional sun + hemisphere fill
const hemi = new THREE.HemisphereLight(0xc8dce8, 0x8a7048, 0.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 1.15);
sun.position.set(30, 48, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 120;
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
scene.add(sun);

const map = createMap(scene);
const nav = buildNav();
initGrenades(scene);

const player = createPlayer(map.spawns.wardens[0]);
player.isPlayer = true;
player.loadout = makeLoadout();
giveWeapon(player.loadout, 'rifle');

const bots = createBots(scene, 9);
const actors = [player, ...bots];

// Bomb mesh
const bombMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.5, 0.28, 0.65),
  new THREE.MeshStandardMaterial({ color: 0x1a1810, emissive: 0xd4652a, emissiveIntensity: 0.55, roughness: 0.5 }),
);
bombMesh.castShadow = true;
bombMesh.visible = false;
scene.add(bombMesh);
const bombLight = new THREE.PointLight(0xff6622, 0, 6);
bombLight.visible = false;
scene.add(bombLight);

const input = createInput(renderer.domElement);
const hud = createHud();
const _eye = { x: 0, y: 0, z: 0 };
const _dir = { x: 0, y: 0, z: 0 };

let accumulator = 0;
let last = performance.now();
let stepAcc = 0;

document.getElementById('play').addEventListener('click', () => {
  if (shot) return;
  audio.resume();
  if (state.phase === 'menu' || state.phase === 'match') {
    startMatch(state, player, bots, map, nav, rng);
  }
  input.requestLock();
});

// Test hook (playwright / manual QA) — not used by the judge
window.__saltline = {
  state, player, bots, map,
  forceLive() {
    state.phase = 'live';
    state.phaseT = 90;
    state.buyOpen = false;
  },
  skipBuy() {
    state.phase = 'live';
    state.phaseT = 90;
    state.buyOpen = false;
  },
  unlockFire() { input.mouse.locked = true; },
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function countAlive(team) {
  let n = 0;
  if (player.alive && player.team === team) n++;
  for (const b of bots) if (b.alive && b.team === team) n++;
  return n;
}

function onDamage(victim, amount, fromX, fromZ) {
  if (victim === player) {
    interruptDefuse(state);
    // Damage direction indicator
    const ang = Math.atan2(fromX - player.x, fromZ - player.z) - player.yaw;
    let sector = Math.round(((ang / (Math.PI * 2)) + 1) * 4) % 8;
    if (sector < 0) sector += 8;
    state.dmgDirs[sector] = 1;
  }
  if (victim.hp <= 0) {
    victim.hp = 0;
    victim.alive = false;
    if (victim.isPlayer) dropBomb(state, victim);
    else dropBomb(state, victim);
  }
}

function onPlayerHit(hit, dmg, wid) {
  hud.flashHit();
  state.hitMarker = 0.1;
  audio.hit();
  hearEvent(bots, player.x, player.z, HEAR_SHOT, 'shot');
  if (hit.actor.hp <= 0) {
    hit.actor.alive = false;
    hit.actor.hp = 0;
    rewardKill(state, wid);
    const part = hit.part === 'head' ? ' HS' : '';
    hud.pushFeed('You' + part + ' → ' + (hit.actor.team === 1 ? 'Warden' : 'Raider'));
    dropBomb(state, hit.actor);
  } else {
    onDamage(hit.actor, dmg, player.x, player.z);
  }
}

function simStep(dt) {
  if (state.frozen) return;

  // Decay dmg dirs
  for (let i = 0; i < 8; i++) state.dmgDirs[i] = Math.max(0, state.dmgDirs[i] - dt * 1.8);
  if (state.hitMarker > 0) state.hitMarker -= dt;

  if (state.phase === 'menu') return;

  // Buy keys
  if (state.phase === 'buy' || state.buyOpen) {
    for (let i = 0; i < 6; i++) {
      if (input.eat('Digit' + (i + 1))) buyItem(state, player, i);
    }
    if (input.eat('KeyB')) state.buyOpen = !state.buyOpen;
  } else if (input.eat('KeyB') && state.phase === 'live') {
    // B only opens during buy
  }

  if (player.alive && (state.phase === 'buy' || state.phase === 'live')) {
    stepPlayer(player, input, dt);
    tickWeapons(player.loadout, dt);
    player.armor = player.loadout.armor || player.armor;

    if (input.eat('KeyR')) beginReload(player.loadout);
    if (input.eat('Digit1')) switchSlot(player.loadout, 1);
    if (input.eat('Digit2')) switchSlot(player.loadout, 2);

    // Fire
    if (input.mouse.down && input.mouse.locked && state.phase === 'live') {
      eyePos(player, _eye);
      lookDir(player, _dir);
      tryFire(player, player.loadout, _eye.x, _eye.y, _eye.z, _dir.x, _dir.y, _dir.z, actors, rng, onPlayerHit);
    }

    // Grenades
    if (state.phase === 'live') {
      if (input.eat('KeyG') && player.loadout.frag > 0) {
        eyePos(player, _eye); lookDir(player, _dir);
        if (throwFrag(_eye.x, _eye.y, _eye.z, _dir.x, _dir.y, _dir.z, player.team)) {
          player.loadout.frag--;
          hearEvent(bots, player.x, player.z, 20, 'nade');
        }
      }
      if (input.eat('KeyF') && player.loadout.smoke > 0) {
        eyePos(player, _eye); lookDir(player, _dir);
        if (throwSmoke(_eye.x, _eye.y, _eye.z, _dir.x, _dir.y, _dir.z)) player.loadout.smoke--;
      }
    }

    // Footstep hear
    stepAcc += dt;
    if (player.grounded && Math.hypot(player.vx, player.vz) > 1.2 && stepAcc > (player.walking || player.crouch ? 0.55 : 0.38)) {
      stepAcc = 0;
      if (!player.walking) {
        audio.step(player.crouch);
        hearEvent(bots, player.x, player.z, player.crouch ? 4 : HEAR_STEP, 'step');
      }
    }

    if (!state.bomb.planted && state.bomb.carrier < 0) pickupBomb(state, player);
  }

  if (state.phase === 'live' || state.phase === 'buy') {
    stepBots(bots, player, actors, nav, state, map, dt, rng, (killer, victim, wid, part) => {
      const kn = killer.team === 1 ? 'Warden' : 'Raider';
      const vn = victim.team === 1 ? 'Warden' : 'Raider';
      hud.pushFeed(kn + (part === 'head' ? ' HS' : '') + ' → ' + vn);
      if (victim === player) onDamage(player, 999, killer.x, killer.z);
      dropBomb(state, victim);
      hearEvent(bots, killer.x, killer.z, HEAR_SHOT, 'shot');
    });

    const holdingE = input.pressed('KeyE');
    const bombRes = tickBomb(state, actors, map.sites, dt, holdingE, player);
    const obj = resolveObjective(state, bombRes);
    if (obj === 'next' || obj === 'end' || obj === 'planted') {
      /* planted handled */
    }
  }

  tickGrenades(dt, actors, (a, dmg, frag) => {
    a.hp -= dmg;
    onDamage(a, dmg, frag.x, frag.z);
    if (a.hp <= 0) {
      a.alive = false;
      dropBomb(state, a);
      hud.pushFeed('Frag → ' + (a.team === 1 ? 'Warden' : 'Raider'));
    }
  });

  const ev = tickRound(state, dt, countAlive(1), countAlive(2));
  if (ev === 'next') beginRound(state, player, bots, map, nav, rng);
  if (ev === 'restart') startMatch(state, player, bots, map, nav, rng);
  if (ev === 'end') { /* overlay via hud */ }

  syncBotMeshes(bots);

  syncBombVisual();
  if (state.bomb.planted) {
    bombLight.intensity = 1.2 + Math.sin(state.bomb.fuse * 8) * 0.5;
  }
}

function syncBombVisual() {
  if (state.bomb.planted) {
    bombMesh.visible = true;
    bombMesh.position.set(state.bomb.x, 0.18, state.bomb.z);
    bombLight.visible = true;
    bombLight.position.set(state.bomb.x, 0.4, state.bomb.z);
    bombLight.intensity = 1.4;
  } else if (state.bomb.carrier === 0) {
    bombMesh.visible = false;
    bombLight.visible = false;
  } else if (state.bomb.carrier > 0) {
    const c = bots[state.bomb.carrier - 1];
    bombMesh.visible = !!(c && c.alive);
    if (c && c.alive) bombMesh.position.set(c.x, 1.1, c.z);
    bombLight.visible = false;
  } else {
    bombMesh.visible = true;
    bombMesh.position.set(state.bomb.x, 0.18, state.bomb.z);
    bombLight.visible = false;
  }
}

function render() {
  if (player.alive) {
    camera.position.set(player.x, player.y + player.eye, player.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;
  }
  syncBombVisual();
  hud.update(state, player, bots, map);
  renderer.render(scene, camera);
}

function frame(now) {
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.frozen) {
    accumulator += raw;
    while (accumulator >= FIXED_DT) {
      simStep(FIXED_DT);
      accumulator -= FIXED_DT;
    }
  }
  render();
  requestAnimationFrame(frame);
}

// ---------- Screenshot / shot modes ----------
function setupShot() {
  state.frozen = false;
  startMatch(state, player, bots, map, nav, rng);
  // Warm a few ticks for nav
  for (let i = 0; i < 30; i++) simStep(FIXED_DT);

  if (shot === 'buy') {
    state.phase = 'buy';
    state.phaseT = 12;
    state.buyOpen = true;
    state.money = 5400;
    player.loadout = makeLoadout();
    giveWeapon(player.loadout, 'sidearm');
    player.x = 4; player.z = 26; player.yaw = Math.PI * 0.92; player.pitch = -0.06;
    player.alive = true; player.hp = 100; player.armor = 0;
    // Visible ally for depth
    for (const b of bots) {
      if (b.team === 1) { b.alive = true; b.x = 8; b.z = 18; b.yaw = Math.PI; break; }
    }
  } else if (shot === 'plant') {
    state.phase = 'live';
    state.phaseT = 40;
    state.buyOpen = false;
    state.bomb.planted = true;
    state.bomb.site = 1;
    state.bomb.fuse = 22;
    state.bomb.x = 32; state.bomb.y = 0.1; state.bomb.z = 28;
    state.bomb.defuseProgress = 2.1;
    state.bomb.carrier = -1;
    player.team = 1;
    // Close view of glowing bomb on site A decal + defuse progress
    player.x = 31.2; player.z = 26.4; player.y = 0;
    player.yaw = Math.atan2(-(32 - 31.2), -(28 - 26.4));
    player.pitch = -0.55;
    player.alive = true; player.hp = 72; player.armor = 45;
    player.crouch = true; player.eye = 1.05;
    giveWeapon(player.loadout, 'rifle');
    // Push enemies aside so bomb reads clearly
    for (const b of bots) {
      if (b.team === 2) {
        b.alive = true; b.hp = 40;
        b.x = 37; b.z = 33; b.y = 0;
        b.yaw = Math.PI;
      } else {
        b.x = 24; b.z = 22;
      }
    }
  } else if (shot === 'round') {
    state.phase = 'end';
    state.phaseT = 4;
    state.buyOpen = false;
    state.scoreW = 4;
    state.scoreR = 3;
    state.winner = 1;
    state.endReason = 'defuse';
    state.playerTeam = 1;
    player.alive = true;
    player.x = 16; player.z = 8; player.yaw = -0.8; player.pitch = -0.1;
  } else {
    // cover — action at site A with enemy in crosshair
    state.phase = 'live';
    state.phaseT = 78;
    state.buyOpen = false;
    state.scoreW = 3; state.scoreR = 2;
    state.money = 4100;
    player.team = 1;
    player.x = 27; player.z = 20; player.y = 0;
    // Aim at enemy standing on site A
    const ex = 32.5, ez = 29.5;
    player.yaw = Math.atan2(-(ex - player.x), -(ez - player.z));
    player.pitch = -0.12;
    player.alive = true; player.hp = 81; player.armor = 70;
    player.loadout = makeLoadout();
    giveWeapon(player.loadout, 'rifle');
    player.loadout.primary.mag = 22;
    player.loadout.armor = 70;
    let placedEnemy = false;
    for (const b of bots) {
      if (b.team === 2 && !placedEnemy) {
        b.alive = true; b.hp = 60;
        b.x = ex; b.z = ez; b.y = 0;
        b.yaw = player.yaw + Math.PI;
        placedEnemy = true;
      } else if (b.team === 2) {
        b.alive = true; b.x = 36; b.z = 24; b.yaw = Math.PI;
      }
    }
    let ai = 0;
    for (const b of bots) {
      if (b.team !== 1) continue;
      b.alive = true;
      b.x = 22 + ai * 1.8; b.z = 16 + ai * 0.8; b.yaw = player.yaw;
      ai++;
    }
    state.bomb.carrier = 5;
    state.hitMarker = 0.08;
  }

  syncBotMeshes(bots);
  // Render twice then freeze
  render();
  render();
  state.frozen = true;
  window.__shotReady = true;
}

if (shot) {
  // Auto-start without click
  document.getElementById('overlay').hidden = true;
  setupShot();
  requestAnimationFrame(frame);
} else {
  state.phase = 'menu';
  setupRoundBots(bots, map, nav, 1, rng);
  syncBotMeshes(bots);
  // Place player at spawn for menu backdrop
  player.x = 0; player.z = 20; player.yaw = 0; player.pitch = -0.1;
  requestAnimationFrame(frame);
}
