/** Capture Saltline screenshots with Playwright. Real browser renders only. */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'screenshots');
mkdirSync(OUT, { recursive: true });

const shots = [
  { name: '1-cover.jpg', url: 'http://127.0.0.1:8080/?shot=cover&seed=1' },
  { name: '2-buy.jpg', url: 'http://127.0.0.1:8080/?shot=buy&seed=1' },
  { name: '3-plant.jpg', url: 'http://127.0.0.1:8080/?shot=plant&seed=1' },
  { name: '4-round.jpg', url: 'http://127.0.0.1:8080/?shot=round&seed=1' },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});

page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE', m.text());
});

for (const s of shots) {
  console.log('navigating', s.url);
  await page.goto(s.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
  // Extra frames for GPU settle
  await page.waitForTimeout(400);
  const buf = await page.screenshot({ type: 'jpeg', quality: 82, fullPage: false });
  const path = join(OUT, s.name);
  writeFileSync(path, buf);
  const st = statSync(path);
  console.log('wrote', s.name, st.size, 'bytes');
  if (st.size > 262144) {
    // recompress lower quality
    const buf2 = await page.screenshot({ type: 'jpeg', quality: 65, fullPage: false });
    writeFileSync(path, buf2);
    console.log('recompressed', s.name, statSync(path).size);
  }
}

// Also smoke-test interactive boot (no shot) for console errors
await page.goto('http://127.0.0.1:8080/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(800);
await page.click('#play');
await page.waitForTimeout(1500);
const phase = await page.locator('#phase').textContent();
console.log('after play phase:', phase);
const hp = await page.locator('#hp').textContent();
console.log('hp:', hp);

await browser.close();
console.log('done');
