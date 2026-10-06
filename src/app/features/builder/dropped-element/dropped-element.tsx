import { Menu } from '@base-ui/react/menu';
import { DragOverlay } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type RefObject, useRef, useState } from 'react';
import { ConfirmationDialog } from '../../../shared/confirmation-dialog/confirmation-dialog';
import { useFirstItemFocus } from '../../../shared/menu-first-item-focus';
import { TextInputDialog } from '../../../shared/text-input-dialog/text-input-dialog';
import { noDrag, usePrefersReducedMotion } from '../drag-drop/drag-drop';
import { DropdownOptionsDialog } from '../dropdown-options-dialog/dropdown-options-dialog';
import {
  CanvasElement,
  DatepickerCanvasElement,
  DropdownCanvasElement,
  TextCanvasElement,
  TextControlCanvasElement,
} from '../models/canvas-element';
import { cellLabel, CellPosition, GridCell } from '../models/grid-layout';
import { ELEMENT_LABELS, ElementType } from '../models/palette-item';
import { useBuilderStore, useCells } from '../state/builder-store';

// Shown on hover and while focus is inside, so keyboard users get the same cue as mouse users.
export const OUTLINE: Record<ElementType, string> = {
  div: 'border-dashed hover:border-primary/40 focus-within:border-primary/40',
  span: 'border-dotted hover:border-secondary focus-within:border-secondary',
  'text-input': 'border-dashed hover:border-info focus-within:border-info',
  textfield: 'border-dashed hover:border-info focus-within:border-info',
  datepicker: 'border-dashed hover:border-info focus-within:border-info',
  dropdown: 'border-dashed hover:border-accent focus-within:border-accent',
};

export const displayClass = (type: ElementType): string =>
  type === 'span' ? 'mr-2 inline-block align-top' : 'block';

const MENU = 'menu rounded-box bg-base-100 p-1 shadow-md outline-none';
const ACTIONS_BUTTON = 'btn btn-ghost btn-xs btn-square absolute top-1 right-1';

const isSameCell = (a: CellPosition, b: CellPosition): boolean =>
  a.row === b.row && a.column === b.column;

function assertNever(element: never): never {
  throw new Error(`No rendering for element ${JSON.stringify(element)}`);
}

function ActionsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
      aria-hidden="true"
    >
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

type ElementDialog = 'edit-text' | 'edit-options' | 'delete';

export interface DroppedElementProps {
  element: CanvasElement;
  /** Position among the elements of its cell. */
  index: number;
  /** How many elements its cell holds. */
  siblingCount: number;
  /** The element moved itself from its menu; the keyboard focus it held went with the old DOM. */
  onMoved: () => void;
  onRemoved: () => void;
  actionsButtonRef: (node: HTMLButtonElement | null) => void;
}

export function DroppedElement({
  element,
  index,
  siblingCount,
  onMoved,
  onRemoved,
  actionsButtonRef,
}: DroppedElementProps) {
  const moveElement = useBuilderStore((state) => state.moveElement);
  const removeElement = useBuilderStore((state) => state.removeElement);
  const hasOtherCells = useBuilderStore((state) => state.grid.rows * state.grid.columns > 1);
  const reducedMotion = usePrefersReducedMotion();
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({
    id: element.uid,
    data: element,
    transition: reducedMotion ? null : undefined,
  });
  const { popup, focusFirstItem } = useFirstItemFocus();
  const [dialog, setDialog] = useState<ElementDialog | null>(null);
  const actionsButton = useRef<HTMLElement | null>(null);

  const actionsLabel = `${ELEMENT_LABELS[element.type]} actions`;
  const isFirst = index === 0;
  const isLast = index === siblingCount - 1;

  /*
   * Kept after the button is gone: the confirmation closes as its element is removed, and Base UI
   * given an empty finalFocus falls back to whatever had focus earlier, such as the palette.
   */
  function setActionsButton(node: HTMLElement | null): void {
    if (node) {
      actionsButton.current = node;
    }
    actionsButtonRef(node as HTMLButtonElement | null);
  }

  function closeDialog(open: boolean): void {
    if (!open) {
      setDialog(null);
    }
  }

  function moveWithinCell(offset: -1 | 1): void {
    const { uid, row, column } = element;
    moveElement(uid, { row, column }, index + offset);
    onMoved();
  }

  function moveToCell(cell: GridCell): void {
    moveElement(element.uid, cell, cell.elements.length);
    onMoved();
  }

  function remove(): void {
    removeElement(element.uid);
    onRemoved();
  }

  return (
    <>
      <div
        ref={setNodeRef}
        className={`group relative mb-2 cursor-grab rounded-box border border-transparent p-1 pr-10 ${displayClass(element.type)} ${OUTLINE[element.type]}${isDragging ? ' opacity-40' : ''}`}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        data-uid={element.uid}
        data-element-type={element.type}
        {...listeners}
      >
        {/* Hidden from assistive tech: the actions button right after it already names the element type. */}
        <span
          className="badge badge-ghost badge-xs absolute top-2 right-10 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          aria-hidden="true"
        >
          {element.type}
        </span>

        <Menu.Root modal={false} onOpenChange={focusFirstItem}>
          <Menu.Trigger
            ref={setActionsButton}
            className={ACTIONS_BUTTON}
            aria-label={actionsLabel}
            {...noDrag}
          >
            <ActionsIcon />
          </Menu.Trigger>

          <Menu.Portal>
            <Menu.Positioner align="start" className="z-50">
              {/*
                noDrag: React events cross the portal, so a press on an item would otherwise reach the
                wrapper and could start dragging the element. The submenu is covered as its child.
              */}
              <Menu.Popup
                ref={popup}
                render={<ul />}
                className={`${MENU} w-36`}
                aria-label={actionsLabel}
                aria-labelledby={undefined}
                {...noDrag}
              >
                {'text' in element && (
                  <li role="none">
                    <Menu.Item onClick={() => setDialog('edit-text')}>Edit text</Menu.Item>
                  </li>
                )}
                {element.type === 'dropdown' && (
                  <li role="none">
                    <Menu.Item onClick={() => setDialog('edit-options')}>Edit options</Menu.Item>
                  </li>
                )}
                {siblingCount > 1 && (
                  <>
                    <li role="none" className={isFirst ? 'menu-disabled' : undefined}>
                      <Menu.Item disabled={isFirst} onClick={() => moveWithinCell(-1)}>
                        Move earlier
                      </Menu.Item>
                    </li>
                    <li role="none" className={isLast ? 'menu-disabled' : undefined}>
                      <Menu.Item disabled={isLast} onClick={() => moveWithinCell(1)}>
                        Move later
                      </Menu.Item>
                    </li>
                  </>
                )}
                {hasOtherCells && (
                  <li role="none">
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>Move to cell</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner className="z-50">
                          <Menu.Popup
                            render={<ul />}
                            className={`${MENU} max-h-96 w-44 flex-nowrap overflow-y-auto`}
                            aria-label="Move to cell"
                            aria-labelledby={undefined}
                          >
                            <OtherCellItems own={element} onPick={moveToCell} />
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </li>
                )}
                <li role="none">
                  <Menu.Item className="text-error" onClick={() => setDialog('delete')}>
                    Delete element
                  </Menu.Item>
                </li>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        <ElementBody element={element} />
      </div>

      {/*
        The copy that follows the pointer, while the element stays in its slot as the faded
        placeholder. The element cannot move itself: dnd-kit only moves a sortable over the elements
        of its own cell, and a transformed element stretches the scrolling canvas, so its
        auto-scroll would never end. No drop animation, as the copy goes with the drag.
      */}
      {isDragging && (
        <DragOverlay dropAnimation={null}>
          <DraggedCopy element={element} />
        </DragOverlay>
      )}

      {/* Beside the wrapper, not in it: a press inside a dialog must not reach the drag listeners. */}
      {dialog === 'edit-text' && 'text' in element && (
        <EditTextDialog element={element} finalFocus={actionsButton} onOpenChange={closeDialog} />
      )}
      {dialog === 'edit-options' && element.type === 'dropdown' && (
        <EditOptionsDialog
          element={element}
          finalFocus={actionsButton}
          onOpenChange={closeDialog}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmationDialog
          open
          onOpenChange={closeDialog}
          title="Delete element"
          description={`Remove this <${element.type}> from the canvas? This cannot be undone.`}
          confirmLabel="Delete"
          finalFocus={actionsButton}
          onConfirm={remove}
        />
      )}
    </>
  );
}

function DraggedCopy({ element }: { element: CanvasElement }) {
  return (
    <div
      className={`relative rounded-box border border-transparent p-1 pr-10 shadow-lg ${displayClass(element.type)}`}
      aria-hidden="true"
      inert
    >
      <span className={ACTIONS_BUTTON}>
        <ActionsIcon />
      </span>
      <ElementBody element={element} />
    </div>
  );
}

// Its own component so the cells are only derived while the submenu is open.
function OtherCellItems({ own, onPick }: { own: CellPosition; onPick: (cell: GridCell) => void }) {
  const cells = useCells();

  return cells
    .filter((cell) => !isSameCell(cell, own))
    .map((cell) => (
      <li key={`${cell.row}:${cell.column}`} role="none">
        <Menu.Item onClick={() => onPick(cell)}>{cellLabel(cell)}</Menu.Item>
      </li>
    ));
}

/*
 * Every control is controlled by the store: an element is rendered anew when it changes cell, and
 * only state survives that.
 */
function ElementBody({ element }: { element: CanvasElement }) {
  const updateValue = useBuilderStore((state) => state.updateValue);

  switch (element.type) {
    case 'div':
      return (
        <div className="min-h-16 rounded-field bg-base-200 p-2" data-testid="dropped-div">
          {element.text}
        </div>
      );
    case 'span':
      return (
        <span className="rounded-field bg-base-200 px-2 py-1" data-testid="dropped-span">
          {element.text}
        </span>
      );
    case 'text-input':
      return (
        <input
          type="text"
          className="input"
          aria-label="Text input"
          data-testid="dropped-text-input"
          placeholder={element.text}
          value={element.value}
          onChange={(event) => updateValue(element.uid, event.target.value)}
          {...noDrag}
        />
      );
    case 'textfield':
      return (
        <textarea
          className="textarea"
          aria-label="Textfield"
          data-testid="dropped-textfield"
          placeholder={element.text}
          value={element.value}
          onChange={(event) => updateValue(element.uid, event.target.value)}
          {...noDrag}
        />
      );
    case 'datepicker':
      return <Datepicker element={element} />;
    case 'dropdown':
      return (
        <select
          className="select"
          aria-label="Dropdown"
          data-testid="dropped-dropdown"
          value={element.value}
          onChange={(event) => updateValue(element.uid, event.target.value)}
          {...noDrag}
        >
          {element.options.map((option, optionIndex) => (
            <option key={optionIndex} value={option.value}>
              {option.text}
            </option>
          ))}
        </select>
      );
    default:
      return assertNever(element);
  }
}

function Datepicker({ element }: { element: DatepickerCanvasElement }) {
  const updateValue = useBuilderStore((state) => state.updateValue);
  const [incomplete, setIncomplete] = useState(false);

  /*
   * While one part of a picked date is being retyped the field reports an empty value and bad
   * input. The store keeps the last whole date meanwhile, and writing that back would undo the
   * edit, so the field is shown the empty value it reports until the date is whole again.
   */
  return (
    <input
      type="date"
      className="input"
      aria-label="Datepicker"
      data-testid="dropped-datepicker"
      value={incomplete ? '' : element.value}
      onChange={({ target }) => {
        setIncomplete(target.validity.badInput);
        if (!target.validity.badInput) {
          updateValue(element.uid, target.value);
        }
      }}
      {...noDrag}
    />
  );
}

interface EditDialogProps<Element extends CanvasElement> {
  element: Element;
  finalFocus: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
}

function EditTextDialog({
  element: { uid, type, text },
  finalFocus,
  onOpenChange,
}: EditDialogProps<TextCanvasElement | TextControlCanvasElement>) {
  const updateText = useBuilderStore((state) => state.updateText);

  return (
    <TextInputDialog
      open
      onOpenChange={onOpenChange}
      title="Edit text"
      description={`Change the text shown inside this <${type}>.`}
      value={text}
      finalFocus={finalFocus}
      onSubmit={(newText) => updateText(uid, newText)}
    />
  );
}

function EditOptionsDialog({
  element: { uid, type, options },
  finalFocus,
  onOpenChange,
}: EditDialogProps<DropdownCanvasElement>) {
  const updateOptions = useBuilderStore((state) => state.updateOptions);

  return (
    <DropdownOptionsDialog
      open
      onOpenChange={onOpenChange}
      title="Edit options"
      description={`Set the text and value of each option in this <${type}>.`}
      options={options}
      finalFocus={finalFocus}
      onSubmit={(newOptions) => updateOptions(uid, newOptions)}
    />
  );
}
