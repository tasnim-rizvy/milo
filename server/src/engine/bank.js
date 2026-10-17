// Content bank (docs/03 §1): L1 first words · L2 little sentences · L3 little
// conversations. Data-only — the curriculum engine consumes these.
// Each item: { id, level, theme, text, answer, emoji, accepts[], aliases[], fx }
//   accepts  = phrase-level alternates ("mom" for "mama")
//   aliases  = matching aids (digits for numbers, phonetic spellings, etc.)
//   fx       = fun sound/anchor line for the model turn ("Quack quack!")

function w(level, theme, text, emoji, { accepts = [], aliases = [], fx = '' } = {}) {
  const slug = text.toLowerCase().replace(/\s+/g, '-');
  return {
    id: `l${level}-${theme}-${slug}`,
    level,
    theme,
    text,
    answer: text,
    emoji,
    accepts,
    aliases,
    fx,
  };
}

// ── L1 · First Words (~63 items) ────────────────────────────────────────────
export const L1 = [
  // greetings & manners (6)
  w(1, 'greetings', 'hi', '👋', { aliases: ['hey', 'heya', 'hy'] }),
  w(1, 'greetings', 'hello', '👋', { aliases: ['helo', 'hallo'] }),
  w(1, 'greetings', 'bye', '👋', { accepts: ['goodbye'], aliases: ['by', 'byebye'] }),
  w(1, 'greetings', 'please', '🙏', { aliases: ['pleas', 'pls'] }),
  w(1, 'greetings', 'thank you', '🙏', { accepts: ['thanks', 'thank u'], aliases: ['thanx'] }),
  w(1, 'greetings', 'good morning', '🌅', { accepts: ['morning'] }),

  // colors (10)
  w(1, 'colors', 'red', '🔴', { aliases: ['rad', 'redd'] }),
  w(1, 'colors', 'blue', '🔵', { aliases: ['blu', 'bleu'] }),
  w(1, 'colors', 'yellow', '🟡', { aliases: ['yello', 'yelow'] }),
  w(1, 'colors', 'green', '🟢', { aliases: ['gren', 'grean'] }),
  w(1, 'colors', 'orange', '🟠', { aliases: ['orenge'] }),
  w(1, 'colors', 'purple', '🟣', { aliases: ['purpel'] }),
  w(1, 'colors', 'pink', '🌸'),
  w(1, 'colors', 'black', '⚫', { aliases: ['blak'] }),
  w(1, 'colors', 'white', '⚪', { aliases: ['wite', 'whyte'] }),
  w(1, 'colors', 'brown', '🟤', { aliases: ['browne'] }),

  // numbers one–ten (10)
  w(1, 'numbers', 'one', '1️⃣', { accepts: ['1'] }),
  w(1, 'numbers', 'two', '2️⃣', { accepts: ['2'], aliases: ['too', 'to'] }),
  w(1, 'numbers', 'three', '3️⃣', { accepts: ['3'], aliases: ['tree', 'thre'] }),
  w(1, 'numbers', 'four', '4️⃣', { accepts: ['4'], aliases: ['for'] }),
  w(1, 'numbers', 'five', '5️⃣', { accepts: ['5'] }),
  w(1, 'numbers', 'six', '6️⃣', { accepts: ['6'] }),
  w(1, 'numbers', 'seven', '7️⃣', { accepts: ['7'] }),
  w(1, 'numbers', 'eight', '8️⃣', { accepts: ['8'], aliases: ['ate'] }),
  w(1, 'numbers', 'nine', '9️⃣', { accepts: ['9'] }),
  w(1, 'numbers', 'ten', '🔟', { accepts: ['10'] }),

  // animals (12)
  w(1, 'animals', 'cat', '🐱', { accepts: ['kitty'], fx: 'Meow!' }),
  w(1, 'animals', 'dog', '🐶', { accepts: ['puppy'], aliases: ['doggy'], fx: 'Woof woof!' }),
  w(1, 'animals', 'bird', '🐦', { aliases: ['brid'], fx: 'Tweet tweet!' }),
  w(1, 'animals', 'fish', '🐟', { fx: 'Blub blub!' }),
  w(1, 'animals', 'duck', '🦆', { fx: 'Quack quack!' }),
  w(1, 'animals', 'cow', '🐮', { fx: 'Moo!' }),
  w(1, 'animals', 'horse', '🐴', { aliases: ['hors'], fx: 'Neigh!' }),
  w(1, 'animals', 'monkey', '🐵', { fx: 'Ooh ooh ah ah!' }),
  w(1, 'animals', 'elephant', '🐘', { aliases: ['elefant'], fx: 'Toot toot!' }),
  w(1, 'animals', 'lion', '🦁', { fx: 'Roar!' }),
  w(1, 'animals', 'pig', '🐷', { fx: 'Oink oink!' }),
  w(1, 'animals', 'frog', '🐸', { fx: 'Ribbit!' }),

  // family (6)
  w(1, 'family', 'mama', '👩', { accepts: ['mom', 'mommy', 'mummy'] }),
  w(1, 'family', 'papa', '👨', { accepts: ['dad', 'daddy'] }),
  w(1, 'family', 'baby', '👶', { fx: 'Goo goo ga ga!' }),
  w(1, 'family', 'brother', '🧒'),
  w(1, 'family', 'sister', '👧'),
  w(1, 'family', 'grandma', '👵', { accepts: ['nana', 'granny'] }),

  // body (7)
  w(1, 'body', 'eyes', '👀', { accepts: ['eye'] }),
  w(1, 'body', 'nose', '👃'),
  w(1, 'body', 'mouth', '👄'),
  w(1, 'body', 'ears', '👂', { accepts: ['ear'] }),
  w(1, 'body', 'hands', '👐', { accepts: ['hand'] }),
  w(1, 'body', 'tummy', '🧍', { aliases: ['tumy', 'tommy'] }),
  w(1, 'body', 'feet', '🦶', { accepts: ['foot'] }),

  // size (4)
  w(1, 'size', 'big', '🐳', { accepts: ['large'], aliases: ['bigg'] }),
  w(1, 'size', 'small', '🐜', { accepts: ['little'], aliases: ['smal'] }),
  w(1, 'size', 'tall', '🦒', { accepts: ['high'], aliases: ['tal'] }),
  w(1, 'size', 'short', '🦔', { aliases: ['shor'] }),
];

// ── L2 · Little Sentences (~49 items + frames) ─────────────────────────────
export const L2 = [
  // feelings (7)
  w(2, 'feelings', 'happy', '😄', { aliases: ['hapee', 'hapy'] }),
  w(2, 'feelings', 'sad', '😢', { aliases: ['sadd'] }),
  w(2, 'feelings', 'angry', '😠', { accepts: ['mad'], aliases: ['angery'] }),
  w(2, 'feelings', 'tired', '😴', { accepts: ['sleepy'] }),
  w(2, 'feelings', 'hungry', '🍽️', { aliases: ['hungrey'] }),
  w(2, 'feelings', 'scared', '😨', { accepts: ['afraid'], aliases: ['scard'] }),
  w(2, 'feelings', 'excited', '🤩', { aliases: ['exsited'] }),

  // food & drink (8)
  w(2, 'food', 'apple', '🍎', { aliases: ['aple', 'appel'] }),
  w(2, 'food', 'banana', '🍌', { aliases: ['bannana', 'bananna'] }),
  w(2, 'food', 'milk', '🥛'),
  w(2, 'food', 'water', '💧', { aliases: ['wader', 'watter'] }),
  w(2, 'food', 'bread', '🍞', { aliases: ['bred'] }),
  w(2, 'food', 'rice', '🍚', { aliases: ['rise'] }),
  w(2, 'food', 'egg', '🥚', { aliases: ['eg'] }),
  w(2, 'food', 'juice', '🧃', { aliases: ['jus', 'juise'] }),

  // toys & play (6)
  w(2, 'toys', 'ball', '⚽', { aliases: ['bal', 'boll'] }),
  w(2, 'toys', 'car', '🚗', { aliases: ['kar'] }),
  w(2, 'toys', 'doll', '🪆', { aliases: ['dol'] }),
  w(2, 'toys', 'blocks', '🧱', { accepts: ['block', 'lego'] }),
  w(2, 'toys', 'teddy', '🧸', { accepts: ['teddy bear'] }),
  w(2, 'toys', 'balloon', '🎈', { aliases: ['baloon', 'ballon'] }),

  // action verbs (10)
  w(2, 'verbs', 'run', '🏃', { aliases: ['ran', 'runn'] }),
  w(2, 'verbs', 'jump', '🤸', { aliases: ['jamp', 'jupm'] }),
  w(2, 'verbs', 'eat', '🍽️', { aliases: ['ete', 'eet'] }),
  w(2, 'verbs', 'drink', '🥤', { aliases: ['dring', 'drinc'] }),
  w(2, 'verbs', 'sleep', '😴', { aliases: ['slep', 'sleeep'] }),
  w(2, 'verbs', 'dance', '💃', { aliases: ['dans'] }),
  w(2, 'verbs', 'clap', '👏', { aliases: ['clapp'] }),
  w(2, 'verbs', 'sit', '🪑', { aliases: ['sitt'] }),
  w(2, 'verbs', 'stand', '🧍', { aliases: ['stant'] }),
  w(2, 'verbs', 'wash', '🧼', { accepts: ['wash hands'], aliases: ['wosh'] }),

  // positions (3)
  w(2, 'positions', 'in', '📥', { aliases: ['inn'] }),
  w(2, 'positions', 'on', '📌', { aliases: ['onn'] }),
  w(2, 'positions', 'under', '🔽', { accepts: ['below'], aliases: ['unda'] }),

  // numbers eleven–twenty (10)
  w(2, 'numbers', 'eleven', '🔢', { accepts: ['11'] }),
  w(2, 'numbers', 'twelve', '🔢', { accepts: ['12'] }),
  w(2, 'numbers', 'thirteen', '🔢', { accepts: ['13'] }),
  w(2, 'numbers', 'fourteen', '🔢', { accepts: ['14'] }),
  w(2, 'numbers', 'fifteen', '🔢', { accepts: ['15'] }),
  w(2, 'numbers', 'sixteen', '🔢', { accepts: ['16'] }),
  w(2, 'numbers', 'seventeen', '🔢', { accepts: ['17'] }),
  w(2, 'numbers', 'eighteen', '🔢', { accepts: ['18'] }),
  w(2, 'numbers', 'nineteen', '🔢', { accepts: ['19'] }),
  w(2, 'numbers', 'twenty', '🔢', { accepts: ['20'] }),

  // weather (5)
  w(2, 'weather', 'sun', '☀️', { accepts: ['sunny'], aliases: ['son'] }),
  w(2, 'weather', 'rain', '🌧️', { accepts: ['rainy'], aliases: ['rane'] }),
  w(2, 'weather', 'hot', '🥵', { aliases: ['hott'] }),
  w(2, 'weather', 'cold', '🥶', { aliases: ['colt'] }),
  w(2, 'weather', 'windy', '🌬️', { accepts: ['wind'] }),
];

// ── L3 · Little Conversations (adjectives + routine + dialogue-first) ──────
export const L3 = [
  // describing (6)
  w(3, 'describing', 'fast', '🐆', { aliases: ['fst'] }),
  w(3, 'describing', 'slow', '🐢', { aliases: ['slw'] }),
  w(3, 'describing', 'clean', '✨', { aliases: ['clen'] }),
  w(3, 'describing', 'dirty', '🐖', { aliases: ['durt'] }),
  w(3, 'describing', 'funny', '🤣', { aliases: ['funy'] }),
  w(3, 'describing', 'beautiful', '🌺', { accepts: ['pretty'], aliases: ['beutiful'] }),

  // daily routine (8)
  w(3, 'routine', 'wake up', '🌅', { aliases: ['wakeup'] }),
  w(3, 'routine', 'brush teeth', '🪥', { accepts: ['brush my teeth'], aliases: ['brush teath'] }),
  w(3, 'routine', 'get dressed', '👕', { accepts: ['wear clothes'] }),
  w(3, 'routine', 'go to school', '🎒', { accepts: ['school'] }),
  w(3, 'routine', 'eat lunch', '🍽️', { accepts: ['lunch'] }),
  w(3, 'routine', 'play', '🎲', { aliases: ['plai'] }),
  w(3, 'routine', 'bath', '🛁', { accepts: ['take a bath', 'take a shower'] }),
  w(3, 'routine', 'sleep', '🌙', { accepts: ['go to sleep'], aliases: ['slep'] }),
];

export const BANK = { 1: L1, 2: L2, 3: L3 };

// ── Frames (docs/03 §1: L2 core frames, L3 likes/dislikes) ──────────────────
// template uses {x}; pool lists themes that fit the slot; phrase = accepted
// full-sentence shape example for hints/chips.
export const FRAMES = {
  2: [
    { id: 'f2-like', text: 'I like {x}', emoji: '❤️', pool: ['food', 'toys', 'animals'], phrase: 'I like {x}' },
    { id: 'f2-thisis', text: 'This is my {x}', emoji: '👉', pool: ['toys', 'family'], phrase: 'This is my {x}' },
    { id: 'f2-isee', text: 'I see a {x}', emoji: '👁️', pool: ['animals', 'food'], phrase: 'I see a {x}' },
    { id: 'f2-big', text: "It's a big {x}", emoji: '🐳', pool: ['animals', 'toys'], phrase: "It's a big {x}" },
    { id: 'f2-canihave', text: 'Can I have {x}?', emoji: '🙏', pool: ['food'], phrase: 'Can I have {x}?' },
    { id: 'f2-feel', text: 'I feel {x}', emoji: '💛', pool: ['feelings'], phrase: 'I feel {x}' },
    { id: 'f2-ican', text: 'I can {x}', emoji: '💪', pool: ['verbs'], phrase: 'I can {x}' },
  ],
  3: [
    { id: 'f3-like', text: 'I like {x}', emoji: '❤️', pool: ['describing', 'routine', 'food', 'toys', 'animals'], phrase: 'I like {x}' },
    { id: 'f3-dontlike', text: "I don't like {x}", emoji: '🙅', pool: ['food', 'routine', 'describing'], phrase: "I don't like {x}" },
    { id: 'f3-fav', text: 'My favorite is {x}', emoji: '⭐', pool: ['describing', 'food', 'toys', 'animals'], phrase: 'My favorite is {x}' },
  ],
};

// ── L3 mini-stories (docs/03 §1: 5 picture stories, retell with key lines) ─
export const STORIES = [
  {
    id: 'milo-lost-balloon',
    title: "Milo's Lost Balloon",
    emoji: '🎈',
    pages: [
      { text: 'Milo has a red balloon.', emoji: '🦊🎈' },
      { text: 'Oh no! The wind takes it up, up, up!', emoji: '🌬️' },
      { text: 'The duck sees it. It is in the tree!', emoji: '🦆🌳' },
      { text: 'Milo says thank you. What a good day!', emoji: '🦊💛' },
    ],
    retell: ['Milo has a balloon', 'The wind takes it', 'The duck helps', 'Milo says thank you'],
  },
  {
    id: 'animal-train',
    title: 'The Animal Train',
    emoji: '🚂',
    pages: [
      { text: 'The train goes choo choo!', emoji: '🚂' },
      { text: 'The cat gets on. Meow!', emoji: '🐱' },
      { text: 'The dog gets on. Woof!', emoji: '🐶' },
      { text: 'The duck is late. Run, duck, run!', emoji: '🦆' },
    ],
    retell: ['The train goes choo choo', 'The cat and dog get on', 'The duck runs', 'The duck is happy'],
  },
  {
    id: 'bath-time-ducks',
    title: 'Bath-Time Ducks',
    emoji: '🛁',
    pages: [
      { text: 'Splash! Splash! The bath is warm.', emoji: '💧' },
      { text: 'One duck. Two ducks. Three ducks!', emoji: '🦆🦆🦆' },
      { text: 'The ducks are clean and happy.', emoji: '✨' },
    ],
    retell: ['The bath is warm', 'Three ducks', 'The ducks are clean'],
  },
  {
    id: 'sleepy-cat',
    title: 'The Sleepy Cat',
    emoji: '😺',
    pages: [
      { text: 'The cat is sleepy.', emoji: '😴' },
      { text: 'It looks in the box.', emoji: '📦' },
      { text: 'It looks on the bed.', emoji: '🛏️' },
      { text: 'Shhh! The cat sleeps.', emoji: '💤' },
    ],
    retell: ['The cat is sleepy', 'It looks in the box', 'It looks on the bed', 'The cat sleeps'],
  },
  {
    id: 'big-red-ball',
    title: 'The Big Red Ball',
    emoji: '🔴',
    pages: [
      { text: 'Here is a big red ball.', emoji: '🔴' },
      { text: 'The ball goes up.', emoji: '⬆️' },
      { text: 'The ball goes down.', emoji: '⬇️' },
      { text: 'Run and get it!', emoji: '🏃' },
    ],
    retell: ['A big red ball', 'The ball goes up', 'The ball goes down', 'Run and get it'],
  },
];

// ── L3 role-play scenes (docs/03 §1: 5 mini-dialogues) ─────────────────────
export const SCENES = [
  {
    id: 'meet-friend',
    title: 'Meeting a Friend',
    emoji: '👋',
    beats: [
      { say: "Hi! I'm Milo. What's your name?", expect: { type: 'free' } },
      { say: 'Nice to meet you! How are you today?', expect: { type: 'free', hints: ['I am happy', 'I am sad', 'I am good'] } },
      { say: "I'm happy too! Let's play together!", expect: null },
    ],
  },
  {
    id: 'fruit-market',
    title: 'The Fruit Market',
    emoji: '🍎',
    beats: [
      { say: 'Welcome to the fruit market! What do you want?', expect: { type: 'free', words: ['apple', 'banana', 'want'], hints: ['I want an apple'] } },
      { say: 'Here you are! One yummy fruit.', expect: { type: 'free', words: ['thank', 'thanks'], hints: ['Thank you!'] } },
      { say: 'You have good manners! Bye bye!', expect: null },
    ],
  },
  {
    id: 'ask-help',
    title: 'Asking for Help',
    emoji: '🙏',
    beats: [
      { say: "Oops! Milo can't reach the ball. Can you help?", expect: { type: 'yesno', yes: ['yes', 'yeah', 'sure', 'ok'] } },
      { say: 'Yay! Say it with me: please help me!', expect: { type: 'free', words: ['please'], hints: ['Please help me'] } },
      { say: 'Thank you! High five! 🖐️', expect: null },
    ],
  },
  {
    id: 'share-toys',
    title: 'Sharing Toys',
    emoji: '🚗',
    beats: [
      { say: "That's a nice car! Can I play too?", expect: { type: 'yesno', yes: ['yes', 'yeah', 'sure', 'ok'], no: ['no'] } },
      { say: "Let's take turns. My turn… your turn! Your turn is my favorite turn.", expect: { type: 'free', words: ['my turn', 'your turn', 'turn'] } },
      { say: 'Sharing is super! Thank you!', expect: null },
    ],
  },
  {
    id: 'sorry-thanks',
    title: 'Sorry & Thank You',
    emoji: '💛',
    beats: [
      { say: 'Ooh! Milo bumped the blocks. Oops!', expect: null },
      { say: 'What can we say when we bump something?', expect: { type: 'free', words: ['sorry'], hints: ['I am sorry'] } },
      { say: "That's okay! And when someone helps us? … We say thank you!", expect: { type: 'free', words: ['thank'], hints: ['Thank you!'] } },
      { say: 'You are so kind! 💛', expect: null },
    ],
  },
];

// ── Stage check task kinds (docs/03 §2.2: 5 mixed tasks, ≥4 correct) ───────
export const STAGE_KINDS = ['tap-the-word', 'say-the-word', 'yes-no', 'count', 'frame'];

// ── Helpers ─────────────────────────────────────────────────────────────────
const BY_ID = new Map([...L1, ...L2, ...L3].map((i) => [i.id, i]));

export function itemById(id) {
  return BY_ID.get(id);
}

export function itemsOf(level) {
  return BANK[level] || [];
}

export function itemsOfTheme(level, theme) {
  return itemsOf(level).filter((i) => i.theme === theme);
}

export function themesOf(level) {
  return [...new Set(itemsOf(level).map((i) => i.theme))];
}

// Pick n same-theme distractors for chips (≥1 same-theme enforced by callers).
export function distractorsFor(item, n = 2, rng = Math.random) {
  const pool = itemsOf(item.level).filter((i) => i.id !== item.id);
  const same = pool.filter((i) => i.theme === item.theme);
  const others = pool.filter((i) => i.theme !== item.theme);
  const pick = [];
  const take = (arr) => {
    while (pick.length < n && arr.length) {
      const idx = Math.floor(rng() * arr.length);
      pick.push(arr.splice(idx, 1)[0]);
    }
  };
  take(same);
  take(others);
  return pick;
}
