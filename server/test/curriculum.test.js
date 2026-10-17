import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/store.js';
import {
  applyAnswer, gateReady, levelStats, chipOptions, buildStageCheck, stageCheckVerdict,
} from '../src/engine/curriculum.js';
import { seedDemo } from '../src/seed.js';
import { itemsOf, itemById } from '../src/engine/bank.js';

const DAY = 86400e3;

function memStore() {
  const store = openStore(':memory:');
  const child = {
    key: 't', nickname: 'T', age_band: 5, reading_band: 'tap-first', avatar: '🦊',
    interests: [], home_language: '', level: 1, created_at: 0,
    first_try_correct: 0, first_try_total: 0, last_summary: '', last_seen: 0,
  };
  store.saveChild(child);
  return { store, child };
}

test('Leitner box transitions follow docs/03 §2.1 exactly', () => {
  const { store, child } = memStore();
  const red = itemById('l1-colors-red');
  const now = Date.now();

  let p = applyAnswer(store, child, red, true, true, now);
  assert.equal(p.box, 2, 'box1 → box2 on correct');
  assert.ok(p.next_due - now < 1000, 'box2 due same session (interval 0)');

  p = applyAnswer(store, child, red, true, true, now);
  assert.equal(p.box, 3, 'box2 → box3');
  assert.ok(p.next_due - now >= DAY - 1000 && p.next_due - now <= DAY + 1000, 'box3 due next day');

  p = applyAnswer(store, child, red, false, false, now);
  assert.equal(p.box, 1, 'wrong from box3 → box1');

  p = applyAnswer(store, child, red, true, true, now);
  p = applyAnswer(store, child, red, true, true, now);
  p = applyAnswer(store, child, red, true, true, now);
  assert.equal(p.box, 4, 'climbed to box4');
  p = applyAnswer(store, child, red, false, false, now);
  assert.equal(p.box, 2, 'wrong from box4 → box2');

  p = applyAnswer(store, child, red, true, true, now);
  p = applyAnswer(store, child, red, true, true, now);
  p = applyAnswer(store, child, red, true, true, now);
  assert.equal(p.box, 5, 'climbed to box5 (mastered)');
  p = applyAnswer(store, child, red, true, true, now);
  assert.equal(p.box, 5, 'box5 stays 5 on correct');
  assert.ok(p.next_due - now >= 14 * DAY - 1000, 'box5 due in 14 days');
  p = applyAnswer(store, child, red, false, false, now);
  assert.equal(p.box, 3, 'wrong from box5 → box3');
});

test('level stats + gate: Aarav is one click from graduation', () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const aarav = store.child('aarav');
  const s = levelStats(store, aarav);
  assert.ok(s.coverage >= 0.8, `coverage ${s.coverage}`);
  assert.ok(s.firstTryRate >= 0.8, `first-try ${s.firstTryRate}`);
  assert.ok(s.days >= 2, `days ${s.days}`);
  assert.equal(gateReady(store, aarav), true);
});

test('Maya is fresh L1 and not gate-ready', () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const maya = store.child('maya');
  assert.equal(maya.level, 1);
  assert.equal(gateReady(store, maya), false);
});

test('chip options always include the target + same-theme distractors', () => {
  const red = itemById('l1-colors-red');
  const opts = chipOptions(red, Math.random, 3);
  assert.equal(opts.length, 3);
  const ids = opts.map((o) => o.id);
  assert.ok(ids.includes('l1-colors-red'));
  const themes = opts.map((o) => itemById(o.id).theme);
  assert.ok(themes.filter((t) => t === 'colors').length >= 1);
});

test('stage check: 5 mixed tasks; verdict is ≥4 of 5', () => {
  const store = openStore(':memory:');
  seedDemo(store);
  const child = store.child('aarav');
  const tasks = buildStageCheck(child, store);
  assert.equal(tasks.length, 5);
  const kinds = new Set(tasks.map((t) => t.kind));
  assert.ok(kinds.size >= 4, `kinds: ${[...kinds].join(', ')}`);
  assert.equal(stageCheckVerdict(4), true);
  assert.equal(stageCheckVerdict(3), false);
});

test('bank sizes are in the documented ballpark', () => {
  assert.ok(itemsOf(1).length >= 55, `L1 ${itemsOf(1).length}`);
  assert.ok(itemsOf(2).length >= 45, `L2 ${itemsOf(2).length}`);
  assert.ok(itemsOf(3).length >= 12, `L3 ${itemsOf(3).length}`);
});
