// The child's progress, summarized for the "My progress" screen. Everything is
// derived from data the engine already keeps (word boxes, level gate, stars, sessions,
// typed feelings), so it is always current. Milestones are computed, not stored:
// they unlock the moment the numbers are there — including for older profiles.
import { itemById } from './bank.js';
import { levelStats } from './curriculum.js';

const FEELING_EMOJI = { happy: '😊', sleepy: '😴', sad: '😢', angry: '😠', scared: '😨', worried: '😟', lonely: '🫂' };

const MILESTONES = [
  { id: 'first-star', emoji: '⭐', name: 'First star', desc: 'Win your first star', test: (m) => m.stars >= 1 },
  { id: 'words-5', emoji: '🔤', name: 'Word explorer', desc: 'Learn 5 words', test: (m) => m.learned >= 5 },
  { id: 'brave', emoji: '💛', name: 'Brave sharer', desc: 'Tell Milo how you feel', test: (m) => m.feelingsShared >= 1 },
  { id: 'puzzles', emoji: '🧩', name: 'Puzzle pro', desc: 'Solve 3 puzzles', test: (m) => m.puzzles >= 3 },
  { id: 'stars-25', emoji: '🌟', name: 'Super star', desc: 'Collect 25 stars', test: (m) => m.stars >= 25 },
  { id: 'comeback', emoji: '🔁', name: 'Come-back kid', desc: 'Play on 2 different days', test: (m) => m.days >= 2 },
  { id: 'words-15', emoji: '🧙', name: 'Word wizard', desc: 'Learn 15 words', test: (m) => m.learned >= 15 },
  { id: 'level-2', emoji: '🏆', name: 'Level 2', desc: 'Graduate Level 1', test: (m) => m.level >= 2 },
  { id: 'level-3', emoji: '🚀', name: 'Level 3', desc: 'Graduate Level 2', test: (m) => m.level >= 3 },
];

export function buildProgress(store, child) {
  const rows = store.progressAll(child.key);
  const word = (r) => {
    const it = itemById(r.item_id);
    return it ? { text: it.text, emoji: it.emoji, level: it.level, box: r.box } : null;
  };
  const all = rows.map(word).filter(Boolean);
  const learned = all.filter((w) => w.box >= 3);
  const practicing = all.filter((w) => w.box < 3);

  const stats = levelStats(store, child);
  // one bar toward the next level: the three gate conditions, each capped at 1
  const gateParts = [
    Math.min(1, stats.coverage / 0.8),
    Math.min(1, stats.recentCount >= 5 ? stats.firstTryRate / 0.8 : (stats.recentCount / 5) * (stats.firstTryRate / 0.8)),
    Math.min(1, stats.days / 2),
  ];
  const toNext = child.level >= 3 ? 1 : gateParts.reduce((a, b) => a + b, 0) / gateParts.length;

  const events = store.recentEvents(child.key, 500);
  const feelings = {};
  for (const e of events) {
    if (e.type === 'mood' && e.payload?.source === 'text' && FEELING_EMOJI[e.payload.mood]) {
      feelings[e.payload.mood] = (feelings[e.payload.mood] || 0) + 1;
    }
  }
  const feelingsShared = Object.values(feelings).reduce((a, b) => a + b, 0);
  const puzzles = events.filter((e) => e.type === 'wonder').length;

  const sess = store.raw
    .prepare('SELECT COUNT(*) AS n, MAX(started) AS last FROM sessions WHERE child_key = ?')
    .get(child.key);

  const m = {
    stars: child.total_stars || 0, learned: learned.length, feelingsShared, puzzles,
    days: stats.days, level: child.level,
  };
  return {
    level: child.level,
    stars: m.stars,
    toNext: Math.round(toNext * 100),
    next: {
      words: { have: stats.covered, of: stats.total },
      days: { have: Math.min(stats.days, 2), of: 2 },
    },
    played: { sessions: sess?.n || 0, days: stats.days, last: sess?.last || 0 },
    words: {
      learned: learned.map(({ text, emoji }) => ({ text, emoji })),
      practicing: practicing.map(({ text, emoji }) => ({ text, emoji })),
    },
    feelings: Object.entries(feelings).map(([mood, n]) => ({ mood, emoji: FEELING_EMOJI[mood], n })),
    milestones: MILESTONES.map(({ id, emoji, name, desc, test }) => ({ id, emoji, name, desc, earned: test(m) })),
  };
}
