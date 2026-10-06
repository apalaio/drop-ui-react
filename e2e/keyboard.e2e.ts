import { expect, Locator, Page, test } from '@playwright/test';

function cell(canvas: Locator, row: number, column: number): Locator {
  return canvas.getByRole('group', { name: `Row ${row}, column ${column}`, exact: true });
}

function elementTypes(container: Locator): Promise<(string | null)[]> {
  return container
    .locator('[data-element-type]')
    .evaluateAll((wrappers) => wrappers.map((wrapper) => wrapper.getAttribute('data-element-type')));
}

async function setGrid(page: Page, rows: number, columns: number): Promise<void> {
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });

  await sidebar.getByRole('spinbutton', { name: 'Grid rows' }).focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(String(rows));
  await page.keyboard.press('Tab');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(String(columns));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Canvas' }).getByTestId('canvas-cell')).toHaveCount(rows * columns);
}

async function addFromPalette(page: Page, label: string, cellsDown = 0): Promise<void> {
  await page.getByRole('complementary', { name: 'Sidebar' }).getByRole('button', { name: `Add ${label}` }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu', { name: `Add ${label} to` })).toBeVisible();
  for (let press = 0; press < cellsDown; press++) {
    await page.keyboard.press('ArrowDown');
  }
  await page.keyboard.press('Enter');
}

test('reaches the palette by tabbing and adds an element to the canvas without a pointer', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  const addBlockText = sidebar.getByRole('button', { name: 'Add Block text' });

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Change theme' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(addBlockText).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Row 1, column 1' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(canvas.getByTestId('dropped-div')).toHaveCount(1);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(addBlockText).toBeFocused();
  await expect(page.getByText('Block text added to Row 1, column 1.')).toBeAttached();
});

test('adds an element with a single click on its palette item, without dragging', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await sidebar.getByRole('button', { name: 'Add Datepicker' }).click();
  await page.getByRole('menuitem', { name: 'Row 1, column 1' }).click();

  await expect(canvas.getByTestId('dropped-datepicker')).toHaveCount(1);
});

test('adds an element to the cell chosen from the palette item menu', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setGrid(page, 2, 2);

  await addFromPalette(page, 'Dropdown', 3);

  await expect(cell(canvas, 2, 2).getByTestId('dropped-dropdown')).toHaveCount(1);
  await expect(canvas.getByTestId('dropped-dropdown')).toHaveCount(1);
  await expect(page.getByText('Dropdown added to Row 2, column 2.')).toBeAttached();
});

test('adds after the elements a cell already holds', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await addFromPalette(page, 'Block text');
  await addFromPalette(page, 'Text input');
  await addFromPalette(page, 'Inline text');

  await expect(canvas.locator('[data-element-type]')).toHaveCount(3);
  expect(await elementTypes(canvas)).toEqual(['div', 'text-input', 'span']);
});

test('leaves the canvas alone when the palette item menu is dismissed with Escape', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  const addBlockText = sidebar.getByRole('button', { name: 'Add Block text' });

  await addBlockText.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu', { name: 'Add Block text to' })).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(addBlockText).toBeFocused();
  await expect(canvas.locator('[data-element-type]')).toHaveCount(0);
});

test('reorders elements within a cell from the keyboard, keeping focus on the moved element', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await addFromPalette(page, 'Block text');
  await addFromPalette(page, 'Text input');
  const blockTextActions = canvas.getByRole('button', { name: 'Block text actions' });

  await blockTextActions.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Move earlier' })).toBeFocused();
  await expect(page.getByRole('menuitem', { name: 'Move earlier' })).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu', { name: 'Block text actions' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Move later' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect.poll(() => elementTypes(canvas)).toEqual(['text-input', 'div']);
  await expect(blockTextActions).toBeFocused();
  await expect(page.getByText('Block text moved to position 2 of 2.')).toBeAttached();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Move later' })).toBeDisabled();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Move earlier' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect.poll(() => elementTypes(canvas)).toEqual(['div', 'text-input']);
  await expect(blockTextActions).toBeFocused();
});

test('moves an element to another cell from the keyboard, keeping what was typed and the focus', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setGrid(page, 1, 2);
  await addFromPalette(page, 'Text input');
  await cell(canvas, 1, 1).getByTestId('dropped-text-input').fill('Ada');

  await canvas.getByRole('button', { name: 'Text input actions' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Move to cell' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'Row 1, column 2' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(cell(canvas, 1, 2).getByTestId('dropped-text-input')).toHaveValue('Ada');
  await expect(canvas.getByTestId('dropped-text-input')).toHaveCount(1);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(cell(canvas, 1, 2).getByRole('button', { name: 'Text input actions' })).toBeFocused();
  await expect(page.getByText('Text input moved to Row 1, column 2.')).toBeAttached();
});

test('offers no move actions to an element alone in a grid of one cell', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await addFromPalette(page, 'Block text');

  await canvas.getByRole('button', { name: 'Block text actions' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('menuitem')).toHaveText(['Edit text', 'Delete element']);
});

test('names the edit dialog by its heading and returns focus to the element when it is saved', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await addFromPalette(page, 'Block text');
  const actions = canvas.getByRole('button', { name: 'Block text actions' });

  await actions.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Edit text' });
  await expect(dialog).toHaveAccessibleDescription('Change the text shown inside this <div>.');
  await expect(dialog.getByRole('textbox', { name: 'Text' })).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Hello world');
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expect(canvas.getByTestId('dropped-div')).toHaveText('Hello world');
  await expect(actions).toBeFocused();
});

test('returns focus to the element when its edit dialog is dismissed with Escape', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await addFromPalette(page, 'Dropdown');
  const actions = canvas.getByRole('button', { name: 'Dropdown actions' });

  await actions.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Edit options' });
  await expect(dialog.getByRole('textbox', { name: 'Option 1 text' })).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(actions).toBeFocused();
});

test('confirms a deletion from the keyboard and moves focus to the cell the element was in', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await addFromPalette(page, 'Block text');

  await canvas.getByRole('button', { name: 'Block text actions' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Delete element' })).toBeFocused();
  await page.keyboard.press('Enter');
  const confirmation = page.getByRole('alertdialog', { name: 'Delete element' });
  await expect(confirmation).toHaveAccessibleDescription('Remove this <div> from the canvas? This cannot be undone.');
  await expect(confirmation.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(confirmation.getByRole('button', { name: 'Delete' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(canvas.getByTestId('dropped-div')).toHaveCount(0);
  await expect(cell(canvas, 1, 1)).toBeFocused();
  await expect(page.getByText('Block text deleted.')).toBeAttached();
});

test('announces the grid size that took effect', async ({ page }) => {
  await page.goto('/');

  await setGrid(page, 2, 3);

  await expect(page.getByText('Grid set to 2 rows and 3 columns.')).toBeAttached();
});

test('announces an element dropped with the pointer the same way', async ({ page }) => {
  await page.goto('/');
  const source = page.getByRole('complementary', { name: 'Sidebar' }).getByRole('listitem').filter({ hasText: 'Span' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  const from = await source.boundingBox();
  const to = await canvas.boundingBox();
  if (!from || !to) throw new Error('Drag source or target is not visible');

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await page.mouse.up();

  await expect(canvas.getByTestId('dropped-span')).toHaveCount(1);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByText('Inline text added to Row 1, column 1.')).toBeAttached();
});
