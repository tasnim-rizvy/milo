# 01 · Requirements Analysis

*Analysis of the competition brief for "AI-Powered English Learning Chatbot for Children (Under 7 Years Old)".*

## 1. What the brief actually asks for

Five testable capabilities. Everything else (UI, stack, mascot) is our choice — but the five below
will be probed by judges/demo:

| # | Requirement | Board-level reading | Our success test |
|---|---|---|---|
| R1 | Progressive Learning L1→L3 | A stateful curriculum that *demonstrably* moves a child along, step by step | Same child, 3 short sessions: L1 words → L2 sentence frames; level gate flips only on measured mastery |
| R2 | Child mode detection | Detect the child's state (mood/engagement) and *stop teaching* when appropriate | Message "I'm tired" or "I don't want to" → bot stops drilling, shifts to Calm/Play; visible in demo and logs |
| R3 | Social & Emotional Learning | Age-appropriate SEL woven through interaction | ≥ 10 SEL micro-moments in library; feeling check-in at session start; calm corner; effort-only praise |
| R4 | Context-aware responses | Adapt to learning history + level + conversation | Bot references yesterday's words, child's interests ("dinosaurs!"), and stays on-level |
| R5 | End-to-end latency < 2 s | Perceived response time from the child's action to the bot's reply | Instrumented: chip turns P50 ≈ 0.2 s; free-text P50 ≤ 0.9 s / P95 ≤ 1.5 s; live latency badge in dev mode |

---

## 2. The key insight

> **The brief asks for a chatbot — so build the best possible chatbot for this age. No microphone needed.**

And on ability: children under 7 are a spectrum, not a monolith. Tablet-native kids tap fluently
before they can read; most 5–6-year-olds recognize sight words, read short sentences, and type
short words (slowly, with help); even 4-year-olds recognize a few words and are emoji-fluent.

**Design implication — a multi-modal chat:** 
- **Emoji + pictures carry meaning for everyone** (the universal layer).
- **Short simple words** support emergent readers and are the learning content itself.
- **Tappable answer chips** remove the typing requirement entirely, so children who can't read yet (young 4s) can fully play.
- **Typing is welcomed, not forbidden**, for 5–6-year-olds — with a big friendly keyboard, word chips from
  the current lesson, autocorrect off, and tolerant matching for invented spellings ("rad" → red 🎉).

Voice (input or output) is **out of scope**: the brief asks for a chatbot, every interaction is tap or type, and no audio pipeline exists anywhere in the system.

---

## 3. Ambiguities in the brief — and how this plan resolves them

### 3.1 "Child mode detection" — learner-state detection

The requirement asks us to detect the child's **current mode, mood, or learning state** — and we
implement exactly that: mood/engagement is read from *what the child sends* ("I'm sad", "no",
"boring", "stop") and *behavioral signals* (miss streaks, idle time, chip-skipping, session
length), which drives mode switching: `LEARNING → ENGAGEMENT → SUPPORT → CONVERSATION`.

**Not attempted: child-vs-adult detection.** The brief doesn't ask for it, and nothing in the
product needs it — text-based adult/child classification is unreliable anyway (a chatty 6-year-old
writing full sentences would "look adult"). The bot detects the child's *learning state*, not who
is typing.

### 3.2 Audience scope: ages 4 to under-7 (2–3 deliberately excluded) — the reading spectrum

**Scope decision:** the product serves **ages 4, 5, and 6 — from the 4th birthday until the day
before the 7th birthday.** "Over 6 but not yet 7" is explicitly included: those children are our
most capable users (school-ready early readers, confident tablet typers), and L3 (little
conversations) is designed with them in mind. **Toddlers (2–3) are not an audience for this
product:** that band doesn't need academic instruction — their right product is songs, movement,
and play, not a lesson chatbot — and designing for them would reshape the entire product for users
the brief's L1–L3 progression doesn't serve. We stay inside "under 7" while keeping the product focused.

Even within this range, ability varies — one chat design spans the spectrum:

| Band | Reading / typing reality | UX implications |
|---|---|---|
| 4–5 (preschool) | Emergent readers: name, "no", a few sight words; some can't read yet; tap-first, type with help | Chips primary; big keyboard available; words shown with emoji glosses |
| 5 to under-7 (early reader) | Reads short sentences; types short words/sentences slowly; tablet-native | Chips stay available but typing is a *fun skill to practice*; word chips assist; tolerant matching on |

One product serves both bands: nothing requires reading, but reading and typing are rewarding options,
not obstacles. Sessions stay short (5–8 min attention spans hold across this range).

### 3.3 "Below 2 seconds" — of *what*, exactly?

Undefined in the brief, so we define it ourselves and state it on the demo screen:
**from the moment the child sends something (chip tap, typed message) to the moment the bot's reply
starts appearing on screen**.
This is the latency a human perceives.

| Path | Target | Worst-case fallback |
|---|---|---|
| Chip answer (most teaching turns) | P50 ≈ 0.2 s · P95 ≤ 0.5 s | Scripted reply set is known in advance — near-instant |
| Free-text message | P50 ≤ 0.9 s · P95 ≤ 1.5 s | Cached line ("Ooh, tell me more!") plays at ≤ 0.5 s if the LLM exceeds its 1.2 s budget |

### 3.4 LLM or non-LLM?

Brief allows either. We choose **hybrid** because it wins on both axes judges care about:

- **Deterministic curriculum engine** (non-LLM): owns level, item selection, mastery, progression.
  Zero hallucination risk on what the child must learn; ~0 ms decisions.
- **LLM (small/fast model)**: phrasing variety, free conversation, empathetic SEL responses,
  interest personalization. Guardrailed by schema + prompt rules + moderation.
- If the LLM is slow or down, the bot automatically falls back to scripted lines — the demo never dies.

---

## 4. Design principles (drive every decision downstream)

1. **Chatbot first.** The core needs no microphone and no audio pipeline — exactly what the brief asks.
2. **Emoji-first, words second.** Emoji and pictures carry meaning for every child; short words
   support emergent readers; text is never a wall.
3. **Tap > type.** Every interaction is possible by tapping a chip; typing is supported and
   encouraged for early readers.
4. **Teach less, interact more** — teaching is only ~55% of session time; play/chat/comfort are
   legitimate, first-class modes (R2).
5. **Effort praise, never error scolding** — "so close! It's red 🔴 — your turn" (recast, not correction).
6. **Deterministic pedagogy + generative warmth** — the curriculum is a state machine; the LLM supplies the language.
7. **Graceful degradation everywhere** — cached lines, scripted mode, cached lessons while offline.
8. **Privacy by default for kids** — no accounts, minimal logs, retention off;
   no audio exists anywhere — all interaction is text and taps.

---

## 5. Constraints & risks (summary; mitigations live in docs 02/06)

| Constraint / risk | Impact if ignored | Headline mitigation |
|---|---|---|
| Small-screen text overload | Kids bounce off walls of text | Messages ≤2 short sentences, emoji-anchored, enforced programmatically (doc 02 §6) |
| Typing friction for pre-reading children | Child "can't participate" | Chips make typing fully optional; the chip-only path is complete, not degraded |
| Misspellings & invented spellings ("rad", "elefant") | "Bot doesn't understand me" — kills the magic | Tolerant matching + phonetic aliases + gentle recast; typos are *celebrated as attempts* |
| Latency budget | Misses R5 | Scripted fast-path for chip turns, streaming, small model + tight schema (doc 02 §3) |
| 24-hour build window | Nothing ships or demo is fragile | Frozen MVP, hour-by-hour plan, backup demo video (docs/06) |
| Judges may expect voice (brief doesn't ask) | Perceived as a gap | Position clearly: "chatbot per the brief — no microphone needed"; 30-second story in the demo (docs/06 §5) |
| Safety/privacy scrutiny | Trust loss with judges | Minimal-data posture documented (doc 02 §8); moderation both directions |
| LLM output drifting off-level or verbose | Bad for kids | Schema-constrained output, sentence-length caps, level-locked word lists |

---

## 6. Scope — MVP vs. stretch (deadline-aware)

**MVP (must exist at 6:30 PM Sunday — all demo-critical):**
- Chat round trip: child taps/types → bot replies (streaming, latency-instrumented)
- Full L1 + L2 content banks (~150 items as data), L3 light (5 dialogue scenes + simple sentences)
- Answer chips generated with every teaching turn; big-keyboard typing with lesson word chips
- Four modes with rule+classifier detection and hysteresis
- Feeling check-in, 4+ SEL micro-moments wired in, calm corner (breathing), celebration/graduation
- Context: learner card + spaced repetition + last-6-turn memory; interest injection
- Latency badge on the session screen (live reply timer — the on-screen evidence for R5)
- Tolerant answer matching (typos, misspellings, emoji-only replies)

**Stretch (only if ahead of schedule):**
1. L3 storybook with swipe pages
2. Word-level spelling micro-feedback (gentle, celebratory)

**Cut-first list (if behind):** sticker book animations, L3 depth (3 scenes instead of 5),
tiny mode classifier (rules alone cover the demo).

---

## 7. Brief-required vs. our additions (so we never confuse the two)

| Brief requires | Our additions (nice-to-have, all cuttable except where serving a requirement) |
|---|---|
| A chatbot that teaches English | Milo mascot with emotional states (serves R3, cuttable to a simple avatar) |
| L1→L3 progressive learning | — |
| Child mode detection | Celebration + sticker system (serves engagement; cuttable) |
| Context-aware responses | Latency badge (serves R5 *evidence*; keep) |
| < 2 s end-to-end latency | |
