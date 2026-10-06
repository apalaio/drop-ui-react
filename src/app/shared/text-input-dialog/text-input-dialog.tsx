import { Dialog } from '@base-ui/react/dialog';
import { type RefObject, type SyntheticEvent, useRef, useState } from 'react';
import { DIALOG_BACKDROP, DIALOG_DESCRIPTION, DIALOG_POPUP, DIALOG_TITLE } from '../dialog-styles';

export interface TextInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  value?: string;
  /** Element to focus once the dialog closes; defaults to whatever had focus when it opened. */
  finalFocus?: RefObject<HTMLElement | null>;
  onSubmit: (text: string) => void;
}

export function TextInputDialog({ open, onOpenChange, ...form }: TextInputDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className={DIALOG_BACKDROP} />
        <TextInputForm {...form} onOpenChange={onOpenChange} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Mounted by the portal only while the dialog is open, so the text starts from `value` on every open.
function TextInputForm({
  title,
  description,
  value = '',
  finalFocus,
  onSubmit,
  onOpenChange,
}: Omit<TextInputDialogProps, 'open'>) {
  const [text, setText] = useState(value);
  const textInput = useRef<HTMLInputElement>(null);
  const invalid = !text.trim();

  function submit(event: SyntheticEvent): void {
    event.preventDefault();
    if (invalid) {
      return;
    }
    onSubmit(text);
    onOpenChange(false);
  }

  return (
    <Dialog.Popup
      className={`${DIALOG_POPUP} w-[min(28rem,90vw)]`}
      initialFocus={textInput}
      finalFocus={finalFocus}
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Dialog.Title className={DIALOG_TITLE}>{title}</Dialog.Title>

        {description && (
          <Dialog.Description className={DIALOG_DESCRIPTION} data-testid="dialog-description">
            {description}
          </Dialog.Description>
        )}

        <label className="input w-full">
          <span className="sr-only">Text</span>
          <input
            ref={textInput}
            type="text"
            className="grow"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>

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
