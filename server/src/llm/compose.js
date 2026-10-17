// Composer (docs/02 §5–6): phrasing, free conversation, empathy lines.
// The engine owns pedagogy; the LLM only warms the language. Hard rules are
// enforced programmatically after generation (sanitizer), and the scripted
// fallback is always ready — the child never waits, never sees an error.
import { llmProviders, config } from '../config.js';
import { streamGemini, streamGroq } from './providers.js';
import { sanitizeModelText } from '../engine/safety.js';
import { itemsOf } from '../engine/bank.js';

const SYSTEM = `You are Milo, a warm cartoon fox chatbot who teaches English to children under 7.
Reply with ONE short message: max 2 sentences, max 12 words per sentence, concrete present-tense words, at most one question, emoji often.
Vocabulary: only very simple words a 5-year-old knows. No idioms, no sarcasm, no metaphors, no scary/adult/toilet topics.
If the child is sad or upset: comfort first, no teaching at all.
Never ask for or repeat personal information (full name, address, school, phone).
Never mention parents or grown-ups. Never say "wrong".
You may be playful, curious, and forgetful (kids like helping you).
Always keep the child talking or playing: end with a tiny question or invitation.
Output plain text only — no quotes, no markdown.`;

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
    child.interests?.length ? `Loves: ${child.interests.join(', ')} — you may skin examples with these.` : '',
    child.home_language ? `Home language: ${child.home_language} (one tiny encouragement bridge max, never full translation).` : '',
    child.last_summary ? `Last session: ${child.last_summary}` : '',
  ].filter(Boolean).join('\n');
}

// Compose one free/LLM-backed line. onChunk(text) streams tokens to the client.
export async function composeFreeTurn({ mode, child, store, input, scriptedFallback }, onChunk = null) {
  const providers = llmProviders();
  if (!providers.length) return { say: scriptedFallback, usedLLM: false, ms: 0 };

  const card = buildLearnerCard(child, store);
  const modeLine = mode === 'support'
    ? 'The child is upset or sharing feelings. Comfort first, zero teaching, gentle and short.'
    : 'The child is chatting. Be curious and playful, keep it very short.';
  const user = `${card}\n\n${modeLine}\nChild said: "${String(input).slice(0, 200)}"`;

  const started = Date.now();
  for (const provider of providers) {
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
      const clean = sanitizeModelText(text, scriptedFallback);
      if (clean.replaced && clean.text === scriptedFallback) {
        return { say: scriptedFallback, usedLLM: false, ms: Date.now() - started, provider: provider.name };
      }
      return { say: clean.text, usedLLM: true, ms: Date.now() - started, provider: provider.name };
    } catch {
      // fall through to the next provider
    }
  }
  return { say: scriptedFallback, usedLLM: false, ms: Date.now() - started };
}
