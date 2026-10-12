import { expect, Locator, Page, test } from '@playwright/test';

const GENERATE_UI_API = '**/api/generate-ui';

const description = 'a signup form with name, birthday and country';

const generated = {
  elements: [
    { type: 'div', text: 'Sign up' },
    { type: 'text-input', text: 'Your name' },
    { type: 'datepicker' },
    {
      type: 'dropdown',
      options: [
        { text: 'Greece', value: 'gr' },
        { text: 'Norway', value: 'no' },
      ],
    },
  ],
};

function elementTypes(container: Locator): Promise<(string | null)[]> {
  return container
    .locator('[data-element-type]')
    .evaluateAll((wrappers) => wrappers.map((wrapper) => wrapper.getAttribute('data-element-type')));
}

async function describeUi(page: Page, text: string): Promise<void> {
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });

  await sidebar.getByRole('textbox', { name: 'Describe a UI' }).fill(text);
  await sidebar.getByRole('button', { name: 'Generate' }).click();
}

test('renders the elements generated from a description on the canvas', async ({ page }) => {
  const sent: unknown[] = [];
  await page.route(GENERATE_UI_API, async (route) => {
    sent.push({ method: route.request().method(), body: route.request().postDataJSON() });
    await route.fulfill({ json: generated });
  });
  await page.goto('/');
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await describeUi(page, description);

  await expect(canvas.locator('[data-element-type]')).toHaveCount(4);
  expect(await elementTypes(canvas)).toEqual(['div', 'text-input', 'datepicker', 'dropdown']);
  await expect(canvas.getByTestId('dropped-div')).toHaveText('Sign up');
  await expect(canvas.getByTestId('dropped-text-input')).toHaveAttribute('placeholder', 'Your name');
  await expect(canvas.getByTestId('dropped-datepicker')).toHaveValue('');
  await expect(canvas.getByRole('combobox', { name: 'Dropdown' }).getByRole('option')).toHaveText([
    'Greece',
    'Norway',
  ]);
  await expect(page.getByText('4 elements generated.')).toBeAttached();
  expect(sent).toEqual([{ method: 'POST', body: { text: description } }]);
});

test('replaces what is on the canvas with the generated elements, in a single cell', async ({ page }) => {
  await page.route(GENERATE_UI_API, (route) => route.fulfill({ json: generated }));
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  const columns = sidebar.getByRole('spinbutton', { name: 'Grid columns' });
  await columns.fill('2');
  await columns.blur();
  await expect(canvas.getByTestId('canvas-cell')).toHaveCount(2);
  await sidebar.getByRole('button', { name: 'Add Textfield' }).click();
  await page.getByRole('menuitem', { name: 'Row 1, column 2' }).click();
  await expect(canvas.getByTestId('dropped-textfield')).toHaveCount(1);

  await describeUi(page, description);

  await expect(canvas.locator('[data-element-type]')).toHaveCount(4);
  await expect(canvas.getByTestId('dropped-textfield')).toHaveCount(0);
  await expect(canvas.getByTestId('canvas-cell')).toHaveCount(1);
  await expect(columns).toHaveValue('1');
});

test('shows that it is generating until the answer arrives', async ({ page }) => {
  let answer = (): void => undefined;
  const answered = new Promise<void>((resolve) => (answer = resolve));
  await page.route(GENERATE_UI_API, async (route) => {
    await answered;
    await route.fulfill({ json: generated });
  });
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });

  await describeUi(page, description);

  await expect(sidebar.getByRole('button', { name: 'Generating…' })).toBeDisabled();
  await expect(canvas.locator('[data-element-type]')).toHaveCount(0);

  answer();

  await expect(canvas.locator('[data-element-type]')).toHaveCount(4);
  await expect(sidebar.getByRole('button', { name: 'Generate', exact: true })).toBeEnabled();
});

test('shows the reason the backend gives and leaves the canvas alone when generation fails', async ({ page }) => {
  const reason = 'The model could not turn that into a UI.';
  await page.route(GENERATE_UI_API, (route) => route.fulfill({ status: 502, json: { error: reason } }));
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  await sidebar.getByRole('button', { name: 'Add Datepicker' }).click();
  await page.getByRole('menuitem', { name: 'Row 1, column 1' }).click();
  await expect(canvas.getByTestId('dropped-datepicker')).toHaveCount(1);

  await describeUi(page, description);

  await expect(sidebar.getByRole('form', { name: 'Describe a UI' }).getByText(reason)).toBeVisible();
  expect(await elementTypes(canvas)).toEqual(['datepicker']);
  await expect(sidebar.getByRole('button', { name: 'Generate', exact: true })).toBeEnabled();
});

test('leaves the canvas alone and says so when nothing was generated', async ({ page }) => {
  await page.route(GENERATE_UI_API, (route) => route.fulfill({ json: { elements: [] } }));
  await page.goto('/');
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
  const canvas = page.getByRole('region', { name: 'Canvas' });
  const columns = sidebar.getByRole('spinbutton', { name: 'Grid columns' });
  await columns.fill('2');
  await columns.blur();
  await sidebar.getByRole('button', { name: 'Add Textfield' }).click();
  await page.getByRole('menuitem', { name: 'Row 1, column 2' }).click();
  await expect(canvas.getByTestId('dropped-textfield')).toHaveCount(1);

  await describeUi(page, 'hello');

  await expect(
    sidebar
      .getByRole('form', { name: 'Describe a UI' })
      .getByText('That description did not produce any elements.'),
  ).toBeVisible();
  expect(await elementTypes(canvas)).toEqual(['textfield']);
  await expect(canvas.getByTestId('canvas-cell')).toHaveCount(2);
});
