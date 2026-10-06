import { expect, Locator, Page, test } from '@playwright/test';

const unthemed = 'rgba(0, 0, 0, 0)';

async function openThemeList(page: Page): Promise<void> {
  await page.getByRole('banner').getByRole('button', { name: 'Change theme' }).click();
}

function theme(page: Page, name: string): Locator {
  return page.getByRole('menuitemradio', { name, exact: true });
}

function background(locator: Locator): Promise<string> {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor);
}

function requestedPaths(page: Page): string[] {
  const paths: string[] = [];
  page.on('request', (request) => paths.push(new URL(request.url()).pathname));
  return paths;
}

test('starts in the fantasy theme', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'fantasy');
});

test('starts themed without loading the other themes', async ({ page }) => {
  const requested = requestedPaths(page);

  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  expect(await background(page.getByRole('banner'))).not.toBe(unthemed);
  expect(requested).toContain('/themes/fantasy.css');
  expect(requested).not.toContain('/themes.css');
});

test('loads the other themes when the theme list is opened', async ({ page }) => {
  const requested = requestedPaths(page);
  await page.goto('/');

  await openThemeList(page);

  await expect.poll(() => requested).toContain('/themes.css');
});

test('opens the theme list scrolled to the current theme', async ({ page }) => {
  await page.goto('/');

  await openThemeList(page);

  await expect(theme(page, 'fantasy')).toBeChecked();
  await expect(theme(page, 'fantasy')).toBeInViewport();
});

test('picking a theme restyles the whole app', async ({ page }) => {
  await page.goto('/');
  const header = page.getByRole('banner');
  const main = page.getByRole('main');
  const headerBefore = await background(header);
  const mainBefore = await background(main);

  await openThemeList(page);
  await theme(page, 'dracula').click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await expect.poll(() => background(header)).not.toBe(headerBefore);
  await expect.poll(() => background(header)).not.toBe(unthemed);
  await expect.poll(() => background(main)).not.toBe(mainBefore);
  await expect.poll(() => background(main)).not.toBe(unthemed);
});

test('a picked theme also restyles overlays rendered outside the app root', async ({ page }) => {
  await page.goto('/');
  const themeList = page.getByRole('menu', { name: 'Themes' });
  await openThemeList(page);
  const themeListBefore = await background(themeList);
  await theme(page, 'dracula').click();

  await openThemeList(page);

  await expect(theme(page, 'dracula')).toBeChecked();
  await expect.poll(() => background(themeList)).not.toBe(themeListBefore);
  await expect.poll(() => background(themeList)).not.toBe(unthemed);
});

test('picks a theme from the keyboard, announces it and tells it on the button', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('banner').getByRole('button', { name: 'Change theme' });
  await expect(trigger).toHaveAccessibleDescription('Current theme: fantasy');

  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(theme(page, 'fantasy')).toBeFocused();
  await page.keyboard.type('dra');
  await expect(theme(page, 'dracula')).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAccessibleDescription('Current theme: dracula');
  await expect(page.getByText('Theme changed to dracula.')).toBeAttached();
});
