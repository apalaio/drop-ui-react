import { Announce } from '../../../shared/announcer/announcer';
import { TextCanvasElement } from '../models/canvas-element';
import { GridCell, MAX_GRID_SIZE, MIN_GRID_SIZE } from '../models/grid-layout';
import { ElementType, PaletteItem } from '../models/palette-item';
import {
  BuilderStore,
  createBuilderStore,
  DEFAULT_ELEMENT_TEXT,
  selectCells,
} from './builder-store';

describe('BuilderStore', () => {
  const origin = { row: 0, column: 0 };
  const controlTypes = ['text-input', 'textfield', 'datepicker', 'dropdown'] as const;

  function createStore(announce: Announce = () => undefined): BuilderStore {
    return createBuilderStore({ announce });
  }

  function cellsOf(store: BuilderStore): GridCell[] {
    const { grid, canvasElements } = store.getState();
    return selectCells(grid, canvasElements);
  }

  function uidsIn(store: BuilderStore, row: number, column: number): string[] {
    const cell = cellsOf(store).find(
      (candidate) => candidate.row === row && candidate.column === column,
    );
    return (cell?.elements ?? []).map((element) => element.uid);
  }

  function addTo(store: BuilderStore, row: number, column: number): string {
    const index = uidsIn(store, row, column).length;
    store.getState().addElement(store.getState().paletteItems[0], { row, column }, index);
    return uidsIn(store, row, column)[index];
  }

  function addOfType(store: BuilderStore, type: ElementType): string {
    const item = store.getState().paletteItems.find((candidate) => candidate.type === type)!;
    const index = uidsIn(store, 0, 0).length;
    store.getState().addElement(item, origin, index);
    return uidsIn(store, 0, 0)[index];
  }

  it('provides a palette item per element type', () => {
    const store = createStore();

    expect(store.getState().paletteItems.map((item) => item.type)).toEqual([
      'div',
      'span',
      'text-input',
      'textfield',
      'datepicker',
      'dropdown',
    ]);
  });

  it('gives every palette item a unique uid', () => {
    const store = createStore();
    const uids = store.getState().paletteItems.map((item) => item.uid);

    expect(uids.every((uid) => uid.length > 0)).toBe(true);
    expect(new Set(uids).size).toBe(uids.length);
  });

  it('starts with an empty canvas', () => {
    const store = createStore();

    expect(store.getState().canvasElements).toEqual([]);
  });

  it('starts with a one by one grid', () => {
    const store = createStore();

    expect(store.getState().grid).toEqual({ rows: 1, columns: 1 });
  });

  describe('cells', () => {
    it('exposes a single empty cell for the initial grid', () => {
      const store = createStore();

      expect(cellsOf(store)).toEqual([{ row: 0, column: 0, elements: [] }]);
    });

    it('lists one cell per grid position, row by row', () => {
      const store = createStore();

      store.getState().setGridSize('rows', 2);
      store.getState().setGridSize('columns', 3);

      expect(cellsOf(store).map((cell) => [cell.row, cell.column])).toEqual([
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 0],
        [1, 1],
        [1, 2],
      ]);
    });

    it('groups the elements under the cell they sit in, in order', () => {
      const store = createStore();
      store.getState().setGridSize('rows', 2);
      store.getState().setGridSize('columns', 2);

      const first = addTo(store, 1, 0);
      const other = addTo(store, 0, 1);
      const second = addTo(store, 1, 0);

      expect(cellsOf(store).map((cell) => cell.elements.map((element) => element.uid))).toEqual([
        [],
        [other],
        [first, second],
        [],
      ]);
    });
  });

  describe.each([
    { axis: 'rows', other: 'columns' },
    { axis: 'columns', other: 'rows' },
  ] as const)('setGridSize along $axis', ({ axis, other }) => {
    function cell(along: number, across: number): [row: number, column: number] {
      return axis === 'rows' ? [along, across] : [across, along];
    }

    it(`sets the number of ${axis}, leaving the ${other} alone`, () => {
      const store = createStore();

      store.getState().setGridSize(axis, 3);

      expect(store.getState().grid).toEqual({ [axis]: 3, [other]: 1 });
    });

    it('clamps a value below the minimum', () => {
      const store = createStore();
      store.getState().setGridSize(axis, 3);

      store.getState().setGridSize(axis, 0);

      expect(store.getState().grid[axis]).toBe(MIN_GRID_SIZE);
    });

    it('clamps a negative value to the minimum', () => {
      const store = createStore();
      store.getState().setGridSize(axis, 3);

      store.getState().setGridSize(axis, -4);

      expect(store.getState().grid[axis]).toBe(MIN_GRID_SIZE);
    });

    it('clamps a value above the maximum', () => {
      const store = createStore();

      store.getState().setGridSize(axis, 99);

      expect(store.getState().grid[axis]).toBe(MAX_GRID_SIZE);
    });

    it('truncates a fractional value', () => {
      const store = createStore();

      store.getState().setGridSize(axis, 2.9);

      expect(store.getState().grid[axis]).toBe(2);
    });

    it.each([NaN, Infinity, -Infinity])('ignores %s', (size) => {
      const store = createStore();
      store.getState().setGridSize(axis, 3);

      store.getState().setGridSize(axis, size);

      expect(store.getState().grid).toEqual({ [axis]: 3, [other]: 1 });
    });

    it('keeps existing elements in their cell when growing', () => {
      const store = createStore();
      const a = addTo(store, 0, 0);
      const b = addTo(store, 0, 0);

      store.getState().setGridSize(axis, 3);

      expect(
        cellsOf(store).map((gridCell) => gridCell.elements.map((element) => element.uid)),
      ).toEqual([[a, b], [], []]);
    });

    it(`moves elements of removed ${axis} into the last remaining one, keeping their place along the ${other}`, () => {
      const store = createStore();
      store.getState().setGridSize(axis, 3);
      store.getState().setGridSize(other, 2);
      const kept = addTo(store, ...cell(0, 1));
      const moved = addTo(store, ...cell(2, 1));

      store.getState().setGridSize(axis, 2);

      expect(cellsOf(store).length).toBe(4);
      expect(uidsIn(store, ...cell(0, 1))).toEqual([kept]);
      expect(uidsIn(store, 1, 1)).toEqual([moved]);
      expect(
        store.getState().canvasElements.find((element) => element.uid === moved),
      ).toMatchObject({ row: 1, column: 1 });
    });

    it('never deletes an element when shrinking', () => {
      const store = createStore();
      store.getState().setGridSize(axis, 3);
      const uids = [
        addTo(store, ...cell(0, 0)),
        addTo(store, ...cell(1, 0)),
        addTo(store, ...cell(2, 0)),
      ];

      store.getState().setGridSize(axis, 1);

      expect(store.getState().canvasElements.length).toBe(3);
      expect([...uidsIn(store, 0, 0)].sort()).toEqual([...uids].sort());
    });

    it('keeps the relative order of elements that shared a removed cell', () => {
      const store = createStore();
      store.getState().setGridSize(axis, 2);
      addTo(store, 0, 0);
      const a = addTo(store, ...cell(1, 0));
      const b = addTo(store, ...cell(1, 0));
      const c = addTo(store, ...cell(1, 0));

      store.getState().setGridSize(axis, 1);

      const relocated = uidsIn(store, 0, 0).filter((uid) => [a, b, c].includes(uid));
      expect(relocated).toEqual([a, b, c]);
    });
  });

  describe('addElement', () => {
    it('creates a canvas element with its own uid, linked to the palette item', () => {
      const store = createStore();
      const [div] = store.getState().paletteItems;

      store.getState().addElement(div, origin, 0);

      const [element] = store.getState().canvasElements;
      expect(element.type).toBe('div');
      expect(element.paletteUid).toBe(div.uid);
      expect(element.uid).not.toBe(div.uid);
    });

    it('gives each drop of the same palette item a unique uid', () => {
      const store = createStore();
      const [div] = store.getState().paletteItems;

      store.getState().addElement(div, origin, 0);
      store.getState().addElement(div, origin, 1);

      const [first, second] = store.getState().canvasElements;
      expect(first.uid).not.toBe(second.uid);
    });

    it('inserts at the drop index, keeping the order of existing elements', () => {
      const store = createStore();
      const [div] = store.getState().paletteItems;

      store.getState().addElement(div, origin, 0);
      store.getState().addElement(div, origin, 1);
      const [first, last] = uidsIn(store, 0, 0);

      store.getState().addElement(div, origin, 1);
      const [, middle] = uidsIn(store, 0, 0);

      expect(uidsIn(store, 0, 0)).toEqual([first, middle, last]);
    });

    it.each(['div', 'span', 'text-input', 'textfield'] as const)(
      'starts a %s with the default text',
      (type) => {
        const store = createStore();

        addOfType(store, type);

        expect(store.getState().canvasElements).toEqual([
          expect.objectContaining({ type, text: DEFAULT_ELEMENT_TEXT }),
        ]);
        expect(store.getState().canvasElements[0]).not.toHaveProperty('options');
      },
    );

    it.each(['div', 'span'] as const)('starts a %s without a value', (type) => {
      const store = createStore();

      addOfType(store, type);

      expect(store.getState().canvasElements[0]).not.toHaveProperty('value');
    });

    it.each(controlTypes)('starts a %s with an empty value', (type) => {
      const store = createStore();

      addOfType(store, type);

      expect(store.getState().canvasElements[0]).toMatchObject({ type, value: '' });
    });

    it('starts a datepicker with neither text nor options', () => {
      const store = createStore();

      addOfType(store, 'datepicker');

      expect(store.getState().canvasElements[0]).toMatchObject({ type: 'datepicker' });
      expect(store.getState().canvasElements[0]).not.toHaveProperty('text');
      expect(store.getState().canvasElements[0]).not.toHaveProperty('options');
    });

    it('starts a dropdown with an empty list of options and no text', () => {
      const store = createStore();

      addOfType(store, 'dropdown');

      expect(store.getState().canvasElements[0]).toMatchObject({ type: 'dropdown', options: [] });
      expect(store.getState().canvasElements[0]).not.toHaveProperty('text');
    });

    it('places the element in the cell it was dropped in', () => {
      const store = createStore();
      store.getState().setGridSize('rows', 2);
      store.getState().setGridSize('columns', 2);

      store.getState().addElement(store.getState().paletteItems[0], { row: 1, column: 0 }, 0);

      const [element] = store.getState().canvasElements;
      expect(element).toMatchObject({ row: 1, column: 0 });
      expect(cellsOf(store).map((cell) => cell.elements.length)).toEqual([0, 0, 1, 0]);
    });

    it('counts the drop index among the elements of the target cell only', () => {
      const store = createStore();
      const [div] = store.getState().paletteItems;
      store.getState().setGridSize('columns', 2);
      const [left1, left2] = [addTo(store, 0, 0), addTo(store, 0, 0)];
      const [right1, right2] = [addTo(store, 0, 1), addTo(store, 0, 1)];

      store.getState().addElement(div, { row: 0, column: 1 }, 1);
      const [, inserted] = uidsIn(store, 0, 1);

      expect(uidsIn(store, 0, 0)).toEqual([left1, left2]);
      expect(uidsIn(store, 0, 1)).toEqual([right1, inserted, right2]);
    });
  });

  describe('updateText', () => {
    it('changes the text of the matching element only', () => {
      const store = createStore();
      const [div] = store.getState().paletteItems;
      store.getState().addElement(div, origin, 0);
      store.getState().addElement(div, origin, 1);
      const [first, second] = cellsOf(store)[0].elements;

      store.getState().updateText(second.uid, 'Hello');

      expect(cellsOf(store)[0].elements).toEqual([first, { ...second, text: 'Hello' }]);
    });

    it.each(['datepicker', 'dropdown'] as const)(
      'leaves a %s, which has no text, as it was',
      (type) => {
        const store = createStore();
        const uid = addOfType(store, type);
        const before = store.getState().canvasElements;

        store.getState().updateText(uid, 'Hello');

        expect(store.getState().canvasElements).toEqual(before);
      },
    );
  });

  describe('updateOptions', () => {
    const options = [
      { text: 'Small', value: 's' },
      { text: 'Large', value: 'l' },
    ];

    it('changes the options of the matching element only', () => {
      const store = createStore();
      const [first, second] = [addOfType(store, 'dropdown'), addOfType(store, 'dropdown')];

      store.getState().updateOptions(second, options);

      expect(store.getState().canvasElements).toEqual([
        expect.objectContaining({ uid: first, options: [] }),
        expect.objectContaining({ uid: second, options }),
      ]);
    });

    it('replaces the options saved earlier', () => {
      const store = createStore();
      const uid = addOfType(store, 'dropdown');
      store.getState().updateOptions(uid, options);

      store.getState().updateOptions(uid, [options[1]]);

      expect(store.getState().canvasElements[0]).toMatchObject({ options: [options[1]] });
    });

    it.each(['div', 'datepicker'] as const)(
      'leaves a %s, which is not a dropdown, as it was',
      (type) => {
        const store = createStore();
        const uid = addOfType(store, type);
        const before = store.getState().canvasElements;

        store.getState().updateOptions(uid, options);

        expect(store.getState().canvasElements).toEqual(before);
      },
    );

    it('keeps the options of a dropdown moved to another cell', () => {
      const store = createStore();
      store.getState().setGridSize('columns', 2);
      const uid = addOfType(store, 'dropdown');
      store.getState().updateOptions(uid, options);

      store.getState().moveElement(uid, { row: 0, column: 1 }, 0);

      expect(store.getState().canvasElements).toEqual([
        expect.objectContaining({ uid, options, row: 0, column: 1 }),
      ]);
    });

    it('selects the first option when options are first saved', () => {
      const store = createStore();
      const uid = addOfType(store, 'dropdown');

      store.getState().updateOptions(uid, options);

      expect(store.getState().canvasElements[0]).toMatchObject({ value: 's' });
    });

    it('keeps the selected option when it is still among the saved options', () => {
      const store = createStore();
      const uid = addOfType(store, 'dropdown');
      store.getState().updateOptions(uid, options);
      store.getState().updateValue(uid, 'l');

      store.getState().updateOptions(uid, [{ text: 'Medium', value: 'm' }, options[1]]);

      expect(store.getState().canvasElements[0]).toMatchObject({ value: 'l' });
    });

    it('selects the first option when the selected one is no longer among the saved options', () => {
      const store = createStore();
      const uid = addOfType(store, 'dropdown');
      store.getState().updateOptions(uid, options);
      store.getState().updateValue(uid, 'l');

      store.getState().updateOptions(uid, [{ text: 'Medium', value: 'm' }, options[0]]);

      expect(store.getState().canvasElements[0]).toMatchObject({ value: 'm' });
    });

    it('clears the selection when no option is left', () => {
      const store = createStore();
      const uid = addOfType(store, 'dropdown');
      store.getState().updateOptions(uid, options);

      store.getState().updateOptions(uid, []);

      expect(store.getState().canvasElements[0]).toMatchObject({ value: '' });
    });
  });

  describe('updateValue', () => {
    const options = [
      { text: 'Small', value: 's' },
      { text: 'Large', value: 'l' },
    ];

    it.each([
      { type: 'text-input', value: 'Ada' },
      { type: 'textfield', value: 'Two\nlines' },
      { type: 'datepicker', value: '2026-10-05' },
    ] as const)('changes the value of the matching $type only', ({ type, value }) => {
      const store = createStore();
      const [first, second] = [addOfType(store, type), addOfType(store, type)];

      store.getState().updateValue(second, value);

      expect(store.getState().canvasElements).toEqual([
        expect.objectContaining({ uid: first, value: '' }),
        expect.objectContaining({ uid: second, value }),
      ]);
    });

    it('selects an option of the matching dropdown only', () => {
      const store = createStore();
      const [first, second] = [addOfType(store, 'dropdown'), addOfType(store, 'dropdown')];
      store.getState().updateOptions(first, options);
      store.getState().updateOptions(second, options);

      store.getState().updateValue(second, 'l');

      expect(store.getState().canvasElements).toEqual([
        expect.objectContaining({ uid: first, value: 's' }),
        expect.objectContaining({ uid: second, value: 'l' }),
      ]);
    });

    it('leaves a dropdown as it was for a value none of its options has', () => {
      const store = createStore();
      const uid = addOfType(store, 'dropdown');
      store.getState().updateOptions(uid, options);
      const before = store.getState().canvasElements;

      store.getState().updateValue(uid, 'xl');

      expect(store.getState().canvasElements).toEqual(before);
    });

    it.each(['div', 'span'] as const)('leaves a %s, which has no value, as it was', (type) => {
      const store = createStore();
      const uid = addOfType(store, type);
      const before = store.getState().canvasElements;

      store.getState().updateValue(uid, 'Ada');

      expect(store.getState().canvasElements).toEqual(before);
    });

    it('keeps the value of a control moved to another cell', () => {
      const store = createStore();
      store.getState().setGridSize('columns', 2);
      const uid = addOfType(store, 'text-input');
      store.getState().updateValue(uid, 'Ada');

      store.getState().moveElement(uid, { row: 0, column: 1 }, 0);

      expect(store.getState().canvasElements).toEqual([
        expect.objectContaining({ uid, value: 'Ada', row: 0, column: 1 }),
      ]);
    });

    it('keeps the value of a control whose cell is removed when the grid shrinks', () => {
      const store = createStore();
      store.getState().setGridSize('columns', 2);
      const uid = addOfType(store, 'datepicker');
      store.getState().moveElement(uid, { row: 0, column: 1 }, 0);
      store.getState().updateValue(uid, '2026-10-05');

      store.getState().setGridSize('columns', 1);

      expect(store.getState().canvasElements).toEqual([
        expect.objectContaining({ uid, value: '2026-10-05', row: 0, column: 0 }),
      ]);
    });
  });

  describe('removeElement', () => {
    it('removes the matching element only, keeping the order of the rest', () => {
      const store = createStore();
      const [a, b, c] = [addTo(store, 0, 0), addTo(store, 0, 0), addTo(store, 0, 0)];

      store.getState().removeElement(b);

      expect(uidsIn(store, 0, 0)).toEqual([a, c]);
    });
  });

  describe('moveElement', () => {
    it('moves an element down within its cell', () => {
      const store = createStore();
      const [a, b, c] = [addTo(store, 0, 0), addTo(store, 0, 0), addTo(store, 0, 0)];

      store.getState().moveElement(a, origin, 2);

      expect(uidsIn(store, 0, 0)).toEqual([b, c, a]);
    });

    it('moves an element up within its cell', () => {
      const store = createStore();
      const [a, b, c] = [addTo(store, 0, 0), addTo(store, 0, 0), addTo(store, 0, 0)];

      store.getState().moveElement(c, origin, 1);

      expect(uidsIn(store, 0, 0)).toEqual([a, c, b]);
    });

    it('leaves the other cells untouched when reordering within a cell', () => {
      const store = createStore();
      store.getState().setGridSize('columns', 2);
      const [left1, left2] = [addTo(store, 0, 0), addTo(store, 0, 0)];
      const [right1, right2] = [addTo(store, 0, 1), addTo(store, 0, 1)];

      store.getState().moveElement(right1, { row: 0, column: 1 }, 1);

      expect(uidsIn(store, 0, 0)).toEqual([left1, left2]);
      expect(uidsIn(store, 0, 1)).toEqual([right2, right1]);
    });

    it('moves an element into another cell at the drop index', () => {
      const store = createStore();
      store.getState().setGridSize('columns', 2);
      const [left1, left2] = [addTo(store, 0, 0), addTo(store, 0, 0)];
      const [right1, right2] = [addTo(store, 0, 1), addTo(store, 0, 1)];

      store.getState().moveElement(left1, { row: 0, column: 1 }, 1);

      expect(uidsIn(store, 0, 0)).toEqual([left2]);
      expect(uidsIn(store, 0, 1)).toEqual([right1, left1, right2]);
    });

    it('moves an element into an empty cell', () => {
      const store = createStore();
      store.getState().setGridSize('rows', 2);
      store.getState().setGridSize('columns', 2);
      const [a, b] = [addTo(store, 0, 0), addTo(store, 0, 0)];

      store.getState().moveElement(b, { row: 1, column: 1 }, 0);

      expect(uidsIn(store, 0, 0)).toEqual([a]);
      expect(uidsIn(store, 1, 1)).toEqual([b]);
      expect(store.getState().canvasElements.find((element) => element.uid === b)).toMatchObject({
        row: 1,
        column: 1,
      });
    });

    it('keeps the uid and text of an element moved to another cell', () => {
      const store = createStore();
      store.getState().setGridSize('columns', 2);
      const uid = addTo(store, 0, 0);
      store.getState().updateText(uid, 'Hello');

      store.getState().moveElement(uid, { row: 0, column: 1 }, 0);

      expect(store.getState().canvasElements).toEqual([
        expect.objectContaining({ uid, text: 'Hello', row: 0, column: 1 }),
      ]);
    });

    it('does nothing for an unknown uid', () => {
      const store = createStore();
      store.getState().setGridSize('columns', 2);
      const [a, b] = [addTo(store, 0, 0), addTo(store, 0, 0)];
      const c = addTo(store, 0, 1);

      store.getState().moveElement('no-such-element', { row: 0, column: 1 }, 0);

      expect(store.getState().canvasElements.length).toBe(3);
      expect(uidsIn(store, 0, 0)).toEqual([a, b]);
      expect(uidsIn(store, 0, 1)).toEqual([c]);
    });
  });

  describe('preset state', () => {
    const preset: TextCanvasElement = {
      uid: 'element-1',
      type: 'div',
      paletteUid: 'palette-div',
      text: 'Hello',
      row: 1,
      column: 0,
    };

    it('starts from the grid and elements it is given', () => {
      const store = createBuilderStore({
        announce: () => undefined,
        initial: { grid: { rows: 2, columns: 1 }, canvasElements: [preset] },
      });

      expect(store.getState().grid).toEqual({ rows: 2, columns: 1 });
      expect(cellsOf(store)).toEqual([
        { row: 0, column: 0, elements: [] },
        { row: 1, column: 0, elements: [preset] },
      ]);
    });

    it('keeps the default palette when the preset names none', () => {
      const store = createBuilderStore({
        announce: () => undefined,
        initial: { canvasElements: [preset] },
      });

      expect(store.getState().paletteItems.map((item) => item.type)).toEqual(
        createStore()
          .getState()
          .paletteItems.map((item) => item.type),
      );
    });

    it('starts from the palette it is given', () => {
      const paletteItems: PaletteItem[] = [{ uid: 'palette-div', type: 'div', label: 'Div' }];

      const store = createBuilderStore({ announce: () => undefined, initial: { paletteItems } });

      expect(store.getState().paletteItems).toEqual(paletteItems);
    });

    it('announces nothing on its own', () => {
      const announce = vi.fn<Announce>();

      createBuilderStore({ announce, initial: { canvasElements: [preset] } });

      expect(announce).not.toHaveBeenCalled();
    });
  });

  describe('announcements', () => {
    let announce: ReturnType<typeof vi.fn<Announce>>;
    let store: BuilderStore;

    beforeEach(() => {
      announce = vi.fn<Announce>();
      store = createStore(announce);
    });

    it('announces an added element by its palette label and cell', () => {
      store.getState().setGridSize('columns', 2);

      store.getState().addElement(store.getState().paletteItems[0], { row: 0, column: 1 }, 0);

      expect(announce).toHaveBeenLastCalledWith('Block text added to Row 1, column 2.');
    });

    it('announces the cell an element was moved to', () => {
      store.getState().setGridSize('rows', 2);
      const uid = addOfType(store, 'dropdown');

      store.getState().moveElement(uid, { row: 1, column: 0 }, 0);

      expect(announce).toHaveBeenLastCalledWith('Dropdown moved to Row 2, column 1.');
    });

    it('announces the new position of an element reordered within its cell', () => {
      const [first] = [addTo(store, 0, 0), addTo(store, 0, 0), addTo(store, 0, 0)];

      store.getState().moveElement(first, origin, 1);

      expect(announce).toHaveBeenLastCalledWith('Block text moved to position 2 of 3.');
    });

    it('stays silent when an element is dropped back where it was', () => {
      const [first] = [addTo(store, 0, 0), addTo(store, 0, 0)];
      announce.mockClear();

      store.getState().moveElement(first, origin, 0);

      expect(announce).not.toHaveBeenCalled();
    });

    it('stays silent when asked to move an unknown element', () => {
      store.getState().moveElement('no-such-element', origin, 0);

      expect(announce).not.toHaveBeenCalled();
    });

    it('announces a deleted element by its label', () => {
      const uid = addOfType(store, 'text-input');

      store.getState().removeElement(uid);

      expect(announce).toHaveBeenLastCalledWith('Text input deleted.');
    });

    it('stays silent when asked to delete an unknown element', () => {
      store.getState().removeElement('no-such-element');

      expect(announce).not.toHaveBeenCalled();
    });

    it('announces the grid size that took effect, which may not be the one asked for', () => {
      store.getState().setGridSize('rows', 99);

      expect(announce).toHaveBeenLastCalledWith(`Grid set to ${MAX_GRID_SIZE} rows and 1 column.`);
    });

    it('stays silent when the grid size is not a number', () => {
      store.getState().setGridSize('rows', NaN);

      expect(announce).not.toHaveBeenCalled();
    });
  });
});
