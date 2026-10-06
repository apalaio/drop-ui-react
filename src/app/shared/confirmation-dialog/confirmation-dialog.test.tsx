import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { ConfirmationDialog, DEFAULT_CONFIRM_LABEL } from './confirmation-dialog';

const title = 'Delete element';
const description = 'This cannot be undone.';
const confirmLabel = 'Delete';

function DialogHost({ focusElsewhere = false }: { focusElsewhere?: boolean }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('');
  const confirmed = useRef(false);
  const elsewhere = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button ref={elsewhere} type="button">
        Elsewhere
      </button>
      <output>{result}</output>
      <ConfirmationDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setResult(String(confirmed.current));
          }
        }}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        finalFocus={focusElsewhere ? elsewhere : undefined}
        onConfirm={() => {
          confirmed.current = true;
        }}
      />
    </>
  );
}

describe(ConfirmationDialog.name, () => {
  async function mount(props: { description?: string; confirmLabel?: string } = {}) {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open
        onOpenChange={onOpenChange}
        title={title}
        onConfirm={onConfirm}
        {...props}
      />,
    );
    await screen.findByRole('alertdialog');
    return { onOpenChange, onConfirm };
  }

  it('should render the title', async () => {
    await mount();

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('should be named by its title', async () => {
    await mount();

    expect(screen.getByRole('alertdialog', { name: title })).toBeInTheDocument();
  });

  it('should not be in the document while closed', () => {
    render(
      <ConfirmationDialog
        open={false}
        onOpenChange={() => undefined}
        title={title}
        onConfirm={() => undefined}
      />,
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  describe('description', () => {
    it('should render when given', async () => {
      await mount({ description });

      expect(screen.getByText(description)).toBeInTheDocument();
    });

    it('should not render when empty', async () => {
      await mount();

      expect(screen.queryByTestId('dialog-description')).not.toBeInTheDocument();
    });

    it('should leave the dialog without a description when empty', async () => {
      await mount();

      expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('');
    });
  });

  describe('confirm button', () => {
    it('should be labelled Confirm by default', async () => {
      await mount();

      expect(screen.getByRole('button', { name: DEFAULT_CONFIRM_LABEL })).toBeInTheDocument();
    });

    it('should use the given label', async () => {
      await mount({ confirmLabel });

      expect(screen.getByRole('button', { name: confirmLabel })).toBeInTheDocument();
    });

    it('should confirm and then ask to close when clicked', async () => {
      const { onConfirm, onOpenChange } = await mount({ confirmLabel });

      fireEvent.click(screen.getByRole('button', { name: confirmLabel }));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onConfirm.mock.invocationCallOrder[0]).toBeLessThan(
        onOpenChange.mock.invocationCallOrder[0],
      );
    });
  });

  describe('cancel button', () => {
    it('should ask to close without confirming when clicked', async () => {
      const { onConfirm, onOpenChange } = await mount();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when opened', () => {
    beforeEach(async () => {
      render(<DialogHost />);
      screen.getByRole('button', { name: 'Open' }).focus();
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await screen.findByRole('alertdialog', { name: title });
    });

    it('should be described by its description', () => {
      expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(description);
    });

    it('should start on the cancel button, the safe choice', async () => {
      await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    });

    it('should close confirmed when the confirm button is clicked', async () => {
      fireEvent.click(screen.getByRole('button', { name: confirmLabel }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(screen.getByRole('status')).toHaveTextContent('true');
    });

    it('should close unconfirmed when cancelled', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(screen.getByRole('status')).toHaveTextContent('false');
    });

    it('should close unconfirmed when dismissed with Escape', async () => {
      fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(screen.getByRole('status')).toHaveTextContent('false');
    });

    it('should return focus to the button that opened it', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus());
    });
  });

  describe('when opened with somewhere else to return focus to', () => {
    beforeEach(async () => {
      render(<DialogHost focusElsewhere />);
      screen.getByRole('button', { name: 'Open' }).focus();
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await screen.findByRole('alertdialog', { name: title });
    });

    it('should move focus there when cancelled', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus());
    });

    it('should move focus there when confirmed', async () => {
      fireEvent.click(screen.getByRole('button', { name: confirmLabel }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus());
    });
  });
});
