import { test, expect } from '@playwright/test';

test('menu counts down five seconds and starts automatically', async ({ page }) => {
  await page.goto('/?diagnostics=1');
  await expect(page.locator('#menu-seconds')).toHaveText('5');
  await expect(page.locator('#menu-seconds')).toHaveText('1');
  await expect(page.locator('.main-menu')).toBeVisible();
  await expect(page.locator('.main-menu')).toHaveCount(0);
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.phase)).toBe('oasis');
});

test('settings interrupt the countdown and manual play cancels automatic start', async ({
  page,
}) => {
  await page.goto('/?diagnostics=1');
  await expect(page.locator('#menu-seconds')).toHaveText('5');
  await page.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  await page.waitForTimeout(6000);
  await expect(page.getByRole('heading', { name: 'Ustawienia' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.phase)).toBe('menu');
  await page.getByRole('button', { name: /^Wróć/ }).click();
  await expect(page.locator('#menu-seconds')).toHaveText('5');
  await page.getByRole('button', { name: 'Rozpocznij wyprawę' }).click();
  await page.evaluate(() => {
    const { game } = (window as any).__BATYSKAF_TEST__;
    game.position.x = 42;
    game.pause();
  });
  await page.waitForTimeout(6000);
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.phase)).toBe('paused');
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.position.x)).toBe(42);
});
