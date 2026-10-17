import { test } from 'node:test';
import assert from 'node:assert/strict';

// llmProviders() snapshots the environment at module load, so each scenario
// imports config.js fresh via a cache-busting query string. (node --test runs
// each file in its own process, so this env stays local to this file.)

test('default ladder order is gemini → groq', async () => {
  process.env.GEMINI_API_KEY = 'test-gemini-key';
  process.env.GROQ_API_KEY = 'test-groq-key';
  delete process.env.LLM_PRIORITY;
  const { llmProviders } = await import('../src/config.js?scenario=default');
  assert.deepEqual(llmProviders().map((p) => p.name), ['gemini', 'groq']);
});

test('LLM_PRIORITY reorders the ladder (e.g. groq-first on slow networks)', async () => {
  process.env.LLM_PRIORITY = 'groq, gemini';
  const { llmProviders } = await import('../src/config.js?scenario=priority');
  assert.deepEqual(llmProviders().map((p) => p.name), ['groq', 'gemini']);
});

test('partial priority keeps the remaining providers after the named ones', async () => {
  process.env.LLM_PRIORITY = 'groq';
  const { llmProviders } = await import('../src/config.js?scenario=partial');
  assert.deepEqual(llmProviders().map((p) => p.name), ['groq', 'gemini']);
});

test('no keys → empty ladder (scripted-only mode)', async () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  const { llmProviders } = await import('../src/config.js?scenario=nokeys');
  assert.deepEqual(llmProviders(), []);
});
