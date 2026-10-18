// Mode detection — Tier 1 rules (docs/03 §3.2–3.4). Instant, deterministic,
// covers every demo-critical case. Tier 2 (tiny classifier) is intentionally
// omitted from the build (cut-list #3 in docs/06 §3): the rules carry the demo.
import { normalize } from './matching.js';

const RX = {
  stop: /(^|\s)(stop|stopp?it|no more|quit)(\s|$)|i (don'?t|dont|do not) want/,
  // Study refusal family — "not in study mode", "don't want to study", "no lessons".
  // Routed to play (engagement), never pushed back into a lesson (R2).
  refuse: /\b(no|not|don'?t|dont|do not|quit|stop)\b[^.!?]{0,25}\b(stud(y|ies|ying)|learn(ing)?|lessons?|homework|mode)\b/,
  upset: /\b(sad|tired|scared|angry|mad|afraid|worried|lonely|hate|bad day|crying|cry)\b/,
  cant: /\b(i can'?t|i cant|too hard|so hard|difficult)\b/,
  dontknow: /\b(i (don'?t?|do not) know|dunno|no idea|idk)\b/,
  play: /\b(pla+y|plays|game|games|sing|song|songs|dance|dancing|simon)\b/,
  bored: /\b(bored|boring)\b/,
  love: /\b(i love you|love you milo)\b/,
  question: /\b(where|why|who|whose|how many|what is|what'?s|which)\b/,
  yes: /\b(yes|yeah|yep|yup|ok|okay|sure)\b/,
  no: /\b(no|nope|nah)\b/,
  hello: /\b(hi|hello|hey)\b/,
  bye: /(^|\s)(bye|goodbye|byebye|see you)(\s|$)/,
};

// Words that signal a home-language attempt (one-line bridge max per session).
const HOME_WORDS = [
  'mujhe', 'mera', 'meri', 'nahi', 'haan', 'kya', 'accha', 'thik', 'chalo', 'paani', 'khelna',
  'hola', 'gracias', 'quiero', 'agua', 'gato', 'bien', 'como',
  'ami', 'kemon', 'valo',
  'marhaba', 'shukran', 'mae',
];

export function isGibberish(raw) {
  const t = normalize(raw);
  if (!t || t.length < 4) return false;
  if (/^(asdf|qwer|zxcv|wasd|hjkl|dasd|sdfg)/.test(t)) return true;
  const words = t.split(' ').filter((w) => w.length >= 4);
  if (!words.length) return false;
  return words.every((w) => !/[aeiou]/.test(w));
}

export function isEmojiOnly(raw) {
  const t = String(raw || '');
  const stripped = t.replace(/\p{Extended_Pictographic}/gu, '').replace(/[\s\ufe0f\u200d]/g, '');
  return stripped.length === 0 && t.trim().length > 0;
}

export function looksHomeLanguage(raw) {
  const t = normalize(raw);
  if (!t) return false;
  if (/[\u0900-\u097F\u0600-\u06FF\u0980-\u09FF\u4E00-\u9FFF]/.test(raw)) return true;
  const words = t.split(' ');
  return words.some((w) => HOME_WORDS.includes(w));
}

// Feelings the child states in their own words (never asked with buttons). Strong
// negative words count anywhere; "happy"-type words only when said as a feeling
// ("I am happy", "so excited", or the word on its own), so "good dog" is not a mood.
const FEELINGS = [
  ['sad', /\b(sad|crying|cry|unhappy|upset)\b/],
  ['angry', /\b(angry|mad|furious|grumpy)\b/],
  ['scared', /\b(scared|afraid|frightened)\b/],
  ['worried', /\b(worried|nervous)\b/],
  ['lonely', /\b(lonely|alone)\b/],
  ['sleepy', /\b(sleepy|tired|sleep)\b/],
];
const HAPPY_WORDS = 'happy|great|good|fine|excited|glad|awesome|wonderful|joyful';
export function detectMood(raw) {
  const t = normalize(raw);
  if (!t) return null;
  if (new RegExp(`\\bnot (very |so )?(${HAPPY_WORDS})\\b`).test(t)) return 'sad';
  for (const [mood, rx] of FEELINGS) {
    if (!rx.test(t)) continue;
    if (new RegExp(`\\b(not|never) (very |so )?(${rx.source.slice(3, -3)})\\b`).test(t)) return null; // "i am not sad"
    return mood;
  }
  if (new RegExp(`\\b(i am|im|i feel|feel|feeling|so|very)\\s+(${HAPPY_WORDS})\\b`).test(t)) return 'happy';
  if (new RegExp(`^(${HAPPY_WORDS}|yay|yes yay)$`).test(t)) return 'happy';
  return null;
}

// Classify a child input that was NOT a recognized answer attempt.
// ctx: { noStreak, dontKnowCount, mode (current sticky), conversationTurns }
export function classifyInput(raw, ctx = {}) {
  const t = normalize(raw);
  if (!t) {
    if (isEmojiOnly(raw)) return { kind: 'emoji', mode: 'engagement' };
    return { kind: 'empty', mode: null };
  }
  if (RX.refuse.test(t)) return { kind: 'refuse', mode: 'engagement' }; // play, don't push
  if (RX.stop.test(t)) return { kind: 'stop', mode: 'support' };
  if (RX.upset.test(t)) return { kind: 'upset', mode: 'support' };
  if (RX.cant.test(t)) return { kind: 'cant', mode: 'support' };
  if (RX.dontknow.test(t)) return { kind: 'dontknow', mode: 'support' }; // 2nd one triggers check-in; 1st scaffolds
  if (RX.no.test(t) && (ctx.noStreak || 0) >= 1) return { kind: 'repeated-no', mode: 'support' };
  if (RX.no.test(t)) return { kind: 'no', mode: null };
  if (RX.play.test(t)) return { kind: 'play', mode: 'engagement' };
  if (RX.bored.test(t)) return { kind: 'bored', mode: 'engagement' };
  if (RX.love.test(t)) return { kind: 'love', mode: 'conversation' };
  if (looksHomeLanguage(raw)) return { kind: 'home', mode: null };
  if (isEmojiOnly(raw)) return { kind: 'emoji', mode: 'engagement' };
  if (isGibberish(raw)) return { kind: 'gibberish', mode: 'engagement' };
  if (RX.question.test(t)) return { kind: 'question', mode: 'conversation' }; // curiosity — grace 2–3 turns
  if (RX.hello.test(t) && t.split(' ').length <= 2) return { kind: 'hello', mode: 'conversation' };
  if (RX.bye.test(t)) return { kind: 'bye', mode: null };
  return { kind: 'chat', mode: 'conversation' };
}

// Mode stickiness (docs/03 §3.4): a mode holds ≥2 turns; SUPPORT preempts
// immediately; CONVERSATION has a ≤3-turn budget before the scripted bridge.
export function nextMode(current, detected, stickyTurns) {
  if (detected === 'support') return { mode: 'support', stickyTurns: 2 };
  if (!detected) return { mode: current, stickyTurns };
  if (current === detected) return { mode: current, stickyTurns: Math.max(stickyTurns - 1, 0) };
  if (stickyTurns > 0) return { mode: current, stickyTurns: stickyTurns - 1 };
  return { mode: detected, stickyTurns: 1 };
}
