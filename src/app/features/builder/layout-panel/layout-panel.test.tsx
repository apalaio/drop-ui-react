import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { renderWithStores } from '../../../../test/render-with-stores';
import { TextCanvasElement } from '../models/canvas-element';
import { GridLayout } from '../models/grid-layout';
import { BuilderStore } from '../state/builder-store';
import { LayoutPanel } from './layout-panel';

describe(LayoutPanel.name, () => {
  const rowsLabel = 'Grid rows';
  const columnsLabel = 'Grid columns';

  function type(label: string, value: string): void {
    fireEvent.input(screen.getByRole('spinbutton', { name: label }), { target: { value } });
  }

  function commit(label: string): void {
    fireEvent.change(screen.getByRole('spinbutton', { name: label }));
  }

  function gridsSetIn(store: BuilderStore): GridLayout[] {
    const grids: GridLayout[] = [];
    store.subscribe((state) => grids.push(state.grid));
    return grids;
  }

  describe('with a grid in the store', () => {
    const grid: GridLayout = { rows: 3, columns: 4 };

    beforeEach(() => {
      renderWithStores(<LayoutPanel />, { initial: { grid } });
    });

    it('should render the layout heading', () => {
      expect(screen.getByRole('heading', { name: 'Layout' })).toBeInTheDocument();
    });

    it('should list Grid as the only layout', () => {
      const entries = screen.getAllByRole('listitem');

      expect(entries.length).toBe(1);
      expect(entries[0]).toHaveTextContent('Grid');
    });

    it('should render the rows input before the columns input, inside the Grid entry', () => {
      const inputs = within(screen.getByRole('listitem')).getAllByRole('spinbutton');

      expect(inputs.map((input) => input.getAttribute('aria-label'))).toEqual([
        rowsLabel,
        columnsLabel,
      ]);
    });

    it('should show the grid rows in the rows input', () => {
      expect(screen.getByRole('spinbutton', { name: rowsLabel })).toHaveValue(grid.rows);
    });

    it('should show the grid columns in the columns input', () => {
      expect(screen.getByRole('spinbutton', { name: columnsLabel })).toHaveValue(grid.columns);
    });

    it.each([rowsLabel, columnsLabel])('should limit the %s input to 1 through 12', (label) => {
      const input = screen.getByRole('spinbutton', { name: label });

      expect(input).toHaveAttribute('min', '1');
      expect(input).toHaveAttribute('max', '12');
    });
  });

  describe.each([
    { label: rowsLabel, otherLabel: columnsLabel },
    { label: columnsLabel, otherLabel: rowsLabel },
  ])('editing the $label input', ({ label, otherLabel }) => {
    beforeEach(() => {
      renderWithStores(<LayoutPanel />);
    });

    function leave(): void {
      const input = screen.getByRole('spinbutton', { name: label });
      fireEvent.change(input);
      fireEvent.blur(input);
    }

    it('should start at one', () => {
      expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(1);
    });

    it('should keep a number within range after the field is left', async () => {
      type(label, '5');
      leave();

      await waitFor(() => expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(5));
    });

    it('should not change the other input', async () => {
      type(label, '5');
      leave();

      await waitFor(() => expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(5));
      expect(screen.getByRole('spinbutton', { name: otherLabel })).toHaveValue(1);
    });

    it('should show the maximum after a larger number is typed and the field is left', async () => {
      type(label, '99');
      leave();

      await waitFor(() => expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(12));
    });

    it('should show the minimum after a smaller number is typed and the field is left', async () => {
      type(label, '0');
      leave();

      await waitFor(() => expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(1));
    });

    it('should show the whole number after a fraction is typed and the field is left', async () => {
      type(label, '2.9');
      leave();

      await waitFor(() => expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(2));
    });

    it('should show the previous value again after the field is cleared and left', async () => {
      type(label, '5');
      leave();
      type(label, '');
      leave();

      await waitFor(() => expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(5));
    });

    it('should show the maximum again when another too-large number is typed', async () => {
      type(label, '99');
      leave();
      type(label, '50');
      leave();

      await waitFor(() => expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(12));
    });

    it('should show the grid size again when the field is left without committing a rejected entry', async () => {
      type(label, '');
      fireEvent.blur(screen.getByRole('spinbutton', { name: label }));

      await waitFor(() => expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(1));
    });
  });

  describe('committing', () => {
    it.each([
      { label: rowsLabel, grid: { rows: 5, columns: 1 } },
      { label: columnsLabel, grid: { rows: 1, columns: 5 } },
    ])(
      'should set only that axis of the grid to the number committed in the $label input',
      ({ label, grid }) => {
        const { builderStore } = renderWithStores(<LayoutPanel />);
        const grids = gridsSetIn(builderStore);

        type(label, '5');
        commit(label);

        expect(grids).toEqual([grid]);
      },
    );

    it('should leave the grid unchanged while a number is typed but not yet committed', () => {
      const { builderStore } = renderWithStores(<LayoutPanel />);
      const grids = gridsSetIn(builderStore);

      type(rowsLabel, '1');
      type(rowsLabel, '12');
      type(columnsLabel, '3');

      expect(grids).toEqual([]);
      expect(builderStore.getState().grid).toEqual({ rows: 1, columns: 1 });
    });

    it('should commit only the final number, not the ones typed on the way to it', () => {
      const { builderStore } = renderWithStores(<LayoutPanel />);
      const grids = gridsSetIn(builderStore);

      type(rowsLabel, '1');
      type(rowsLabel, '12');
      commit(rowsLabel);

      expect(grids).toEqual([{ rows: 12, columns: 1 }]);
    });

    it('should keep an element in its row while a larger number that starts with a smaller one is typed', () => {
      const lastRow: TextCanvasElement = {
        uid: 'element-1',
        type: 'div',
        paletteUid: 'palette-div',
        text: 'enter text',
        row: 2,
        column: 0,
      };
      const { builderStore } = renderWithStores(<LayoutPanel />, {
        initial: { grid: { rows: 3, columns: 1 }, canvasElements: [lastRow] },
      });

      type(rowsLabel, '1');
      type(rowsLabel, '12');
      commit(rowsLabel);

      expect(builderStore.getState().canvasElements).toEqual([lastRow]);
    });
  });

  describe('typing on the keyboard', () => {
    it('should apply the typed number once Enter is pressed', async () => {
      const { builderStore } = renderWithStores(<LayoutPanel />);
      screen.getByRole('spinbutton', { name: rowsLabel }).focus();

      await userEvent.keyboard('{Control>}a{/Control}3{Enter}');

      await waitFor(() => expect(builderStore.getState().grid).toEqual({ rows: 3, columns: 1 }));
      expect(screen.getByRole('spinbutton', { name: rowsLabel })).toHaveValue(3);
    });

    it('should not apply the typed number before it is committed', async () => {
      const { builderStore } = renderWithStores(<LayoutPanel />);
      screen.getByRole('spinbutton', { name: rowsLabel }).focus();

      await userEvent.keyboard('{Control>}a{/Control}3');

      expect(screen.getByRole('spinbutton', { name: rowsLabel })).toHaveValue(3);
      expect(builderStore.getState().grid).toEqual({ rows: 1, columns: 1 });
    });

    it('should apply the typed number once focus moves on with Tab', async () => {
      const { builderStore } = renderWithStores(<LayoutPanel />);
      screen.getByRole('spinbutton', { name: rowsLabel }).focus();

      await userEvent.keyboard('{Control>}a{/Control}4{Tab}');

      await waitFor(() => expect(builderStore.getState().grid).toEqual({ rows: 4, columns: 1 }));
      expect(screen.getByRole('spinbutton', { name: columnsLabel })).toHaveFocus();
    });
  });
});
