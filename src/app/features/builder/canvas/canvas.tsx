import { useDroppable } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { JSX, useCallback, useEffect, useRef, useState } from 'react';
import { cellDropId } from '../drag-drop/drag-drop';
import { DroppedElement } from '../dropped-element/dropped-element';
import { cellLabel, GridCell } from '../models/grid-layout';
import { useBuilderStore, useCells } from '../state/builder-store';

const equalTracks = (count: number): string => `repeat(${count}, minmax(0, 1fr))`;

const DROP_ZONE =
  'canvas-drop-zone -mt-0.5 -ml-0.5 min-h-24 border-2 border-dashed p-6 transition-colors motion-reduce:transition-none';

const DROP_ZONE_STATE = {
  idle: 'border-base-300 bg-base-100',
  receiving: 'border-primary/50 bg-base-100',
  hovered: 'z-10 border-primary bg-primary/5',
};

interface PendingFocus {
  on: 'actions-button' | 'cell';
  key: string;
}

type Register<T extends HTMLElement> = (key: string, node: T | null) => void;

interface CanvasCellProps {
  cell: GridCell;
  registerCell: Register<HTMLDivElement>;
  registerActionsButton: Register<HTMLButtonElement>;
  onFocusRequested: (focus: PendingFocus) => void;
}

function CanvasCell({
  cell,
  registerCell,
  registerActionsButton,
  onFocusRequested,
}: CanvasCellProps): JSX.Element {
  const id = cellDropId(cell);
  const { setNodeRef, active, over } = useDroppable({ id, data: cell });
  const cellRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      registerCell(id, node);
    },
    [id, setNodeRef, registerCell],
  );

  const uids = cell.elements.map((element) => element.uid);
  const hovered = over !== null && (over.id === id || uids.includes(String(over.id)));
  const state = !active ? 'idle' : hovered ? 'hovered' : 'receiving';
  // A column only while empty, to centre the hint.
  const layout = uids.length ? '' : ' flex flex-col';

  return (
    <div
      ref={cellRef}
      className={`${DROP_ZONE} ${DROP_ZONE_STATE[state]}${layout}`}
      role="group"
      tabIndex={-1}
      data-testid="canvas-cell"
      aria-label={cellLabel(cell)}
      data-row={cell.row}
      data-column={cell.column}
    >
      <SortableContext items={uids} strategy={rectSortingStrategy}>
        {cell.elements.map((element, index) => (
          <DroppedElement
            key={element.uid}
            element={element}
            index={index}
            siblingCount={uids.length}
            onMoved={() => onFocusRequested({ on: 'actions-button', key: element.uid })}
            onRemoved={() => onFocusRequested({ on: 'cell', key: id })}
            actionsButtonRef={(node) => registerActionsButton(element.uid, node)}
          />
        ))}
      </SortableContext>
      {uids.length === 0 && (
        <p className="m-auto text-sm text-base-content/70">Drop elements here</p>
      )}
    </div>
  );
}

export function Canvas(): JSX.Element {
  const grid = useBuilderStore((state) => state.grid);
  const cells = useCells();

  const cellNodes = useRef(new Map<string, HTMLDivElement>());
  const actionsButtons = useRef(new Map<string, HTMLButtonElement>());
  const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);

  const registerCell = useCallback<Register<HTMLDivElement>>((key, node) => {
    if (node) {
      cellNodes.current.set(key, node);
    } else {
      cellNodes.current.delete(key);
    }
  }, []);

  const registerActionsButton = useCallback<Register<HTMLButtonElement>>((key, node) => {
    if (node) {
      actionsButtons.current.set(key, node);
    } else {
      actionsButtons.current.delete(key);
    }
  }, []);

  /*
   * An element moved from its own menu is rendered anew in its new place, and a deleted one takes
   * the focus with it; either way the keyboard focus drops to <body>. It follows a moved element to
   * its actions button, and goes to the cell a deleted one was in, the nearest thing left. Placed
   * in an effect because the target is only there, or only free of the closing menu or dialog, once
   * the change has rendered.
   */
  useEffect(() => {
    if (pendingFocus) {
      const nodes = pendingFocus.on === 'cell' ? cellNodes : actionsButtons;
      nodes.current.get(pendingFocus.key)?.focus();
    }
  }, [pendingFocus]);

  return (
    <div className="h-full">
      <section
        className="grid min-h-full pt-0.5 pl-0.5"
        aria-label="Canvas"
        style={{
          gridTemplateRows: equalTracks(grid.rows),
          gridTemplateColumns: equalTracks(grid.columns),
        }}
      >
        {cells.map((cell) => (
          <CanvasCell
            key={cellDropId(cell)}
            cell={cell}
            registerCell={registerCell}
            registerActionsButton={registerActionsButton}
            onFocusRequested={setPendingFocus}
          />
        ))}
      </section>
    </div>
  );
}
