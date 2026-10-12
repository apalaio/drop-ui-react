import { DropdownOption } from './dropdown-option';

/** An element as the generation endpoint describes it: what a canvas element holds, minus identity and position. */
export type GeneratedElement =
  | { type: 'div' | 'span'; text: string }
  | { type: 'text-input' | 'textfield'; text: string }
  | { type: 'datepicker' }
  | { type: 'dropdown'; options: DropdownOption[] };

export interface GeneratedUi {
  elements: GeneratedElement[];
}

export const TEXT_TYPES = ['div', 'span', 'text-input', 'textfield'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTextType = (type: unknown): type is (typeof TEXT_TYPES)[number] =>
  TEXT_TYPES.some((known) => known === type);

function toOption(value: unknown): DropdownOption {
  if (isRecord(value) && typeof value['text'] === 'string' && typeof value['value'] === 'string') {
    return { text: value['text'], value: value['value'] };
  }
  throw new Error('A dropdown option needs a text and a value.');
}

/*
 * A blank option could not be saved from the options dialog, and of two options with one value
 * only the first can ever be selected. Both are dropped rather than failing the whole generation.
 */
function toOptions(values: unknown[]): DropdownOption[] {
  const seen = new Set<string>();
  return values.map(toOption).filter(({ text, value }) => {
    if (!text.trim() || !value.trim() || seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function toElement(value: unknown): GeneratedElement {
  if (!isRecord(value)) {
    throw new Error('An element is not an object.');
  }
  const type = value['type'];
  if (isTextType(type)) {
    if (typeof value['text'] !== 'string') {
      throw new Error(`A ${type} element needs a text.`);
    }
    return { type, text: value['text'] };
  }
  if (type === 'datepicker') {
    return { type };
  }
  if (type === 'dropdown') {
    if (!Array.isArray(value['options'])) {
      throw new Error('A dropdown element needs a list of options.');
    }
    return { type, options: toOptions(value['options']) };
  }
  throw new Error(`Unknown element type: ${String(type)}.`);
}

/** Rebuilds every element from the fields its type has, so nothing unknown reaches the canvas. */
export function toGeneratedElements(body: unknown): GeneratedElement[] {
  if (!isRecord(body) || !Array.isArray(body['elements'])) {
    throw new Error('The answer has no list of elements.');
  }
  return body['elements'].map(toElement);
}
