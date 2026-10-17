// Typo-tolerant answer matching (docs/03 §5).
// Children under 7 misspell constantly: "rad" must count for "red",
// "elefant" for "elephant", "abble" for "apple". Strategy:
//   normalize → exact → phonetic forms → Levenshtein within a length-scaled
//   budget (vowel-guarded on very short words) → singular/plural tolerance →
//   single-word-inside-sentence.

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cheap phonetic folding: ph→f, ck→k, qu→k, x→ks, doubled letters collapsed.
export function phonetic(s) {
  return normalize(s)
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/qu/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/([a-z])\1+/g, '$1');
}

export function levenshtein(a, b) {
  a = String(a);
  b = String(b);
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function budgetFor(len) {
  if (len <= 2) return 0;
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

// Short-word guard: insertions/deletions are always trusted within budget
// ("duk"→duck, "blu"→blue, "redd"→red). Same-length substitutions on ≤3-letter
// words must touch a vowel ("rad"→red ✓, "car" never counts for "cat").
// 4-letter+ substitutions are trusted within the length-scaled budget.
function shortWordEditOk(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen > 4) return true;
  if (Math.abs(a.length - b.length) === 1) return true;
  if (maxLen <= 3) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] !== b[i]) return VOWELS.has(a[i]) || VOWELS.has(b[i]);
    }
    return false;
  }
  return true;
}

function pluralTolerant(a, b) {
  return a === `${b}s` || b === `${a}s` || a === `${b}es` || b === `${a}es`;
}

// Match child input against one curriculum item.
// item: { answer, accepts?: string[], aliases?: string[] }
// Returns { ok, kind } where kind ∈ exact | alias | phonetic | fuzzy | plural |
//   word-in-sentence | null.
export function matchAnswer(input, item) {
  const raw = normalize(input);
  if (!raw) return { ok: false, kind: null };

  const explicit = [item.answer, ...(item.accepts || []), ...(item.aliases || [])]
    .filter(Boolean)
    .map((c) => ({ original: c, norm: normalize(c) }));

  // 1) exact / alias hit on the whole utterance
  for (const c of explicit) {
    if (c.norm === raw) return { ok: true, kind: 'exact' };
  }

  // 2) token forms — split input on commas/and too ("red, blue" → each word)
  const rawTokens = raw.split(/\s+|,/g).filter(Boolean);
  const phon = phonetic(raw);

  for (const c of explicit) {
    const cand = c.norm;
    const candPhon = phonetic(cand);
    // phonetic equality ("elefant" vs "elephant")
    if (cand.length >= 3 && phon === candPhon) return { ok: true, kind: 'phonetic' };
    // Levenshtein on raw and phonetic forms
    const dist = Math.min(levenshtein(raw, cand), levenshtein(phon, candPhon));
    const budget = budgetFor(Math.max(raw.length, cand.length));
    if (dist > 0 && dist <= budget && shortWordEditOk(raw, cand)) {
      return { ok: true, kind: 'fuzzy' };
    }
    // singular/plural: "apples" for "apple", "cat" for "cats"
    if (raw !== cand && pluralTolerant(raw, cand)) return { ok: true, kind: 'plural' };
    // single word inside a sentence: "it is a red ball" counts for "red".
    // Inside prose keep it strict — exact, or a near-hit (≤1 edit, raw or
    // phonetic). The full length-scaled budget would scrape random words out
    // of long sentences ("i have a big red ball at home" → "hello").
    if (!cand.includes(' ') && cand.length >= 3) {
      for (const t of rawTokens) {
        if (t === cand) return { ok: true, kind: 'word-in-sentence' };
        if (
          t.length >= 3 &&
          Math.min(levenshtein(t, cand), levenshtein(phonetic(t), candPhon)) <= 1 &&
          shortWordEditOk(t, cand)
        ) {
          return { ok: true, kind: 'word-in-sentence' };
        }
      }
    }
  }

  return { ok: false, kind: null };
}

// Convenience: does the input contain any of these tokens (dialogue parsing)?
export function containsAny(input, tokens) {
  const raw = normalize(input);
  return tokens.some((t) => raw.includes(normalize(t)));
}
