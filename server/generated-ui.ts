import type { DropdownOption } from '../src/app/features/builder/models/dropdown-option';
import type { GeneratedElement } from '../src/app/features/builder/models/generated-element';

const TEXT_TYPES = ['div', 'span', 'text-input', 'textfield'] as const;

/** The answer Claude is constrained to. Every object is closed, which structured outputs require. */
export const GENERATED_UI_SCHEMA = {
  type: 'object',
  properties: {
    elements: {
      type: 'array',
      items: {
        anyOf: [
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: [...TEXT_TYPES] },
              text: { type: 'string' },
            },
            required: ['type', 'text'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: { type: { type: 'string', enum: ['datepicker'] } },
            required: ['type'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['dropdown'] },
              options: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { text: { type: 'string' }, value: { type: 'string' } },
                  required: ['text', 'value'],
                  additionalProperties: false,
                },
              },
            },
            required: ['type', 'options'],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ['elements'],
  additionalProperties: false,
};

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
    return { type, options: value['options'].map(toOption) };
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
