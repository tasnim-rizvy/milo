import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { openStore } from '../src/store.js';

async function start() {
  const app = await buildApp({ store: openStore(':memory:') });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { app, base };
}

function parseTurn(sseText) {
  const lines = sseText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'event: turn') {
      const data = lines[i + 1].replace(/^data: /, '');
      return JSON.parse(data);
    }
  }
  return null;
}

test('health + children endpoints', async (t) => {
  const { app, base } = await start();
  t.after(() => app.close());

  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.scriptedAlwaysOn, true);

  const kids = await (await fetch(`${base}/api/children`)).json();
  assert.equal(kids.children.length, 2);
  assert.deepEqual(kids.children.map((c) => c.key).sort(), ['aarav', 'maya']);
});

test('session + SSE message round trip (chip answer, fast path)', async (t) => {
  const { app, base } = await start();
  t.after(() => app.close());

  const sess = await (await fetch(`${base}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ childKey: 'maya', intent: 'learn' }),
  })).json();
  assert.ok(sess.sessionId);
  assert.ok(sess.turn.options.some((o) => o.id === 'mood-happy'));

  const res = await fetch(`${base}/api/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: sess.sessionId, input: { type: 'chip', chipId: 'mood-happy' } }),
  });
  const text = await res.text();
  assert.match(text, /event: turn/);
  const turn = parseTurn(text);
  assert.ok(turn);
  assert.ok(Array.isArray(turn.messages));
  assert.equal(typeof turn.latency.serverMs, 'number');
  assert.ok(turn.effects);
});

test('reset-demo restores both profiles', async (t) => {
  const { app, base } = await start();
  t.after(() => app.close());
  const r = await (await fetch(`${base}/api/reset-demo`, { method: 'POST' })).json();
  assert.equal(r.ok, true);
  assert.equal(r.children.length, 2);
});

test('progress endpoint exposes dev-panel data', async (t) => {
  const { app, base } = await start();
  t.after(() => app.close());
  const p = await (await fetch(`${base}/api/progress/aarav`)).json();
  assert.equal(p.child.level, 2);
  assert.ok(p.stats.coverage >= 0.8);
  assert.ok(p.progress.length > 40);
  assert.ok(p.badges.length >= 1);
});
