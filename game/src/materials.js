/** Procedural CanvasTexture materials: tiles, concrete, wood, metal, sand. */
import * as THREE from 'three';

function canvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function noise(ctx, size, alpha, warm) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() * 255) | 0;
    d[i] = warm ? n : (n * 0.85) | 0;
    d[i + 1] = warm ? (n * 0.92) | 0 : n;
    d[i + 2] = warm ? (n * 0.75) | 0 : (n * 0.95) | 0;
    d[i + 3] = (alpha * 255) | 0;
  }
  ctx.putImageData(img, 0, 0);
}

let cache = null;

export function getMaterials() {
  if (cache) return cache;

  const sandTex = canvas(128, (ctx, s) => {
    ctx.fillStyle = '#e0c898';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(245,235,210,${0.08 + Math.random() * 0.15})`;
      ctx.beginPath();
      ctx.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 6, 0, 6.28);
      ctx.fill();
    }
    noise(ctx, s, 0.08, true);
  });
  sandTex.repeat.set(18, 16);

  const concreteTex = canvas(128, (ctx, s) => {
    ctx.fillStyle = '#efe8dc';
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 0.1, false);
    ctx.strokeStyle = 'rgba(120,110,95,0.2)';
    ctx.lineWidth = 2;
    for (let i = 0; i < s; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
    }
  });
  concreteTex.repeat.set(1.5, 1.5);

  const woodTex = canvas(64, (ctx, s) => {
    ctx.fillStyle = '#9a7a4a';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      ctx.fillStyle = `rgba(60,40,20,${0.05 + Math.random() * 0.1})`;
      ctx.fillRect(0, y, s, 1);
    }
    ctx.strokeStyle = 'rgba(40,25,10,0.35)';
    ctx.lineWidth = 1;
    for (let x = 0; x < s; x += 16) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
    }
  });
  woodTex.repeat.set(1, 1);

  const metalTex = canvas(64, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#8a8680');
    g.addColorStop(0.5, '#6a6560');
    g.addColorStop(1, '#9a9690');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 0.15, false);
    ctx.fillStyle = 'rgba(200,200,210,0.2)';
    ctx.fillRect(0, 0, s, 4);
  });

  const tileTex = canvas(64, (ctx, s) => {
    ctx.fillStyle = '#e4ddd0';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(42,107,107,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, s - 4, s - 4);
    ctx.fillStyle = 'rgba(42,107,107,0.12)';
    ctx.fillRect(8, 8, s - 16, s - 16);
  });
  tileTex.repeat.set(4, 2);

  const saltTex = canvas(64, (ctx, s) => {
    ctx.fillStyle = '#ebe6dc';
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 0.2, false);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
  });
  saltTex.repeat.set(3, 3);

  cache = {
    sand: new THREE.MeshStandardMaterial({ map: sandTex, color: 0xf2e2c0, roughness: 0.92, metalness: 0.02 }),
    concrete: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.82, metalness: 0.04, color: 0xfff8ee }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.88, metalness: 0.02, color: 0xd4b078 }),
    metal: new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.42, metalness: 0.55, color: 0xc8c2ba }),
    tile: new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.65, metalness: 0.08, color: 0xf5f0e6 }),
    salt: new THREE.MeshStandardMaterial({ map: saltTex, roughness: 0.6, metalness: 0.04, color: 0xfffaf2 }),
    teal: new THREE.MeshStandardMaterial({ color: 0x4a9e9e, roughness: 0.5, metalness: 0.18 }),
    tealDeep: new THREE.MeshStandardMaterial({ color: 0x358080, roughness: 0.48, metalness: 0.22 }),
    crate: new THREE.MeshStandardMaterial({ map: woodTex, color: 0xd4a84a, roughness: 0.85, metalness: 0.02 }),
    rust: new THREE.MeshStandardMaterial({ color: 0xa86a42, roughness: 0.72, metalness: 0.3 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe07030, roughness: 0.55, emissive: 0xd4652a, emissiveIntensity: 0.2 }),
    siteB: new THREE.MeshStandardMaterial({ color: 0x45b090, roughness: 0.55, emissive: 0x3a9a7a, emissiveIntensity: 0.15 }),
    gunDark: new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.4, metalness: 0.65 }),
    gunBody: new THREE.MeshStandardMaterial({ color: 0x6a727c, roughness: 0.45, metalness: 0.5 }),
    gunAccent: new THREE.MeshStandardMaterial({ color: 0xd4b078, roughness: 0.5, metalness: 0.25 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xe0c4a0, roughness: 0.82, metalness: 0.02 }),
    helmet: new THREE.MeshStandardMaterial({ color: 0x5a6a58, roughness: 0.48, metalness: 0.35 }),
    wardenVest: new THREE.MeshStandardMaterial({ color: 0x4a90b0, roughness: 0.6, metalness: 0.12 }),
    raiderVest: new THREE.MeshStandardMaterial({ color: 0xd05040, roughness: 0.6, metalness: 0.12 }),
    pants: new THREE.MeshStandardMaterial({ color: 0x6a6558, roughness: 0.88, metalness: 0.02 }),
  };
  return cache;
}
