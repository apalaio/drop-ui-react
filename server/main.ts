import Anthropic from '@anthropic-ai/sdk';
import { createApp } from './app';
import { createClaudeGenerator, DEFAULT_MODEL } from './claude-generator';

try {
  process.loadEnvFile();
} catch {
  // No .env file: the environment alone configures the server.
}

const port = Number(process.env['API_PORT']) || 3001;
const model = process.env['ANTHROPIC_MODEL'] || DEFAULT_MODEL;
const apiKey = process.env['ANTHROPIC_API_KEY'];

const client = apiKey ? new Anthropic({ apiKey }) : undefined;
const generate = createClaudeGenerator(
  client && ((params) => client.beta.messages.create(params)),
  model,
);

// Express hands a failed listen, such as a port already in use, to this same callback.
createApp({ generate }).listen(port, (error) => {
  if (error) {
    console.error(`The DropUI API could not listen on port ${port}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`DropUI API on http://localhost:${port} (model ${model})`);
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY is not set: POST /api/generate-ui answers 503.');
  }
});
