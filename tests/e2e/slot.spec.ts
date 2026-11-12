import { test, expect } from '@playwright/test';

test('portal slot waits, starts automatically, and ends even in settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://portal.test/return', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Portal</h1>' }),
  );
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: {
        id: 'slot-test',
        playerId: 'portal-player',
        gameId: 'batyskaf',
        arm: 'bob',
        portalEndpoint: 'https://portal.test/return',
        serverTime: Date.now(),
        startAt: Date.now() + 120000,
        endAt: Date.now() + 240000,
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
    portal.session.startAt = portal.now() + 1000;
    portal.session.endAt = portal.now() + 120000;
  });
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.phase)).toBe('oasis');
  await page.evaluate(() => {
    const { game } = (window as any).__BATYSKAF_TEST__;
    Object.assign(game.summary, { maxDepth: 432, maxLevel: 3, moneyEarned: 250 });
    game.save.money = 40;
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Ustawienia/ }).click();
  await page.evaluate(() => {
    const { portal } = (window as any).__BATYSKAF_TEST__;
    portal.session.endAt = portal.now() + 11000;
  });
  await expect(page.getByRole('heading', { name: 'Dziękujemy za grę!' })).toBeVisible();
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Ustawienia' })).toHaveCount(0);
  await page.keyboard.press('KeyW');
  expect(await page.evaluate(() => (window as any).__BATYSKAF_TEST__.game.phase)).toBe('paused');
  await expect(page.locator('[data-stat="max-depth"]')).toHaveText('432 m');
  await expect(page.locator('[data-stat="max-level"]')).toHaveText('3 / 5');
  await expect(page.locator('[data-stat="money-earned"]')).toHaveText('250 $');
  await page.screenshot({ path: '.local/slot-ended.png' });
  await page.route('**/api/session', (route) =>
    route.fulfill({
      json: {
        id: 'slot-test',
        playerId: 'portal-player',
        gameId: 'batyskaf',
        arm: 'bob',
        portalEndpoint: 'https://portal.test/return',
        serverTime: Date.now(),
        startAt: Date.now() - 60000,
        endAt: Date.now() + 9000,
        expiresAt: Date.now() + 3600000,
      },
    }),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dziękujemy za grę!' })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('[data-stat="money-earned"]')).toHaveText('250 $');
  await expect(page).toHaveURL('https://portal.test/return');
  await expect(page.getByRole('heading', { name: 'Portal' })).toBeVisible();
  expect(errors).toEqual([]);
});
