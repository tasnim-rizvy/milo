# 03 · Learning Design: Curriculum, Progression, Modes & SEL

*The pedagogy and the "brain" of the bot: what it teaches, when it advances, how it reads the child, and how it cares.*

---

## 1. Curriculum map — L1 → L2 → L3

Designed for the Pre-A1 → A1 span of the CEFR, expressed as **single words → sentence frames → little conversations**.

| | **L1 · First Words** | **L2 · Little Sentences** | **L3 · Little Conversations** |
|---|---|---|---|
| Child outcome | Understands & says ~60–80 core words; answers with 1–2 words | Builds 3–5 word sentences from frames | Holds 3–4 turn mini-dialogues; retells a 3-page story with pictures |
| Input style | Word + picture + sound ("A duck! Quack quack!") | Frame + fill-in ("I like ___") | Full short sentences, questions, story rhythm |
| Output expected | Choose the right picture chip; type the word (5–6s, optional) | Complete a frame; short typed answers | Answer open who/what/where; ask simple questions |
| Stage check | 5 mixed tasks, ≥4 correct | 5 mixed tasks, ≥4 correct | 5 mixed tasks, ≥4 correct |

### L1 content bank (~70 items)

| Theme | Sample items | Target count |
|---|---|---|
| Greetings & manners | hi, bye, please, thank you, hello | 6 |
| Colors | red, blue, yellow, green, orange, purple, pink, black, white | 10 |
| Numbers | one … ten (+ "how many?" counting games) | 10 |
| Animals | cat, dog, bird, fish, duck, cow, horse, monkey, elephant, lion | 12 |
| Family | mama, papa, baby, brother, sister, grandma | 6 |
| Body | eyes, nose, mouth, ears, hands, tummy, feet | 7 |
| Size words | big, small | 2 |
| Yes/No + question response | "Is it a cat?" → "Yes! / No, it's a dog." | pattern |

### L2 content bank (~60 items + ~40 frames)

| Theme | Sample items / frames | Target |
|---|---|---|
| Feelings | happy, sad, angry, tired, hungry, scared, excited | 7 words + "I feel ___" |
| Food & drink | apple, banana, milk, water, bread, rice, egg | 8 |
| Toys & play | ball, car, doll, blocks, teddy, balloon | 6 |
| Action verbs | run, jump, eat, drink, sleep, dance, clap, sit, stand, wash | 10 + "I can ___" |
| Positions | in, on, under | 3 + "Where is it? It's on/in/under ___" |
| Numbers | eleven … twenty (counting games) | 10 |
| Weather | sun, rain, hot, cold, windy | 5 |
| Core frames | "I like ___", "This is my ___", "I see a ___", "It's a big ___", "Can I have ___?" | 5+ |

### L3 content bank (dialogue-first)

| Scene / skill | Contents | Target |
|---|---|---|
| Daily routine | wake up, brush teeth, get dressed, go to school, eat lunch, play, bath, sleep | 8 + "First we ___, then we ___" |
| Story time | 5 original picture mini-stories with repeated patterns (e.g., *Milo's Lost Balloon*, *The Animal Train*, *Bath-Time Ducks*) | retell with 3–4 key sentences |
| Describing | fast, slow, clean, dirty, happy face, funny | 6 adjectives + "The ___ is very ___" |
| Likes / dislikes | "I like ___", "I don't like ___", "My favorite is ___" | 3 frames |
| Question skills | What? Where? Who? Whose? — child both answers *and* asks | 4 forms |
| Mini-dialogues | meeting a friend · buying fruit at the market · asking for help · sharing toys · saying sorry & thank you | 5 role-play scenes |
| Grammar in use | plurals (cat → cats), present progressive (running), one/two | pattern-level, no terminology |

---

## 2. Mastery & progression rules

### 2.1 Per-item tracking — Leitner spaced repetition (5 boxes)

| Box | Meaning | On correct answer | On wrong answer | Next due |
|---|---|---|---|---|
| 1 | Just introduced | → Box 2 | stays Box 1 | same session |
| 2 | Recognizes | → Box 3 | → Box 1 | next day |
| 3 | Says with help | → Box 4 | → Box 1 | in 3 days |
| 4 | Says alone | → Box 5 | → Box 2 | in 7 days |
| 5 | **Mastered** | stays Box 5 (refreshers) | → Box 3 | in 14 days |

"Correct" matching is **tolerant**: fuzzy string match + phonetic aliases + card-tap equivalence
(e.g., "abble" → apple 🎉). First-try accuracy is tracked separately from eventual success, so
scaffolded wins still count as *wins* for confidence, but only first-try accuracy counts for the level gate.

### 2.2 Level gate (L1→L2→L3)

All three must hold, across **at least 2 different days**:
1. **Mastery trend:** ≥80% first-try accuracy over the most recent 20 core items of the current level.
2. **Coverage:** ≥80% of the level's core items at Box ≥3.
3. **Stage check:** a 5-task mixed "Show me!" game — ≥4 correct.

Then: **graduation ceremony** (confetti, badge, "You are a Word Wizard!"), and Milo previews the
next level ("Tomorrow: we'll talk in little sentences!").
Hard rules: levels are **never demoted**, and there are no manual level jumps — the mastery gate is
the only way up, and fast learners naturally taste next-level "stretch items" sooner (§2.3).
On stage-check failure: keep
practicing the 10 weakest items, retry the check next session — framed as "almost! next time!"

### 2.3 Session composer (what happens in any given session)

Default session ≈ 6 minutes, composed as: **Rituals 15% · Review 40% · Current target 30% ·
Play 15%**, with the composer adjusting live:

| Live signal | Adjustment |
|---|---|
| 3 consecutive misses / two "I don't know" | Shrink to review-only + support check-in (mode detector takes over) |
| 5 fast correct in a row | Inject stretch items from next level (2 max) or end early with celebration (boredom prevention) |
| Session ≥ 10 min, or response times lengthening | Wind-down: celebrate what was done, preview next time, wave goodbye |
| Child-led curiosity spike ("where's the duck?") | Grace 2–3 conversation turns around it, then bridge back to the anchor |

Session shape: **Hello + mood check-in → warm-up review (spaced repetition due items) → teach 3–4
items (model → join-in → independent) → game using today's set → celebration + goodbye + preview.**
Every session ends with a *cliffhanger* for tomorrow (curiosity hook).

---

## 3. Mode-detection engine (Requirement #2)

**Modes:** `LEARNING` · `CONVERSATION` · `ENGAGEMENT (play)` · `SUPPORT (calm)`.
Internally, LEARNING has sub-states (review / teach / stage-check) that the child never sees.

### 3.1 Signals used

| Signal family | Examples |
|---|---|
| Text content | "play", "game", "song", "I'm sad", "tired", "scared", "don't want", "stop", "boring", "look at my…", off-topic nouns, emoji-only messages |
| Behavior (primary) | 3-miss streak, repeated "I don't know", idle time rising, chip-skipping, session length |
| UI events | Home button taps ("Learn/Talk/Play/Calm"), sticker-book opens |
| History | Mood yesterday, time of day (post-nap vs bedtime), last mode |

### 3.2 Two-tier decision (fast + reliable)

- **Tier 1 — Rules (instant, ~0 ms):** a keyword/pattern table resolves the majority of cases.
- **Tier 2 — Tiny classifier (~100–250 ms):** only for unresolved input; 4-class prediction with
  confidence. Trained on ~200 labeled examples per class (scripted child utterances, incl. misspellings
  and code-switching); evaluated on a held-out 60-turn set. If the classifier is not confidently
  trained in time, Tier 1 alone still covers the demo scenarios — the classifier is an enhancement, not a dependency.

### 3.3 Rules that are guaranteed to work (demo-critical)

| Child sends / does | Mode chosen | Bot behavior (example) |
|---|---|---|
| "I want to play a game!" | ENGAGEMENT | "Yay! Simon says… touch your nose! Your turn!" |
| "I'm sad / I'm tired / I don't want to / stop" (upset words, repeated "no") | SUPPORT (preempts everything) | "Oh… it's okay to feel sad. Want to breathe with me, or just talk?" |
| "I don't know" ×2, or 3 misses in a row | SUPPORT (check-in) | "That's okay! Not-knowing is how we learn. Let's do it together — watch me." |
| Off-topic, happy topic ("I have a dog named Bruno!") | CONVERSATION (max 3 turns, then bridge) | "Bruno! I love dogs 🐶. Is Bruno big or small? … Now — can you write *big dog*? Tap the words!" |
| No reply ×2 (≈45 s idle each) | SCAFFOLD cascade (stays LEARNING) | Repeat with simpler options → first-letter hint ("It starts with b…") → show the answer → move on warmly |
| 5 fast correct | Stretch or early celebration | ENGAGEMENT-adjacent: bonus round with a next-level word |
| Session ≥ 12 min | Wind-down regardless of everything | Celebration + goodbye ritual |

### 3.4 Hysteresis (no flapping — a stable child experience)

- Any detected mode is **sticky for ≥2 turns** unless SUPPORT triggers (SUPPORT always preempts immediately).
- CONVERSATION has a **turn budget (≤3)** then a scripted bridge back to the anchor activity.
- Returning to LEARNING is always **gentle**: "Okay! Ready? Your turn — what's this?" (never "back to work").

---

## 4. Social & Emotional Learning (Requirement #3)

### 4.1 Framework mapping (CASEL → kid-level behaviors → product features)

| CASEL competency | Kid-level behavior we nurture | Product feature that carries it |
|---|---|---|
| Self-awareness | Naming feelings; noticing "I like this / this is hard for me" | Mood check-in with faces; "Milo feels…" mirroring |
| Self-management | Waiting, breathing when upset, taking breaks | Calm Corner breathing; break offers after frustration signals |
| Social awareness | Noticing others' feelings; kindness words | Milo has feelings ("Milo is sad, he lost his balloon"); please/thank-you moments |
| Relationship skills | Greeting, turn-taking, helping, thanking | Turn-taking games ("my turn, your turn"); goodbye ritual; helping-Milo quizzies |
| Responsible decision-making | Choosing, saying no politely, what-to-do-when-stuck | Two-option choices everywhere; "ask for help" scripts; never punished for quitting |

### 4.2 Micro-moment library (the operational core)

Not a separate "SEL lesson" — these fire inside real turns:

| # | Trigger | Move | Example line |
|---|---|---|---|
| 1 | Session start | Mood check-in (4 faces) | "Hi Maya! How do you feel today — happy, sleepy, or a little sad?" |
| 2 | Correct answer | Effort-specific praise | "You said *elephant* so clearly — my ears are proud!" |
| 3 | Wrong chip / typo | Recast + warmth (never "wrong") | "Ooh, so close! This one is *elephant* 🐘. Tap it — elephant! You've got this." |
| 4 | "I can't" / "too hard" | Growth mindset | "You can't do it *yet*. 'Yet' is a magic word. Let's do it together." |
| 5 | Frustration signals | Offer the Calm Corner | "Big feelings! Want to blow up a balloon with me? In… and ouuut." |
| 6 | Curiosity shown | Wonder question | "Ooh, curious brain! What else is red in your house? … Strawberries! Wow!" |
| 7 | Turn-taking game | Model reciprocity | "My turn… your turn! Your turn is my favorite turn." |
| 8 | Milo "forgets" | Child as helper (perspective-taking) | "Oops! I forgot the word for this! Can you help me? … *Ball!* Thank you!" |
| 9 | Child sad/worried | Validate + name the feeling | "You feel sad. Thank you for telling me. Sad is okay — sad comes and goes." |
| 10 | Persistence | Process praise | "You tried three times! Trying grows your brain. Look how brave you are." |
| 11 | Any choice point | Autonomy | "Do you want the red one or the blue one? You choose!" |
| 12 | Session end | Gratitude + goodbye ritual | "Thank you for playing with me, Maya. High-five! 🖐️ See you tomorrow!" |

Emotion check-in flow (30 s): 4 face cards → child taps or says one → Milo **mirrors and names** it →
if negative: comfort turn + offer (talk / breathe / gentle play) → if positive: amplify and start.
Every session logs mood_start / mood_end — the composer reads the trend and paces the next session accordingly ("tired yesterday → gentler start today").

### 4.3 Praise & correction policy (the non-negotiables)

- Praise is **specific and effort-based**; the phrase bank has ≥6 variants to avoid robot-repetition.
- Corrections are **recasts** (implicit correct model) — no error counts ever shown to the child.
- No timers, no streaks-pressure, no "you lost" mechanics. Stars are earned, never lost.
- The bot is allowed to be imperfect (forgets, needs help) — this teaches helping and normalizes mistakes.

---

## 5. Context & personalization (Requirement #4)

### 5.1 What "context-aware" means here, concretely

| Context source | How the turn changes |
|---|---|
| Learning history | Due-review items lead the warm-up; struggling items get scaffolded versions; mastered items retire to occasional refreshers |
| Current level | Vocabulary locked to level word-list; sentence length and question types scale (L1: choose a card · L3: free answer) |
| Conversation context | Last 6 turns + rolling 2-line summary; references work ("the duck from before — quack quack!") |
| Interests | Child interests skin content: dinosaurs/cats/princesses wrap around the same target words ("the red **dino** ball") |
| Mood & time | Tired at bedtime → calmer wording, more review, sooner wind-down; post-nap energy → game-forward session |
| Home language | One-line encouragement bridge max per session ("Shabaash! Now in English: *well done*!") — never full translation |

### 5.2 Continuity examples (this is what judges will probe)

- Day 1: learns *duck*. Day 2 opening: "Yesterday you met **duck**. Quack quack! Do you remember? …"
- Child loves dinosaurs → next session the number game counts *dinos*, colors game uses *dino eggs*.
- Struggling with *elephant* for 3 sessions → composer schedules it as the "mystery word" game with extra scaffolded turns.
- Child writes in home language → bot accepts meaning, models English once, never shames ("Yes! Ball ⚽ Can you tap *ball*?")

### 5.3 Response style rules (the child-facing contract)

≤2 short sentences · one question max per turn · concrete present-tense words · emoji anchor the meaning ·
name used sparingly · always end with a next micro-action (+ tappable chips) · never lecture ·
no timers and no nagging — Milo waits patiently and sends a single gentle nudge after a long idle
(never twice in a row). The bot's worst failure mode is a **wall of text** — so the cap is enforced
programmatically, not just by prompt.
