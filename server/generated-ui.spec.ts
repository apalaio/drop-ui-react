import { GENERATED_UI_SCHEMA, toGeneratedElements } from './generated-ui';

describe('toGeneratedElements', () => {
  it('returns an empty list as it is', () => {
    expect(toGeneratedElements({ elements: [] })).toEqual([]);
  });

  it.each(['div', 'span', 'text-input', 'textfield'])('keeps a %s with its text', (type) => {
    expect(toGeneratedElements({ elements: [{ type, text: 'Name' }] })).toEqual([
      { type, text: 'Name' },
    ]);
  });

  it('keeps a datepicker', () => {
    expect(toGeneratedElements({ elements: [{ type: 'datepicker' }] })).toEqual([
      { type: 'datepicker' },
    ]);
  });

  it('keeps a dropdown with its options', () => {
    const options = [
      { text: 'Greece', value: 'gr' },
      { text: 'Italy', value: 'it' },
    ];

    expect(toGeneratedElements({ elements: [{ type: 'dropdown', options }] })).toEqual([
      { type: 'dropdown', options },
    ]);
  });

  it('keeps the elements in the order they came', () => {
    const elements = [
      { type: 'span', text: 'Birthday' },
      { type: 'datepicker' },
      { type: 'dropdown', options: [] },
    ];

    expect(toGeneratedElements({ elements })).toEqual(elements);
  });

  it('drops every field the type of the element does not have', () => {
    const elements = [
      { type: 'div', text: 'Sign up', id: 'e1', onclick: 'alert(1)' },
      { type: 'datepicker', text: 'Birthday' },
      { type: 'dropdown', text: 'Country', options: [{ text: 'Greece', value: 'gr', flag: true }] },
    ];

    expect(toGeneratedElements({ elements, note: 'done' })).toEqual([
      { type: 'div', text: 'Sign up' },
      { type: 'datepicker' },
      { type: 'dropdown', options: [{ text: 'Greece', value: 'gr' }] },
    ]);
  });

  it.each([
    ['nothing', null],
    ['a string', 'elements'],
    ['a bare list', [{ type: 'datepicker' }]],
    ['no elements', {}],
    ['elements that are not a list', { elements: { type: 'datepicker' } }],
  ])('rejects an answer that is %s', (_, answer) => {
    expect(() => toGeneratedElements(answer)).toThrow('no list of elements');
  });

  it.each([
    ['an unknown type', { type: 'button', text: 'Send' }, 'Unknown element type: button'],
    ['no type', { text: 'Send' }, 'Unknown element type'],
    ['a type that is not a string', { type: 7 }, 'Unknown element type'],
    ['a type inherited from Object', { type: 'constructor' }, 'Unknown element type'],
    ['an element that is not an object', 'div', 'not an object'],
    ['an element that is a list', ['div'], 'not an object'],
    ['an element that is nothing', null, 'not an object'],
    ['a div without a text', { type: 'div' }, 'needs a text'],
    ['a text input with a text that is not a string', { type: 'text-input', text: 42 }, 'text'],
    ['a dropdown without options', { type: 'dropdown' }, 'list of options'],
    ['a dropdown with options that are not a list', { type: 'dropdown', options: 'a' }, 'options'],
    [
      'a dropdown option without a value',
      { type: 'dropdown', options: [{ text: 'Greece' }] },
      'a text and a value',
    ],
    [
      'a dropdown option with a text that is not a string',
      { type: 'dropdown', options: [{ text: 1, value: 'gr' }] },
      'a text and a value',
    ],
    ['a dropdown option that is nothing', { type: 'dropdown', options: [null] }, 'a text and a'],
  ])('rejects %s', (_, element, message) => {
    expect(() => toGeneratedElements({ elements: [element] })).toThrow(message);
  });

  it('rejects the whole answer when one element among valid ones is wrong', () => {
    const elements = [{ type: 'span', text: 'Name' }, { type: 'slider' }];

    expect(() => toGeneratedElements({ elements })).toThrow('Unknown element type: slider');
  });
});

describe('GENERATED_UI_SCHEMA', () => {
  const variants = GENERATED_UI_SCHEMA.properties.elements.items.anyOf;

  it('names every element type exactly once', () => {
    const types = variants.flatMap((variant) => variant.properties.type.enum);

    expect(types.sort()).toEqual(
      ['datepicker', 'div', 'dropdown', 'span', 'text-input', 'textfield'].sort(),
    );
  });

  it('closes every object, as structured outputs require', () => {
    const open: unknown[] = [];
    const visit = (node: unknown): void => {
      if (typeof node !== 'object' || node === null) {
        return;
      }
      if (
        'type' in node &&
        node.type === 'object' &&
        !('additionalProperties' in node && node.additionalProperties === false)
      ) {
        open.push(node);
      }
      Object.values(node).forEach(visit);
    };

    visit(GENERATED_UI_SCHEMA);

    expect(open).toEqual([]);
  });
});
