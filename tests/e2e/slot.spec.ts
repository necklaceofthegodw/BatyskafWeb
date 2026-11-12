import { test, expect } from '@playwright/test';

test('portal slot waits, starts automatically, and ends even in settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: {
        id: 'slot-test',
        playerId: 'portal-player',
        gameId: 'batyskaf',
        arm: 'bob',
        serverTime: Date.now(),
        startsAt: Date.now() + 120000,
        endsAt: Date.now() + 240000,
        expiresAt: Date.now() + 3600000,
      },
    }),
  );
  await page.goto('/waiting?diagnostics=1#session=slot-test');
  await expect(page.getByRole('heading', { name: 'Czekamy na rozpoczęcie gry' })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('.submarine-start')).toHaveCount(0);
  await page.screenshot({ path: '.local/slot-waiting.png' });
  await page.evaluate(() => {
    const { portal } = (window as any).__BATYSKAF_TEST__;
    portal.session.startsAt = portal.now() + 1000;
    portal.session.endsAt = portal.now() + 120000;
  });
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.phase)).toBe('oasis');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Ustawienia/ }).click();
  await page.evaluate(() => {
    const { portal } = (window as any).__BATYSKAF_TEST__;
    portal.session.endsAt = portal.now() + 1000;
  });
  await expect(page.getByRole('heading', { name: 'Dziękujemy za grę!' })).toBeVisible();
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Ustawienia' })).toHaveCount(0);
  await page.keyboard.press('KeyW');
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.phase)).toBe('paused');
  await page.screenshot({ path: '.local/slot-ended.png' });
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: {
        id: 'slot-test',
        playerId: 'portal-player',
        gameId: 'batyskaf',
        arm: 'bob',
        serverTime: Date.now(),
        startsAt: Date.now() - 60000,
        endsAt: Date.now() - 1000,
        expiresAt: Date.now() + 3600000,
      },
    }),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dziękujemy za grę!' })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator('#hud')).toBeHidden();
  expect(errors).toEqual([]);
});
