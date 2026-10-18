# 05 · User Journeys & Sample Dialogues

> **Planning document** (written before the build). For the system as built, see [`SYSTEM-DESIGN.md`](SYSTEM-DESIGN.md) and [`architecture.png`](architecture.png).

*The story of a real week with Milo — plus the playbook for everything that goes sideways.*

*(All dialogues below are chat transcripts: taps on answer chips are shown in [brackets]; typed text is plain.)*

---

## 1. Personas

| Persona | Snapshot | Design implications |
|---|---|---|
| **Maya, 4½** | Can't read yet; taps picture chips fluently; loves cats; 4-minute attention span | Chip-only path must be complete; emoji do the heavy lifting; shortest sessions |
| **Aarav, 6½** | Just under 7 — school-ready early reader; types short words slowly; loves dinosaurs; chats nonstop | Typing is a fun skill to practice; word chips assist; sentence frames; dinosaur skinning of content; L3 capable |

---

## 2. The emotional arc of a good session

```
curiosity ──► warmed-up confidence ──► challenge ("ooh, tricky!") ──► support (if needed)
   │              │                        │                             │
 hello +      easy review win         new item, scaffolded          calm / recast /
 mood check   (spaced repetition)     (model → join → solo)          encouragement
   │              │                        │                             │
   └──────────────┴────────────► celebration ──► cliffhanger ("tomorrow: jungle!") ──► goodbye
```

Every journey below is designed to move left-to-right through that arc — and every requirement
(R1–R5) shows up inside it naturally rather than as a bolt-on.

---

## 3. Journey 1 — Day 1, first lesson (L1, annotated)

Scenario: Aarav starts at L1. Annotations in *italics*.

```
MILO    Hi Aarav! How do you feel today? 🦊
        [😊 happy] [😴 sleepy] [😢 a little sad]                    ← R3: feeling check-in
AARAV   [😊 happy]
MILO    Happy! Me too — my tail is wagging. High five! 🖐️
MILO    Warm-up! What's this?  🦆
        [🦆 duck] [🐱 cat] [🐟 fish]
AARAV   [🦆 duck]
MILO    YES! Duck! Quack quack 🦆 You remembered!  ⭐             ← effort-specific praise
MILO    New one! Which is RED?  🔴
        [🔴 red] [🔵 blue] [🟡 yellow]
AARAV   (taps 🔵 blue)                                            ← a wrong chip, shown as his message
MILO    Ooh, SO close! That one is blue 💙. This is RED 🔴.        ← recast, never "wrong"
        Tap the red one — you've got this!
AARAV   (taps 🔴 red)
MILO    RED! 🔴 Your mouth... wait, your HAND did it! ⭐          ← playful, warm
MILO    Now — Simon says: TAP something RED!                      ← R2: mode shifts Learn→Play
AARAV   (taps the red block)
MILO    Simon is VERY impressed. 🎮 Two more stars, then we wave bye-bye? ← wind-down respect
...
MILO    That's 3 stars and 3 new words: duck · red · ball 🎈
        Thank you for playing, Aarav! Tomorrow… I found a JUNGLE 🌴
        And I think something BIG lives in it.                                ← cliffhanger
```

*Latency note: chip turns take the scripted fast path (~0.2 s); typed turns go through the LLM path
(~0.9 s P50). Mode chip morphs 🎓 → 🎮 when Simon says starts.*

---

## 4. Journey 2 — Day 7 (L2, context + interests + conversation detour)

Milo now uses L2 sentence frames, remembers history, and skins content with Aarav's dinosaur interest.

```
MILO    Aarav! Yesterday we met a NEW word: elephant 🐘
        Can you write it? Or tap it:
        [elephant] [cat] [duck]
AARAV   elephant          ← typed (slow but proud — early reader using the word chips)
MILO    ELEPHANT! 🐘 Your fingers did the hard part: el-e-phant. Hooray!
MILO    Now: I see a BIG dinosaur 🦖 It can RUN. What can dinosaurs do?
        [run] [eat] [sleep]
AARAV   it can eat! and my dino can fly but its not real its from my cartoon🦕
MILO    Wait wait wait — a dino that FLIES?! 🦕✨ Tell me one thing about it.   ← R2: CONVERSATION mode (≤3 turns)
AARAV   hes blue and has a red hat and he is fast
MILO    Blue dino, red hat, super fast. I love him. 😄
MILO    Now — write it with me! Tap the words:                             ← bridge back to the frame
        [My] [dino] [is] [fast]
AARAV   [My][dino][is][fast] → "My dino is fast!"
MILO    "My dino IS fast!" Grammar fireworks! 🎆                           ← target frame achieved
```

*What to notice: the detour was honored (conversation), bounded (bridge back), then fed the target
frame. The learner card powered the elephant reference and the dino theming (R4). His invented
spellings ("hes") were understood without comment — fluency first, spelling later.*

---

## 5. Journey 3 — The hard day (support mode, the most important journey)

Aarav arrives tired after school, misses three in a row, and gets frustrated.

```
MILO    Which one is a CAR? 🚗
        [🚗 car] [🎈 balloon] [🧸 teddy]
AARAV   i don' know
MILO    That's okay! It's a car 🚗 Can you tap it?
AARAV   no. i dont want to.
MILO    (stops teaching instantly) Oh, Aarav. Big feelings happen.          ← R2: SUPPORT preempts everything
        I get tired too. 🦊 Want to breathe with me, or tell me what happened?
        [🫧 Breathe] [💬 Tell Milo] [👋 Bye]
AARAV   [🫧 Breathe]
MILO    Let's blow up a balloon together. Breathe in… and ooouuut. 🎈        ← Calm Corner
        Again. Innn… ooouuut. Better?
        You were SO brave to tell me. That's a big-kid move. ⭐               ← SEL: naming + praise
MILO    Want to play something easy, or wave bye-bye? I'll keep your stars safe.
        [🎮 Easy game] [👋 Bye]
AARAV   [🎮 Easy game]
MILO    Yay! Easy-peasy game: find the RED things. Simon says… go! 🔴          ← gentle re-entry, review-only
```

*Design note: teaching paused, we did a breathing break, then played an easy review game — and
finished with a smile. No new words were pushed (R3: support beats pedagogy, every time). If
sad/worried signals repeat across sessions, the next session simply opens gently.*

---

## 6. Journey 4 — Graduation (L2 → L3) and the first conversation

```
MILO    That's the LAST one! You did it, Aarav. Remember when "elephant"
        looked like a scary long word? 🐘                                     ← R4: memory of struggle
MILO    Listen… 🥁 …You are now a WORD WIZARD! 🥳                             ← stage-check passed
        [confetti ≤2.5 s · badge reveal · tail wag]
MILO    Words that were hard are now easy. Your brain grew — I watched it happen.
MILO    Ready for the next world? Tomorrow we'll TALK. Real little talks. Like this:
MILO    Hello! How are you today?
AARAV   im fine
MILO    "I'm fine, thank you!" Now you try — write it with me:                 ← L3 preview hook
        [I'm] [fine] [thank] [you]
AARAV   [I'm][fine][thank][you] → "I'm fine thank you"
MILO    🎉
```

*The graduation ties R1 (measured mastery, stated), R3 (process praise), and R4 (memory of past struggle) together.*

---

## 7. Edge-case playbook

| # | Situation | Design response |
|---|---|---|
| 1 | No reply for ~45 s (×2) | Single gentle nudge, then the scaffold cascade: simpler options → first-letter hint ("It starts with b…") → show the answer → warm move-on. Never "Are you still there?"-guilt |
| 2 | Child types in home language | Accept the meaning, model English once ("Yes! Ball ⚽ Can you tap *ball*?"), never shame, max one bridge line per session |
| 3 | Off-topic obsession (the cat, for the 5th message) | Honor 3 turns, then a play-based bridge ("What color is your cat? … Let's find the *white* cat chip!") |
| 4 | "I don't know" ×2 or 3 misses | → SUPPORT check-in, never visible as failure; session may recompose to review-only |
| 5 | Upset words: "no", "stop", "I don't want to" | Stop teaching immediately → comfort + choice of Calm Corner or goodbye. **The child's "stop" always stops the activity** |
| 6 | Typos & invented spellings ("rad", "elefant", "hes") | Tolerant matching + phonetic aliases (it's still a WIN!); recast without penalty; extra warmth for brave attempts |
| 7 | Gibberish or emoji-only ("asdfgh 😀😀😀") | Milo plays along with the emoji, asks one easy choice question; after 2 rounds offers a game or calm corner |
| 8 | Child can't read or type yet (young 4s) | Chip-only path is **complete**, not degraded — Maya's default. |
| 9 | Sibling grabs the device and types "lol" | Milo answers warmly and moves on; only matching answers advance lessons. Aarav's progress untouched |
| 10 | "I'm bored" / rapid chip-skipping | Offer a Play game or a stretch word ("You're too fast for me! Try THIS one: *octopus* 🐙"); boredom is data, not discipline time |
| 11 | Wants to keep playing past wind-down | Warm limit: "Two more stars — then bye-bye. I'll keep your game warm for tomorrow 🌙" Enforced by design (attention protection) |
| 12 | Network drops mid-session | Offline lesson pack: chips-only review from cache; Milo keeps chatting; progress syncs when back online |
| 13 | Inappropriate/harmful input (from any direction) | Input flagged → gentle in-world redirect ("Ooh, let's do something happy instead! Wanna sing a song? 🎵") + logged; output flagged → never sent |
| 14 | Child says "I love you, Milo" | Warm, in bounds: "I love playing with you too! You're my favorite friend today. 💛" (light, bounded — no overpromising of human-like attachment) |

---

## 8. What each journey proves (mapping for the submission)

| Journey | Proves requirement |
|---|---|
| 1 — Day 1 lesson | R1 (L1 teaching, item tracking) · R3 (check-in, recast, praise) · R5 (latency in script) |
| 2 — Day 7 | R4 (history + interests + level) · R2 (conversation detour, bounded) · typing as a skill |
| 3 — Hard day | R2 (support preemption) · R3 (SEL in action) |
| 4 — Graduation | R1 (mastery gate + ceremony) · R3 (process praise) · R4 (memory of struggle) |
| 7 — Edge cases | Robustness for judges' hardest questions ("what if the child can't type yet? types nonsense? speaks another language? gets upset?") |
