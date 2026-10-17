# Milo — AI English Learning Chatbot for Kids Under 7

**Competition deliverable plan · Deadline: Sunday, Oct 18, 2026, 7:00 PM**

> Milo is a chat-first English learning companion for children aged 4–6 — from the 4th birthday until the day before the 7th. The child taps emoji
> answer chips, reads short simple words, and types when ready — no microphone required.
> A deterministic curriculum engine owns *what* to teach; an LLM adds *warmth* — so Milo teaches
> step-by-step (L1→L3), reads the child's mood from the conversation, switches modes, and replies
> in well under 2 seconds.

---

## TL;DR of the design

| Decision | Choice | Why |
|---|---|---|
| Target audience | **Ages 4 to just-under-7 (from the 4th birthday until the day before the 7th; “over 6 but not 7 yet” included)** | 2–3 excluded by design: toddlers need songs and play, not academic lessons — a different product |
| Primary interface | **Chat: emoji-rich bubbles + tappable answer chips + short words; typing welcome** | Matches the brief exactly; works across the reading spectrum (tapping for pre-reading 4s, typing for early-reader 5–6s) without any audio pipeline |
| AI approach | **Hybrid**: scripted curriculum engine + LLM for free talk & emotional phrasing | Deterministic pedagogy, guaranteed latency, generative warmth |
| Fastest path | **Scripted fast-path for chip answers** + streamed LLM for free text | Most teaching turns are known answer-sets → near-instant; <2 s holds with big margin |
| Modes | Learning · Conversation · Play · Calm | Requirement #2: don't teach every turn |
| Mode detection | Rules tier (instant) + tiny text classifier (≈150 ms) + hysteresis | The child "speaks" through what they send and how they behave (misses, idle, skips) |
| SEL | CASEL-mapped micro-moments, feeling check-in, breathing corner, effort praise | Requirement #3, woven into every turn — not a separate feature |
| Progression | Leitner spaced repetition + 80% mastery gate + graduation ceremony | Requirement #1, evidence-based |
| Context | "Learner card" (compact profile) + spaced-repetition due list + last 6 turns | Requirement #4 without huge prompts |
| Latency target | **Chip turns P50 ≈ 0.2 s · free-text turns P50 ≤ 0.9 s / P95 ≤ 1.5 s** to first reply bubble | Text path leaves large margin; requirement met on every path |
| Privacy | No accounts, minimal logs, retention off by default; no audio exists anywhere | It's a children's product — judges will ask |
| Voice | **Out of scope** — no microphone, no audio pipeline anywhere in the system | The brief asks for a chatbot; leaving audio out keeps the stack simple and latency trivially safe |

## Documents

| File | Contents |
|---|---|
| [`docs/01-requirements-analysis.md`](docs/01-requirements-analysis.md) | Requirement-by-requirement analysis, reading-spectrum assumptions, design principles, scope |
| [`docs/02-system-architecture.md`](docs/02-system-architecture.md) | Architecture, turn lifecycle, latency budget, tech stack, data model, safety |
| [`docs/03-learning-design.md`](docs/03-learning-design.md) | L1–L3 curriculum, mastery/progression rules, mode-detection engine, SEL library |
| [`docs/04-ui-ux-plan.md`](docs/04-ui-ux-plan.md) | UX principles, visual system, screen-by-screen specs + wireframes |
| [`docs/05-user-journey.md`](docs/05-user-journey.md) | 4 end-to-end journeys with sample dialogues, edge-case playbook |
| [`docs/06-build-and-demo-plan.md`](docs/06-build-and-demo-plan.md) | Hour-by-hour plan to the deadline, MVP scope, latency test plan, demo script |

## Suggested next step

Freeze the MVP scope in `docs/06-build-and-demo-plan.md`, then build the "M0 demo spine"
(chat round trip → curriculum → modes → polish) and record the backup demo video.
