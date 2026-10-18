// Composer (docs/02 §5–6): phrasing, free conversation, empathy lines.
// The engine owns pedagogy; the LLM only warms the language. Every LLM-backed
// turn ships with a "turn brief" (what the moment must say) and a scripted twin
// that serves whenever the model is unavailable or its line fails the
// programmatic checks — the child never waits, never sees an error.
import { llmProviders, config } from '../config.js';
import { streamGemini, streamGroq } from './providers.js';
import { sanitizeModelText } from '../engine/safety.js';
import { itemsOf } from '../engine/bank.js';

const SYSTEM = `You are Milo, a warm cartoon fox chatbot who teaches English to children under 7.
Reply with ONE short message: max 2 sentences, max 12 words per sentence, concrete present-tense words, at most one question, emoji often.
Vocabulary: only very simple words a 5-year-old knows. No idioms, no sarcasm, no metaphors, no scary/adult/toilet topics.
Always react to what the child just said — answer their question first if they asked one.
Never repeat your last question or topic: you can see the recent chat, so say something new.
The child's "Loves" list is background — mention a like only now and then, not every reply.
If the child is sad or upset: comfort first, no teaching at all.
Never ask for or repeat personal information (full name, address, school, phone).
Never mention parents or grown-ups. Never say "wrong".
The child may talk about family (dad, mom, brother, grandma…). Never mention family members back and never tell the child to talk to anyone — comfort the child's feeling only.
Never say you feel sad or happy about the child's feelings — say you are sorry they feel that way, or that the feeling is okay.
If you are not sure what the child meant, ask ONE simple question with two choices — never guess that they are sleepy, sad, or playing.
If the child says they do not want to study or learn, cheerfully offer a quick game instead.
You may be playful, curious, and forgetful (kids like helping you).
Always keep the child talking or playing: end with a tiny question or invitation.
Output plain text only — no quotes, no markdown.`;

// Exported for tests: the hard prompt rules are part of the safety story.
export const SYSTEM_PROMPT = SYSTEM;

export function buildLearnerCard(child, store) {
  const pm = new Map(store.progressAll(child.key).map((p) => [p.item_id, p]));
  const items = itemsOf(child.level);
  const mastered = items
    .filter((i) => (pm.get(i.id)?.box ?? 0) >= 5)
    .slice(0, 12)
    .map((i) => i.text);
  const struggling = items
    .filter((i) => {
      const p = pm.get(i.id);
      return p && p.wrong > 0 && p.box <= 2;
    })
    .slice(0, 6)
    .map((i) => i.text);

  return [
    `Child: ${child.nickname}, age band ${child.age_band}, level L${child.level} (of 3).`,
    `Reading band: ${child.reading_band === 'tap-first' ? 'cannot read yet — keep language ultra simple' : 'early reader — may type short words'}.`,
    mastered.length ? `Mastered words: ${mastered.join(', ')}.` : '',
    struggling.length ? `Struggling words: ${struggling.join(', ')}.` : '',
    child.interests?.length ? `Loves: ${child.interests.join(', ')} — background only, bring these up rarely.` : '',
    child.home_language ? `Home language: ${child.home_language} (one tiny encouragement bridge max, never full translation).` : '',
    child.last_summary ? `Last session: ${child.last_summary}` : '',
  ].filter(Boolean).join('\n');
}

// ── Turn briefs ─────────────────────────────────────────────────────────────
// The engine knows exactly what a moment must say (a word was missed, the child
// is stuck, the mood was sad…). The brief gives the model the facts and the
// shape of the reply — it only finds warmer words; it never decides pedagogy.

const singleToken = (w) => !!w && !/[\s']/.test(w);

// Words the model's line MUST contain for the pedagogy to stay on track.
export function mustWords(task) {
  if (!task) return [];
  if (task.type === 'praise' || task.type === 'recast') return singleToken(task.word) ? [task.word] : [];
  if (task.type === 'scaffold' && ['show', 'simpler'].includes(task.step)) return singleToken(task.word) ? [task.word] : [];
  return [];
}

function taskDirective(task) {
  const word = task?.word ? `"${task.word}"` : '';
  const emoji = task?.emoji ? ` ${task.emoji}` : '';
  const must = mustWords(task).length ? ` Include the word ${word}.` : '';
  const base = (() => {
  switch (task?.type) {
    case 'praise':
      return task.what
        ? `Right now: the child just ${task.what}. Cheer for them in one short message.${task.endWith ? '' : ' No question — just the cheer, the next thing pops up right after.'} Sound different from your recent lines.`
        : `Right now: the child just got ${word}${emoji} right${task.firstTry ? ' on the FIRST try' : ' after trying again'}. Cheer for them in one short message.${must}${task.endWith ? '' : ' No question — just the cheer, the next task pops up right after.'} Sound different from your recent lines.`;
    case 'recast':
      return `Right now: the child tapped "${task.tapped}" but the right answer is ${word}${emoji}. Kindly point to ${word} and invite the child to find it.${must} Never say the word "wrong", never scold. Do not suggest other games.`;
    case 'growth':
      return 'Right now: the child says they do not know / cannot do it. Reassure them warmly: hard words need practice, "yet" means it is coming, you will do it together. No question, no games — one short message.';
    case 'checkin':
      return 'Right now: the child missed a few answers in a row. Say gently: it is okay to not know, and now you will show the word together. No question, no game suggestions, no activities — one short message.';
    case 'calm':
      return 'Right now: it is time for a calm moment together — the child can breathe with you, talk with you, or say bye (the buttons below). Comfort first, no games, no question — one short message. Do not assume any particular mood — just make it cozy and safe.';
    case 'breathe':
      return 'Right now: you are in the calm corner and the child tapped for a breath. Guide exactly ONE slow breath — breathe in, and blow out; a little candle or a balloon is lovely. Calm and slow, very short, no question.';
    case 'invite':
      return 'Right now: the child chose to talk with you. Invite them warmly to share anything — you are all ears. One short message, no question.';
    case 'thanks':
      return 'Right now: the child just opened up and shared their feelings — that was brave. Thank them warmly, then gently say what is next: a soft easy game, more talking, or a wave bye — those are the buttons below. Very short and gentle, no question.';
    case 'noOffer':
      return 'Right now: the child said no. Gently offer two choices: a little game, or a calm moment — those are the two buttons below. No other suggestions, no question — one short message.';
    case 'mood':
      return `Right now: the check-in chips are on screen and the child tapped "I feel ${task.moodLabel}". Mirror that feeling warmly${task.mood === 'sad' ? '; gently remind them they can talk to you, take a breathing break, or play something soft — those are the buttons below' : ' and say you will start right away'}. No question — one short message, the buttons come next.`;
    case 'greeting':
      return `Right now: a brand-new session starts. Greet ${task.name} by name warmly and ask how they feel today.${task.missed ? ' Welcome them back — it has been a little while and you missed them.' : ''} One short message.`;
    case 'scaffold': {
      if (task.step === 'simpler') return `Right now: the child is stuck on ${word}${emoji}. Make it easier: say you will show just two choices, then ask which one is ${word}.${must} One short message.`;
      if (task.step === 'hint') return `Right now: the child is still stuck on ${word}${emoji}. Give one gentle hint: the word starts with the letter "${task.letter}". One short message.`;
      if (task.step === 'show') return `Right now: the child is stuck on ${word}${emoji}. Simply show the answer — it is ${word}${emoji} — and invite the child to tap it.${must} One short message.`;
      return `Right now: the child stayed stuck on ${word || 'this one'}${emoji}. Gently say you will meet this word again another day (no pressure at all), then move to something fun. One short message.`;
    }
    default:
      return '';
  }
  })();
  // "One action → one bubble": when a scripted line must survive inside the
  // single reply (the next task's exact prompt), the brief pins it as the end.
  if (base && task?.endWith) {
    return `${base} Do not ask any question of your own. End your message with exactly this line, word for word, and nothing after it: "${task.endWith}"`;
  }
  return base;
}

// Build the single user message: learner card + brief/mode + recent chat + new line.
export function buildChatPrompt({ card, mode, input, history = [], task = null }) {
  const lines = [card];
  const directive = task ? taskDirective(task) : '';
  if (directive) {
    lines.push(directive);
  } else {
    lines.push(mode === 'support'
      ? 'The child is upset or sharing feelings. Comfort first, zero teaching, gentle and short. Do not suggest games or activities — the next buttons offer breathe, talk, or bye. At most one gentle question about their feeling.'
      : 'The child is chatting. Be curious and playful, keep it very short.');
  }
  if (history.length) {
    lines.push(`Recent chat (oldest first — never repeat your last line's topic or question):\n${history
      .map((m) => `${m.role === 'milo' ? 'Milo' : 'Child'}: ${m.text}`)
      .join('\n')}`);
  }
  if (String(input || '').trim()) lines.push(`Child said: "${String(input).slice(0, 200)}"`);
  return lines.join('\n\n');
}

const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/[\u2019']/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// "One action → one bubble": when a brief pins an exact scripted ending
// (task.endWith — the next task's prompt), find where the model's own words
// end and the pinned tail begins. Returns the head text, or null when the
// model drifted off the tail entirely. The tail is engine-authored, so it must
// survive sanitizing untouched (and is never subject to the 2-sentence cap).
export function splitPinnedTail(raw, tail) {
  const rawS = String(raw || '');
  const tailWords = norm(tail).match(/[a-z0-9]+/g) || [];
  if (!tailWords.length || !norm(rawS).endsWith(norm(tail))) return null;
  // tokenize the raw text with the same word rules norm() applies (apostrophes
  // fold into the word: "don't" → "dont"), then compare the last N words.
  const tokens = [...rawS.matchAll(/[A-Za-z0-9]+(?:['\u2019][A-Za-z0-9]+)*/g)]
    .map((m) => ({ word: m[0].toLowerCase().replace(/['\u2019]/g, ''), index: m.index }));
  if (tokens.length < tailWords.length) return null;
  const suffix = tokens.slice(-tailWords.length).map((t) => t.word);
  if (suffix.join(' ') !== tailWords.join(' ')) return null;
  // cut right before the tail's first word, then strip the head's trailing
  // whitespace/emoji run — the tail (with its own leading emoji) supplies those
  const head = rawS.slice(0, tokens[tokens.length - tailWords.length].index);
  return head.replace(/[\s\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]+$/u, '');
}

// Task types that must NOT end in a question — the next bubble/task follows
// immediately, so a question would dangle (a leftover "Want to play?" misleads
// the child into answering something the UI doesn't offer).
const QUIET_TASKS = new Set(['praise', 'growth', 'checkin', 'mood', 'breathe', 'invite', 'thanks']);

// Programmatic checks on top of the sanitizer, per turn brief. Any failed
// check sends the scripted twin instead — a scripted line is never a mystery.
export function taskViolations(task, text, history = []) {
  const out = [];
  const t = String(text || '');
  if (!t.trim()) out.push('empty');
  if (task && /\bwrong\b/i.test(t)) out.push('says-wrong');
  const tail = task?.endWith ? String(task.endWith) : '';
  if (tail) {
    // "One action → one bubble": the reply must END with the exact scripted
    // line (the next task's prompt), and may not add questions of its own.
    if (!norm(t).endsWith(norm(tail))) out.push('missing-tail');
    const ownQs = (t.match(/\?/g) || []).length - (tail.match(/\?/g) || []).length;
    if (ownQs > 0) out.push('extra-question');
  } else if (task && QUIET_TASKS.has(task.type) && /\?/.test(t)) {
    out.push('asks-question');
  }
  for (const w of mustWords(task)) {
    if (!norm(t).includes(norm(w))) out.push(`missing:"${w}"`);
  }
  const lastMilo = [...history].reverse().find((m) => m.role === 'milo')?.text;
  if (lastMilo && norm(lastMilo) === norm(t)) out.push('repeats-last-line');
  return out;
}

// Compose one LLM-backed line (free chat, a feelings reply, or a briefed
// micro-moment). The returned `reason` is set when the scripted twin served:
// 'no-keys' | 'error' | 'rejected' (safety filter or a failed brief check).
let lastProviderLog = 0;
function logProviderError(provider, full) {
  const t = Date.now();
  if (t - lastProviderLog < 30000) return; // at most one line per 30 s
  lastProviderLog = t;
  console.warn(`[llm] ${provider.name}/${provider.model}: ${full.slice(0, 400)}`);
}

export async function composeFreeTurn({ mode, task = null, child, store, input, history = [], scriptedFallback }, onChunk = null) {
  const providers = llmProviders();
  if (!providers.length) return { say: scriptedFallback, usedLLM: false, ms: 0, reason: 'no-keys' };

  const card = buildLearnerCard(child, store);
  const user = buildChatPrompt({ card, mode, input, history, task });

  const started = Date.now();
  let lastError = '';
  // each provider may list several models (own quotas): try them in order
  const attempts = providers.flatMap((p) => (p.models || [p.model]).map((model) => ({ ...p, model })));
  for (const provider of attempts) {
    try {
      const streamer = provider.kind === 'gemini' ? streamGemini : streamGroq;
      let text = '';
      const iter = streamer(provider, { system: SYSTEM, user, maxTokens: config.llm.maxTokens }, {
        firstTokenMs: config.llm.ttftBudgetMs,
        totalMs: config.llm.totalBudgetMs,
      });
      for await (const chunk of iter) {
        text += chunk;
        onChunk?.(chunk);
      }
      // One action → one bubble: when the brief pins an exact scripted ending,
      // split it off BEFORE sanitizing. The tail is engine-authored and must
      // survive verbatim — the 2-sentence cap and the safety filters only ever
      // apply to the model's own words (the head).
      if (task?.endWith) {
        const head = splitPinnedTail(text, task.endWith);
        if (head === null) {
          return { say: scriptedFallback, usedLLM: false, ms: Date.now() - started, provider: provider.name, reason: 'rejected', detail: `missing-tail ::got "${String(text).slice(-80)}"` };
        }
        const cleanHead = sanitizeModelText(head, scriptedFallback);
        if (cleanHead.replaced && cleanHead.text === scriptedFallback) {
          return { say: scriptedFallback, usedLLM: false, ms: Date.now() - started, provider: provider.name, reason: 'rejected', detail: 'safety-filter' };
        }
        const joined = `${cleanHead.text} ${task.endWith}`.replace(/\s+/g, ' ').trim();
        const bad = taskViolations(task, joined, history);
        if (bad.length) {
          return { say: scriptedFallback, usedLLM: false, ms: Date.now() - started, provider: provider.name, reason: 'rejected', detail: bad.join(' · ') };
        }
        return { say: joined, usedLLM: true, ms: Date.now() - started, provider: provider.name, model: provider.model };
      }
      const clean = sanitizeModelText(text, scriptedFallback);
      if (clean.replaced && clean.text === scriptedFallback) {
        return { say: scriptedFallback, usedLLM: false, ms: Date.now() - started, provider: provider.name, reason: 'rejected', detail: 'safety-filter' };
      }
      const bad = taskViolations(task, clean.text, history);
      if (bad.length) {
        return { say: scriptedFallback, usedLLM: false, ms: Date.now() - started, provider: provider.name, reason: 'rejected', detail: bad.join(' · ') };
      }
      return { say: clean.text, usedLLM: true, ms: Date.now() - started, provider: provider.name, model: provider.model };
    } catch (e) {
      // fall through to the next provider — but remember why (429, ttft-budget, …)
      const full = String(e?.message || e);
      // client-visible events get only a coarse code ("llm-http-429", "ttft-budget"…);
      // the provider's full text (org ids, limits) stays in the server log
      lastError = full.split(' ')[0].slice(0, 40);
      logProviderError(provider, full);
    }
  }
  return { say: scriptedFallback, usedLLM: false, ms: Date.now() - started, reason: 'error', detail: lastError };
}
