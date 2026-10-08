import { HttpHandler } from './http-client';
import { HttpError, rejectHttpErrors, timeout } from './http-interceptors';

describe('HTTP interceptors', () => {
  const url = 'https://example.test/things';
  const init: RequestInit = { headers: { Accept: 'application/json' } };

  let next: ReturnType<typeof vi.fn<HttpHandler>>;

  function respondWith(status: number): Response {
    const response = new Response(null, { status });
    next.mockResolvedValue(response);
    return response;
  }

  beforeEach(() => {
    next = vi.fn<HttpHandler>();
  });

  describe('rejectHttpErrors', () => {
    it('passes the request on as it is', async () => {
      respondWith(200);

      await rejectHttpErrors(url, init, next);

      expect(next).toHaveBeenCalledWith(url, init);
    });

    it.each([200, 201, 204])('returns a response with status %i', async (status) => {
      const response = respondWith(status);

      await expect(rejectHttpErrors(url, init, next)).resolves.toBe(response);
    });

    it.each([400, 404, 429, 500, 503])('rejects a response with status %i', async (status) => {
      respondWith(status);

      await expect(rejectHttpErrors(url, init, next)).rejects.toBeInstanceOf(HttpError);
    });

    it('reports the status and the url of the response it rejects', async () => {
      respondWith(404);

      await expect(rejectHttpErrors(url, init, next)).rejects.toMatchObject({ status: 404, url });
    });

    it('lets a request that got no response fail as it did', async () => {
      const failure = new TypeError('Failed to fetch');
      next.mockRejectedValue(failure);

      await expect(rejectHttpErrors(url, init, next)).rejects.toBe(failure);
    });
  });

  describe('timeout', () => {
    const generous = 60_000;

    function waitForAbort(_: string, { signal }: RequestInit = {}): Promise<Response> {
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason));
      });
    }

    it('passes the request on to the same url', async () => {
      respondWith(200);

      await timeout(generous)(url, init, next);

      expect(next.mock.calls[0][0]).toBe(url);
    });

    it('gives the request a signal to abort it with', async () => {
      respondWith(200);

      await timeout(generous)(url, init, next);

      expect(next.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    });

    it('keeps what the request already carried', async () => {
      respondWith(200);

      await timeout(generous)(url, init, next);

      expect(next.mock.calls[0][1]?.headers).toBe(init.headers);
    });

    it('returns a response that arrives in time', async () => {
      const response = respondWith(200);

      await expect(timeout(generous)(url, init, next)).resolves.toBe(response);
    });

    it('does not abort a request that has time left', async () => {
      respondWith(200);

      await timeout(generous)(url, init, next);

      expect(next.mock.calls[0][1]?.signal?.aborted).toBe(false);
    });

    it('aborts a request that takes longer', async () => {
      next.mockImplementation(waitForAbort);

      await expect(timeout(1)(url, init, next)).rejects.toMatchObject({ name: 'TimeoutError' });
    });
  });
});
