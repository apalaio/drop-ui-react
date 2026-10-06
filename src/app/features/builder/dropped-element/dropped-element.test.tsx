import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { renderWithStores } from '../../../../test/render-with-stores';
import {
  CanvasElement,
  DatepickerCanvasElement,
  DropdownCanvasElement,
  TextCanvasElement,
  TextControlCanvasElement,
} from '../models/canvas-element';
import { GridLayout } from '../models/grid-layout';
import { BuilderStore, selectCells, useBuilderStore } from '../state/builder-store';
import { DroppedElement } from './dropped-element';

interface HostProps {
  uid: string;
  onMoved: () => void;
  onRemoved: () => void;
  actionsButtonRef: (node: HTMLButtonElement | null) => void;
}

function Host({ uid, onMoved, onRemoved, actionsButtonRef }: HostProps) {
  const canvasElements = useBuilderStore((state) => state.canvasElements);
  const element = canvasElements.find((candidate) => candidate.uid === uid);
  if (!element) {
    return null;
  }
  const siblings = canvasElements.filter(
    (other) => other.row === element.row && other.column === element.column,
  );

  return (
    <DroppedElement
      element={element}
      index={siblings.indexOf(element)}
      siblingCount={siblings.length}
      onMoved={onMoved}
      onRemoved={onRemoved}
      actionsButtonRef={actionsButtonRef}
    />
  );
}

describe(DroppedElement.name, () => {
  const uid = 'element-1';
  const text = 'enter text';
  const cell = { row: 0, column: 0 };
  const div: TextCanvasElement = { uid, type: 'div', paletteUid: 'palette-div', text, ...cell };
  const span: TextCanvasElement = {
    uid: 'element-2',
    type: 'span',
    paletteUid: 'palette-span',
    text,
    ...cell,
  };
  const typed = 'Ada';
  const pickedDate = '2026-10-05';
  const textInput: TextControlCanvasElement = {
    uid: 'element-4',
    type: 'text-input',
    paletteUid: 'palette-text-input',
    text,
    value: '',
    ...cell,
  };
  const textfield: TextControlCanvasElement = {
    ...textInput,
    uid: 'element-5',
    type: 'textfield',
    paletteUid: 'palette-textfield',
  };
  const datepicker: DatepickerCanvasElement = {
    uid: 'element-6',
    type: 'datepicker',
    paletteUid: 'palette-datepicker',
    value: '',
    ...cell,
  };
  const formControlTestIds = ['dropped-text-input', 'dropped-textfield', 'dropped-datepicker'];
  const otherTestIds = (testId: string) =>
    ['dropped-div', 'dropped-span', 'dropped-dropdown', ...formControlTestIds].filter(
      (other) => other !== testId,
    );
  const small = { text: 'Small', value: 's' };
  const large = { text: 'Large', value: 'l' };
  const dropdown: DropdownCanvasElement = {
    uid: 'element-3',
    type: 'dropdown',
    paletteUid: 'palette-dropdown',
    options: [small, large],
    value: small.value,
    ...cell,
  };

  const divActions = 'Block text actions';
  const dropdownActions = 'Dropdown actions';
  const moveEarlier = 'Move earlier';
  const moveLater = 'Move later';
  const moveToCell = 'Move to cell';

  function mount(
    element: CanvasElement,
    canvas: { grid?: GridLayout; canvasElements?: CanvasElement[] } = {},
  ) {
    const onMoved = vi.fn();
    const onRemoved = vi.fn();
    const actionsButtonRef = vi.fn();
    const { builderStore } = renderWithStores(
      <Host
        uid={element.uid}
        onMoved={onMoved}
        onRemoved={onRemoved}
        actionsButtonRef={actionsButtonRef}
      />,
      {
        initial: {
          grid: canvas.grid ?? { rows: 1, columns: 1 },
          canvasElements: canvas.canvasElements ?? [element],
        },
      },
    );
    return { builderStore, onMoved, onRemoved, actionsButtonRef };
  }

  function menuActions(): (string | undefined)[] {
    return screen.getAllByRole('menuitem').map((item) => item.textContent?.trim());
  }

  function stored(store: BuilderStore, element: CanvasElement): CanvasElement | undefined {
    return store.getState().canvasElements.find((candidate) => candidate.uid === element.uid);
  }

  function uidsIn(store: BuilderStore, row: number, column: number): string[] {
    const { grid, canvasElements } = store.getState();
    const gridCell = selectCells(grid, canvasElements).find(
      (candidate) => candidate.row === row && candidate.column === column,
    );
    return (gridCell?.elements ?? []).map((element) => element.uid);
  }

  async function openAction(actions: string, action: string): Promise<void> {
    fireEvent.click(screen.getByRole('button', { name: actions }));
    fireEvent.click(await screen.findByRole('menuitem', { name: action }));
  }

  it('should tag the wrapper with the element uid', () => {
    mount(div);

    expect(screen.getByTestId('dropped-div').parentElement).toHaveAttribute('data-uid', uid);
  });

  it('should tag the wrapper with the element type', () => {
    mount(span);

    expect(screen.getByTestId('dropped-span').parentElement).toHaveAttribute(
      'data-element-type',
      'span',
    );
  });

  it('should not make the wrapper a control of its own, leaving the actions button as the way in', () => {
    mount(div);
    const wrapper = screen.getByTestId('dropped-div').parentElement;

    expect(wrapper).not.toHaveAttribute('role');
    expect(wrapper).not.toHaveAttribute('tabindex');
    expect(wrapper).not.toHaveAttribute('aria-roledescription');
  });

  describe('div element', () => {
    beforeEach(() => {
      mount(div);
    });

    it('should render a div with the element text', () => {
      expect(screen.getByTestId('dropped-div')).toHaveTextContent(text);
    });

    it.each(formControlTestIds)('should not render %s', (testId) => {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });

    it('should not render a span', () => {
      expect(screen.queryByTestId('dropped-span')).not.toBeInTheDocument();
    });

    it('should not render a dropdown', () => {
      expect(screen.queryByTestId('dropped-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('span element', () => {
    beforeEach(() => {
      mount(span);
    });

    it('should render a span with the element text', () => {
      expect(screen.getByTestId('dropped-span')).toHaveTextContent(text);
    });

    it.each(formControlTestIds)('should not render %s', (testId) => {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });

    it('should not render a div', () => {
      expect(screen.queryByTestId('dropped-div')).not.toBeInTheDocument();
    });

    it('should not render a dropdown', () => {
      expect(screen.queryByTestId('dropped-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('text input element', () => {
    let store: BuilderStore;

    beforeEach(() => {
      store = mount(textInput).builderStore;
    });

    it('should render a single-line text input', () => {
      expect(screen.getByTestId('dropped-text-input')).toBe(
        screen.getByRole('textbox', { name: 'Text input' }),
      );
    });

    it('should show the element text as the placeholder', () => {
      expect(screen.getByRole('textbox', { name: 'Text input' })).toHaveAttribute(
        'placeholder',
        text,
      );
    });

    it('should be empty while the element has no value', () => {
      expect(screen.getByRole('textbox', { name: 'Text input' })).toHaveValue('');
    });

    it.each(otherTestIds('dropped-text-input'))('should not render %s', (testId) => {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });

    it('should keep what is typed into it as the element value', () => {
      fireEvent.input(screen.getByRole('textbox', { name: 'Text input' }), {
        target: { value: typed },
      });

      expect(screen.getByRole('textbox', { name: 'Text input' })).toHaveValue(typed);
      expect(stored(store, textInput)).toEqual({ ...textInput, value: typed });
    });

    it('should take keys typed into it', async () => {
      screen.getByRole('textbox', { name: 'Text input' }).focus();

      await userEvent.keyboard(typed);

      await waitFor(() =>
        expect(screen.getByRole('textbox', { name: 'Text input' })).toHaveValue(typed),
      );
    });
  });

  describe('text input element with a value', () => {
    beforeEach(() => {
      mount({ ...textInput, value: typed });
    });

    it('should show the element value', () => {
      expect(screen.getByRole('textbox', { name: 'Text input' })).toHaveValue(typed);
    });
  });

  describe('textfield element', () => {
    let store: BuilderStore;

    beforeEach(() => {
      store = mount(textfield).builderStore;
    });

    it('should render a multi-line textarea', () => {
      expect(screen.getByRole('textbox', { name: 'Textfield' })).toBeInstanceOf(
        HTMLTextAreaElement,
      );
    });

    it('should show the element text as the placeholder', () => {
      expect(screen.getByTestId('dropped-textfield')).toHaveAttribute('placeholder', text);
    });

    it.each(otherTestIds('dropped-textfield'))('should not render %s', (testId) => {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });

    it('should keep what is typed into it as the element value', () => {
      const lines = 'Two\nlines';

      fireEvent.input(screen.getByRole('textbox', { name: 'Textfield' }), {
        target: { value: lines },
      });

      expect(screen.getByRole('textbox', { name: 'Textfield' })).toHaveValue(lines);
      expect(stored(store, textfield)).toEqual({ ...textfield, value: lines });
    });
  });

  describe('textfield element with a value', () => {
    beforeEach(() => {
      mount({ ...textfield, value: typed });
    });

    it('should show the element value', () => {
      expect(screen.getByRole('textbox', { name: 'Textfield' })).toHaveValue(typed);
    });
  });

  describe('datepicker element', () => {
    let store: BuilderStore;

    beforeEach(() => {
      store = mount(datepicker).builderStore;
    });

    it('should render a native date input', () => {
      expect(screen.getByLabelText('Datepicker')).toHaveAttribute('type', 'date');
    });

    it.each(otherTestIds('dropped-datepicker'))('should not render %s', (testId) => {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    });

    it('should keep a picked date as the element value', () => {
      fireEvent.input(screen.getByLabelText('Datepicker'), { target: { value: pickedDate } });

      expect(screen.getByLabelText('Datepicker')).toHaveValue(pickedDate);
      expect(stored(store, datepicker)).toEqual({ ...datepicker, value: pickedDate });
    });
  });

  describe('datepicker element with a value', () => {
    const picked: DatepickerCanvasElement = { ...datepicker, value: pickedDate };
    let store: BuilderStore;

    beforeEach(() => {
      store = mount(picked).builderStore;
    });

    it('should show the element value', () => {
      expect(screen.getByLabelText('Datepicker')).toHaveValue(pickedDate);
    });

    it('should store an emptied date', () => {
      fireEvent.input(screen.getByLabelText('Datepicker'), { target: { value: '' } });

      expect(screen.getByLabelText('Datepicker')).toHaveValue('');
      expect(stored(store, picked)).toEqual({ ...picked, value: '' });
    });

    it('should leave the value unchanged while the date holds an incomplete entry', async () => {
      const date = screen.getByLabelText<HTMLInputElement>('Datepicker');
      date.focus();

      await userEvent.keyboard('{Backspace}');

      await waitFor(() => expect(date.validity.badInput).toBe(true));
      expect(stored(store, picked)).toEqual(picked);
    });

    it('should keep showing the incomplete entry instead of the stored date', async () => {
      const date = screen.getByLabelText<HTMLInputElement>('Datepicker');
      date.focus();

      await userEvent.keyboard('{Backspace}');

      await waitFor(() => expect(date.validity.badInput).toBe(true));
      expect(date).toHaveValue('');
    });

    it('should store the date again once the retyped part makes it whole', async () => {
      const date = screen.getByLabelText<HTMLInputElement>('Datepicker');
      date.focus();
      await userEvent.keyboard('{Backspace}');
      await waitFor(() => expect(date.validity.badInput).toBe(true));

      await userEvent.keyboard('11');

      await waitFor(() => expect(date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/));
      expect(date.value).not.toBe(pickedDate);
      expect(stored(store, picked)).toEqual({ ...picked, value: date.value });
    });
  });

  describe('dropdown element', () => {
    describe('with options', () => {
      let store: BuilderStore;

      beforeEach(() => {
        store = mount(dropdown).builderStore;
      });

      it('should render a select', () => {
        expect(screen.getByTestId('dropped-dropdown')).toBe(
          screen.getByRole('combobox', { name: 'Dropdown' }),
        );
      });

      it('should render one option per element option, in order', () => {
        const labels = screen.getAllByRole('option').map((option) => option.textContent?.trim());

        expect(labels).toEqual([small.text, large.text]);
      });

      it('should give each option its value', () => {
        expect(screen.getByRole('option', { name: large.text })).toHaveValue(large.value);
      });

      it('should select the option the element value names', () => {
        expect(screen.getByRole('combobox', { name: 'Dropdown' })).toHaveValue(small.value);
      });

      it.each(formControlTestIds)('should not render %s', (testId) => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });

      it('should not render a div', () => {
        expect(screen.queryByTestId('dropped-div')).not.toBeInTheDocument();
      });

      it('should not render a span', () => {
        expect(screen.queryByTestId('dropped-span')).not.toBeInTheDocument();
      });

      it('should keep the option the user selects as the element value', () => {
        fireEvent.change(screen.getByRole('combobox', { name: 'Dropdown' }), {
          target: { value: large.value },
        });

        expect(screen.getByRole('combobox', { name: 'Dropdown' })).toHaveValue(large.value);
        expect(stored(store, dropdown)).toEqual({ ...dropdown, value: large.value });
      });
    });

    describe('with a later option selected', () => {
      beforeEach(() => {
        mount({ ...dropdown, value: large.value });
      });

      it('should select that option', () => {
        expect(screen.getByRole('combobox', { name: 'Dropdown' })).toHaveValue(large.value);
      });
    });

    describe('without options', () => {
      beforeEach(() => {
        mount({ ...dropdown, options: [], value: '' });
      });

      it('should render a select with no options', () => {
        expect(screen.getByRole('combobox', { name: 'Dropdown' })).toBeInTheDocument();
        expect(screen.queryAllByRole('option').length).toBe(0);
      });
    });
  });

  describe('actions button', () => {
    it.each([
      { element: div, name: 'Block text actions' },
      { element: span, name: 'Inline text actions' },
      { element: textInput, name: 'Text input actions' },
      { element: textfield, name: 'Textfield actions' },
      { element: datepicker, name: 'Datepicker actions' },
      { element: dropdown, name: 'Dropdown actions' },
    ])('should be named after the $element.type it acts on', ({ element, name }) => {
      mount(element);

      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });

    it('should give its menu the same name', async () => {
      mount(div);

      fireEvent.click(screen.getByRole('button', { name: divActions }));

      expect(await screen.findByRole('menu', { name: divActions })).toBeInTheDocument();
    });

    it('should be handed to the canvas, which moves focus to it', () => {
      const { actionsButtonRef } = mount(div);

      expect(actionsButtonRef).toHaveBeenLastCalledWith(
        screen.getByRole('button', { name: divActions }),
      );
    });

    it('should open its menu on the first item when activated from the keyboard', async () => {
      mount(div);
      screen.getByRole('button', { name: divActions }).focus();

      await userEvent.keyboard('{Enter}');

      await waitFor(() =>
        expect(screen.getByRole('menuitem', { name: 'Edit text' })).toHaveFocus(),
      );
    });

    it('should take the focus back when its menu is dismissed with Escape', async () => {
      mount(div);
      screen.getByRole('button', { name: divActions }).focus();
      await userEvent.keyboard('{Enter}');
      await screen.findByRole('menu', { name: divActions });

      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: divActions })).toHaveFocus());
    });
  });

  describe('actions menu when keys follow straight after the one that opens it', () => {
    beforeEach(() => {
      mount(div);
      screen.getByRole('button', { name: divActions }).focus();
    });

    it('should open the first action on a second Enter', async () => {
      await userEvent.keyboard('{Enter}{Enter}');

      expect(await screen.findByRole('dialog', { name: 'Edit text' })).toBeInTheDocument();
    });

    it('should reach the last action with End', async () => {
      await userEvent.keyboard('{Enter}{End}');

      await waitFor(() =>
        expect(screen.getByRole('menuitem', { name: 'Delete element' })).toHaveFocus(),
      );
    });
  });

  describe('actions menu of a datepicker', () => {
    beforeEach(() => {
      mount(datepicker);
    });

    it('should not offer edit text, as a date input shows no text', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Datepicker actions' }));

      await screen.findByRole('menu');

      expect(menuActions()).toEqual(['Delete element']);
    });
  });

  describe('actions menu of a text input', () => {
    let store: BuilderStore;

    beforeEach(() => {
      store = mount({ ...textInput, value: typed }).builderStore;
    });

    it('should list edit text then delete element', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Text input actions' }));

      await screen.findByRole('menu');

      expect(menuActions()).toEqual(['Edit text', 'Delete element']);
    });

    it('should change the placeholder to the saved text, leaving what was typed', async () => {
      await openAction('Text input actions', 'Edit text');
      const dialog = await screen.findByRole('dialog', { name: 'Edit text' });
      fireEvent.input(within(dialog).getByRole('textbox', { name: 'Text' }), {
        target: { value: 'Your name' },
      });

      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(screen.getByTestId('dropped-text-input')).toHaveAttribute(
          'placeholder',
          'Your name',
        ),
      );
      expect(screen.getByTestId('dropped-text-input')).toHaveValue(typed);
      expect(stored(store, textInput)).toEqual({ ...textInput, text: 'Your name', value: typed });
    });
  });

  describe('actions menu of a dropdown', () => {
    const medium = { text: 'Medium', value: 'm' };
    let store: BuilderStore;

    beforeEach(() => {
      store = mount(dropdown).builderStore;
    });

    it('should list edit options then delete element, without edit text', async () => {
      fireEvent.click(screen.getByRole('button', { name: dropdownActions }));

      await screen.findByRole('menu');

      expect(menuActions()).toEqual(['Edit options', 'Delete element']);
    });

    it('should open the edit options dialog, prefilled with the element options, from the edit options action', async () => {
      fireEvent.click(screen.getByRole('button', { name: dropdownActions }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit options' }));

      const dialog = await screen.findByRole('dialog', { name: 'Edit options' });

      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Option 1 text' })).toHaveValue(small.text);
      expect(screen.getByRole('textbox', { name: 'Option 1 value' })).toHaveValue(small.value);
      expect(screen.getByRole('textbox', { name: 'Option 2 text' })).toHaveValue(large.text);
      expect(screen.getByRole('textbox', { name: 'Option 2 value' })).toHaveValue(large.value);
    });

    it('should describe the edit options dialog by the element it edits', async () => {
      await openAction(dropdownActions, 'Edit options');

      expect(
        await screen.findByRole('dialog', { name: 'Edit options' }),
      ).toHaveAccessibleDescription('Set the text and value of each option in this <dropdown>.');
    });

    it('should return focus to the actions button when the edit options dialog is cancelled', async () => {
      fireEvent.click(screen.getByRole('button', { name: dropdownActions }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit options' }));
      await screen.findByRole('dialog', { name: 'Edit options' });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: dropdownActions })).toHaveFocus(),
      );
    });

    it('should return focus to the actions button when the edit options dialog is saved', async () => {
      await openAction(dropdownActions, 'Edit options');
      await screen.findByRole('dialog', { name: 'Edit options' });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: dropdownActions })).toHaveFocus(),
      );
    });

    it('should show the options the user saved', async () => {
      await openAction(dropdownActions, 'Edit options');
      await screen.findByRole('dialog', { name: 'Edit options' });
      fireEvent.input(screen.getByRole('textbox', { name: 'Option 1 text' }), {
        target: { value: medium.text },
      });
      fireEvent.input(screen.getByRole('textbox', { name: 'Option 1 value' }), {
        target: { value: medium.value },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getAllByRole('option').map((option) => option.textContent?.trim())).toEqual([
        medium.text,
        large.text,
      ]);
      expect(stored(store, dropdown)).toMatchObject({ options: [medium, large] });
    });

    it('should select the first saved option when the selected one is no longer among them', async () => {
      await openAction(dropdownActions, 'Edit options');
      await screen.findByRole('dialog', { name: 'Edit options' });
      fireEvent.input(screen.getByRole('textbox', { name: 'Option 1 value' }), {
        target: { value: medium.value },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(screen.getByRole('combobox', { name: 'Dropdown' })).toHaveValue(medium.value),
      );
    });

    it('should leave the options unchanged when the user cancels', async () => {
      await openAction(dropdownActions, 'Edit options');
      await screen.findByRole('dialog', { name: 'Edit options' });
      fireEvent.input(screen.getByRole('textbox', { name: 'Option 1 text' }), {
        target: { value: medium.text },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getAllByRole('option').map((option) => option.textContent?.trim())).toEqual([
        small.text,
        large.text,
      ]);
      expect(stored(store, dropdown)).toEqual(dropdown);
    });
  });

  describe('actions menu', () => {
    let store: BuilderStore;
    let onRemoved: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      ({ builderStore: store, onRemoved } = mount(div));
    });

    it('should list edit text then delete element when the actions button is clicked', async () => {
      fireEvent.click(screen.getByRole('button', { name: divActions }));

      await screen.findByRole('menu');

      expect(menuActions()).toEqual(['Edit text', 'Delete element']);
    });

    it('should open the delete confirmation from the delete element action', async () => {
      fireEvent.click(screen.getByRole('button', { name: divActions }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete element' }));

      const dialog = await screen.findByRole('alertdialog', { name: 'Delete element' });

      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should describe the delete confirmation by the element it removes', async () => {
      await openAction(divActions, 'Delete element');

      expect(
        await screen.findByRole('alertdialog', { name: 'Delete element' }),
      ).toHaveAccessibleDescription('Remove this <div> from the canvas? This cannot be undone.');
    });

    it('should return focus to the actions button when the deletion is cancelled', async () => {
      fireEvent.click(screen.getByRole('button', { name: divActions }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete element' }));
      await screen.findByRole('alertdialog', { name: 'Delete element' });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.getByRole('button', { name: divActions })).toHaveFocus());
    });

    it('should keep the element when the deletion is cancelled', async () => {
      await openAction(divActions, 'Delete element');
      await screen.findByRole('alertdialog', { name: 'Delete element' });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(screen.getByTestId('dropped-div')).toBeInTheDocument();
      expect(store.getState().canvasElements).toEqual([div]);
    });

    it('should report no removal when the deletion is cancelled', async () => {
      await openAction(divActions, 'Delete element');
      await screen.findByRole('alertdialog', { name: 'Delete element' });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(onRemoved).not.toHaveBeenCalled();
    });

    it('should remove the element once the deletion is confirmed', async () => {
      await openAction(divActions, 'Delete element');
      await screen.findByRole('alertdialog', { name: 'Delete element' });

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.queryByTestId('dropped-div')).not.toBeInTheDocument());
      expect(store.getState().canvasElements).toEqual([]);
    });

    it('should report the removal once the deletion is confirmed', async () => {
      await openAction(divActions, 'Delete element');
      await screen.findByRole('alertdialog', { name: 'Delete element' });

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    });

    it('should open the edit text dialog, prefilled with the element text, from the edit text action', async () => {
      fireEvent.click(screen.getByRole('button', { name: divActions }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit text' }));

      const dialog = await screen.findByRole('dialog', { name: 'Edit text' });

      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue(text);
    });

    it('should describe the edit text dialog by the element it edits', async () => {
      await openAction(divActions, 'Edit text');

      expect(await screen.findByRole('dialog', { name: 'Edit text' })).toHaveAccessibleDescription(
        'Change the text shown inside this <div>.',
      );
    });

    it('should return focus to the actions button when the edit text dialog is cancelled', async () => {
      fireEvent.click(screen.getByRole('button', { name: divActions }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit text' }));
      await screen.findByRole('dialog', { name: 'Edit text' });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.getByRole('button', { name: divActions })).toHaveFocus());
    });

    it('should return focus to the actions button when the edit text dialog is saved', async () => {
      await openAction(divActions, 'Edit text');
      await screen.findByRole('dialog', { name: 'Edit text' });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.getByRole('button', { name: divActions })).toHaveFocus());
    });

    it('should show the text the user saved', async () => {
      await openAction(divActions, 'Edit text');
      await screen.findByRole('dialog', { name: 'Edit text' });
      fireEvent.input(screen.getByRole('textbox', { name: 'Text' }), {
        target: { value: 'Hello' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.getByTestId('dropped-div')).toHaveTextContent('Hello'));
      expect(stored(store, div)).toEqual({ ...div, text: 'Hello' });
    });

    it('should leave the text unchanged when the user cancels', async () => {
      await openAction(divActions, 'Edit text');
      await screen.findByRole('dialog', { name: 'Edit text' });
      fireEvent.input(screen.getByRole('textbox', { name: 'Text' }), {
        target: { value: 'Hello' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByTestId('dropped-div')).toHaveTextContent(text);
      expect(stored(store, div)).toEqual(div);
    });
  });

  describe('actions menu of an element that shares its cell', () => {
    const first: TextCanvasElement = { ...div, uid: 'first' };
    const middle: TextCanvasElement = { ...div, uid: 'middle' };
    const last: TextCanvasElement = { ...div, uid: 'last' };
    const neighbours = [first, middle, last];

    async function openMenuOf(element: CanvasElement) {
      const mounted = mount(element, { canvasElements: neighbours });
      fireEvent.click(screen.getByRole('button', { name: divActions }));
      await screen.findByRole('menu');
      return mounted;
    }

    it('should offer to move the element earlier and later, between editing and deleting', async () => {
      await openMenuOf(middle);

      expect(menuActions()).toEqual(['Edit text', 'Move earlier', 'Move later', 'Delete element']);
    });

    it('should enable both moves for an element in between', async () => {
      await openMenuOf(middle);

      expect(screen.getByRole('menuitem', { name: moveEarlier })).not.toHaveAttribute(
        'aria-disabled',
      );
      expect(screen.getByRole('menuitem', { name: moveLater })).not.toHaveAttribute(
        'aria-disabled',
      );
    });

    it('should disable move earlier for the first element', async () => {
      await openMenuOf(first);

      expect(screen.getByRole('menuitem', { name: moveEarlier })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('menuitem', { name: moveLater })).not.toHaveAttribute(
        'aria-disabled',
      );
    });

    it('should disable move later for the last element', async () => {
      await openMenuOf(last);

      expect(screen.getByRole('menuitem', { name: moveLater })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('menuitem', { name: moveEarlier })).not.toHaveAttribute(
        'aria-disabled',
      );
    });

    it.each([moveEarlier, moveLater])('should close the menu once %s is picked', async (action) => {
      await openMenuOf(middle);

      fireEvent.click(screen.getByRole('menuitem', { name: action }));

      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    });

    it('should move the element one place earlier among the elements of its own cell', async () => {
      const { builderStore } = await openMenuOf(last);

      fireEvent.click(screen.getByRole('menuitem', { name: moveEarlier }));

      expect(uidsIn(builderStore, 0, 0)).toEqual([first.uid, last.uid, middle.uid]);
    });

    it('should move the element one place later among the elements of its own cell', async () => {
      const { builderStore } = await openMenuOf(first);

      fireEvent.click(screen.getByRole('menuitem', { name: moveLater }));

      expect(uidsIn(builderStore, 0, 0)).toEqual([middle.uid, first.uid, last.uid]);
    });

    it.each([moveEarlier, moveLater])(
      'should report a move within its cell once %s is picked',
      async (action) => {
        const { onMoved } = await openMenuOf(middle);

        fireEvent.click(screen.getByRole('menuitem', { name: action }));

        expect(onMoved).toHaveBeenCalledTimes(1);
      },
    );

    it('should leave the element where it is when the disabled move is picked', async () => {
      const { builderStore, onMoved } = await openMenuOf(first);

      fireEvent.click(screen.getByRole('menuitem', { name: moveEarlier }));

      expect(uidsIn(builderStore, 0, 0)).toEqual([first.uid, middle.uid, last.uid]);
      expect(onMoved).not.toHaveBeenCalled();
    });

    it('should keep the menu open when the disabled move is picked from the keyboard', async () => {
      mount(first, { canvasElements: neighbours });
      screen.getByRole('button', { name: divActions }).focus();
      await userEvent.keyboard('{Enter}');
      await screen.findByRole('menu', { name: divActions });
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(screen.getByRole('menuitem', { name: moveEarlier })).toHaveFocus(),
      );

      await userEvent.keyboard('{Enter}');

      expect(screen.getByRole('menu', { name: divActions })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: moveEarlier })).toHaveFocus();
    });
  });

  describe('actions menu of an element in a grid of several cells', () => {
    const grid: GridLayout = { rows: 2, columns: 2 };
    let store: BuilderStore;
    let onMoved: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      ({ builderStore: store, onMoved } = mount(div, { grid }));
      fireEvent.click(screen.getByRole('button', { name: divActions }));
      await screen.findByRole('menu');
    });

    it('should offer to move the element to another cell', () => {
      expect(menuActions()).toEqual(['Edit text', moveToCell, 'Delete element']);
    });

    it('should list every cell but its own in the move to cell menu', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: moveToCell }));

      const cellMenu = await screen.findByRole('menu', { name: moveToCell });
      const targets = within(cellMenu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim());

      expect(targets).toEqual(['Row 1, column 2', 'Row 2, column 1', 'Row 2, column 2']);
    });

    it('should close both menus once a cell is picked', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: moveToCell }));
      const cellMenu = await screen.findByRole('menu', { name: moveToCell });

      fireEvent.click(within(cellMenu).getByRole('menuitem', { name: 'Row 2, column 2' }));

      await waitFor(() => expect(screen.queryAllByRole('menu').length).toBe(0));
    });

    it('should move the element to the picked cell', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: moveToCell }));
      const cellMenu = await screen.findByRole('menu', { name: moveToCell });

      fireEvent.click(within(cellMenu).getByRole('menuitem', { name: 'Row 2, column 2' }));

      expect(uidsIn(store, 0, 0)).toEqual([]);
      expect(uidsIn(store, 1, 1)).toEqual([div.uid]);
    });

    it('should report a move to another cell', async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: moveToCell }));
      const cellMenu = await screen.findByRole('menu', { name: moveToCell });

      fireEvent.click(within(cellMenu).getByRole('menuitem', { name: 'Row 2, column 2' }));

      expect(onMoved).toHaveBeenCalledTimes(1);
    });
  });

  describe('actions menu opened from the keyboard in a grid of several cells', () => {
    beforeEach(async () => {
      mount(div, { grid: { rows: 2, columns: 2 } });
      screen.getByRole('button', { name: divActions }).focus();
      await userEvent.keyboard('{Enter}');
      await screen.findByRole('menu', { name: divActions });
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(screen.getByRole('menuitem', { name: moveToCell })).toHaveFocus());
    });

    it('should open the move to cell menu on its first cell with the right arrow key', async () => {
      await userEvent.keyboard('{ArrowRight}');

      await waitFor(() =>
        expect(screen.getByRole('menuitem', { name: 'Row 1, column 2' })).toHaveFocus(),
      );
    });
  });

  describe('actions menu of an element whose target cell already holds elements', () => {
    const first: TextCanvasElement = { ...div, uid: 'first' };
    const second: TextCanvasElement = { ...div, uid: 'second' };
    const elsewhere: TextCanvasElement = { ...div, uid: 'elsewhere', row: 0, column: 1 };

    it('should move the element to the end of the picked cell', async () => {
      const { builderStore } = mount(first, {
        grid: { rows: 1, columns: 2 },
        canvasElements: [first, elsewhere, second],
      });
      fireEvent.click(screen.getByRole('button', { name: divActions }));
      fireEvent.click(await screen.findByRole('menuitem', { name: moveToCell }));
      const cellMenu = await screen.findByRole('menu', { name: moveToCell });

      fireEvent.click(within(cellMenu).getByRole('menuitem', { name: 'Row 1, column 2' }));

      expect(uidsIn(builderStore, 0, 0)).toEqual([second.uid]);
      expect(uidsIn(builderStore, 0, 1)).toEqual([elsewhere.uid, first.uid]);
    });

    it('should list every action a dropdown has, in order, when it shares its cell and the grid has more', async () => {
      const sibling: DropdownCanvasElement = { ...dropdown, uid: 'sibling' };
      mount(dropdown, { grid: { rows: 1, columns: 2 }, canvasElements: [dropdown, sibling] });

      fireEvent.click(screen.getByRole('button', { name: dropdownActions }));
      await screen.findByRole('menu');

      expect(menuActions()).toEqual([
        'Edit options',
        moveEarlier,
        moveLater,
        moveToCell,
        'Delete element',
      ]);
    });
  });
});
