import { CanvasElement } from './canvas-element';

export const MIN_GRID_SIZE = 1;
export const MAX_GRID_SIZE = 12;

export interface CellPosition {
  row: number;
  column: number;
}

/** One-based, the way the user counts rows and columns. */
export const cellLabel = ({ row, column }: CellPosition): string =>
  `Row ${row + 1}, column ${column + 1}`;

export interface GridLayout {
  rows: number;
  columns: number;
}

export type GridAxis = keyof GridLayout;

export interface GridCell extends CellPosition {
  elements: CanvasElement[];
}
