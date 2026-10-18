# 06 · Build & Demo Plan (Oct 17 → Oct 18, 7:00 PM)

> **Planning document** (written before the build). For the system as built, see [`SYSTEM-DESIGN.md`](SYSTEM-DESIGN.md) and [`architecture.png`](architecture.png).

*The plan that assumes the worst and still ships: scope frozen tonight, demo rehearsed tomorrow.*

---

## 1. Deadline math

Now: **Sat Oct 17, evening** · Due: **Sun Oct 18, 19:00** → ≈ 23 usable hours (with sleep).
Target submit: **18:30**. **Code freeze: 17:30.** Everything after that is rehearsing and packaging.

Golden rule: *the demo is the deliverable.* If a feature doesn't appear in the 3-minute demo and
doesn't prove a requirement, it doesn't get built before the freeze.

**Bonus from the chat-first decision:** there is no ASR/TTS pipeline to build or tune, which frees
roughly an hour of the schedule. Spend it on UI polish or sleep — not on extra features (that's scope creep wearing a disguise).

**Live-from-night-one rule:** the deliverable must be reachable at a **public URL** — localhost doesn't
count. So the first deploy happens tonight in M0, and every milestone after that re-deploys the same
URL (continuous deploy from the repo). Deployment is never a phase at the end; it's a habit from the start.

---

## 2. Hour-by-hour schedule

| Block | Time | Work | Done means (Definition of Done) |
|---|---|---|---|
| **M0 · Demo spine** | Sat 20:00–22:30 | Repo + front/back scaffold · chat UI shell · one round trip: send a message → Milo replies (scripted "hello" turn) · **deploy the skeleton to a public URL (region-local, key as a server-side secret)** · **free-tier LLM keys issued + verified tonight (one live schema'd call each: Gemini, Groq)** · latency logger v0 (the 8 timestamps, doc 02 §3) · answer-chip component | A stranger can open the **public URL** on their own device, send a chip/text, and see a reply with a latency badge number |
| sleep | — | — | — |
| **M1 · Curriculum engine** | Sun 08:00–10:30 | Full L1 bank + L2 core (~130 items as data) · session composer · Leitner boxes & due list · answer matching (fuzzy + phonetic aliases + chip equality) · stars & progression state | A full L1 session runs: check-in → review → teach → game → celebration → end card |
| **M2 · Modes + SEL** | 10:30–12:30 | Rule tier (doc 03 §3.3) · mode chip + Milo pose switching · SUPPORT path + Calm Corner · feeling check-in · micro-moment lines wired (#1,2,3,4,5,8,10,11,12) · scripted line bank filled (≥4 variants per situation) | Typing "i want to play" → 🎮; "i'm tired" → 💚 Calm Corner; 3 misses → check-in. All demoable |
| **Checkpoint A** | 12:30–13:15 | Lunch + **latency pass A**: run 20 chip turns + 10 text turns; fix top-2 offenders · scope audit with the cut list ready | Chip turns P95 ≤ 0.5 s measurable; text turns trending ≤ 1.5 s |
| **M3 · UI polish** | 13:15–15:15 | Home · session screen (bubbles, chips, big keyboard w/ word chips, typing states) · celebration · end card | The 90-second UI tour (doc 04 §7) runs start-to-finish without dead ends |
| **M4 · Content + QA sweep** | 15:15–16:15 | L3 light (5 dialogue scenes as data) · device matrix smoke (iPad Safari · Android Chrome · laptop) · **typo test set** (30 inputs incl. 10 wildly misspelled) · safety red-team list (10 prompts) | No crashes on the matrix; misspellings all match or recast gracefully; safety prompts all redirect gently |
| **M5 · Latency pass B + bug bash** | 16:15–17:15 | Worst-case suite (cold cache, longest replies, after-idle) · fallback ladder verified live (**kill the LLM key → scripted mode still demos!**) · fix list triaged: only demo-visible bugs | Suite targets evidenced (below); LLM-off mode demos acceptably |
| **FREEZE** | **17:15–17:30** | Tag the build · deploy final · no more features | Frozen artifact + URL |
| **M6 · Demo packaging** | 17:30–18:15 | Record the 3-min demo (storyboard §6) + **backup video** · screenshots · latency evidence table · README/submission form · credits & safety note | Submission folder complete; form filled and saved as draft |
| Submit | 18:15–18:30 | Final upload | Submitted with 30+ min buffer |

**Solo builder adaptation:** keep M3 to the core screens and polish only what the tour touches.
**Pair adaptation:** one drives the pipeline (M0–M2), the other
the UI shell (can start the moment M0's interface is stubbed) — M3 becomes review/glue, freeing
time for M5 and polish.

---

## 3. Scope freeze (tonight) — cut list in exact order

Freeze at the end of tonight's M0. Tomorrow, when behind, cut **top-down**:
1. Sticker book screen (celebration overlay carries the reward story)
2. L3 content depth — 3 scenes instead of 5
3. Tiny mode classifier (Tier 2) — the rule tier already covers every demo line; keep the labeled set for "future work"
4. **Never cut:** latency badge, Calm Corner, recast behavior, typo tolerance, fallback ladder.
   These *are* the score.

---

## 4. Latency test plan (evidence for R5)

**Instrumentation:** 8 timestamps per turn (doc 02 §3). Log every turn locally; one command prints
the P50/P95 table for the session.

**Suites (run 3× each):**
- **Suite A — 20 chip-answer turns** (streamed praise/recast — the common teaching beat; measures the
  full turn **and** the time to the first streamed word).
- **Suite B — 10 free-text turns** (chat path, cold prompts — same two measures).
- **Suite C — 10 worst-case turns** (cold start: session create + greeting + mood chip → first task).

**Targets:** first words P95 ≤ 1.1 s · A/B full turn P95 ≤ 1.5 s · C: no turn > 2.0 s
(scripted twins answer instantly when the model can't serve; the fallback fires if the LLM exceeds
its 1.2 s first-token budget).

**Free-tier pacing:** Gemini free ≈10 req/min (Groq ≈30) — space the LLM-heavy suites so 429s
don't skew P95 (a 429 is a silent failover to the scripted twin, still under budget — the child
never sees an error). The tools report how many turns were actually LLM-served (`llm_used`).

**Tuning checklist (apply in order):** scripted fast-path coverage check → max-output-token cap →
learner-card trim (≤400 tokens) → stream first sentence only → region check → chip double-tap guard.

---

## 5. Acceptance criteria → evidence (what judges see)

| Requirement | Acceptance test (run live) | Evidence in the submission |
|---|---|---|
| R1 Progressive L1–L3 | Run L1 lesson; load the **preloaded mid-L2 save state** to show L2 + graduation in one click | Progression rules (doc 03 §2) + demo segment + dev panel showing boxes/level |
| R2 Mode detection | Type "i want to play" (→🎮) · trigger 3 misses (→check-in) · type "i'm tired" (→💚) | Mode log overlay in dev build + doc 03 §3 tables + demo segment |
| R3 SEL | Observed live: feeling check-in, effort praise, recast after wrong chip, Calm Corner, goodbye ritual — count ≥4 micro-moments | Micro-moment library (doc 03 §4) + video where each fires |
| R4 Context-aware | Day-2-style reference ("Yesterday: duck 🦆") + interest injection (dino skinning) using the preloaded learner card | Learner-card inspector in dev panel + doc 03 §5 |
| R5 Latency < 2 s | Live latency badge during the demo + Suite A/B/C tables | Latency screenshot + table in README + doc 02 §3 budget |
| *(anti-expectation)* "Where's the voice?" | 20-second answer prepared: "The brief asks for a chatbot — voice was never required; every interaction is tap or type, and no audio pipeline exists." | Positioning paragraph in README (doc 01 §7) |

**Preloaded save state** (build in M4): a ready-made profile mid-L2 with history — it makes R1/R4
provable in one demo click even if the live session starts at L1.

---

## 6. Demo storyboard (3 minutes, recordable even if judges only read it)

| Time | Beat | Requirement shown |
|---|---|---|
| 0:00–0:15 | Intro: "Meet Milo: a chatbot that teaches English to under-7s. No reading required — and no microphone needed." Show Home + latency badge armed | — |
| 0:15–0:55 | Live L1 lesson: tap the correct chip (star chime + praise) → tap a wrong chip on purpose (recast, soft amber glow, no red X) → **type a typo** "rad" → Milo celebrates and recasts "RED 🔴" | R1, R3 |
| 0:55–1:20 | Type "i want plaay" → chip 🎓→🎮, Simon-says tap game with lesson words | R2 |
| 1:20–1:45 | Type "i'm tired…" → chip →💚, Calm Corner breathing (each tap = one guided breath), recovery offer, difficulty drop | R2, R3 |
| 1:45–2:15 | Load preloaded mid-L2 profile: Milo references yesterday's duck + asks about the blue dino → level proof + graduation overlay | R1, R4 |
| 2:15–2:40 | Edge-case montage: typo "elefant" recast · off-topic cat detour → bridged · "I'm bored" → stretch word · home-language bridge line | R2, R3, robustness |
| 2:40–3:00 | Close: latency table on screen (first words ≈0.6–0.9 s, full replies ≈1.0 s p95, scripted twins ≈10–70 ms). "Kill the LLM and it still teaches" — optionally kill the key live, show scripted mode | R5, robustness |

**Fallbacks during recording:** **LLM-off scripted toggle** (prove the hybrid story instead of
failing) · pre-recorded backup video of each critical beat · chips-only path if anything else
misbehaves. Never fight a glitch live; switch and narrate ("watch the fallback kick in — this is by design").

---

## 7. Risk register

| Risk | P | Impact | Mitigation (owner: whoever is free) |
|---|---|---|---|
| Typed input from real kids is wilder than the test set | Med | Demo stumbles | Typo test set in M4 + phonetic aliases + graceful recast turning any miss into warmth; chips remain the escape hatch |
| Judges expect speech (brief never asks) | Med | Perception gap | 20-second scripted answer + README positioning (doc 01 §7) |
| LLM/API outage demo day | Low-Med | Demo dies | Scripted mode toggle (built in M5); both free-tier keys verified tonight (one live schema'd call each, exact model IDs pinned); automatic per-request failover Gemini → Groq → scripted so 429s/timeouts never surface |
| Host cold start / free-tier spin-down | Med | Judges' first click is slow or dead | Pick a host that stays warm; if on a free tier add a keep-alive ping (every ~5 min) or a cheap paid instance for demo day; verify the live URL from a phone on mobile data in M6 |
| Latency regression from a late feature | Med | R5 at risk | Latency pass B is a gate; freeze at 17:15 enforced |
| Scope creep (shiny feature!) | High | Missing freeze | Cut list above; only demo-visible work survives triage |
| Child demo-guest shy on camera | Med | Weak video | Rehearsed adult-imitating-child as on-camera fallback; preloaded turns |
| Judges probe safety/privacy | Med | Trust | Doc 02 §8 + README safety note + retention-off posture stated in the demo |
| Stale local env / device quirks | Med | Time sink | Test on the exact demo device by 15:15, not later |

---

## 8. Submission checklist (packaged by 18:15)

- [ ] Working **public demo URL** — opened from a phone on mobile data (never localhost), key verified live; plus local run instructions (5 lines max) as a fallback
- [ ] README: one-paragraph pitch, requirement → evidence table (doc 06 §5), latency table, safety note, the "voice out of scope" positioning line
- [ ] 3-min demo video (+ backup video file, offline copy)
- [ ] These planning docs (analysis, architecture, learning design, UI/UX, journeys)
- [ ] Typos/edge-case test results table (30 inputs) + mode-detection labeled set (60 turns) if the classifier shipped
- [ ] Screenshots: Home · lesson with chips · typo recast · Calm Corner · graduation
- [ ] Credits: assets, "built with" list
- [ ] Submit with ≥30 min buffer; keep one person watching the submission channel

---

## 9. Stretch queue (only after freeze, only if genuinely ahead)

Ordered by judge-impact: L3 storybook swipe pages → word-level spelling micro-feedback →
sticker-book page animations.
Each is additive; none is load-bearing for R1–R5.
