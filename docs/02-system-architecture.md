# 02 · System Architecture, Latency & Tech Stack

*How the system is shaped, how a single chat turn flows, and how we stay under 2 seconds with room to spare.*

## 1. Architecture at a glance

```
┌──────────────────── Child device (tablet / phone, browser) ─────────────────────┐
│  Chat shell — message bubbles, emoji-first, tappable answer chips, big keyboard  │
│  Milo mascot states · local cache: current lesson state · offline lesson pack   │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │  SSE over HTTPS: replies stream down; messages go up via POST
┌───────────────────────────────────────▼──────────────────────────────────────────┐
│  Realtime orchestrator (region-local; Node + Fastify, async)                      │
│                                                                                   │
│   ① Input filter ──► ② Mode detector (rules → tiny text classifier)               │
│   ③ Dialog manager ──► ④ Curriculum engine (levels · Leitner · session composer)  │
│   ⑤ Composer:                                                                    │
│        scripted fast-path (chip answers, ~0 ms)   ‖   LLM (schema-constrained)    │
│   ⑥ Output filter (parallel) ──► ⑦ Stream reply (bubbles + chips)                 │
│                                                                                   │
│  Memory: learner card + last-6-turn window + spaced-repetition due list           │
│  Data: SQLite (demo) → Postgres (prod) · events log (latency, modes, safety)      │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**Component responsibilities (and what each one is *not* allowed to do):**

| Component | Owns | Explicitly does NOT |
|---|---|---|
| Curriculum engine | Level, item selection, mastery math, session composition | Never generates language |
| Mode detector | Choosing interaction mode + confidence | Never picks content |
| Dialog manager | Turn state: what's expected, advance/retry/scaffold | Never invents curriculum rules |
| LLM composer | Phrasing, free conversation, empathy lines | Never decides level or progression |
| Safety filter | Input + output content checks (both directions) | Never blocks on latency (parallel, timeout-tolerant) |
| Scripted bank | Guaranteed lines for known situations (≥4 variants each) | Never covers free conversation (that's the LLM's job) |

Core promise, unchanged: **pedagogy is deterministic, warmth is generative.**

---

## 2. A single turn, step by step

Two representative turns:

**Turn A — chip answer (the common teaching turn).** Child taps the 🔴 *red* chip when asked "Which one is RED?".
**Turn B — free text.** Child types "i like the red ball ☺️" during Talk mode.

| # | Step | Turn A (chip) | Turn B (typed) | Notes |
|---|---|---|---|---|
| 0 | Child sends input | t = 0 | t = 0 | Chip tap = a small JSON payload; typing = text |
| 1 | Server receives | +50 ms | +50–100 ms | Region-local deploy keeps this small |
| 2 | Mode detector | rules: ~0 ms | rules: ~0 ms; classifier ≤150 ms if unclear | Chip taps carry intent for free ("answer", "play", "calm") |
| 3 | Curriculum decision | ≤5 ms | ≤10 ms | Compare answer to expected set (fuzzy match); decide advance / retry / scaffold / celebrate |
| 4 | Compose | scripted fast-path: ~0–20 ms | LLM first token: +300–600 ms | Chip answers are *known sets* → pre-templated replies with variants |
| 5 | Safety filter | parallel | parallel | Rule lexicon instant; moderation API overlapped, not serial |
| 6 | Stream reply to screen | +40–80 ms | +40–80 ms | Bubbles stream in; chips animate in after the text |
| — | **Total to reply start** | **≈ 0.15–0.3 s** | **≈ 0.6–1.0 s** | Worst realistic case ≈ 1.5 s |

Visual feedback beats the numbers: the child's own message (chip or text) appears instantly, Milo's
"..." thinking dots appear immediately after send, and the reply streams in — so *perceived* latency is lower than measured.

---

## 3. Latency budget (the requirement, budgeted honestly)

**Our definition (stated on the demo screen):** *child sends input (tap or typed message) → bot's
reply starts appearing*.

| Stage | P50 (ms) | P95 (ms) | How we get there |
|---|---|---|---|
| Input → server | 50 | 120 | Region-local deployment; tiny payloads |
| Mode detection | 10 | 150 | Rules resolve most turns; tiny text classifier only when ambiguous |
| Curriculum decision | 5 | 30 | In-memory state machine |
| Compose — chip turns (scripted fast-path) | 10 | 40 | Expected-answer set known → pre-templated reply variants |
| Compose — free text (LLM TTFT) | 380 | 600 | Small fast model, ≤120 output tokens, learner card ≤400 tokens |
| Safety filter | 0 (parallel) | +100 when flagged | Rule lexicon instant; moderation overlapped |
| Stream first bubble to render | 60 | 120 | Token streaming over SSE; render on first sentence |
| **Total — chip turn** | **≈ 0.2 s** | **≈ 0.5 s** | No LLM involved on the fast path |
| **Total — free-text turn** | **≈ 0.7 s** | **≈ 1.4 s** | LLM path; worst realistic ≈ 1.5 s |

**"Normal operating conditions" (stated as an assumption):** ≥5 Mbps link, warmed deployment,
region-local, one child typing/tapping on a standard tablet.

**Latency engineering levers, ranked by payoff:**
1. **Scripted fast-path for chip answers** — the majority of teaching turns never wait on an LLM.
2. **Streaming LLM output** — first bubble appears on the first sentence, not the full reply.
3. **Small fast model + tight schema** — short prompt (learner card, not raw history), ≤120 output tokens.
4. **Parallel safety** — the filter never serializes in front of the reply.
5. **Region-local deploy** — shrinks both network legs.
6. **Fallback ladder** — any LLM turn over its 1.2 s budget gets a cached line; the child never waits.

**Instrumentation (for the submission's evidence table):** per turn we log *t_send, t_server_recv,
t_mode, t_plan, t_llm_first_token, t_safety, t_stream_first, t_complete*. The dev build shows a live latency badge; the submission includes P50/P95 from
a 40-turn scripted suite run 3× (20 chip turns + 10 free-text + 10 worst-case).

---

## 4. Tech stack

| Layer | Recommended | Alternatives | Why |
|---|---|---|---|
| Frontend | React SPA (tablet-first layout) | Svelte, plain PWA | Team velocity; big-chip chat components; big-keyboard input |
| Backend | **Node (Fastify) + SSE** | Python FastAPI | One language with the React frontend; a single process serves the static build + chat API + stream |
| LLM | **Gemini Flash (Google AI Studio free tier)** primary · **Groq (free tier)** as automatic per-request failover — both card-free | Any small hosted model the team already has a key for | $0 build; TTFT 300–600 ms with schema-constrained output; scripted bank covers total outages |
| Moderation | Provider moderation API + local rule lexicon (input & output) | Llama Guard if local | Two-directional safety for a children's product |
| Data | SQLite → Postgres-class | — | Zero-ops for demo, clean upgrade path |
| Deploy | **One service (static frontend + chat API) on Fly.io / Render / Railway, in the region nearest the demo location** | Split frontend (Vercel) + backend hosts | One platform = one URL and one deploy path; region-local shrinks the network leg |

### Deployment notes (the deliverable is a public URL — localhost doesn't count)

- One service serves both the static frontend and the chat API (streaming over SSE) — fewest moving parts on a one-day build.
- **No-card check before M0:** confirm the chosen host's free tier signs up without a credit card — terms change often (Render's free web tier has historically been the reliable no-card option; Railway's is a one-time trial credit; verify Fly.io at signup).
- API keys live in platform **env vars**, never in the frontend bundle; HTTPS is standard on these platforms.
- On a free tier, add a **keep-alive ping** (every ~5 min) so a judge's first click never hits a cold start; seed the preloaded demo profile into the **deployed** database.
- Every milestone re-deploys the same URL (continuous deploy from the repo) — the live URL is the artifact everyone tests against.

---

## 5. Dialog manager & response schema

The dialog manager is a small explicit state machine:
`HOME → GREET → CHECK-IN → REVIEW → TEACH (model → join-in → independent) → PLAY → CELEBRATE → WRAP-UP`
plus interrupt states `CONVERSATION` and `SUPPORT_CALM`.

Every bot turn is a structured object (schema-constrained when produced by the LLM):

| Field | Purpose | Constraints |
|---|---|---|
| `mode` | Which interaction mode this turn serves | one of: learning / conversation / engagement / support |
| `say` | The message Milo sends | ≤2 sentences, ≤14 words each, emoji-anchored, level-locked vocabulary |
| `mood` | Milo's visual state | cheer / happy / think / care / celebrate / calm |
| `options[]` | Tappable answer chips (id, emoji/art, optional label) | 2–4 chips; **always present** so no typing is ever required |
| `expect{}` | Accepted child answers (type: chip / word / free / yes-no; answers list; fuzzy + phonetic aliases) | drives tolerant matching |
| `lesson_action` | Curriculum move this turn | present / retry / scaffold / advance / celebrate / break |
| `safety` | Filter verdict | ok / flagged (flagged → scripted redirect, logged in `events`) |

Because the LLM emits `mode` and `expect` *with* the message, one LLM call covers phrasing +
matching logic — fewer round trips, one less failure point. On the scripted fast-path, the same
object is assembled from templates with zero LLM involvement.

---

## 6. Prompt & memory architecture

**Learner card** (compact, regenerated each session; ~300–400 tokens):
- Nickname, age band, current level, reading-band note (chip-only vs types-along)
- Top 20 mastered words · top 10 struggling items
- Interests (dinosaurs, cats, …) — used to skin content ("the red *dino* ball")
- Last-session summary (2 lines, written at wrap-up by the summarizer)
- Today's due-review list · today's feeling check-in result
- Home-language hint (for one-line encouragement bridges only)

**System rules for the LLM (hard constraints, checked programmatically):**
1. Vocabulary only from the current level's word list + child's mastered words (the content engine supplies the list).
2. Max 2 sentences, ≤14 words each; one question per turn, maximum; emoji required on teaching turns.
3. Concrete nouns and present tense; no idioms, no sarcasm, no metaphor.
4. Corrections are **recasts only** ("Almost! It's RED 🔴 — reeeed. Your turn!") — never "wrong".
5. Praise must be effort-specific ("You wrote that *so* clearly!") — never generic "(2×) good job".
6. Always end with a clear next micro-action, and always attach `options[]` chips.
7. Comfort-first rule: if mode = support, no teaching content in the message, at all.
8. Safety: no scary/toilet/adult themes; if the child raises them → gentle in-world redirect (logged in `events`).
9. Child's name at most once per turn; the reply must be *shorter* than the effort it answers.
10. If unsure, prefer the scripted bank line for this situation (the engine supplies top options).

**Memory strategy:** raw turns are kept for the last 6 exchanges only; everything older is folded
into the rolling 2-line summary + structured progress rows (source of truth = database, not the
prompt). Small prompts keep TTFT and cost low and behavior consistent across sessions.

---

## 7. Data model (demo-scale)

| Table | Key fields | Purpose |
|---|---|---|
| `children` | id, nickname, age_band, reading_band, avatar, interests[], level, home_language, created_at | Profile |
| `items` | id, level, category, text, emoji/art_key | Content bank (all L1–L3 items) |
| `item_progress` | child_id, item_id, leitner_box(1–5), correct, wrong, last_seen, next_due | Spaced repetition + mastery |
| `sessions` | id, child_id, started, ended, mode_time (learn/chat/play/calm), mood_start, mood_end | Session analytics |
| `events` | id, session_id, ts, type (answer/mode_switch/praise/fallback/flagged), payload incl. latency timestamps | Full audit + latency logs |
| `badges` | child_id, badge_id, earned_at | Stickers/gamification |

---

## 8. Safety, privacy & ethics (children's product — treated as a first-class feature)

- **Two-directional moderation:** every child message and every bot message passes the filter.
  Flagged input → gentle in-world redirect (logged in `events`). Flagged output → never sent; scripted fallback.
- **Escalation:** repeated distress signals (sad/hurt/scared across sessions, or any safety flag
  category) are logged in `events` for review — the bot never resolves them alone.
- **Data minimization:** nickname only (no full name, no birthday day/month), no accounts, no email.
  Chat logs kept locally for the session, retention OFF by default (debug opt-in only, auto-expires 7 days).
  No audio exists anywhere — all interaction is text and taps.
- **Child autonomy:** a child can leave any session freely — stopping is always one tap, never a guilt-trip.
- **No ads, no external links, no data sharing, no endless-engagement mechanics** (session length is
  capped and wind-downs are enforced by design — the product *protects* attention, a point to state to judges).
- **Alignment with the spirit of COPPA / GDPR-K:** no accounts, minimal data (a nickname only),
  no ads, no third-party sharing; the posture is disclosed in plain language.

---

## 9. Reliability & degradation ladder

| Level | Trigger | Behavior |
|---|---|---|
| L0 | Normal | Full pipeline (scripted fast-path + streaming LLM; Gemini primary → Groq failover swap is automatic per request) |
| L1 | Both LLMs slow (>1.2 s), rate-limited, or errored | Scripted replies only; ≥4 wording variants per situation keep it natural; chips keep the pedagogy intact |
| L2 | Moderation provider down | Local rule lexicon only — still two-directional, just narrower |
| L3 | Network down mid-session | Offline lesson pack (service-worker cache): current lesson plays chips-only; progress syncs later |

Every level is demoable — *the bot never freezes, the child never waits.*

---

## 10. Non-functional targets (summary table for the submission)

| Target | Value |
|---|---|
| Reply start latency | Chip turns P50 ≈ 0.2 s / P95 ≤ 0.5 s · Free-text P50 ≤ 0.9 s / P95 ≤ 1.5 s |
| Session length | Default 6 min; wind-down forced at 12 min |
| Concurrency | Demo-scale: 10 simultaneous sessions comfortably |
| Availability | ≥ 99% during demo day via degradation ladder (no hard dependency on any single API) |
| Cost per session | **$0** — free-tier keys only (rate-limited; ample at demo scale) |
