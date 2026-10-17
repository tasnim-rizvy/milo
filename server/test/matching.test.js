import test from 'node:test';
import assert from 'node:assert/strict';
import { matchAnswer, normalize, phonetic, levenshtein } from '../src/engine/matching.js';

test('exact and alias matching', () => {
  assert.equal(matchAnswer('red', { answer: 'red' }).ok, true);
  assert.equal(matchAnswer('Red!', { answer: 'red' }).ok, true);
  assert.equal(matchAnswer('mom', { answer: 'mama', accepts: ['mom'] }).ok, true);
});

test('typo tolerance — the doc examples', () => {
  assert.equal(matchAnswer('rad', { answer: 'red' }).ok, true, '"rad" → red');
  assert.equal(matchAnswer('elefant', { answer: 'elephant' }).ok, true, '"elefant" → elephant');
  assert.equal(matchAnswer('abble', { answer: 'apple' }).ok, true, '"abble" → apple');
  assert.equal(matchAnswer('slep', { answer: 'sleep' }).ok, true, '"slep" → sleep');
  assert.equal(matchAnswer('baloon', { answer: 'balloon' }).ok, true, '"baloon" → balloon');
});

test('short-word guard keeps distinct words apart', () => {
  assert.equal(matchAnswer('car', { answer: 'cat' }).ok, false, 'car ≠ cat');
  assert.equal(matchAnswer('dog', { answer: 'duck' }).ok, false, 'dog ≠ duck');
  assert.equal(matchAnswer('cut', { answer: 'cat' }).ok, true, 'vowel swap on 3 letters is tolerated');
});

test('insertions/deletions tolerated ("duk"→duck, "blu"→blue, "redd"→red)', () => {
  assert.equal(matchAnswer('duk', { answer: 'duck' }).ok, true);
  assert.equal(matchAnswer('blu', { answer: 'blue' }).ok, true);
  assert.equal(matchAnswer('redd', { answer: 'red' }).ok, true);
});

test('plural / singular tolerance', () => {
  assert.equal(matchAnswer('apples', { answer: 'apple' }).ok, true);
  assert.equal(matchAnswer('cat', { answer: 'cats' }).ok, true);
});

test('word inside a sentence counts', () => {
  assert.equal(matchAnswer('it is a red ball', { answer: 'red' }).ok, true);
  assert.equal(matchAnswer('My dino is fast!', { answer: 'fast' }).ok, true);
});

test('digits for numbers, phrases for sentences', () => {
  assert.equal(matchAnswer('11', { answer: 'eleven', accepts: ['11'] }).ok, true);
  assert.equal(matchAnswer("I'm fine thank you", { answer: 'I am fine thank you' }).ok, true);
});

test('invented spelling "hes" style is understood in context', () => {
  assert.equal(matchAnswer('hes fast', { answer: 'fast' }).ok, true);
});

test('normalize / phonetic / levenshtein sanity', () => {
  assert.equal(normalize("  Thank YOU! "), 'thank you');
  assert.equal(phonetic('elephant'), phonetic('elefant'));
  assert.equal(levenshtein('kitten', 'sitting'), 3);
});
