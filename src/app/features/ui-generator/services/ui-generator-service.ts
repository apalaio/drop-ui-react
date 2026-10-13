import { HttpHandler } from '../../../shared/http/http-client';
import { HttpError } from '../../../shared/http/http-interceptors';
import { GeneratedElement, toGeneratedElements } from '../../builder/models/generated-element';

export interface UiGeneratorService {
  generate(text: string): Promise<GeneratedElement[]>;
}

export const GENERATE_UI_API = '/api/generate-ui';

export class UiGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UiGeneratorError';
  }
}

const field = (value: unknown, name: string): unknown =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[name]
    : undefined;

async function toFailure(response: Response): Promise<Error> {
  try {
    const error = field(await response.json(), 'error');
    if (typeof error === 'string' && error.trim() !== '') {
      return new UiGeneratorError(error);
    }
  } catch {}
  return new HttpError(response.status, GENERATE_UI_API);
}

/*
 * The client given here must not carry `rejectHttpErrors`: that interceptor throws before the body
 * of a failed response can be read, and the body is where the backend says what went wrong.
 */
export function createUiGeneratorService(http: HttpHandler): UiGeneratorService {
  return {
    async generate(text) {
      const response = await http(GENERATE_UI_API, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        throw await toFailure(response);
      }
      return toGeneratedElements(await response.json());
    },
  };
}
