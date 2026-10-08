import { HttpHandler } from '../../../shared/http/http-client';
import { createFactService, FACTS_API, FactService } from './fact-service';

describe('createFactService', () => {
  const id = 'e4647e07b87d74f1663b717e461b4ed8';
  const text = 'One in seven workers in Boston, Massachusetts walks to work.';
  const body = {
    id,
    text,
    source: 'djtech.net',
    source_url: 'https://www.djtech.net/humor/shorty_useless_facts.htm',
    language: 'en',
    permalink: `https://uselessfacts.jsph.pl/api/v2/facts/${id}`,
  };

  let http: ReturnType<typeof vi.fn<HttpHandler>>;
  let service: FactService;

  function respondWith(value: unknown): void {
    http.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(value))));
  }

  beforeEach(() => {
    http = vi.fn<HttpHandler>();
    service = createFactService(http);
    respondWith(body);
  });

  describe.each(['today', 'random'] as const)('%s', (method) => {
    it('requests the fact from its own address', async () => {
      await service[method]();

      expect(http.mock.calls[0][0]).toBe(`${FACTS_API}/${method}`);
    });

    it('requests it once', async () => {
      await service[method]();

      expect(http).toHaveBeenCalledTimes(1);
    });

    it('asks for JSON', async () => {
      await service[method]();

      expect(http.mock.calls[0][1]?.headers).toEqual({ Accept: 'application/json' });
    });

    it('returns the id and the text of the fact and nothing else', async () => {
      const fact = await service[method]();

      expect(fact).toEqual({ id, text });
    });

    it.each([
      ['no text', { id }],
      ['no id', { text }],
      ['a text that is not a string', { id, text: 42 }],
      ['an id that is not a string', { id: 42, text }],
      ['a list', [body]],
      ['nothing', null],
    ])('rejects an answer with %s', async (_, answer) => {
      respondWith(answer);

      await expect(service[method]()).rejects.toThrow('not a fact');
    });

    it('rejects an answer that is not JSON', async () => {
      http.mockResolvedValue(new Response('<html></html>'));

      await expect(service[method]()).rejects.toBeInstanceOf(SyntaxError);
    });

    it('lets a failed request fail as it did', async () => {
      const failure = new Error('offline');
      http.mockRejectedValue(failure);

      await expect(service[method]()).rejects.toBe(failure);
    });
  });
});
