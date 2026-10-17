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

// ── Prompt building ────────────────────────────────────────────────────────

test('recent chat goes into the prompt so Milo can avoid repeating himself', async () => {
  const { buildChatPrompt } = await import('../src/llm/compose.js');
  const user = buildChatPrompt({
    card: 'Child: Maya, level L1.',
    mode: 'conversation',
    input: 'i have a new toy car',
    history: [
      { role: 'child', text: 'i like dinosaurs' },
      { role: 'milo', text: 'I like cats! Do you have a cat?' },
    ],
  });
  assert.match(user, /Recent chat/);
  assert.match(user, /Milo: I like cats! Do you have a cat\?/);
  assert.match(user, /Child said: "i have a new toy car"/);
  const none = buildChatPrompt({ card: 'c', mode: 'conversation', input: 'hi' });
  assert.doesNotMatch(none, /Recent chat/);
});
