// Latency evidence (docs/06 §4): Suite A (20 chip turns), Suite B (10 text
// turns), Suite C (10 worst-case: fresh session → stage intro). Measures the
// child-perceived round trip: POST → turn event fully received.
// Usage: node tools/latency.mjs   (server must be running)
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getJson, postJson, sseSend } from './http.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVID = join(__dirname, 'evidence');
mkdirSync(EVID, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const r1 = (n) => Math.round(n * 10) / 10;

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

async function suiteA() {
  const out = [];
  let { sessionId, turn } = await postJson('/api/session', { childKey: 'maya', intent: 'learn' });
  turn = (await sseSend(sessionId, { type: 'chip', chipId: 'mood-happy' })).turn; // get into a task
  for (let i = 0; i < 20; i++) {
    if (!turn || turn.effects?.endCard || turn.dev?.phase === 'DONE') {
      ({ sessionId, turn } = await postJson('/api/session', { childKey: 'maya', intent: 'learn' }));
      await sseSend(sessionId, { type: 'chip', chipId: 'mood-happy' });
      continue;
    }
    const input = answerFor(turn);
    await sleep(700); // outwait the double-tap guard: every sample is a real turn
    const r = await sseSend(sessionId, input);
    out.push(r.ms);
    turn = r.turn;
  }
  return out;
}

async function suiteB() {
  const out = [];
  const texts = [
    'i have a cat named mimi', 'my favorite color is blue', 'i like to run and jump',
    'my dog is very funny', 'today i ate rice and fish', 'my brother is little',
    'i saw a big bird', 'i love my mom', 'i go to school', 'i like ice cream',
  ];
  const { sessionId } = await postJson('/api/session', { childKey: 'maya', intent: 'talk' });
  await sseSend(sessionId, { type: 'chip', chipId: 'mood-happy' });
  for (const text of texts) {
    const r = await sseSend(sessionId, { type: 'text', text });
    out.push(r.ms);
  }
  return out;
}

async function suiteC() {
  const out = [];
  for (let i = 0; i < 10; i++) {
    const t0 = performance.now();
    const { sessionId } = await postJson('/api/session', { childKey: 'aarav', intent: 'learn' });
    await sseSend(sessionId, { type: 'chip', chipId: 'mood-happy' }); // → STAGE intro turn
    out.push(performance.now() - t0);
  }
  return out;
}

async function main() {
  const health = await getJson('/api/health').catch(() => null);
  if (!health?.ok) {
    console.error('server not running — start it first: npm start');
    process.exit(1);
  }
  console.log('running Suite A (20 chip turns)…');
  const A = await suiteA();
  console.log('running Suite B (10 text turns)…');
  const B = await suiteB();
  console.log('running Suite C (10 worst-case cold starts)…');
  const C = await suiteC();

  const report = {
    when: new Date().toISOString(),
    llm: health.llm.length ? health.llm : ['scripted-only'],
    suites: {
      A_chip20: { count: A.length, p50: r1(pct(A, 50)), p95: r1(pct(A, 95)), max: r1(Math.max(...A)), ms: A.map(r1) },
      B_text10: { count: B.length, p50: r1(pct(B, 50)), p95: r1(pct(B, 95)), max: r1(Math.max(...B)), ms: B.map(r1) },
      C_worst10: { count: C.length, p50: r1(pct(C, 50)), p95: r1(pct(C, 95)), max: r1(Math.max(...C)), ms: C.map(r1) },
    },
    targets: { chip_p95_ms: 500, text_p95_ms: 1500, product_budget_ms: 2000 },
  };
  writeFileSync(join(EVID, 'latency.json'), JSON.stringify(report, null, 2));

  console.log('\nSuite        n   p50      p95      max      target');
  const line = (name, s, target) =>
    console.log(`${name.padEnd(12)} ${String(s.count).padEnd(3)} ${String(s.p50).padEnd(8)} ${String(s.p95).padEnd(8)} ${String(s.max).padEnd(8)} ${target}`);
  line('A chip', report.suites.A_chip20, `p95 ≤ ${report.targets.chip_p95_ms}ms ${report.suites.A_chip20.p95 <= 500 ? '✔' : '✖'}`);
  line('B text', report.suites.B_text10, `p95 ≤ ${report.targets.text_p95_ms}ms ${report.suites.B_text10.p95 <= 1500 ? '✔' : '✖'}`);
  line('C worst', report.suites.C_worst10, `product < ${report.targets.product_budget_ms}ms ${report.suites.C_worst10.p95 < 2000 ? '✔' : '✖'}`);
  console.log('\nwritten: tools/evidence/latency.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
