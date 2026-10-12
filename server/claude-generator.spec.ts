import type Anthropic from '@anthropic-ai/sdk';
import {
  createClaudeGenerator,
  DEFAULT_MODEL,
  GenerateUi,
  MissingApiKeyError,
  SendMessage,
} from './claude-generator';
import { GENERATED_UI_SCHEMA } from './generated-ui';

type Message = Anthropic.Beta.Messages.BetaMessage;

describe('createClaudeGenerator', () => {
  const elements = [
    { type: 'span', text: 'Name' },
    { type: 'text-input', text: 'Your name' },
  ];

  let send: ReturnType<typeof vi.fn<SendMessage>>;
  let generate: GenerateUi;

  function answerWith(message: Partial<Message>): void {
    send.mockResolvedValue({ stop_reason: 'end_turn', content: [], ...message } as Message);
  }

  function text(value: string): Message['content'] {
    return [{ type: 'text', text: value, citations: null }] as Message['content'];
  }

  beforeEach(() => {
    send = vi.fn<SendMessage>();
    generate = createClaudeGenerator(send, DEFAULT_MODEL);
    answerWith({ content: text(JSON.stringify({ elements })) });
  });

  it('defaults to Claude Opus 5.5', () => {
    expect(DEFAULT_MODEL).toBe('claude-opus-5-5');
  });

  it('sends the description as the one user message', async () => {
    await generate('a name field');

    expect(send.mock.calls[0][0].messages).toEqual([{ role: 'user', content: 'a name field' }]);
  });

  it('sends it once', async () => {
    await generate('a name field');

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('asks the model it was created with', async () => {
    generate = createClaudeGenerator(send, 'claude-haiku-5-5');

    await generate('a name field');

    expect(send.mock.calls[0][0].model).toBe('claude-haiku-5-5');
  });

  it('constrains the answer to the schema of the generated UI', async () => {
    await generate('a name field');

    expect(send.mock.calls[0][0].output_config?.format).toEqual({
      type: 'json_schema',
      schema: GENERATED_UI_SCHEMA,
    });
  });

  it('does not force a tool call or set a thinking budget', async () => {
    await generate('a name field');

    const params = send.mock.calls[0][0];
    expect([params.tool_choice, params.tools, params.thinking]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('returns the elements of the answer', async () => {
    await expect(generate('a name field')).resolves.toEqual(elements);
  });

  it('reads the text block that follows a thinking block', async () => {
    answerWith({
      content: [
        { type: 'thinking', thinking: '', signature: 'sig' },
        ...text(JSON.stringify({ elements })),
      ] as Message['content'],
    });

    await expect(generate('a name field')).resolves.toEqual(elements);
  });

  it('rejects an answer with an element of an unknown type', async () => {
    answerWith({ content: text(JSON.stringify({ elements: [{ type: 'button', text: 'Go' }] })) });

    await expect(generate('a button')).rejects.toThrow('Unknown element type: button');
  });

  it('rejects an answer that is not JSON', async () => {
    answerWith({ content: text('Here is your form.') });

    await expect(generate('a name field')).rejects.toBeInstanceOf(SyntaxError);
  });

  it('rejects an answer without text', async () => {
    answerWith({ content: [] });

    await expect(generate('a name field')).rejects.toThrow('without any text');
  });

  it.each(['refusal', 'max_tokens'] as const)(
    'rejects an answer that stopped on %s',
    async (stop) => {
      answerWith({ stop_reason: stop, content: text(JSON.stringify({ elements })) });

      await expect(generate('a name field')).rejects.toThrow(stop);
    },
  );

  it('lets a failed request fail as it did', async () => {
    const failure = new Error('overloaded');
    send.mockRejectedValue(failure);

    await expect(generate('a name field')).rejects.toBe(failure);
  });

  it('fails every request with a missing key error when it has nothing to send with', async () => {
    generate = createClaudeGenerator(undefined, DEFAULT_MODEL);

    await expect(generate('a name field')).rejects.toBeInstanceOf(MissingApiKeyError);
  });
});
