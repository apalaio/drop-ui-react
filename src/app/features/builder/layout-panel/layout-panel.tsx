import { useEffect, useReducer, useRef } from 'react';
import { GridAxis, MAX_GRID_SIZE, MIN_GRID_SIZE } from '../models/grid-layout';
import { useBuilderStore } from '../state/builder-store';

function GridSizeInput({ axis, label }: { axis: GridAxis; label: string }) {
  const size = useBuilderStore((state) => state.grid[axis]);
  const setGridSize = useBuilderStore((state) => state.setGridSize);
  const input = useRef<HTMLInputElement>(null);
  const [shown, show] = useReducer((count: number) => count + 1, 0);

  /*
   * Committed on the native change event rather than React's onChange, which fires per keystroke:
   * typing "12" passes through "1", which would shrink the grid and pull every element into the
   * first row before it grows again.
   */
  useEffect(() => {
    const element = input.current;
    if (!element) {
      return;
    }
    const commit = (): void => {
      setGridSize(axis, element.valueAsNumber);
      show();
    };
    element.addEventListener('change', commit);
    return () => element.removeEventListener('change', commit);
  }, [axis, setGridSize]);

  /*
   * An entry the store rejected or clamped can leave the store's value as it was, in which case
   * nothing renders and the field would keep what was typed. `shown` writes it back all the same.
   */
  useEffect(() => {
    if (input.current) {
      input.current.value = String(size);
    }
  }, [size, shown]);

  return (
    <input
      ref={input}
      type="number"
      className="input input-xs w-12 text-base-content"
      aria-label={label}
      min={MIN_GRID_SIZE}
      max={MAX_GRID_SIZE}
      defaultValue={size}
      onBlur={show}
    />
  );
}

export function LayoutPanel() {
  return (
    <div className="px-4 pt-4">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-base-content/70 uppercase">
        Layout
      </h2>

      <ul className="flex w-full flex-col gap-1">
        <li className="flex items-center justify-between gap-2 rounded-field border border-base-300 bg-base-100 px-3 py-1.5 text-sm">
          <span>Grid</span>
          {/* The × is generated content, so the entry's text stays just "Grid". */}
          <span className="flex items-center gap-1 text-xs text-base-content/70">
            <GridSizeInput axis="rows" label="Grid rows" />
            <span className="before:content-['×']" aria-hidden="true" />
            <GridSizeInput axis="columns" label="Grid columns" />
          </span>
        </li>
      </ul>
    </div>
  );
}
