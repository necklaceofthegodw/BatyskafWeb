import { test, expect } from '@playwright/test';

test('simple menu, readable instruments and five upgrade rows work at different screen sizes', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?diagnostics=1');
  await expect(page.getByRole('heading', { name: 'BATYSKAF', exact: true })).toBeVisible();
  await expect(page.locator('.main-menu button')).toHaveCount(3);
  await expect(page.getByRole('img', { name: /Żółty batyskaf/ })).toBeVisible();
  await page.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  await page.getByLabel('Jakość obrazu').selectOption('low');
  await page.getByRole('button', { name: /^Wróć/ }).click();
  await page.getByRole('button', { name: 'Jak grać', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Poznaj swój batyskaf' })).toBeVisible();
  await page.getByRole('button', { name: 'Rozumiem' }).click();
  for (const size of [
    { width: 1440, height: 900 },
    { width: 960, height: 600 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const start = page.getByRole('button', { name: 'Rozpocznij wyprawę' });
    await expect(start).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Jak grać', exact: true })).toBeInViewport();
    await page.screenshot({ path: `.local/simple-menu-${size.width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'Rozpocznij wyprawę' }).click();
  await expect(page.locator('#depth')).toHaveText('0');
  await expect(page.locator('.battery')).toBeVisible();
  await expect(page.locator('.dial')).toBeVisible();
  await page.getByRole('button', { name: 'Ulepszenia', exact: true }).click();
  await page.evaluate(() => {
    const { game } = (window as any).__BATYSKAF_TEST__;
    game.save.money = 50;
  });
  await expect(page.locator('.shop-money')).toHaveText('50 $');
  await expect(page.locator('.upgrade')).toHaveCount(5);
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('#notices')).toBeHidden();
  await page.locator('[data-action="buy:MaxSpeed"]').click();
  await expect(page.locator('.shop-money')).toHaveText('40 $');
  await expect(page.locator('.upgrade').first().locator('.upgrade-levels')).toContainText('1/4');
  for (const size of [
    { width: 1440, height: 900 },
    { width: 960, height: 600 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('button', { name: 'Zamknij ulepszenia' })).toBeInViewport();
    await expect(page.locator('.upgrade').last()).toBeInViewport();
    const overflow = await page.locator('.shop').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: `.local/simple-shop-${size.width}.png` });
  }
  await page.getByRole('button', { name: 'Zamknij ulepszenia' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#money')).toHaveText('40');
  expect(errors).toEqual([]);
});
