import { test } from 'node:test';
import assert from 'node:assert/strict';

// A truncated LLM line must never become the final message a child sees:
// streamGroq yields the partial text (for the live preview), then throws so
// the composer swaps in a complete scripted fallback.

function fakeSse(lines) {
  const body = lines.map((l) => `data: ${l}`).join('\n') + '\n';
  return async () => new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

async function collect(stream) {
  let out = '';
  for await (const chunk of stream) out += chunk;
  return out;
}

test('Groq truncation (finish_reason: length) throws after streaming the partial text', async () => {
  const { streamGroq } = await import('../src/llm/providers.js');
  const orig = globalThis.fetch;
  globalThis.fetch = fakeSse([
    '{"choices":[{"delta":{"content":"Wow! Does it "}}]}',
    '{"choices":[{"delta":{},"finish_reason":"length"}]}',
    '[DONE]',
  ]);
  try {
    let got = '';
    await assert.rejects(async () => {
      for await (const chunk of streamGroq(
        { apiKey: 'k', model: 'openai/gpt-oss-120b' },
        { system: 's', user: 'u', maxTokens: 50 },
        { firstTokenMs: 5000, totalMs: 5000 },
      )) got += chunk;
    }, /llm-truncated/);
    assert.equal(got, 'Wow! Does it ');
  } finally {
    globalThis.fetch = orig;
  }
});

test('a complete Groq stream (finish_reason: stop) passes through untouched', async () => {
  const { streamGroq } = await import('../src/llm/providers.js');
  const orig = globalThis.fetch;
  globalThis.fetch = fakeSse([
    '{"choices":[{"delta":{"content":"Hi! Does it go fast? "}}]}',
    '{"choices":[{"delta":{},"finish_reason":"stop"}]}',
    '[DONE]',
  ]);
  try {
    const got = await collect(streamGroq(
      { apiKey: 'k', model: 'openai/gpt-oss-120b' },
      { system: 's', user: 'u', maxTokens: 50 },
      { firstTokenMs: 5000, totalMs: 5000 },
    ));
    assert.equal(got, 'Hi! Does it go fast? ');
  } finally {
    globalThis.fetch = orig;
  }
});
