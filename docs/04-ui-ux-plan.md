# 04 · UI/UX Plan

> **Planning document** (written before the build). For the system as built, see [`SYSTEM-DESIGN.md`](SYSTEM-DESIGN.md) and [`architecture.png`](architecture.png).

*Designing a chatbot for someone whose reading ability ranges from "emoji only" to "short sentences" — without ever requiring a microphone.*

---

## 1. UX principles

1. **Chatbot first.** The core experience is messages + replies. No microphone, no audio pipeline —
   exactly what the brief asks for.
2. **Emoji-first, words second.** Emoji and pictures carry meaning for every child; short simple
   words support emergent readers; text is never a wall.
3. **Tap > type.** Every interaction is possible by tapping an answer chip; typing is
   welcomed for early readers (5–6).
4. **One action per message.** One question per turn, 2–4 answer chips, no menus, no scroll-hunting.
5. **Never a dead end.** No reply, gibberish, upset message, boredom — every branch has a designed,
   warm continuation (or an easy, guilt-free exit).
6. **Celebrate effort, never punish errors.** No red X's, no error counts, no losing stars, no timers.
7. **Calm is a feature.** Muted palette shifts, breathing screens, and enforced wind-downs protect attention by design.

---

## 2. Visual system

### 2.1 Color tokens (soft, high-contrast, overstimulation-averse)

| Token | Value (guide) | Usage |
|---|---|---|
| Cream | #FFF8EE | Background — warm, paper-like |
| Ink | #2E2A33 | Text (kept large and minimal) |
| Milo orange | #FF8A3D | Mascot, primary brand accents, **child's messages** |
| Sunny | #FFC94D | Stars, celebrations, highlights |
| Sky | #5BB8F5 | Milo's neutral bubbles, calm visuals |
| Grass | #6BCB77 | Correct/positive feedback (co-used with shape+icon, never color-only) |
| Grape | #B79CED | Play/engagement accents |
| Blush | #FFB3C1 | Care/support accents |
| Mist | #E8E2D8 | Card rims, dividers |

Text/background pairs chosen for ≥4.5:1 contrast. **Red is deliberately absent from error states**
(soft amber "try again" glow instead) — nothing ever "looks like a mistake".

### 2.2 Type, shape & input

- Font: **Nunito / Baloo 2**-class rounded sans. Milo's messages: 26–30 px. Child's typed text: 30 px
  (so they can see their own words). Chip labels: 22–26 px. Never below 20 px anywhere a child looks.
- Shapes: everything rounded — bubbles 24 px radius, chips pill-shaped, no sharp corners.
- Touch targets: **minimum 80×80 px** chips and buttons; mis-taps are normal and never punished.
- Keyboard: big, simple, **autocorrect OFF** (autocorrect "fixes" invented spellings we want to see and celebrate);
  live **word chips** from the current lesson sit above the keys ("red", "ball", "I", "like").
- Layout: portrait tablet first, scales cleanly to 390 px phones; chat column stays single-width.

### 2.3 Motion principles

| Principle | Detail |
|---|---|
| Instant self-message | The child's own tap/text appears immediately — the strongest latency signal is their own echo |
| Milo is the status | Mascot pose = system state (thinking dots, happy bounce, caring sit) — no spinners, no jargon |
| Celebrations big but short | ≤2.5 s confetti/star burst, then straight back to action |
| Calm mode slows everything | Slower animations, softer sounds, dimmed palette, gentle sway |
| Reduce-motion respected | Honors the device's reduce-motion setting — confetti/parallax off, visual cues kept |
| No punishing motion | Nothing shakes, flashes red, or buzzes — ever |

### 2.4 Sound design (optional accent layer — fully removable)

- Earcons (small, default on, ~1 s max): warm chime (correct) · soft "boop" (try-again, never a buzzer)
  · sparkle arpeggio (star earned) · calm pad (Calm Corner only).
- In-app muting always available (top corner speaker icon) — a child in a quiet room is never "stuck with noise".

### 2.5 Mascot system — Milo the Fox 🦊

| State | Visual | Fires when |
|---|---|---|
| idle | Blinks, ear twitch, gentle breathing | Waiting on Home |
| attentive | Ears perk, leans toward the chat | Child is typing (input focused) |
| thinking | Head tilt, "..." dots in Milo's bubble | While composing (≤1 s in practice, masked) |
| happy | Bounce, tail wag | Correct/ok answer |
| celebrate | Jump + confetti + star eyes | Stars, badges, graduation |
| care | Soft eyes, sits down, holds a paper heart | Support mode |
| calm | Swaying, breathing with the balloon graphic | Calm Corner |
| asleep | Curled up, Zzz | Session ended / wind-down (also a friendly bedtime signal) |

Milo "makes mistakes" sometimes (forgets a word) — an intentional SEL device, see doc 03 §4.

---

## 3. Information architecture

```
Splash ──► Home

Home ──► [🎓 Learn]  ──► session: check-in → review → teach → game → celebration → end card
     ──► [💬 Talk]   ──► interest-led conversation (bridged, ≤3-turn detours) → end card
     ──► [🎮 Play]   ──► mini-game using due items → celebration → end card
     ──► [💚 Calm]   ──► feelings / breathing → gentle re-entry or end
     ──► [📔 Sticker book] ──► earned stickers grid
```

The child never sees the words "level", "mode", or "progress" — they live in the engine, never on screen.

---

## 4. Screen-by-screen specifications

### 4.1 Home — "The Playroom"

```
┌───────────────────────────────┐
│ ⭐×5                          │   progress stars (earned today)
│                                │
│         (  Milo 🦊 )           │   mascot center-stage, waving, blinking
│    ╭───────────────────────╮   │
│    │ Hi Maya! 👋 What shall │   │   Milo's greeting bubble
│    │ we do today?          │   │
│    ╰───────────────────────╯   │
│  ┌──────────┐ ┌──────────┐     │
│  │   🎓     │ │   💬     │     │   4 HUGE tiles (≥120 px), icon + one word
│  │  Learn   │ │   Talk   │     │   tiles ARE chips — tap = send
│  └──────────┘ └──────────┘     │
│  ┌──────────┐ ┌──────────┐     │
│  │   🎮     │ │   💚     │     │   Calm tile is soft pink, slightly apart
│  │  Play    │ │   Calm   │     │
│  └──────────┘ └──────────┘     │
│        [ 📔 My stickers ]      │   small sticker strip, not a main action
└───────────────────────────────┘
```

- Milo greets by first name (from the learner card); his bubble appears instantly — never waits on a network call.
- If the child taps "Calm" unprompted, no lesson is ever offered from that screen — comfort only.
- Returning after a gap (>1 day): Milo references it ("Maya! I missed you! I kept your duck story 🦆").

### 4.2 Session screen — the core loop (Learn / Talk / Play all reuse it)

```
┌────────────────────────────────┐
│ ⭐⭐●○   [🎓 Learning]     ✕   │   stars this session · mode chip · exit
│                                 │
│ (🦊) ╭──────────────────────╮   │
│      │ A red ball! 🔴 Wanna  │   │   Milo bubbles: left, avatar, emoji-rich
│      │ find RED?             │   │
│      ╰──────────────────────╯   │
│                    ╭─────────╮  │
│                    │ 🔵 blue │  │   child's messages: right-aligned
│                    ╰─────────╯  │     (here: a wrong chip tap — shown as their chip)
│ (🦊) ╭──────────────────────╮   │
│      │ So close! This one is │   │   recast, warm — soft amber glow, never red
│      │ RED 🔴. Your turn!    │   │
│      ╰──────────────────────╯   │
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │  🔴  │ │  🔵  │ │  🟡  │    │   answer chips (tap = send)
│  │ red  │ │ blue │ │yellow│    │     labels shown from L2 onward
│  └──────┘ └──────┘ └──────┘    │
│  [ ✏️ Type your answer… ]       │   big keyboard for 5–6s
└────────────────────────────────┘
```

| State | Visual | Behavior |
|---|---|---|
| Chips ready | Chips pulse gently, one soft chime | Child can tap a chip or type |
| Typing | Big friendly keyboard; live **word chips** from the current lesson above the keys | Autocorrect OFF; no red squiggles ever; spellings like "rad" are celebrated, not corrected silently |
| Thinking | "..." dots in Milo's bubble | ≤1 s typical; if >1.2 s a scripted bubble pops in (child never waits) |
| Reply streaming | Bubbles appear progressively; chips animate in after the text | Chips disabled until settled → prevents double-answers |
| Wrong chip / typo | Soft amber glow, no red, no cross | Recast + same options stay; typo attempts get extra warmth ("'rad' — I love that! It's RED") |
| Idle ~45 s | Milo sends **one** gentle nudge ("Still there? Tap anything 😊") | Single nudge, never repeated in a row; then the session stays quiet |
| Mode chip change | Chip morphs (🎓→💬→🎮→💚) with a soft sound | Mostly for the demo; children notice the color + Milo's pose change, not the label |

Structured lesson progress ("⭐⭐●○") shows 4 steps max per session — never a full curriculum map,
which would read as a task backlog to a child.

### 4.3 Celebration / graduation overlay

Full-screen Milo jump + ≤2.5 s star burst + badge reveal ("You are a Word Wizard! 🥳"). Two exits:
**[More!]** (one bonus round, then wind-down) and **[Wave bye-bye 👋]** (end card). Graduations add a
"new world unlocked" line (L2 preview) — a curiosity hook, not a scoreboard.

### 4.4 Calm Corner

Soft pink/mist palette, ambient pad sound (optional), Milo in `calm`/`care` pose.

```
┌───────────────────────────────┐
│         (  Milo 🦊 )           │
│   ╭────────────────────────╮   │
│   │ It's okay. Want to     │   │
│   │ breathe with me? 🫧    │   │
│   ╰────────────────────────╯   │
│        ◯ → ◯◯ → ◯◯ ◯          │   breathing balloon grows/shrinks
│        "in…      …out…"        │   one guided breath per tap
│  ┌─────┐┌─────┐┌─────┐┌─────┐  │
│  │ 😊  ││ 😴  ││ 😢 ││ 😠  │  │   4 feelings chips ("tap how you feel")
│  └─────┘└─────┘└─────┘└─────┘  │
│   [ Tell Milo 🗣️ ] [ Just breathe 🫧 ] [ Bye 👋 ] │
└───────────────────────────────┘
```

No scores, no stars, no teaching here — and no monologues: each tap guides exactly one AI-phrased
breath ("in… and out…"), then Milo hands the turn back ([🫧 One more] · [🧸 Gentle play] · [👋 Bye]).
Tapping a feeling → Milo names it and validates ("Tired is a real feeling. Everyone gets tired 😴.").
Every visit is logged as a *caring* signal — never as a failure.

### 4.5 End card (session wrap-up)

Big: stars earned, new words met ("3 new words! duck · red · ball 🎈"). All child-facing —
pictures + numbers only. No summary text, no links.

---

## 5. Interaction rules (behavior contract)

- **One action → one reply.** Every tap or message produces exactly **one** Milo bubble. Warmth
  lines are AI-phrased from a strict turn brief; exact engine lines that must follow (the next
  question, the word model, the mood ask) merge into that same bubble, and the model is required to
  end with them verbatim — checked programmatically, with the scripted twin as the safety net.
  The Calm Corner breathes in the same rhythm: each [🫧 One more] tap guides one breath, then the
  child chooses the next move.
- **One question per turn, max.** Chips always accompany a teaching question; typing is optional.
- **No timers, no nagging.** Milo waits patiently; after ~45 s idle he sends a single gentle nudge, never twice in a row.
- **Typos are wonderful.** Tolerant matching + phonetic aliases; invented spellings get celebrated, then gently recast.
- **Double-tap guard.** Chips disable the moment they're tapped until Milo replies — a double-tap can never double-answer.
- **Exit:** one tap on ✕ → Milo waves goodbye with the star count. No confirm dialogs, no guilt.
- **Every message persisted locally in-session** — a dropped network never loses the child's words.
- **Device posture:** designed for tablet on a stand at child height; phone portrait fully functional.

---

## 6. Accessibility & inclusion

| Area | Decision |
|---|---|
| Vision | ≥4.5:1 contrast; text never sole carrier of meaning (emoji/color/shape always co-used); max 2 short sentences per bubble |
| Motor | ≥80 px targets; drag never required; every interaction has a tap path |
| Hearing | Visual cues accompany every earcon; earcons can be muted entirely |
| Attention / sensory | Device reduce-motion honored; calm palette; short sessions by default; enforced wind-downs |
| Reading levels | Chip-only path is complete for pre-readers; word chips + tolerant matching support emergent readers and early typers |
| Speech differences | No speech required anywhere — all interaction is tap or type |
| Language / culture | Content bank culturally neutral (no holidays by default); home-language bridge line policy (doc 03 §5) |
| Literacy aids | All child-facing words drawn from the current lesson when possible |

---

## 7. What to demo (the 90-second UI tour)

Home → tap **Learn** → L1 lesson: tap the red ball chip (correct → praise) → tap blue *wrong on purpose*
(recast, soft amber glow — note: **no red X anywhere**) → type "i want plaay" (typo-tolerant → Milo
cheerfully understands, mode chip 🎓→🎮) → Simon-says tap game → type "i'm tired" (chip → 💚, Calm
Corner breathing) → recover → graduation overlay → end card. Every screen in that tour maps 1:1 to a requirement (see docs/06 §5 evidence table).
