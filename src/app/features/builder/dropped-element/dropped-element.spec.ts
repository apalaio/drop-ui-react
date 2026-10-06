import { createElement } from 'react';
import { renderWithStores } from '../../../../test/render-with-stores';
import {
  CanvasElement,
  DatepickerCanvasElement,
  DropdownCanvasElement,
  TextCanvasElement,
  TextControlCanvasElement,
} from '../models/canvas-element';
import { ElementType } from '../models/palette-item';
import { displayClass, DroppedElement, OUTLINE } from './dropped-element';

describe('DroppedElement', () => {
  const cell = { row: 0, column: 0 };
  const div: TextCanvasElement = {
    uid: 'element-1',
    type: 'div',
    paletteUid: 'palette-div',
    text: 'enter text',
    ...cell,
  };
  const span: TextCanvasElement = {
    ...div,
    uid: 'element-2',
    type: 'span',
    paletteUid: 'palette-span',
  };
  const textInput: TextControlCanvasElement = {
    uid: 'element-4',
    type: 'text-input',
    paletteUid: 'palette-text-input',
    text: 'enter text',
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
  const dropdown: DropdownCanvasElement = {
    uid: 'element-3',
    type: 'dropdown',
    paletteUid: 'palette-dropdown',
    options: [{ text: 'Small', value: 's' }],
    value: 's',
    ...cell,
  };
  const everyType: ElementType[] = [
    'div',
    'span',
    'text-input',
    'textfield',
    'datepicker',
    'dropdown',
  ];

  function classesOf(classes: string): string[] {
    return classes.split(/\s+/).filter(Boolean);
  }

  describe('hover outline', () => {
    it('covers every element type', () => {
      expect(Object.keys(OUTLINE).sort()).toEqual([...everyType].sort());
    });

    it('gives a div a dashed primary hover outline', () => {
      const classes = classesOf(OUTLINE.div);

      expect(classes).toContain('border-dashed');
      expect(classes).toContain('hover:border-primary/40');
    });

    it('gives a span a dotted secondary hover outline', () => {
      const classes = classesOf(OUTLINE.span);

      expect(classes).toContain('border-dotted');
      expect(classes).toContain('hover:border-secondary');
      expect(classes).not.toContain('hover:border-primary/40');
    });

    it('gives a dropdown a dashed accent hover outline', () => {
      const classes = classesOf(OUTLINE.dropdown);

      expect(classes).toContain('border-dashed');
      expect(classes).toContain('hover:border-accent');
      expect(classes).not.toContain('hover:border-primary/40');
    });

    it.each(['text-input', 'textfield', 'datepicker'] as const)(
      'gives a %s a dashed info hover outline',
      (type) => {
        const classes = classesOf(OUTLINE[type]);

        expect(classes).toContain('border-dashed');
        expect(classes).toContain('hover:border-info');
        expect(classes).not.toContain('hover:border-primary/40');
      },
    );

    it.each([
      { type: 'div', outline: 'border-primary/40' },
      { type: 'span', outline: 'border-secondary' },
      { type: 'text-input', outline: 'border-info' },
      { type: 'textfield', outline: 'border-info' },
      { type: 'datepicker', outline: 'border-info' },
      { type: 'dropdown', outline: 'border-accent' },
    ] as const)('shows a $type the same outline while focus is inside it', ({ type, outline }) => {
      const classes = classesOf(OUTLINE[type]);

      expect(classes).toContain(`hover:${outline}`);
      expect(classes).toContain(`focus-within:${outline}`);
    });
  });

  describe('display', () => {
    it('lays a span out inline', () => {
      const classes = classesOf(displayClass('span'));

      expect(classes).toContain('inline-block');
      expect(classes).not.toContain('block');
    });

    it.each(['div', 'text-input', 'textfield', 'datepicker', 'dropdown'] as const)(
      'lays a %s out as a block',
      (type) => {
        const classes = classesOf(displayClass(type));

        expect(classes).toContain('block');
        expect(classes).not.toContain('inline-block');
      },
    );
  });

  describe('wrapper', () => {
    function wrapperClassesOf(element: CanvasElement): string[] {
      renderWithStores(
        createElement(DroppedElement, {
          element,
          index: 0,
          siblingCount: 1,
          onMoved: () => undefined,
          onRemoved: () => undefined,
          actionsButtonRef: () => undefined,
        }),
        { initial: { canvasElements: [element] } },
      );
      const wrapper = document.querySelector(`[data-uid="${element.uid}"]`);
      if (!wrapper) throw new Error(`No wrapper tagged with uid ${element.uid}`);
      return Array.from(wrapper.classList);
    }

    beforeEach(() => {
      vi.stubGlobal('matchMedia', () => ({
        matches: false,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it.each([div, span, textInput, textfield, datepicker, dropdown])(
      'carries the outline of a $type',
      (element) => {
        expect(wrapperClassesOf(element)).toEqual(
          expect.arrayContaining(classesOf(OUTLINE[element.type])),
        );
      },
    );

    it.each([div, span, textInput, textfield, datepicker, dropdown])(
      'carries the display of a $type',
      (element) => {
        expect(wrapperClassesOf(element)).toEqual(
          expect.arrayContaining(classesOf(displayClass(element.type))),
        );
      },
    );

    it('keeps the static wrapper classes alongside the hover outline', () => {
      const classes = wrapperClassesOf(div);

      expect(classes).toContain('cursor-grab');
      expect(classes).toContain('group');
      expect(classes).toContain('relative');
    });

    it('lays only a span out inline', () => {
      expect(wrapperClassesOf(span)).toContain('inline-block');
      expect(wrapperClassesOf(div)).not.toContain('inline-block');
    });
  });
});
