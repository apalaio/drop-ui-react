import { expect, Locator, Page, test } from '@playwright/test';

async function drag(page: Page, source: Locator, target: Locator): Promise<void> {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('Drag source or target is not visible');

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();
}

test('drops a div and a span from the palette onto the canvas', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Div' }), canvas);
  await expect(canvas.getByTestId('dropped-div')).toHaveCount(1);

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Span' }), canvas.getByTestId('dropped-div'));
  await expect(canvas.getByTestId('dropped-span')).toHaveCount(1);

  const types = await canvas.locator('[data-element-type]').evaluateAll((wrappers) =>
    wrappers.map((wrapper) => wrapper.getAttribute('data-element-type')),
  );
  expect(types.sort()).toEqual(['div', 'span']);
});

test('still drops and reorders elements when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Div' }), canvas);
  await expect(canvas.getByTestId('dropped-div')).toHaveCount(1);
  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Dropdown' }), canvas.getByTestId('dropped-div'));

  await expect(canvas.getByTestId('dropped-dropdown')).toHaveCount(1);
  await expect(canvas.locator('[data-element-type]')).toHaveCount(2);
});

test('lays dropped spans out next to each other and a div on a line of its own', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  const spans = canvas.locator('[data-element-type="span"]');
  const boxes = (wrappers: Locator) => wrappers.evaluateAll((all) => all.map((one) => one.getBoundingClientRect().toJSON()));

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Span' }), canvas);
  await expect(spans).toHaveCount(1);
  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Span' }), canvas);
  await expect(spans).toHaveCount(2);

  const [first, second] = await boxes(spans);
  expect(second.top).toBe(first.top);
  expect(second.left).toBeGreaterThanOrEqual(first.right);

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Div' }), canvas);
  await expect(canvas.getByTestId('dropped-div')).toHaveCount(1);

  const [div] = await boxes(canvas.locator('[data-element-type="div"]'));
  for (const span of await boxes(spans)) {
    expect(span.bottom <= div.top || span.top >= div.bottom).toBe(true);
  }
});

test('edits the text of a dropped element through its actions menu', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Div' }), canvas);
  const div = canvas.getByTestId('dropped-div');
  await expect(div).toHaveText('enter text');

  await canvas.getByRole('button', { name: 'Block text actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit text' }).click();

  const dialog = page.getByRole('dialog', { name: 'Edit text' });
  await dialog.getByRole('textbox', { name: 'Text' }).fill('Hello world');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog).toBeHidden();
  await expect(div).toHaveText('Hello world');
  await expect(canvas.getByTestId('dropped-div')).toHaveCount(1);
});

test('edits the options of a dropped dropdown through its actions menu', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Dropdown' }), canvas);
  const select = canvas.getByRole('combobox', { name: 'Dropdown' });
  await expect(select).toHaveCount(1);
  await expect(select.getByRole('option')).toHaveCount(0);

  await canvas.getByRole('button', { name: 'Dropdown actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit options' }).click();

  const dialog = page.getByRole('dialog', { name: 'Edit options' });
  await dialog.getByRole('textbox', { name: 'Option 1 text' }).fill('Small');
  await dialog.getByRole('textbox', { name: 'Option 1 value' }).fill('s');
  await dialog.getByRole('button', { name: 'Add option' }).click();
  await dialog.getByRole('textbox', { name: 'Option 2 text' }).fill('Large');
  await dialog.getByRole('textbox', { name: 'Option 2 value' }).fill('l');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog).toBeHidden();
  await expect(select.getByRole('option')).toHaveText(['Small', 'Large']);
  await select.selectOption({ label: 'Large' });
  await expect(select).toHaveValue('l');

  await canvas.getByRole('button', { name: 'Dropdown actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit options' }).click();
  await expect(dialog.getByRole('textbox', { name: 'Option 2 text' })).toHaveValue('Large');
});

test('deletes a dropped element through its actions menu after confirming', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Div' }), canvas);
  await expect(canvas.getByTestId('dropped-div')).toHaveCount(1);

  const openDeleteDialog = async () => {
    await canvas.getByRole('button', { name: 'Block text actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete element' }).click();
    return page.getByRole('alertdialog', { name: 'Delete element' });
  };

  await (await openDeleteDialog()).getByRole('button', { name: 'Cancel' }).click();
  await expect(canvas.getByTestId('dropped-div')).toHaveCount(1);

  await (await openDeleteDialog()).getByRole('button', { name: 'Delete' }).click();
  await expect(canvas.getByTestId('dropped-div')).toHaveCount(0);
  await expect(canvas.getByText('Drop elements here')).toBeVisible();
});
