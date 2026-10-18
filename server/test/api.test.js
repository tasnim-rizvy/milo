import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { openStore } from '../src/store.js';

async function start() {
  const app = await buildApp({ store: openStore(':memory:'), seed: true });
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

test('kid profiles: create, unique keys, validation, delete', async (t) => {
  const { app, base } = await start();
  t.after(() => app.close());
  const post = (body) => fetch(`${base}/api/children`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

  const a = await (await post({ nickname: 'Zoe', age: 5, avatar: '🐰' })).json();
  assert.equal(a.child.key, 'kid-zoe');
  assert.equal(a.child.level, 1);
  assert.equal(a.child.age_band, 5);
  assert.equal(a.child.reading_band, 'tap-first');
  assert.equal((await post({ nickname: 'Old', age: 9 })).status, 400);
  assert.equal((await post({ nickname: 'NoAge' })).status, 400);
  const r6 = await (await post({ nickname: 'Rey', age: 6, reads: true, interests: ['space', 'bogus', 'cars', 'music', 'robots'], home_language: 'Hindi' })).json();
  assert.equal(r6.child.level, 2);
  assert.equal(r6.child.reading_band, 'tap-and-type');
  assert.deepEqual(r6.child.interests, ['space', 'cars', 'music', 'robots']);
  assert.equal(r6.child.home_language, '');
  const b = await (await post({ nickname: 'Zoe', age: 4 })).json();
  assert.equal(b.child.key, 'kid-zoe-2');
  assert.equal((await post({ nickname: '   ', age: 4 })).status, 400);
  assert.equal((await post({ nickname: 'x'.repeat(17), age: 4 })).status, 400);

  const del = await fetch(`${base}/api/children/kid-zoe-2`, { method: 'DELETE' });
  assert.equal(del.status, 200);
  assert.equal((await fetch(`${base}/api/children/nope`, { method: 'DELETE' })).status, 404);

  const { children } = await (await fetch(`${base}/api/children`)).json();
  for (const c of children) {
    assert.equal((await fetch(`${base}/api/children/${c.key}`, { method: 'DELETE' })).status, 200);
  }
  assert.deepEqual((await (await fetch(`${base}/api/children`)).json()).children, []);
});

test('cross-origin writes are refused; same-origin writes pass; no CORS headers', async (t) => {
  const { app, base } = await start();
  t.after(() => app.close());
  const body = JSON.stringify({ nickname: 'Eve', age: 4 });
  const h = { 'content-type': 'application/json' };
  const evil = await fetch(`${base}/api/children`, { method: 'POST', headers: { ...h, origin: 'https://evil.example' }, body });
  assert.equal(evil.status, 403);
  const del = await fetch(`${base}/api/children/maya`, { method: 'DELETE', headers: { origin: 'https://evil.example' } });
  assert.equal(del.status, 403);
  const ok = await fetch(`${base}/api/children`, { method: 'POST', headers: { ...h, origin: base }, body });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('access-control-allow-origin'), null);
});
