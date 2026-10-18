// Dialog manager (docs/02 §5): HOME → GREET → CHECK-IN → REVIEW → TEACH
// (model → join-in → independent) → PLAY → CELEBRATE → WRAP-UP, with
// CONVERSATION (≤3 turns) and SUPPORT_CALM interrupts. SUPPORT preempts
// everything; the engine owns all task logic, while the warmth moments (praise,
// recast, growth, check-ins, moods, feelings, free chat) are phrased by the
// LLM from strict turn briefs — with the scripted bank as the always-on safety
// net. "wrong" is never said.
import { matchAnswer, containsAny, normalize } from './matching.js';
import { classifySafety, SAFETY_REDIRECTS } from './safety.js';
import { classifyInput, nextMode } from './modes.js';
import { LINES, CHAT_SCRIPTED, MOOD_STYLES, WONDERS, WONDER_INTROS, WONDER_RIGHT, WONDER_TRY, pick } from './sel.js';
import {
  applyAnswer, buildPlan, buildStageCheck, chipOptions, gateReady,
  itemById, itemsOfTheme, stageCheckVerdict, weakestItems,
} from './curriculum.js';
import { FRAMES, STORIES, SCENES } from './bank.js';
import { composeFreeTurn } from '../llm/compose.js';

const LIVE = new Map();
const now = () => Date.now();
const SOFT_MS = 8 * 60e3;
const HARD_MS = 12 * 60e3;
const rid = () => Math.random().toString(36).slice(2, 10);
const pickArr = (arr) => arr[Math.floor(Math.random() * arr.length)];

const msg = (say, mood = 'happy') => ({ say, mood });

// "One action → one bubble" (product rule): every turn ships exactly ONE Milo
// bubble. A scripted follow-up line (the next task's prompt) is folded into the
// same bubble; when the turn is LLM-phrased, the brief pins that exact line as
// the message ending (task.endWith) so the model cannot drift off it.
const joinSays = (parts) => parts.filter(Boolean).join(' ');
const merged = (head, tailMsgs = []) => joinSays([head, ...tailMsgs.map((m) => m.say)]);

// A scripted reply is never a mystery: log why the LLM didn't serve.
function logLlmFallback(events, llm, where) {
  if (!llm.usedLLM && llm.reason && llm.reason !== 'no-keys') {
    events.push({
      type: 'llm_fallback',
      payload: { reason: llm.reason, where, ...(llm.detail ? { detail: llm.detail } : {}) },
    });
  }
}

// Did the session advance (new question / phase / mood) during this input?
// Used by the double-tap guard. Counters and options are intentionally absent.
const progressSigOf = (s) => JSON.stringify([
  s.phase, s.ended, s.moodStart, s.moodEnd,
  s.current?.item?.id || null, s.current?.stage || null, s.current?.presentedAt || 0,
  s.stage?.idx ?? null,
  s.playTask?.presentedAt || 0, s.playTask?.round || 0,
  s.playTask?.beatIdx ?? null, s.playTask?.sceneIdx ?? null, s.playTask?.storyId || null,
]);

function snapshot(state) {
  return {
    phase: state.phase,
    intent: state.intent,
    level: state.level,
    planIds: state.plan
      ? {
        review: state.plan.review.map((i) => i.id),
        teach: state.plan.teach.map((i) => i.id),
        stretch: state.plan.stretch.map((i) => i.id),
        playKinds: state.plan.playKinds,
      }
      : null,
    current: state.current
      ? { itemId: state.current.item.id, stage: state.current.stage, attempts: state.current.attempts, presentedAt: state.current.presentedAt, item: state.current.item }
      : null,
    playTask: state.playTask || null,
    stage: state.stage || null,
    stars: state.stars,
    words: state.words,
    counters: state.counters,
    mode: state.mode,
    sticky: state.sticky,
    startedAt: state.startedAt,
    lastActivity: state.lastActivity,
    moodStart: state.moodStart,
    wonder: state.wonder || null,
    moodEnd: state.moodEnd,
    ended: state.ended,
    lastOptions: state.lastOptions,
    expect: state.expect,
    recent: state.recent || [],
  };
}

function turn(state, opts) {
  const messages = opts.messages || [];
  return {
    mode: state.mode,
    mood: opts.mood || messages[messages.length - 1]?.mood || 'happy',
    messages,
    options: opts.options || null,
    expect: opts.expect || null,
    wordChips: opts.wordChips || null,
    lesson_action: opts.lessonAction || 'present',
    safety: opts.safety || 'ok',
    effects: {
      starGain: 0,
      totalStars: state.stars,
      confetti: !!opts.confetti,
      calm: !!opts.calm,
      badge: opts.badge || null,
      endCard: opts.endCard || null,
    },
    events: opts.events || [],
    dev: {
      phase: state.phase,
      mode: state.mode,
      level: state.level,
      itemId: state.current?.item?.id || state.playTask?.itemId || null,
      plan: state.plan ? { review: state.plan.review.length, teach: state.plan.teach.length } : null,
      counters: { ...state.counters },
      llm: !!opts.llm,
      llmProvider: opts.llmProvider || null,
    },
  };
}

function applyStars(state, result, n, child, store) {
  state.stars += n;
  result.effects.starGain = n;
  result.effects.totalStars = state.stars;
  // Kid records survive sessions: every star also lands on the child profile.
  if (child && store) {
    child.total_stars = (child.total_stars || 0) + n;
    store.addStars(child.key, n);
  }
  return result;
}

const partsOf = (t) => ({
  messages: t.messages, options: t.options, expect: t.expect,
  wordChips: t.wordChips, lessonAction: t.lesson_action, confetti: t.effects?.confetti,
  badge: t.effects?.badge, endCard: t.effects?.endCard, calm: t.effects?.calm,
});

// ── Session lifecycle ───────────────────────────────────────────────────────

// How a session opens. Asking "how do you feel?" every single time gets stale, so
// the opener rotates: a varied mood check (weather / animal / plain) or a tiny
// "wonder" guess-it question with a fun-fact reveal. A mood check is always used for
// a first visit, after a long gap, or when last time ended sad. (`deterministic`
// pins the plain mood opener — demo mode and the evidence tools rely on it.)
function chooseOpener(store, child, deterministic, force = '') {
  const plain = { kind: 'mood', style: MOOD_STYLES[0] };
  if (force === 'wonder') return { kind: 'wonder', wonder: pick(WONDERS) };
  const styled = MOOD_STYLES.find((m) => m.id === force);
  if (styled) return { kind: 'mood', style: styled };
  if (deterministic) return plain;
  const lastEnd = /end: (\w+)/.exec(child.last_summary || '')?.[1];
  const mustCheck = !child.last_seen || lastEnd === 'sad' || now() - child.last_seen > 3 * 86400e3;
  if (!mustCheck && Math.random() < 0.6) {
    const seen = store.recentEvents(child.key, 60).filter((e) => e.type === 'wonder_shown').map((e) => e.payload?.id);
    const fresh = WONDERS.filter((w) => w.id !== seen[0]);
    const liked = fresh.filter((w) => w.tags.some((t) => (child.interests || []).includes(t)));
    return { kind: 'wonder', wonder: pick(liked.length && Math.random() < 0.6 ? liked : fresh) };
  }
  return { kind: 'mood', style: pick(MOOD_STYLES) };
}

export function createSession(store, child, intent = 'learn', { deterministic = true, openerKind = '' } = {}) {
  const state = {
    phase: 'CHECKIN',
    intent,
    level: child.level,
    plan: null,
    current: null,
    playTask: null,
    stage: null,
    stars: 0,
    words: [],
    counters: {
      missStreak: 0, fastCorrect: 0, dontKnow: 0, noStreak: 0,
      idleCount: 0, idleNudged: false, conversationTurns: 0, curiousTurns: 0,
      safetyFlags: 0, homeBridge: 0, stretchUsed: 0, playRounds: 0,
      windDownOffered: false, wrongOnItem: 0, tellMode: false, breathRounds: 0,
      lastSig: '', lastSigAt: 0, turns: 0,
    },
    mode: intent === 'calm' ? 'support' : 'learning',
    sticky: 0,
    startedAt: now(),
    lastActivity: now(),
    moodStart: null,
    moodEnd: null,
    lastOptions: [],
    expect: null,
    recent: [],
    ended: false,
  };

  const id = `s-${now().toString(36)}-${rid()}`;
  store.createSession({ id, child_key: child.key, intent, state: snapshot(state), started: state.startedAt });
  store.addEvent(id, child.key, 'session_start', { intent, level: child.level });

  let first;
  let opener = null;
  if (intent === 'calm') {
    state.phase = 'SUPPORT';
    first = turn(state, {
      messages: [msg(pick(LINES.calmOffer).replaceAll('{name}', child.nickname), 'care')],
      options: calmActions(),
      expect: { type: 'action' },
      calm: true,
    });
  } else {
    const op = chooseOpener(store, child, deterministic, openerKind);
    const missed = !!(child.last_seen && now() - child.last_seen > 20 * 3600e3);
    const head = [
      pick(LINES.greetHeads),
      missed ? pick(LINES.missedYou) : '',
    ].filter(Boolean).join(' ').replaceAll('{name}', child.nickname);
    if (op.kind === 'wonder') {
      const w = op.wonder;
      state.wonder = { id: w.id };
      store.addEvent(id, child.key, 'wonder_shown', { id: w.id });
      const tail = `${pick(WONDER_INTROS)} ${w.q}`;
      opener = { kind: 'wonder', tail, missed };
      first = turn(state, {
        messages: [msg(`${head} ${tail}`, 'cheer')],
        options: [
          { id: 'wonder-a', label: w.a.label, emoji: w.a.emoji, kind: 'wonder' },
          { id: 'wonder-b', label: w.b.label, emoji: w.b.emoji, kind: 'wonder' },
        ],
        expect: { type: 'wonder' },
      });
    } else {
      const tail = pick(op.style.asks);
      opener = { kind: 'mood', tail, missed };
      first = turn(state, {
        messages: [msg(`${head} ${tail}`, 'cheer')],
        options: moodChips(op.style),
        expect: { type: 'mood' },
      });
    }
  }
  persist(store, id, state);
  return { id, turn: first, opener };
}

function moodChips(style = MOOD_STYLES[0]) {
  return style.chips.map((c) => ({ ...c, kind: 'mood' }));
}
const calmActions = () => [
  { id: 'action-breathe', label: 'Breathe', emoji: '🫧', kind: 'action' },
  { id: 'action-tell', label: 'Tell Milo', emoji: '💬', kind: 'action' },
  { id: 'action-bye', label: 'Bye', emoji: '👋', kind: 'action' },
];
// After each guided breath the child chooses the next move (one actionable
// tap per turn — the breathing ritual is interactive, never a monologue).
const breatheActions = () => [
  { id: 'action-breathe', label: 'One more', emoji: '🫧', kind: 'action' },
  { id: 'action-easy-game', label: 'Gentle play', emoji: '🧸', kind: 'action' },
  { id: 'action-bye', label: 'Bye', emoji: '👋', kind: 'action' },
];
const afterCalmActions = () => [
  { id: 'action-easy-game', label: 'Easy game', emoji: '🎮', kind: 'action' },
  { id: 'action-bye', label: 'Bye', emoji: '👋', kind: 'action' },
];

function persist(store, id, state) {
  store.saveSession(id, state.stars, snapshot(state));
}

export function loadState(store, sessionId) {
  let state = LIVE.get(sessionId);
  if (!state) {
    const row = store.session(sessionId);
    if (!row) return null;
    state = { ...row.state, plan: null };
    if (state.current?.itemId) state.current.item = state.current.item || itemById(state.current.itemId);
    LIVE.set(sessionId, state);
  }
  return state;
}

// ── Main entry ──────────────────────────────────────────────────────────────

export async function handleInput(store, child, sessionId, input, onChunk = null) {
  const state = loadState(store, sessionId);
  if (!state) return null;
  const events = [];
  const t = now();

  const sig = `${input.type}:${input.chipId || input.text || ''}`;
  // Double-tap guard: the same chip tapped twice in a row within 650 ms is
  // ignored — but ONLY after an accepted answer, so deliberate retries after
  // a recast still count (and the no-op turn keeps the question alive).
  if (
    input.type === 'chip' &&
    sig === state.counters.lastSig &&
    t - (state.counters.lastSigAt || 0) < 650 &&
    state.counters.lastAccepted
  ) {
    return turn(state, {
      messages: [],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'none',
    });
  }
  state.counters.lastSig = sig;
  state.counters.lastSigAt = t;
  const sigBefore = progressSigOf(state);

  if (state.ended) {
    return turn(state, { messages: [msg('Bye-bye! Milo is waving! 👋', 'cheer')], lessonAction: 'none' });
  }

  state.lastActivity = t;
  state.counters.turns += 1;
  let result;

  try {
    if (input.type === 'idle') {
      state.counters.idleCount += 1;
      result = await handleIdle(store, child, state, events, onChunk);
    } else {
      state.counters.idleCount = 0;
      state.counters.idleNudged = false;
      result = input.type === 'chip'
        ? await handleChip(store, child, state, input, events, onChunk)
        : await handleText(store, child, state, input.text || '', events, onChunk);
    }

    const elapsed = t - state.startedAt;
    if (!state.ended && !['WRAP', 'DONE', 'SUPPORT'].includes(state.phase)) {
      if (elapsed > HARD_MS) {
        result = wrapStart(state);
      } else if (elapsed > SOFT_MS && !state.counters.windDownOffered && result.lesson_action !== 'celebrate') {
        state.counters.windDownOffered = true;
        const wind = pick(LINES.windDown);
        const last = result.messages[result.messages.length - 1];
        result.messages = last
          ? [{ ...last, say: `${last.say} ${wind}` }]
          : [msg(wind, 'think')];
        result.options = [
          { id: 'action-two-more', label: 'Two more!', emoji: '⭐', kind: 'action' },
          { id: 'action-bye-now', label: 'Bye now', emoji: '👋', kind: 'action' },
        ];
        result.expect = { type: 'action' };
      }
    }
  } catch (err) {
    events.push({ type: 'error', payload: { message: String(err && err.message) } });
    result = turn(state, {
      messages: [msg('Oops, Milo tripped on his tail! 🙈 What\'s this?', 'think')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'retry',
    });
  }

  for (const e of events) store.addEvent(sessionId, child.key, e.type, e.payload);
  state.counters.lastAccepted = progressSigOf(state) !== sigBefore;
  result.events = events;
  persist(store, sessionId, state);
  return result;
}

// ── Idle: single nudge, then scaffold cascade (docs/05 edge #1) ─────────────

function currentItem(state) {
  return state.current?.item || (state.playTask?.itemId ? itemById(state.playTask.itemId) : null);
}

async function handleIdle(store, child, state, events, onChunk) {
  const c = state.counters;
  if (state.phase === 'WRAP' || state.phase === 'DONE') return turn(state, { messages: [], lessonAction: 'none' });

  if (c.idleCount === 1 && !c.idleNudged) {
    c.idleNudged = true;
    return turn(state, {
      messages: [msg(pick(LINES.idleNudge), 'think')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'none',
    });
  }
  if (c.idleCount === 2) return scaffoldStep(store, child, state, 'simpler', events, onChunk);
  if (c.idleCount === 3) return scaffoldStep(store, child, state, 'hint', events, onChunk);
  if (c.idleCount === 4) return scaffoldStep(store, child, state, 'show', events, onChunk);
  return scaffoldStep(store, child, state, 'move-on', events, onChunk);
}

async function scaffoldStep(store, child, state, step, events, onChunk) {
  const item = currentItem(state);
  const logged = { type: 'scaffold', payload: { step, item_id: item?.id || null } };
  const history = (state.recent || []).slice(-6);

  if (!item) {
    const nt = nextTask(store, child, state, events);
    return turn(state, { ...partsOf(nt), messages: [msg(merged(pick(LINES.scaffoldMoveOn), nt.messages), 'care')], lessonAction: 'scaffold', events: [logged] });
  }

  if (step === 'simpler') {
    const two = chipOptions(item, Math.random, 2);
    state.lastOptions = two;
    const fallbackLine = LINES.scaffoldSimpler[0].replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji);
    const llm = await composeFreeTurn(
      { task: { type: 'scaffold', step, word: item.text, emoji: item.emoji }, child, store, input: '', history, scriptedFallback: fallbackLine },
      onChunk,
    );
    remember(state, `(stuck on ${item.text})`, llm.say);
    logLlmFallback(events, llm, 'scaffold-simpler');
    return turn(state, {
      messages: [msg(llm.say, 'think')],
      options: two,
      expect: { type: 'chip', answers: [item.id] },
      lessonAction: 'scaffold',
      llm: llm.usedLLM, llmProvider: llm.provider || null,
      events: [logged],
    });
  }
  if (step === 'hint') {
    const letter = item.text[0].toUpperCase();
    const fallbackLine = LINES.scaffoldFirstLetter[0].replaceAll('{letter}', letter).replaceAll('{emoji}', item.emoji);
    const llm = await composeFreeTurn(
      { task: { type: 'scaffold', step, word: item.text, emoji: item.emoji, letter }, child, store, input: '', history, scriptedFallback: fallbackLine },
      onChunk,
    );
    remember(state, `(still stuck on ${item.text})`, llm.say);
    logLlmFallback(events, llm, 'scaffold-hint');
    return turn(state, {
      messages: [msg(llm.say, 'think')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'scaffold',
      llm: llm.usedLLM, llmProvider: llm.provider || null,
      events: [logged],
    });
  }
  if (step === 'show') {
    const fallbackLine = LINES.scaffoldShow[0].replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji);
    const llm = await composeFreeTurn(
      { task: { type: 'scaffold', step, word: item.text, emoji: item.emoji }, child, store, input: '', history, scriptedFallback: fallbackLine },
      onChunk,
    );
    remember(state, `(still stuck on ${item.text})`, llm.say);
    logLlmFallback(events, llm, 'scaffold-show');
    return turn(state, {
      messages: [msg(llm.say, 'cheer')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'scaffold',
      llm: llm.usedLLM, llmProvider: llm.provider || null,
      events: [logged],
    });
  }

  // move on warmly — no penalty, the item comes back another day. The next
  // task is computed first so the single bubble can end with its exact prompt.
  state.counters.idleCount = 0;
  let nt;
  if (state.phase === 'STAGE' && state.stage) {
    if (state.stage.results[state.stage.idx] === undefined) state.stage.results[state.stage.idx] = false;
    state.stage.idx += 1;
    nt = state.stage.idx >= 5
      ? stageCheckFinish(store, child, state, events)
      : presentStageTask(store, child, state, events);
  } else {
    nt = nextTask(store, child, state, events);
  }
  const tail = merged('', nt.messages);
  const fallbackLine = pick(LINES.scaffoldMoveOn);
  const llmM = await composeFreeTurn(
    {
      task: { type: 'scaffold', step, word: item.text, emoji: item.emoji, ...(tail ? { endWith: tail } : {}) },
      child, store, input: '', history,
      scriptedFallback: merged(fallbackLine, nt.messages),
    },
    onChunk,
  );
  remember(state, `(moved on from ${item.text})`, llmM.say);
  logLlmFallback(events, llmM, 'scaffold-move-on');
  return turn(state, { ...partsOf(nt), messages: [msg(llmM.say, 'care')], lessonAction: 'scaffold', events: [logged] });
}

// ── Chip handling ───────────────────────────────────────────────────────────

async function handleChip(store, child, state, input, events, onChunk) {
  const chipId = input.chipId || '';

  if (chipId.startsWith('mood-')) {
    if (state.phase === 'WRAP') return handleWrapMood(store, child, state, chipId, events);
    return handleMood(store, child, state, chipId, events, onChunk);
  }
  if (chipId.startsWith('wonder-')) return handleWonder(store, child, state, chipId, events, onChunk);
  if (chipId.startsWith('action-')) return handleAction(store, child, state, chipId, events, onChunk);

  if (chipId.startsWith('hint-') || chipId.startsWith('reply-')) {
    const c = (state.lastOptions || []).find((o) => o.id === chipId);
    if (c?.text) return handleText(store, child, state, c.text, events, onChunk);
  }

  const item = currentItem(state);
  const expected = state.expect;
  if (!item || !expected || !['chip', 'count', 'yes-no'].includes(expected.type)) {
    return turn(state, {
      messages: [msg('Ooh! Let\'s keep playing — what\'s this?', 'think')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'retry',
    });
  }

  if (expected.answers.includes(chipId)) {
    return onCorrect(store, child, state, item, { via: 'chip' }, events, onChunk);
  }

  // wrong chip → recast with the tapped item, never "wrong"
  const tapped = (state.lastOptions || []).find((o) => o.id === chipId);
  state.counters.wrongOnItem += 1;
  state.counters.missStreak += 1;
  if (state.current) state.current.attempts += 1;
  events.push({ type: 'answer', payload: { item_id: item.id, level: item.level, correct: false, first_try: false, via: 'chip' } });

  if (state.phase === 'STAGE' && state.stage) {
    const idx = state.stage.idx;
    if (state.stage.results[idx] === undefined) state.stage.results[idx] = false;
  }

  if (state.counters.missStreak >= 3 && state.phase !== 'STAGE') {
    return supportCheckin(store, child, state, item, events, onChunk);
  }

  const fallbackRecast = pick(LINES.recast)
    .replaceAll('{tapped}', tapped?.label || 'that one')
    .replaceAll('{tapEmoji}', tapped?.emoji || '')
    .replaceAll('{word}', item.text)
    .replaceAll('{emoji}', item.emoji);
  const llm = await composeFreeTurn(
    {
      task: { type: 'recast', word: item.text, emoji: item.emoji, tapped: tapped?.label || 'that one' },
      child, store, input: '', history: (state.recent || []).slice(-6), scriptedFallback: fallbackRecast,
    },
    onChunk,
  );
  remember(state, `(tapped "${tapped?.label || 'something'}" — not ${item.text})`, llm.say);
  logLlmFallback(events, llm, 'recast');
  return turn(state, {
    messages: [msg(llm.say, 'think')],
    options: state.lastOptions,
    expect: state.expect,
    lessonAction: 'retry',
    llm: llm.usedLLM, llmProvider: llm.provider || null,
    events,
  });
}

async function supportCheckin(store, child, state, item, events, onChunk) {
  state.mode = 'support';
  state.sticky = 2;
  state.counters.missStreak = 0;
  events.push({ type: 'mode_switch', payload: { to: 'support', reason: '3-miss streak' } });
  const fallbackLine = item
    ? pick(LINES.dontKnowCheckin).replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji)
    : pick(LINES.dontKnowCheckin).replaceAll('{word}', 'this one').replaceAll('{emoji}', '✨');
  const two = item ? chipOptions(item, Math.random, 2) : null;
  if (item) {
    state.lastOptions = two;
    state.expect = { type: 'chip', answers: [item.id] };
  }
  // the gentle check-in and the "watch me" demo share ONE bubble: the model's
  // line must end with the exact scripted demo line (one action → one bubble)
  const share = item
    ? pick(LINES.modelShareNoFx).replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji)
    : 'Watch me! Then you try. 💛';
  const llm = await composeFreeTurn(
    {
      task: { type: 'checkin', word: item?.text, emoji: item?.emoji, endWith: share },
      child, store, input: '', history: (state.recent || []).slice(-6),
      scriptedFallback: `${fallbackLine} ${share}`,
    },
    onChunk,
  );
  remember(state, '(missed a few in a row)', llm.say);
  logLlmFallback(events, llm, 'checkin');
  return turn(state, {
    messages: [msg(llm.say, 'care')],
    options: two || state.lastOptions,
    expect: state.expect,
    lessonAction: 'scaffold',
    llm: llm.usedLLM, llmProvider: llm.provider || null,
    events,
  });
}

// ── Text handling ───────────────────────────────────────────────────────────

async function handleText(store, child, state, text, events, onChunk) {
  // 0) wrap-up mood (session end)
  if (state.phase === 'WRAP') return handleWrapText(store, child, state, text, events);

  // 1) safety first
  const safety = classifySafety(text);
  if (safety.level !== 'ok') {
    state.counters.safetyFlags += 1;
    events.push({ type: 'flagged', payload: { category: safety.level } });
    if (safety.level === 'crisis') {
      state.phase = 'SUPPORT';
      state.mode = 'support';
      return turn(state, {
        messages: [msg(pick(SAFETY_REDIRECTS.crisis), 'calm')],
        options: calmActions(),
        expect: { type: 'action' },
        lessonAction: 'break',
        safety: 'flagged',
        calm: true,
        events,
      });
    }
    if (state.counters.safetyFlags >= 2) {
      return turn(state, {
        messages: [msg(pick(safety.responses), 'care')],
        options: [
          { id: 'action-easy-game', label: 'Easy game', emoji: '🎮', kind: 'action' },
          { id: 'action-breathe', label: 'Calm', emoji: '🫧', kind: 'action' },
        ],
        expect: { type: 'action' },
        lessonAction: 'retry',
        safety: 'flagged',
        events,
      });
    }
    return turn(state, {
      messages: [msg(pick(safety.responses), 'care')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'retry',
      safety: 'flagged',
      events,
    });
  }

  // 2) SUPPORT flow owns the turn
  if (state.phase === 'SUPPORT') return handleSupportText(store, child, state, text, events, onChunk);

  // 2b) L3 role-play / story beats: any turn advances — unless the child
  // signals upset, which always preempts (SUPPORT beats everything).
  if (
    state.phase === 'PLAY' &&
    (state.playTask?.kind === 'scene' || state.playTask?.storyId) &&
    (state.playTask.kind !== 'scene' || state.playTask.sceneIdx != null)
  ) {
    const quick = classifyInput(text, { noStreak: c0(state), dontKnowCount: state.counters.dontKnow, mode: state.mode });
    if (!['stop', 'upset', 'cant', 'repeated-no'].includes(quick.kind)) {
      return state.playTask.storyId
        ? storyAdvance(store, child, state, events, onChunk)
        : sceneAdvance(store, child, state, events, onChunk);
    }
  }

  const item = currentItem(state);
  const c = state.counters;

  // 3) answer attempt against the expected task
  if (item && state.expect) {
    const matched = matchExpect(text, state.expect, item);
    if (matched.ok) return onCorrect(store, child, state, item, { via: 'typing', match: matched.kind, childText: text }, events, onChunk);
  }

  // 3b) stage-check wrong attempt: record first-attempt miss, recast, retry
  if (state.phase === 'STAGE' && state.stage && item) {
    const idx = state.stage.idx;
    if (state.stage.results[idx] === undefined) state.stage.results[idx] = false;
    return turn(state, {
      messages: [msg(`Almost! It's ${item.text} ${item.emoji}. Try again — you've got this!`, 'think')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'retry',
      events,
    });
  }

  // 4) not an answer → mode rules
  const cls = classifyInput(text, {
    noStreak: c.noStreak,
    dontKnowCount: c.dontKnow,
    mode: state.mode,
    conversationTurns: c.conversationTurns,
  });
  const nm = nextMode(state.mode, cls.mode, state.sticky);
  const prevMode = state.mode;
  state.mode = nm.mode;
  state.sticky = nm.stickyTurns;
  if (prevMode !== state.mode) events.push({ type: 'mode_switch', payload: { from: prevMode, to: state.mode, reason: cls.kind } });

  switch (cls.kind) {
    // Feelings & stop signals: SUPPORT preempts teaching. These are "feelings
    // turns" — Groq phrases the comfort (streaming), and the scripted
    // calm-offer line is the safety net when the model fails or its output
    // gets rejected by the filter. Chips stay deterministic either way.
    case 'stop':
    case 'upset':
    case 'cant':
    case 'repeated-no': {
      c.noStreak += 1;
      state.phase = 'SUPPORT';
      const fallbackLine = cls.kind === 'cant'
        ? pick(LINES.growthYet)
        : pick(LINES.calmOffer).replaceAll('{name}', child.nickname);
      const llm = await composeFreeTurn(
        {
          task: cls.kind === 'cant' ? { type: 'growth' } : null,
          mode: 'support', child, store, input: text, history: (state.recent || []).slice(-6), scriptedFallback: fallbackLine,
        },
        onChunk,
      );
      remember(state, text, llm.say);
      logLlmFallback(events, llm, 'support-opener');
      return turn(state, {
        messages: [msg(llm.say, 'care')],
        options: calmActions(),
        expect: { type: 'action' },
        lessonAction: 'break',
        llm: llm.usedLLM, llmProvider: llm.provider || null,
        events,
      });
    }

    case 'no': {
      c.noStreak += 1;
      if (c.noStreak >= 2) {
        state.phase = 'SUPPORT';
        const fallbackLine = pick(LINES.calmOffer).replaceAll('{name}', child.nickname);
        const llm = await composeFreeTurn(
          {
            task: { type: 'calm' },
            child, store, input: text, history: (state.recent || []).slice(-6), scriptedFallback: fallbackLine,
          },
          onChunk,
        );
        remember(state, text, llm.say);
        logLlmFallback(events, llm, 'calm-offer');
        return turn(state, {
          messages: [msg(llm.say, 'care')],
          options: calmActions(),
          expect: { type: 'action' },
          lessonAction: 'break',
          llm: llm.usedLLM, llmProvider: llm.provider || null,
          events,
        });
      }
      const fallbackLine = 'That\'s okay! Do you want a little game, or a calm moment?';
      const llm = await composeFreeTurn(
        {
          task: { type: 'noOffer' },
          child, store, input: text, history: (state.recent || []).slice(-6), scriptedFallback: fallbackLine,
        },
        onChunk,
      );
      remember(state, text, llm.say);
      logLlmFallback(events, llm, 'no-offer');
      return turn(state, {
        messages: [msg(llm.say, 'care')],
        options: [
          { id: 'action-game', label: 'Game', emoji: '🎮', kind: 'action' },
          { id: 'action-breathe', label: 'Calm', emoji: '🫧', kind: 'action' },
        ],
        expect: { type: 'action' },
        lessonAction: 'retry',
        llm: llm.usedLLM, llmProvider: llm.provider || null,
        events,
      });
    }

    case 'dontknow': {
      c.dontKnow += 1;
      if (c.dontKnow >= 2) {
        c.dontKnow = 0;
        return supportCheckin(store, child, state, item, events, onChunk);
      }
      const fallbackLine = pick(LINES.growthYet);
      const two = item ? chipOptions(item, Math.random, 2) : state.lastOptions;
      if (item) {
        state.lastOptions = two;
        state.expect = { type: 'chip', answers: [item.id] };
      }
      // the reassurance and the "watch me" demo share ONE bubble
      const share = item
        ? pick(LINES.modelShareNoFx).replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji)
        : 'Watch me first! 💛';
      const llm = await composeFreeTurn(
        {
          task: { type: 'growth', word: item?.text, emoji: item?.emoji, endWith: share },
          child, store, input: text, history: (state.recent || []).slice(-6),
          scriptedFallback: `${fallbackLine} ${share}`,
        },
        onChunk,
      );
      remember(state, text, llm.say);
      logLlmFallback(events, llm, 'growth');
      return turn(state, {
        messages: [msg(llm.say, 'care')],
        options: two,
        expect: state.expect,
        lessonAction: 'scaffold',
        llm: llm.usedLLM, llmProvider: llm.provider || null,
        events,
      });
    }

    case 'refuse': {
      // "not in study mode" / "don't want to study" → play instead of pushing
      events.push({ type: 'mode_switch', payload: { to: 'engagement', reason: 'study refusal — play instead' } });
      state.mode = 'engagement';
      state.sticky = 2;
      return startPlay(store, child, state, events);
    }

    case 'play':
      events.push({ type: 'mode_switch', payload: { to: 'engagement', reason: 'child asked to play' } });
      state.mode = 'engagement';
      state.sticky = 2;
      return startPlay(store, child, state, events);

    case 'bored': {
      events.push({ type: 'mode_switch', payload: { to: 'engagement', reason: 'boredom signal' } });
      state.mode = 'engagement';
      state.sticky = 2;
      if (!state.plan) state.plan = buildPlan(store, child);
      const stretch = state.plan.stretch[c.stretchUsed];
      if (stretch && c.stretchUsed < 2) {
        c.stretchUsed += 1;
        const line = pick(LINES.boredStretch).replaceAll('{word}', stretch.text).replaceAll('{emoji}', stretch.emoji);
        const opts = chipOptions(stretch, Math.random, 3);
        state.current = { item: stretch, stage: 'stretch', attempts: 0, presentedAt: now() };
        state.lastOptions = opts;
        state.expect = { type: 'chip', answers: [stretch.id] };
        return turn(state, { messages: [msg(line, 'cheer')], options: opts, expect: state.expect, lessonAction: 'present', events });
      }
      return startPlay(store, child, state, events);
    }

    case 'bye':
      return endNow(store, child, state, events);

    case 'love':
      return turn(state, {
        messages: [msg(pick(LINES.loveYouBounded), 'cheer')],
        options: state.lastOptions.length ? state.lastOptions : null,
        expect: state.expect,
        lessonAction: 'retry',
        events,
      });

    case 'hello':
      return turn(state, {
        messages: [msg(pick(LINES.helloBack).replaceAll('{emoji}', item?.emoji || '✨'), 'cheer')],
        options: state.lastOptions.length ? state.lastOptions : null,
        expect: state.expect,
        lessonAction: 'retry',
        events,
      });

    case 'home': {
      if (c.homeBridge < 1 && item) {
        c.homeBridge += 1;
        events.push({ type: 'home_language_bridge', payload: {} });
        const line = pick(LINES.homeLanguageBridge).replaceAll('{emoji}', item.emoji);
        const opts = state.lastOptions.length ? state.lastOptions : chipOptions(item, Math.random, 3);
        return turn(state, { messages: [msg(line, 'happy')], options: opts, expect: state.expect, lessonAction: 'retry', events });
      }
      return conversationTurn(store, child, state, text, events, onChunk);
    }

    case 'emoji':
    case 'gibberish':
      return turn(state, {
        messages: [msg(pick(LINES.gibberishPlay), 'cheer')],
        options: [
          { id: 'action-game', label: 'Game', emoji: '🎮', kind: 'action' },
          { id: 'action-story', label: 'Story', emoji: '📖', kind: 'action' },
        ],
        expect: { type: 'action' },
        lessonAction: 'retry',
        events,
      });

    case 'question': {
      c.curiousTurns += 1;
      const aboutCurrent = item && normalize(text).includes(normalize(item.text));
      if (c.curiousTurns > 2) {
        c.curiousTurns = 0;
        return turn(state, {
          messages: [msg(pick(LINES.conversationBudgetEnd).replaceAll('{emoji}', item?.emoji || '✨'), 'cheer')],
          options: state.lastOptions.length ? state.lastOptions : null,
          expect: state.expect,
          lessonAction: 'retry',
          events,
        });
      }
      if (aboutCurrent) {
        return turn(state, {
          messages: [msg(`That's ${item.text}! ${item.emoji} ${item.fx || ''} Now it's your turn — tap ${item.text}!`, 'cheer')],
          options: state.lastOptions,
          expect: state.expect,
          lessonAction: 'retry',
          events,
        });
      }
      return conversationTurn(store, child, state, text, events, onChunk);
    }

    case 'chat':
    default:
      return conversationTurn(store, child, state, text, events, onChunk);
  }
}

// Tolerant expectation check (chip answers handled earlier; this is text).
function matchExpect(text, expect, item) {
  if (expect.type === 'yes-no') {
    if (containsAny(text, ['yes', 'yeah', 'yep', 'yup', 'ok', 'okay', 'sure']) && expect.truth === 'yes') return { ok: true, kind: 'yes' };
    if (containsAny(text, ['no', 'nope', 'nah']) && expect.truth === 'no') return { ok: true, kind: 'no' };
    return { ok: false };
  }
  if (expect.type === 'count') {
    if (containsAny(text, [String(expect.count), expect.countWord])) return { ok: true, kind: 'count' };
    return { ok: false };
  }
  if (expect.type === 'frame' && expect.phrase) {
    const filled = expect.phrase.replace('{x}', item.text);
    const r1 = matchAnswer(text, { answer: filled, accepts: [item.text], aliases: [] });
    if (r1.ok) return { ok: true, kind: r1.kind };
    return matchAnswer(text, item);
  }
  if (expect.type === 'free') return { ok: false };
  return matchAnswer(text, item);
}

// ── Correct-answer pipeline ────────────────────────────────────────────────

async function onCorrect(store, child, state, item, { via, match, childText }, events, onChunk) {
  const c = state.counters;
  const firstTry = (state.current?.attempts || 0) === 0 && c.wrongOnItem === 0 && !c.idleCount;
  applyAnswer(store, child, item, true, firstTry);
  child.first_try_total = (child.first_try_total || 0) + 1;
  if (firstTry) child.first_try_correct = (child.first_try_correct || 0) + 1;
  store.saveChild(child);

  events.push({ type: 'answer', payload: { item_id: item.id, level: item.level, correct: true, first_try: firstTry, via } });
  c.missStreak = 0;
  c.noStreak = 0;
  c.dontKnow = 0;

  const fast = state.current && now() - state.current.presentedAt < 3800;
  if (fast) c.fastCorrect += 1;

  const isTeach = ['teach', 'stretch', 'independent'].includes(state.current?.stage);
  if (isTeach && !state.words.includes(item.text)) state.words.push(item.text);

  // graduation preview: the child writes the L3 hook — then we say goodbye
  if (state.current?.stage === 'preview') {
    const words = state.words.slice(0, 5).join(' · ');
    const summary = pick(LINES.endSummary).replaceAll('{stars}', String(state.stars)).replaceAll('{words}', words || 'hello');
    const bye = pick(LINES.cliffhanger).replaceAll('{name}', child.nickname);
    state.ended = true;
    state.phase = 'DONE';
    events.push({ type: 'session_end', payload: { stars: state.stars, words: state.words } });
    return turn(state, {
      messages: [msg(`🎉 ${summary} ${bye}`, 'celebrate')],
      lessonAction: 'celebrate',
      endCard: { stars: state.stars, words: state.words.slice(0, 5) },
      events,
    });
  }

  // stage check bookkeeping
  if (state.phase === 'STAGE' && state.stage) {
    const idx = state.stage.idx;
    if (state.stage.results[idx] === undefined) state.stage.results[idx] = true;
    state.stage.idx += 1;
    if (state.stage.idx >= 5) return stageCheckFinish(store, child, state, events);
    const progress = pick(LINES.stageCheckProgress)
      .replaceAll('{n}', String(state.stage.results.filter(Boolean).length))
      .replaceAll('{left}', String(5 - state.stage.idx));
    const nt = presentStageTask(store, child, state, events);
    const r = turn(state, {
      messages: [msg(merged(progress, nt.messages), 'celebrate')],
      options: nt.options,
      expect: nt.expect,
      wordChips: nt.wordChips,
      lessonAction: 'advance',
      events,
    });
    return applyStars(state, r, 1, child, store);
  }

  // Figure out what pops up next FIRST, so the single praise bubble can end
  // with the exact scripted words of the next task (one action → one bubble).
  let opts; let expect; let wordChips = null; let lessonAction = 'advance'; let tail = '';
  if (fast && c.fastCorrect >= 5 && state.plan?.stretch?.length && c.stretchUsed < 2) {
    // 5 fast correct → stretch injection (max 2)
    c.fastCorrect = 0;
    const stretch = state.plan.stretch[c.stretchUsed];
    c.stretchUsed += 1;
    tail = pick(LINES.boredStretch).replaceAll('{word}', stretch.text).replaceAll('{emoji}', stretch.emoji);
    opts = chipOptions(stretch, Math.random, 3);
    state.current = { item: stretch, stage: 'stretch', attempts: 0, presentedAt: now() };
    state.lastOptions = opts;
    state.expect = { type: 'chip', answers: [stretch.id] };
    expect = state.expect;
  } else {
    const advanced = advanceAfterCorrect(store, child, state, events);
    opts = advanced.options;
    expect = advanced.expect;
    wordChips = advanced.wordChips || null;
    lessonAction = advanced.lessonAction || 'advance';
    tail = merged('', advanced.messages);
  }

  const pool = firstTry ? LINES.praiseFirstTry : LINES.praiseCorrect;
  const fallbackPraise = pickArr(pool)
    .replaceAll('{word}', item.text.toUpperCase())
    .replaceAll('{fx}', item.fx || '')
    .replace(/\s+/g, ' ')
    .trim();
  const praiseLlm = await composeFreeTurn(
    {
      task: { type: 'praise', word: item.text, emoji: item.emoji, firstTry, ...(tail ? { endWith: tail } : {}) },
      child, store,
      input: via === 'chip' ? 'I tapped it — I think it is right!' : (childText || item.text),
      history: (state.recent || []).slice(-6),
      scriptedFallback: tail ? `${fallbackPraise} ${tail}` : fallbackPraise,
    },
    onChunk,
  );
  remember(state, via === 'chip' ? `(tapped ${item.text} — correct!)` : (childText || item.text), praiseLlm.say);
  logLlmFallback(events, praiseLlm, 'praise');
  const r = turn(state, {
    messages: [msg(praiseLlm.say, 'celebrate')],
    options: opts,
    expect,
    wordChips,
    lessonAction,
    llm: praiseLlm.usedLLM, llmProvider: praiseLlm.provider || null,
    events,
  });
  return applyStars(state, r, 1, child, store);
}

function advanceAfterCorrect(store, child, state, events) {
  const st = state.current;
  if (!st) return partsOf(nextTask(store, child, state, events));

  if (st.stage === 'review') return partsOf(nextTask(store, child, state, events));

  if (st.stage === 'teach' || st.stage === 'stretch') {
    const tapFirst = child.reading_band === 'tap-first';
    if (!tapFirst && state.level >= 2 && st.stage === 'teach') {
      const line = pick(LINES.independent).replaceAll('{word}', itemById(st.item.id).text);
      state.current = { ...st, stage: 'independent', attempts: 0, presentedAt: now() };
      state.lastOptions = [];
      state.expect = { type: 'word', answers: [st.item.text] };
      return { messages: [msg(line, 'cheer')], options: null, expect: state.expect, lessonAction: 'present' };
    }
    // tap-first (or stretch): one more look with fresh distractors
    const opts = chipOptions(st.item, Math.random, 3);
    state.current = { ...st, stage: 'review-check', attempts: 0, presentedAt: now() };
    state.lastOptions = opts;
    state.expect = { type: 'chip', answers: [st.item.id] };
    return { messages: [msg(`${st.item.emoji} One more look! Which one is ${st.item.text}?`, 'happy')], options: opts, expect: state.expect, lessonAction: 'present' };
  }

  if (st.stage === 'independent' || st.stage === 'review-check') return partsOf(nextTask(store, child, state, events));

  if (st.stage === 'play') {
    state.counters.playRounds += 1;
    if (state.counters.playRounds >= 2) return partsOf(wrapStart(state));
    return partsOf(presentPlay(store, child, state, events));
  }

  return partsOf(nextTask(store, child, state, events));
}

// ── Task sequencing: review → teach → play → wrap ──────────────────────────

function nextTask(store, child, state, events) {
  if (!state.plan) state.plan = buildPlan(store, child);
  const plan = state.plan;

  if (plan.review.length) return presentReview(state, plan.review.shift());
  if (plan.teach.length) return presentTeach(state, plan.teach.shift());
  if (state.counters.playRounds < 2) return startPlay(store, child, state, events);
  return wrapStart(state);
}

function presentReview(state, item) {
  const line = pick(LINES.warmupIntro).replaceAll('{emoji}', item.emoji);
  const opts = chipOptions(item, Math.random, 3);
  state.current = { item, stage: 'review', attempts: 0, presentedAt: now() };
  state.lastOptions = opts;
  state.expect = { type: 'chip', answers: [item.id] };
  state.counters.wrongOnItem = 0;
  return turn(state, { messages: [msg(line, 'happy')], options: opts, expect: state.expect, lessonAction: 'present' });
}

function presentTeach(state, item) {
  const hasFx = !!item.fx;
  const line = pick(hasFx ? LINES.modelShare : LINES.modelShareNoFx)
    .replaceAll('{word}', item.text)
    .replaceAll('{emoji}', item.emoji)
    .replaceAll('{fx}', item.fx || '');
  const join = pick(LINES.joinIn).replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji);
  const opts = chipOptions(item, Math.random, 3);
  state.current = { item, stage: 'teach', attempts: 0, presentedAt: now() };
  state.lastOptions = opts;
  state.expect = { type: 'chip', answers: [item.id] };
  state.counters.wrongOnItem = 0;
  return turn(state, {
    messages: [msg(`${line} ${join}`, 'cheer')],
    options: opts,
    expect: state.expect,
    lessonAction: 'present',
  });
}

function startPlay(store, child, state, events) {
  state.phase = 'PLAY';
  state.mode = 'engagement';
  if (!state.plan) state.plan = buildPlan(store, child);
  const plan = state.plan;
  let pool = [...plan.review, ...plan.teach];
  if (!pool.length) pool = [...itemsOfTheme(state.level, 'colors'), ...itemsOfTheme(state.level, 'animals')];
  if (!pool.length) pool = [...itemsOfTheme(1, 'colors')];
  const item = pickArr(pool);
  const kinds = plan.playKinds || ['simon'];
  const kind = kinds[state.counters.playRounds % kinds.length];
  state.playTask = { kind, itemId: item.id, presentedAt: now() };
  return presentPlay(store, child, state, events);
}

function presentPlay(store, child, state, events) {
  const kind = state.playTask.kind;
  const item = itemById(state.playTask.itemId);
  state.mode = 'engagement';

  if (kind === 'count') {
    const n = 3 + Math.floor(Math.random() * 3); // 3–5
    const shown = item.emoji.repeat(n);
    const words = { 3: 'three', 4: 'four', 5: 'five' };
    const numItem = itemById(`l1-numbers-${words[n]}`) || item;
    const opts = [3, 4, 5].map((k) => ({ id: `count-${k}`, label: words[k], emoji: `${k}️⃣`, kind: 'answer' }));
    state.current = { item: numItem, stage: 'play', attempts: 0, presentedAt: now() };
    state.lastOptions = opts;
    state.expect = { type: 'count', count: n, countWord: words[n], answers: [`count-${n}`] };
    return turn(state, {
      messages: [msg(`Game time! How many? ${shown}`, 'cheer')],
      options: opts,
      expect: state.expect,
      lessonAction: 'present',
    });
  }

  if (kind === 'yesno') {
    const truth = Math.random() < 0.5;
    const other = itemsOfTheme(state.level, item.theme).find((i) => i.id !== item.id) || item;
    const asked = truth ? item : other;
    const opts = [
      { id: 'yn-yes', label: 'Yes!', emoji: '✅', kind: 'answer' },
      { id: 'yn-no', label: 'No', emoji: '❌', kind: 'answer' },
    ];
    state.current = { item, stage: 'play', attempts: 0, presentedAt: now() };
    state.lastOptions = opts;
    state.expect = { type: 'yes-no', truth: truth ? 'yes' : 'no', answers: [truth ? 'yn-yes' : 'yn-no'] };
    return turn(state, {
      messages: [msg(`Game time! Is this a ${asked.text}? ${item.emoji}`, 'cheer')],
      options: opts,
      expect: state.expect,
      lessonAction: 'present',
    });
  }

  if (kind === 'frame') {
    const built = frameTaskParts(state, item);
    return turn(state, { messages: [msg(`${pick(LINES.wordChipsIntro)} ${built.frame.emoji}`, 'cheer')], options: null, wordChips: built.chips, expect: built.expect, lessonAction: 'present' });
  }

  if (kind === 'scene') {
    state.playTask = { ...state.playTask, sceneIdx: Math.floor(Math.random() * SCENES.length), beatIdx: 0 };
    return presentSceneBeat(state);
  }

  if (kind === 'story') {
    const story = pickArr(STORIES);
    state.playTask = { ...state.playTask, storyId: story.id };
    const opts = story.retell.slice(0, 3).map((r, i) => ({ id: `reply-${i}`, label: r, kind: 'reply', text: r }));
    state.current = null;
    state.lastOptions = opts;
    state.expect = { type: 'free' };
    return turn(state, {
      messages: [
        msg(`Story time! ${story.emoji} ${story.pages.slice(0, 2).map((p) => p.text).join(' ')} What happened in the story? Tap it!`, 'happy'),
      ],
      options: opts,
      expect: state.expect,
      lessonAction: 'present',
    });
  }

  // simon says
  const opts = chipOptions(item, Math.random, 3);
  const line = pick(LINES.playIntro).replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji);
  state.current = { item, stage: 'play', attempts: 0, presentedAt: now() };
  state.lastOptions = opts;
  state.expect = { type: 'chip', answers: [item.id] };
  return turn(state, { messages: [msg(line, 'cheer')], options: opts, expect: state.expect, lessonAction: 'present' });
}

function frameTaskParts(state, item) {
  let frames = FRAMES[state.level] || FRAMES[2];
  let chosen = pickArr(frames.filter((f) => (f.pool || []).includes(item.theme)) || []);
  if (!chosen) {
    chosen = pickArr(frames);
    const poolItems = [];
    for (const th of chosen.pool || []) poolItems.push(...itemsOfTheme(Math.min(3, Math.max(1, state.level)), th));
    item = poolItems.length ? pickArr(poolItems) : item;
  }
  const phrase = chosen.phrase.replace('{x}', item.text);
  const words = phrase.replace(/[?!.]/g, '').split(' ');
  const chips = shuffle(words.map((wd, i) => ({ id: `wc-${i}`, label: wd, kind: 'word' })));
  state.current = { item, stage: state.phase === 'STAGE' ? 'stage' : 'play', attempts: 0, presentedAt: now() };
  state.expect = { type: 'frame', phrase: chosen.phrase, answers: [phrase] };
  return { frame: chosen, item, chips, expect: state.expect };
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ── Check-in outcome → session start ────────────────────────────────────────

async function handleMood(store, child, state, chipId, events, onChunk) {
  const mood = chipId.replace('mood-', '');
  state.moodStart = mood;
  events.push({ type: 'mood', payload: { mood, phase: 'start' } });

  const pool = mood === 'sad' ? LINES.moodMirrorSad : mood === 'sleepy' ? LINES.moodMirrorTired : LINES.moodMirrorHappy;
  const fallbackLine = pick(pool).replaceAll('{name}', child.nickname);
  const llm = await composeFreeTurn(
    {
      task: { type: 'mood', mood, moodLabel: mood === 'sad' ? 'a little sad' : mood, name: child.nickname },
      child, store, input: `I feel ${mood === 'sad' ? 'a little sad' : mood}`,
      history: (state.recent || []).slice(-6), scriptedFallback: fallbackLine,
    },
    onChunk,
  );
  remember(state, `I feel ${mood}`, llm.say);
  logLlmFallback(events, llm, 'mood');

  if (mood === 'sad') {
    state.mode = 'support';
    state.sticky = 2;
    return turn(state, {
      messages: [msg(llm.say, 'care')],
      options: [
        { id: 'action-talk', label: 'Talk', emoji: '💬', kind: 'action' },
        { id: 'action-breathe', label: 'Breathe', emoji: '🫧', kind: 'action' },
        { id: 'action-easy-game', label: 'Gentle play', emoji: '🧸', kind: 'action' },
      ],
      expect: { type: 'action' },
      lessonAction: 'break',
      llm: llm.usedLLM, llmProvider: llm.provider || null,
      events,
    });
  }

  state.mode = 'learning';
  const start = startPlan(store, child, state, events);
  return turn(state, {
    messages: [msg(merged(llm.say, start.messages), mood === 'sleepy' ? 'calm' : 'cheer')],
    options: start.options,
    expect: start.expect,
    wordChips: start.wordChips || null,
    lessonAction: start.lessonAction || 'present',
    llm: llm.usedLLM, llmProvider: llm.provider || null,
    events,
  });
}

// The child picked one of the two pictures of a "wonder" opener. There is no wrong
// pick: both get the same warm reveal with the true fact, then the lesson begins.
async function handleWonder(store, child, state, chipId, events, onChunk) {
  const w = WONDERS.find((x) => x.id === state.wonder?.id);
  if (!w || state.phase !== 'CHECKIN') {
    return turn(state, {
      messages: [msg('Ooh! Let\'s keep playing!', 'think')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'retry',
    });
  }
  const picked = chipId === 'wonder-a' ? w.a : w.b;
  const right = (chipId === 'wonder-a' ? 'a' : 'b') === w.answer;
  events.push({ type: 'wonder', payload: { id: w.id, picked: picked.label, right } });
  state.wonder = null;

  const fallbackLine = `${pick(right ? WONDER_RIGHT : WONDER_TRY)} ${w.fact}`;
  const llm = await composeFreeTurn(
    {
      task: { type: 'wonder', question: w.q, picked: picked.label, right, fact: w.fact },
      child, store, input: `I picked ${picked.label}`,
      history: [], scriptedFallback: fallbackLine,
    },
    onChunk,
  );
  remember(state, `I picked ${picked.label}`, llm.say);
  logLlmFallback(events, llm, 'wonder');

  state.mode = 'learning';
  const start = startPlan(store, child, state, events);
  return turn(state, {
    messages: [msg(merged(llm.say, start.messages), 'cheer')],
    options: start.options,
    expect: start.expect,
    wordChips: start.wordChips || null,
    lessonAction: start.lessonAction || 'present',
    llm: llm.usedLLM, llmProvider: llm.provider || null,
    events,
  });
}

function startPlan(store, child, state, events) {
  if (!state.plan) state.plan = buildPlan(store, child);
  state.phase = 'LEARNING';

  if (gateReady(store, child)) {
    events.push({ type: 'stage_check_start', payload: {} });
    return partsOf(startStageCheck(store, child, state, events));
  }

  if (state.intent === 'talk') {
    state.phase = 'CONVERSATION';
    state.counters.conversationTurns = 0;
    state.mode = 'conversation';
    return {
      messages: [msg(`Let's chat! ${pick(CONVERSATION_PROMPTS)} 💬`, 'happy')],
      expect: { type: 'free' },
      lessonAction: 'present',
    };
  }

  if (state.intent === 'play') {
    const t = startPlay(store, child, state, events);
    const p = partsOf(t);
    return p;
  }
  return partsOf(nextTask(store, child, state, events));
}

export const CONVERSATION_PROMPTS = [
  'What do you like to play with?',
  'Tell me about your favorite toy!',
  'What did you do today?',
];

// Model memory: keep the last few exchanges so Milo never repeats himself.
function remember(state, childText, miloSay) {
  const r = state.recent || (state.recent = []);
  r.push({ role: 'child', text: String(childText).slice(0, 160) });
  r.push({ role: 'milo', text: String(miloSay).slice(0, 200) });
  while (r.length > 8) r.shift();
}

// ── Conversation mode (≤3 turns then bridge) ───────────────────────────────

async function conversationTurn(store, child, state, text, events, onChunk) {
  state.counters.conversationTurns += 1;
  state.mode = 'conversation';
  state.sticky = 1;

  const llm = await composeFreeTurn(
    { mode: 'conversation', child, store, input: text, history: (state.recent || []).slice(-6), scriptedFallback: pick(CHAT_SCRIPTED) },
    onChunk,
  );
  remember(state, text, llm.say);
  logLlmFallback(events, llm, 'conversation');

  const c = state.counters;
  const item = currentItem(state);
  if (c.conversationTurns >= 3) {
    c.conversationTurns = 0;
    state.mode = 'learning';
    if (item) {
      const bridge = pick(LINES.bridgeBack).replaceAll('{emoji}', item.emoji);
      return turn(state, {
        messages: [msg(`${llm.say} ${bridge}`, 'cheer')],
        options: state.lastOptions.length ? state.lastOptions : null,
        expect: state.expect,
        lessonAction: 'retry',
        llm: llm.usedLLM, llmProvider: llm.provider || null,
        events,
      });
    }
    // no current task (talk intent opening) — bridge into a frame task
    const built = frameTaskParts(state, pickArr(itemsOfTheme(Math.min(3, Math.max(1, state.level)), 'colors')));
    return turn(state, {
      messages: [msg(`${llm.say} ${pick(LINES.wordChipsIntro)}`, 'cheer')],
      options: null,
      wordChips: built.chips,
      expect: built.expect,
      lessonAction: 'present',
      llm: llm.usedLLM, llmProvider: llm.provider || null,
      events,
    });
  }

  // one bubble: a reply that already asks stays as-is; otherwise the tiny
  // scripted opener question is folded into the same bubble (never a second one)
  const asks = /[?？]/.test(llm.say.slice(-40));
  return turn(state, {
    messages: [msg(asks || llm.usedLLM ? llm.say : `${llm.say} ${pick(LINES.conversationOpeners)}`, 'cheer')],
    expect: { type: 'free' },
    lessonAction: 'present',
    llm: llm.usedLLM, llmProvider: llm.provider || null,
    events,
  });
}

// ── Support flow ────────────────────────────────────────────────────────────

async function handleSupportText(store, child, state, text, events, onChunk) {
  const feeling = extractFeeling(text);
  const fallbackLine = feeling
    ? pick(LINES.validateFeeling).replaceAll('{feeling}', feeling)
    : 'Thank you for telling me. That sounds like a lot. 💛';
  // one bubble: thank them for opening up, then point to what is next (buttons)
  const llm = await composeFreeTurn(
    {
      task: { type: 'thanks' },
      child,
      store,
      input: text,
      history: (state.recent || []).slice(-6),
      scriptedFallback: `${fallbackLine} ${pick(LINES.bravePraise)} ${pick(LINES.afterCalmOffer)}`,
    },
    onChunk,
  );
  remember(state, text, llm.say);
  state.counters.tellMode = false;
  logLlmFallback(events, llm, 'support-talk');
  return turn(state, {
    messages: [msg(llm.say, 'care')],
    options: afterCalmActions(),
    expect: { type: 'action' },
    lessonAction: 'break',
    llm: llm.usedLLM, llmProvider: llm.provider || null,
    events,
  });
}

function extractFeeling(text) {
  const t = normalize(text);
  const map = { sad: 'sad', tired: 'tired', scared: 'scared', angry: 'angry', mad: 'angry', worried: 'worried', lonely: 'lonely', cry: 'sad', crying: 'sad' };
  for (const k of Object.keys(map)) if (t.includes(k)) return map[k];
  return null;
}

// ── Actions (buttons) ──────────────────────────────────────────────────────

async function handleAction(store, child, state, chipId, events, onChunk) {
  switch (chipId) {
    case 'action-breathe': {
      // interactive calm corner: each tap guides ONE AI-phrased breath, then
      // hands the turn back with chips (one action → one interactive bubble)
      state.phase = 'SUPPORT';
      state.mode = 'support';
      state.counters.breathRounds = (state.counters.breathRounds || 0) + 1;
      const round = state.counters.breathRounds;
      events.push({ type: 'calm_corner', payload: { trigger: 'action', round } });
      const fallbackLine = pick(round === 1 ? LINES.breatheIn : LINES.breatheAgain);
      const llm = await composeFreeTurn(
        {
          task: { type: 'breathe', round },
          child, store, input: '', history: (state.recent || []).slice(-6),
          scriptedFallback: fallbackLine,
        },
        onChunk,
      );
      remember(state, '(breathed with Milo)', llm.say);
      logLlmFallback(events, llm, 'breathe');
      return turn(state, {
        messages: [msg(llm.say, 'calm')],
        options: breatheActions(),
        expect: { type: 'action' },
        lessonAction: 'break',
        calm: true,
        llm: llm.usedLLM, llmProvider: llm.provider || null,
        events,
      });
    }

    case 'action-tell':
    case 'action-talk': {
      state.counters.tellMode = true;
      state.phase = 'SUPPORT';
      state.mode = 'support';
      const fallbackLine = "Milo's ears are all yours. 💛 Tell me anything.";
      const llm = await composeFreeTurn(
        {
          task: { type: 'invite' },
          child, store, input: '', history: (state.recent || []).slice(-6),
          scriptedFallback: fallbackLine,
        },
        onChunk,
      );
      remember(state, '(chose to share)', llm.say);
      logLlmFallback(events, llm, 'invite');
      return turn(state, {
        messages: [msg(llm.say, 'care')],
        expect: { type: 'free' },
        lessonAction: 'break',
        llm: llm.usedLLM, llmProvider: llm.provider || null,
        events,
      });
    }

    case 'action-easy-game':
    case 'action-game': {
      state.phase = 'PLAY';
      state.mode = 'engagement';
      state.sticky = 2;
      if (!state.plan) state.plan = buildPlan(store, child);
      const pm = store.progressAll(child.key).filter((p) => p.box >= 4);
      const pool = pm.map((p) => itemById(p.item_id)).filter(Boolean);
      const fallback = itemsOfTheme(state.level, 'colors');
      const item = pickArr(pool.length ? pool : fallback);
      state.playTask = { kind: 'simon', itemId: item.id, easy: true, presentedAt: now() };
      const opts = chipOptions(item, Math.random, 3);
      state.current = { item, stage: 'play', attempts: 0, presentedAt: now() };
      state.lastOptions = opts;
      state.expect = { type: 'chip', answers: [item.id] };
      return turn(state, {
        messages: [msg(pick(LINES.easyGameIntro).replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji), 'cheer')],
        options: opts,
        expect: state.expect,
        lessonAction: 'present',
        events,
      });
    }

    case 'action-story': {
      const story = pickArr(STORIES);
      const page = story.pages[0];
      const target = itemsOfTheme(state.level, 'animals')[0] || itemsOfTheme(1, 'animals')[0];
      let opts = null;
      if (target) {
        opts = chipOptions(target, Math.random, 3);
        state.current = { item: target, stage: 'play', attempts: 0, presentedAt: now() };
        state.lastOptions = opts;
        state.expect = { type: 'chip', answers: [target.id] };
      }
      return turn(state, {
        messages: [
          msg(`Story time! ${story.emoji} ${page.text} I see a ${target ? target.text : 'star'} in the story! Which one? ${target?.emoji || '⭐'}`, 'happy'),
        ],
        options: opts,
        expect: state.expect,
        lessonAction: 'present',
        events,
      });
    }

    case 'action-two-more':
      state.counters.windDownOffered = true;
      return nextTask(store, child, state, events);

    case 'action-bye-now':
    case 'action-bye':
      return endNow(store, child, state, events);

    default:
      return turn(state, { messages: [], lessonAction: 'none' });
  }
}

// ── Stage check ─────────────────────────────────────────────────────────────

function startStageCheck(store, child, state, events) {
  state.phase = 'STAGE';
  state.stage = { tasks: buildStageCheck(child, store), idx: 0, results: [] };
  state.mode = 'learning';
  const r = presentStageTask(store, child, state, events);
  r.messages = [msg(merged(pick(LINES.stageCheckIntro), r.messages), 'celebrate')];
  return r;
}

function presentStageTask(store, child, state, events) {
  const task = state.stage.tasks[state.stage.idx];
  let item = task.item;

  if (task.kind === 'say-the-word' && child.reading_band === 'tap-first') task.kind = 'tap-the-word';

  if (task.kind === 'tap-the-word') {
    const opts = chipOptions(item, Math.random, 3);
    state.current = { item, stage: 'stage', attempts: 0, presentedAt: now() };
    state.lastOptions = opts;
    state.expect = { type: 'chip', answers: [item.id] };
    return turn(state, { messages: [msg(`Show me: ${item.text}! ${item.emoji}`, 'cheer')], options: opts, expect: state.expect, lessonAction: 'present' });
  }
  if (task.kind === 'say-the-word') {
    state.current = { item, stage: 'stage', attempts: 0, presentedAt: now() };
    state.lastOptions = [];
    state.expect = { type: 'word', answers: [item.text] };
    return turn(state, { messages: [msg(`Your turn to say it! What is this? ${item.emoji}`, 'cheer')], options: null, expect: state.expect, lessonAction: 'present' });
  }
  if (task.kind === 'yes-no') {
    const truth = Math.random() < 0.5;
    const asked = truth ? item : (task.fake || item);
    const opts = [
      { id: 'yn-yes', label: 'Yes!', emoji: '✅', kind: 'answer' },
      { id: 'yn-no', label: 'No', emoji: '❌', kind: 'answer' },
    ];
    state.current = { item, stage: 'stage', attempts: 0, presentedAt: now() };
    state.lastOptions = opts;
    state.expect = { type: 'yes-no', truth: truth ? 'yes' : 'no', answers: [truth ? 'yn-yes' : 'yn-no'] };
    return turn(state, { messages: [msg(`Is this a ${asked.text}? ${item.emoji}`, 'cheer')], options: opts, expect: state.expect, lessonAction: 'present' });
  }
  if (task.kind === 'count') {
    const n = 3 + Math.floor(Math.random() * 3);
    const words = { 3: 'three', 4: 'four', 5: 'five' };
    const numItem = itemById(`l1-numbers-${words[n]}`) || item;
    const opts = [3, 4, 5].map((k) => ({ id: `count-${k}`, label: words[k], emoji: `${k}️⃣`, kind: 'answer' }));
    state.current = { item: numItem, stage: 'stage', attempts: 0, presentedAt: now() };
    state.lastOptions = opts;
    state.expect = { type: 'count', count: n, countWord: words[n], answers: [`count-${n}`] };
    return turn(state, { messages: [msg(`Show me: how many? ${item.emoji.repeat(n)}`, 'cheer')], options: opts, expect: state.expect, lessonAction: 'present' });
  }

  // frame
  const built = frameTaskParts(state, item);
  return turn(state, { messages: [msg('Build it with words! 🧱', 'cheer')], options: null, wordChips: built.chips, expect: built.expect, lessonAction: 'present' });
}

function stageCheckFinish(store, child, state, events) {
  const results = state.stage.results;
  const correct = results.filter(Boolean).length;
  const passed = stageCheckVerdict(correct);
  state.stage = null;

  if (!passed) {
    events.push({ type: 'stage_check', payload: { passed: false, correct } });
    state.phase = 'LEARNING';
    const weak = weakestItems(store, child, 5);
    const first = weak[0] || currentItem(state);
    state.plan = { review: weak, teach: [], stretch: [], playKinds: ['simon'] };
    const next = first ? presentReview(state, first) : { messages: [], options: null, expect: null };
    return turn(state, {
      messages: [msg(merged(pick(LINES.stageCheckFail), next.messages), 'care')],
      options: next.options,
      expect: next.expect,
      lessonAction: 'scaffold',
      events,
    });
  }

  events.push({ type: 'stage_check', payload: { passed: true, correct } });
  const badge = child.level === 1 ? 'WORD WIZARD' : child.level === 2 ? 'SENTENCE STAR' : 'CHAT CHAMPION';
  store.addBadge(child.key, `badge-l${child.level}`);
  events.push({ type: 'badge', payload: { badge } });

  const struggled = store.progressAll(child.key).filter((p) => p.wrong > 0).sort((a, b) => b.wrong - a.wrong)[0];
  const memoryItem = (struggled && itemById(struggled.item_id)) || weakestItems(store, child, 1)[0] || currentItem(state);

  const from = child.level;
  child.level = Math.min(3, child.level + 1);
  child.last_summary = `Graduated L${from} → L${child.level}. ${badge} earned.`;
  store.saveChild(child);
  events.push({ type: 'graduation', payload: { from, to: child.level, badge } });

  state.phase = 'WRAP';
  state.mode = 'learning';
  const preview = pick(child.level === 3 ? LINES.previewNextL3 : LINES.previewNext);
  const frameLine = pick(LINES.previewFrame);
  const chips = shuffle([
    { id: 'wc-0', label: "I'm", kind: 'word' },
    { id: 'wc-1', label: 'fine', kind: 'word' },
    { id: 'wc-2', label: 'thank', kind: 'word' },
    { id: 'wc-3', label: 'you', kind: 'word' },
  ]);
  state.current = { item: { id: 'l3-hook-imfine', text: 'I am fine thank you', emoji: '👋', level: 3, fx: '' }, stage: 'preview', attempts: 0, presentedAt: now() };
  state.expect = { type: 'frame', phrase: 'I am fine thank you', answers: ['Im fine thank you', 'I am fine thank you'] };
  const r = turn(state, {
    messages: [
      msg(
        `${pick(LINES.stageCheckPass).replaceAll('{name}', child.nickname)} ${pick(LINES.graduation)} ${pick(LINES.graduationMemory).replaceAll('{word}', memoryItem?.text || 'elephant').replaceAll('{emoji}', memoryItem?.emoji || '🐘')} ${preview} ${frameLine}`,
        'celebrate',
      ),
    ],
    options: null,
    wordChips: chips,
    expect: state.expect,
    lessonAction: 'celebrate',
    confetti: true,
    badge,
    events,
  });
  return applyStars(state, r, 5, child, store);
}

// ── Wrap-up / end ───────────────────────────────────────────────────────────

function wrapStart(state) {
  state.phase = 'WRAP';
  state.mode = 'learning';
  return turn(state, {
    messages: [msg(pick(LINES.moodEnd), 'happy')],
    options: moodChips(),
    expect: { type: 'mood' },
    lessonAction: 'advance',
  });
}

function endNow(store, child, state, events) {
  state.ended = true;
  state.phase = 'DONE';
  events.push({ type: 'session_end', payload: { stars: state.stars, words: state.words } });
  const words = state.words.slice(0, 4).join(' · ') || 'hello';
  const summary = pick(LINES.endSummary).replaceAll('{stars}', String(state.stars)).replaceAll('{words}', words);
  const bye = pick(LINES.cliffhanger).replaceAll('{name}', child.nickname);
  child.last_summary = [`Last session: ${state.words.slice(0, 5).join(', ') || 'warm-up only'}.`, `Mood start: ${state.moodStart || '—'} · end: ${state.moodEnd || '—'}. Stars: ${state.stars}.`].join(' ');
  child.last_seen = now();
  store.saveChild(child);
  return turn(state, {
    messages: [msg(`${summary} ${bye}`, 'celebrate')],
    lessonAction: 'celebrate',
    endCard: { stars: state.stars, words: state.words.slice(0, 5) },
    events,
  });
}

function handleWrapMood(store, child, state, chipId, events) {
  state.moodEnd = chipId.replace('mood-', '');
  events.push({ type: 'mood', payload: { mood: state.moodEnd, phase: 'end' } });
  return endNow(store, child, state, events);
}

function handleWrapText(store, child, state, text, events) {
  const t = normalize(text);
  if (/\bbye\b|goodbye|bye bye/.test(t)) return endNow(store, child, state, events);
  let mood = null;
  if (/(happy|good|fine|great|well|yay)/.test(t)) mood = 'happy';
  else if (/(sleepy|tired)/.test(t)) mood = 'sleepy';
  else if (/(sad|bad|not)/.test(t)) mood = 'sad';
  if (mood) {
    state.moodEnd = mood;
    events.push({ type: 'mood', payload: { mood, phase: 'end' } });
    return endNow(store, child, state, events);
  }
  return turn(state, {
    messages: [msg(pick(LINES.moodEnd), 'happy')],
    options: moodChips(),
    expect: { type: 'mood' },
    lessonAction: 'retry',
    events,
  });
}

// ── L3 light: role-play beats & story retell (data: 5 scenes / 5 stories) ──

const c0 = (state) => state.counters.noStreak;

function presentSceneBeat(state) {
  const task = state.playTask;
  const scene = SCENES[task.sceneIdx];
  const beat = scene.beats[task.beatIdx];
  const opts = (beat.expect?.hints || []).map((h, i) => ({ id: `hint-${i}`, label: h, kind: 'reply', text: h }));
  state.current = null;
  state.lastOptions = opts;
  state.expect = { type: 'free' };
  return turn(state, {
    messages: [msg(`${scene.emoji} ${beat.say}`, 'happy')],
    options: opts.length ? opts : null,
    expect: state.expect,
    lessonAction: 'present',
  });
}

async function sceneAdvance(store, child, state, events, onChunk) {
  const task = state.playTask;
  const scene = SCENES[task.sceneIdx];
  task.beatIdx += 1;
  let tail = ''; let opts = null; let expect = null; let wordChips; let lessonAction = 'advance';
  if (task.beatIdx >= scene.beats.length) {
    state.counters.playRounds += 1;
    if (state.counters.playRounds >= 2) {
      const w = wrapStart(state);
      tail = merged('', w.messages);
      opts = w.options; expect = w.expect;
    } else {
      const nt = nextTask(store, child, state, events);
      tail = merged('', nt.messages);
      opts = nt.options; expect = nt.expect; wordChips = nt.wordChips;
    }
  } else {
    const nb = presentSceneBeat(state);
    tail = merged('', nb.messages);
    opts = nb.options; expect = nb.expect;
  }
  const fallbackPraise = pick(['Nice talking! 🗣️', 'Great words! 🌟', 'You said it so well! ⭐', 'So chatty! 💬', 'I love talking with you! 💛']);
  const llm = await composeFreeTurn(
    {
      task: { type: 'praise', what: 'shared their own words in a role-play', ...(tail ? { endWith: tail } : {}) },
      child, store, input: '', history: (state.recent || []).slice(-6),
      scriptedFallback: tail ? `${fallbackPraise} ${tail}` : fallbackPraise,
    },
    onChunk,
  );
  remember(state, '(role-play turn)', llm.say);
  logLlmFallback(events, llm, 'scene-praise');
  return turn(state, { messages: [msg(llm.say, 'celebrate')], options: opts, expect, wordChips, lessonAction, events });
}

async function storyAdvance(store, child, state, events, onChunk) {
  state.counters.playRounds += 1;
  state.playTask = { ...state.playTask, storyId: null };
  let tail = ''; let opts = null; let expect = null; let wordChips;
  if (state.counters.playRounds >= 2) {
    const w = wrapStart(state);
    tail = merged('', w.messages);
    opts = w.options; expect = w.expect;
  } else {
    const nt = nextTask(store, child, state, events);
    tail = merged('', nt.messages);
    opts = nt.options; expect = nt.expect; wordChips = nt.wordChips;
  }
  const fallbackPraise = pick(['You remembered the story! 📖⭐', 'What a storyteller! 🌟', 'Yes! That happened! 📖', 'Story star! ⭐']);
  const llm = await composeFreeTurn(
    {
      task: { type: 'praise', what: 'just retold the story in their own words', ...(tail ? { endWith: tail } : {}) },
      child, store, input: '', history: (state.recent || []).slice(-6),
      scriptedFallback: tail ? `${fallbackPraise} ${tail}` : fallbackPraise,
    },
    onChunk,
  );
  remember(state, '(retold the story)', llm.say);
  logLlmFallback(events, llm, 'story-praise');
  return turn(state, { messages: [msg(llm.say, 'celebrate')], options: opts, expect, wordChips, lessonAction: 'advance', events });
}
