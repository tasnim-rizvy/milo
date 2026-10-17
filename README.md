# Milo — AI English Learning Chatbot for Kids Under 7

Milo is a chat-first English learning companion for children from their **4th birthday until the day
before their 7th**. Kids tap emoji answer chips, read short words, and type when they're ready —
no microphone, no audio anywhere. A deterministic curriculum engine owns *what* to teach
(L1 → L3, spaced repetition, mastery gates, a graduation ceremony); the conversation itself stays
warm and social — feeling check-ins, a calm corner, effort praise — and switches between
**learning · conversation · engagement · support** on its own.

Built for the Brimsel take-home brief. Design documents live in [`docs/`](docs/): requirements
analysis, architecture, learning design, UI/UX plan, user journeys, and the build/demo plan.

---

## Live demo

| | |
|---|---|
| **Public preview** | <https://highlights-kept-bits-abs.trycloudflare.com> |
| **Durable deploy** | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tasnim-rizvy/milo) |

- The preview runs on a Cloudflare quick tunnel from the development machine — a real public URL,
  but it lives only while that machine is awake.
- The Render button deploys the same app durably: free Docker instance from
  [`render.yaml`](render.yaml), no credit card. Free instances sleep when idle; the first request
  after a nap takes ~30 s to wake.
- **No API keys needed.** The engine ships with a scripted fast-path, so every feature works with
  zero configuration (`llm: []` in `/api/health`). Gemini/Groq keys, when present, only add warmth
  on top — the ladder falls back to scripted within a 1.2 s first-token budget.
- **The current public preview runs with warmth live**: Groq answers free-chat and feelings turns
  (~0.7 s to first token, streaming to the bubble); chip/teaching turns stay instant and
  deterministic. `/api/health` lists exactly what's live.
- **Want live generations instead of the scripted bank?** Paste one free key — `GEMINI_API_KEY`
  (aistudio.google.com) and/or `GROQ_API_KEY` (console.groq.com), both card-free — into Render's
  environment (or `.env` locally). Free-chat and feelings turns then stream from the model within
  the budget above; teaching/chip turns stay instant and deterministic by design.

### 3-minute tour

1. **Maya** (starter profile) — tap a mood chip → answer a word task (tap the *wrong* chip first:
   Milo recasts, it never says "wrong") → type `i'm tired` → Calm Corner → breathe → goodbye
   ritual + star card.
2. **Aarav** (preloaded mid-L2, gate-ready) — one lesson asks him to say a word, read, count,
   answer yes/no, and build a sentence → **graduation ceremony** (confetti, badge, star bonus) →
   L3 sentence-building preview.
3. `?dev=1` shows the developer pill (🛠, bottom-right): engine phase, progress, live latencies,
   demo reset.

---

## Requirements → evidence

Live evidence in [`tools/evidence/`](tools/evidence/) was produced against the public URL
(base + timestamp stamped inside each JSON).

| Brief requirement | Where it lives | Verified by |
|---|---|---|
| **R1 · Teaches step-by-step, progress across sessions** | `server/src/engine/curriculum.js` — Leitner boxes, 80% mastery gate (coverage & first-try), 5-task stage check, graduation | 47 server tests · requirement-check `[R1]` ×3 (L1 lesson, gate-ready profile, `phase=STAGE`) · e2e “all 5 stage-check tasks answered”, “Aarav promoted L2 → L3” |
| **R2 · Not every turn is a lesson** | `server/src/engine/modes.js` — learning / conversation / engagement / support, hysteresis + idle cascade | requirement-check `[R2]` ×3 (`"i want plaay!"` → engagement, `"i'm tired"` → support, 3 misses → support) |
| **R3 · Social-emotional learning woven in** | `server/src/engine/sel.js` + `session.js` — recasts without the word “wrong”, effort praise, feeling check-ins, Calm Corner, goodbye ritual | requirement-check `[R3]` ×4 · e2e calm-corner & end-card checks · tests |
| **R4 · Remembers context across sessions** | learner card + spaced-repetition due list + recent turns (`session.js`, `curriculum.js`) | requirement-check `[R4]` ×2 (“Yesterday: elephant 🐘”, interests “dinosaurs”) |
| **R5 · Responds in < 2 s** | scripted fast-path for chips; streamed LLM only for free text, budgeted (`config.js`) | `tools/evidence/latency.json` (table below) · requirement-check `[R5]` ×3 (p95 chip 155 ms, text 33.5 ms, max 133.3 ms) |
| **No voice / no microphone** | no audio input APIs anywhere | requirement-check `[NO-VOICE]` (codebase-wide grep) |
| **No parent / grown-up surfaces** | all copy speaks to the child only | requirement-check `[NO-PARENT]` — all 266 user-facing lines scan clean |
| **Safety** | `server/src/engine/safety.js` — gentle redirects, never echoes, logs events | requirement-check `[SAFE]` — red-team list 6/6 redirect gently |

### Measured latency (scripted path, same machine)

| Suite | What it measures | p50 | p95 | max | Target |
|---|---|---|---|---|---|
| A · 19 chip turns | round trip → reply bubble | 110.3 ms | 155.0 ms | 155.0 ms | p95 ≤ 500 ms |
| B · 10 free-text turns | round trip → reply bubble | 33.3 ms | 33.5 ms | 33.5 ms | p95 ≤ 1500 ms |
| C · 10 worst-case turns | misses/idle/recast-heavy mix | 111.7 ms | 133.3 ms | 133.3 ms | < 2000 ms budget |

Measured on the app itself (server processing + stream). The public tunnel adds network time on
top; the < 2 s product budget still holds with a huge margin.

## Quickstart

```bash
git clone git@github.com:tasnim-rizvy/milo.git && cd milo
npm install          # workspaces: server + client
cp .env.example .env # optional: paste free GEMINI_API_KEY / GROQ_API_KEY inside
npm run build        # builds the React client into client/dist
npm start            # http://localhost:3001  (serves API + SSE + built client)
```

Requires **Node ≥ 22.5** (uses the built-in `node:sqlite` module). Verified on Node 26.

Development:

```bash
npm run dev:server   # Fastify on :3001, --watch
npm run dev:client   # Vite on :5173, proxies /api → :3001
```

## Tests & evidence

```bash
npm test             # 47 unit/integration tests (node --test)
npm run requirements # 18/18 live requirement checks → tools/evidence/requirement-check.json
npm run latency      # latency suites A/B/C     → tools/evidence/latency.json
npm run e2e          # 24-check headless browser tour → tools/evidence/ (+ 10 screenshots)
```

- `E2E_BASE=https://…` points every tool at any deployment (the committed evidence was captured
  against the public URL).
- `npm run e2e` needs Chrome/Chromium (`CHROME_PATH`, default `/opt/google/chrome/chrome`).
- Screenshots: [`01-home`](tools/evidence/01-home.png) … [`10-endcard-aarav`](tools/evidence/10-endcard-aarav.png) —
  the full tour, in order.

## Architecture

```
React + Vite client ── same origin ──▶ Fastify server (one process, no external services)
   chat UI, emoji chips,                  POST /api/session      → greeting turn
   calm corner, confetti,                 POST /api/message      → SSE: chunk* → turn → end
   sticker book, dev panel                GET  /api/health · /api/children · /api/progress/:key
                                          POST /api/reset-demo
```

- **Server internals** — `curriculum.js` (Leitner + gates), `modes.js` (input → mode),
  `session.js` (turn assembly, double-tap guard, idle cascade), `sel.js` (all child-facing lines),
  `safety.js`, `llm.js` (optional Gemini → Groq → scripted ladder), `store.js` + `seed.js`
  (`node:sqlite`, Maya + Aarav demo profiles seeded on boot).
- **Scripted-first by design**: teaching turns are known answer-sets, so chips answer instantly and
  deterministically; LLMs only add free-talk warmth and can never break pedagogy or latency.
- **Privacy**: no accounts, no credentials, local SQLite file, demo data resettable from the dev
  panel or `POST /api/reset-demo`.

## Deploy

```bash
docker build -t milo . && docker run -p 3001:3001 milo   # multi-stage, prod deps only
```

The image was verified locally (health endpoint, a full SSE chat turn, and the static client all
served from the container). On Render, [`render.yaml`](render.yaml) defines the free Docker web
service with a `/api/health` health check; `PORT`/`HOST` are read from the environment, and the
container is stateless — a fresh demo database is seeded on every boot.

## Documents

| File | Contents |
|---|---|
| [`docs/01-requirements-analysis.md`](docs/01-requirements-analysis.md) | Requirement-by-requirement analysis, reading-spectrum assumptions, design principles, scope |
| [`docs/02-system-architecture.md`](docs/02-system-architecture.md) | Architecture, turn lifecycle, latency budget, tech stack, data model, safety |
| [`docs/03-learning-design.md`](docs/03-learning-design.md) | L1–L3 curriculum, mastery/progression rules, mode-detection engine, SEL library |
| [`docs/04-ui-ux-plan.md`](docs/04-ui-ux-plan.md) | UX principles, visual system, screen-by-screen specs + wireframes |
| [`docs/05-user-journey.md`](docs/05-user-journey.md) | 4 end-to-end journeys with sample dialogues, edge-case playbook |
| [`docs/06-build-and-demo-plan.md`](docs/06-build-and-demo-plan.md) | Build plan to the deadline, MVP scope, latency test plan, demo script |
