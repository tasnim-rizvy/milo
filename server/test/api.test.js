import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { openStore } from '../src/store.js';

async function start() {
  const store = openStore(':memory:');
  const app = await buildApp({ store, seed: true });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { app, base, store };
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
  assert.deepEqual(sess.turn.options.map((o) => o.id), ['wonder-a', 'wonder-b']);
  assert.ok(!sess.turn.options.some((o) => o.kind === 'mood'), 'no mood buttons');

  const res = await fetch(`${base}/api/message`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: sess.sessionId, input: { type: 'chip', chipId: 'wonder-a' } }),
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
  const DEV = 'device-aaaaaaaaaaaaaaaa';
  const post = (body) => fetch(`${base}/api/children`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-milo-device': DEV }, body: JSON.stringify(body),
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

  const del = await fetch(`${base}/api/children/kid-zoe-2`, { method: 'DELETE', headers: { 'x-milo-device': DEV } });
  assert.equal(del.status, 200);
  assert.equal((await fetch(`${base}/api/children/nope`, { method: 'DELETE', headers: { 'x-milo-device': DEV } })).status, 404);

  const mine = await (await fetch(`${base}/api/children`, { headers: { 'x-milo-device': DEV } })).json();
  for (const c of mine.children.filter((c) => c.key.startsWith('kid-'))) {
    assert.equal((await fetch(`${base}/api/children/${c.key}`, { method: 'DELETE', headers: { 'x-milo-device': DEV } })).status, 200);
  }
  const left = await (await fetch(`${base}/api/children`, { headers: { 'x-milo-device': DEV } })).json();
  assert.deepEqual(left.children.filter((c) => c.key.startsWith('kid-')), []);
});

test('cross-origin writes are refused; same-origin writes pass; no CORS headers', async (t) => {
  const { app, base } = await start();
  t.after(() => app.close());
  const body = JSON.stringify({ nickname: 'Eve', age: 4 });
  const h = { 'content-type': 'application/json', 'x-milo-device': 'device-bbbbbbbbbbbbbbbb' };
  const evil = await fetch(`${base}/api/children`, { method: 'POST', headers: { ...h, origin: 'https://evil.example' }, body });
  assert.equal(evil.status, 403);
  const del = await fetch(`${base}/api/children/maya`, { method: 'DELETE', headers: { origin: 'https://evil.example' } });
  assert.equal(del.status, 403);
  const ok = await fetch(`${base}/api/children`, { method: 'POST', headers: { ...h, origin: base }, body });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('access-control-allow-origin'), null);
});

test('profiles are private to their device (list, play, progress, delete); demo kids are shared but undeletable', async (t) => {
  const { app, base, store } = await start();
  t.after(() => app.close());
  const A = { 'x-milo-device': 'device-aaaaaaaaaaaaaaaa' };
  const B = { 'x-milo-device': 'device-bbbbbbbbbbbbbbbb' };
  const json = { 'content-type': 'application/json' };

  // no device id → cannot create
  assert.equal((await fetch(`${base}/api/children`, { method: 'POST', headers: json, body: JSON.stringify({ nickname: 'Ann', age: 4 }) })).status, 400);

  const ann = (await (await fetch(`${base}/api/children`, { method: 'POST', headers: { ...json, ...A }, body: JSON.stringify({ nickname: 'Ann', age: 4 }) })).json()).child;
  const keysFor = async (h) => (await (await fetch(`${base}/api/children`, { headers: h })).json()).children.map((c) => c.key);

  assert.ok((await keysFor(A)).includes(ann.key));
  assert.ok(!(await keysFor(B)).includes(ann.key));
  assert.ok(!(await keysFor({})).includes(ann.key));
  // device B cannot reach her progress, start her session, or delete her
  assert.equal((await fetch(`${base}/api/progress/${ann.key}`, { headers: B })).status, 404);
  assert.equal((await fetch(`${base}/api/session`, { method: 'POST', headers: { ...json, ...B }, body: JSON.stringify({ childKey: ann.key, intent: 'learn' }) })).status, 404);
  assert.equal((await fetch(`${base}/api/children/${ann.key}`, { method: 'DELETE', headers: B })).status, 404);
  assert.ok((await keysFor(A)).includes(ann.key));
  // …and a session started by A cannot be driven from B
  const sess = await (await fetch(`${base}/api/session`, { method: 'POST', headers: { ...json, ...A }, body: JSON.stringify({ childKey: ann.key, intent: 'learn' }) })).json();
  const stolen = await fetch(`${base}/api/message`, { method: 'POST', headers: { ...json, ...B }, body: JSON.stringify({ sessionId: sess.sessionId, input: { type: 'text', text: 'hi' } }) });
  assert.equal(stolen.status, 404);

  // an unowned legacy row is never shared, even in demo mode
  store.saveChild({ key: 'legacy', nickname: 'Old', age_band: 4, reading_band: 'tap-first', avatar: '🦊', interests: [], level: 1 });
  assert.ok(!(await keysFor(B)).includes('legacy'));
  assert.ok(!(await keysFor(A)).includes('legacy'));

  // shared demo fixtures: visible to everyone, never deletable
  assert.ok((await keysFor(B)).includes('maya'));
  assert.equal((await fetch(`${base}/api/children/maya`, { method: 'DELETE', headers: B })).status, 404);
  assert.equal((await fetch(`${base}/api/children/${ann.key}`, { method: 'DELETE', headers: A })).status, 200);
});

test('progress summary: level path, learned words, feelings, milestones that unlock early', async (t) => {
  const { app, base } = await start();
  t.after(() => app.close());
  const p = await (await fetch(`${base}/api/progress/aarav`)).json();
  const s = p.summary;
  assert.equal(s.level, 2);
  assert.ok(s.words.learned.length > 0 && s.words.learned[0].emoji && s.words.learned[0].text);
  assert.ok(s.toNext >= 0 && s.toNext <= 100);
  assert.ok(s.milestones.length >= 6);
  const earned = Object.fromEntries(s.milestones.map((m) => [m.id, m.earned]));
  assert.equal(earned['level-2'], true);
  assert.equal(earned['level-3'], false);
  // a brand-new profile starts at zero, nothing earned, and no crash
  const fresh = await (await fetch(`${base}/api/children`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-milo-device': 'device-cccccccccccccccc' },
    body: JSON.stringify({ nickname: 'New', age: 4 }),
  })).json();
  const f = await (await fetch(`${base}/api/progress/${fresh.child.key}`, { headers: { 'x-milo-device': 'device-cccccccccccccccc' } })).json();
  assert.equal(f.summary.stars, 0);
  assert.equal(f.summary.words.learned.length, 0);
  assert.ok(f.summary.milestones.every((m) => !m.earned));
});

test('edit a profile: own device only, validated, progress and level untouched', async (t) => {
  const { app, base, store } = await start();
  t.after(() => app.close());
  const A = { 'x-milo-device': 'device-aaaaaaaaaaaaaaaa', 'content-type': 'application/json' };
  const B = { 'x-milo-device': 'device-bbbbbbbbbbbbbbbb', 'content-type': 'application/json' };
  const made = (await (await fetch(`${base}/api/children`, { method: 'POST', headers: A, body: JSON.stringify({ nickname: 'Mia', age: 4, interests: ['cars'] }) })).json()).child;
  store.addStars(made.key, 7);
  const patch = (key, headers, body) => fetch(`${base}/api/children/${key}`, { method: 'PATCH', headers, body: JSON.stringify(body) });

  const ok = await patch(made.key, A, { nickname: 'Mimi', age: 6, reads: true, avatar: '🐼', interests: ['space', 'music', 'nope'] });
  assert.equal(ok.status, 200);
  const c = (await ok.json()).child;
  assert.equal(c.nickname, 'Mimi');
  assert.equal(c.age_band, 6);
  assert.equal(c.reading_band, 'tap-and-type');
  assert.equal(c.avatar, '🐼');
  assert.deepEqual(c.interests, ['space', 'music']);
  assert.equal(c.key, made.key, 'the profile key never changes');
  assert.equal(c.level, 1, 'level is earned, not edited');
  assert.equal(c.total_stars, 7, 'stars are kept');

  assert.equal((await patch(made.key, A, { nickname: '', age: 5 })).status, 400);
  assert.equal((await patch(made.key, A, { nickname: 'Mimi', age: 9 })).status, 400);
  assert.equal((await patch(made.key, B, { nickname: 'Hax', age: 5 })).status, 404, 'another device cannot edit');
  assert.equal((await patch('maya', A, { nickname: 'Hax', age: 5 })).status, 404, 'demo kids are not editable');
  assert.equal(store.child(made.key).nickname, 'Mimi');
});
