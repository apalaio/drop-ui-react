import { Menu } from '@base-ui/react/menu';
import { useDndMonitor, useDraggable } from '@dnd-kit/core';
import { useState } from 'react';
import { useFirstItemFocus } from '../../../shared/menu-first-item-focus';
import { paletteDragId } from '../drag-drop/drag-drop';
import { cellLabel, GridCell } from '../models/grid-layout';
import { PaletteItem } from '../models/palette-item';
import { useBuilderStore, useCells } from '../state/builder-store';

interface PaletteEntryProps {
  item: PaletteItem;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}

function PaletteEntry({ item, menuOpen, onMenuOpenChange }: PaletteEntryProps) {
  const addElement = useBuilderStore((state) => state.addElement);
  const { setNodeRef, listeners } = useDraggable({ id: paletteDragId(item), data: item });
  const { popup, focusFirstItem } = useFirstItemFocus();

  /** The keyboard and single-click counterpart of dropping the item at the end of a cell. */
  function add(cell: GridCell): void {
    addElement(item, cell, cell.elements.length);
  }

  return (
    <li data-uid={item.uid}>
      <Menu.Root
        modal={false}
        open={menuOpen}
        onOpenChange={(open, details) => {
          focusFirstItem(open, details);
          onMenuOpenChange(open);
        }}
      >
        {/* A button, so an item can be added without dragging: its menu asks which cell to add it to. */}
        <Menu.Trigger
          ref={setNodeRef}
          className="w-full cursor-grab justify-between rounded-field border border-base-300 bg-base-100 text-start focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Add ${item.label}`}
          {...listeners}
        >
          <span>{item.label}</span>
          <code className="text-xs text-base-content/70">&lt;{item.type}&gt;</code>
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner align="start" className="z-50">
            {/* Base UI names the popup after its trigger, and aria-labelledby would win over the label. */}
            <Menu.Popup
              ref={popup}
              render={<ul />}
              className="menu max-h-96 w-44 flex-nowrap overflow-y-auto rounded-box bg-base-100 p-1 shadow-md outline-none"
              aria-label={`Add ${item.label} to`}
              aria-labelledby={undefined}
            >
              <CellItems onPick={add} />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </li>
  );
}

// Its own component so the cells are only derived while a menu is open.
function CellItems({ onPick }: { onPick: (cell: GridCell) => void }) {
  const cells = useCells();

  return cells.map((cell) => (
    <li key={`${cell.row}:${cell.column}`} role="none">
      <Menu.Item onClick={() => onPick(cell)}>{cellLabel(cell)}</Menu.Item>
    </li>
  ));
}

export function ElementPalette() {
  const paletteItems = useBuilderStore((state) => state.paletteItems);
  const [openUid, setOpenUid] = useState<string | null>(null);

  // Base UI opens the menu on pointer down, which is also how a drag begins.
  useDndMonitor({ onDragStart: () => setOpenUid(null) });

  function setMenuOpen(uid: string, open: boolean): void {
    setOpenUid((current) => {
      if (open) {
        return uid;
      }
      return current === uid ? null : current;
    });
  }

  return (
    <div className="p-4">
      <h2
        id="element-palette-heading"
        className="mb-2 text-xs font-semibold tracking-wide text-base-content/70 uppercase"
      >
        Elements
      </h2>

      <ul className="menu w-full gap-1 p-0" aria-labelledby="element-palette-heading">
        {paletteItems.map((item) => (
          <PaletteEntry
            key={item.uid}
            item={item}
            menuOpen={openUid === item.uid}
            onMenuOpenChange={(open) => setMenuOpen(item.uid, open)}
          />
        ))}
      </ul>
    </div>
  );
}
