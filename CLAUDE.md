# CLAUDE.md — Coachmate

## Overview

Coachmate is a free chess review app. A player links a Chess.com or Lichess profile, Stockfish reads their last 10 or 15 games in the browser, and they get a replayable review of each game, an AI coach's read on their habits, drills from their own mistakes, and a bot to play. No accounts, database or payments.

## Tech stack

- Next.js 14.2.35 App Router, React 18, strict TypeScript, plain CSS in `app/globals.css`, Vercel.
- chess.js 1.4 for PGN replay and legal moves. The board is our own (`app/board/Board.tsx`).
- Stockfish 19 lite single-threaded in `public/engine/`, GPLv3, run in a Web Worker.
- OpenRouter, default `deepseek/deepseek-v4-flash`, called only from the Edge route `app/api/coach/route.ts`.
- Archivo (variable width) and Reenie Beanie through `next/font`. No test framework.

## Layout

### `app/`
- `ReportProvider.tsx`: all run state. Fetch, review loop, coach calls, persistence, sample loading. `useReport()` is the only way screens reach it.
- `board/Board.tsx`: board with stable piece identity, drag, tap, promotion, arrows, keyboard. Parents must update `fen` synchronously inside `onMove`.
- `Strip.tsx`: the chart strip used for every game, plus `stripOf(game)`.
- `page.tsx` and `Hero.tsx`: landing. `report/`: progress and game list. `review/[id]/`: game review. `drill/`, `play/`, `method/`.
- `api/coach/route.ts`: the only server code. POST `{type:"report"|"game", data}`. Rate limit 12/min per IP, 24 KB body cap, 503 without a key.

### `lib/`
- `types.ts`: shared types.
- `games.ts`: Chess.com and Lichess fetch.
- `engine.ts`: `Engine` worker wrapper with a job queue, `BOT_LEVELS`, `UciReader`.
- `judge.ts`: Lichess win%, move accuracy, labels, game accuracy.
- `analysis.ts`: `reviewGame`, `buildProfile`, `ANALYSIS_DEPTH=14`.
- `explain.ts`: rule-written move notes. `insights.ts`: diagnosis. `patterns.ts`: recurring contexts.
- `coach.ts`: every payload that leaves the device.
- `store.ts`: `localStorage`. `sound.ts`: synthesized move sounds. `format.ts`: display helpers.
- `sample.json`, `hero.json`: built by `scripts/build-sample.ts`.

## Env vars

- `OPENROUTER_API_KEY`: server only. Without it everything else works and notes are written by rule.
- `COACH_MODEL`: optional.
- `NEXT_PUBLIC_SITE_URL`: optional, for OG URLs.

## Commands

```bash
npm run dev
npm run build
npx tsc --noEmit
npx tsx scripts/build-sample.ts
```

## Rules

- Privacy contract: only `lib/coach.ts` builds outgoing data. Never send a PGN, a full move list, a username or a game link.
- Numbers come from the engine and published formulas. Don't invent stats, Elo ranges or speed claims. Sample data is always labeled as bot games.
- Design rules live in `DESIGN.md`. The three inks are meaning, so black is the engine, blue is the coach and yellow is "you are here". Red is only for blunders and the falling trace.
- See `docs/ARCHITECTURE.md` for the data flow.
