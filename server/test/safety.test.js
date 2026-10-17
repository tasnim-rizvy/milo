import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySafety, sanitizeModelText, SAFETY_REDIRECTS } from '../src/engine/safety.js';
import { LINES, CHAT_SCRIPTED } from '../src/engine/sel.js';

test('two-way lexicon categories', () => {
  assert.equal(classifySafety('i want to die').level, 'crisis');
  assert.equal(classifySafety('there is a gun').level, 'scary');
  assert.equal(classifySafety('poop poop').level, 'silly');
  assert.equal(classifySafety('you are stupid').level, 'mean');
  assert.equal(classifySafety('my address is 12 park street').level, 'personal');
  assert.equal(classifySafety('i am happy today').level, 'ok');
});

test('crisis response is calm and in-world (no external references)', () => {
  assert.ok(SAFETY_REDIRECTS.crisis.length >= 3);
  for (const line of SAFETY_REDIRECTS.crisis) {
    assert.doesNotMatch(line, /\b(wrong|parent|grown)\b/i);
  }
});

test('output sanitizer strips urls, parent talk, extra sentences', () => {
  const r1 = sanitizeModelText('Visit https://bad.example.com now! You are great!');
  assert.doesNotMatch(r1.text, /http/);
  const r2 = sanitizeModelText('Tell your parents to buy this. Now let us play!', 'FB');
  assert.equal(r2.text, 'FB');
  const r3 = sanitizeModelText('One. Two. Three. Four.', 'FB');
  assert.ok(r3.text.split(/[.!?]/).filter((s) => s.trim()).length <= 2);
});

test('the scripted bank never says "wrong", never mentions parents/grown-ups', () => {
  const all = [];
  const walk = (v) => {
    if (typeof v === 'string') all.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(LINES);
  walk(CHAT_SCRIPTED);
  walk(SAFETY_REDIRECTS);
  for (const line of all) {
    assert.doesNotMatch(line, /\bwrong\b/i, `line contains "wrong": ${line}`);
    assert.doesNotMatch(line, /\bparent(s)?\b/i, `line mentions parents: ${line}`);
    assert.doesNotMatch(line, /\bgrown[- ]?up(s)?\b/i, `line mentions grown-ups: ${line}`);
    assert.ok(line.length <= 220, `line too long: ${line}`);
  }
});
