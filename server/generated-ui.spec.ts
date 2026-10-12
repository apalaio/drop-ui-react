import { GENERATED_UI_SCHEMA } from './generated-ui';

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
