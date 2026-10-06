import { CanvasElement, TextCanvasElement } from '../models/canvas-element';
import { GridCell } from '../models/grid-layout';
import { PaletteItem } from '../models/palette-item';
import { createBuilderStore, selectCells } from '../state/builder-store';
import { resolveDrop } from './canvas-drop';

describe('resolveDrop', () => {
  const divItem: PaletteItem = { uid: 'palette-div', type: 'div', label: 'Div' };
  const spanItem: PaletteItem = { uid: 'palette-span', type: 'span', label: 'Span' };

  function element(uid: string, row: number, column: number): TextCanvasElement {
    return { uid, type: 'div', paletteUid: divItem.uid, text: 'enter text', row, column };
  }

  const a = element('a', 0, 0);
  const b = element('b', 0, 0);
  const c = element('c', 0, 0);
  const x = element('x', 1, 1);
  const y = element('y', 1, 1);
  const canvasElements: CanvasElement[] = [a, x, b, y, c];
  const cells = selectCells({ rows: 2, columns: 2 }, canvasElements);

  function cellAt(row: number, column: number): GridCell {
    const cell = cells.find((candidate) => candidate.row === row && candidate.column === column);
    if (!cell) throw new Error(`No cell at row ${row}, column ${column}`);
    return cell;
  }

  describe('a palette item', () => {
    it('is added to the end of the cell it is dropped on', () => {
      expect(resolveDrop(divItem, cellAt(1, 1), cells)).toEqual({
        kind: 'add',
        item: divItem,
        cell: { row: 1, column: 1 },
        index: 2,
      });
    });

    it('is added as the first element of an empty cell', () => {
      expect(resolveDrop(divItem, cellAt(0, 1), cells)).toEqual({
        kind: 'add',
        item: divItem,
        cell: { row: 0, column: 1 },
        index: 0,
      });
    });

    it('takes the place of the element it is dropped on, in that element cell', () => {
      expect(resolveDrop(spanItem, b, cells)).toEqual({
        kind: 'add',
        item: spanItem,
        cell: { row: 0, column: 0 },
        index: 1,
      });
    });

    it('is never moved, as only canvas elements can be', () => {
      expect(resolveDrop(divItem, y, cells)).toMatchObject({ kind: 'add', index: 1 });
    });
  });

  describe('an element dragged within its cell', () => {
    it('takes the place of a later element it is dropped on', () => {
      expect(resolveDrop(a, c, cells)).toEqual({
        kind: 'move',
        uid: a.uid,
        cell: { row: 0, column: 0 },
        index: 2,
      });
    });

    it('takes the place of an earlier element it is dropped on', () => {
      expect(resolveDrop(c, a, cells)).toEqual({
        kind: 'move',
        uid: c.uid,
        cell: { row: 0, column: 0 },
        index: 0,
      });
    });

    it('goes to the end when dropped on the cell itself, counted without the element', () => {
      expect(resolveDrop(a, cellAt(0, 0), cells)).toEqual({
        kind: 'move',
        uid: a.uid,
        cell: { row: 0, column: 0 },
        index: 2,
      });
    });

    it('keeps its place when dropped on itself', () => {
      expect(resolveDrop(b, b, cells)).toEqual({
        kind: 'move',
        uid: b.uid,
        cell: { row: 0, column: 0 },
        index: 1,
      });
    });
  });

  describe('an element dragged into another cell', () => {
    it('takes the place of the element it is dropped on', () => {
      expect(resolveDrop(a, y, cells)).toEqual({
        kind: 'move',
        uid: a.uid,
        cell: { row: 1, column: 1 },
        index: 1,
      });
    });

    it('goes to the end of the cell it is dropped on', () => {
      expect(resolveDrop(a, cellAt(1, 1), cells)).toEqual({
        kind: 'move',
        uid: a.uid,
        cell: { row: 1, column: 1 },
        index: 2,
      });
    });

    it('becomes the first element of an empty cell', () => {
      expect(resolveDrop(x, cellAt(1, 0), cells)).toEqual({
        kind: 'move',
        uid: x.uid,
        cell: { row: 1, column: 0 },
        index: 0,
      });
    });

    it('is never added again, whatever it is dropped on', () => {
      expect(resolveDrop(a, cellAt(0, 1), cells)).not.toHaveProperty('item');
    });
  });

  describe('the cell of a drop', () => {
    it('is a bare position, without the elements of the cell it was read from', () => {
      const drop = resolveDrop(divItem, cellAt(1, 1), cells);

      expect(drop?.cell).toEqual({ row: 1, column: 1 });
      expect(drop?.cell).not.toHaveProperty('elements');
    });

    it('is read from the current cells, not from the cell the drag saw', () => {
      const stale: GridCell = { row: 1, column: 1, elements: [] };

      expect(resolveDrop(divItem, stale, cells)).toMatchObject({
        cell: { row: 1, column: 1 },
        index: 2,
      });
    });
  });

  describe('nothing to do', () => {
    it('lets nothing be dropped onto the palette', () => {
      expect(resolveDrop(a, spanItem, cells)).toBeNull();
      expect(resolveDrop(divItem, spanItem, cells)).toBeNull();
    });

    it.each([null, undefined])('resolves a drag released over %s to no drop', (over) => {
      expect(resolveDrop(a, over, cells)).toBeNull();
      expect(resolveDrop(divItem, over, cells)).toBeNull();
    });

    it.each([null, undefined])('resolves a drop of %s to no drop', (active) => {
      expect(resolveDrop(active, cellAt(0, 0), cells)).toBeNull();
    });

    it('resolves a drop on a cell the grid no longer has to no drop', () => {
      expect(resolveDrop(divItem, { row: 5, column: 5, elements: [] }, cells)).toBeNull();
    });

    it('resolves a drop on an element the canvas no longer has to no drop', () => {
      expect(resolveDrop(divItem, element('gone', 0, 0), cells)).toBeNull();
    });
  });

  describe('applied to the store', () => {
    function orderAfter(
      active: CanvasElement | PaletteItem,
      over: CanvasElement | GridCell,
    ): string[][] {
      const store = createBuilderStore({
        announce: () => undefined,
        initial: { grid: { rows: 2, columns: 2 }, canvasElements },
      });
      const drop = resolveDrop(active, over, cells);
      if (drop?.kind === 'move') {
        store.getState().moveElement(drop.uid, drop.cell, drop.index);
      } else if (drop?.kind === 'add') {
        store.getState().addElement(drop.item, drop.cell, drop.index);
      }
      const { grid, canvasElements: after } = store.getState();
      return selectCells(grid, after).map((cell) =>
        cell.elements.map((one) => (one.uid.length > 1 ? 'new' : one.uid)),
      );
    }

    it('puts an element dropped on a later one right after the ones it passed', () => {
      expect(orderAfter(a, c)).toEqual([['b', 'c', 'a'], [], [], ['x', 'y']]);
    });

    it('puts an element dropped on the one after it behind that one', () => {
      expect(orderAfter(a, b)).toEqual([['b', 'a', 'c'], [], [], ['x', 'y']]);
    });

    it('puts an element dropped on an earlier one in front of it', () => {
      expect(orderAfter(c, a)).toEqual([['c', 'a', 'b'], [], [], ['x', 'y']]);
    });

    it('puts an element dropped on its own cell last', () => {
      expect(orderAfter(a, cellAt(0, 0))).toEqual([['b', 'c', 'a'], [], [], ['x', 'y']]);
    });

    it('leaves the order alone for an element dropped on itself', () => {
      expect(orderAfter(b, b)).toEqual([['a', 'b', 'c'], [], [], ['x', 'y']]);
    });

    it('puts an element dropped on one in another cell in front of that one', () => {
      expect(orderAfter(a, y)).toEqual([['b', 'c'], [], [], ['x', 'a', 'y']]);
    });

    it('puts a palette item dropped on a cell after the elements the cell holds', () => {
      expect(orderAfter(divItem, cellAt(1, 1))).toEqual([
        ['a', 'b', 'c'],
        [],
        [],
        ['x', 'y', 'new'],
      ]);
    });

    it('puts a palette item dropped on an element in front of it', () => {
      expect(orderAfter(divItem, b)).toEqual([['a', 'new', 'b', 'c'], [], [], ['x', 'y']]);
    });
  });
});
