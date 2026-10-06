import { PointerEvent, useSyncExternalStore } from 'react';
import { CellPosition } from '../models/grid-layout';
import { PaletteItem } from '../models/palette-item';

/** Spread on everything inside a draggable that must stay usable: a press there never starts a drag. */
export const noDrag = {
  onPointerDown: (event: PointerEvent): void => event.stopPropagation(),
};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

const subscribeToReducedMotion = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

export const paletteDragId = (item: PaletteItem): string => `palette:${item.uid}`;

export const cellDropId = ({ row, column }: CellPosition): string => `cell:${row}:${column}`;
