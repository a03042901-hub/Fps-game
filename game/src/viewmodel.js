/** First-person weapon viewmodels: body, barrel, mag, sight + sway/recoil/flash/reload. */
import * as THREE from 'three';
import { getMaterials } from './materials.js';
import { WEAPONS } from './config.js';

function box(sx, sy, sz, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.castShadow = false;
  return m;
}

function buildGun(kind, mats) {
  const root = new THREE.Group();
  const dark = mats.gunDark, body = mats.gunBody, acc = mats.gunAccent;
  if (kind === 'sidearm') {
    const frame = box(0.12, 0.18, 0.28, body); frame.position.set(0, -0.02, -0.05); root.add(frame);
    const barrel = box(0.06, 0.06, 0.22, dark); barrel.position.set(0, 0.04, -0.22); root.add(barrel);
    const grip = box(0.1, 0.22, 0.12, dark); grip.position.set(0, -0.16, 0.02); root.add(grip);
    const mag = box(0.08, 0.16, 0.1, acc); mag.position.set(0, -0.14, -0.02); mag.name = 'mag'; root.add(mag);
    const sight = box(0.04, 0.05, 0.04, dark); sight.position.set(0, 0.1, -0.08); root.add(sight);
  } else if (kind === 'smg') {
    const frame = box(0.14, 0.16, 0.4, body); frame.position.set(0, 0, -0.1); root.add(frame);
    const barrel = box(0.05, 0.05, 0.28, dark); barrel.position.set(0, 0.02, -0.38); root.add(barrel);
    const stock = box(0.1, 0.1, 0.18, dark); stock.position.set(0, 0, 0.18); root.add(stock);
    const mag = box(0.08, 0.28, 0.1, acc); mag.position.set(0, -0.2, -0.05); mag.name = 'mag'; root.add(mag);
    const sight = box(0.05, 0.08, 0.12, dark); sight.position.set(0, 0.12, -0.15); root.add(sight);
    const grip = box(0.09, 0.18, 0.1, dark); grip.position.set(0, -0.14, 0.05); root.add(grip);
  } else if (kind === 'sniper') {
    const frame = box(0.14, 0.14, 0.55, body); frame.position.set(0, 0, -0.15); root.add(frame);
    const barrel = box(0.045, 0.045, 0.5, dark); barrel.position.set(0, 0.02, -0.55); root.add(barrel);
    const stock = box(0.12, 0.14, 0.28, dark); stock.position.set(0, -0.02, 0.28); root.add(stock);
    const mag = box(0.1, 0.14, 0.14, acc); mag.position.set(0, -0.12, -0.05); mag.name = 'mag'; root.add(mag);
    const scope = box(0.08, 0.08, 0.28, dark); scope.position.set(0, 0.14, -0.1); root.add(scope);
    const lens = box(0.07, 0.07, 0.02, acc); lens.position.set(0, 0.14, -0.25); root.add(lens);
  } else {
    // rifle default — chunky readable parts
    const frame = box(0.18, 0.2, 0.52, body); frame.position.set(0, 0.02, -0.1); root.add(frame);
    const barrel = box(0.07, 0.07, 0.48, dark); barrel.position.set(0, 0.05, -0.5); root.add(barrel);
    const hand = box(0.14, 0.12, 0.26, dark); hand.position.set(0, -0.02, -0.3); root.add(hand);
    const stock = box(0.14, 0.16, 0.26, dark); stock.position.set(0, 0.02, 0.26); root.add(stock);
    const mag = box(0.11, 0.3, 0.14, acc); mag.position.set(0, -0.22, 0); mag.name = 'mag'; root.add(mag);
    const sight = box(0.05, 0.12, 0.16, dark); sight.position.set(0, 0.18, -0.16); root.add(sight);
    const grip = box(0.11, 0.22, 0.12, dark); grip.position.set(0, -0.18, 0.08); root.add(grip);
  }
  // Tiny tip glow only — NEVER a PlaneGeometry (camera-facing planes freeze as pale rectangles)
  const tipZ = kind === 'sidearm' ? -0.34 : kind === 'sniper' ? -0.82 : kind === 'smg' ? -0.54 : -0.76;
  const flash = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.08),
    new THREE.MeshBasicMaterial({
      color: 0xffcc66, transparent: true, opacity: 0, depthWrite: false, depthTest: true,
    }),
  );
  flash.name = 'flash';
  flash.visible = false;
  flash.position.set(0, kind === 'sidearm' ? 0.04 : 0.05, tipZ);
  root.add(flash);
  return root;
}

export function createViewmodel(camera) {
  const mats = getMaterials();
  const root = new THREE.Group();
  root.position.set(0.32, -0.26, -0.48);
  root.scale.setScalar(1.15);
  camera.add(root);

  const guns = {
    sidearm: buildGun('sidearm', mats),
    smg: buildGun('smg', mats),
    rifle: buildGun('rifle', mats),
    sniper: buildGun('sniper', mats),
  };
  for (const g of Object.values(guns)) {
    g.visible = false;
    root.add(g);
  }
  guns.rifle.visible = true;

  const flashLight = new THREE.PointLight(0xffaa55, 0, 4, 2);
  flashLight.position.set(0.1, -0.05, -0.9);
  camera.add(flashLight);

  const st = {
    swayX: 0, swayY: 0, kick: 0, kickX: 0,
    reloadT: 0, flashT: 0, bob: 0, active: 'rifle',
  };

  return {
    root,
    show(id) {
      for (const [k, g] of Object.entries(guns)) g.visible = k === id;
      st.active = id;
    },
    onFire() {
      st.kick = 0.045;
      st.kickX = (Math.random() - 0.5) * 0.02;
      st.flashT = 0.04;
      flashLight.intensity = 3.2;
    },
    onReload(dur) {
      st.reloadT = dur || 2;
    },
    update(dt, player, loadout, firing) {
      const id = loadout.active === 'primary' && loadout.primary
        ? loadout.primary.id : (loadout.sidearm ? loadout.sidearm.id : 'sidearm');
      if (id !== st.active) this.show(id);

      const moving = Math.hypot(player.vx, player.vz);
      st.bob += dt * (moving > 0.4 ? 10 : 2);
      const targetX = player.yaw * 0; // look-independent
      const wishSwayX = Math.sin(st.bob) * (moving > 0.4 ? 0.012 : 0.004);
      const wishSwayY = Math.cos(st.bob * 0.5) * (moving > 0.4 ? 0.008 : 0.003)
        + (player.crouch ? 0.04 : 0);
      st.swayX += (wishSwayX - st.swayX) * Math.min(1, 8 * dt);
      st.swayY += (wishSwayY - st.swayY) * Math.min(1, 8 * dt);
      st.kick *= Math.pow(0.02, dt);
      st.kickX *= Math.pow(0.05, dt);

      if (st.flashT > 0) {
        st.flashT -= dt;
        flashLight.intensity = Math.max(0, st.flashT * 55);
      } else flashLight.intensity = 0;

      const gun = guns[st.active];
      if (gun) {
        const flash = gun.getObjectByName('flash');
        if (flash) {
          const on = st.flashT > 0;
          flash.visible = on;
          // Keep tip glow small — high opacity on a large plane was the cover artifact
          flash.material.opacity = on ? Math.min(0.85, st.flashT * 22) : 0;
          flash.scale.setScalar(on ? 1.15 : 1);
        }
        const mag = gun.getObjectByName('mag');
        let reloadDrop = 0;
        if (loadout.reloading > 0) {
          const def = WEAPONS[id];
          const tot = def ? def.reload : 2;
          const t = 1 - loadout.reloading / tot;
          reloadDrop = Math.sin(t * Math.PI) * 0.22;
          if (mag) mag.position.y = -0.2 - Math.sin(t * Math.PI) * 0.15;
        } else if (mag) {
          mag.position.y = id === 'sidearm' ? -0.14 : -0.2;
        }
        gun.position.set(st.swayX + st.kickX, st.swayY - st.kick - reloadDrop, st.kick * 2);
        gun.rotation.x = -st.kick * 2.5 - reloadDrop * 0.8;
        gun.rotation.y = st.kickX * 3;
        gun.rotation.z = st.swayX * 2;
      }

      root.position.set(0.28 + st.swayX * 0.5, -0.28 + st.swayY * 0.3 - (player.crouch ? 0.06 : 0), -0.55);
    },
    /** Clear muzzle flash mesh + light (keeps recoil pose). */
    clearFlash() {
      st.flashT = 0;
      flashLight.intensity = 0;
      for (const g of Object.values(guns)) {
        const flash = g.getObjectByName('flash');
        if (flash) { flash.visible = false; flash.material.opacity = 0; }
      }
    },
  };
}
