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
  createBots, setupRoundBots, stepBots, syncBotMeshes, hearEvent, flashBot,
  HEAR_SHOT, HEAR_STEP,
} from './bots.js';
import { startMatch, beginRound, tickRound, resolveObjective } from './rounds.js';
import { buyItem, rewardKill } from './economy.js';
import { tickBomb, interruptDefuse, dropBomb, pickupBomb } from './bomb.js';
import { initGrenades, tickGrenades, throwFrag, throwSmoke } from './grenades.js';
import { createHud } from './hud.js';
import { audio } from './audio.js';
import { createViewmodel } from './viewmodel.js';
import { createEffects } from './effects.js';

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
state.playerTeam = 1;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Sky gradient via large dome
const skyGeo = new THREE.SphereGeometry(140, 16, 12);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    top: { value: new THREE.Color(0x7eb4d4) },
    bot: { value: new THREE.Color(0xd4c4a0) },
  },
  vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h=clamp(vP.y*0.5+0.5,0.0,1.0); gl_FragColor=vec4(mix(bot,top,h),1.0); }',
});
scene.add(new THREE.Mesh(skyGeo, skyMat));
scene.fog = new THREE.Fog(0xd8c8a8, 48, 125);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 160);
scene.add(camera);

const ambient = new THREE.AmbientLight(0xfff0e0, 0.35);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xeef6fc, 0xd0b888, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff8ea, 1.7);
sun.position.set(28, 55, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 130;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.03;
scene.add(sun);
scene.add(sun.target);

const map = createMap(scene);
const nav = buildNav();
initGrenades(scene);
const effects = createEffects(scene);
const viewmodel = createViewmodel(camera);

const player = createPlayer(map.spawns.wardens[0]);
player.isPlayer = true;
player.loadout = makeLoadout();
giveWeapon(player.loadout, 'rifle');

const bots = createBots(scene, 9);
const actors = [player, ...bots];

const bombMesh = new THREE.Group();
const bombBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 0.35, 0.9),
  new THREE.MeshStandardMaterial({ color: 0x2a2818, emissive: 0xff6622, emissiveIntensity: 0.85, roughness: 0.4, metalness: 0.45 }),
);
bombBody.castShadow = true;
bombMesh.add(bombBody);
const bombAnt = new THREE.Mesh(
  new THREE.BoxGeometry(0.06, 0.45, 0.06),
  new THREE.MeshStandardMaterial({ color: 0x888880, emissive: 0xffaa44, emissiveIntensity: 0.4 }),
);
bombAnt.position.y = 0.35;
bombMesh.add(bombAnt);
bombMesh.visible = false;
scene.add(bombMesh);
const bombLight = new THREE.PointLight(0xff7722, 0, 10);
bombLight.visible = false;
scene.add(bombLight);

const input = createInput(renderer.domElement);
const hud = createHud();
const _eye = { x: 0, y: 0, z: 0 };
const _dir = { x: 0, y: 0, z: 0 };

let accumulator = 0;
let last = performance.now();
let stepAcc = 0;
let prevReload = 0;

document.getElementById('play').addEventListener('click', () => {
  if (shot) return;
  audio.resume();
  if (state.phase === 'menu' || state.phase === 'match') {
    startMatch(state, player, bots, map, nav, rng);
  }
  input.requestLock();
});

window.__saltline = {
  state, player, bots, map,
  forceLive() { state.phase = 'live'; state.phaseT = 90; state.buyOpen = false; },
  skipBuy() { state.phase = 'live'; state.phaseT = 90; state.buyOpen = false; },
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
    const ang = Math.atan2(fromX - player.x, fromZ - player.z) - player.yaw;
    let sector = Math.round(((ang / (Math.PI * 2)) + 1) * 4) % 8;
    if (sector < 0) sector += 8;
    state.dmgDirs[sector] = 1;
  } else if (victim.botIndex != null) {
    flashBot(victim.botIndex);
  }
  if (victim.hp <= 0) {
    victim.hp = 0;
    victim.alive = false;
    dropBomb(state, victim);
  }
}

function handleShot(hit, dmg, wid, ray) {
  if (ray) {
    const dist = hit ? hit.t : 40;
    effects.tracer(ray.ox, ray.oy, ray.oz, ray.dx, ray.dy, ray.dz, dist);
    if (hit) {
      effects.impact(hit.x, hit.y, hit.z, -ray.dx, -ray.dy, -ray.dz);
    } else {
      effects.impact(ray.ox + ray.dx * 35, Math.max(0.05, ray.oy + ray.dy * 35), ray.oz + ray.dz * 35, 0, 1, 0);
    }
  }
  viewmodel.onFire();
  if (!hit) return;
  hud.flashHit();
  state.hitMarker = 0.1;
  audio.hit();
  hearEvent(bots, player.x, player.z, HEAR_SHOT, 'shot');
  if (hit.actor.botIndex != null) flashBot(hit.actor.botIndex);
  if (hit.actor.hp <= 0) {
    hit.actor.alive = false;
    hit.actor.hp = 0;
    rewardKill(state, wid);
    hud.pushFeed('You' + (hit.part === 'head' ? ' HS' : '') + ' → ' + (hit.actor.team === 1 ? 'Warden' : 'Raider'));
    dropBomb(state, hit.actor);
  } else {
    onDamage(hit.actor, dmg, player.x, player.z);
  }
}

function simStep(dt) {
  if (state.frozen) return;

  for (let i = 0; i < 8; i++) state.dmgDirs[i] = Math.max(0, state.dmgDirs[i] - dt * 1.8);
  if (state.hitMarker > 0) state.hitMarker -= dt;

  if (state.phase === 'menu') return;

  if (state.phase === 'buy' || state.buyOpen) {
    for (let i = 0; i < 6; i++) {
      if (input.eat('Digit' + (i + 1))) buyItem(state, player, i);
    }
    if (input.eat('KeyB')) state.buyOpen = !state.buyOpen;
  }

  if (player.alive && (state.phase === 'buy' || state.phase === 'live')) {
    stepPlayer(player, input, dt);
    tickWeapons(player.loadout, dt);
    player.armor = player.loadout.armor || player.armor;

    if (input.eat('KeyR')) beginReload(player.loadout);
    if (input.eat('Digit1')) switchSlot(player.loadout, 1);
    if (input.eat('Digit2')) switchSlot(player.loadout, 2);

    if (player.loadout.reloading > 0 && prevReload <= 0) viewmodel.onReload(player.loadout.reloading);
    prevReload = player.loadout.reloading;

    if (input.mouse.down && input.mouse.locked && state.phase === 'live') {
      eyePos(player, _eye);
      lookDir(player, _dir);
      tryFire(player, player.loadout, _eye.x, _eye.y, _eye.z, _dir.x, _dir.y, _dir.z, actors, rng, handleShot);
    }

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

    stepAcc += dt;
    if (player.grounded && Math.hypot(player.vx, player.vz) > 1.2 && stepAcc > (player.walking || player.crouch ? 0.55 : 0.38)) {
      stepAcc = 0;
      if (!player.walking) {
        audio.step(player.crouch);
        hearEvent(bots, player.x, player.z, player.crouch ? 4 : HEAR_STEP, 'step');
      }
    }

    if (!state.bomb.planted && state.bomb.carrier < 0) pickupBomb(state, player);
    viewmodel.update(dt, player, player.loadout, input.mouse.down);
  }

  if (state.phase === 'live' || state.phase === 'buy') {
    stepBots(bots, player, actors, nav, state, map, dt, rng, (killer, victim, wid, part) => {
      hud.pushFeed((killer.team === 1 ? 'Warden' : 'Raider') + (part === 'head' ? ' HS' : '') + ' → ' + (victim.team === 1 ? 'Warden' : 'Raider'));
      if (victim === player) onDamage(player, 999, killer.x, killer.z);
      else if (victim.botIndex != null) flashBot(victim.botIndex);
      dropBomb(state, victim);
      hearEvent(bots, killer.x, killer.z, HEAR_SHOT, 'shot');
    });

    const bombRes = tickBomb(state, actors, map.sites, dt, input.pressed('KeyE'), player);
    resolveObjective(state, bombRes);
  }

  tickGrenades(dt, actors, (a, dmg, frag) => {
    a.hp -= dmg;
    onDamage(a, dmg, frag.x, frag.z);
    if (a.hp <= 0) {
      a.alive = false;
      dropBomb(state, a);
      hud.pushFeed('Frag → ' + (a.team === 1 ? 'Warden' : 'Raider'));
    }
  }, (x, y, z) => effects.explode(x, y, z));

  const ev = tickRound(state, dt, countAlive(1), countAlive(2));
  if (ev === 'next') beginRound(state, player, bots, map, nav, rng);
  if (ev === 'restart') startMatch(state, player, bots, map, nav, rng);

  syncBotMeshes(bots, dt);
  effects.update(dt);
  syncBombVisual();
  if (state.bomb.planted) bombLight.intensity = 1.2 + Math.sin(state.bomb.fuse * 8) * 0.5;
}

function syncBombVisual() {
  if (state.bomb.planted) {
    bombMesh.visible = true;
    bombMesh.position.set(state.bomb.x, 0.22, state.bomb.z);
    bombLight.visible = true;
    bombLight.position.set(state.bomb.x, 0.6, state.bomb.z);
    bombLight.intensity = 2.2;
  } else if (state.bomb.carrier === 0) {
    bombMesh.visible = false;
    bombLight.visible = false;
  } else if (state.bomb.carrier > 0) {
    const c = bots[state.bomb.carrier - 1];
    bombMesh.visible = !!(c && c.alive);
    if (c && c.alive) bombMesh.position.set(c.x, 1.2, c.z);
    bombLight.visible = false;
  } else {
    bombMesh.visible = true;
    bombMesh.position.set(state.bomb.x, 0.22, state.bomb.z);
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

function setupShot() {
  state.frozen = false;
  startMatch(state, player, bots, map, nav, rng);
  for (let i = 0; i < 30; i++) simStep(FIXED_DT);

  if (shot === 'buy') {
    state.phase = 'buy';
    state.phaseT = 14;
    state.buyOpen = true;
    state.money = 800;
    state.scoreW = 0; state.scoreR = 0; state.round = 1;
    player.loadout = makeLoadout();
    giveWeapon(player.loadout, 'sidearm');
    player.x = 2; player.z = 28; player.yaw = Math.PI * 0.85; player.pitch = -0.08;
    player.alive = true; player.hp = 100; player.armor = 0;
    viewmodel.show('sidearm');
    viewmodel.update(0, player, player.loadout, false);
    let ai = 0;
    for (const b of bots) {
      if (b.team === 1) { b.alive = true; b.x = 6 + ai * 2; b.z = 20; b.yaw = Math.PI; ai++; }
    }
  } else if (shot === 'plant') {
    state.phase = 'live';
    state.phaseT = 40;
    state.buyOpen = false;
    state.money = 2700;
    state.bomb.planted = true;
    state.bomb.site = 1;
    state.bomb.fuse = 22;
    state.bomb.x = 32; state.bomb.y = 0.1; state.bomb.z = 28;
    state.bomb.defuseProgress = 1.8;
    state.bomb.carrier = -1;
    player.team = 1;
    player.x = 29.5; player.z = 24.8; player.y = 0;
    player.yaw = Math.atan2(-(32 - 29.5), -(28 - 24.8));
    player.pitch = -0.35;
    player.alive = true; player.hp = 72; player.armor = 45;
    player.crouch = true; player.eye = 1.05;
    giveWeapon(player.loadout, 'rifle');
    viewmodel.show('rifle');
    viewmodel.update(0, player, player.loadout, false);
    let ei = 0, ai = 0;
    for (const b of bots) {
      if (b.team === 2) {
        b.alive = true; b.hp = 55;
        b.x = 34.5 + (ei % 2); b.z = 30.5 - ei * 0.8; b.y = 0;
        b.yaw = Math.PI * 0.9; ei++;
      } else {
        b.alive = true;
        b.x = 26.5 + ai * 1.2; b.z = 23 + ai * 0.4; b.yaw = 0.4; ai++;
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
    state.money = 4850;
    player.alive = true; player.hp = 64; player.armor = 20;
    // Look across mid toward site A / crane — readable end frame
    player.x = 12; player.z = 6; player.yaw = -1.15; player.pitch = -0.04;
    giveWeapon(player.loadout, 'rifle');
    viewmodel.show('rifle');
    viewmodel.update(0, player, player.loadout, false);
    let ai = 0;
    for (const b of bots) {
      if (b.team === 1) {
        b.alive = true; b.hp = 80;
        b.x = 16 + ai * 1.5; b.z = 10 + (ai % 2); b.yaw = -1;
        ai++;
      } else { b.alive = false; }
    }
  } else {
    // cover — open firefight at site A: gun, enemies, props, HUD
    state.phase = 'live';
    state.phaseT = 78;
    state.buyOpen = false;
    state.scoreW = 3; state.scoreR = 2;
    state.money = 4100;
    player.team = 1;
    player.x = 29; player.z = 21; player.y = 0;
    const ex = 32.5, ez = 29.2;
    player.yaw = Math.atan2(-(ex - player.x), -(ez - player.z));
    player.pitch = -0.06;
    player.alive = true; player.hp = 81; player.armor = 70;
    player.loadout = makeLoadout();
    giveWeapon(player.loadout, 'rifle');
    player.loadout.primary.mag = 22;
    player.loadout.armor = 70;
    viewmodel.show('rifle');
    viewmodel.onFire();
    viewmodel.update(0, player, player.loadout, true);
    const enemySpots = [[ex, ez], [35.5, 27], [34, 31]];
    let ei = 0;
    for (const b of bots) {
      if (b.team !== 2) continue;
      b.alive = true; b.hp = 55;
      b.x = enemySpots[ei % 3][0]; b.z = enemySpots[ei % 3][1]; b.y = 0;
      b.yaw = player.yaw + Math.PI; ei++;
    }
    let ai = 0;
    for (const b of bots) {
      if (b.team !== 1) continue;
      b.alive = true;
      b.x = 25 + ai * 1.4; b.z = 18 + (ai % 2); b.yaw = player.yaw;
      ai++;
    }
    state.bomb.carrier = 5;
    state.hitMarker = 0.1;
    hud.flashHit();
    eyePos(player, _eye);
    lookDir(player, _dir);
    effects.tracer(_eye.x, _eye.y, _eye.z, _dir.x, _dir.y, _dir.z, 12);
    effects.impact(ex, 1.15, ez, 0, 1, 0);
    effects.impact(ex + 0.8, 0.95, ez - 0.4, 0, 1, 0);
  }

  syncBotMeshes(bots, 0);
  effects.update(0.016);
  render();
  render();
  state.frozen = true;
  window.__shotReady = true;
}

if (shot) {
  document.getElementById('overlay').hidden = true;
  setupShot();
  requestAnimationFrame(frame);
} else {
  state.phase = 'menu';
  setupRoundBots(bots, map, nav, 1, rng);
  syncBotMeshes(bots, 0);
  player.x = 0; player.z = 18; player.yaw = 0.2; player.pitch = -0.08;
  viewmodel.show('rifle');
  requestAnimationFrame(frame);
}
