import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyInput, isGibberish, isEmojiOnly, looksHomeLanguage, nextMode } from '../src/engine/modes.js';

test('doc 03 §3.3 rules table', () => {
  assert.equal(classifyInput('i want to play a game!').kind, 'play');
  assert.equal(classifyInput('play').mode, 'engagement');
  assert.equal(classifyInput("i'm sad").kind, 'upset');
  assert.equal(classifyInput("i'm tired").kind, 'upset');
  assert.equal(classifyInput("i don't want to").kind, 'stop');
  assert.equal(classifyInput('stop').kind, 'stop');
  assert.equal(classifyInput("i don' know").kind, 'dontknow');
  assert.equal(classifyInput('i have a dog named Bruno!').kind, 'chat');
  assert.equal(classifyInput('where is the duck?').kind, 'question');
});

test('repeated "no" escalates to support; single "no" does not', () => {
  assert.equal(classifyInput('no', { noStreak: 0 }).kind, 'no');
  assert.equal(classifyInput('no', { noStreak: 1 }).kind, 'repeated-no');
  assert.equal(classifyInput('no', { noStreak: 1 }).mode, 'support');
});

test('gibberish and emoji-only are engagement', () => {
  assert.equal(isGibberish('asdfgh'), true);
  assert.equal(isGibberish('qwerty'), true);
  assert.equal(classifyInput('asdfgh 😀😀😀').kind === 'emoji' || classifyInput('asdfgh 😀😀😀').kind === 'gibberish', true);
  assert.equal(isEmojiOnly('😀😀😀'), true);
  assert.equal(classifyInput('😀😀😀').kind, 'emoji');
});

test('home-language detection (one-line bridge path)', () => {
  assert.equal(looksHomeLanguage('mujhe paani'), true);
  assert.equal(looksHomeLanguage('hola amigo'), true);
  assert.equal(looksHomeLanguage('hello friend'), false);
});

test('study refusal routes to play — not pushed, not treated as upset', () => {
  assert.equal(classifyInput('i am not in study mode').kind, 'refuse');
  assert.equal(classifyInput('i am not in study mode').mode, 'engagement');
  assert.equal(classifyInput('i said im not in mode').kind, 'refuse');
  assert.equal(classifyInput("i don't want to study").kind, 'refuse'); // was: stop → support
  assert.equal(classifyInput('no lessons please!').kind, 'refuse');
  assert.equal(classifyInput("i don't want to").kind, 'stop'); // generic refusal unchanged
  assert.equal(classifyInput('i have a dog named Bruno!').kind, 'chat'); // no false positive
});

test('"i love you" is bounded warmth', () => {
  assert.equal(classifyInput('i love you milo').kind, 'love');
});

test('hysteresis: sticky modes hold, SUPPORT preempts', () => {
  const a = nextMode('learning', 'engagement', 0);
  assert.equal(a.mode, 'engagement');
  const b = nextMode('engagement', 'learning', 1);
  assert.equal(b.mode, 'engagement', 'sticky for the second turn');
  const c = nextMode('engagement', 'support', 3);
  assert.equal(c.mode, 'support', 'support preempts immediately');
});
