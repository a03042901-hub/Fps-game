/** Automated playtest: boot, buy, fire, advance phases, catch page errors. */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text()); });

await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle' });
await page.click('#play');
// Pointer lock may fail in headless — drive via evaluate
await page.waitForTimeout(300);

const report = await page.evaluate(async () => {
  const notes = [];
  const st = () => ({
    phase: document.getElementById('phase')?.textContent,
    hp: document.getElementById('hp')?.textContent,
    ammo: document.getElementById('ammo-mag')?.textContent,
    money: document.getElementById('money')?.textContent,
    timer: document.getElementById('timer')?.textContent,
    buy: !document.getElementById('buy')?.hidden,
    score: document.getElementById('scoreboard')?.textContent,
  });
  notes.push({ step: 'after-play', ...st() });

  // Buy rifle (key 2) and armor (4)
  for (const code of ['Digit2', 'Digit4', 'Digit5']) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  }
  await new Promise((r) => setTimeout(r, 200));
  notes.push({ step: 'after-buy', ...st() });

  // Wait buy phase out by fast-forwarding if exposed — else wait a bit
  // Simulate movement keys
  for (let i = 0; i < 40; i++) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
  }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
  notes.push({ step: 'after-walk', ...st() });

  // Fire clicks
  const canvas = document.querySelector('#game canvas');
  for (let i = 0; i < 5; i++) {
    canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
  }
  notes.push({ step: 'after-fire', ...st() });

  // Reload
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyR', bubbles: true }));
  await new Promise((r) => setTimeout(r, 500));
  notes.push({ step: 'after-reload', ...st() });

  return notes;
});

console.log(JSON.stringify(report, null, 2));
if (errs.length) {
  console.error('ERRORS', errs);
  process.exitCode = 1;
} else {
  console.log('no page errors');
}
await browser.close();
