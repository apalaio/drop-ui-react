import express, { ErrorRequestHandler, Express } from 'express';
import { MAX_TEXT_LENGTH } from '../src/app/features/ui-generator/models/generation-request';
import { GenerateUi, MissingApiKeyError } from './claude-generator';

export interface AppOptions {
  generate: GenerateUi;
  logError?: (error: unknown) => void;
}

const TOO_LONG = `The description is longer than ${MAX_TEXT_LENGTH} characters.`;

const errorType = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;

export function createApp({ generate, logError = console.error }: AppOptions): Express {
  const app = express();
  app.use(express.json());

  app.post('/api/generate-ui', async (request, response) => {
    const text: unknown = request.body?.text;
    const description = typeof text === 'string' ? text.trim() : '';
    if (description === '') {
      response.status(400).json({ error: 'Describe the UI in the "text" field.' });
      return;
    }
    if (description.length > MAX_TEXT_LENGTH) {
      response.status(400).json({ error: TOO_LONG });
      return;
    }
    try {
      response.json({ elements: await generate(description) });
    } catch (error) {
      if (error instanceof MissingApiKeyError) {
        response.status(503).json({ error: error.message });
        return;
      }
      logError(error);
      response.status(502).json({ error: 'Claude could not generate the UI.' });
    }
  });

  // The types are body-parser's: what express.json() could not read, and what it refused to.
  const answerFailure: ErrorRequestHandler = (error, _request, response, _next) => {
    switch (errorType(error)) {
      case 'entity.parse.failed':
        response.status(400).json({ error: 'The request body is not valid JSON.' });
        return;
      case 'entity.too.large':
        response.status(413).json({ error: TOO_LONG });
        return;
      default:
        logError(error);
        response.status(500).json({ error: 'The server failed to answer.' });
    }
  };
  app.use(answerFailure);

  return app;
}
