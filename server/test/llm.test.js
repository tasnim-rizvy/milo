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

// ── Fallback reasons (observability: a scripted line is never a mystery) ───

test('composeFreeTurn reports why the scripted fallback served (no keys)', async () => {
  const { composeFreeTurn } = await import('../src/llm/compose.js');
  const r = await composeFreeTurn({
    mode: 'support',
    child: {
      nickname: 'Maya', level: 1, reading_band: 'tap-first', age_band: 4,
      interests: [], home_language: '', last_summary: '',
    },
    store: { progressAll: () => [] },
    input: "i'm tired",
    scriptedFallback: 'fallback line',
  });
  assert.equal(r.usedLLM, false);
  assert.equal(r.reason, 'no-keys');
  assert.equal(r.say, 'fallback line');
});

test('support prompt forbids mentioning family back and faking sad feelings', async () => {
  const { SYSTEM_PROMPT } = await import('../src/llm/compose.js');
  assert.match(SYSTEM_PROMPT, /Never mention family members back/);
  assert.match(SYSTEM_PROMPT, /Never say you feel sad or happy about the child's feelings/);
});

// ── Turn briefs (task directives + programmatic checks) ────────────────────

test('praise brief tells the model the facts and the must-word', async () => {
  const { buildChatPrompt } = await import('../src/llm/compose.js');
  const prompt = buildChatPrompt({
    card: 'Child: Maya',
    task: { type: 'praise', word: 'cat', emoji: '🐱', firstTry: true },
    input: '',
  });
  assert.match(prompt, /just got "cat" 🐱 right on the FIRST try/);
  assert.match(prompt, /Include the word "cat"/);
  assert.doesNotMatch(prompt, /Child said/);
});

test('brief checks reject drift: missing word, "wrong", or a verbatim repeat', async () => {
  const { taskViolations } = await import('../src/llm/compose.js');
  const recast = { type: 'recast', word: 'cat', tapped: 'car' };
  assert.deepEqual(taskViolations(recast, 'Nice try! Find the cat 🐱!'), []);
  assert.ok(taskViolations(recast, 'Oops! That was wrong, find the dog.').includes('says-wrong'));
  assert.ok(taskViolations(recast, 'Nice try! Find it again!').includes('missing:"cat"'));
  const history = [{ role: 'milo', text: 'YES! Cat! ⭐' }];
  assert.ok(taskViolations(null, 'YES! Cat! ⭐', history).includes('repeats-last-line'));
});

test('multiword wins skip the must-word (frames keep their own phrasing)', async () => {
  const { taskViolations } = await import('../src/llm/compose.js');
  const task = { type: 'praise', word: "I'm fine thank you", firstTry: false };
  assert.deepEqual(taskViolations(task, 'You said it! Amazing! ⭐'), []);
});

test('quiet briefs reject a dangling question (the next task follows immediately)', async () => {
  const { taskViolations } = await import('../src/llm/compose.js');
  assert.ok(taskViolations({ type: 'checkin' }, "It's okay! Want to play a game?").includes('asks-question'));
  assert.ok(taskViolations({ type: 'praise', word: 'cat' }, 'You found the cat! Want more?').includes('asks-question'));
  assert.deepEqual(taskViolations({ type: 'recast', word: 'cat' }, 'Can you find the cat?'), []);
});
