// Curriculum engine (docs/03 §2): Leitner boxes, mastery gate, session
// composer, stage checks, wind-downs. Never generates language.
import { itemsOf, itemById, itemsOfTheme, distractorsFor, STORIES, SCENES } from './bank.js';

export const BOX_INTERVAL_MS = {
  1: 0,                 // re-appear in the same session
  2: 24 * 3600e3,       // next day
  3: 3 * 24 * 3600e3,   // in 3 days
  4: 7 * 24 * 3600e3,   // in 7 days
  5: 14 * 24 * 3600e3,  // in 14 days
};

// Leitner transition (docs/03 §2.1, exact table).
export function applyAnswer(store, child, item, correct, firstTry, now = Date.now()) {
  const prev = store.progressGet(child.key, item.id) || {
    child_key: child.key, item_id: item.id, box: 0, correct: 0, wrong: 0,
    first_try: 0, first_try_total: 0, last_seen: 0, next_due: 0,
  };
  const row = { ...prev };
  row.first_try_total += 1;
  if (firstTry) row.first_try += 1;

  // "Next due" follows the SOURCE box for correct climbers (docs/03 §2.1
  // "Next due" column: box1→same session, box2→next day, box3→3 days,
  // box4→7 days, box5→14 days); a miss drops the item and re-schedules it
  // quickly using the NEW (lower) box.
  const srcBox = row.box === 0 ? 1 : row.box;

  if (correct) {
    row.correct += 1;
    switch (row.box) {
      case 0:
      case 1: row.box = 2; break;
      case 2: row.box = 3; break;
      case 3: row.box = 4; break;
      case 4: row.box = 5; break;
      default: row.box = 5; break; // box 5 stays 5 (refreshers)
    }
  } else {
    row.wrong += 1;
    switch (row.box) {
      case 0:
      case 1: row.box = 1; break;
      case 2: row.box = 1; break;
      case 3: row.box = 1; break;
      case 4: row.box = 2; break;
      default: row.box = 3; break; // box 5 → 3
    }
  }
  row.last_seen = now;
  row.next_due = now + BOX_INTERVAL_MS[correct ? srcBox : (row.box === 0 ? 1 : row.box)];
  store.saveProgress(child.key, row);
  return row;
}

export function progressMap(store, child) {
  return new Map(store.progressAll(child.key).map((p) => [p.item_id, p]));
}

// ── Mastery gate (docs/03 §2.2) ─────────────────────────────────────────────
export function distinctSessionDays(store, childKey) {
  const rows = store.raw
    .prepare('SELECT started FROM sessions WHERE child_key = ?')
    .all(childKey);
  return new Set(rows.map((r) => Math.floor(r.started / 86400e3))).size;
}

export function levelStats(store, child) {
  const items = itemsOf(child.level);
  const pm = progressMap(store, child);
  const covered = items.filter((i) => (pm.get(i.id)?.box ?? 0) >= 3).length;

  const answers = store
    .recentEvents(child.key, 200)
    .filter((e) => e.type === 'answer' && e.payload && e.payload.level === child.level);
  const recent = answers.slice(0, 20);
  const firstTryRate = recent.length
    ? recent.filter((e) => e.payload.first_try).length / recent.length
    : 0;

  return {
    coverage: items.length ? covered / items.length : 0,
    covered,
    total: items.length,
    recentCount: recent.length,
    firstTryRate,
    days: distinctSessionDays(store, child.key),
    stagePassed: !!child.stagePassed,
  };
}

export function gateReady(store, child) {
  const s = levelStats(store, child);
  return (
    s.coverage >= 0.8 &&
    s.recentCount >= 5 &&
    s.firstTryRate >= 0.8 &&
    s.days >= 2 &&
    !s.stagePassed
  );
}

// Weakest items of the current level (for stage-check remediation).
export function weakestItems(store, child, n = 10) {
  const pm = progressMap(store, child);
  return itemsOf(child.level)
    .map((i) => ({ item: i, p: pm.get(i.id) }))
    .sort((a, b) => {
      const wa = a.p ? a.p.wrong - a.p.correct * 0.5 : 100;
      const wb = b.p ? b.p.wrong - b.p.correct * 0.5 : 100;
      return wb - wa;
    })
    .slice(0, n)
    .map((x) => x.item);
}

// ── Session composer (docs/03 §2.3) ─────────────────────────────────────────
// Rituals 15% · Review 40% · Current target 30% · Play 15%; live-adjusted by
// the dialog manager via counters passed in ctx.
export function buildPlan(store, child, now = Date.now()) {
  const pm = progressMap(store, child);
  const items = itemsOf(child.level);

  const isNew = (i) => !pm.has(i.id) || (pm.get(i.id).box ?? 0) === 0;
  const due = (i) => {
    const p = pm.get(i.id);
    return p && p.box >= 1 && p.next_due <= now;
  };
  const struggling = (i) => {
    const p = pm.get(i.id);
    return p && p.wrong > 0 && p.box <= 2;
  };

  const dueItems = items.filter(due).sort((a, b) => {
    const pa = pm.get(a.id);
    const pb = pm.get(b.id);
    if (pa.box !== pb.box) return pa.box - pb.box;
    return pa.next_due - pb.next_due;
  });

  const strugglingItems = items.filter(struggling).filter((i) => !dueItems.includes(i));
  const newItems = items.filter(isNew);

  // review: due + struggling + 1–2 easy wins (box 4–5) for confidence
  const easyWins = items.filter((i) => {
    const p = pm.get(i.id);
    return p && p.box >= 4;
  });
  const shuffle = (arr) => arr.map((v) => ({ v, k: store.raw ? Math.random() : 0 })).sort((a, b) => a.k - b.k).map((x) => x.v);

  const review = [
    ...strugglingItems.slice(0, 2),
    ...dueItems.slice(0, 6),
  ];
  if (review.length < 4) review.push(...shuffle(easyWins).slice(0, 4 - review.length));

  // teach: 3–4 fresh items for a 6-minute session
  const teach = newItems.slice(0, 4);

  // stretch: next-level items (max 2) injected after 5 fast correct
  const stretch = child.level < 3 ? itemsOf(child.level + 1).slice(0, 2) : [];

  return {
    review: review.slice(0, 7),
    teach,
    stretch,
    playKinds: playKindsFor(child.level),
    story: child.level >= 3 ? pickRotating(STORIES, store) : null,
    scene: child.level >= 3 ? pickRotating(SCENES, store) : null,
  };
}

function pickRotating(arr, store) {
  // deterministic-ish rotation by session count keeps the demo stable
  const n = arr.length;
  const c = store.raw.prepare('SELECT COUNT(*) AS c FROM sessions').get().c || 0;
  return arr[c % n];
}

// Simple seeded RNG for tests.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playKindsFor(level) {
  if (level === 1) return ['simon', 'count', 'yesno'];
  if (level === 2) return ['simon', 'yesno', 'frame'];
  return ['story', 'scene', 'frame'];
}

// Chip options for a teaching item: correct + same-theme distractors.
export function chipOptions(item, rng = Math.random, count = 3) {
  const d = distractorsFor(item, count - 1, rng);
  const opts = [item, ...d];
  // shuffle
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts.map((i) => ({ id: i.id, label: i.text, emoji: i.emoji, kind: 'answer' }));
}

// ── Stage check (docs/03 §2.2: 5 mixed tasks, ≥4 correct) ───────────────────
export function buildStageCheck(child, store, rng = Math.random) {
  const items = itemsOf(child.level);
  const pickN = (n) => {
    const copy = [...items];
    const out = [];
    while (out.length < n && copy.length) {
      out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    }
    return out;
  };
  const words = pickN(3);
  const extra = pickN(2);
  const tasks = [
    { kind: 'tap-the-word', item: words[0] },
    { kind: 'say-the-word', item: words[1] },
    { kind: 'yes-no', item: words[2], fake: items[(items.indexOf(words[2]) + 3) % items.length] },
    { kind: 'count', item: extra[0] },
    { kind: 'frame', item: extra[1] },
  ];
  // count task needs a number item partner
  const numbers = itemsOfTheme(child.level, 'numbers');
  if (numbers.length) {
    tasks[3] = {
      kind: 'count',
      item: numbers[Math.floor(rng() * Math.min(numbers.length, 10))],
    };
  }
  return tasks;
}

export function stageCheckVerdict(correctCount, total = 5) {
  return correctCount >= Math.ceil(total * 0.8); // ≥4 of 5
}

export { itemById, itemsOf, itemsOfTheme };
