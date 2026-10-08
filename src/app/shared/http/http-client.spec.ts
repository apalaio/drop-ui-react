import { createHttpClient, HttpInterceptor } from './http-client';

describe('createHttpClient', () => {
  const url = 'https://example.test/things';
  const init: RequestInit = { headers: { Accept: 'application/json' } };

  let response: Response;
  let fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;

  beforeEach(() => {
    response = new Response('{}');
    fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('without interceptors', () => {
    it('fetches the url with what the caller gave it', async () => {
      await createHttpClient([], fetch)(url, init);

      expect(fetch).toHaveBeenCalledWith(url, init);
    });

    it('returns the response', async () => {
      const result = await createHttpClient([], fetch)(url, init);

      expect(result).toBe(response);
    });

    it('rejects with what fetch rejects with', async () => {
      const failure = new TypeError('Failed to fetch');
      fetch.mockRejectedValue(failure);

      await expect(createHttpClient([], fetch)(url)).rejects.toBe(failure);
    });

    it('uses the fetch of the page unless given another', async () => {
      vi.stubGlobal('fetch', fetch);

      await createHttpClient([])(url, init);

      expect(fetch).toHaveBeenCalledWith(url, init);
    });
  });

  describe('with interceptors', () => {
    it('runs them in order on the way in and in reverse on the way out', async () => {
      const calls: string[] = [];
      const named =
        (name: string): HttpInterceptor =>
        async (requestUrl, requestInit, next) => {
          calls.push(`${name} request`);
          const result = await next(requestUrl, requestInit);
          calls.push(`${name} response`);
          return result;
        };
      fetch.mockImplementation(() => {
        calls.push('fetch');
        return Promise.resolve(response);
      });

      await createHttpClient([named('first'), named('second')], fetch)(url);

      expect(calls).toEqual([
        'first request',
        'second request',
        'fetch',
        'second response',
        'first response',
      ]);
    });

    it('gives an interceptor an empty init when the caller gave none', async () => {
      const interceptor = vi.fn<HttpInterceptor>((requestUrl, requestInit, next) =>
        next(requestUrl, requestInit),
      );

      await createHttpClient([interceptor], fetch)(url);

      expect(interceptor).toHaveBeenCalledWith(url, {}, expect.any(Function));
    });

    it('fetches what an interceptor made of the request', async () => {
      const changed: RequestInit = { headers: { Accept: 'text/plain' } };
      const interceptor: HttpInterceptor = (requestUrl, _, next) => next(requestUrl, changed);

      await createHttpClient([interceptor], fetch)(url, init);

      expect(fetch).toHaveBeenCalledWith(url, changed);
    });

    it('returns what an interceptor made of the response', async () => {
      const replaced = new Response('[]');
      const interceptor: HttpInterceptor = async (requestUrl, requestInit, next) => {
        await next(requestUrl, requestInit);
        return replaced;
      };

      const result = await createHttpClient([interceptor], fetch)(url);

      expect(result).toBe(replaced);
    });

    it('fetches nothing when an interceptor answers by itself', async () => {
      const cached = new Response('[]');
      const interceptor: HttpInterceptor = () => Promise.resolve(cached);

      const result = await createHttpClient([interceptor], fetch)(url);

      expect(result).toBe(cached);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('rejects with what an interceptor throws', async () => {
      const failure = new Error('refused');
      const interceptor: HttpInterceptor = () => Promise.reject(failure);

      await expect(createHttpClient([interceptor], fetch)(url)).rejects.toBe(failure);
    });
  });
});
