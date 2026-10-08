import { HttpHandler } from '../../../shared/http/http-client';
import { Fact } from '../models/fact';

export interface FactService {
  today(): Promise<Fact>;
  random(): Promise<Fact>;
}

export const FACTS_API = 'https://uselessfacts.jsph.pl/api/v2/facts';

const toFact = (body: unknown): Fact => {
  if (
    typeof body === 'object' &&
    body !== null &&
    'id' in body &&
    'text' in body &&
    typeof body.id === 'string' &&
    typeof body.text === 'string'
  ) {
    return { id: body.id, text: body.text };
  }
  throw new Error('The facts API answered with something that is not a fact.');
};

export function createFactService(http: HttpHandler): FactService {
  async function request(path: string): Promise<Fact> {
    const response = await http(`${FACTS_API}/${path}`, {
      headers: { Accept: 'application/json' },
    });
    return toFact(await response.json());
  }

  return {
    today: () => request('today'),
    random: () => request('random'),
  };
}
