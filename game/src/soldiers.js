/** Low-poly soldiers: head, torso, arms, legs, helmet, vest, held weapon + walk/death. */
import * as THREE from 'three';
import { getMaterials } from './materials.js';
import { PALETTE } from './config.js';

function part(sx, sy, sz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createSoldierMesh(team) {
  const mats = getMaterials();
  const root = new THREE.Group();
  const vestBase = team === 1 ? mats.wardenVest : mats.raiderVest;
  const vest = vestBase.clone();
  vest.emissive = new THREE.Color(0x000000);
  vest.emissiveIntensity = 0;

  // Feet on ground: legs 0→0.7, hips ~0.95, head ~1.7
  const legL = part(0.16, 0.7, 0.18, mats.pants);
  legL.position.set(-0.14, 0.35, 0);
  legL.name = 'legL';
  root.add(legL);
  const legR = part(0.16, 0.7, 0.18, mats.pants);
  legR.position.set(0.14, 0.35, 0);
  legR.name = 'legR';
  root.add(legR);

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);

  const torso = part(0.44, 0.52, 0.3, vest);
  torso.position.y = 0.18;
  hips.add(torso);

  const head = part(0.24, 0.24, 0.24, mats.skin);
  head.position.y = 0.55;
  hips.add(head);
  const helmet = part(0.28, 0.14, 0.3, mats.helmet);
  helmet.position.y = 0.66;
  hips.add(helmet);

  const sleeve = mats.pants;
  const armL = part(0.14, 0.5, 0.14, sleeve);
  armL.position.set(-0.34, 0.05, 0);
  armL.name = 'armL';
  hips.add(armL);
  const armR = part(0.14, 0.5, 0.14, sleeve);
  armR.position.set(0.34, 0.05, 0);
  armR.name = 'armR';
  hips.add(armR);
  const handL = part(0.11, 0.11, 0.11, mats.skin);
  handL.position.set(-0.34, -0.28, 0); hips.add(handL);
  const handR = part(0.11, 0.11, 0.11, mats.skin);
  handR.position.set(0.34, -0.28, 0); hips.add(handR);

  // Held rifle (right hand)
  const gun = new THREE.Group();
  gun.position.set(0.05, -0.15, -0.35);
  const gBody = part(0.07, 0.09, 0.5, mats.gunBody);
  gun.add(gBody);
  const gBar = part(0.035, 0.035, 0.32, mats.gunDark);
  gBar.position.z = -0.38;
  gun.add(gBar);
  armR.add(gun);

  root.userData = {
    hips, armL, armR, legL, legR, torso, head, vestMat: vest,
    walkPhase: 0, flashT: 0, deathT: 0, dead: false,
    baseVest: vest.color.getHex(),
  };
  return root;
}

export function updateSoldier(mesh, bot, dt) {
  if (!mesh) return;
  const u = mesh.userData;
  if (!bot.alive) {
    if (!u.dead) {
      u.dead = true;
      u.deathT = 0;
    }
    u.deathT = Math.min(1, u.deathT + dt * 2.2);
    const t = u.deathT;
    mesh.rotation.x = -t * 1.35;
    mesh.position.y = bot.y + Math.sin(t * Math.PI) * 0.15 * (1 - t);
    mesh.visible = t < 0.98;
    return;
  }
  u.dead = false;
  mesh.visible = true;
  mesh.position.set(bot.x, bot.y, bot.z);
  mesh.rotation.set(0, bot.yaw, 0);
  mesh.position.y = bot.crouch ? -0.25 : 0;

  const spd = Math.hypot(bot.vx, bot.vz);
  if (spd > 0.3) u.walkPhase += dt * spd * 3.2;
  const swing = Math.sin(u.walkPhase) * Math.min(1, spd / 3) * 0.55;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.7;
  u.armR.rotation.x = swing * 0.5 - 0.4;

  if (u.flashT > 0) {
    u.flashT -= dt;
    u.torso.material = u.torso.material;
    u.torso.material.emissive = u.torso.material.emissive || new THREE.Color(0x000000);
    if (u.torso.material.emissive) {
      u.torso.material.emissive.setHex(u.flashT > 0 ? 0xffffff : 0x000000);
      u.torso.material.emissiveIntensity = u.flashT > 0 ? 0.6 : 0;
    }
  }
}

export function flashSoldier(mesh) {
  if (!mesh || !mesh.userData) return;
  mesh.userData.flashT = 0.12;
  const mat = mesh.userData.torso.material;
  if (mat.emissive) {
    mat.emissive.setHex(0xffeeee);
    mat.emissiveIntensity = 0.7;
  }
}

export function setSoldierTeam(mesh, team) {
  const mats = getMaterials();
  const vest = (team === 1 ? mats.wardenVest : mats.raiderVest).clone();
  vest.emissive = new THREE.Color(0x000000);
  vest.emissiveIntensity = 0;
  mesh.userData.torso.material = vest;
  mesh.userData.baseVest = vest.color.getHex();
}
