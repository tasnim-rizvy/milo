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
  // #1 session start — mood check-in
  greetWithCheckin: [
    'Hi {name}! How do you feel today? 🦊',
    'Hello {name}! Milo is happy to see you! How do you feel? 💛',
    'Hi hi {name}! Before we play — how do you feel today? 🌟',
    '{name}! Yay, you came! How do you feel right now? 🎈',
  ],
  moodOptions: ['😊 happy', '😴 sleepy', '😢 a little sad'],

  moodMirrorHappy: [
    'Happy! Me too — my tail is wagging. High five! 🖐️',
    'Yay, happy! Milo does a little dance! 💃 Let\'s learn!',
    'Happy happy! That\'s my favorite feeling. Let\'s go! ⭐',
    'Big happy! I can feel it from here. Off we go! 🎈',
  ],
  moodMirrorTired: [
    'Sleepy… that\'s okay. We\'ll go slow and cozy. 🛏️',
    'Tired is okay, {name}. Let\'s do easy games today. 🧸',
    'Sleepy head! Milo will keep it gentle. 🌙',
    'A sleepy day! Snuggle in — we\'ll take it easy. 🐢',
  ],
  moodMirrorSad: [
    'Oh, a little sad. Thank you for telling me. Sad is okay — it comes and goes. 💛',
    'A little sad… I\'m here with you. Want a quiet minute or a happy game? 🤗',
    'Sad feelings are big. You were brave to say it. I\'ll stay with you. 💛',
    'That\'s okay, {name}. Let\'s be gentle today. I\'m right here. 🦊',
  ],
  moodAmplify: [
    'So happy! Me too! 🌈',
    'Yay! Let\'s make today sparkle. ✨',
    'Wonderful! High five! 🖐️',
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
    'I want to know more! What else? 😄',
    'Ooh! And then what happened? 🌟',
    'Wow! Tell me one more thing about it!',
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
  moodEnd: [
    'One last thing — how do you feel now?',
    'Before bye-bye: how do you feel now?',
    'Quick check! How do you feel right now?',
  ],
};

// Conversation-mode reply for free chat (scripted fallback when LLM is off).
export const CHAT_SCRIPTED = [
  'Wow, tell me more! What else? 😄',
  'That\'s so cool! I love it. What happened next?',
  'Ooh! Milo\'s tail is wagging. Tell me one more thing!',
  'Amazing! I could listen all day. What else can you tell me?',
];
