import { test, expect } from '@playwright/test';

test('five finite levels return to the surface, unlock the next level, and end in victory', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?diagnostics=1');
  await page.getByRole('button', { name: /Rozpocznij wyprawę/ }).click();
  await page.getByRole('button', { name: /Zanurz się/ }).click();
  const transitions: unknown[] = [];
  for (let level = 0; level < 5; level++) {
    await expect(page.locator('#depth')).toHaveText('0');
    expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.depth)).toBe(0);
    const before = await page.evaluate(() => {
      const { game, world } = (window as any).__BATYSKAF_TEST__;
      // Place the player just before the final portal, then cross it with real input.
      const route = game.layout.routes.at(-1),
        end = route.path.at(-1),
        prev = route.path.at(-2);
      const length = Math.hypot(end.x - prev.x, end.y - prev.y, end.z - prev.z);
      const dir = {
        x: (end.x - prev.x) / length,
        y: (end.y - prev.y) / length,
        z: (end.z - prev.z) / length,
      };
      game.position = { x: end.x - dir.x * 10, y: end.y - dir.y * 10, z: end.z - dir.z * 10 };
      game.pair = game.layout.sectors.length - 1;
      game.entities = [];
      game.velocity = { x: 0, y: 0, z: 0 };
      game.battery = game.stats.battery;
      game.yaw = Math.atan2(dir.x, dir.z);
      game.pitch = Math.asin(dir.y);
      game.phase = 'dive';
      world.cameraReady = false;
      world.update(0);
      return {
        depth: game.depth,
        level: game.save.level,
        fragments: game.layout.fragments.length,
        endings: game.layout.routes.filter((r: any) => r.kind === 'finish').length,
      };
    });
    expect(before.level).toBe(level);
    expect(before.fragments).toBe([4, 6, 8, 10, 12][level]);
    expect(before.endings).toBe(1);
    await expect(page.locator('#pair-number')).toHaveText('ZBIERZ DIAMENT');
    await page.keyboard.down('KeyW');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { game } = (window as any).__BATYSKAF_TEST__;
          return game.save.won ? 5 : game.save.level;
        }),
      )
      .toBe(level + 1);
    await page.keyboard.up('KeyW');
    await expect
      .poll(() => page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.phase))
      .toBe(level === 4 ? 'won' : 'stageComplete');
    const after = await page.evaluate(async () => {
      const { game, world } = (window as any).__BATYSKAF_TEST__;
      await world.scene.whenReadyAsync();
      return {
        phase: game.phase,
        depth: game.depth,
        level: game.save.level,
        renderedLevel: world.renderedLayout.index,
        surface: world.oasis.isEnabled(),
        errors: world.loadErrors,
      };
    });
    expect(after.depth).toBe(0);
    expect(after.phase).toBe(level === 4 ? 'won' : 'stageComplete');
    expect(after.renderedLevel).toBe(Math.min(level + 1, 4));
    expect(after.surface).toBe(true);
    expect(after.errors).toEqual([]);
    transitions.push({ before, after });
    if (level < 4) {
      await expect(
        page.getByRole('heading', { name: `Poziom ${level + 1} ukończony!` }),
      ).toBeVisible();
      await expect(
        page.getByText(`Odblokowano poziom ${level + 2}:`, { exact: false }),
      ).toBeVisible();
      if (level === 0) await page.screenshot({ path: '.local/level-complete.png' });
      await page.getByRole('button', { name: `Rozpocznij poziom ${level + 2}` }).click();
    }
  }
  await expect(page.getByRole('heading', { name: 'Gratulacje, wygrywasz!' })).toBeVisible();
  await page.screenshot({ path: '.local/victory.png' });
  const progress = () => page.evaluate(() => {
    const { money, upgrades, level, won } = (window as any).__BATYSKAF_TEST__.game.save;
    return { money, upgrades, level, won };
  });
  const victory = await progress();
  await page.getByRole('button', { name: /Graj dalej/ }).click();
  await expect(page.getByRole('button', { name: 'Ulepszenia', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Zanurz się/ }).click();
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.phase)).toBe('dive');
  expect(await progress()).toEqual(victory);
  // A fresh page is a new campaign, even after victory.
  await page.reload();
  await page.getByRole('button', { name: /Rozpocznij wyprawę/ }).click();
  await page.getByRole('button', { name: /Zanurz się/ }).click();
  await expect(page.locator('#depth')).toHaveText('0');
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.save.level)).toBe(0);
  expect(errors).toEqual([]);
  await test.info().attach('stage-transitions', {
    body: JSON.stringify(transitions, null, 2),
    contentType: 'application/json',
  });
});
