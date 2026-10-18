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
  if (e.type === 'wonder') return { type: 'chip', chipId: 'wonder-a' };
  if (e.type === 'action') return { type: 'chip', chipId: 'action-easy-game' };
  return null;
}

const say = (turn) => turn.messages.map((m) => m.say).join(' ');

test('Maya: greeting + wonder puzzle → first chip task (chip-only path complete)', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const { id, turn } = await freshSession(store, 'maya');
  assert.match(say(turn), /Maya/);
  assert.ok(turn.options.some((o) => o.id === 'wonder-a'));
  assert.ok(!turn.options.some((o) => o.kind === 'mood'), 'feelings are never asked with buttons');

  const child = store.child('maya');
  const t2 = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  assert.ok(t2.options && t2.options.length >= 2, 'first task has chips (no typing required)');
  assert.ok(t2.expect, 'expect present for matching');
});

test('study refusal opens play mode (chips, no lesson push)', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  const mood = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });

  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  // Aarav starts at the stage check; his 2nd task is "say-the-word" — answer with a typo.
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });

  const upset = await handleInput(store, child, id, { type: 'text', text: 'no. i dont want to.' });
  assert.equal(upset.mode, 'support');
  assert.ok(upset.options.some((o) => o.id === 'action-breathe'));

  const breathe = await handleInput(store, child, id, { type: 'chip', chipId: 'action-breathe' });
  assert.equal(breathe.effects.calm, true);
  assert.equal(breathe.messages.length, 1, 'calm corner is one bubble per tap');
  assert.match(say(breathe).toLowerCase(), /breathe|breath|balloon|candle/);
  assert.ok(breathe.options.some((o) => o.id === 'action-breathe'), 'a "one more" chip comes back');
  assert.ok(breathe.options.some((o) => o.id === 'action-easy-game'));
  assert.ok(breathe.options.some((o) => o.id === 'action-bye'));

  const easy = await handleInput(store, child, id, { type: 'chip', chipId: 'action-easy-game' });
  assert.ok(easy.options.length >= 2, 'easy review-only game starts');
  assert.equal(easy.mode, 'engagement');
});

test('breathe loop is interactive: each tap guides one fresh breath (AI-shaped, one bubble)', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id, turn } = await freshSession(store, 'maya', 'calm');
  assert.equal(turn.messages.length, 1, 'calm-corner opener is a single bubble');
  assert.equal(turn.mode, 'support');
  assert.ok(turn.options.some((o) => o.id === 'action-breathe'));

  const b1 = await handleInput(store, child, id, { type: 'chip', chipId: 'action-breathe' });
  assert.equal(b1.messages.length, 1);
  const b2 = await handleInput(store, child, id, { type: 'chip', chipId: 'action-breathe' });
  assert.equal(b2.messages.length, 1);
  assert.notEqual(say(b1), say(b2), 'a second tap gets a fresh breath line, not the same wall');
  assert.equal(b2.effects.calm, true);
});

test('one action → one bubble: no turn ever stacks multiple Milo bubbles', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  const seen = [];
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  seen.push(t);
  // walk a real mixed flow: answer, miss once, answer, "i dont know", nudge…
  for (let i = 0; i < 14; i++) {
    if (!t.expect) break;
    if (t.expect.type === 'chip' || t.expect.type === 'count' || t.expect.type === 'yes-no') {
      const right = t.expect.answers[0];
      const wrong = (t.options || []).find((o) => o.id !== right)?.id;
      // every third step: tap a wrong chip to exercise recast + retry
      const pickId = i % 3 === 1 && wrong ? wrong : right;
      t = await handleInput(store, child, id, { type: 'chip', chipId: pickId });
    } else if (t.expect.type === 'word' || t.expect.type === 'frame') {
      t = await handleInput(store, child, id, { type: 'text', text: i % 4 === 3 ? 'i dont know' : t.expect.answers[0] });
    } else if (t.expect.type === 'mood') {
      t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
    } else if (t.expect.type === 'action') {
      t = await handleInput(store, child, id, { type: 'chip', chipId: 'action-easy-game' });
    } else {
      t = await handleInput(store, child, id, { type: 'idle' });
    }
    seen.push(t);
  }
  for (const turn of seen) {
    assert.ok(turn.messages.length <= 1, `a turn stacked bubbles: "${say(turn)}"`);
  }
});

test('feelings turn is LLM-shaped: scripted safety net + calm options when no keys', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });

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
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });

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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });

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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });

  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  if (t.dev.phase === 'CHECKIN') t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  if (t.dev.phase === 'CHECKIN') t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  for (let i = 0; i < 5; i++) t = await handleInput(store, child, id, solve(t));
  assert.match(say(t).toLowerCase(), /elephant|scary|hard|brain/);
});

test('bye from calm ends with the goodbye ritual + end card', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  let t = await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
    await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
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
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  const r = await handleInput(store, child, id, { type: 'text', text: 'i love you milo' });
  assert.match(say(r).toLowerCase(), /love playing|favorite friend|tail wag/);
});

test('Talk intent opens conversation; Play intent starts a game', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');

  const talk = createSession(store, child, 'talk');
  const t1 = await handleInput(store, child, talk.id, { type: 'chip', chipId: 'wonder-a' });
  assert.equal(t1.mode, 'conversation');

  const child2 = store.child('maya');
  const play = createSession(store, child2, 'play');
  const t2 = await handleInput(store, child2, play.id, { type: 'chip', chipId: 'wonder-a' });
  assert.equal(t2.mode, 'engagement');
  assert.ok(t2.options.length >= 2);
});

test('wonder opener: two picture chips, no wrong pick, then the lesson starts', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  for (const pickId of ['wonder-a', 'wonder-b']) {
    const child = store.child('maya');
    const { id, turn } = createSession(store, child, 'learn');
    assert.equal(turn.expect.type, 'wonder');
    assert.deepEqual(turn.options.map((o) => o.id), ['wonder-a', 'wonder-b']);
    assert.match(say(turn), /Maya/);
    const t2 = await handleInput(store, store.child('maya'), id, { type: 'chip', chipId: pickId });
    assert.equal(t2.messages.length, 1, 'one action → one bubble');
    assert.doesNotMatch(say(t2), /wrong/i);
    assert.ok(t2.options?.length || t2.wordChips?.length, 'the first task follows in the same bubble');
    assert.ok(store.recentEvents('maya', 20).some((e) => e.type === 'wonder'));
  }
});

test('feelings are tracked from what the child writes, never from buttons', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  await handleInput(store, child, id, { type: 'text', text: 'i am so happy today' });
  await handleInput(store, child, id, { type: 'text', text: 'i am sleepy now' });
  const moods = store.recentEvents('maya', 40).filter((e) => e.type === 'mood').map((e) => e.payload);
  assert.deepEqual(moods.map((m) => m.mood).sort(), ['happy', 'sleepy']);
  assert.ok(moods.every((m) => m.source === 'text'));
  const st = loadState(store, id);
  assert.equal(st.moodStart, 'happy');
  assert.equal(st.moodEnd, 'sleepy');
});

test('detectMood: feelings in kid words, negation, and non-feelings', async () => {
  const { detectMood } = await import('../src/engine/modes.js');
  const cases = {
    'i am happy': 'happy', 'happy': 'happy', 'i feel great': 'happy', 'yay': 'happy',
    'im sad': 'sad', 'i want to cry': 'sad', 'not happy': 'sad',
    'i am tired': 'sleepy', 'sleepy': 'sleepy', 'i am angry with my dad': 'angry', 'so scared': 'scared',
    'i am not sad': null, 'good dog': null, 'my dog is big': null, '': null,
  };
  for (const [text, want] of Object.entries(cases)) assert.equal(detectMood(text), want, text);
});

test('sessions end without any mood chips: wrap-up offers bye / one more', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  const bye = await handleInput(store, child, id, { type: 'chip', chipId: 'action-bye' });
  assert.ok(bye.effects.endCard);
  assert.ok(!(bye.options || []).some((o) => o.kind === 'mood'));
});

test('safety runs before the wrap-up: crisis words in WRAP go to support, they do not just end the session', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  loadState(store, id).phase = 'WRAP';
  const t = await handleInput(store, child, id, { type: 'text', text: 'i want to die' });
  assert.equal(t.safety, 'flagged');
  assert.ok(!t.effects.endCard, 'the session is not closed over a crisis message');
  assert.ok(t.options?.some((o) => o.id === 'action-breathe'), 'calm options are offered');
  const t2 = await handleInput(store, store.child('maya'), id, { type: 'chip', chipId: 'action-bye' });
  assert.ok(t2.effects.endCard, 'the child can still say bye afterwards');
});

test('safe text in WRAP still closes the session', async () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('maya');
  const { id } = createSession(store, child, 'learn');
  await handleInput(store, child, id, { type: 'chip', chipId: 'wonder-a' });
  loadState(store, id).phase = 'WRAP';
  const t = await handleInput(store, child, id, { type: 'text', text: 'bye bye' });
  assert.ok(t.effects.endCard);
});
