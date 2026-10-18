# Milo — AI English Learning Chatbot for Kids Under 7

Milo is a chat-first English learning companion for children from their **4th birthday until the day
before their 7th**. Kids tap emoji answer chips, read short words, and type when they're ready —
no microphone, no audio anywhere. A deterministic curriculum engine owns *what* to teach
(L1 → L3, spaced repetition, mastery gates, a graduation ceremony); the conversation itself stays
warm and social — feelings read from what the child writes, a calm corner, effort praise — and switches between
**learning · conversation · engagement · support** on its own.

Built for the Brimsel take-home brief. Design documents live in [`docs/`](docs/): requirements
analysis, architecture, learning design, UI/UX plan, user journeys, and the build/demo plan.

---

## Live demo

| | |
|---|---|
| **Main link** | A Cloudflare quick tunnel from the development machine — `npm run tunnel` prints the live URL (the link is shared in the submission message; it changes on every restart) |
| **Always-up backup** | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tasnim-rizvy/milo) — free Docker instance from [`render.yaml`](render.yaml) |

- **Main link (tunnel).** Fast and keeps every child's saved progress (SQLite on the host's disk),
  but it is only up while the host machine is awake and Milo + the tunnel are running. Streaming
  replies work through it (checked: words arrive as separate chunks, a whole reply in < 0.75 s
  from outside the machine).
- **Backup (Render free tier) — read this before testing it.** The free tier **sleeps after ~15
  minutes idle (the first visit then takes 30–60 s)** and its disk is temporary, so **profiles and
  progress can reset after a sleep, restart or redeploy**. A free uptime monitor pinging
  `/api/health` every 5 minutes (e.g. UptimeRobot) keeps it awake. It is a convenience backup, not
  the primary demo; durable storage (a persistent disk or an external database) is the production
  next step.
- **Profiles, no logins.** A child is profiled by a short first-run form (name, age 4–6, can they
  read, favourite things). Profiles belong to the device that made them (a random id kept in the
  browser) — nobody else can list, open or delete them. No emails, passwords or accounts.
- **No API keys needed.** The engine ships with a scripted fast-path, so every feature works with
  zero configuration (`llm: []` in `/api/health`). Gemini/Groq keys, when present, only add warmth
  on top — the ladder falls back to scripted within a 1.2 s first-token budget.
- **With a Groq key the AI phrases every warmth moment** — free
  chat, feelings, praise, gentle recasts, growth check-ins — from strict engine
  "turn briefs" (~0.5–0.8 s to first token, streaming to the bubble). The engine still owns all
  task logic, chips, stars and safety; every briefed line has a scripted twin that serves when the
  model is slow, rate-limited, or its output fails the programmatic checks.
- **One action → one bubble.** Every tap or message gets exactly one Milo bubble — no stacked
  replies. Warmth is AI-phrased from the turn brief; when an exact teaching line must follow (the
  next question, the word model), it merges into that same bubble and the model must end with it
  verbatim (programmatically checked, scripted twin as the net). The Calm Corner keeps the same
  turn-taking rhythm: each [🫧 One more] tap guides one breath, then Milo hands the turn back.
- **Want live generations instead of the scripted bank?** Paste one free key — `GROQ_API_KEY`
  (console.groq.com, card-free) — into Render's environment (or `.env` locally). A
  `GEMINI_API_KEY` (aistudio.google.com) is also supported as an optional extra rung, but on some
  networks Gemini's first byte is far too slow to ever serve. With a key, warmth moments stream
  from the model within the budget above; with no key, the scripted bank runs every moment — the
  whole lesson stays playable offline.

### 3-minute tour

1. **First run** — the welcome form (name, age, "can you read little words?", things you love) →
   **Let's go!** → Milo says hello and asks a picture puzzle (no mood buttons — feelings are read
   only from what the child types) → a first word task (tap the *wrong* chip first: Milo recasts,
   it never says "wrong") → type `i'm tired` or `i am angry` → support mode / Calm Corner (each tap
   = one guided breath) → ✕ goes straight home → **📈 My progress** (level path, words known,
   feelings shared, stickers that unlock early).
2. **Edit a profile** — **Kids 👥** → answer the small maths question → Edit (name, age, picture,
   reading, interests; level and stars are never touched).
3. **Demo mode** (`npm run start:demo`) adds two preloaded profiles for the evidence tools:
   **Maya** (fresh L1) and **Aarav** (mid-L2, gate-ready: a lesson → **graduation ceremony** with
   confetti, badge and star bonus → L3 sentence-building preview).
4. `?dev=1` shows the developer pill (🛠, bottom-right): engine phase, progress, live latencies,
   demo reset.

---

## Requirements → evidence

Live evidence in [`tools/evidence/`](tools/evidence/) is stamped with the exact base URL and
timestamp it was produced against (the committed run: `http://localhost:3001`).

| Brief requirement | Where it lives | Verified by |
|---|---|---|
| **R1 · Teaches step-by-step, progress across sessions** | `server/src/engine/curriculum.js` — Leitner boxes, 80% mastery gate (coverage & first-try), 5-task stage check, graduation | 80 server tests · requirement-check `[R1]` ×3 (L1 lesson, gate-ready profile, `phase=STAGE`) · e2e “all 5 stage-check tasks answered”, “Aarav promoted L2 → L3” |
| **R2 · Not every turn is a lesson** | `server/src/engine/modes.js` — learning / conversation / engagement / support, hysteresis + idle cascade | requirement-check `[R2]` ×3 (`"i want plaay!"` → engagement, `"i'm tired"` → support, 3 misses → support) |
| **R3 · Social-emotional learning woven in** | `server/src/engine/sel.js` + `session.js` — recasts without the word “wrong”, effort praise, feelings read from typed words, wonder puzzles, Calm Corner, goodbye ritual | requirement-check `[R3]` ×4 · e2e calm-corner & end-card checks · tests |
| **R4 · Remembers context across sessions** | learner card + spaced-repetition due list + recent turns (`session.js`, `curriculum.js`) | requirement-check `[R4]` ×2 (“Yesterday: elephant 🐘”, interests “dinosaurs”) |
| **R5 · Responds in < 2 s** | streamed warm replies with a 1.2 s first-token budget + scripted twins that answer instantly when the model can't | `tools/evidence/latency.json` (table below) · requirement-check `[R5]` ×4 — chip p95 974 ms, first words p95 938 ms, text p95 746 ms, max 1290 ms |
| **No voice / no microphone** | no audio input APIs anywhere | requirement-check `[NO-VOICE]` (codebase-wide grep) |
| **No parent / grown-up surfaces** | all copy speaks to the child only | requirement-check `[NO-PARENT]` — all 258 user-facing lines + the client UI copy scan clean |
| **Safety** | `server/src/engine/safety.js` — gentle redirects, never echoes, logs events | requirement-check `[SAFE]` — red-team list 6/6 redirect gently |

### Measured latency (warmth live on Groq, same machine)

| Suite | What it measures | full p50 / p95 | first words p50 / p95 | Target |
|---|---|---|---|---|
| A · 19 chip turns | tap → streamed praise/recast complete (18/19 LLM-served) | 587 / 974 ms | 551 / 938 ms | full p95 ≤ 1500 ms · first words p95 ≤ 1100 ms |
| B · 10 free-text turns | chat turn complete (10/10 LLM-served) | 592 / 746 ms | 549 / 707 ms | full p95 ≤ 1500 ms |
| C · 10 cold starts | session create + greeting + puzzle chip → first task | 1169 / 1290 ms | 1126 / 1253 ms | all < 2000 ms budget |

Measured on the app itself (server processing + streaming) with a free-tier key. When the model is
slow or rate-limited, the scripted twin answers instead — always inside the same budget (fastest
fallback sample: 9.9 ms). The public tunnel adds network time on top; the < 2 s product budget
still holds. *(This table was measured with the earlier mood-chip opener; the engine's per-turn
work is unchanged, but rerun `npm run latency` on a rested Groq quota to refresh it.)*

## Quickstart

```bash
git clone git@github.com:tasnim-rizvy/milo.git && cd milo
npm install          # workspaces: server + client
cp .env.example .env # optional: paste free GEMINI_API_KEY / GROQ_API_KEY inside
npm run build        # builds the React client into client/dist
npm start            # http://localhost:3001  (serves API + SSE + built client)
npm run tunnel       # optional: public URL via Cloudflare quick tunnel (needs `cloudflared`)
```

Requires **Node ≥ 22.5** (uses the built-in `node:sqlite` module). Verified on Node 26.

Development:

```bash
npm run dev:server   # Fastify on :3001, --watch
npm run dev:client   # Vite on :5173, proxies /api → :3001
```

## Tests & evidence

```bash
npm test             # 80 unit/integration tests (node --test)
npm run start:demo   # (separate terminal) demo mode: Maya + Aarav fixtures, own demo.db, plain opener
npm run requirements # 19/19 live requirement checks → tools/evidence/requirement-check.json
npm run latency      # latency suites A/B/C     → tools/evidence/latency.json
npm run e2e          # 23-check headless browser tour → tools/evidence/ (+ 10 screenshots)
```

- The three evidence tools expect the **demo-mode** server (`npm run start:demo`) — they play the
  preloaded Maya/Aarav profiles. Set `GROQ_API_KEY=` (empty) for a scripted-only run that spends
  no AI quota.
- `E2E_BASE=https://…` points every tool at any deployment (the committed evidence was captured
  against a local scripted-only demo server (`http://localhost:3002`), stamped inside each JSON).
- `npm run e2e` needs Chrome/Chromium (`CHROME_PATH`, default `/opt/google/chrome/chrome`).
- Screenshots: [`01-home`](tools/evidence/01-home.png) … [`10-endcard-aarav`](tools/evidence/10-endcard-aarav.png) —
  the full tour, in order.

## Architecture

```
React + Vite client ── same origin ──▶ Fastify server (one process, no external services)
   chat UI, emoji chips,                  POST /api/session      → greeting turn
   calm corner, confetti,                 POST /api/message      → SSE: chunk* → turn → end
   progress screen, dev panel             GET  /api/health · /api/children · /api/progress/:key
                                          POST/PATCH/DELETE /api/children (device-private)
```

- **Server internals** — `curriculum.js` (Leitner + gates), `modes.js` (input → mode),
  `session.js` (turn assembly, double-tap guard, idle cascade), `sel.js` (all child-facing lines),
  `safety.js`, `progress.js` (the My-progress summary), `llm/` (optional Gemini → Groq → scripted
  ladder; Groq tries a second model when the first is rate-limited), `store.js` + `seed.js`
  (`node:sqlite`; Maya + Aarav fixtures only in demo mode).
- **Engine decides, model phrases**: every pedagogical decision (which word, stars, gates, chips,
  safety) is deterministic code; the LLM only finds warmer words for a strict per-turn brief, and
  programmatic checks (must-word, never "wrong", no dangling question, no verbatim repeats) send
  the scripted twin whenever a generation drifts.
- **Privacy**: no accounts, no passwords, no emails — a profile holds only a first name, an age
  (4–6), an avatar, a reading level and favourite things, and belongs to the browser that created
  it. The only data sent off the server is the child's chat text to the LLM provider (Groq), with no
  identifiers. Cross-origin writes are refused, and provider error text stays in the server log.

## Deploy

```bash
docker build -t milo . && docker run -p 3001:3001 milo   # multi-stage, prod deps only
```

The image was verified locally (health endpoint, a full SSE chat turn, and the static client all
served from the container). On Render, [`render.yaml`](render.yaml) defines the free Docker web
service with a `/api/health` health check; `PORT`/`HOST` are read from the environment, and the
container's disk is temporary on the free tier, so profiles reset when it sleeps or redeploys
(see the Live demo notes). Set `GROQ_API_KEY` in the dashboard to enable the AI.

## Documents

| File | Contents |
|---|---|
| [`docs/01-requirements-analysis.md`](docs/01-requirements-analysis.md) | Requirement-by-requirement analysis, reading-spectrum assumptions, design principles, scope |
| [`docs/02-system-architecture.md`](docs/02-system-architecture.md) | Architecture, turn lifecycle, latency budget, tech stack, data model, safety |
| [`docs/03-learning-design.md`](docs/03-learning-design.md) | L1–L3 curriculum, mastery/progression rules, mode-detection engine, SEL library |
| [`docs/04-ui-ux-plan.md`](docs/04-ui-ux-plan.md) | UX principles, visual system, screen-by-screen specs + wireframes |
| [`docs/05-user-journey.md`](docs/05-user-journey.md) | 4 end-to-end journeys with sample dialogues, edge-case playbook |
| [`docs/06-build-and-demo-plan.md`](docs/06-build-and-demo-plan.md) | Build plan to the deadline, MVP scope, latency test plan, demo script |
