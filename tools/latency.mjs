// Latency evidence (docs/06 §4): Suite A (20 chip turns), Suite B (10 text
// turns), Suite C (10 worst-case: fresh session → stage intro). Measures the
// child-perceived round trip (POST → turn event fully received) AND the time
// to the first streamed word (ttft) — with LLM-backed feedback the first words
// are what the child perceives, while the full line still lands well under the
// 2 s product budget. Also records how many turns were actually LLM-served.
// Usage: node tools/latency.mjs   (server must be running)
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getJson, postJson, sseSendTimed } from './http.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVID = join(__dirname, 'evidence');
mkdirSync(EVID, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const r1 = (n) => Math.round(n * 10) / 10;
const stats = (arr) => ({ count: arr.length, p50: r1(pct(arr, 50)), p95: r1(pct(arr, 95)), max: r1(Math.max(...arr)), ms: arr.map(r1) });

// Generic auto-answer: solves any presented turn using its own expectation.
const answerFor = (turn) => {
  const e = turn?.expect;
  if (!e) return { type: 'text', text: 'i like this game' };
  if (['chip', 'count', 'yes-no'].includes(e.type)) return { type: 'chip', chipId: e.answers[0] };
  if (e.type === 'word' || e.type === 'frame') return { type: 'text', text: e.answers[0] };
  if (e.type === 'mood') return { type: 'chip', chipId: 'mood-happy' };
  if (e.type === 'action') return { type: 'chip', chipId: 'mood-happy' };
  return { type: 'text', text: 'i like this game' };
};

// How a turn was served: warm (LLM) or which scripted twin reason.
const serveOf = (turn) => {
  if (!turn) return 'none';
  if (turn.dev?.llm) return 'llm';
  const fb = (turn.events || []).find((e) => e.type === 'llm_fallback');
  return fb ? fb.payload.reason : 'scripted';
};
const tally = (arr) => arr.reduce((acc, x) => ((acc[x] = (acc[x] || 0) + 1), acc), {});

async function suiteA() {
  const ms = [];
  const ttft = [];
  const serves = [];
  let { sessionId, turn } = await postJson('/api/session', { childKey: 'maya', intent: 'learn' });
  turn = (await sseSendTimed(sessionId, { type: 'chip', chipId: 'mood-happy' })).turn; // get into a task
  for (let i = 0; i < 20; i++) {
    if (!turn || turn.effects?.endCard || turn.dev?.phase === 'DONE') {
      ({ sessionId, turn } = await postJson('/api/session', { childKey: 'maya', intent: 'learn' }));
      await sseSendTimed(sessionId, { type: 'chip', chipId: 'mood-happy' });
      continue;
    }
    const input = answerFor(turn);
    await sleep(2500); // free-tier pacing: keep bursts inside the rate window
    const r = await sseSendTimed(sessionId, input);
    ms.push(r.ms);
    ttft.push(r.ttft);
    serves.push(serveOf(r.turn));
    turn = r.turn;
  }
  return { ms, ttft, serves };
}

async function suiteB() {
  const ms = [];
  const ttft = [];
  const serves = [];
  const texts = [
    'i have a cat named mimi', 'my favorite color is blue', 'i like to run and jump',
    'my dog is very funny', 'today i ate rice and fish', 'my brother is little',
    'i saw a big bird', 'i love my mom', 'i go to school', 'i like ice cream',
  ];
  const { sessionId } = await postJson('/api/session', { childKey: 'maya', intent: 'talk' });
  await sseSendTimed(sessionId, { type: 'chip', chipId: 'mood-happy' });
  for (const text of texts) {
    const r = await sseSendTimed(sessionId, { type: 'text', text });
    ms.push(r.ms);
    ttft.push(r.ttft);
    serves.push(serveOf(r.turn));
    await sleep(3000); // pace chat turns for the free tier
  }
  return { ms, ttft, serves };
}

async function suiteC() {
  const ms = [];
  const ttft = [];
  const serves = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    const { sessionId, turn } = await postJson('/api/session', { childKey: 'aarav', intent: 'learn' });
    if (turn) serves.push(serveOf(turn)); // the greeting itself is LLM-backed now
    const r = await sseSendTimed(sessionId, { type: 'chip', chipId: 'mood-happy' }); // → STAGE intro turn
    if (r.turn) serves.push(serveOf(r.turn));
    ms.push(performance.now() - t0);
    ttft.push(r.ttft + (performance.now() - t0 - r.ms)); // first words include the greeting compose
    await sleep(3000); // pace cold starts
  }
  return { ms, ttft, serves };
}

async function main() {
  const health = await getJson('/api/health').catch(() => null);
  if (!health?.ok) {
    console.error('server not running — start it first: npm start');
    process.exit(1);
  }
  console.log('running Suite A (20 chip turns)…');
  const A = await suiteA();
  console.log('pause 20 s (free-tier window)…');
  await sleep(20000);
  console.log('running Suite B (10 text turns)…');
  const B = await suiteB();
  console.log('pause 20 s…');
  await sleep(20000);
  console.log('running Suite C (10 worst-case cold starts)…');
  const C = await suiteC();

  const report = {
    when: new Date().toISOString(),
    llm: health.llm.length ? health.llm : ['scripted-only'],
    suites: {
      A_chip20: { ...stats(A.ms), ttft: stats(A.ttft), served: tally(A.serves), llm_used: `${tally(A.serves).llm || 0}/${A.ms.length}` },
      B_text10: { ...stats(B.ms), ttft: stats(B.ttft), served: tally(B.serves), llm_used: `${tally(B.serves).llm || 0}/${B.ms.length}` },
      C_worst10: { ...stats(C.ms), ttft: stats(C.ttft), served: tally(C.serves), llm_used: `${tally(C.serves).llm || 0}/${C.ms.length}` },
    },
    targets: { chip_full_p95_ms: 1500, text_full_p95_ms: 1500, first_words_p95_ms: 1100, product_budget_ms: 2000 },
  };
  writeFileSync(join(EVID, 'latency.json'), JSON.stringify(report, null, 2));

  console.log('\nSuite        n    llm    served                         full p50/p95/max      first-words p50/p95');
  const line = (name, s) =>
    console.log(
      `${name.padEnd(12)} ${String(s.count).padEnd(4)} ${s.llm_used.padEnd(6)} ` +
      `${JSON.stringify(s.served).padEnd(30)} ` +
      `${String(s.p50).padEnd(7)}${String(s.p95).padEnd(7)}${String(s.max).padEnd(8)} ` +
      `${String(s.ttft.p50).padEnd(7)}${String(s.ttft.p95).padEnd(7)}`,
    );
  line('A chip', report.suites.A_chip20);
  line('B text', report.suites.B_text10);
  line('C worst', report.suites.C_worst10);
  const t = report.targets;
  const s = report.suites;
  console.log(`\nA full p95 ≤ ${t.chip_full_p95_ms}ms: ${s.A_chip20.p95 <= t.chip_full_p95_ms ? '✔' : '✖'}`);
  console.log(`B full p95 ≤ ${t.text_full_p95_ms}ms: ${s.B_text10.p95 <= t.text_full_p95_ms ? '✔' : '✖'}`);
  console.log(`first words p95 ≤ ${t.first_words_p95_ms}ms: ${s.A_chip20.ttft.p95 <= t.first_words_p95_ms && s.B_text10.ttft.p95 <= t.first_words_p95_ms ? '✔' : '✖'}`);
  console.log(`all turns < ${t.product_budget_ms}ms: ${Math.max(s.A_chip20.max, s.B_text10.max, s.C_worst10.max) < t.product_budget_ms ? '✔' : '✖'}`);
  console.log('\nwritten: tools/evidence/latency.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
