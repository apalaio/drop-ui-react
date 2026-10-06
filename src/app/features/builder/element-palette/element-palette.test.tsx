import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { renderWithStores } from '../../../../test/render-with-stores';
import { CanvasElement, TextCanvasElement } from '../models/canvas-element';
import { GridLayout } from '../models/grid-layout';
import { PaletteItem } from '../models/palette-item';
import { BuilderStore, selectCells } from '../state/builder-store';
import { ElementPalette } from './element-palette';

describe(ElementPalette.name, () => {
  const divItem: PaletteItem = { uid: 'palette-div', type: 'div', label: 'Div' };
  const addDiv = 'Add Div';
  const addDivTo = 'Add Div to';
  const singleCell: GridLayout = { rows: 1, columns: 1 };

  function mount(
    paletteItems: PaletteItem[],
    grid: GridLayout = singleCell,
    canvasElements: CanvasElement[] = [],
  ) {
    return renderWithStores(<ElementPalette />, {
      initial: { paletteItems, grid, canvasElements },
    });
  }

  function elementsIn(store: BuilderStore, row: number, column: number): CanvasElement[] {
    const { grid, canvasElements } = store.getState();
    const cell = selectCells(grid, canvasElements).find(
      (candidate) => candidate.row === row && candidate.column === column,
    );
    return cell?.elements ?? [];
  }

  describe('with palette items', () => {
    beforeEach(() => {
      mount([divItem, { ...divItem, uid: 'palette-div-2' }]);
    });

    it('should name the list after its heading', () => {
      expect(screen.getByRole('list', { name: 'Elements' })).toBeInTheDocument();
    });

    it('should render one list item per palette item', () => {
      expect(screen.getAllByRole('listitem').length).toBe(2);
    });

    it('should render the item label', () => {
      expect(screen.getAllByText(divItem.label).length).toBe(2);
    });

    it('should render the tag of the item type', () => {
      expect(screen.getAllByText('<div>').length).toBe(2);
    });

    it('should tag each item with its uid', () => {
      const [first, second] = screen.getAllByRole('listitem');

      expect(first).toHaveAttribute('data-uid', 'palette-div');
      expect(second).toHaveAttribute('data-uid', 'palette-div-2');
    });

    it('should render every item as a button that adds it', () => {
      expect(screen.getAllByRole('button', { name: addDiv }).length).toBe(2);
    });

    it('should not show a cell menu until an item is activated', () => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('should leave the list items plain, with the button as their only control', () => {
      const [item] = screen.getAllByRole('listitem');

      expect(item).not.toHaveAttribute('aria-roledescription');
      expect(item).not.toHaveAttribute('tabindex');
    });
  });

  describe('without palette items', () => {
    beforeEach(() => {
      mount([]);
    });

    it('should render no list items', () => {
      expect(screen.queryAllByRole('listitem').length).toBe(0);
    });
  });

  describe('with the default palette', () => {
    beforeEach(() => {
      renderWithStores(<ElementPalette />);
    });

    it('should offer every element type by its label, in palette order', () => {
      const names = screen
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'));

      expect(names).toEqual([
        'Add Block text',
        'Add Inline text',
        'Add Text input',
        'Add Textfield',
        'Add Datepicker',
        'Add Dropdown',
      ]);
    });
  });

  describe('when an item is activated', () => {
    const grid: GridLayout = { rows: 2, columns: 2 };
    let store: BuilderStore;

    beforeEach(async () => {
      store = mount([divItem], grid).builderStore;
      fireEvent.click(screen.getByRole('button', { name: addDiv }));
      await screen.findByRole('menu', { name: addDivTo });
    });

    it('should mark the item as expanded', () => {
      expect(screen.getByRole('button', { name: addDiv })).toHaveAttribute('aria-expanded', 'true');
    });

    it('should offer every cell of the grid, row by row', () => {
      const targets = screen.getAllByRole('menuitem').map((item) => item.textContent?.trim());

      expect(targets).toEqual([
        'Row 1, column 1',
        'Row 1, column 2',
        'Row 2, column 1',
        'Row 2, column 2',
      ]);
    });

    it('should close the menu once a cell is picked', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Row 2, column 1' }));

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    });

    it('should return focus to the item once a cell is picked', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Row 2, column 1' }));

      await waitFor(() => expect(screen.getByRole('button', { name: addDiv })).toHaveFocus());
    });

    it('should add the item to the picked cell and to no other', () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Row 2, column 1' }));

      expect(elementsIn(store, 1, 0)).toEqual([
        expect.objectContaining({ type: divItem.type, paletteUid: divItem.uid, row: 1, column: 0 }),
      ]);
      expect(store.getState().canvasElements.length).toBe(1);
    });

    it('should announce the added item by its label and cell', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Row 2, column 1' }));

      expect(await screen.findByText('Div added to Row 2, column 1.')).toHaveAttribute(
        'aria-live',
        'polite',
      );
    });

    it('should close the menu without adding anything on Escape', async () => {
      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      expect(store.getState().canvasElements).toEqual([]);
    });

    it('should mark the item as collapsed again once the menu has closed', async () => {
      await userEvent.keyboard('{Escape}');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: addDiv })).toHaveAttribute(
          'aria-expanded',
          'false',
        ),
      );
    });
  });

  describe('when a second item is activated while the menu of the first is open', () => {
    const spanItem: PaletteItem = { uid: 'palette-span', type: 'span', label: 'Span' };

    beforeEach(async () => {
      mount([divItem, spanItem]);
      fireEvent.click(screen.getByRole('button', { name: addDiv }));
      await screen.findByRole('menu', { name: addDivTo });
      fireEvent.click(screen.getByRole('button', { name: 'Add Span' }));
      await screen.findByRole('menu', { name: 'Add Span to' });
    });

    it('should close the menu of the first item', async () => {
      await waitFor(() =>
        expect(screen.queryByRole('menu', { name: addDivTo })).not.toBeInTheDocument(),
      );
    });

    it('should add the second item when a cell is picked', async () => {
      const spanMenu = screen.getByRole('menu', { name: 'Add Span to' });

      fireEvent.click(within(spanMenu).getByRole('menuitem', { name: 'Row 1, column 1' }));

      expect(await screen.findByText('Span added to Row 1, column 1.')).toBeInTheDocument();
    });
  });

  describe('when an item is activated from the keyboard', () => {
    beforeEach(async () => {
      mount([divItem], { rows: 1, columns: 2 });
      screen.getByRole('button', { name: addDiv }).focus();
      await userEvent.keyboard('{Enter}');
      await screen.findByRole('menu', { name: addDivTo });
    });

    it('should add the item to the focused cell on a second Enter', async () => {
      await userEvent.keyboard('{Enter}');

      expect(await screen.findByText('Div added to Row 1, column 1.')).toBeInTheDocument();
    });

    it('should focus the first cell', async () => {
      await waitFor(() =>
        expect(screen.getByRole('menuitem', { name: 'Row 1, column 1' })).toHaveFocus(),
      );
    });
  });

  describe('when keys follow straight after the one that activates an item', () => {
    let store: BuilderStore;

    beforeEach(() => {
      store = mount([divItem], { rows: 1, columns: 2 }).builderStore;
      screen.getByRole('button', { name: addDiv }).focus();
    });

    it('should add the item to the first cell when Enter is pressed twice', async () => {
      await userEvent.keyboard('{Enter}{Enter}');

      await waitFor(() => expect(elementsIn(store, 0, 0).length).toBe(1));
    });

    it('should add the item to the next cell when the down arrow comes in between', async () => {
      await userEvent.keyboard('{Enter}{ArrowDown}{Enter}');

      await waitFor(() => expect(elementsIn(store, 0, 1).length).toBe(1));
    });
  });

  describe('when an item is activated in a grid of one cell', () => {
    beforeEach(async () => {
      mount([divItem]);
      fireEvent.click(screen.getByRole('button', { name: addDiv }));
      await screen.findByRole('menu', { name: addDivTo });
    });

    it('should offer that one cell', () => {
      expect(screen.getAllByRole('menuitem').length).toBe(1);
    });
  });

  describe('when a cell that already holds elements is picked', () => {
    const existing: TextCanvasElement = {
      uid: 'element-1',
      type: 'div',
      paletteUid: 'palette-div',
      text: 'enter text',
      row: 1,
      column: 2,
    };
    const held = [existing, { ...existing, uid: 'element-2' }];

    it('should add the item after the elements the cell already holds', async () => {
      const { builderStore } = mount([divItem], { rows: 2, columns: 3 }, held);
      fireEvent.click(screen.getByRole('button', { name: addDiv }));
      await screen.findByRole('menu', { name: addDivTo });

      fireEvent.click(screen.getByRole('menuitem', { name: 'Row 2, column 3' }));

      expect(elementsIn(builderStore, 1, 2).map((element) => element.uid)).toEqual([
        'element-1',
        'element-2',
        expect.not.stringMatching(/^element-/),
      ]);
    });
  });

  describe('when an empty cell is picked', () => {
    it('should add the item as the first element of the cell', async () => {
      const { builderStore } = mount([divItem]);
      fireEvent.click(screen.getByRole('button', { name: addDiv }));
      await screen.findByRole('menu', { name: addDivTo });

      fireEvent.click(screen.getByRole('menuitem', { name: 'Row 1, column 1' }));

      expect(elementsIn(builderStore, 0, 0).length).toBe(1);
    });
  });
});
