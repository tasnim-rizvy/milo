import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS children (
  key TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  age_band INTEGER NOT NULL DEFAULT 4,
  reading_band TEXT NOT NULL DEFAULT 'tap-first',
  avatar TEXT NOT NULL DEFAULT '🦊',
  interests TEXT NOT NULL DEFAULT '[]',
  home_language TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1,
  total_stars INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  first_try_correct INTEGER NOT NULL DEFAULT 0,
  first_try_total INTEGER NOT NULL DEFAULT 0,
  last_summary TEXT NOT NULL DEFAULT '',
  last_seen INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS item_progress (
  child_key TEXT NOT NULL,
  item_id TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1,
  correct INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  first_try INTEGER NOT NULL DEFAULT 0,
  first_try_total INTEGER NOT NULL DEFAULT 0,
  last_seen INTEGER NOT NULL DEFAULT 0,
  next_due INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (child_key, item_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  child_key TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT 'learn',
  started INTEGER NOT NULL,
  ended INTEGER,
  stars INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  child_key TEXT,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS badges (
  child_key TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (child_key, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_events_child ON events(child_key, ts DESC);
CREATE INDEX IF NOT EXISTS idx_progress_child ON item_progress(child_key);
`;

export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 3000');
  db.exec(SCHEMA);
  // Migration: total_stars arrived with the kid-profiles feature — existing
  // demo databases gain the column in place (no data loss).
  const childCols = db.prepare('PRAGMA table_info(children)').all().map((c) => c.name);
  if (!childCols.includes('total_stars')) {
    db.exec('ALTER TABLE children ADD COLUMN total_stars INTEGER NOT NULL DEFAULT 0');
  }

  const st = {
    childGet: db.prepare('SELECT * FROM children WHERE key = ?'),
    childAll: db.prepare('SELECT * FROM children ORDER BY created_at ASC'),
    childUpsert: db.prepare(`INSERT INTO children
        (key, nickname, age_band, reading_band, avatar, interests, home_language, level,
         total_stars, created_at, first_try_correct, first_try_total, last_summary, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        nickname=excluded.nickname, age_band=excluded.age_band, reading_band=excluded.reading_band,
        avatar=excluded.avatar, interests=excluded.interests, home_language=excluded.home_language,
        level=excluded.level, total_stars=excluded.total_stars,
        first_try_correct=excluded.first_try_correct,
        first_try_total=excluded.first_try_total, last_summary=excluded.last_summary,
        last_seen=excluded.last_seen`),
    starAdd: db.prepare('UPDATE children SET total_stars = total_stars + ? WHERE key = ?'),
    childDelete: db.prepare('DELETE FROM children WHERE key = ?'),
    progWipe: db.prepare('DELETE FROM item_progress WHERE child_key = ?'),
    sessWipe: db.prepare('DELETE FROM sessions WHERE child_key = ?'),
    evWipe: db.prepare('DELETE FROM events WHERE child_key = ?'),
    badgeWipe: db.prepare('DELETE FROM badges WHERE child_key = ?'),

    progGet: db.prepare('SELECT * FROM item_progress WHERE child_key = ? AND item_id = ?'),
    progAll: db.prepare('SELECT * FROM item_progress WHERE child_key = ?'),
    progUpsert: db.prepare(`INSERT INTO item_progress
        (child_key, item_id, box, correct, wrong, first_try, first_try_total, last_seen, next_due)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(child_key, item_id) DO UPDATE SET
        box=excluded.box, correct=excluded.correct, wrong=excluded.wrong,
        first_try=excluded.first_try, first_try_total=excluded.first_try_total,
        last_seen=excluded.last_seen, next_due=excluded.next_due`),

    sessCreate: db.prepare('INSERT INTO sessions (id, child_key, intent, started, state) VALUES (?, ?, ?, ?, ?)'),
    sessGet: db.prepare('SELECT * FROM sessions WHERE id = ?'),
    sessSave: db.prepare('UPDATE sessions SET stars = ?, state = ? WHERE id = ?'),
    sessEnd: db.prepare('UPDATE sessions SET ended = ?, summary = ?, stars = ?, state = ? WHERE id = ?'),

    eventAdd: db.prepare('INSERT INTO events (session_id, child_key, ts, type, payload) VALUES (?, ?, ?, ?, ?)'),
    eventRecent: db.prepare('SELECT * FROM events WHERE child_key = ? ORDER BY ts DESC LIMIT ?'),

    badgeAdd: db.prepare('INSERT OR IGNORE INTO badges (child_key, badge_id, earned_at) VALUES (?, ?, ?)'),
    badgeAll: db.prepare('SELECT * FROM badges WHERE child_key = ? ORDER BY earned_at ASC'),
  };

  const parseChild = (row) => (row ? { ...row, interests: JSON.parse(row.interests || '[]') } : undefined);

  return {
    raw: db,
    child(key) {
      return parseChild(st.childGet.get(key));
    },
    children() {
      return st.childAll.all().map((r) => ({ ...r, interests: JSON.parse(r.interests || '[]') }));
    },
    saveChild(c) {
      st.childUpsert.run(
        c.key, c.nickname, c.age_band, c.reading_band, c.avatar,
        JSON.stringify(c.interests || []), c.home_language || '', c.level,
        c.total_stars || 0,
        c.created_at || Date.now(), c.first_try_correct || 0, c.first_try_total || 0,
        c.last_summary || '', c.last_seen || 0,
      );
    },
    addStars(key, n) {
      st.starAdd.run(n, key);
    },
    deleteChild(key) {
      st.progWipe.run(key);
      st.sessWipe.run(key);
      st.evWipe.run(key);
      st.badgeWipe.run(key);
      st.childDelete.run(key);
    },
    progressAll(childKey) {
      return st.progAll.all(childKey);
    },
    progressGet(childKey, itemId) {
      return st.progGet.get(childKey, itemId);
    },
    saveProgress(childKey, p) {
      st.progUpsert.run(
        childKey, p.item_id, p.box, p.correct, p.wrong,
        p.first_try, p.first_try_total, p.last_seen, p.next_due,
      );
    },
    createSession(row) {
      st.sessCreate.run(row.id, row.child_key, row.intent, row.started, JSON.stringify(row.state || {}));
    },
    session(id) {
      const r = st.sessGet.get(id);
      return r ? { ...r, state: JSON.parse(r.state || '{}') } : undefined;
    },
    saveSession(id, stars, state) {
      st.sessSave.run(stars, JSON.stringify(state), id);
    },
    endSession(id, { summary, stars, state, ended }) {
      st.sessEnd.run(ended, summary, stars, JSON.stringify(state), id);
    },
    addEvent(sessionId, childKey, type, payload) {
      st.eventAdd.run(sessionId, childKey, Date.now(), type, JSON.stringify(payload || {}));
    },
    recentEvents(childKey, limit = 40) {
      return st.eventRecent.all(childKey, limit).map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
    },
    addBadge(childKey, badgeId) {
      st.badgeAdd.run(childKey, badgeId, Date.now());
    },
    badges(childKey) {
      return st.badgeAll.all(childKey);
    },
  };
}
