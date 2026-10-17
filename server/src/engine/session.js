// Dialog manager (docs/02 §5): HOME → GREET → CHECK-IN → REVIEW → TEACH
// (model → join-in → independent) → PLAY → CELEBRATE → WRAP-UP, with
// CONVERSATION (≤3 turns) and SUPPORT_CALM interrupts. SUPPORT preempts
// everything; chip answers never wait on an LLM; "wrong" is never said.
import { matchAnswer, containsAny, normalize } from './matching.js';
import { classifySafety, SAFETY_REDIRECTS } from './safety.js';
import { classifyInput, nextMode } from './modes.js';
import { LINES, CHAT_SCRIPTED, pick } from './sel.js';
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
    moodEnd: state.moodEnd,
    ended: state.ended,
    lastOptions: state.lastOptions,
    expect: state.expect,
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
    },
  };
}

function applyStars(state, result, n) {
  state.stars += n;
  result.effects.starGain = n;
  result.effects.totalStars = state.stars;
  return result;
}

const partsOf = (t) => ({
  messages: t.messages, options: t.options, expect: t.expect,
  wordChips: t.wordChips, lessonAction: t.lesson_action, confetti: t.effects?.confetti,
  badge: t.effects?.badge, endCard: t.effects?.endCard, calm: t.effects?.calm,
});

// ── Session lifecycle ───────────────────────────────────────────────────────

export function createSession(store, child, intent = 'learn') {
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
      windDownOffered: false, wrongOnItem: 0, tellMode: false,
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
    ended: false,
  };

  const id = `s-${now().toString(36)}-${rid()}`;
  store.createSession({ id, child_key: child.key, intent, state: snapshot(state), started: state.startedAt });
  store.addEvent(id, child.key, 'session_start', { intent, level: child.level });

  let first;
  if (intent === 'calm') {
    state.phase = 'SUPPORT';
    first = turn(state, {
      messages: [msg(pick(LINES.calmOffer).replaceAll('{name}', child.nickname), 'care'), msg(pick(LINES.breatheIn), 'calm')],
      options: calmActions(),
      expect: { type: 'action' },
      calm: true,
    });
  } else {
    first = turn(state, {
      messages: [msg(pick(LINES.greetWithCheckin).replaceAll('{name}', child.nickname), 'cheer')],
      options: moodChips(),
      expect: { type: 'mood' },
    });
  }
  persist(store, id, state);
  return { id, turn: first };
}

function moodChips() {
  return [
    { id: 'mood-happy', label: 'happy', emoji: '😊', kind: 'mood' },
    { id: 'mood-sleepy', label: 'sleepy', emoji: '😴', kind: 'mood' },
    { id: 'mood-sad', label: 'a little sad', emoji: '😢', kind: 'mood' },
  ];
}
const calmActions = () => [
  { id: 'action-breathe', label: 'Breathe', emoji: '🫧', kind: 'action' },
  { id: 'action-tell', label: 'Tell Milo', emoji: '💬', kind: 'action' },
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
  if (t - (state.counters.lastSigAt || 0) < 650 && sig === state.counters.lastSig) {
    return turn(state, { messages: [], lessonAction: 'none' });
  }
  state.counters.lastSig = sig;
  state.counters.lastSigAt = t;

  if (state.ended) {
    return turn(state, { messages: [msg('Bye-bye! Milo is waving! 👋', 'cheer')], lessonAction: 'none' });
  }

  state.lastActivity = t;
  state.counters.turns += 1;
  let result;

  try {
    if (input.type === 'idle') {
      state.counters.idleCount += 1;
      result = handleIdle(store, child, state, events);
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
        result.messages = [...result.messages, msg(pick(LINES.windDown), 'think')];
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
  result.events = events;
  persist(store, sessionId, state);
  return result;
}

// ── Idle: single nudge, then scaffold cascade (docs/05 edge #1) ─────────────

function currentItem(state) {
  return state.current?.item || (state.playTask?.itemId ? itemById(state.playTask.itemId) : null);
}

function handleIdle(store, child, state, events) {
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
  if (c.idleCount === 2) return scaffoldStep(store, child, state, 'simpler', events);
  if (c.idleCount === 3) return scaffoldStep(store, child, state, 'hint', events);
  if (c.idleCount === 4) return scaffoldStep(store, child, state, 'show', events);
  return scaffoldStep(store, child, state, 'move-on', events);
}

function scaffoldStep(store, child, state, step, events) {
  const item = currentItem(state);
  const logged = { type: 'scaffold', payload: { step, item_id: item?.id || null } };

  if (!item) {
    const nt = nextTask(store, child, state, events);
    return turn(state, { ...partsOf(nt), messages: [msg(pick(LINES.scaffoldMoveOn), 'care'), ...nt.messages], lessonAction: 'scaffold', events: [logged] });
  }

  if (step === 'simpler') {
    const two = chipOptions(item, Math.random, 2);
    state.lastOptions = two;
    return turn(state, {
      messages: [msg(LINES.scaffoldSimpler[0].replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji), 'think')],
      options: two,
      expect: { type: 'chip', answers: [item.id] },
      lessonAction: 'scaffold',
      events: [logged],
    });
  }
  if (step === 'hint') {
    const letter = item.text[0].toUpperCase();
    return turn(state, {
      messages: [msg(LINES.scaffoldFirstLetter[0].replaceAll('{letter}', letter).replaceAll('{emoji}', item.emoji), 'think')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'scaffold',
      events: [logged],
    });
  }
  if (step === 'show') {
    return turn(state, {
      messages: [msg(LINES.scaffoldShow[0].replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji), 'cheer')],
      options: state.lastOptions.length ? state.lastOptions : null,
      expect: state.expect,
      lessonAction: 'scaffold',
      events: [logged],
    });
  }

  // move on warmly — no penalty, the item comes back another day
  state.counters.idleCount = 0;
  if (state.phase === 'STAGE' && state.stage) {
    if (state.stage.results[state.stage.idx] === undefined) state.stage.results[state.stage.idx] = false;
    state.stage.idx += 1;
    const nt = state.stage.idx >= 5
      ? stageCheckFinish(store, child, state, events)
      : presentStageTask(store, child, state, events);
    return turn(state, { ...partsOf(nt), messages: [msg(pick(LINES.scaffoldMoveOn), 'care'), ...nt.messages], lessonAction: 'scaffold', events: [logged] });
  }
  const nt = nextTask(store, child, state, events);
  return turn(state, { ...partsOf(nt), messages: [msg(pick(LINES.scaffoldMoveOn), 'care'), ...nt.messages], lessonAction: 'scaffold', events: [logged] });
}

// ── Chip handling ───────────────────────────────────────────────────────────

async function handleChip(store, child, state, input, events, onChunk) {
  const chipId = input.chipId || '';

  if (chipId.startsWith('mood-')) {
    if (state.phase === 'WRAP') return handleWrapMood(store, child, state, chipId, events);
    return handleMood(store, child, state, chipId, events);
  }
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
    return onCorrect(store, child, state, item, { via: 'chip' }, events);
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
    return supportCheckin(state, item, events);
  }

  const line = pick(LINES.recast)
    .replaceAll('{tapped}', tapped?.label || 'that one')
    .replaceAll('{tapEmoji}', tapped?.emoji || '')
    .replaceAll('{word}', item.text)
    .replaceAll('{emoji}', item.emoji);
  return turn(state, {
    messages: [msg(line, 'think')],
    options: state.lastOptions,
    expect: state.expect,
    lessonAction: 'retry',
    events,
  });
}

function supportCheckin(state, item, events) {
  state.mode = 'support';
  state.sticky = 2;
  state.counters.missStreak = 0;
  events.push({ type: 'mode_switch', payload: { to: 'support', reason: '3-miss streak' } });
  const line = item
    ? pick(LINES.dontKnowCheckin).replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji)
    : pick(LINES.dontKnowCheckin).replaceAll('{word}', 'this one').replaceAll('{emoji}', '✨');
  const two = item ? chipOptions(item, Math.random, 2) : null;
  if (item) {
    state.lastOptions = two;
    state.expect = { type: 'chip', answers: [item.id] };
  }
  return turn(state, {
    messages: [
      msg(line, 'care'),
      msg(item ? pick(LINES.modelShareNoFx).replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji) : 'Watch me! Then you try. 💛', 'cheer'),
    ],
    options: two || state.lastOptions,
    expect: state.expect,
    lessonAction: 'scaffold',
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
        ? storyAdvance(store, child, state, events)
        : sceneAdvance(store, child, state, events);
    }
  }

  const item = currentItem(state);
  const c = state.counters;

  // 3) answer attempt against the expected task
  if (item && state.expect) {
    const matched = matchExpect(text, state.expect, item);
    if (matched.ok) return onCorrect(store, child, state, item, { via: 'typing', match: matched.kind }, events);
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
    case 'stop':
    case 'upset':
    case 'cant':
    case 'repeated-no': {
      c.noStreak += 1;
      state.phase = 'SUPPORT';
      const line = cls.kind === 'cant' ? pick(LINES.growthYet) : pick(LINES.calmOffer).replaceAll('{name}', child.nickname);
      return turn(state, {
        messages: [msg(line, 'care')],
        options: calmActions(),
        expect: { type: 'action' },
        lessonAction: 'break',
        events,
      });
    }

    case 'no': {
      c.noStreak += 1;
      if (c.noStreak >= 2) {
        state.phase = 'SUPPORT';
        return turn(state, {
          messages: [msg(pick(LINES.calmOffer).replaceAll('{name}', child.nickname), 'care')],
          options: calmActions(),
          expect: { type: 'action' },
          lessonAction: 'break',
          events,
        });
      }
      return turn(state, {
        messages: [msg('That\'s okay! Do you want a little game, or a calm moment?', 'care')],
        options: [
          { id: 'action-game', label: 'Game', emoji: '🎮', kind: 'action' },
          { id: 'action-breathe', label: 'Calm', emoji: '🫧', kind: 'action' },
        ],
        expect: { type: 'action' },
        lessonAction: 'retry',
        events,
      });
    }

    case 'dontknow': {
      c.dontKnow += 1;
      if (c.dontKnow >= 2) {
        c.dontKnow = 0;
        return supportCheckin(state, item, events);
      }
      const line = pick(LINES.growthYet);
      const two = item ? chipOptions(item, Math.random, 2) : state.lastOptions;
      if (item) {
        state.lastOptions = two;
        state.expect = { type: 'chip', answers: [item.id] };
      }
      return turn(state, {
        messages: [
          msg(line, 'care'),
          msg(item ? pick(LINES.modelShareNoFx).replaceAll('{word}', item.text).replaceAll('{emoji}', item.emoji) : 'Watch me first! 💛', 'cheer'),
        ],
        options: two,
        expect: state.expect,
        lessonAction: 'scaffold',
        events,
      });
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

async function onCorrect(store, child, state, item, { via, match }, events) {
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
      messages: [msg('🎉', 'celebrate'), msg(summary, 'celebrate'), msg(bye, 'cheer')],
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
      .replaceAll('{n}', String(state.stage.correct + 1))
      .replaceAll('{left}', String(5 - state.stage.idx));
    const nt = presentStageTask(store, child, state, events);
    const r = turn(state, {
      messages: [msg(progress, 'celebrate'), ...nt.messages],
      options: nt.options,
      expect: nt.expect,
      wordChips: nt.wordChips,
      lessonAction: 'advance',
      events,
    });
    return applyStars(state, r, 1);
  }

  const pool = firstTry ? LINES.praiseFirstTry : LINES.praiseCorrect;
  const praise = pickArr(pool)
    .replaceAll('{word}', item.text.toUpperCase())
    .replaceAll('{fx}', item.fx || '')
    .replace(/\s+/g, ' ')
    .trim();

  // 5 fast correct → stretch injection (max 2)
  if (fast && c.fastCorrect >= 5 && state.plan?.stretch?.length && c.stretchUsed < 2) {
    c.fastCorrect = 0;
    const stretch = state.plan.stretch[c.stretchUsed];
    c.stretchUsed += 1;
    const line = pick(LINES.boredStretch).replaceAll('{word}', stretch.text).replaceAll('{emoji}', stretch.emoji);
    const opts = chipOptions(stretch, Math.random, 3);
    state.current = { item: stretch, stage: 'stretch', attempts: 0, presentedAt: now() };
    state.lastOptions = opts;
    state.expect = { type: 'chip', answers: [stretch.id] };
    const r = turn(state, { messages: [msg(praise, 'celebrate'), msg(line, 'cheer')], options: opts, expect: state.expect, lessonAction: 'advance', events });
    return applyStars(state, r, 1);
  }

  const advanced = advanceAfterCorrect(store, child, state, events);
  const r = turn(state, {
    messages: [msg(praise, 'celebrate'), ...advanced.messages],
    options: advanced.options,
    expect: advanced.expect,
    wordChips: advanced.wordChips || null,
    lessonAction: advanced.lessonAction || 'advance',
    events,
  });
  return applyStars(state, r, 1);
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
    messages: [msg(line, 'happy'), msg(join, 'cheer')],
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
        msg(`Story time! ${story.emoji} ${story.pages.slice(0, 2).map((p) => p.text).join(' ')}`, 'happy'),
        msg('What happened in the story? Tap it!', 'cheer'),
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

function handleMood(store, child, state, chipId, events) {
  const mood = chipId.replace('mood-', '');
  state.moodStart = mood;
  events.push({ type: 'mood', payload: { mood, phase: 'start' } });

  if (mood === 'sad') {
    const line = pick(LINES.moodMirrorSad).replaceAll('{name}', child.nickname);
    state.mode = 'support';
    state.sticky = 2;
    return turn(state, {
      messages: [msg(line, 'care')],
      options: [
        { id: 'action-talk', label: 'Talk', emoji: '💬', kind: 'action' },
        { id: 'action-breathe', label: 'Breathe', emoji: '🫧', kind: 'action' },
        { id: 'action-easy-game', label: 'Gentle play', emoji: '🧸', kind: 'action' },
      ],
      expect: { type: 'action' },
      lessonAction: 'break',
      events,
    });
  }

  const pool = mood === 'sleepy' ? LINES.moodMirrorTired : LINES.moodMirrorHappy;
  const line = pick(pool).replaceAll('{name}', child.nickname);
  state.mode = 'learning';
  const start = startPlan(store, child, state, events);
  return turn(state, {
    messages: [msg(line, mood === 'sleepy' ? 'calm' : 'cheer'), ...start.messages],
    options: start.options,
    expect: start.expect,
    wordChips: start.wordChips || null,
    lessonAction: start.lessonAction || 'present',
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

// ── Conversation mode (≤3 turns then bridge) ───────────────────────────────

async function conversationTurn(store, child, state, text, events, onChunk) {
  state.counters.conversationTurns += 1;
  state.mode = 'conversation';
  state.sticky = 1;

  const llm = await composeFreeTurn(
    { mode: 'conversation', child, store, input: text, scriptedFallback: pick(CHAT_SCRIPTED) },
    onChunk,
  );

  const c = state.counters;
  const item = currentItem(state);
  if (c.conversationTurns >= 3) {
    c.conversationTurns = 0;
    state.mode = 'learning';
    if (item) {
      const bridge = pick(LINES.bridgeBack).replaceAll('{emoji}', item.emoji);
      return turn(state, {
        messages: [msg(llm.say, 'cheer'), msg(bridge, 'happy')],
        options: state.lastOptions.length ? state.lastOptions : null,
        expect: state.expect,
        lessonAction: 'retry',
        llm: llm.usedLLM,
        events,
      });
    }
    // no current task (talk intent opening) — bridge into a frame task
    const built = frameTaskParts(state, pickArr(itemsOfTheme(Math.min(3, Math.max(1, state.level)), 'colors')));
    return turn(state, {
      messages: [msg(llm.say, 'cheer'), msg(pick(LINES.wordChipsIntro), 'happy')],
      options: null,
      wordChips: built.chips,
      expect: built.expect,
      lessonAction: 'present',
      llm: llm.usedLLM,
      events,
    });
  }

  return turn(state, {
    messages: [msg(llm.say, 'cheer'), msg(pick(LINES.conversationOpeners), 'happy')],
    expect: { type: 'free' },
    lessonAction: 'present',
    llm: llm.usedLLM,
    events,
  });
}

// ── Support flow ────────────────────────────────────────────────────────────

async function handleSupportText(store, child, state, text, events, onChunk) {
  const feeling = extractFeeling(text);
  const llm = await composeFreeTurn(
    {
      mode: 'support',
      child,
      store,
      input: text,
      scriptedFallback: feeling
        ? pick(LINES.validateFeeling).replaceAll('{feeling}', feeling)
        : 'Thank you for telling me. That sounds like a lot. 💛',
    },
    onChunk,
  );
  state.counters.tellMode = false;
  return turn(state, {
    messages: [msg(llm.say, 'care'), msg(pick(LINES.bravePraise), 'cheer'), msg(pick(LINES.afterCalmOffer), 'care')],
    options: afterCalmActions(),
    expect: { type: 'action' },
    lessonAction: 'break',
    llm: llm.usedLLM,
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
    case 'action-breathe':
      state.phase = 'SUPPORT';
      state.mode = 'support';
      events.push({ type: 'calm_corner', payload: { trigger: 'action' } });
      return turn(state, {
        messages: [msg(pick(LINES.breatheIn), 'calm'), msg(pick(LINES.breatheAgain), 'calm'), msg(pick(LINES.bravePraise), 'cheer'), msg(pick(LINES.afterCalmOffer), 'care')],
        options: afterCalmActions(),
        expect: { type: 'action' },
        lessonAction: 'break',
        calm: true,
        events,
      });

    case 'action-tell':
    case 'action-talk':
      state.counters.tellMode = true;
      state.phase = 'SUPPORT';
      state.mode = 'support';
      return turn(state, {
        messages: [msg("Milo's ears are all yours. 💛 Tell me anything.", 'care')],
        expect: { type: 'free' },
        lessonAction: 'break',
        events,
      });

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
          msg(`Story time! ${story.emoji} ${page.text}`, 'happy'),
          msg(`I see a ${target ? target.text : 'star'} in the story! Which one? ${target?.emoji || '⭐'}`, 'cheer'),
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
  r.messages = [msg(pick(LINES.stageCheckIntro), 'celebrate'), ...r.messages];
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
      messages: [msg(pick(LINES.stageCheckFail), 'care'), ...next.messages],
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
      msg(pick(LINES.stageCheckPass).replaceAll('{name}', child.nickname), 'celebrate'),
      msg(pick(LINES.graduation), 'celebrate'),
      msg(pick(LINES.graduationMemory).replaceAll('{word}', memoryItem?.text || 'elephant').replaceAll('{emoji}', memoryItem?.emoji || '🐘'), 'cheer'),
      msg(`${preview} ${frameLine}`, 'happy'),
    ],
    options: null,
    wordChips: chips,
    expect: state.expect,
    lessonAction: 'celebrate',
    confetti: true,
    badge,
    events,
  });
  return applyStars(state, r, 5);
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
    messages: [msg(summary, 'celebrate'), msg(bye, 'cheer')],
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

function sceneAdvance(store, child, state, events) {
  const task = state.playTask;
  const scene = SCENES[task.sceneIdx];
  const praise = pick(['Nice talking! 🗣️', 'Great words! 🌟', 'You said it so well! ⭐', 'So chatty! 💬', 'I love talking with you! 💛']);
  task.beatIdx += 1;
  if (task.beatIdx >= scene.beats.length) {
    state.counters.playRounds += 1;
    if (state.counters.playRounds >= 2) {
      const w = wrapStart(state);
      return turn(state, { messages: [msg(praise, 'celebrate'), ...w.messages], options: w.options, expect: w.expect, lessonAction: 'advance', events });
    }
    const nt = nextTask(store, child, state, events);
    return turn(state, { messages: [msg(praise, 'celebrate'), ...nt.messages], options: nt.options, expect: nt.expect, wordChips: nt.wordChips, lessonAction: 'advance', events });
  }
  const nb = presentSceneBeat(state);
  return turn(state, { messages: [msg(praise, 'celebrate'), ...nb.messages], options: nb.options, expect: nb.expect, lessonAction: 'advance', events });
}

function storyAdvance(store, child, state, events) {
  state.counters.playRounds += 1;
  const praise = pick(['You remembered the story! 📖⭐', 'What a storyteller! 🌟', 'Yes! That happened! 📖', 'Story star! ⭐']);
  state.playTask = { ...state.playTask, storyId: null };
  if (state.counters.playRounds >= 2) {
    const w = wrapStart(state);
    return turn(state, { messages: [msg(praise, 'celebrate'), ...w.messages], options: w.options, expect: w.expect, lessonAction: 'advance', events });
  }
  const nt = nextTask(store, child, state, events);
  return turn(state, { messages: [msg(praise, 'celebrate'), ...nt.messages], options: nt.options, expect: nt.expect, wordChips: nt.wordChips, lessonAction: 'advance', events });
}
