// Preloaded demo state (docs/06 §5): Maya = fresh L1 (chip-only path),
// Aarav = mid-L2 with history, one click from graduation. Reset anytime with
// POST /api/reset-demo.
import { itemsOf, itemById } from './engine/bank.js';

const DAY = 86400e3;
const now = () => Date.now();

export function seedDemo(store, { force = false } = {}) {
  const existing = store.children().map((c) => c.key);
  if (!force && existing.includes('maya') && existing.includes('aarav')) return;

  if (force) {
    for (const key of ['maya', 'aarav']) {
      if (existing.includes(key)) store.deleteChild(key);
    }
  }

  seedMaya(store);
  seedAarav(store);
}

function seedMaya(store) {
  store.saveChild({
    key: 'maya',
    nickname: 'Maya',
    age_band: 4,
    reading_band: 'tap-first',
    avatar: '🐱',
    interests: ['cats'],
    home_language: '',
    level: 1,
    total_stars: 0,
    created_at: now() - 2 * DAY,
    first_try_correct: 0,
    first_try_total: 0,
    last_summary: '',
    last_seen: 0,
  });
}

function seedAarav(store) {
  const t = now();
  store.saveChild({
    key: 'aarav',
    nickname: 'Aarav',
    age_band: 6,
    reading_band: 'tap-and-type',
    avatar: '🦖',
    interests: ['dinosaurs'],
    home_language: 'Hindi',
    level: 2,
    total_stars: 30,
    created_at: t - 7 * DAY,
    first_try_correct: 84,
    first_try_total: 120,
    last_summary: 'Yesterday: elephant 🐘 (tricky at first, then nailed it!). Loves dinosaurs. You learned with Milo after school.',
    last_seen: t - 1 * DAY,
  });

  // L1 fully mastered (he graduated it earlier)
  for (const item of itemsOf(1)) {
    store.saveProgress('aarav', {
      item_id: item.id,
      box: 5,
      correct: 6,
      wrong: item.id === 'l1-animals-elephant' ? 3 : 0,
      first_try: item.id === 'l1-animals-elephant' ? 3 : 6,
      first_try_total: item.id === 'l1-animals-elephant' ? 6 : 6,
      last_seen: t - 26 * 3600e3,
      next_due: t + 10 * DAY,
    });
  }

  // L2: 43 of 49 core items at box ≥3 (≈88% coverage → gate coverage ✓);
  // a handful due right now; the rest are new (teach material).
  const l2 = itemsOf(2);
  const covered = 43;
  l2.forEach((item, i) => {
    if (i >= covered) return; // 6 fresh items for the teach queue
    const isDue = i < 7;
    const box = i < 35 ? 3 : 5;
    store.saveProgress('aarav', {
      item_id: item.id,
      box,
      correct: box === 5 ? 4 : 3,
      wrong: 0,
      first_try: box === 5 ? 4 : 2,
      first_try_total: box === 5 ? 4 : 3,
      last_seen: t - (1 + (i % 3)) * DAY,
      next_due: isDue ? t - 3600e3 : t + 2 * DAY,
    });
  });

  // a struggling word for the graduation "memory of struggle" moment
  store.saveProgress('aarav', {
    item_id: 'l2-toys-balloon',
    box: 2,
    correct: 2,
    wrong: 2,
    first_try: 1,
    first_try_total: 4,
    last_seen: t - 1 * DAY,
    next_due: t - 1800e3,
  });

  // prior sessions on 3 different days (level gate: "≥2 different days")
  for (let d = 3; d >= 1; d--) {
    store.createSession({
      id: `seed-aarav-${d}`,
      child_key: 'aarav',
      intent: 'learn',
      started: t - d * DAY,
      state: { stars: 8 + d, moodStart: 'happy', moodEnd: 'happy' },
    });
  }

  // recent answer events → first-try trend ≥80% over the last 20 (gate ✓)
  const ins = store.raw.prepare(
    'INSERT INTO events (session_id, child_key, ts, type, payload) VALUES (?, ?, ?, ?, ?)',
  );
  for (let k = 0; k < 20; k++) {
    const item = l2[k % covered];
    const firstTry = k !== 4 && k !== 11 && k !== 17; // 17/20 = 85%
    ins.run(
      'seed-aarav-1',
      'aarav',
      t - (k + 1) * 3 * 60e3,
      'answer',
      JSON.stringify({ item_id: item.id, level: 2, correct: true, first_try: firstTry, via: 'chip' }),
    );
  }
  // older elephant struggle events (level 1 — outside the L2 gate window)
  ins.run('seed-aarav-3', 'aarav', t - 26 * 3600e3, 'answer',
    JSON.stringify({ item_id: 'l1-animals-elephant', level: 1, correct: false, first_try: false, via: 'typing' }));
  ins.run('seed-aarav-3', 'aarav', t - 26 * 3600e3 + 60e3, 'answer',
    JSON.stringify({ item_id: 'l1-animals-elephant', level: 1, correct: true, first_try: false, via: 'chip' }));

  store.addBadge('aarav', 'badge-l1'); // WORD WIZARD from L1 graduation
}

export { itemById };
