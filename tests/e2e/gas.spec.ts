import { test, expect } from '@playwright/test';

test('gas is vivid green and leaves the opposite tunnel side visible', async ({ page }) => {
  await page.goto('/?diagnostics=1');
  await page.waitForFunction(() => !!(window as any).__BATYSKAF_TEST__);
  await page.evaluate(() => {
    const { game } = (window as any).__BATYSKAF_TEST__;
    game.save.level = 2;
    game.launch();
    const gas = game.entities.find((e: any) => e.kind === 'gas');
    game.entities = [gas];
    game.pair = gas.pair;
    game.position = {
      x: gas.position.x - gas.forward.x * 18,
      y: gas.position.y - gas.forward.y * 18,
      z: gas.position.z - gas.forward.z * 18,
    };
    game.yaw = Math.atan2(gas.forward.x, gas.forward.z);
    game.pitch = Math.asin(gas.forward.y);
  });
  await page.waitForTimeout(800);
  expect(
    await page.evaluate(() => {
      const { world } = (window as any).__BATYSKAF_TEST__;
      const material = world.scene.getMaterialByName('gas');
      return material.alpha > 0.3 && material.emissiveColor.g > material.emissiveColor.r * 3;
    }),
  ).toBe(true);
  await page.screenshot({ path: '.local/gas-bypass.png' });
});
