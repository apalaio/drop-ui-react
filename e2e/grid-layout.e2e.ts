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

function cell(canvas: Locator, row: number, column: number): Locator {
  return canvas.getByRole('group', { name: `Row ${row}, column ${column}`, exact: true });
}

async function setGrid(page: Page, rows: number, columns: number): Promise<void> {
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const rowsInput = sidebar.getByRole('spinbutton', { name: 'Grid rows' });
  const columnsInput = sidebar.getByRole('spinbutton', { name: 'Grid columns' });

  await rowsInput.fill(String(rows));
  await rowsInput.blur();
  await columnsInput.fill(String(columns));
  await columnsInput.blur();
  await expect(page.getByRole('region', { name: 'Canvas' }).getByTestId('canvas-cell')).toHaveCount(
    rows * columns,
  );
}

test('starts with a one by one grid: a single cell filling the canvas', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await expect(sidebar.getByRole('spinbutton', { name: 'Grid rows' })).toHaveValue('1');
  await expect(sidebar.getByRole('spinbutton', { name: 'Grid columns' })).toHaveValue('1');

  await expect(canvas.getByTestId('canvas-cell')).toHaveCount(1);
  await expect(cell(canvas, 1, 1)).toBeVisible();
  await expect(canvas.getByText('Drop elements here')).toHaveCount(1);
});

test('splits the canvas into one cell per row and column', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await setGrid(page, 2, 2);

  await expect(canvas.getByTestId('canvas-cell')).toHaveCount(4);
  await expect(canvas.getByText('Drop elements here')).toHaveCount(4);

  const boxOf = async (row: number, column: number) => {
    await expect(cell(canvas, row, column)).toBeVisible();
    const box = await cell(canvas, row, column).boundingBox();
    if (!box) throw new Error(`Row ${row}, column ${column} is not visible`);
    return box;
  };
  const [topLeft, topRight, bottomLeft, bottomRight] = [
    await boxOf(1, 1),
    await boxOf(1, 2),
    await boxOf(2, 1),
    await boxOf(2, 2),
  ];

  const sharedBorder = 2;
  expect(topRight.y).toBeCloseTo(topLeft.y, 0);
  expect(topRight.x).toBeCloseTo(topLeft.x + topLeft.width - sharedBorder, 0);
  expect(bottomLeft.x).toBeCloseTo(topLeft.x, 0);
  expect(bottomLeft.y).toBeCloseTo(topLeft.y + topLeft.height - sharedBorder, 0);
  expect(bottomRight.x).toBeCloseTo(topRight.x, 0);
  expect(bottomRight.y).toBeCloseTo(bottomLeft.y, 0);

  for (const gridCell of await canvas.getByTestId('canvas-cell').all()) {
    await expect(gridCell).toHaveCSS('border-radius', '0px');
  }
});

test('applies a typed grid size once it is committed, not while it is being typed', async ({
  page,
}) => {
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  const rowsInput = sidebar.getByRole('spinbutton', { name: 'Grid rows' });

  await rowsInput.fill('3');
  await expect(rowsInput).toHaveValue('3');
  await expect(canvas.getByTestId('canvas-cell')).toHaveCount(1);

  await rowsInput.press('Enter');
  await expect(canvas.getByTestId('canvas-cell')).toHaveCount(3);
  await expect(cell(canvas, 3, 1)).toBeVisible();
});

test('drops a palette item into the chosen cell and nowhere else', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setGrid(page, 2, 2);

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Div' }), cell(canvas, 2, 2));

  await expect(cell(canvas, 2, 2).getByTestId('dropped-div')).toHaveCount(1);
  await expect(canvas.getByTestId('dropped-div')).toHaveCount(1);
  await expect(cell(canvas, 2, 2).getByText('Drop elements here')).toHaveCount(0);
  await expect(canvas.getByText('Drop elements here')).toHaveCount(3);
});

test('moves a dropped element from one cell to another', async ({ page }) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setGrid(page, 1, 2);

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Div' }), cell(canvas, 1, 1));
  await expect(cell(canvas, 1, 1).getByTestId('dropped-div')).toHaveCount(1);
  const uid = await cell(canvas, 1, 1).locator('[data-uid]').getAttribute('data-uid');

  await drag(page, cell(canvas, 1, 1).getByTestId('dropped-div'), cell(canvas, 1, 2));

  await expect(cell(canvas, 1, 2).getByTestId('dropped-div')).toHaveCount(1);
  await expect(cell(canvas, 1, 1).getByTestId('dropped-div')).toHaveCount(0);
  await expect(canvas.getByTestId('dropped-div')).toHaveCount(1);
  await expect(cell(canvas, 1, 2).locator('[data-uid]')).toHaveAttribute('data-uid', uid ?? '');
  await expect(cell(canvas, 1, 1).getByText('Drop elements here')).toBeVisible();
});

test('keeps every dropped element on the canvas when the grid shrinks back to one cell', async ({
  page,
}) => {
  await page.goto('/');
  const palette = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await setGrid(page, 2, 2);

  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Div' }), cell(canvas, 1, 2));
  await expect(cell(canvas, 1, 2).getByTestId('dropped-div')).toHaveCount(1);
  await drag(page, palette.getByRole('listitem').filter({ hasText: 'Span' }), cell(canvas, 2, 1));
  await expect(cell(canvas, 2, 1).getByTestId('dropped-span')).toHaveCount(1);

  await setGrid(page, 1, 1);

  await expect(cell(canvas, 1, 1).getByTestId('dropped-div')).toHaveCount(1);
  await expect(cell(canvas, 1, 1).getByTestId('dropped-span')).toHaveCount(1);
  await expect(canvas.locator('[data-element-type]')).toHaveCount(2);
});
