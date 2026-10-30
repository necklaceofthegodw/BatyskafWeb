/** Reproducible local smoke/size/render measurements; run dev and production servers first. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.local', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [],
  external = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('request', (r) => {
  if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== '127.0.0.1') external.push(r.url());
});
const started = performance.now();
await page.goto('http://127.0.0.1:8787/');
await page.getByRole('button', { name: /Rozpocznij wyprawę/ }).waitFor({ timeout: 45000 });
const startupMs = Math.round(performance.now() - started);
await page.waitForTimeout(500);
const production = await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2');
  const extension = gl?.getExtension('WEBGL_debug_renderer_info');
  const resources = performance.getEntriesByType('resource');
  return {
    renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable',
    encodedBytes: resources.reduce((sum, r) => sum + r.encodedBodySize, 0),
    requests: resources.length,
    diagnosticsPresent: '__BATYSKAF_TEST__' in window,
  };
});
await page.screenshot({ path: '.local/production-menu.png' });
await page.getByRole('button', { name: /Rozpocznij wyprawę/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: '.local/production-oasis.png' });
await page.getByRole('button', { name: /Zanurz się/ }).click();
await page.keyboard.down('KeyW');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyW');
await page.keyboard.press('Escape');
await page.getByRole('heading', { name: 'Wyprawa wstrzymana' }).waitFor();
await page.goto('http://127.0.0.1:5173/?diagnostics=1');
await page.getByRole('button', { name: /Rozpocznij wyprawę/ }).waitFor({ timeout: 45000 });
const views = [];
for (const kind of ['oasis', 'stage-1', 'stage-5']) {
  for (const quality of ['high', 'low']) {
    await page.evaluate(
      async ({ kind, quality }) => {
        const { game, world } = window.__BATYSKAF_TEST__;
        game.save.settings.quality = quality;
        if (kind === 'oasis') game.start();
        else {
          game.save.level = kind === 'stage-1' ? 0 : 4;
          game.launch();
          const r = game.layout.routes.find((r) => r.kind === 'connector'),
            i = Math.floor(r.path.length * 0.4),
            a = r.path[i],
            b = r.path[i + 1];
          game.position = { ...a };
          game.yaw = Math.atan2(b.x - a.x, b.z - a.z);
          game.pitch = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
        }
        game.pause();
        world.update(0);
        await world.scene.whenReadyAsync();
        document.querySelector('#overlay').style.visibility = 'hidden';
      },
      { kind, quality },
    );
    await page.waitForTimeout(2200);
    views.push({
      view: kind,
      quality,
      ...(await page.evaluate(() => window.__BATYSKAF_TEST__.snapshot())),
    });
    if (quality === 'high') await page.screenshot({ path: `.local/measure-${kind}.png` });
  }
}
const report = {
  date: new Date().toISOString(),
  browser: browser.version(),
  viewport: '1440x900',
  startupMs,
  production,
  views,
  errors,
  external,
};
await writeFile('.local/measurement.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (errors.length || external.length || production.diagnosticsPresent) process.exitCode = 1;
