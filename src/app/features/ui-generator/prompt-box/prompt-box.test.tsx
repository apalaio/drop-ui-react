import { fireEvent, screen, waitFor } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { GENERATED_ELEMENTS, renderWithStores } from '../../../../test/render-with-stores';
import { TextCanvasElement } from '../../builder/models/canvas-element';
import { GeneratedElement } from '../../builder/models/generated-element';
import { UiGeneratorError } from '../services/ui-generator-service';
import { PromptBox } from './prompt-box';

describe(PromptBox.name, () => {
  const label = 'Describe a UI';
  const generate = 'Generate';
  const generating = 'Generating…';
  const failed = 'Could not generate a UI.';
  const reason = 'Describe the UI in at most 2000 characters.';
  const prompt = 'a signup form with name, birthday and country';
  const existing: TextCanvasElement = {
    uid: 'element-1',
    type: 'div',
    paletteUid: 'palette-div',
    text: 'enter text',
    row: 0,
    column: 0,
  };

  const unanswered = (): Promise<GeneratedElement[]> => new Promise(() => undefined);
  const refused = (): Promise<GeneratedElement[]> => Promise.reject(new Error('offline'));
  const explained = (): Promise<GeneratedElement[]> => Promise.reject(new UiGeneratorError(reason));

  function field(): HTMLTextAreaElement {
    return screen.getByRole('textbox', { name: label });
  }

  function button(name: string): HTMLElement {
    return screen.getByRole('button', { name });
  }

  function type(value: string): void {
    fireEvent.input(field(), { target: { value } });
  }

  function submit(value = prompt): void {
    type(value);
    fireEvent.click(button(generate));
  }

  describe('before anything is typed', () => {
    beforeEach(() => {
      renderWithStores(<PromptBox />);
    });

    it('should render an empty field', () => {
      expect(field()).toHaveValue('');
    });

    it('should disable the button', () => {
      expect(button(generate)).toBeDisabled();
    });

    it('should not render an error', () => {
      expect(screen.queryByText(failed)).not.toBeInTheDocument();
    });

    it('should not be busy', () => {
      expect(screen.getByRole('form', { name: label })).toHaveAttribute('aria-busy', 'false');
    });
  });

  describe('once a description is typed', () => {
    beforeEach(() => {
      renderWithStores(<PromptBox />);
      type(prompt);
    });

    it('should show what was typed', () => {
      expect(field()).toHaveValue(prompt);
    });

    it('should enable the button', () => {
      expect(button(generate)).toBeEnabled();
    });

    it('should disable the button again when the field is cleared', () => {
      type('');

      expect(button(generate)).toBeDisabled();
    });
  });

  describe('with nothing but blanks typed', () => {
    beforeEach(() => {
      renderWithStores(<PromptBox />);
      type('  \n ');
    });

    it('should disable the button', () => {
      expect(button(generate)).toBeDisabled();
    });
  });

  describe('when a description is submitted', () => {
    let sent: string[];
    let stores: ReturnType<typeof renderWithStores>;

    beforeEach(() => {
      sent = [];
      stores = renderWithStores(<PromptBox />, {
        initial: { grid: { rows: 2, columns: 2 }, canvasElements: [existing] },
        uiGeneratorService: {
          generate: (text) => {
            sent.push(text);
            return Promise.resolve(GENERATED_ELEMENTS);
          },
        },
      });
      submit();
    });

    it('should send what was typed', () => {
      expect(sent).toEqual([prompt]);
    });

    it('should put the generated elements on the canvas in their order', async () => {
      await waitFor(() =>
        expect(stores.builderStore.getState().canvasElements.map(({ type }) => type)).toEqual(
          GENERATED_ELEMENTS.map(({ type }) => type),
        ),
      );
    });

    it('should replace what was on the canvas', async () => {
      await waitFor(() =>
        expect(
          stores.builderStore.getState().canvasElements.some(({ uid }) => uid === existing.uid),
        ).toBe(false),
      );
    });

    it('should announce the generated elements', async () => {
      expect(
        await screen.findByText('4 elements generated.', { selector: '[aria-live]' }),
      ).toHaveAttribute('aria-live', 'polite');
    });

    it('should offer to generate again', async () => {
      expect(await screen.findByRole('button', { name: generate })).toBeEnabled();
    });

    it('should keep the description in the field', async () => {
      await screen.findByRole('button', { name: generate });

      expect(field()).toHaveValue(prompt);
    });

    it('should not render an error', async () => {
      await screen.findByRole('button', { name: generate });

      expect(screen.queryByText(failed)).not.toBeInTheDocument();
    });
  });

  describe('when the form is submitted from the keyboard', () => {
    it('should put the generated elements on the canvas', async () => {
      const { builderStore } = renderWithStores(<PromptBox />);
      type(prompt);
      button(generate).focus();

      await userEvent.keyboard('{Enter}');

      await waitFor(() =>
        expect(builderStore.getState().canvasElements.length).toBe(GENERATED_ELEMENTS.length),
      );
    });
  });

  describe('while the elements are on their way', () => {
    let stores: ReturnType<typeof renderWithStores>;

    beforeEach(() => {
      stores = renderWithStores(<PromptBox />, {
        initial: { canvasElements: [existing] },
        uiGeneratorService: { generate: unanswered },
      });
      submit();
    });

    it('should say that it is generating', () => {
      expect(button(generating)).toBeInTheDocument();
    });

    it('should disable the button', () => {
      expect(button(generating)).toBeDisabled();
    });

    it('should not offer to generate', () => {
      expect(screen.queryByRole('button', { name: generate })).not.toBeInTheDocument();
    });

    it('should be busy', () => {
      expect(screen.getByRole('form', { name: label })).toHaveAttribute('aria-busy', 'true');
    });

    it('should leave the canvas as it was', () => {
      expect(stores.builderStore.getState().canvasElements).toEqual([existing]);
    });
  });

  describe('when the backend explains its refusal', () => {
    let stores: ReturnType<typeof renderWithStores>;

    beforeEach(async () => {
      stores = renderWithStores(<PromptBox />, {
        initial: { canvasElements: [existing] },
        uiGeneratorService: { generate: explained },
      });
      submit();
      await screen.findByText(reason, { selector: 'p' });
    });

    it('should render the reason', () => {
      expect(screen.getByText(reason, { selector: 'p' })).toBeInTheDocument();
    });

    it('should announce the reason', async () => {
      expect(await screen.findByText(reason, { selector: '[aria-live]' })).toHaveAttribute(
        'aria-live',
        'polite',
      );
    });

    it('should leave the canvas as it was', () => {
      expect(stores.builderStore.getState().canvasElements).toEqual([existing]);
    });

    it('should offer to generate again', () => {
      expect(button(generate)).toBeEnabled();
    });

    it('should not be busy', () => {
      expect(screen.getByRole('form', { name: label })).toHaveAttribute('aria-busy', 'false');
    });
  });

  describe('when the request fails in any other way', () => {
    beforeEach(async () => {
      renderWithStores(<PromptBox />, { uiGeneratorService: { generate: refused } });
      submit();
      await screen.findByText(failed, { selector: 'p' });
    });

    it('should render the general error', () => {
      expect(screen.getByText(failed, { selector: 'p' })).toBeInTheDocument();
    });

    it('should not render the technical error', () => {
      expect(screen.queryByText('offline')).not.toBeInTheDocument();
    });
  });

  describe('when generating again after a failure', () => {
    beforeEach(async () => {
      let asked = 0;
      renderWithStores(<PromptBox />, {
        uiGeneratorService: {
          generate: () => (asked++ === 0 ? refused() : unanswered()),
        },
      });
      submit();
      await screen.findByText(failed, { selector: 'p' });
      fireEvent.click(button(generate));
    });

    it('should take the error away', () => {
      expect(screen.queryByText(failed, { selector: 'p' })).not.toBeInTheDocument();
    });
  });

  describe('with an error that is already there', () => {
    beforeEach(() => {
      renderWithStores(<PromptBox />, {
        uiGeneratorState: { status: 'error', error: reason },
      });
    });

    it('should render that error', () => {
      expect(screen.getByText(reason)).toBeInTheDocument();
    });
  });
});
