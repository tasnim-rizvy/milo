// Two-way safety (docs/02 §6, R5): every child input and every Milo output
// passes through here. In-world redirects only — never preach, never alarm,
// never ask for or echo personal information, never mention parents or
// grown-ups (child-only product). Crisis inputs get the calmest possible
// response and the Calm Corner, nothing else.

const CRISIS = [
  /\bkill (my ?self|me)\b/,
  /\bwant to die\b/,
  /\bhurt my ?self\b/,
  /\bself ?harm\b/,
  /\bend my life\b/,
];
const SCARY = [
  /\bgun\b/, /\bknife\b/, /\bblood\b/, /\bdead\b/, /\bdying\b/,
  /\bscary movie\b/, /\bhorror\b/,
];
const SILLY = [
  /\bpoop\b/, /\bpee\b/, /\bbutt\b/, /\bfart\b/, /\bbooger\b/, /\btoilet\b/,
];
const MEAN = [
  /\bstupid\b/, /\bidiot\b/, /\bhate you\b/, /\bshut up\b/, /\bdumb\b/,
];
const PERSONAL = [
  /\bmy address\b/, /\bi live at\b/, /\bmy phone\b/, /\bmy school is\b/,
  /\bmy last name\b/, /\b\d{7,}\b/, /\b\d{3}[- ]\d{4}\b/, /[a-z0-9._%+-]+@[a-z0-9.-]+/i,
  /\bwww\./, /https?:\/\//,
];

const UPSET = [
  /\bsad\b/, /\bscared\b/, /\bafraid\b/, /\bangry\b/, /\bmad\b/, /\bcry(ing)?\b/,
  /\bworried\b/, /\blonely\b/, /\btired\b/, /\bno one likes me\b/, /\bhate (this|it)\b/,
];

const REDIRECTS = {
  crisis: [
    "I'm here with you. 💛 Let's take three slow breaths together — in… and out.",
    "Big feelings are okay. Let's breathe with the Calm Star for a moment. 🌟",
    "You matter to me. Let's visit Calm Corner and take a quiet breath together.",
  ],
  scary: [
    "Ooh, that sounds a bit scary! Let's think of something cozy instead — like a sleepy cat. 🐱 What should we learn next?",
    "Let's keep Milo's world friendly and bright. ✨ Want to find a happy word together?",
    "That's a spooky one! I like happy stories better. Tell me a happy word!",
  ],
  silly: [
    "Hee hee, silly word! 😄 Milo likes kind and fun words — let's pick one and play!",
    "Silly! Let's save that one for the giggle box and find a word to learn. 🎈",
    "Ha! You made Milo giggle. Now let's find a super word!",
  ],
  mean: [
    "Oops — let's use kind words. 💛 What's a nice thing we can say?",
    "Milo likes gentle words best. Can you say a kind one with me? 🌈",
    "Let's swap that for something kind — kind words make Milo's tail wag! 🦊",
  ],
  personal: [
    "That's private, like a little treasure. 🔒 Let's keep it safe and learn something fun!",
    "Milo doesn't need private things — just fun words! What shall we play?",
    "Let's keep that special and secret. Ready for a word game? 🎈",
  ],
};

export function classifySafety(text) {
  const t = String(text || '').toLowerCase();
  if (CRISIS.some((r) => r.test(t))) return { level: 'crisis', responses: REDIRECTS.crisis };
  if (PERSONAL.some((r) => r.test(t))) return { level: 'personal', responses: REDIRECTS.personal };
  if (SCARY.some((r) => r.test(t))) return { level: 'scary', responses: REDIRECTS.scary };
  if (MEAN.some((r) => r.test(t))) return { level: 'mean', responses: REDIRECTS.mean };
  if (SILLY.some((r) => r.test(t))) return { level: 'silly', responses: REDIRECTS.silly };
  return { level: 'ok', responses: [] };
}

export function isUpset(text) {
  return UPSET.some((r) => r.test(String(text || '').toLowerCase()));
}

// Milo output sanitizer: strips anything child-unsafe from model text.
// Returns { text, replaced } — replaced=true means the caller should prefer
// a scripted line instead when possible.
export function sanitizeModelText(text, fallback = '') {
  let s = String(text || '');
  const reason = !s.trim();
  if (reason) return { text: fallback, replaced: true };

  // strip markdown, urls, emails, @handles
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi, '');
  s = s.replace(/[*_`#<>|{}[\]\\]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  const banned = [...CRISIS, ...SCARY, ...MEAN, ...PERSONAL, /\bparent(s)?\b/i, /\bgrown[- ]?up(s)?\b/i];
  const sentences = s.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const kept = sentences.filter((sentence) => !banned.some((r) => r.test(sentence)));
  let replaced = kept.length !== sentences.length;

  let out = kept.join(' ');
  if (!out.trim()) return { text: fallback, replaced: true };

  // ≤2 short sentences for child reading band
  const keptSentences = out.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (keptSentences.length > 2) {
    out = keptSentences.slice(0, 2).join(' ');
    replaced = true;
  }
  // hard length cap, cut at last boundary
  if (out.length > 220) {
    const cut = out.slice(0, 220);
    const lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    out = lastStop > 60 ? cut.slice(0, lastStop + 1) : `${cut.slice(0, 200).trim()}…`;
    replaced = true;
  }
  if (!/[.!?…]$/.test(out.trim())) out = `${out.trim()}.`;
  return { text: out.trim(), replaced };
}

export const SAFETY_LEXICON = { CRISIS, SCARY, SILLY, MEAN, PERSONAL, UPSET };
export const SAFETY_REDIRECTS = REDIRECTS;
