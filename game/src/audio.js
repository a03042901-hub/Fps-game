/** WebAudio-synthesized shots, steps, plant beeps — no files. */
let ctx = null;
let master = null;

function ensure() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
}

function beep(freq, dur, type, vol, slide) {
  ensure();
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  ensure();
  if (!ctx) return;
  const n = Math.max(1, (ctx.sampleRate * dur) | 0);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq;
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start();
}

export const audio = {
  resume() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
  shot(heavy) { noiseBurst(heavy ? 0.12 : 0.06, heavy ? 0.45 : 0.28, heavy ? 900 : 1800); beep(heavy ? 120 : 220, 0.05, 'sawtooth', 0.15, 60); },
  step(crouch) { noiseBurst(crouch ? 0.04 : 0.03, crouch ? 0.04 : 0.08, 280); },
  reload() { beep(400, 0.06, 'triangle', 0.1); setTimeout(() => beep(280, 0.08, 'triangle', 0.12), 120); },
  hit() { beep(880, 0.04, 'square', 0.1); },
  plantBeep(urgent) { beep(urgent ? 920 : 620, 0.05, 'square', 0.14); },
  explode() { noiseBurst(0.4, 0.5, 180); beep(80, 0.3, 'sawtooth', 0.3, 30); },
  buy() { beep(520, 0.05, 'sine', 0.12); beep(720, 0.06, 'sine', 0.1); },
  roundEnd(win) { beep(win ? 440 : 220, 0.15, 'triangle', 0.18, win ? 660 : 110); },
};
