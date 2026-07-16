# CLAUDE.md — Coachmate

## Overview

Coachmate (package name `coachmate`) is a free, mobile-first chess coaching web app. A player types a Chess.com username and gets a plain-English readout of their recurring mistakes from recent games. All game analysis runs **in the browser** using a vendored Stockfish (WASM) engine in a Web Worker. The only server call sends an *aggregate* weakness summary (counts, a few representative example moves, recurring patterns) to an LLM to generate the human-readable coaching paragraph — full games are never sent off-device. Flagged blunders are reviewable on an interactive board ("Find a better move" drills), and there is a separate tunable play-vs-bot mode. No accounts, no database, no payments.

## Tech Stack

- **Next.js 14.2.5**, **App Router** (`app/` dir), React 18, **TypeScript** (strict).
- Deployed on **Vercel**. `reactStrictMode: false` in `next.config.mjs` (StrictMode double-mount breaks react-chessboard's react-dnd HTML5 backend).
- **chess.js** `^1.0.0-beta.8` — PGN replay, legal-move generation, phase/material logic, hanging-piece rule.
- **react-chessboard** `^4.7.3` — board UI (loaded via `next/dynamic`, `ssr: false`).
- **Stockfish** — single-threaded WASM build vendored at `public/stockfish.js`, run in a `Worker`. No `SharedArrayBuffer` / COOP/COEP headers needed (that's the whole point of the single-threaded build).
- **LLM: OpenRouter**, default model **`deepseek/deepseek-v4-flash`** (overridable via `COACH_MODEL`). Called server-side only from the Edge route `app/api/coach/route.ts`.
- Fonts: Fraunces (display) + Inter (sans) via `next/font/google`. Styling is plain CSS in `app/globals.css` (no Tailwind / CSS-in-JS).
- No test framework configured.

## Architecture

### `app/` (App Router)
- `layout.tsx` — root layout: fonts, metadata/OG/Twitter tags, `<Navbar/>`. `metadataBase` uses `NEXT_PUBLIC_SITE_URL`.
- `page.tsx` — **the Coach flow** (client component). Orchestrates the whole pipeline: input form → `fetchGames` → per-game `analyzeGame` loop (with progress + `sessionStorage` partial-result recovery) → `getCoaching` POST. Renders diagnosis, recurring patterns, evidence list, and the board drill. State is all `useState` here (no global store).
- `BoardDrill.tsx` — interactive "find a better move" trainer for a selected blunder. Runs its own `Engine` to score the user's attempt at `PUZZLE_DEPTH=12`; shows played move / best move, eval bar, and per-blunder practice status (solved/missed/later).
- `Evidence.tsx` — filterable list of flagged blunders (chips by mistake kind + phase), selection drives the board.
- `play/page.tsx` — **play-vs-bot** mode: tunable Elo (drives Stockfish "Skill Level"), color, clock, hint (full-strength suggest), takeback, resign.
- `Navbar.tsx`, `Logo.tsx` — brand + Coach/Play nav.
- `globals.css` — all styling.
- `api/coach/route.ts` — **only server code**. Edge runtime. Validates the profile, rate-limits (in-memory, 8/min/IP), caps body size (80 KB), builds the aggregate payload, calls OpenRouter, returns the coaching text. Returns 503 if `OPENROUTER_API_KEY` is unset (graceful degradation).

### `lib/`
- `types.ts` — all shared types: `Profile`, `BlunderExample`, `MistakeContext`, `RecurringPattern`, `FetchedGame`, `ProgressState`, `MistakeKind`, `Phase`, `TimeControl`.
- `chesscom.ts` — `fetchGames`: walks Chess.com monthly archives newest-first, filters by time control, collects up to N games (min 5). Throws `NotFoundError` / `NotEnoughGamesError`.
- `engine.ts` — `Engine` class: thin UCI wrapper over the Stockfish Worker. `evaluate(fen, depth)` for analysis; `setStrength`/`bestMove`/`suggest` for the bot. Scores normalized to White's perspective in centipawns; mate clamped to ±10000.
- `analysis.ts` — `analyzeGame` (the blunder detector) + tunable constants + `emptyProfile`/`mergeProfile`. PGN replay, blunder detection with same-depth best-move re-validation, hanging-piece rule, mistake classification.
- `patterns.ts` — `buildPatternPayload`: finds *recurring context patterns* (mistake-kind × castle state / phase / material balance) using concentration + over-representation scoring. Surfaced in the report and sent to the LLM.
- `insights.ts` — UI-facing labels/copy + `buildDiagnosis` (picks the top mistake kind and confidence), `bestMoveSan`, `whyFlagged`, `formatClock`.
- `demo.ts` — `DEMO_PROFILE` / `DEMO_COACHING` for the "View demo report" button.

### `public/`
- `stockfish.js` (vendored WASM engine, GPLv3), `favicon.svg`, `og.svg` (1200×630 social image).

### Main user flow
`enter username → fetch Chess.com games → in-browser Stockfish analyze each game → classify blunders by phase + mistake kind, flag hangs → pattern-match recurring contexts → build aggregate diagnosis → (optional) POST aggregate to OpenRouter for coaching text → review/drill blunders on the board`.

## External services / env vars

From `.env.example`:
- `OPENROUTER_API_KEY` — **required for coaching text only**; server-side, never reaches the browser. Without it everything else (analysis, evidence, drills, play-vs-bot) still works.
- `COACH_MODEL` — optional, defaults to `deepseek/deepseek-v4-flash`.
- `NEXT_PUBLIC_SITE_URL` — optional, used for absolute social/OG metadata URLs.

External APIs: **Chess.com public API** (`api.chess.com/pub/...`, no key) for archives/games; **OpenRouter** (`openrouter.ai/api/v1/chat/completions`) for coaching.

## Commands

```bash
npm run dev     # next dev (http://localhost:3000)
npm run build   # next build — the production build is the verification gate
npm run start   # next start
npm run lint    # next lint
```
No test command exists.

## Conventions & notes

- **Privacy contract:** only aggregate stats + a few representative moves + recurring patterns go to the LLM (`buildUserPayload` in the coach route). Never send full games/PGN.
- **Calibration constants** live in `lib/analysis.ts`: `DEFAULT_DEPTH=8`, `BLUNDER_THRESHOLD_CP=250`, `MAX_PLIES=80`, `OPENING_LAST_MOVE=12`. Depth is deliberately low (catch blunders, not play correspondence). Physical-device calibration on a mid-range phone is a pre-launch gate (see README table — still "pending").
- Analysis can pin the CPU for minutes; partial per-game results are saved to `sessionStorage` (`cwc:profile` / `cwc:complete`) so an interrupted run still shows a labeled "partial" report.
- The hanging-piece rule is a simple next-capture heuristic; intended sacrifices / zwischenzug can be false positives (accepted for v1).
- `/api/coach` rate limit is in-memory per edge isolate — not durable across isolates; fine for v1, swap to a shared store for sustained traffic.
- Scope is intentionally small (v1): Chess.com only, no accounts/DB/payments. See `plans/launch.plan.md`.
- See `docs/ARCHITECTURE.md` for the deeper data-flow walkthrough.
