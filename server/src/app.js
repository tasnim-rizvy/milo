// Fastify app: JSON/REST API + SSE chat stream + static client (one service,
// one URL — docs/02 §4). LLM keys are optional; the ladder is
// Gemini → Groq → scripted and every path is demoable.
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { config, llmProviders } from './config.js';
import { openStore } from './store.js';
import { seedDemo } from './seed.js';
import { createSession, handleInput } from './engine/session.js';
import { composeFreeTurn } from './llm/compose.js';
import { levelStats } from './engine/curriculum.js';

export async function buildApp(opts = {}) {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });
  const store = opts.store || openStore(opts.dbPath || config.dbPath);
  if (opts.seed ?? config.seedDemo) seedDemo(store);
  app.decorate('miloStore', store);

  // Same-origin only: the built client is served by this server and the Vite dev
  // server proxies /api, so no CORS headers are sent. State-changing requests that
  // carry a foreign Origin (a page on another site) are refused outright.
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' || req.method === 'HEAD') return;
    const origin = req.headers.origin;
    if (origin) {
      let host = '';
      try { host = new URL(origin).host; } catch { /* malformed → refuse */ }
      if (host !== req.headers.host) return reply.code(403).send({ error: 'cross-origin request refused' });
    }
  });

  // Profiles are private to the device that made them. The browser keeps a random
  // device id and sends it as x-milo-device; '' owner = shared demo fixture.
  const deviceOf = (req) => {
    const d = String(req.headers['x-milo-device'] || '');
    return /^[A-Za-z0-9-]{16,64}$/.test(d) ? d : '';
  };
  // Only the two seeded demo fixtures are ever shared, and only when demo mode is on;
  // older unowned profiles from before ownership existed stay hidden.
  const demoOn = !!(opts.seed ?? config.seedDemo);
  const DEMO_KEYS = new Set(['maya', 'aarav']);
  const canUse = (child, device) => !!child && (
    (demoOn && child.owner === '' && DEMO_KEYS.has(child.key)) || (device !== '' && child.owner === device)
  );

  const summarizeChild = (c) => ({
    key: c.key, nickname: c.nickname, avatar: c.avatar, level: c.level,
    reading_band: c.reading_band, age_band: c.age_band, interests: c.interests,
    home_language: c.home_language, last_summary: c.last_summary,
    total_stars: c.total_stars || 0, last_seen: c.last_seen || 0,
  });

  app.get('/api/health', async () => ({
    ok: true,
    service: 'milo',
    llm: llmProviders().map((p) => p.name),
    scriptedAlwaysOn: true,
    time: new Date().toISOString(),
  }));

  app.get('/api/children', async (req) => {
    const dev = deviceOf(req);
    return { children: store.children().filter((c) => canUse(c, dev)).map(summarizeChild) };
  });

  // Kid profiles (the parent corner): create / remove a kid. Per-word progress
  // rows are created lazily by the engine, so a fresh kid needs nothing else.
  const AVATARS = ['🦊', '🐰', '🐼', '🦁', '🐸', '🐨', '🦄', '🐯'];
  const slug = (s) => String(s || '').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'kid';

  // Profile form → starting point. Age + "can read words" set the reading band
  // and the first level; from then on real progress (mastery gates) takes over.
  const INTERESTS = ['animals', 'dinosaurs', 'cars', 'space', 'music', 'drawing', 'cats', 'dogs', 'sports', 'robots'];
  app.post('/api/children', async (req, reply) => {
    const dev = deviceOf(req);
    if (!dev) return reply.code(400).send({ error: 'missing device id' });
    const body = req.body || {};
    const raw = String(body.nickname || '').replace(/\s+/g, ' ').trim();
    if (raw.length < 1 || raw.length > 16) {
      return reply.code(400).send({ error: 'nickname must be 1–16 characters' });
    }
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 4 || age > 6) {
      return reply.code(400).send({ error: 'age must be 4, 5 or 6' });
    }
    const reads = body.reads === true;
    const avatar = AVATARS.includes(body.avatar) ? body.avatar : '🦊';
    const interests = [...new Set(Array.isArray(body.interests) ? body.interests : [])]
      .filter((i) => INTERESTS.includes(i));
    let key = `kid-${slug(raw)}`;
    for (let i = 2; store.child(key); i++) key = `kid-${slug(raw)}-${i}`;
    const child = {
      key, nickname: raw, age_band: age, reading_band: reads ? 'tap-and-type' : 'tap-first', avatar,
      interests, home_language: '', level: age >= 6 && reads ? 2 : 1, total_stars: 0,
      created_at: Date.now(), first_try_correct: 0, first_try_total: 0,
      last_summary: '', last_seen: 0, owner: dev,
    };
    store.saveChild(child);
    return { ok: true, child: summarizeChild(child) };
  });

  app.delete('/api/children/:key', async (req, reply) => {
    const key = req.params.key;
    const dev = deviceOf(req);
    const kid = store.child(key);
    // not yours (or a shared demo kid) looks exactly like "not found"
    if (!kid || kid.owner === '' || kid.owner !== dev) return reply.code(404).send({ error: 'no such child' });
    store.deleteChild(key);
    return { ok: true, children: store.children().filter((c) => canUse(c, dev)).map(summarizeChild) };
  });

  app.get('/api/progress/:key', async (req, reply) => {
    const child = store.child(req.params.key);
    if (!canUse(child, deviceOf(req))) return reply.code(404).send({ error: 'no such child' });
    return {
      child: summarizeChild(child),
      stats: levelStats(store, child),
      progress: store.progressAll(child.key).map((p) => ({
        item_id: p.item_id, box: p.box, correct: p.correct, wrong: p.wrong, next_due: p.next_due,
      })),
      badges: store.badges(child.key),
      events: store.recentEvents(child.key, 25),
    };
  });

  app.post('/api/reset-demo', async (req, reply) => {
    if (!demoOn) return reply.code(404).send({ error: 'demo mode is off' });
    seedDemo(store, { force: true });
    return { ok: true, children: store.children().filter((c) => canUse(c, deviceOf(req))).map(summarizeChild) };
  });

  app.post('/api/session', async (req, reply) => {
    const { childKey = 'maya', intent = 'learn' } = req.body || {};
    const child = store.child(childKey);
    if (!canUse(child, deviceOf(req))) return reply.code(404).send({ error: 'no such child' });
    const { id, turn, opener } = createSession(store, child, intent, { deterministic: demoOn });
    // AI-warm the very first line (greeting or calm-corner opener). The scripted
    // line is already in place as the fallback — a slow model never delays the
    // session beyond its budget. One action → one bubble: it stays ONE message.
    // For a greeting the AI phrases only the hello; the opener's own question
    // (mood ask or wonder puzzle, matching the chips) is pinned verbatim at the end.
    if (turn.messages?.length) {
      const task = intent === 'calm'
        ? { type: 'calm' }
        : {
          type: 'greeting', name: child.nickname, missed: !!opener?.missed,
          // about 1 hello in 3 nods to ONE thing the child loves (never a list)
          ...(child.interests?.length && Math.random() < 0.35 ? { nod: child.interests[Math.floor(Math.random() * child.interests.length)] } : {}),
          ...(opener?.tail ? { endWith: opener.tail } : {}),
        };
      const llm = await composeFreeTurn({
        task, child, store, input: '', history: [],
        scriptedFallback: turn.messages[0].say,
      });
      if (llm.usedLLM) {
        turn.messages[0] = { say: llm.say, mood: intent === 'calm' ? 'care' : 'cheer' };
        turn.dev = { ...(turn.dev || {}), llm: true, llmProvider: llm.provider || null };
      }
    }
    return { sessionId: id, turn, child: summarizeChild(store.child(child.key)) };
  });

  // SSE: POST a child input, stream Milo's reply (chunk* → turn → end).
  app.post('/api/message', async (req, reply) => {
    const { sessionId, input } = req.body || {};
    const sess = sessionId ? store.session(sessionId) : null;
    const child = sess ? store.child(sess.child_key) : null;
    if (child && !canUse(child, deviceOf(req))) return reply.code(404).send({ error: 'no such session' });

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const send = (event, data) => raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    if (!sess || !child) {
      send('turn', { messages: [{ say: 'Whoops! Milo lost track. Please start again! 🦊', mood: 'think' }], options: null, expect: null, effects: {} });
      send('end', {});
      raw.end();
      return;
    }

    const t0 = performance.now();
    try {
      const onChunk = (text) => send('chunk', { text });
      const turn = await handleInput(store, child, sessionId, input || { type: 'text', text: '' }, onChunk);
      turn.latency = { serverMs: Math.round(performance.now() - t0) };
      send('turn', turn);
    } catch (err) {
      send('turn', {
        messages: [{ say: 'Oops! Milo tripped on his tail. Let\'s try that again! 🙈', mood: 'think' }],
        options: null, expect: null, effects: {}, safety: 'ok', mode: 'learning',
      });
    }
    send('end', {});
    raw.end();
  });

  if (existsSync(config.clientDist)) {
    await app.register(fastifyStatic, { root: config.clientDist, prefix: '/' });
    app.setNotFoundHandler((req, reply) => {
      if ((req.raw.url || '').startsWith('/api')) return reply.code(404).send({ error: 'not found' });
      return reply.sendFile('index.html');
    });
  } else {
    app.get('/', async () => ({
      milo: 'API is up. Client build not found — run: npm run build',
      health: '/api/health',
    }));
  }

  return app;
}
