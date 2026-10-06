import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { userEvent } from 'vitest/browser';
import { DropdownOption } from '../models/dropdown-option';
import { DropdownOptionsDialog } from './dropdown-options-dialog';

const title = 'Dropdown options';
const description = 'Add the options of this dropdown.';
const cancelled = 'cancelled';
const small: DropdownOption = { text: 'Small', value: 's' };
const large: DropdownOption = { text: 'Large', value: 'l' };

function DialogHost({ focusElsewhere = false }: { focusElsewhere?: boolean }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState('');
  const submitted = useRef<DropdownOption[] | undefined>(undefined);
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
      <DropdownOptionsDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setResult(submitted.current ? JSON.stringify(submitted.current) : cancelled);
          }
        }}
        title={title}
        description={description}
        options={[small]}
        finalFocus={focusElsewhere ? elsewhere : undefined}
        onSubmit={(options) => {
          submitted.current = options;
        }}
      />
    </>
  );
}

describe(DropdownOptionsDialog.name, () => {
  async function mount(props: { description?: string; options?: readonly DropdownOption[] } = {}) {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <DropdownOptionsDialog
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

  function type(label: string, text: string): void {
    fireEvent.input(screen.getByRole('textbox', { name: label }), { target: { value: text } });
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
      <DropdownOptionsDialog
        open={false}
        onOpenChange={() => undefined}
        title={title}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

  describe('option rows', () => {
    it('should start with one blank row when no options are given', async () => {
      await mount();

      expect(screen.getAllByRole('textbox').length).toBe(2);
      expect(screen.getByRole('textbox', { name: 'Option 1 text' })).toHaveValue('');
      expect(screen.getByRole('textbox', { name: 'Option 1 value' })).toHaveValue('');
    });

    it('should render a row for every given option', async () => {
      await mount({ options: [small, large] });

      expect(screen.getAllByRole('textbox').length).toBe(4);
    });

    it('should prefill the text input with the option text', async () => {
      await mount({ options: [small, large] });

      expect(screen.getByRole('textbox', { name: 'Option 2 text' })).toHaveValue(large.text);
    });

    it('should prefill the value input with the option value', async () => {
      await mount({ options: [small, large] });

      expect(screen.getByRole('textbox', { name: 'Option 2 value' })).toHaveValue(large.value);
    });
  });

  describe('delete button', () => {
    beforeEach(async () => {
      await mount({ options: [small, large] });
    });

    it('should be disabled for the first row', () => {
      expect(screen.getByRole('button', { name: 'Delete option 1' })).toBeDisabled();
    });

    it('should be enabled for the other rows', () => {
      expect(screen.getByRole('button', { name: 'Delete option 2' })).toBeEnabled();
    });

    it('should remove its row when clicked', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete option 2' }));

      await waitFor(() =>
        expect(screen.queryByRole('textbox', { name: 'Option 2 text' })).not.toBeInTheDocument(),
      );
      expect(screen.getByRole('textbox', { name: 'Option 1 text' })).toHaveValue(small.text);
    });

    it('should move focus to the text input of the previous row when clicked', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete option 2' }));

      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: 'Option 1 text' })).toHaveFocus(),
      );
    });
  });

  describe('delete button of a row in between', () => {
    const medium: DropdownOption = { text: 'Medium', value: 'm' };

    beforeEach(async () => {
      await mount({ options: [small, medium, large] });
      fireEvent.click(screen.getByRole('button', { name: 'Delete option 2' }));
      await waitFor(() =>
        expect(screen.queryByRole('textbox', { name: 'Option 3 text' })).not.toBeInTheDocument(),
      );
    });

    it('should keep what the rows around it hold', () => {
      expect(screen.getByRole('textbox', { name: 'Option 1 text' })).toHaveValue(small.text);
      expect(screen.getByRole('textbox', { name: 'Option 2 text' })).toHaveValue(large.text);
      expect(screen.getByRole('textbox', { name: 'Option 2 value' })).toHaveValue(large.value);
    });
  });

  describe('add option button', () => {
    beforeEach(async () => {
      await mount({ options: [small] });
      fireEvent.click(screen.getByRole('button', { name: 'Add option' }));
    });

    it('should append a blank row when clicked', async () => {
      expect(await screen.findByRole('textbox', { name: 'Option 2 text' })).toHaveValue('');
      expect(screen.getByRole('textbox', { name: 'Option 2 value' })).toHaveValue('');
    });

    it('should focus the text input of the new row when clicked', async () => {
      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: 'Option 2 text' })).toHaveFocus(),
      );
    });
  });

  describe('save button', () => {
    it('should be enabled when every row has a text and a value', async () => {
      await mount({ options: [small, large] });

      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('should be disabled when a text is blank', async () => {
      await mount({ options: [small] });

      type('Option 1 text', '   ');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    });

    it('should be disabled when a value is blank', async () => {
      await mount({ options: [small] });

      type('Option 1 value', '   ');

      await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    });

    it('should be disabled for the initial blank row', async () => {
      await mount();

      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('should submit the entered options and then ask to close when clicked', async () => {
      const { onSubmit, onOpenChange } = await mount();
      type('Option 1 text', small.text);
      type('Option 1 value', small.value);
      fireEvent.click(screen.getByRole('button', { name: 'Add option' }));
      type('Option 2 text', large.text);
      type('Option 2 value', large.value);

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit.mock.calls).toEqual([[[small, large]]]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSubmit.mock.invocationCallOrder[0]).toBeLessThan(
        onOpenChange.mock.invocationCallOrder[0],
      );
    });

    it('should submit the given options when they are frozen', async () => {
      const frozen = Object.freeze([Object.freeze({ ...small })]);
      const { onSubmit } = await mount({ options: frozen });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit.mock.calls).toEqual([[[small]]]);
    });

    it('should submit copies, leaving the given options as they were', async () => {
      const given = [{ ...small }];
      const { onSubmit } = await mount({ options: given });
      type('Option 1 text', large.text);

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSubmit.mock.calls).toEqual([[[{ text: large.text, value: small.value }]]]);
      expect(given).toEqual([small]);
    });
  });

  describe('form', () => {
    function submitForm(): void {
      const { form } = screen.getByRole<HTMLInputElement>('textbox', { name: 'Option 1 text' });
      if (!form) throw new Error('The option rows are not inside a form');
      fireEvent.submit(form);
    }

    it('should submit the entered options when Enter is pressed in a row', async () => {
      const { onSubmit, onOpenChange } = await mount({ options: [small, large] });
      screen.getByRole('textbox', { name: 'Option 2 value' }).focus();

      await userEvent.keyboard('{Enter}');

      expect(onSubmit.mock.calls).toEqual([[[small, large]]]);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should submit the entered options when submitted', async () => {
      const { onSubmit } = await mount({ options: [small, large] });

      submitForm();

      expect(onSubmit.mock.calls).toEqual([[[small, large]]]);
    });

    it('should stay open when submitted with a blank text', async () => {
      const { onSubmit, onOpenChange } = await mount({ options: [small] });
      type('Option 1 text', '   ');

      submitForm();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('should stay open when submitted with a blank value', async () => {
      const { onSubmit, onOpenChange } = await mount({ options: [small] });
      type('Option 1 value', '   ');

      submitForm();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('should stay open when submitted with the initial blank row', async () => {
      const { onSubmit, onOpenChange } = await mount();

      submitForm();

      expect(onSubmit).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('cancel button', () => {
    it('should ask to close without submitting when clicked', async () => {
      const { onSubmit, onOpenChange } = await mount({ options: [small] });

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

    it('should focus the text input of the first row', async () => {
      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: 'Option 1 text' })).toHaveFocus(),
      );
    });

    it('should close with the entered options when saved', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add option' }));
      fireEvent.input(await screen.findByRole('textbox', { name: 'Option 2 text' }), {
        target: { value: large.text },
      });
      fireEvent.input(screen.getByRole('textbox', { name: 'Option 2 value' }), {
        target: { value: large.value },
      });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('status')).toHaveTextContent(JSON.stringify([small, large]));
    });

    it('should close without a result when cancelled', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('status')).toHaveTextContent(cancelled);
    });

    it('should return focus to the button that opened it', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus());
    });

    it('should start from the given options again when reopened after an abandoned edit', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add option' }));
      await screen.findByRole('textbox', { name: 'Option 2 text' });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      await screen.findByRole('dialog', { name: title });

      expect(screen.getAllByRole('textbox').length).toBe(2);
      expect(screen.getByRole('textbox', { name: 'Option 1 text' })).toHaveValue(small.text);
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
