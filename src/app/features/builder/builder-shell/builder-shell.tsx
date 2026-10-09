import {
  Announcements,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DropAnimation,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { JSX, useRef, useState } from 'react';
import { FactPanel } from '../../fact/fact-panel/fact-panel';
import { ThemePicker } from '../../theme/theme-picker/theme-picker';
import { Canvas } from '../canvas/canvas';
import { usePrefersReducedMotion } from '../drag-drop/drag-drop';
import { ElementPalette } from '../element-palette/element-palette';
import { LayoutPanel } from '../layout-panel/layout-panel';
import { PaletteItem } from '../models/palette-item';
import { useBuilderStore } from '../state/builder-store';
import { Dragged, DropTarget, isCanvasElement } from '../state/canvas-drop';
import './builder-shell.css';

// A press that stays put is a click, which opens the menu of a palette item or of an element.
const POINTER_SENSOR = { activationConstraint: { distance: 5 } };

/*
 * The store announces what a drop did, in the same words as the keyboard alternative. dnd-kit's own
 * messages would compete with it, and its instructions describe a keyboard sensor that is not used.
 */
const SILENT: Announcements = {
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};
const ACCESSIBILITY = { announcements: SILENT, screenReaderInstructions: { draggable: '' } };

function PaletteItemCopy({ item }: { item: PaletteItem }): JSX.Element {
  return (
    <div
      className="grid h-full cursor-grabbing grid-flow-col items-center justify-between gap-2 rounded-field border border-base-300 bg-base-100 px-3 py-1.5 text-sm shadow-lg"
      aria-hidden="true"
    >
      <span>{item.label}</span>
      <code className="text-xs text-base-content/70">&lt;{item.type}&gt;</code>
    </div>
  );
}

export function BuilderShell(): JSX.Element {
  const dropElement = useBuilderStore((state) => state.dropElement);
  const reducedMotion = usePrefersReducedMotion();
  const sensors = useSensors(useSensor(PointerSensor, POINTER_SENSOR));

  const [paletteDrag, setPaletteDrag] = useState<PaletteItem | null>(null);
  const dropAccepted = useRef(false);

  function startDrag({ active }: DragStartEvent): void {
    const dragged = active.data.current as Dragged | undefined;
    setPaletteDrag(dragged && !isCanvasElement(dragged) ? dragged : null);
  }

  function endDrag({ active, over }: DragEndEvent): void {
    dropAccepted.current = dropElement(
      active.data.current as Dragged | undefined,
      over?.data.current as DropTarget | undefined,
    );
  }

  /*
   * A palette item released over no cell slides back to the palette. One that was dropped is on the
   * canvas already, so its copy just goes: equal keyframes make dnd-kit skip the animation. The
   * palette item itself never left, hence no side effect hiding it meanwhile.
   */
  const returnToPalette: DropAnimation = {
    duration: 200,
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
    sideEffects: null,
    keyframes: ({ transform: { initial, final } }) => [
      { transform: CSS.Transform.toString(initial) },
      { transform: CSS.Transform.toString(dropAccepted.current ? initial : final) },
    ],
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      accessibility={ACCESSIBILITY}
      onDragStart={startDrag}
      onDragEnd={endDrag}
      onDragCancel={() => (dropAccepted.current = false)}
    >
      <div className="builder-shell">
        <header className="shell-header navbar min-h-14 border-b border-base-300 bg-base-100 px-4">
          <h1 className="text-lg font-semibold">DropUI</h1>
          <ThemePicker className="ml-auto" />
        </header>

        <aside
          className="shell-sidebar flex flex-col overflow-y-auto border-r border-base-300 bg-base-100"
          aria-label="Sidebar"
        >
          <LayoutPanel />
          <ElementPalette />
          <FactPanel className="mt-auto" />
        </aside>

        <main className="shell-main overflow-auto bg-base-200 p-6">
          <Canvas />
        </main>
      </div>

      {/*
       * Mounted for palette drags only: a dragged canvas element brings an overlay of its own, and
       * a drag context has room for one at a time.
       */}
      {paletteDrag && (
        <DragOverlay dropAnimation={reducedMotion ? null : returnToPalette}>
          <PaletteItemCopy item={paletteDrag} />
        </DragOverlay>
      )}
    </DndContext>
  );
}
