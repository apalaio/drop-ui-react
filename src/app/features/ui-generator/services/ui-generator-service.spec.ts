import { HttpHandler } from '../../../shared/http/http-client';
import { HttpError } from '../../../shared/http/http-interceptors';
import { GeneratedElement } from '../../builder/models/generated-element';
import {
  createUiGeneratorService,
  GENERATE_UI_API,
  UiGeneratorError,
  UiGeneratorService,
} from './ui-generator-service';

describe('createUiGeneratorService', () => {
  const text = 'a signup form with name, birthday and country';
  const elements: GeneratedElement[] = [
    { type: 'div', text: 'Sign up' },
    { type: 'span', text: 'It takes a minute.' },
    { type: 'text-input', text: 'Your name' },
    { type: 'textfield', text: 'About you' },
    { type: 'datepicker' },
    { type: 'dropdown', options: [{ text: 'Greece', value: 'gr' }] },
  ];
  const body = { elements };

  let http: ReturnType<typeof vi.fn<HttpHandler>>;
  let log: ReturnType<typeof vi.spyOn>;
  let service: UiGeneratorService;

  function respondWith(value: unknown, status = 200): void {
    http.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(value), { status })));
  }

  beforeEach(() => {
    http = vi.fn<HttpHandler>();
    log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    service = createUiGeneratorService(http);
    respondWith(body);
  });

  afterEach(() => {
    log.mockRestore();
  });

  it('sends the request to the generation address', async () => {
    await service.generate(text);

    expect(http.mock.calls[0][0]).toBe(GENERATE_UI_API);
  });

  it('sends it once', async () => {
    await service.generate(text);

    expect(http).toHaveBeenCalledTimes(1);
  });

  it('posts it', async () => {
    await service.generate(text);

    expect(http.mock.calls[0][1]?.method).toBe('POST');
  });

  it('sends the text as JSON', async () => {
    await service.generate(text);

    expect(http.mock.calls[0][1]?.body).toBe(JSON.stringify({ text }));
  });

  it('says that it sends JSON and asks for JSON', async () => {
    await service.generate(text);

    expect(http.mock.calls[0][1]?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  });

  it('returns the elements of the answer', async () => {
    expect(await service.generate(text)).toEqual(elements);
  });

  it('returns an empty list of elements as it is', async () => {
    respondWith({ elements: [] });

    expect(await service.generate(text)).toEqual([]);
  });

  it('returns what an element holds and nothing else', async () => {
    respondWith({
      elements: [
        { type: 'div', text: 'Sign up', uid: 'x' },
        { type: 'datepicker', text: 'Birthday' },
        {
          type: 'dropdown',
          options: [{ text: 'Greece', value: 'gr', selected: true }],
          value: 'gr',
        },
      ],
    });

    expect(await service.generate(text)).toEqual([
      { type: 'div', text: 'Sign up' },
      { type: 'datepicker' },
      { type: 'dropdown', options: [{ text: 'Greece', value: 'gr' }] },
    ]);
  });

  it('logs the answer', async () => {
    await service.generate(text);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(body);
  });

  it('logs nothing when the request fails', async () => {
    http.mockRejectedValue(new Error('offline'));

    await service.generate(text).catch(() => undefined);

    expect(log).not.toHaveBeenCalled();
  });

  it.each([
    ['no elements', {}],
    ['elements that are not a list', { elements: 'none' }],
    ['a list in place of an object', elements],
    ['nothing', null],
    ['an element that is not an object', { elements: ['div'] }],
    ['an element that is nothing', { elements: [null] }],
    ['an element without a type', { elements: [{ text: 'Sign up' }] }],
    ['an element of an unknown type', { elements: [{ type: 'button', text: 'Send' }] }],
    ['a block text without a text', { elements: [{ type: 'div' }] }],
    ['an inline text whose text is not a string', { elements: [{ type: 'span', text: 42 }] }],
    ['a text input without a text', { elements: [{ type: 'text-input' }] }],
    ['a textfield without a text', { elements: [{ type: 'textfield' }] }],
    ['a dropdown without options', { elements: [{ type: 'dropdown' }] }],
    ['a dropdown whose options are not a list', { elements: [{ type: 'dropdown', options: {} }] }],
    [
      'a dropdown option without a value',
      { elements: [{ type: 'dropdown', options: [{ text: 'Greece' }] }] },
    ],
    [
      'a dropdown option whose text is not a string',
      { elements: [{ type: 'dropdown', options: [{ text: 1, value: 'gr' }] }] },
    ],
    [
      'a dropdown option that is not an object',
      { elements: [{ type: 'dropdown', options: ['Greece'] }] },
    ],
    ['one malformed element among well-formed ones', { elements: [...elements, { type: 'div' }] }],
  ])('rejects an answer with %s', async (_, answer) => {
    respondWith(answer);

    await expect(service.generate(text)).rejects.toThrow('not a list of elements');
  });

  it('rejects an answer that is not JSON', async () => {
    http.mockResolvedValue(new Response('<html></html>'));

    await expect(service.generate(text)).rejects.toBeInstanceOf(SyntaxError);
  });

  it('lets a failed request fail as it did', async () => {
    const failure = new Error('offline');
    http.mockRejectedValue(failure);

    await expect(service.generate(text)).rejects.toBe(failure);
  });

  describe.each([400, 500, 502])('when the backend answers with %d', (status) => {
    const reason = 'Describe the UI in at most 2000 characters.';

    it('fails with the reason the backend gave', async () => {
      respondWith({ error: reason }, status);

      await expect(service.generate(text)).rejects.toThrow(reason);
    });

    it('marks that failure as one the backend explained', async () => {
      respondWith({ error: reason }, status);

      await expect(service.generate(text)).rejects.toBeInstanceOf(UiGeneratorError);
    });

    it('does not take elements from a failed answer', async () => {
      respondWith({ ...body, error: reason }, status);

      await expect(service.generate(text)).rejects.toBeInstanceOf(UiGeneratorError);
    });

    it.each([
      ['no reason', {}],
      ['a reason that is not a string', { error: 42 }],
      ['a blank reason', { error: '  ' }],
      ['nothing', null],
    ])('fails with the status when the answer has %s', async (_, answer) => {
      respondWith(answer, status);

      await expect(service.generate(text)).rejects.toEqual(new HttpError(status, GENERATE_UI_API));
    });

    it('fails with the status when the answer is not JSON', async () => {
      http.mockResolvedValue(new Response('Bad Gateway', { status }));

      await expect(service.generate(text)).rejects.toBeInstanceOf(HttpError);
    });

    it('logs nothing', async () => {
      respondWith({ error: reason }, status);

      await service.generate(text).catch(() => undefined);

      expect(log).not.toHaveBeenCalled();
    });
  });
});
