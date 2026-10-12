import { TEXT_TYPES } from '../src/app/features/builder/models/generated-element';

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
