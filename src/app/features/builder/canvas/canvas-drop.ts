import { CanvasElement } from '../models/canvas-element';
import { CellPosition, GridCell } from '../models/grid-layout';
import { PaletteItem } from '../models/palette-item';

/** What a drag carries: a palette item, or an element already on the canvas. */
export type Dragged = PaletteItem | CanvasElement;

/** What a drag is released over. A palette item is never a target, so it resolves to no drop. */
export type DropTarget = GridCell | CanvasElement | PaletteItem;

export type Drop =
  | { kind: 'add'; item: PaletteItem; cell: CellPosition; index: number }
  | { kind: 'move'; uid: string; cell: CellPosition; index: number };

/** Only canvas elements carry `paletteUid`. */
export const isCanvasElement = (data: Dragged | DropTarget): data is CanvasElement =>
  'paletteUid' in data;

const isCell = (data: DropTarget): data is GridCell => 'elements' in data;

const holds = (cell: GridCell, uid: string): boolean =>
  cell.elements.some((element) => element.uid === uid);

/**
 * Turns the two ends of a finished drag into the store call to make, or `null` when it was released
 * over nothing that takes elements. Over an element the drop takes that element's place in its
 * cell; over the cell itself it goes to the end.
 */
export function resolveDrop(
  active: Dragged | null | undefined,
  over: DropTarget | null | undefined,
  cells: GridCell[],
): Drop | null {
  if (!active || !over) {
    return null;
  }

  let cell: GridCell | undefined;
  let index: number;
  if (isCell(over)) {
    cell = cells.find(({ row, column }) => row === over.row && column === over.column);
    // Counted without the dragged element, as it is taken out of the cell before it is put back.
    index = cell?.elements.filter((element) => element.uid !== active.uid).length ?? 0;
  } else if (isCanvasElement(over)) {
    cell = cells.find((candidate) => holds(candidate, over.uid));
    index = cell?.elements.findIndex((element) => element.uid === over.uid) ?? 0;
  } else {
    return null;
  }
  if (!cell) {
    return null;
  }

  const position: CellPosition = { row: cell.row, column: cell.column };
  return isCanvasElement(active)
    ? { kind: 'move', uid: active.uid, cell: position, index }
    : { kind: 'add', item: active, cell: position, index };
}
