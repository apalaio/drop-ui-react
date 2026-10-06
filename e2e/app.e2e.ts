import { expect, test } from '@playwright/test';

test('renders the builder shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'DropUI' })).toBeVisible();
});

test('titles the page and outlines it with a heading per sidebar panel', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('DropUI – drag & drop UI builder');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading')).toHaveText(['DropUI', 'Layout', 'Elements']);
});
