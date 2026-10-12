import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { MAX_TEXT_LENGTH } from '../src/app/features/ui-generator/models/generation-request';
import { createApp } from './app';
import { createClaudeGenerator, DEFAULT_MODEL, GenerateUi } from './claude-generator';

describe('POST /api/generate-ui', () => {
  const elements = [
    { type: 'span' as const, text: 'Country' },
    { type: 'dropdown' as const, options: [{ text: 'Greece', value: 'gr' }] },
  ];

  let generate: ReturnType<typeof vi.fn<GenerateUi>>;
  let logError: ReturnType<typeof vi.fn<(error: unknown) => void>>;
  let server: Server;

  function serve(generator: GenerateUi): Promise<void> {
    return new Promise((resolve) => {
      server = createApp({ generate: generator, logError }).listen(0, '127.0.0.1', () => resolve());
    });
  }

  function send(body: string, path = '/api/generate-ui', method = 'POST'): Promise<Response> {
    const { port } = server.address() as AddressInfo;
    return fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : body,
    });
  }

  const post = (body: unknown) => send(JSON.stringify(body));

  beforeEach(async () => {
    generate = vi.fn<GenerateUi>().mockResolvedValue(elements);
    logError = vi.fn();
    await serve(generate);
  });

  afterEach(() => new Promise((resolve) => server.close(resolve)));

  describe('with a description', () => {
    it('answers 200 with the generated elements', async () => {
      const response = await post({ text: 'a country picker' });

      expect([response.status, await response.json()]).toEqual([200, { elements }]);
    });

    it('answers in JSON', async () => {
      const response = await post({ text: 'a country picker' });

      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('hands the description to the generator once', async () => {
      await post({ text: 'a country picker' });

      expect(generate.mock.calls).toEqual([['a country picker']]);
    });

    it('trims the description', async () => {
      await post({ text: '  a country picker\n' });

      expect(generate).toHaveBeenCalledWith('a country picker');
    });

    it('accepts a description of the longest length', async () => {
      const response = await post({ text: 'a'.repeat(MAX_TEXT_LENGTH) });

      expect(response.status).toBe(200);
    });

    it('accepts a description of the longest length with blanks around it', async () => {
      const response = await post({ text: `  ${'a'.repeat(MAX_TEXT_LENGTH)}

` });

      expect(response.status).toBe(200);
    });

    it('answers 200 with an empty list when nothing was generated', async () => {
      generate.mockResolvedValue([]);

      const response = await post({ text: 'nothing at all' });

      expect([response.status, await response.json()]).toEqual([200, { elements: [] }]);
    });
  });

  describe('without a usable description', () => {
    it.each([
      ['no text', {}],
      ['an empty text', { text: '' }],
      ['a blank text', { text: ' \n\t ' }],
      ['a text that is a number', { text: 42 }],
      ['a text that is a list', { text: ['a form'] }],
      ['a text that is nothing', { text: null }],
      ['a body that is a list', ['a form']],
    ])('answers 400 to %s', async (_, body) => {
      const response = await post(body);

      expect([response.status, await response.json()]).toEqual([
        400,
        { error: 'Describe the UI in the "text" field.' },
      ]);
    });

    it('answers 400 to a description that is too long', async () => {
      const response = await post({ text: 'a'.repeat(MAX_TEXT_LENGTH + 1) });

      expect([response.status, await response.json()]).toEqual([
        400,
        { error: `The description is longer than ${MAX_TEXT_LENGTH} characters.` },
      ]);
    });

    it('answers 413 to a body larger than the server reads', async () => {
      const response = await post({ text: 'a'.repeat(200_000) });

      expect([response.status, await response.json()]).toEqual([
        413,
        { error: `The description is longer than ${MAX_TEXT_LENGTH} characters.` },
      ]);
    });

    it('answers 400 to a body that is not JSON', async () => {
      const response = await send('{ text: ');

      expect([response.status, await response.json()]).toEqual([
        400,
        { error: 'The request body is not valid JSON.' },
      ]);
    });

    it('answers 400 to an empty body', async () => {
      const response = await send('');

      expect(response.status).toBe(400);
    });

    it('does not call the generator', async () => {
      await post({ text: '   ' });
      await post({ text: 'a'.repeat(MAX_TEXT_LENGTH + 1) });
      await send('{ text: ');

      expect(generate).not.toHaveBeenCalled();
    });

    it('does not log it as a failure', async () => {
      await post({ text: '   ' });
      await send('{ text: ');
      await post({ text: 'a'.repeat(200_000) });

      expect(logError).not.toHaveBeenCalled();
    });
  });

  describe('when the server itself fails', () => {
    const failure = new Error('disk full');

    beforeEach(() => {
      logError.mockImplementationOnce(() => {
        throw failure;
      });
      generate.mockRejectedValue(new Error('overloaded'));
    });

    it('answers 500 without the cause', async () => {
      const response = await post({ text: 'a country picker' });

      expect([response.status, await response.json()]).toEqual([
        500,
        { error: 'The server failed to answer.' },
      ]);
    });

    it('reports the cause to the log', async () => {
      await post({ text: 'a country picker' });

      expect(logError).toHaveBeenLastCalledWith(failure);
    });
  });

  describe('when the generation fails', () => {
    beforeEach(() => {
      generate.mockRejectedValue(new Error('529 overloaded, request id req_123'));
    });

    it('answers 502 without the cause', async () => {
      const response = await post({ text: 'a country picker' });

      expect([response.status, await response.json()]).toEqual([
        502,
        { error: 'Claude could not generate the UI.' },
      ]);
    });

    it('reports the cause to the log', async () => {
      await post({ text: 'a country picker' });

      expect(logError.mock.calls).toEqual([[new Error('529 overloaded, request id req_123')]]);
    });

    it('answers the next request once the generation works again', async () => {
      await post({ text: 'a country picker' });
      generate.mockResolvedValue(elements);

      const response = await post({ text: 'a country picker' });

      expect(response.status).toBe(200);
    });
  });

  describe('without an API key', () => {
    beforeEach(async () => {
      await new Promise((resolve) => server.close(resolve));
      await serve(createClaudeGenerator(undefined, DEFAULT_MODEL));
    });

    it('answers 503 and names the missing variable', async () => {
      const response = await post({ text: 'a country picker' });

      expect([response.status, await response.json()]).toEqual([
        503,
        { error: 'ANTHROPIC_API_KEY is not set on the server.' },
      ]);
    });

    it('does not log it as a failure', async () => {
      await post({ text: 'a country picker' });

      expect(logError).not.toHaveBeenCalled();
    });

    it('still answers 400 to a missing description', async () => {
      const response = await post({});

      expect(response.status).toBe(400);
    });
  });

  describe('any other request', () => {
    it('answers 404 to a GET of the endpoint', async () => {
      const response = await send('', '/api/generate-ui', 'GET');

      expect(response.status).toBe(404);
    });

    it('answers 404 to another path', async () => {
      const response = await send('{}', '/api/other');

      expect(response.status).toBe(404);
    });
  });
});
