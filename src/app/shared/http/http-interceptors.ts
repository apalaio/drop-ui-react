import { HttpInterceptor } from './http-client';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`${url} responded with ${status}.`);
    this.name = 'HttpError';
  }
}

export const rejectHttpErrors: HttpInterceptor = async (url, init, next) => {
  const response = await next(url, init);
  if (!response.ok) {
    throw new HttpError(response.status, url);
  }
  return response;
};

export const timeout =
  (milliseconds: number): HttpInterceptor =>
  (url, init, next) =>
    next(url, { ...init, signal: AbortSignal.timeout(milliseconds) });
