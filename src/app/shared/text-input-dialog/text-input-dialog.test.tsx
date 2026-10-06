import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { userEvent } from 'vitest/browser';
import { TextInputDialog } from './text-input-dialog';

const title = 'Edit text';
const description = 'Change the text.';
const value = 'enter text';
const cancelled = 'cancelled';

function DialogHost({ focusElsewhere = false }: { focusElsewhere?: boolean }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('');
  const submitted = useRef<string | undefined>(undefined);
  const elsewhere = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          submitted.current = undefined;
          setOpen(true);
        }}
      >
        Open
      </button>
      <button ref={elsewhere} type="button">
        Elsewhere
      </button>
      <output>{result}</output>
      <TextInputDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setResult(submitted.current ?? cancelled);
          }
        }}
        title={title}
        description={description}
        value={value}
        finalFocus={focusElsewhere ? elsewhere : undefined}
        onSubmit={(text) => {
          submitted.current = text;
        }}
      />
    </>
  );
}

describe(TextInputDialog.name, () => {
  async function mount(props: { description?: string; value?: string } = {}) {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <TextInputDialog
        open
        onOpenChange={onOpenChange}
        title={title}
        onSubmit={onSubmit}
        {...props}
      />,
    );
    await screen.findByRole('dialog');
    return { onOpenChange, onSubmit };
  }

  function type(text: string): void {
    fireEvent.input(screen.getByRole('textbox', { name: 'Text' }), { target: { value: text } });
  }

  it('should render the title', async () => {
    await mount();

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('should be named by its title', async () => {
    await mount();

    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
  });

  it('should not be in the document while closed', () => {
    render(
      <TextInputDialog
        open={false}
        onOpenChange={() => undefined}
        title={title}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should prefill the text input with the value', async () => {
    await mount({ value });

    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(value);
  });

  it('should start with an empty text input when no value is given', async () => {
    await mount();

    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('');
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

      expect(screen.getByRole('dialog')).toHaveAccessibleDescription('');
    });
  });

  describe('save button', () => {
    it('should be enabled when the input has text', async () => {
      await mount({ value });

      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('should be disabled when the input is blank', async () => {
      await mount({ value });

      type('   ');

      expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('should submit the entered text and then ask to close when clicked', async () => {
      const { onSubmit, onOpenChange } = await mount({ value });
      type('Hello');

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit.mock.calls).toEqual([['Hello']]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSubmit.mock.invocationCallOrder[0]).toBeLessThan(
        onOpenChange.mock.invocationCallOrder[0],
      );
    });
  });

  describe('form', () => {
    function submitForm(): void {
      const { form } = screen.getByRole<HTMLInputElement>('textbox', { name: 'Text' });
      if (!form) throw new Error('The text input is not inside a form');
      fireEvent.submit(form);
    }

    it('should submit the entered text when Enter is pressed in the text input', async () => {
      const { onSubmit, onOpenChange } = await mount({ value });
      type('Hello');
      screen.getByRole('textbox', { name: 'Text' }).focus();

      await userEvent.keyboard('{Enter}');

      expect(onSubmit.mock.calls).toEqual([['Hello']]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should submit the entered text when submitted', async () => {
      const { onSubmit } = await mount({ value });
      type('Hello');

      submitForm();

      expect(onSubmit.mock.calls).toEqual([['Hello']]);
    });

    it('should stay open when submitted with blank text', async () => {
      const { onSubmit, onOpenChange } = await mount({ value });
      type('   ');

      submitForm();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('cancel button', () => {
    it('should ask to close without submitting when clicked', async () => {
      const { onSubmit, onOpenChange } = await mount({ value });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('when opened', () => {
    beforeEach(async () => {
      render(<DialogHost />);
      screen.getByRole('button', { name: 'Open' }).focus();
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await screen.findByRole('dialog', { name: title });
    });

    it('should be described by its description', () => {
      expect(screen.getByRole('dialog')).toHaveAccessibleDescription(description);
    });

    it('should start in the text input', async () => {
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Text' })).toHaveFocus());
    });

    it('should close with the entered text when saved', async () => {
      type('Hello');
      fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('status')).toHaveTextContent('Hello');
    });

    it('should close without a result when cancelled', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('status')).toHaveTextContent(cancelled);
    });

    it('should close without a result when dismissed with Escape', async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('status')).toHaveTextContent(cancelled);
    });

    it('should return focus to the button that opened it', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus());
    });

    it('should start from the value again when reopened after an abandoned edit', async () => {
      type('Abandoned');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Open' }));

      expect(await screen.findByRole('textbox', { name: 'Text' })).toHaveValue(value);
    });
  });

  describe('when opened with somewhere else to return focus to', () => {
    beforeEach(async () => {
      render(<DialogHost focusElsewhere />);
      screen.getByRole('button', { name: 'Open' }).focus();
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await screen.findByRole('dialog', { name: title });
    });

    it('should move focus there when cancelled', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus());
    });

    it('should move focus there when saved', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus());
    });
  });
});
