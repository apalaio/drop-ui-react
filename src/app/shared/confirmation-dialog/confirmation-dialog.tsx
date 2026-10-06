import { AlertDialog } from '@base-ui/react/alert-dialog';
import { type RefObject, useRef } from 'react';
import { DIALOG_BACKDROP, DIALOG_DESCRIPTION, DIALOG_POPUP, DIALOG_TITLE } from '../dialog-styles';

export const DEFAULT_CONFIRM_LABEL = 'Confirm';

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Element to focus once the dialog closes; defaults to whatever had focus when it opened. */
  finalFocus?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
}

// An alert dialog, because it interrupts to ask about something that cannot be undone.
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = DEFAULT_CONFIRM_LABEL,
  finalFocus,
  onConfirm,
}: ConfirmationDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  function confirm(): void {
    onConfirm();
    onOpenChange(false);
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={DIALOG_BACKDROP} />
        <AlertDialog.Popup
          className={`${DIALOG_POPUP} w-[min(28rem,90vw)]`}
          initialFocus={cancelButton}
          finalFocus={finalFocus}
        >
          <div className="flex flex-col gap-4">
            <AlertDialog.Title className={DIALOG_TITLE}>{title}</AlertDialog.Title>

            {description && (
              <AlertDialog.Description
                className={DIALOG_DESCRIPTION}
                data-testid="dialog-description"
              >
                {description}
              </AlertDialog.Description>
            )}

            <div className="flex justify-end gap-2">
              <AlertDialog.Close ref={cancelButton} className="btn btn-ghost">
                Cancel
              </AlertDialog.Close>
              <button type="button" className="btn btn-primary" onClick={confirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
