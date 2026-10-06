import { expect, Locator, Page, test } from '@playwright/test';

interface Point {
  x: number;
  y: number;
}

async function centerOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Drag source or target is not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragBetween(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 20 });
  await page.mouse.up();
}

async function drag(page: Page, source: Locator, target: Locator): Promise<void> {
  await dragBetween(page, await centerOf(source), await centerOf(target));
}

async function dragByWrapper(page: Page, wrapper: Locator, target: Locator): Promise<void> {
  const box = await wrapper.boundingBox();
  if (!box) throw new Error('Dropped element is not visible');
  const besideTheControl = { x: box.x + box.width - 16, y: box.y + box.height - 8 };
  await dragBetween(page, besideTheControl, await centerOf(target));
}

async function nextRender(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((rendered) => requestAnimationFrame(() => setTimeout(rendered))));
}

function cell(canvas: Locator, row: number, column: number): Locator {
  return canvas.getByRole('group', { name: `Row ${row}, column ${column}`, exact: true });
}

async function setColumns(page: Page, columns: number): Promise<void> {
  const columnsInput = page
    .getByRole('complementary', { name: 'Sidebar' })
    .getByRole('spinbutton', { name: 'Grid columns' });

  await columnsInput.fill(String(columns));
  await columnsInput.blur();
  await expect(page.getByRole('region', { name: 'Canvas' }).getByTestId('canvas-cell')).toHaveCount(columns);
}

test('drops a text input, a textfield and a datepicker from the palette onto the canvas', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Text input' }), canvas);
  await expect(canvas.getByTestId('dropped-text-input')).toHaveCount(1);

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Textfield' }), canvas);
  await expect(canvas.getByTestId('dropped-textfield')).toHaveCount(1);

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Datepicker' }), canvas);
  await expect(canvas.getByTestId('dropped-datepicker')).toHaveCount(1);

  const types = await canvas.locator('[data-element-type]').evaluateAll((wrappers) =>
    wrappers.map((wrapper) => wrapper.getAttribute('data-element-type')),
  );
  expect(types.sort()).toEqual(['datepicker', 'text-input', 'textfield']);
});

test('edits the placeholder of a dropped text input through its actions menu', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Text input' }), canvas);
  const input = canvas.getByTestId('dropped-text-input');
  await expect(input).toHaveAttribute('placeholder', 'enter text');

  await canvas.getByRole('button', { name: 'Text input actions' }).click();
  await page.getByRole('menuitem', { name: 'Edit text' }).click();

  const dialog = page.getByRole('dialog', { name: 'Edit text' });
  await dialog.getByRole('textbox', { name: 'Text' }).fill('Your name');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog).toBeHidden();
  await expect(input).toHaveAttribute('placeholder', 'Your name');
  await expect(input).toHaveValue('');
});

test('lets the user work inside a dropped text input without dragging the element', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setColumns(page, 2);

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Text input' }), cell(canvas, 1, 1));
  const input = cell(canvas, 1, 1).getByTestId('dropped-text-input');
  await expect(input).toHaveCount(1);

  await input.click();
  await page.keyboard.type('hello');
  await expect(input).toHaveValue('hello');

  await drag(page, input, cell(canvas, 1, 2));

  await expect(cell(canvas, 1, 1).getByTestId('dropped-text-input')).toHaveCount(1);
  await expect(cell(canvas, 1, 2).getByText('Drop elements here')).toBeVisible();
});

test('moves a dropped text input to another cell when dragged by its wrapper', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setColumns(page, 2);

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Text input' }), cell(canvas, 1, 1));
  await expect(cell(canvas, 1, 1).getByTestId('dropped-text-input')).toHaveCount(1);

  await dragByWrapper(page, cell(canvas, 1, 1).locator('[data-element-type="text-input"]'), cell(canvas, 1, 2));

  await expect(cell(canvas, 1, 2).getByTestId('dropped-text-input')).toHaveCount(1);
  await expect(cell(canvas, 1, 1).getByTestId('dropped-text-input')).toHaveCount(0);
});

test('keeps what was typed and picked when the controls are moved to another cell', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setColumns(page, 2);
  const controls = [
    { label: 'Text input', type: 'text-input', testId: 'dropped-text-input', value: 'Ada' },
    { label: 'Textfield', type: 'textfield', testId: 'dropped-textfield', value: 'Two\nlines' },
    { label: 'Datepicker', type: 'datepicker', testId: 'dropped-datepicker', value: '2026-10-05' },
  ];

  for (const { label, type, testId, value } of controls) {
    await drag(page, palette.getByRole('listitem').filter({ hasText: label }), cell(canvas, 1, 1));
    await cell(canvas, 1, 1).getByTestId(testId).fill(value);

    await dragByWrapper(page, cell(canvas, 1, 1).locator(`[data-element-type="${type}"]`), cell(canvas, 1, 2));

    await expect(page.getByTestId(testId)).toHaveCount(1);
    await expect(cell(canvas, 1, 2).getByTestId(testId)).toHaveValue(value);
  }
});

test('keeps the selected option when a dropdown is moved to another cell', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setColumns(page, 2);
  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Dropdown' }), cell(canvas, 1, 1));
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
  await cell(canvas, 1, 1).getByRole('combobox', { name: 'Dropdown' }).selectOption({ label: 'Large' });

  await dragByWrapper(page, cell(canvas, 1, 1).locator('[data-element-type="dropdown"]'), cell(canvas, 1, 2));

  await expect(page.getByTestId('dropped-dropdown')).toHaveCount(1);
  await expect(cell(canvas, 1, 2).getByRole('combobox', { name: 'Dropdown' })).toHaveValue('l');
});

test('keeps what was typed when the grid shrinks and the cell of the control is removed', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setColumns(page, 2);
  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Text input' }), cell(canvas, 1, 2));
  await cell(canvas, 1, 2).getByTestId('dropped-text-input').fill('Ada');

  await setColumns(page, 1);

  await expect(cell(canvas, 1, 1).getByTestId('dropped-text-input')).toHaveValue('Ada');
});

test('keeps the rest of a picked date while one of its parts is retyped', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Datepicker' }), canvas);
  const date = canvas.getByTestId('dropped-datepicker');
  await date.fill('2026-10-05');
  await nextRender(page);

  await date.focus();
  await page.keyboard.press('Backspace');
  await nextRender(page);

  await expect(date).toHaveValue('');
  expect(await date.evaluate((input: HTMLInputElement) => input.validity.badInput)).toBe(true);
});
