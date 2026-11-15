/** Pooled tracers, impact sparks/decals, explosion flash. */
import * as THREE from 'three';

const TRACERS = 24;
const SPARKS = 48;
const DECALS = 32;

export function createEffects(scene) {
  const tracers = [];
  const tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 4);
  tracerGeo.rotateX(Math.PI / 2);
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.85 });
  for (let i = 0; i < TRACERS; i++) {
    const m = new THREE.Mesh(tracerGeo, tracerMat.clone());
    m.visible = false;
    scene.add(m);
    tracers.push({ mesh: m, t: 0, life: 1 });
  }

  const sparks = [];
  const sparkGeo = new THREE.SphereGeometry(0.04, 4, 4);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffaa44 });
  for (let i = 0; i < SPARKS; i++) {
    const m = new THREE.Mesh(sparkGeo, sparkMat);
    m.visible = false;
    scene.add(m);
    sparks.push({ mesh: m, t: 0, vx: 0, vy: 0, vz: 0 });
  }

  const decals = [];
  const decalGeo = new THREE.CircleGeometry(0.12, 6);
  const decalMat = new THREE.MeshBasicMaterial({
    color: 0x2a2018, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide,
  });
  for (let i = 0; i < DECALS; i++) {
    const m = new THREE.Mesh(decalGeo, decalMat.clone());
    m.visible = false;
    scene.add(m);
    decals.push({ mesh: m, t: 0 });
  }
  let di = 0;

  const boomLight = new THREE.PointLight(0xff6622, 0, 18, 2);
  boomLight.visible = false;
  scene.add(boomLight);
  let boomT = 0;

  const flashPlane = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffcc88, transparent: true, opacity: 0, depthWrite: false }),
  );
  flashPlane.visible = false;
  scene.add(flashPlane);

  return {
    tracer(ox, oy, oz, dx, dy, dz, dist) {
      const t = tracers.find((x) => x.t <= 0);
      if (!t) return;
      const len = Math.min(dist, 28);
      t.mesh.visible = true;
      t.mesh.scale.set(1, 1, len);
      t.mesh.position.set(ox + dx * len * 0.5, oy + dy * len * 0.5, oz + dz * len * 0.5);
      t.mesh.lookAt(ox + dx * len, oy + dy * len, oz + dz * len);
      t.t = 0.06;
      t.mesh.material.opacity = 0.9;
    },
    impact(x, y, z, nx, ny, nz) {
      for (let i = 0; i < 5; i++) {
        const s = sparks.find((p) => p.t <= 0);
        if (!s) break;
        s.mesh.visible = true;
        s.mesh.position.set(x, y, z);
        s.vx = (Math.random() - 0.5) * 4 + (nx || 0) * 2;
        s.vy = Math.random() * 3 + 1;
        s.vz = (Math.random() - 0.5) * 4 + (nz || 0) * 2;
        s.t = 0.25 + Math.random() * 0.2;
      }
      const d = decals[di++ % DECALS];
      d.mesh.visible = true;
      d.mesh.position.set(x, y + 0.02, z);
      d.mesh.lookAt(x + (nx || 0), y + (ny || 1), z + (nz || 0));
      d.t = 8;
      d.mesh.material.opacity = 0.65;
    },
    explode(x, y, z) {
      boomLight.position.set(x, y + 0.5, z);
      boomLight.intensity = 8;
      boomLight.visible = true;
      boomT = 0.35;
      flashPlane.position.set(x, y + 0.5, z);
      flashPlane.visible = true;
      flashPlane.material.opacity = 0.7;
      flashPlane.scale.setScalar(1);
      for (let i = 0; i < 14; i++) {
        const s = sparks.find((p) => p.t <= 0);
        if (!s) break;
        s.mesh.visible = true;
        s.mesh.position.set(x, y + 0.3, z);
        const a = Math.random() * 6.28;
        s.vx = Math.cos(a) * (3 + Math.random() * 5);
        s.vy = 2 + Math.random() * 5;
        s.vz = Math.sin(a) * (3 + Math.random() * 5);
        s.t = 0.4 + Math.random() * 0.3;
      }
    },
    update(dt) {
      for (const t of tracers) {
        if (t.t <= 0) { t.mesh.visible = false; continue; }
        t.t -= dt;
        t.mesh.material.opacity = Math.max(0, t.t * 12);
      }
      for (const s of sparks) {
        if (s.t <= 0) { s.mesh.visible = false; continue; }
        s.t -= dt;
        s.vy -= 12 * dt;
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y += s.vy * dt;
        s.mesh.position.z += s.vz * dt;
        s.mesh.scale.setScalar(Math.max(0.1, s.t * 3));
      }
      for (const d of decals) {
        if (d.t <= 0) { d.mesh.visible = false; continue; }
        d.t -= dt;
        if (d.t < 1) d.mesh.material.opacity = d.t * 0.65;
      }
      if (boomT > 0) {
        boomT -= dt;
        boomLight.intensity = boomT * 22;
        flashPlane.material.opacity = boomT * 2;
        flashPlane.scale.setScalar(1 + (0.35 - boomT) * 8);
        if (boomT <= 0) {
          boomLight.visible = false;
          flashPlane.visible = false;
        }
      }
    },
  };
}
