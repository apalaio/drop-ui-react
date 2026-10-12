import Anthropic from '@anthropic-ai/sdk';
import { createApp } from './app';
import { createClaudeGenerator, DEFAULT_MODEL } from './claude-generator';

// Below the 60 seconds the browser waits, so a slow generation ends with the server's own answer.
const CLAUDE_TIMEOUT_MS = 50_000;
// Only the Vite dev server calls this API, and it runs on the same machine.
const HOST = '127.0.0.1';

try {
  process.loadEnvFile();
} catch (error) {
  // No .env file: the environment alone configures the server.
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw error;
  }
}

const port = Number(process.env['API_PORT']) || 3001;
const model = process.env['ANTHROPIC_MODEL'] || DEFAULT_MODEL;
const apiKey = process.env['ANTHROPIC_API_KEY'];

// No retry: a second attempt would outlast the browser's wait and be paid for unseen.
const client = apiKey
  ? new Anthropic({ apiKey, timeout: CLAUDE_TIMEOUT_MS, maxRetries: 0 })
  : undefined;
const generate = createClaudeGenerator(
  client && ((params) => client.beta.messages.create(params)),
  model,
);

// Express hands a failed listen, such as a port already in use, to this same callback.
createApp({ generate }).listen(port, HOST, (error) => {
  if (error) {
    console.error(`The DropUI API could not listen on port ${port}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`DropUI API on http://${HOST}:${port} (model ${model})`);
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY is not set: POST /api/generate-ui answers 503.');
  }
});
