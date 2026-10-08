import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithStores } from '../../../../test/render-with-stores';
import { BuilderShell } from './builder-shell';

describe(BuilderShell.name, () => {
  beforeEach(() => {
    renderWithStores(<BuilderShell />, { dnd: false });
  });

  it('should place the theme picker in the header', () => {
    const header = screen.getByRole('banner');

    expect(within(header).getByRole('button', { name: 'Change theme' })).toBeInTheDocument();
  });

  it('should place the app name in the header as the top heading', () => {
    const header = screen.getByRole('banner');

    expect(within(header).getByRole('heading', { level: 1, name: 'DropUI' })).toBeInTheDocument();
  });

  it('should place the palette in the sidebar', () => {
    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });

    expect(within(sidebar).getByRole('heading', { name: 'Elements' })).toBeInTheDocument();
  });

  it('should place the layout panel above the palette in the sidebar', () => {
    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    const headings = within(sidebar)
      .getAllByRole('heading')
      .map((heading) => heading.textContent?.trim());

    expect(headings).toEqual(['Layout', 'Elements']);
  });

  it('should place the grid rows and columns inputs in the sidebar', () => {
    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    const inputs = within(sidebar)
      .getAllByRole('spinbutton')
      .map((input) => input.getAttribute('aria-label'));

    expect(inputs).toEqual(['Grid rows', 'Grid columns']);
  });

  it('should place the canvas in the main area', () => {
    expect(
      within(screen.getByRole('main')).getByRole('region', { name: 'Canvas' }),
    ).toBeInTheDocument();
  });

  it('should place the fact panel below the palette in the sidebar', () => {
    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    const palette = within(sidebar).getByRole('list', { name: 'Elements' });
    const panel = within(sidebar).getByRole('region', { name: 'Did you know?' });

    expect(palette.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('should show an element added from the palette on the canvas', async () => {
    const sidebar = screen.getByRole('complementary', { name: 'Sidebar' });
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Add Block text' }));

    fireEvent.click(await screen.findByRole('menuitem', { name: 'Row 1, column 1' }));

    expect(await within(screen.getByRole('main')).findByTestId('dropped-div')).toBeInTheDocument();
  });

  it('should split the canvas when the grid is resized in the sidebar', async () => {
    const columns = screen.getByRole('spinbutton', { name: 'Grid columns' });
    fireEvent.input(columns, { target: { value: '3' } });

    fireEvent.change(columns);

    await waitFor(() =>
      expect(within(screen.getByRole('main')).getAllByTestId('canvas-cell').length).toBe(3),
    );
  });
});
