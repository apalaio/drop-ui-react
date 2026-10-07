import { createContext, useContext, useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore, StoreApi } from 'zustand/vanilla';
import { Announce } from '../../../shared/announcer/announcer';
import { DropdownOption } from '../models/dropdown-option';
import { CanvasElement } from '../models/canvas-element';
import {
  cellLabel,
  CellPosition,
  GridAxis,
  GridCell,
  GridLayout,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
} from '../models/grid-layout';
import { ELEMENT_LABELS, PaletteItem } from '../models/palette-item';

export interface BuilderState {
  paletteItems: PaletteItem[];
  grid: GridLayout;
  canvasElements: CanvasElement[];
}

export interface BuilderActions {
  setGridSize(axis: GridAxis, size: number): void;
  addElement(item: PaletteItem, cell: CellPosition, index: number): void;
  updateText(uid: string, text: string): void;
  updateOptions(uid: string, options: DropdownOption[]): void;
  updateValue(uid: string, value: string): void;
  removeElement(uid: string): void;
  moveElement(uid: string, cell: CellPosition, index: number): void;
}

export type BuilderStore = StoreApi<BuilderState & BuilderActions>;

export const DEFAULT_ELEMENT_TEXT = 'enter text';

const createInitialState = (): BuilderState => ({
  paletteItems: [
    { uid: crypto.randomUUID(), type: 'div', label: ELEMENT_LABELS.div },
    { uid: crypto.randomUUID(), type: 'span', label: ELEMENT_LABELS.span },
    { uid: crypto.randomUUID(), type: 'text-input', label: ELEMENT_LABELS['text-input'] },
    { uid: crypto.randomUUID(), type: 'textfield', label: ELEMENT_LABELS.textfield },
    { uid: crypto.randomUUID(), type: 'datepicker', label: ELEMENT_LABELS.datepicker },
    { uid: crypto.randomUUID(), type: 'dropdown', label: ELEMENT_LABELS.dropdown },
  ],
  grid: { rows: 1, columns: 1 },
  canvasElements: [],
});

const createElement = (
  { uid: paletteUid, type }: PaletteItem,
  { row, column }: CellPosition,
): CanvasElement => {
  const base = { uid: crypto.randomUUID(), paletteUid, row, column };
  switch (type) {
    case 'div':
    case 'span':
      return { ...base, type, text: DEFAULT_ELEMENT_TEXT };
    case 'text-input':
    case 'textfield':
      return { ...base, type, text: DEFAULT_ELEMENT_TEXT, value: '' };
    case 'datepicker':
      return { ...base, type, value: '' };
    case 'dropdown':
      return { ...base, type, options: [], value: '' };
  }
};

const hasOption = (options: DropdownOption[], value: string): boolean =>
  options.some((option) => option.value === value);

const selectedValue = (options: DropdownOption[], current: string): string =>
  hasOption(options, current) ? current : (options[0]?.value ?? '');

const CELL_AXIS: Record<GridAxis, keyof CellPosition> = { rows: 'row', columns: 'column' };

const clampGridSize = (size: number): number =>
  Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, Math.trunc(size)));

const isInCell = (element: CanvasElement, { row, column }: CellPosition): boolean =>
  element.row === row && element.column === column;

const positionInCell = (elements: CanvasElement[], element: CanvasElement): number =>
  elements.filter((other) => isInCell(other, element)).indexOf(element);

const countOf = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const insertIntoCell = (
  elements: CanvasElement[],
  element: CanvasElement,
  index: number,
): CanvasElement[] => {
  const next = elements.filter((other) => isInCell(other, element))[index];
  const flatIndex = next ? elements.indexOf(next) : elements.length;
  return [...elements.slice(0, flatIndex), element, ...elements.slice(flatIndex)];
};

export const selectCells = (
  { rows, columns }: GridLayout,
  canvasElements: CanvasElement[],
): GridCell[] =>
  Array.from({ length: rows * columns }, (_, cellIndex) => {
    const cell: CellPosition = {
      row: Math.floor(cellIndex / columns),
      column: cellIndex % columns,
    };
    return { ...cell, elements: canvasElements.filter((element) => isInCell(element, cell)) };
  });

export function createBuilderStore({
  announce,
  initial,
}: {
  announce: Announce;
  initial?: Partial<BuilderState>;
}): BuilderStore {
  return createStore<BuilderState & BuilderActions>()((set, get) => ({
    ...createInitialState(),
    ...initial,
    setGridSize(axis, size) {
      if (!Number.isFinite(size)) {
        return;
      }
      const last = clampGridSize(size) - 1;
      const position = CELL_AXIS[axis];
      set(({ grid, canvasElements }) => ({
        grid: { ...grid, [axis]: last + 1 },
        canvasElements: canvasElements.map((element) =>
          element[position] > last ? { ...element, [position]: last } : element,
        ),
      }));
      const { rows, columns } = get().grid;
      announce(`Grid set to ${countOf(rows, 'row')} and ${countOf(columns, 'column')}.`);
    },
    addElement(item, cell, index) {
      const element = createElement(item, cell);
      set(({ canvasElements }) => ({
        canvasElements: insertIntoCell(canvasElements, element, index),
      }));
      announce(`${item.label} added to ${cellLabel(cell)}.`);
    },
    updateText(uid, text) {
      set(({ canvasElements }) => ({
        canvasElements: canvasElements.map((element) =>
          element.uid === uid && 'text' in element ? { ...element, text } : element,
        ),
      }));
    },
    updateOptions(uid, options) {
      set(({ canvasElements }) => ({
        canvasElements: canvasElements.map((element) =>
          element.uid === uid && element.type === 'dropdown'
            ? { ...element, options, value: selectedValue(options, element.value) }
            : element,
        ),
      }));
    },
    updateValue(uid, value) {
      set(({ canvasElements }) => ({
        canvasElements: canvasElements.map((element) => {
          if (element.uid !== uid || !('value' in element)) {
            return element;
          }
          if (element.type === 'dropdown' && !hasOption(element.options, value)) {
            return element;
          }
          return { ...element, value };
        }),
      }));
    },
    removeElement(uid) {
      const element = get().canvasElements.find((candidate) => candidate.uid === uid);
      if (!element) {
        return;
      }
      set(({ canvasElements }) => ({
        canvasElements: canvasElements.filter((candidate) => candidate !== element),
      }));
      announce(`${ELEMENT_LABELS[element.type]} deleted.`);
    },
    moveElement(uid, cell, index) {
      const element = get().canvasElements.find((candidate) => candidate.uid === uid);
      if (!element) {
        return;
      }
      const previousPosition = positionInCell(get().canvasElements, element);
      const moved: CanvasElement = { ...element, row: cell.row, column: cell.column };
      set(({ canvasElements }) => ({
        canvasElements: insertIntoCell(
          canvasElements.filter((candidate) => candidate !== element),
          moved,
          index,
        ),
      }));

      const label = ELEMENT_LABELS[element.type];
      if (!isInCell(element, cell)) {
        announce(`${label} moved to ${cellLabel(cell)}.`);
        return;
      }
      const position = positionInCell(get().canvasElements, moved);
      if (position !== previousPosition) {
        const count = get().canvasElements.filter((other) => isInCell(other, cell)).length;
        announce(`${label} moved to position ${position + 1} of ${count}.`);
      }
    },
  }));
}

export const BuilderStoreContext = createContext<BuilderStore | null>(null);

export function useBuilderStore<T>(selector: (state: BuilderState & BuilderActions) => T): T {
  const store = useContext(BuilderStoreContext);
  if (!store) {
    throw new Error('useBuilderStore needs a <BuilderStoreContext> provider above it.');
  }
  return useStore(store, selector);
}

/*
 * Derived outside the selector: a selector that builds a new array returns a different value on
 * every call, which Zustand reads as a change and renders again without end.
 */
export function useCells(): GridCell[] {
  const grid = useBuilderStore((state) => state.grid);
  const canvasElements = useBuilderStore((state) => state.canvasElements);
  return useMemo(() => selectCells(grid, canvasElements), [grid, canvasElements]);
}
