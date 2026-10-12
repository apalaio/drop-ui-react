import express, { ErrorRequestHandler, Express } from 'express';
import { GenerateUi, MissingApiKeyError } from './claude-generator';

export const MAX_TEXT_LENGTH = 4000;

export interface AppOptions {
  generate: GenerateUi;
  /** Where a failed generation is reported. The answer to the browser never carries the cause. */
  logError?: (error: unknown) => void;
}

const rejectUnreadableBody: ErrorRequestHandler = (_error, _request, response, _next) => {
  response.status(400).json({ error: 'The request body is not valid JSON.' });
};

export function createApp({ generate, logError = console.error }: AppOptions): Express {
  const app = express();
  app.use(express.json());

  app.post('/api/generate-ui', async (request, response) => {
    const text: unknown = request.body?.text;
    if (typeof text !== 'string' || text.trim() === '') {
      response.status(400).json({ error: 'Describe the UI in the "text" field.' });
      return;
    }
    if (text.length > MAX_TEXT_LENGTH) {
      response
        .status(400)
        .json({ error: `The description is longer than ${MAX_TEXT_LENGTH} characters.` });
      return;
    }
    try {
      response.json({ elements: await generate(text.trim()) });
    } catch (error) {
      if (error instanceof MissingApiKeyError) {
        response.status(503).json({ error: error.message });
        return;
      }
      logError(error);
      response.status(502).json({ error: 'Claude could not generate the UI.' });
    }
  });

  app.use(rejectUnreadableBody);

  return app;
}
