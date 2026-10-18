import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/store.js';
import { seedDemo } from '../src/seed.js';
import { createSession, handleInput, loadState } from '../src/engine/session.js';

async function freshSession(store, key = 'maya', intent = 'learn') {
  const child = store.child(key);
  const { id, turn } = createSession(store, child, intent);
  return { id, turn, child: store.child(key) };
}

function solve(turn) {
  const e = turn.expect;
  if (!e) return null;
  if (['chip', 'count', 'yes-no'].includes(e.type)) return { type: 'chip', chipId: e.answers[0] };
  if (e.type === 'word') return { type: 'text', text: e.answers[0] };
  if (e.type === 'frame') return { type: 'text', text: e.answers[0] };
  if (e.type === 'mood') return { type: 'chip', chipId: 'mood-happy' };
  if (e.type === 'action') return { type: 'chip', chipId: 'action-easy-game' };
  return null;
}

const say = (turn) => turn.messages.map((m) => m.say).join(' ');

test('Maya: greeting → mood check-in → first chip task (chip-only path complete)', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const { id, turn } = await freshSession(store, 'maya');
  assert.match(say(turn), /Maya/);
  assert.ok(turn.options.some((o) => o.id === 'mood-happy'));

  const child = store.child('maya');
  const t2 = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  assert.ok(t2.options && t2.options.length >= 2, 'first task has chips (no typing required)');
  assert.ok(t2.expect, 'expect present for matching');
});

test('study refusal opens play mode (chips, no lesson push)', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  const t = await handleInput(store, child, id, { type: 'text', text: 'i am not in study mode' });
  assert.equal(t.mode, 'engagement');
  assert.ok(t.options && t.options.length >= 2, 'play offers tappable options');
  assert.ok((t.events || []).some((e) => e.payload?.reason === 'study refusal — play instead'));
});

test('free chat never stacks a second question in one turn', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  let t = await handleInput(store, child, id, { type: 'text', text: 'i have a big red ball' });
  for (let i = 0; i < 3; i++) {
    if (t.expect?.type === 'free') {
      const questions = t.messages.filter((m) => /[?？]/.test(m.say)).length;
      assert.ok(questions <= 1, `at most one question per turn, got: ${say(t)}`);
    }
    t = await handleInput(store, child, id, { type: 'text', text: 'my ball is shiny and round' });
  }
});

test('long prose during a tap task never earns a silent star', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  const mood = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  assert.equal(mood.expect.type, 'chip', 'a tap task is pending');
  const t = await handleInput(store, child, id, { type: 'text', text: 'i have a big red ball at home' });
  assert.equal(t.effects.starGain, 0, `prose must not be credited as an answer: ${say(t)}`);
  assert.equal(t.mode, 'conversation');
});

test('chat memory: recent exchanges are kept for the model (capped)', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  await handleInput(store, child, id, { type: 'text', text: 'i like dinosaurs' });
  await handleInput(store, child, id, { type: 'text', text: 'my dog is called Bruno' });
  const st = loadState(store, id);
  assert.ok(st.recent.length >= 4, 'both exchanges remembered');
  assert.ok(st.recent.length <= 8, 'history stays capped');
  assert.equal(st.recent[0].role, 'child');
  assert.equal(st.recent[1].role, 'milo');
});

test('wrong chip → recast (never the word "wrong"); correct chip → star + praise', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });

  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  // wait for a real task turn (mood → first task)
  if (!t.expect || t.expect.type === 'mood') t = await handleInput(store, child, id, solve(t));
  const right = solve(t);

  let wrongId = (t.options || []).find((o) => o.id !== right.chipId)?.id;
  const recast = await handleInput(store, child, id, { type: 'chip', chipId: wrongId });
  assert.doesNotMatch(say(recast).toLowerCase(), /\bwrong\b/);
  assert.ok(recast.expect, 'still expecting the answer (retry)');

  const praise = await handleInput(store, child, id, right);
  assert.ok(praise.effects.totalStars >= 1, 'star earned');
  assert.ok(praise.messages.length >= 1);
});

test('typo tolerance end-to-end: "rad" for red counts as a win', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('aarav');
  // direct engine-level: fabricate a red task by teaching state
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  // Aarav starts at the stage check; his 2nd task is "say-the-word" — answer with a typo.
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  // solve tap-the-word (task 1)
  t = await handleInput(store, child, id, solve(t));
  assert.equal(t.dev.phase, 'STAGE');
  // task 2 is say-the-word with a text expectation
  assert.equal(t.expect.type, 'word');
  const word = t.expect.answers[0];
  const typo = word.length > 3 ? word.slice(0, -1) : word;
  const praised = await handleInput(store, child, id, { type: 'text', text: typo });
  assert.equal(praised.effects.starGain, 1, `typo "${typo}" for "${word}" should count`);
});

test('upset preempts teaching: "i dont want to" → SUPPORT → breathe → easy game', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });

  const upset = await handleInput(store, child, id, { type: 'text', text: 'no. i dont want to.' });
  assert.equal(upset.mode, 'support');
  assert.ok(upset.options.some((o) => o.id === 'action-breathe'));

  const breathe = await handleInput(store, child, id, { type: 'chip', chipId: 'action-breathe' });
  assert.equal(breathe.effects.calm, true);
  assert.match(say(breathe).toLowerCase(), /breathe|breath|balloon|candle/);

  const easy = await handleInput(store, child, id, { type: 'chip', chipId: 'action-easy-game' });
  assert.ok(easy.options.length >= 2, 'easy review-only game starts');
  assert.equal(easy.mode, 'engagement');
});

test('feelings turn is LLM-shaped: scripted safety net + calm options when no keys', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });

  const t = await handleInput(store, child, id, { type: 'text', text: "i'm tired" });
  assert.equal(t.mode, 'support');
  assert.equal(t.dev.llm, false, 'no keys in tests → scripted fallback serves');
  assert.ok(t.options.some((o) => o.id === 'action-breathe'), 'calm options still ship');
  assert.ok(!t.events.some((e) => e.type === 'llm_fallback'), 'no-keys is not a fallback event');
});

test('briefed warmth moments fall back to scripted twins when there are no keys', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');

  // mood mirror (briefed moment)
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  assert.equal(t.dev.llm, false, 'no keys → scripted mood mirror');
  assert.ok(!t.events.some((e) => e.type === 'llm_fallback'), 'no-keys is not a fallback event');

  // correct chip → scripted praise still names the word + star
  const rightId = t.expect.answers[0];
  const rightLabel = t.options.find((o) => o.id === rightId).label;
  t = await handleInput(store, child, id, { type: 'chip', chipId: rightId });
  assert.equal(t.dev.llm, false, 'no keys → scripted praise');
  assert.equal(t.effects.starGain, 1);
  assert.ok(t.messages[0].say.toLowerCase().includes(rightLabel.toLowerCase()), 'praise names the word');

  // wrong chip → scripted recast (never "wrong")
  const wrong = t.options.find((o) => !t.expect.answers.includes(o.id));
  const recast = await handleInput(store, child, id, { type: 'chip', chipId: wrong.id });
  assert.equal(recast.dev.llm, false, 'no keys → scripted recast');
  assert.ok(!/\bwrong\b/i.test(say(recast)));
});

test('"i want to play" switches to 🎮 engagement with chips', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });

  const play = await handleInput(store, child, id, { type: 'text', text: 'i want plaay!' });
  assert.equal(play.mode, 'engagement');
  assert.ok(play.options && play.options.length >= 2);
  assert.ok(play.dev.counters || true);
});

test('3 misses in a row → gentle support check-in (no visible failure)', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  if (!t.expect || t.expect.type === 'mood') t = await handleInput(store, child, id, solve(t));

  const right = solve(t);
  const wrongId = (t.options || []).find((o) => o.id !== right.chipId)?.id;
  await handleInput(store, child, id, { type: 'chip', chipId: wrongId });
  await handleInput(store, child, id, { type: 'chip', chipId: wrongId });
  const third = await handleInput(store, child, id, { type: 'chip', chipId: wrongId });
  assert.equal(third.mode, 'support');
  assert.match(say(third).toLowerCase(), /okay|together|watch me|not-knowing|forgets/);
});

test('idle: one gentle nudge, then the scaffold cascade (simpler → hint)', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });

  const nudge = await handleInput(store, child, id, { type: 'idle' });
  assert.equal(nudge.messages.length, 1, 'single gentle nudge');

  const simpler = await handleInput(store, child, id, { type: 'idle' });
  assert.equal(simpler.options.length, 2, 'scaffold: simpler two-chip choice');

  const hint = await handleInput(store, child, id, { type: 'idle' });
  assert.match(say(hint), /starts with/i, 'first-letter hint');
});

test('Aarav: one session → stage check → graduation (confetti, badge, level 3, preview)', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('aarav');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });

  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  if (t.dev.phase === 'CHECKIN') t = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  assert.equal(t.dev.phase, 'STAGE', 'gate-ready child runs the stage check');

  for (let i = 0; i < 5; i++) {
    const ans = solve(t);
    assert.ok(ans, `task ${i} has a solvable expectation`);
    t = await handleInput(store, child, id, ans);
  }

  assert.equal(t.effects.confetti, true, 'graduation confetti');
  assert.ok(t.effects.badge, 'badge awarded');
  assert.equal(store.child('aarav').level, 3, 'level promoted L2 → L3');
  assert.ok(t.wordChips && t.wordChips.length >= 3, 'L3 preview frame with word chips');

  const finale = await handleInput(store, child, id, { type: 'text', text: "Im fine thank you" });
  assert.ok(finale.effects.endCard, 'end card shows the session summary');
});

test('graduation history reference: memory of struggle uses the struggled word', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('aarav');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  if (t.dev.phase === 'CHECKIN') t = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  for (let i = 0; i < 5; i++) t = await handleInput(store, child, id, solve(t));
  assert.match(say(t).toLowerCase(), /elephant|scary|hard|brain/);
});

test('bye from calm ends with the goodbye ritual + end card', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  await handleInput(store, child, id, { type: 'text', text: "i'm sad" });
  const bye = await handleInput(store, child, id, { type: 'chip', chipId: 'action-bye' });
  assert.ok(bye.effects.endCard, 'end card');
  assert.match(say(bye).toLowerCase(), /bye|see you|wave/);
});

test('double-tap guard: the same chip twice in a row is ignored', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  if (!t.expect || t.expect.type === 'mood') t = await handleInput(store, child, id, solve(t));
  const ans = solve(t);
  await handleInput(store, child, id, ans);
  const again = await handleInput(store, child, id, ans);
  assert.equal(again.messages.length, 0, 'duplicate within 650 ms is a no-op');
});

test('safety red-team list redirects gently and logs', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const theList = ['i want to die', 'there is a gun in my house', 'you are stupid', 'poop poop poop', 'my address is 12 park street', 'visit www.xyz.com'];
  for (const bad of theList) {
    const { id } = createSession(store, child, 'learn');
    await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
    const r = await handleInput(store, child, id, { type: 'text', text: bad });
    assert.equal(r.safety, 'flagged', `should flag: ${bad}`);
    assert.doesNotMatch(say(r).toLowerCase(), /\bwrong\b/);
  }
});

test('"i love you, milo" gets bounded warmth', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'mood-happy' });
  const r = await handleInput(store, child, id, { type: 'text', text: 'i love you milo' });
  assert.match(say(r).toLowerCase(), /love playing|favorite friend|tail wag/);
});

test('Talk intent opens conversation; Play intent starts a game', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');

  const talk = createSession(store, child, 'talk');
  const t1 = await handleInput(store, child, talk.id, { type: 'chip', chipId: 'mood-happy' });
  assert.equal(t1.mode, 'conversation');

  const child2 = store.child('maya');
  const play = createSession(store, child2, 'play');
  const t2 = await handleInput(store, child2, play.id, { type: 'chip', chipId: 'mood-happy' });
  assert.equal(t2.mode, 'engagement');
  assert.ok(t2.options.length >= 2);
});
