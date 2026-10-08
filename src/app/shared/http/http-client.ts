export type HttpHandler = (url: string, init?: RequestInit) => Promise<Response>;

export type HttpInterceptor = (
  url: string,
  init: RequestInit,
  next: HttpHandler,
) => Promise<Response>;

export function createHttpClient(
  interceptors: HttpInterceptor[],
  fetch: typeof globalThis.fetch = globalThis.fetch,
): HttpHandler {
  return interceptors.reduceRight<HttpHandler>(
    (next, interceptor) =>
      (url, init = {}) =>
        interceptor(url, init, next),
    (url, init) => fetch(url, init),
  );
}
