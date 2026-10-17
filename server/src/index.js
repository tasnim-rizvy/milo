import { buildApp } from './app.js';
import { config, llmEnabled, llmProviders } from './config.js';

const app = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
  const mode = llmEnabled()
    ? `LLM ladder on (${llmProviders().map((p) => p.name).join(' → ')} → scripted)`
    : 'scripted-only mode (no LLM keys — fully functional)';
  console.log(`🦊 Milo awake on http://localhost:${config.port} · ${mode}`);
} catch (err) {
  console.error('Milo could not wake up:', err);
  process.exit(1);
}
