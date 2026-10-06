import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithStores } from '../../../../test/render-with-stores';
import { TextCanvasElement } from '../models/canvas-element';
import { GridLayout } from '../models/grid-layout';
import { Canvas } from './canvas';

describe(Canvas.name, () => {
  const dropHint = 'Drop elements here';
  const first: TextCanvasElement = {
    uid: 'element-1',
    type: 'div',
    paletteUid: 'palette-div',
    text: 'enter text',
    row: 0,
    column: 0,
  };
  const second: TextCanvasElement = { ...first, uid: 'element-2' };
  const third: TextCanvasElement = { ...first, uid: 'element-3' };

  function inCell(row: number, column: number, elements: TextCanvasElement[]): TextCanvasElement[] {
    return elements.map((element) => ({ ...element, row, column }));
  }

  function mount(grid: GridLayout, canvasElements: TextCanvasElement[] = []) {
    return renderWithStores(<Canvas />, { initial: { grid, canvasElements } });
  }

  function droppedUids(container: HTMLElement): (string | undefined)[] {
    return within(container)
      .queryAllByTestId('dropped-div')
      .map((div) => div.parentElement?.dataset['uid']);
  }

  describe('with a single cell', () => {
    const single: GridLayout = { rows: 1, columns: 1 };

    describe('with dropped elements', () => {
      beforeEach(() => {
        mount(single, inCell(0, 0, [second, first]));
      });

      it('should render one cell', () => {
        expect(screen.getAllByTestId('canvas-cell').length).toBe(1);
      });

      it('should render the elements in store order', () => {
        expect(droppedUids(screen.getByRole('group', { name: 'Row 1, column 1' }))).toEqual([
          second.uid,
          first.uid,
        ]);
      });

      it('should not render the drop hint', () => {
        expect(screen.queryByText(dropHint)).not.toBeInTheDocument();
      });
    });

    describe('without dropped elements', () => {
      beforeEach(() => {
        mount(single);
      });

      it('should render one cell', () => {
        expect(screen.getAllByTestId('canvas-cell').length).toBe(1);
      });

      it('should render the drop hint once', () => {
        expect(screen.getAllByText(dropHint).length).toBe(1);
      });

      it('should render no elements', () => {
        expect(screen.queryAllByTestId('dropped-div').length).toBe(0);
      });
    });
  });

  describe('with several cells', () => {
    const grid: GridLayout = { rows: 2, columns: 2 };
    const names = ['Row 1, column 1', 'Row 1, column 2', 'Row 2, column 1', 'Row 2, column 2'];

    describe('with dropped elements', () => {
      beforeEach(() => {
        mount(grid, [...inCell(0, 1, [second, first]), ...inCell(1, 0, [third])]);
      });

      it('should render one cell per grid position', () => {
        expect(screen.getAllByTestId('canvas-cell').length).toBe(4);
      });

      it('should name the cells by their one-based row and column, row by row', () => {
        const labels = screen
          .getAllByRole('group')
          .map((group) => group.getAttribute('aria-label'));

        expect(labels).toEqual(names);
      });

      it('should tag the cells with their zero-based row and column', () => {
        const positions = screen
          .getAllByTestId('canvas-cell')
          .map((canvasCell) => [canvasCell.dataset['row'], canvasCell.dataset['column']]);

        expect(positions).toEqual([
          ['0', '0'],
          ['0', '1'],
          ['1', '0'],
          ['1', '1'],
        ]);
      });

      it('should render each element inside its own cell, in store order', () => {
        const uids = names.map((name) => droppedUids(screen.getByRole('group', { name })));

        expect(uids).toEqual([[], [second.uid, first.uid], [third.uid], []]);
      });

      it('should render the drop hint in the empty cells only', () => {
        const hinted = names.filter((name) =>
          within(screen.getByRole('group', { name })).queryByText(dropHint),
        );

        expect(hinted).toEqual(['Row 1, column 1', 'Row 2, column 2']);
      });
    });

    describe('without dropped elements', () => {
      beforeEach(() => {
        mount(grid);
      });

      it('should render the drop hint in every cell', () => {
        expect(screen.getAllByText(dropHint).length).toBe(4);
      });

      it('should render no elements', () => {
        expect(screen.queryAllByTestId('dropped-div').length).toBe(0);
      });
    });
  });

  describe('when the store changes', () => {
    it('should render a cell per position of the new grid', async () => {
      const { builderStore } = mount({ rows: 1, columns: 1 });

      builderStore.getState().setGridSize('columns', 3);

      await waitFor(() => expect(screen.getAllByTestId('canvas-cell').length).toBe(3));
    });

    it('should render an element added to a cell in place of its drop hint', async () => {
      const { builderStore } = mount({ rows: 1, columns: 1 });
      const [divItem] = builderStore.getState().paletteItems;

      builderStore.getState().addElement(divItem, { row: 0, column: 0 }, 0);

      expect(await screen.findByTestId('dropped-div')).toBeInTheDocument();
      expect(screen.queryByText(dropHint)).not.toBeInTheDocument();
    });
  });

  describe('element positions', () => {
    const actions = 'Block text actions';
    const moveEarlier = 'Move earlier';
    const moveLater = 'Move later';

    function actionsButtonOf(uid: string): HTMLElement {
      const wrapper = screen
        .getAllByTestId('dropped-div')
        .map((div) => div.parentElement)
        .find((parent) => parent?.dataset['uid'] === uid);
      if (!wrapper) throw new Error(`No element tagged with uid ${uid}`);
      return within(wrapper).getByRole('button', { name: actions });
    }

    beforeEach(() => {
      mount({ rows: 1, columns: 2 }, [...inCell(0, 0, [first, second]), ...inCell(0, 1, [third])]);
    });

    it('should let the first element of a cell move later but not earlier', async () => {
      fireEvent.click(actionsButtonOf(first.uid));
      await screen.findByRole('menu', { name: actions });

      expect(screen.getByRole('menuitem', { name: moveEarlier })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('menuitem', { name: moveLater })).not.toHaveAttribute(
        'aria-disabled',
      );
    });

    it('should let the last element of a cell move earlier but not later', async () => {
      fireEvent.click(actionsButtonOf(second.uid));
      await screen.findByRole('menu', { name: actions });

      expect(screen.getByRole('menuitem', { name: moveLater })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('menuitem', { name: moveEarlier })).not.toHaveAttribute(
        'aria-disabled',
      );
    });

    it('should offer no reordering to an element alone in its cell', async () => {
      fireEvent.click(actionsButtonOf(third.uid));
      await screen.findByRole('menu', { name: actions });

      expect(screen.queryByRole('menuitem', { name: moveEarlier })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: moveLater })).not.toBeInTheDocument();
    });

    it('should render the elements in their new order once one is moved later', async () => {
      fireEvent.click(actionsButtonOf(first.uid));
      fireEvent.click(await screen.findByRole('menuitem', { name: moveLater }));

      await waitFor(() =>
        expect(droppedUids(screen.getByRole('group', { name: 'Row 1, column 1' }))).toEqual([
          second.uid,
          first.uid,
        ]),
      );
    });

    it('should keep the focus on an element moved within its cell', async () => {
      fireEvent.click(actionsButtonOf(first.uid));
      fireEvent.click(await screen.findByRole('menuitem', { name: moveLater }));

      await waitFor(() => expect(actionsButtonOf(first.uid)).toHaveFocus());
    });
  });

  describe('keyboard focus', () => {
    const actions = 'Block text actions';
    const leftName = 'Row 1, column 1';
    const rightName = 'Row 1, column 2';

    beforeEach(async () => {
      mount({ rows: 1, columns: 2 }, inCell(0, 0, [first]));
      fireEvent.click(screen.getByRole('button', { name: actions }));
      await screen.findByRole('menu', { name: actions });
    });

    it('should not make the cells tab stops', () => {
      const tabIndexes = screen
        .getAllByTestId('canvas-cell')
        .map((canvasCell) => canvasCell.tabIndex);

      expect(tabIndexes).toEqual([-1, -1]);
    });

    it('should follow an element moved to another cell', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Move to cell' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: rightName }));

      const right = await screen.findByRole('group', { name: rightName });

      await waitFor(() =>
        expect(within(right).getByRole('button', { name: actions })).toHaveFocus(),
      );
    });

    it('should stay on a moved element once its menus have closed', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Move to cell' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: rightName }));
      const right = await screen.findByRole('group', { name: rightName });

      await waitFor(() => expect(screen.queryAllByRole('menu').length).toBe(0));

      await waitFor(() =>
        expect(within(right).getByRole('button', { name: actions })).toHaveFocus(),
      );
    });

    it('should move to the cell an element was deleted from', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete element' }));
      await screen.findByRole('alertdialog', { name: 'Delete element' });

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.getByRole('group', { name: leftName })).toHaveFocus());
    });

    it('should stay on that cell once the confirmation has handed its focus back', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete element' }));
      await screen.findByRole('alertdialog', { name: 'Delete element' });
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

      await waitFor(() => expect(screen.getByRole('group', { name: leftName })).toHaveFocus());
    });

    it('should leave the focus on the actions button when a deletion is cancelled', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete element' }));
      await screen.findByRole('alertdialog', { name: 'Delete element' });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.getByRole('button', { name: actions })).toHaveFocus());
    });
  });
});
