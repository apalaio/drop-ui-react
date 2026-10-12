import type Anthropic from '@anthropic-ai/sdk';
import type { GeneratedElement } from '../src/app/features/builder/models/generated-element';
import { GENERATED_UI_SCHEMA, toGeneratedElements } from './generated-ui';

export type GenerateUi = (text: string) => Promise<GeneratedElement[]>;

export type SendMessage = (
  params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Beta.Messages.BetaMessage>;

export const DEFAULT_MODEL = 'claude-opus-5-5';

export class MissingApiKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set on the server.');
    this.name = 'MissingApiKeyError';
  }
}

const SYSTEM_PROMPT = `You turn a description of a user interface into the elements of a drag & drop UI builder.

The elements are placed on a canvas in the order you list them, top to bottom. These are the only kinds:
- "div": a block of static text, such as a heading or a paragraph. "text" is what it shows.
- "span": a short piece of inline static text. "text" is what it shows.
- "text-input": a single line text input. "text" is its placeholder.
- "textfield": a multi-line text input. "text" is its placeholder.
- "datepicker": a date input. It has no text.
- "dropdown": a select. "options" are its choices, each with the "text" the user sees and a short lowercase "value".

Inputs, datepickers and dropdowns have no label of their own, so put a "span" naming the field right before each of them. Give a dropdown the realistic choices a user would expect. There are no buttons, checkboxes or images: leave out what these kinds cannot express. Answer an empty list when the description asks for no interface at all.`;

/** With no send function there is no key: the server still starts and each request fails on its own. */
export function createClaudeGenerator(send: SendMessage | undefined, model: string): GenerateUi {
  return async (text) => {
    if (!send) {
      throw new MissingApiKeyError();
    }
    const message = await send({
      model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: GENERATED_UI_SCHEMA },
      },
      messages: [{ role: 'user', content: text }],
    });
    if (message.stop_reason !== 'end_turn') {
      throw new Error(`Claude stopped without a complete answer: ${message.stop_reason}.`);
    }
    const answer = message.content.find((block) => block.type === 'text');
    if (!answer) {
      throw new Error('Claude answered without any text.');
    }
    return toGeneratedElements(JSON.parse(answer.text));
  };
}
