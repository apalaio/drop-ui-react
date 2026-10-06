import { Dialog } from '@base-ui/react/dialog';
import { type RefObject, type SyntheticEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DIALOG_BACKDROP,
  DIALOG_DESCRIPTION,
  DIALOG_POPUP,
  DIALOG_TITLE,
} from '../../../shared/dialog-styles';
import { DropdownOption } from '../models/dropdown-option';

export interface DropdownOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  options?: readonly DropdownOption[];
  /** Element to focus once the dialog closes; defaults to whatever had focus when it opened. */
  finalFocus?: RefObject<HTMLElement | null>;
  onSubmit: (options: DropdownOption[]) => void;
}

// The id is only the React key: an index key would hand a deleted row's typed values and focus to its neighbour.
interface Row extends DropdownOption {
  id: string;
}

function createRow(text = '', value = ''): Row {
  return { id: crypto.randomUUID(), text, value };
}

export function DropdownOptionsDialog({ open, onOpenChange, ...form }: DropdownOptionsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className={DIALOG_BACKDROP} />
        <DropdownOptionsForm {...form} onOpenChange={onOpenChange} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Mounted by the portal only while the dialog is open, so the rows start from `options` on every open.
function DropdownOptionsForm({
  title,
  description,
  options = [],
  finalFocus,
  onSubmit,
  onOpenChange,
}: Omit<DropdownOptionsDialogProps, 'open'>) {
  const [rows, setRows] = useState<Row[]>(() =>
    options.length ? options.map(({ text, value }) => createRow(text, value)) : [createRow()],
  );
  const textInputs = useRef(new Map<string, HTMLInputElement>());
  const firstTextInput = useRef<HTMLInputElement | null>(null);
  const invalid = rows.some((row) => !row.text.trim() || !row.value.trim());

  function updateRow(id: string, change: Partial<DropdownOption>): void {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)));
  }

  // The row to focus is only in the DOM once the change has rendered, hence flushSync.
  function addOption(): void {
    const row = createRow();
    flushSync(() => setRows((current) => [...current, row]));
    textInputs.current.get(row.id)?.focus();
  }

  function removeOption(index: number): void {
    const previous = rows[index - 1];
    flushSync(() => setRows((current) => current.filter((_, i) => i !== index)));
    if (previous) {
      textInputs.current.get(previous.id)?.focus();
    }
  }

  function submit(event: SyntheticEvent): void {
    event.preventDefault();
    if (invalid) {
      return;
    }
    onSubmit(rows.map(({ text, value }) => ({ text, value })));
    onOpenChange(false);
  }

  return (
    <Dialog.Popup
      className={`${DIALOG_POPUP} w-[min(36rem,90vw)]`}
      initialFocus={firstTextInput}
      finalFocus={finalFocus}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Dialog.Title className={DIALOG_TITLE}>{title}</Dialog.Title>

        {description && (
          <Dialog.Description className={DIALOG_DESCRIPTION} data-testid="dialog-description">
            {description}
          </Dialog.Description>
        )}

        <ul className="-m-1 flex max-h-[50vh] flex-col gap-2 overflow-y-auto p-1">
          {rows.map((row, index) => (
            <li key={row.id} className="flex items-center gap-2">
              <label className="input min-w-0 flex-1">
                <span className="sr-only">Option {index + 1} text</span>
                <input
                  ref={(node) => {
                    if (index === 0) {
                      firstTextInput.current = node;
                    }
                    if (node) {
                      textInputs.current.set(row.id, node);
                    } else {
                      textInputs.current.delete(row.id);
                    }
                  }}
                  type="text"
                  className="grow"
                  placeholder="Text"
                  value={row.text}
                  onChange={(event) => updateRow(row.id, { text: event.target.value })}
                />
              </label>
              <label className="input min-w-0 flex-1">
                <span className="sr-only">Option {index + 1} value</span>
                <input
                  type="text"
                  className="grow"
                  placeholder="Value"
                  value={row.value}
                  onChange={(event) => updateRow(row.id, { value: event.target.value })}
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-square enabled:text-error"
                aria-label={`Delete option ${index + 1}`}
                disabled={index === 0}
                onClick={() => removeOption(index)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-4"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        <div>
          <button type="button" className="btn btn-sm" onClick={addOption}>
            Add option
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <Dialog.Close className="btn btn-ghost">Cancel</Dialog.Close>
          <button type="submit" className="btn btn-primary" disabled={invalid}>
            Save
          </button>
        </div>
      </form>
    </Dialog.Popup>
  );
}
