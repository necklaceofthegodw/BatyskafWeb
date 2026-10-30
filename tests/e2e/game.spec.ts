import { test, expect } from '@playwright/test';
test('loads real WebGL, starts an expedition, pauses safely and resets progress while preserving preferences', async ({
  page,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== '127.0.0.1')
      external.push(r.url());
  });
  await page.goto('/?diagnostics=1');
  await expect(page.getByRole('button', { name: /Rozpocznij wyprawę/ })).toBeVisible({
    timeout: 45000,
  });
  await page.screenshot({ path: '.local/menu.png' });
  const metrics = await page.evaluate(() => (window as any).__BATYSKAF_TEST__.snapshot());
  expect(metrics.loadErrors).toEqual([]);
  expect(metrics.meshes).toBeGreaterThan(100);
  await page.getByRole('button', { name: /Rozpocznij wyprawę/ }).click();
  await page.screenshot({ path: '.local/oasis.png' });
  await page.getByRole('button', { name: /Zanurz się/ }).click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  const state = await page.evaluate(() => (window as any).__BATYSKAF_TEST__.snapshot());
  expect(state.phase).toBe('dive');
  expect(state.battery).toBeLessThan(40);
  const yawBefore = await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.yaw);
  await page.keyboard.down('KeyD');
  await expect
    .poll(() =>
      page.evaluate((before) => (window as any).__BATYSKAF_TEST__.game.yaw - before, yawBefore),
    )
    .toBeGreaterThan(0.12);
  await page.keyboard.down('ArrowRight');
  await page.keyboard.up('KeyD');
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.controls.state.turn)).toBe(1);
  await page.keyboard.up('ArrowRight');
  const yawAfter = await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.yaw);
  expect(yawAfter - yawBefore).toBeGreaterThan(0.1);
  expect(yawAfter - yawBefore).toBeLessThan(0.8);
  await page.keyboard.down('KeyS');
  await page.keyboard.down('Space');
  await page.keyboard.up('KeyS');
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.controls.state.brake)).toBe(
    true,
  );
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.controls.state.brake)).toBe(
    false,
  );
  await page.screenshot({ path: '.local/dive.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByText('Wyprawa wstrzymana')).toBeVisible();
  const before = await page.evaluate(() => (window as any).__BATYSKAF_TEST__.snapshot().battery);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.snapshot().battery)).toBe(
    before,
  );
  await page.evaluate(() => {
    const { game } = (window as any).__BATYSKAF_TEST__;
    game.save.money = 100;
    game.phase = 'oasis';
    game.openShop();
  });
  await expect(page.getByRole('heading', { name: 'Ulepszenia' })).toBeVisible();
  await page.locator('[data-action="buy:MaxSpeed"]').click();
  await page.screenshot({ path: '.local/shop.png' });
  await expect
    .poll(() => page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.save.upgrades.MaxSpeed))
    .toBe(1);
  await page.evaluate(async () => {
    const { game, storage } = (window as any).__BATYSKAF_TEST__;
    game.save.settings.sensitivity = 0.7;
    await storage.saveSettings(game.save.settings);
    // Simulate an old version's persisted campaign, then ensure migration discards it.
    await storage.db.put('saves', { ...game.save, level: 4, won: true, bestDepth: 9000 }, 'local');
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /Rozpocznij wyprawę/ })).toBeVisible({
    timeout: 45000,
  });
  const restored = await page.evaluate(async () => {
    const { game, storage } = (window as any).__BATYSKAF_TEST__;
    return { save: game.save, persisted: await storage.db.get('saves', 'local') };
  });
  expect(restored.save).toMatchObject({
    level: 0,
    money: 0,
    won: false,
    runs: 0,
    choices: 0,
    bestDepth: 0,
    upgrades: { MaxSpeed: 0 },
    settings: { sensitivity: 0.7 },
  });
  expect(Object.keys(restored.persisted)).toEqual(['settings']);

  await page.evaluate(async () => {
    const modulePath = '/src/services/storage.ts';
    const { Storage } = await import(/* @vite-ignore */ modulePath);
    const a = new Storage('player:g:p', 'session:old-alice'),
      b = new Storage('player:g:p', 'session:new-bob');
    await a.init();
    await b.init();
    const event = {
      id: 'isolation-test',
      bit: 1,
      timestamp_generation: new Date().toISOString(),
      metadata: {
        session_id: 'test',
        sequence: '1',
        game_time: 0,
        attempt: 1,
        type: 'fork',
        option: 'left',
        level: 1,
      },
    };
    await a.record(event);
    if ((await a.pending()).length !== 1 || (await b.pending()).length !== 0)
      throw new Error('Session queues leaked');
    await a.close();
    await b.close();
  });
  const counts = await page.evaluate(() => {
    const { game, world } = (window as any).__BATYSKAF_TEST__;
    const counts: unknown[] = [];
    for (let i = 0; i < 8; i++) {
      game.launch();
      world.update(0);
      counts.push([
        world.scene.meshes.length,
        world.scene.materials.length,
        world.scene.textures.length,
      ]);
    }
    game.phase = 'paused';
    return counts;
  });
  expect(counts.slice(1).every((c) => JSON.stringify(c) === JSON.stringify(counts[1]))).toBe(true);
  for (let level = 1; level < 5; level++) {
    await page.evaluate(async (index) => {
      const { game, world } = (window as any).__BATYSKAF_TEST__;
      game.save.level = index;
      game.launch();
      const route = game.layout.routes.find((r: any) => r.kind === 'connector');
      const i = Math.floor(route.path.length * 0.35),
        a = route.path[i],
        b = route.path[i + 1];
      game.position = { ...a };
      game.yaw = Math.atan2(b.x - a.x, b.z - a.z);
      game.pitch = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
      game.pause();
      world.update(0);
      await world.scene.whenReadyAsync();
    }, level);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => {
    const { game, world } = (window as any).__BATYSKAF_TEST__;
    game.launch();
    const route = game.layout.routes.find((r: any) => r.kind === 'left');
    const i = Math.floor(route.path.length * 0.4),
      a = route.path[i],
      b = route.path[i + 1];
    game.position = { ...a };
    game.yaw = Math.atan2(b.x - a.x, b.z - a.z);
    game.pitch = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
    game.cargo = [0, 1, 2, 3];
    game.pause();
    world.update(0);
    document.querySelector<HTMLElement>('#overlay')!.style.visibility = 'hidden';
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '.local/tunnel.png' });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
