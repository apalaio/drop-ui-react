import { HttpHandler } from '../../../shared/http/http-client';
import { HttpError } from '../../../shared/http/http-interceptors';
import { DropdownOption } from '../../builder/models/dropdown-option';
import { GeneratedElement } from '../../builder/models/generated-element';

export interface UiGeneratorService {
  generate(text: string): Promise<GeneratedElement[]>;
}

export const GENERATE_UI_API = '/api/generate-ui';

/** A refusal the backend explained: its message is written for the user. */
export class UiGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UiGeneratorError';
  }
}

const NOT_ELEMENTS = 'The generation API answered with something that is not a list of elements.';

const field = (value: unknown, name: string): unknown =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[name]
    : undefined;

const toOption = (option: unknown): DropdownOption => {
  const text = field(option, 'text');
  const value = field(option, 'value');
  if (typeof text === 'string' && typeof value === 'string') {
    return { text, value };
  }
  throw new Error(NOT_ELEMENTS);
};

const toElement = (element: unknown): GeneratedElement => {
  const type = field(element, 'type');
  const text = field(element, 'text');
  const options = field(element, 'options');
  switch (type) {
    case 'div':
    case 'span':
    case 'text-input':
    case 'textfield':
      if (typeof text === 'string') {
        return { type, text };
      }
      break;
    case 'datepicker':
      return { type };
    case 'dropdown':
      if (Array.isArray(options)) {
        return { type, options: options.map(toOption) };
      }
      break;
  }
  throw new Error(NOT_ELEMENTS);
};

const toElements = (body: unknown): GeneratedElement[] => {
  const elements = field(body, 'elements');
  if (Array.isArray(elements)) {
    return elements.map(toElement);
  }
  throw new Error(NOT_ELEMENTS);
};

async function toFailure(response: Response): Promise<Error> {
  try {
    const error = field(await response.json(), 'error');
    if (typeof error === 'string' && error.trim() !== '') {
      return new UiGeneratorError(error);
    }
  } catch {
    // A failure without a JSON body, such as the dev proxy's when the backend is down.
  }
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
      const body: unknown = await response.json();
      console.log(body);
      return toElements(body);
    },
  };
}
