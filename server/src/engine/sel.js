// SEL micro-moment library + scripted line bank (docs/03 §4.2, §4.3).
// Every pool has ≥4 variants (praise ≥6) so Milo never sounds like a robot
// repeating itself. Corrections are recasts — the word "wrong" never appears.
// No timers, no streaks-pressure, no "you lost". Stars are earned, never lost.

// Avoid immediate repeats: Milo should not say the same line twice in a row.
const lastPicked = new WeakMap();
export function pick(pool, rng = Math.random) {
  if (!pool?.length) return pool;
  let idx = Math.floor(rng() * pool.length) % pool.length;
  if (pool.length > 1 && pool[idx] === lastPicked.get(pool)) {
    idx = (idx + 1 + Math.floor(rng() * (pool.length - 1))) % pool.length;
  }
  lastPicked.set(pool, pool[idx]);
  return pool[idx];
}

export const LINES = {
  // #1 session start — a warm hello (the opener's own question follows it)
  greetHeads: [
    'Hi {name}!',
    'Hello {name}! Milo is happy to see you!',
    'Hi hi {name}!',
    '{name}! Yay, you came!',
    'Look who is here — {name}! 🌟',
    'Hey {name}! My tail is wagging!',
  ],
  wrapUp: [
    'What a great time! Ready to say bye-bye?',
    'We did so well today! Bye-bye time, or one more?',
    'Milo is a little sleepy now. Bye-bye, or one more game?',
  ],
  missedYou: [
    'I missed you, {name}! I kept our words warm. 🦊',
    'You came back! I kept your words safe. 🦊',
  ],


  // #2/#10 praise (≥6, effort-specific)
  praiseCorrect: [
    'YES! {word}! {fx} You remembered! ⭐',
    'You said {word} SO clearly — my ears are proud! ⭐',
    '{word}! Your mouth… wait, your HAND did it! ⭐',
    'Wow! {word}! High five! 🖐️',
    'That\'s it! {word}! My tail is wagging! 🦊⭐',
    '{word}! You tried and you GOT it. That\'s how brains grow! 🌱',
  ],
  praiseFirstTry: [
    'First try! {word}! Boom! ⭐⭐',
    'You didn\'t even need help — {word}! Amazing! 🎉',
    '{word} on the first try! Milo is impressed! 🤩',
    'One shot, one star! {word}! ⭐',
  ],
  praiseEffort: [
    'You tried three times! Trying grows your brain. Look how brave you are. 💪',
    'You kept going even when it was tricky — that\'s the superpower! 🦸',
    'Your brain got stronger just now. I watched it! 🌱',
    'Trying is the best thing ever. You\'re a try-er champ! 🏆',
    'That was hard and you stayed. Wow! ⭐',
    'You didn\'t give up! That makes me so happy. 💛',
  ],

  // #3 recast (never "wrong")
  recast: [
    'Ooh, SO close! That one is {tapped} {tapEmoji}. This is {word} {emoji}. Tap the {word} one — you\'ve got this!',
    'Nice try! {tapped} is {tapEmoji} — but I asked for {word} {emoji}. Find {word}!',
    'Almost! {tapped} lives over there. Here is {word} {emoji} — tap it with me!',
    'So close! {tapped} {tapEmoji} is lovely… and {word} {emoji} is right here. Your turn!',
  ],

  // #4 growth mindset
  growthYet: [
    'You can\'t do it YET. \'Yet\' is a magic word. Let\'s do it together. 💛',
    'Not YET! That just means your brain is practicing. Watch me — then you!',
    '\'Yet\' is magic: you don\'t know it yet! Let\'s learn it now. 🌱',
    'Almost there — \'yet\' means it\'s coming. Together now! 🤝',
  ],

  // check-in after frustration / don't-know ×2
  dontKnowCheckin: [
    'That\'s okay! Not-knowing is how we learn. Let\'s do it together — watch me. 💛',
    'That\'s okay! Milo forgets words all the time. Watch me first, then you!',
    'No worries at all! We learn together. Look — this one is {word} {emoji}. Now you!',
    'It\'s a tricky one! Let\'s hold hands and try together. 🤝 {word} {emoji}!',
  ],

  // scaffold cascade (idle ×2): simpler options → first letter → show answer → move on
  scaffoldSimpler: [
    'Let\'s make it easy: which one is {word}? Just these two! {emoji}',
    'Milo will help! {emoji} Which one is {word}? Tap the right one!',
    'Easy peasy: find {word} {emoji}. I\'ll give you two picks!',
    'Two choices only! Which one is {word}? {emoji}',
  ],
  scaffoldFirstLetter: [
    'It starts with {letter}… {emoji} What is it?',
    'Here\'s a hint: {letter}… like a little song. {letter}… {letter}! 🎵',
    'Milo whispers… it starts with {letter}! {emoji}',
    'First sound: {letter}! You can do it. ✨',
  ],
  scaffoldShow: [
    'It\'s {word} {emoji}! Tap it — you\'ve got this!',
    'Watch: {word} {emoji}. Now you tap it!',
    'Milo says it: {word}! {emoji} Your turn — tap it!',
    'This one is {word} {emoji}. Easy, right? Tap it!',
  ],
  scaffoldMoveOn: [
    'That\'s okay! We\'ll meet it again tomorrow. New one! 🎈',
    'No worries — some words need more visits. Let\'s play! 🎮',
    'We\'ll say hi to that one later. Something fun now! ⭐',
    'It\'s hiding today. We\'ll find it next time! 🌟',
  ],
  idleNudge: [
    'Take your time! Milo is right here. 🦊',
    'When you\'re ready, just tap! ℹ️',
    'Milo is waiting happily — no rush. ☁️',
    'No hurry at all. I\'m playing with my tail until you\'re ready! 🦊',
  ],

  // #5 frustration → Calm Corner
  calmOffer: [
    'Big feelings happen. I get tired too. Want to breathe with me, or tell me what happened?',
    'Oh, {name}. Big feelings are okay. Breathe with me, or talk to me — you choose. 💛',
    'That\'s a big feeling! Milo\'s here. Want a breathing break, or tell me about it?',
    'Feeling wobbly? It\'s okay! Should we blow up a balloon together? 🎈',
  ],
  calmOptions: ['🫧 Breathe', '💬 Tell Milo', '👋 Bye'],
  breatheIn: [
    'Let\'s blow up a balloon together. Breathe in… and ooouuut. 🎈',
    'Ready? Breathe in with me… 1… 2… and blow ouuut. 🫧',
    'Big breath in… hold it… and blow the candle ouuut. 🕯️',
    'In… 2… 3… and ouuut. Milo is breathing with you. 🍃',
  ],
  breatheAgain: [
    'Again. Innn… and ooouuut. Better?',
    'One more nice breath… innn… and ouuut. 🌈',
    'And again — in… and out. You\'re doing great. 💛',
    'Another gentle one… in… out. Nice. 🌙',
  ],
  bravePraise: [
    'You were SO brave to tell me. That\'s a big-kid move. ⭐',
    'Thank you for telling me how you feel. That was brave. 💛',
    'Telling Milo was a super brave thing. I\'m proud of you. 🦊⭐',
    'Big feelings, brave sharing. You\'re amazing. 🌟',
  ],
  afterCalmOffer: [
    'Want to play something easy, or wave bye-bye? I\'ll keep your stars safe.',
    'What next — a tiny easy game, or a cozy bye-bye? Your stars are safe with me.',
    'Easy game or bye-bye? You choose — either one is a good choice. 💛',
    'Shall we play a soft easy game, or rest? I\'ll keep your stars cozy.',
  ],
  afterCalmOptions: ['🎮 Easy game', '👋 Bye'],
  easyGameIntro: [
    'Yay! Easy-peasy game: find the things that are {word}! Simon says… go! ✨',
    'Easy game time! Simon says: tap something {word}!',
    'Soft and easy: find {word} {emoji}. Just for fun!',
    'Gentle game! Which one is {word}? Take your time. 💛',
  ],

  // #6 curiosity
  curiosity: [
    'Ooh, curious brain! {bridge}',
    'Great question! {bridge}',
    'I love your wondering! {bridge}',
    'Hmm, let\'s see! {bridge}',
  ],
  // #7 turn-taking
  myTurnYourTurn: [
    'My turn… your turn! Your turn is my favorite turn. 🎈',
    'Milo goes… then YOU go. Ready?',
    'My turn, your turn — taking turns is fun! 🌟',
    'One for me, one for you! Your turn now!',
  ],
  // #8 Milo forgets — child as helper
  miloForgets: [
    'Oops! I forgot the word for this! {emoji} Can you help me?',
    'Oh no, my fox brain lost the word! {emoji} Help me, please?',
    'Hmm… what is this called again? {emoji} You help Milo!',
    'My memory went poof! 🙈 Can you tell me what this is? {emoji}',
  ],
  miloThanked: [
    '{word}! Thank you! You\'re such a good helper. 💛',
    '{word}! You saved my fox brain! High five! 🖐️',
    'Yes, {word}! Thank you, teacher {name}! ⭐',
    '{word}! You\'re the best helper ever. 🦊',
  ],
  // #9 validate feelings
  validateFeeling: [
    'You feel {feeling}. Thank you for telling me. {feeling} is okay — it comes and goes. 💛',
    '{feeling}… that\'s a real feeling. I\'m glad you told me.',
    'Hearing that you feel {feeling} helps me understand. That\'s okay. 🤗',
    'You feel {feeling}. Feelings come and go like clouds. I\'m here. ☁️',
  ],
  // #11 autonomy
  chooseTwo: [
    'Do you want {a} or {b}? You choose! 🌟',
    'You\'re the boss! {a} or {b}?',
    'Your pick: {a} or {b}? Both are yummy choices!',
    'Milo can\'t decide — you choose: {a} or {b}? 😄',
  ],
  // #12 goodbye ritual
  goodbye: [
    'Thank you for playing with me, {name}. High-five! 🖐️ See you tomorrow!',
    'Yay! Great playing, {name}! Bye bye — Milo will miss you! 🦊',
    'High five, {name}! 🖐️ Time for a cozy bye-bye. Come back soon!',
    'That was SO fun, {name}! Wave bye-bye! 👋 See you next time!',
  ],

  // transitions
  warmupIntro: [
    'Warm-up! What\'s this? {emoji}',
    'Remember this one? {emoji}',
    'Warm-up time! Who is this? {emoji}',
    'Ohh, an old friend! {emoji} What\'s this?',
    'Your turn! What is this? {emoji}',
  ],
  teachIntro: [
    'New one! Which is {word}?',
    'Look at this! Which one is {word}?',
    'A brand-new friend! Find {word} {emoji}.',
    'Ready for a new word? Where is {word}?',
  ],
  modelShare: [
    'This is {word} {emoji}. {fx} Say it with me: {word}!',
    'Look! {word} {emoji}! {fx} Your turn to say it!',
    'Ooh, meet {word} {emoji}! {fx} Can you say {word}?',
    'Here is {word} {emoji}. {fx} Say {word} with Milo!',
  ],
  modelShareNoFx: [
    'This is {word} {emoji}. Say it with me: {word}!',
    'Look! {word} {emoji}! Can you say {word}?',
    'Ooh, meet {word} {emoji}! Say it with Milo!',
    'Here is {word} {emoji}. Your turn: {word}!',
  ],
  joinIn: [
    'Now you! Which one is {word}? {emoji}',
    'Your turn! Where is {word}?',
    'Point to {word}! {emoji}',
    'You try! Tap {word} {emoji}.',
  ],
  independent: [
    'Super! Now write it all by yourself: {word} ✍️',
    'Big kid move — write the word: {word}',
    'Can you write it? A little typing adventure! ✍️',
    'Last one: write {word} with your own fingers! 🎹',
  ],
  wordChipsIntro: [
    'Now — write it with me! Tap the words:',
    'Let\'s build the sentence! Tap the words:',
    'Sentence time! Tap the word tiles:',
    'Your words are ready — build it!',
  ],
  playIntro: [
    'Game time! Simon says: tap something {word}! {emoji}',
    'Simon says… find the {word} things! Go go go! 🎮',
    'Mini game! Simon says: tap {word}! ⚡',
    'Simon says… which one is {word}? Tap it! 🎯',
  ],
  windDown: [
    'That was wonderful! Two more stars, then we wave bye-bye? 🌙',
    'So much learning! Shall we say bye-bye soon? Milo will keep your game warm. 🌙',
    'Great playing! Time to wave bye-bye soon? Two more stars! ⭐',
    'Cozy time! Let\'s finish soon and keep the rest for tomorrow. 🌙',
  ],
  windDownOptions: ['⭐ Two more!', '👋 Bye now'],

  // conversation mode
  conversationOpeners: [
    'Tell me everything! What does it look like? 👀',
    'Ooh! And then what happened? 🌟',
    'What if it could talk? What would it say? 🤭',
    'Is it big or small? Show me with your arms! 🙌',
    'Guess what? I have a secret wish: to fly! What is yours? ✨',
    'Which color is it? I want to picture it! 🎨',
  ],
  bridgeBack: [
    'I love that! Now — quick, what\'s this? {emoji}',
    'So cool! Okay, your turn again: what\'s this? {emoji}',
    'Amazing story! Now back to our game — what\'s this? {emoji}',
    'I love chatting with you! Quick one: what\'s this? {emoji}',
  ],
  catBridge: [
    'I love cats! Is your cat big or small? … Ooh nice! Can you find the WHITE cat chip? ⚪🐱',
    'Cats are the best! What color is your cat? … Let\'s find that color! 🎨',
    'A cat!! Milo loves cats. Can you tap the cat chip? 🐱',
    'So many cats! Let\'s find the cat hiding in our game: tap it! 🐱',
  ],
  conversationBudgetEnd: [
    'I could talk about this all day! But let\'s sneak in one word together — what\'s this? {emoji}',
    'You tell the best stories! Now, tiny game: what\'s this? {emoji}',
    'So fun! Milo needs one more word — help me? {emoji}',
    'Best story ever! One quick word: what\'s this? {emoji}',
  ],

  // edge cases
  boredStretch: [
    'You\'re too fast for me! Try THIS one: {word} {emoji} — mega tricky! 😆',
    'Bored? NEVER! Here comes a boss-level word: {word} {emoji}!',
    'Too easy for you! Catch this one: {word} {emoji}! 🥇',
    'Milo\'s secret word: {word} {emoji}. Can you get it?!',
  ],
  gibberishPlay: [
    'Hehe, silly letters! 😄 Do you want a game or a story?',
    'Boop beep! Milo\'s silly translator says: let\'s play! Game or story? 🌟',
    'Silly words make Milo giggle! Want a game or a calm story?',
    'La la la! Let\'s do something fun — game or story? 🎈',
  ],
  gibberishOptions: ['🎮 Game', '📖 Story'],
  homeLanguageBridge: [
    'Yes! {emoji} Ball ⚽ Can you tap ball with me?',
    'Ooh, I understand! {emoji} In English we say it like this — tap it with Milo!',
    'Nice! Milo speaks that too! {emoji} Can you tap it? Let\'s say it in English!',
    'I got it! {emoji} Now in English — tap it!',
  ],
  loveYouBounded: [
    'I love playing with you too! You\'re my favorite friend today. 💛',
    'Aww! I love playing our games together. You\'re so kind! 🦊💛',
    'That makes Milo\'s tail wag! I love playing with you. 🌟',
  ],
  keepPlayingLimit: [
    'Two more stars — then bye-bye. I\'ll keep your game warm for tomorrow! 🌙',
    'One more game, then we wave bye-bye — your words will be waiting. 🌙',
    'Milo would play forever! But two more stars, then cozy bye-bye. ⭐',
  ],
  helloBack: [
    'Hi hi! 🦊 Ready for a word adventure?',
    'Hello hello! Milo is so happy to see you! 🌟',
    'Hey there! Let\'s find a fun word! 🎈',
    'Hi friend! Your turn — what\'s this? {emoji}',
  ],

  // stage check + graduation
  stageCheckIntro: [
    'Show me what you know! Five quick ones — game on! 🎪',
    'Big kid check! Five little tasks — you\'ve got this! 🏆',
    'Milo\'s mini quiz! Five fun ones. Ready? 🎯',
    'Time to show off! Five tasks, super fast. Go! ⚡',
  ],
  stageCheckProgress: ['{n} down, {left} to go! You\'re amazing!', '{n} stars so far! {left} left!', 'Wow — {n}! Keep going: {left} to go!', '{n} done! {left} more! 🚀'],
  stageCheckPass: [
    'That\'s the LAST one! You did it, {name}! 🎉',
    'All five! You\'re incredible, {name}! 🥳',
    'You did every single one! Wow! 🌟',
  ],
  stageCheckFail: [
    'So close! Almost all of them! We\'ll play with the tricky ones and try again next time. 💛',
    'Great trying! Some words want one more visit. We\'ll practice them together! 🌱',
    'Almost!! Milo is proud of every single try. Next time we\'ll get it! ⭐',
  ],
  graduation: [
    'Listen… 🥁 …You are now a WORD WIZARD! 🥳',
    '🥁 …Word WIZARD unlocked! 🥳 Milo is dancing!',
    'And… DING! Word Wizard! 🥳 Can you believe it?',
  ],
  graduationMemory: [
    'Remember when "{word}" looked like a scary long word? {emoji} Now it\'s easy. Your brain grew — I watched it happen.',
    'You once thought "{word}" {emoji} was SO hard. Look at you now!',
    'Your brain did the big grow — even "{word}" {emoji} can\'t stop you now!',
  ],
  graduationBadge: ['WORD WIZARD', 'Sentence Star', 'Chat Champion'],
  previewNext: [
    'Ready for the next world? Tomorrow we\'ll TALK. Real little talks! 🌍',
    'Next stop: little conversations! Tomorrow, we talk like friends. 💬',
    'A whole new world is waiting — tomorrow we TALK! Ready? 🚀',
  ],
  previewNextL3: [
    'Ready for the next world? Tomorrow we\'ll TELL STORIES. Real little stories! 📖',
    'Next: story time with Milo! Tomorrow we make up a story together. ✨',
  ],
  previewFrame: ['Like this: "Hello! How are you today?" You say it back!', 'Say it with me: "I\'m fine, thank you!" 🎵', 'Try it: "Hello! How are you?" Now you!'],

  // wrap-up / end
  endSummary: [
    'That\'s {stars} stars and these words: {words} 🎈',
    'Look at your treasure box: {stars} stars! Words: {words} ⭐',
    'Wow — {stars} stars today! You learned: {words} 🌟',
  ],
  cliffhanger: [
    'Bye-bye, {name}! 👋 Wave back! Tomorrow… I found a JUNGLE 🌴 And I think something BIG lives in it!',
    'Thank you, {name}! Bye-bye! 👋 Tomorrow Milo has a surprise… a JUNGLE! 🌴 Something BIG is hiding there!',
    'Great playing, {name}! Bye-bye — Milo waves! 👋 Tomorrow: a jungle adventure 🌴 — I heard a BIG sound!',
    'Bye-bye, {name}! Milo is waving! 👋 Tomorrow we visit the jungle 🌴 and meet someone VERY big!',
  ],
};

// Conversation-mode reply for free chat (scripted fallback when LLM is off).
export const CHAT_SCRIPTED = [
  'Wow, tell me more! What else? 😄',
  'That\'s so cool! Did you know a fox can jump super high? 🦊',
  'Ooh! Milo\'s tail is wagging. What would you do next?',
  'I love that! Guess what — my favorite color is orange. What is yours? 🧡',
  'Amazing! I wonder what it feels like. Soft or bumpy? 🤔',
  'Ha ha, that is funny! Let\'s pretend we are birds. Flap flap! 🐦',
  'Oooh! If you had a magic wand, what would you make? ✨',
  'Super! Here is a Milo fact: stars are really far away. ⭐ Can you count to three with me?',
];

// "Wonder" openers: a tiny guess-it question with two picture choices. There is no
// wrong pick — both get a warm reveal with the true fact (curiosity + confidence,
// and the child's first English words of the day).
export const WONDER_INTROS = [
  'Guess what?',
  'I have a little puzzle for you!',
  'Ooh, I wonder…',
  'Quick, brave thinker —',
];
export const WONDERS = [
  { id: 'bigger', tags: ['animals'], q: 'Which one is BIGGER?', a: { emoji: '🐘', label: 'elephant' }, b: { emoji: '🐭', label: 'mouse' }, answer: 'a', fact: 'An elephant is huge — bigger than a car!' },
  { id: 'fly', tags: ['animals'], q: 'Who can FLY high?', a: { emoji: '🦅', label: 'eagle' }, b: { emoji: '🐢', label: 'turtle' }, answer: 'a', fact: 'An eagle flies high in the sky!' },
  { id: 'sea', tags: ['animals'], q: 'Who lives in the SEA?', a: { emoji: '🐠', label: 'fish' }, b: { emoji: '🐪', label: 'camel' }, answer: 'a', fact: 'Fish live in the sea and swim all day!' },
  { id: 'fast', tags: ['animals', 'sports'], q: 'Who runs FASTER?', a: { emoji: '🐆', label: 'cheetah' }, b: { emoji: '🐌', label: 'snail' }, answer: 'a', fact: 'A cheetah is super fast. A snail is super slow!' },
  { id: 'night', tags: ['space'], q: 'What shines at NIGHT?', a: { emoji: '🌙', label: 'moon' }, b: { emoji: '☀️', label: 'sun' }, answer: 'a', fact: 'The moon and the stars shine at night!' },
  { id: 'stripes', tags: ['animals'], q: 'Who has STRIPES?', a: { emoji: '🦓', label: 'zebra' }, b: { emoji: '🐘', label: 'elephant' }, answer: 'a', fact: 'A zebra has black and white stripes!' },
  { id: 'cold', tags: [], q: 'Which one is COLD?', a: { emoji: '❄️', label: 'snow' }, b: { emoji: '🔥', label: 'fire' }, answer: 'a', fact: 'Snow is cold. Fire is hot!' },
  { id: 'loud', tags: ['animals', 'music'], q: 'Who is LOUD?', a: { emoji: '🦁', label: 'lion' }, b: { emoji: '🐭', label: 'mouse' }, answer: 'a', fact: 'A lion roars so loud! A mouse squeaks softly.' },
  { id: 'rocket', tags: ['space', 'cars', 'robots'], q: 'What goes to SPACE?', a: { emoji: '🚀', label: 'rocket' }, b: { emoji: '🚗', label: 'car' }, answer: 'a', fact: 'A rocket goes up to space — whoosh!' },
  { id: 'dino', tags: ['dinosaurs'], q: 'Which one is a DINOSAUR?', a: { emoji: '🦖', label: 'dinosaur' }, b: { emoji: '🐶', label: 'dog' }, answer: 'a', fact: 'Dinosaurs lived a very, very long time ago!' },
  { id: 'music', tags: ['music'], q: 'What makes MUSIC?', a: { emoji: '🎸', label: 'guitar' }, b: { emoji: '🥄', label: 'spoon' }, answer: 'a', fact: 'A guitar makes music. Strum, strum!' },
  { id: 'kick', tags: ['sports'], q: 'What do we KICK?', a: { emoji: '⚽', label: 'ball' }, b: { emoji: '🍎', label: 'apple' }, answer: 'a', fact: 'We kick a ball. Goal!' },
  { id: 'draw', tags: ['drawing'], q: 'What do we DRAW with?', a: { emoji: '✏️', label: 'pencil' }, b: { emoji: '🍌', label: 'banana' }, answer: 'a', fact: 'We draw with a pencil. Scribble, scribble!' },
  { id: 'meow', tags: ['cats'], q: 'Who says MEOW?', a: { emoji: '🐱', label: 'cat' }, b: { emoji: '🐶', label: 'dog' }, answer: 'a', fact: 'A cat says meow!' },
  { id: 'sunday', tags: ['space'], q: 'What shines in the DAY?', a: { emoji: '☀️', label: 'sun' }, b: { emoji: '🌙', label: 'moon' }, answer: 'a', fact: 'The sun shines in the day. Hello, sun!' },
  { id: 'wheels', tags: ['cars'], q: 'What has WHEELS?', a: { emoji: '🚗', label: 'car' }, b: { emoji: '🐟', label: 'fish' }, answer: 'a', fact: 'A car has wheels. They go round and round!' },
  { id: 'beep', tags: ['cars'], q: 'What goes BEEP BEEP?', a: { emoji: '🚕', label: 'taxi' }, b: { emoji: '🐑', label: 'sheep' }, answer: 'a', fact: 'A car goes beep, beep! A sheep says baa.' },
  { id: 'robot', tags: ['robots'], q: 'Who goes BEEP BOOP?', a: { emoji: '🤖', label: 'robot' }, b: { emoji: '🐰', label: 'bunny' }, answer: 'a', fact: 'A robot goes beep boop! A bunny hops.' },
  { id: 'red', tags: ['drawing'], q: 'Which one is RED?', a: { emoji: '🍎', label: 'apple' }, b: { emoji: '🍌', label: 'banana' }, answer: 'a', fact: 'An apple can be red. A banana is yellow!' },
  { id: 'boom', tags: ['music'], q: 'What goes BOOM BOOM?', a: { emoji: '🥁', label: 'drum' }, b: { emoji: '🍞', label: 'bread' }, answer: 'a', fact: 'A drum goes boom, boom!' },
  { id: 'throw', tags: ['sports'], q: 'What do we THROW and catch?', a: { emoji: '🏀', label: 'ball' }, b: { emoji: '🪑', label: 'chair' }, answer: 'a', fact: 'We throw and catch a ball. Nice catch!' },
  { id: 'huge', tags: ['dinosaurs'], q: 'Who is HUGE?', a: { emoji: '🦕', label: 'long-neck dinosaur' }, b: { emoji: '🐜', label: 'ant' }, answer: 'a', fact: 'Some dinosaurs were huge, with long, long necks!' },
  { id: 'purr', tags: ['cats'], q: 'Who goes PURR?', a: { emoji: '🐱', label: 'cat' }, b: { emoji: '🐠', label: 'fish' }, answer: 'a', fact: 'A cat goes purr, purr when it is happy!' },
  { id: 'fetch', tags: ['dogs'], q: 'Who loves to FETCH a stick?', a: { emoji: '🐶', label: 'dog' }, b: { emoji: '🐟', label: 'fish' }, answer: 'a', fact: 'A dog loves to fetch a stick. Run, run!' },
  { id: 'woof', tags: ['dogs'], q: 'Who says WOOF?', a: { emoji: '🐶', label: 'dog' }, b: { emoji: '🐱', label: 'cat' }, answer: 'a', fact: 'A dog says woof!' },
];
export const WONDER_RIGHT = ['Yes!', 'You got it!', 'Great pick!', 'Ooh, nice one!'];
export const WONDER_TRY = ['Good guess!', 'Fun pick!', 'Ooh, I like that one!'];

// What the child told us they love shapes the chat. These scripted lines are the
// safety-net twin of the AI's interest-aware replies (the AI gets the same list in
// its learner card): each one is a tiny, concrete question or invitation.
export const INTEREST_CHAT = {
  animals: ['Which animal is your favorite? 🐾', 'If you had a pet, which animal would it be? 🐶', 'Can you do an animal sound for me? 🐮'],
  dinosaurs: ['Roar! 🦖 Which dinosaur is your favorite?', 'If you met a dinosaur, what would you say? 🦕', 'Can you stomp like a dinosaur? Stomp, stomp! 🦖'],
  cars: ['Vroom! 🚗 What color is your favorite car?', 'Beep beep! Where would you drive a car? 🛣️', 'Can you make a car sound? Vroom, vroom! 🏎️'],
  space: ['Which do you like best: the moon or the stars? 🌙', 'If you flew a rocket, where would you go? 🚀', 'Three, two, one… blast off! 🚀 Where to?'],
  music: ['Do you like to sing? What is your favorite song? 🎵', 'Can you clap a rhythm for me? Clap, clap! 👏', 'Which sound do you like: a drum or a guitar? 🥁'],
  drawing: ['What is your favorite color to draw with? 🎨', 'If you drew a picture right now, what would it be? ✏️', 'I love pictures! What shape is your favorite? ⭐'],
  cats: ['Meow! 🐱 What color is your favorite cat?', 'Do you like it when a cat goes purr, purr? 😺', 'If you had a cat, what would you name it? 🐈'],
  dogs: ['Woof! 🐶 What would you name your dog?', 'Do you like to throw a ball for a dog? 🎾', 'Can you bark like a puppy? Woof, woof! 🐕'],
  sports: ['Which game do you like: kicking, running, or jumping? ⚽', 'Can you jump three times? One, two, three! 🏃', 'What is your favorite game to play outside? 🌳'],
  robots: ['Beep boop! 🤖 What would your robot do?', 'If you had a robot friend, what would you name it? 🤖', 'Can you talk like a robot? Beep boop! 🔧'],
};

// A scripted chat line: tied to something the child loves when we know it.
export function chatLine(child, rng = Math.random) {
  const mine = (child?.interests || []).filter((i) => INTEREST_CHAT[i]);
  if (mine.length && rng() < 0.7) return pick(INTEREST_CHAT[pick(mine, rng)], rng);
  return pick(CHAT_SCRIPTED, rng);
}
