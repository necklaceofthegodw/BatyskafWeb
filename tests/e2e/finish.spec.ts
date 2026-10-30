import { test, expect } from '@playwright/test';

test('finish diamond glows and pays the completion reward on contact', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?diagnostics=1');
  await page.waitForFunction(() => !!(window as any).__BATYSKAF_TEST__);
  await page.evaluate(() => {
    const { game } = (window as any).__BATYSKAF_TEST__;
    game.launch();
    game.entities = [];
    game.pair = game.layout.sectors.length - 1;
    game.position = { ...game.layout.exit, z: game.layout.exit.z - 16 };
    game.yaw = 0;
    game.pitch = 0;
  });
  await page.waitForTimeout(800);
  expect(
    await page.evaluate(() => {
      const { world } = (window as any).__BATYSKAF_TEST__;
      return {
        diamond: world.scene.getMeshByName('finish-diamond')?.isEnabled(),
        glow: world.scene.effectLayers.some((l: any) => l.name === 'finish-diamond-glow'),
      };
    }),
  ).toEqual({ diamond: true, glow: true });
  await page.screenshot({ path: '.local/finish-diamond.png' });
  await page.evaluate(() => {
    const { game } = (window as any).__BATYSKAF_TEST__;
    game.save.money = 0;
    game.position = { ...game.layout.exit };
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.completed))
    .toBe(true);
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.save.money)).toBe(100);
  expect(errors).toEqual([]);
});
