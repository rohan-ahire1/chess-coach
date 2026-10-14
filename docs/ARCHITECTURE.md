# Coachmate — Architecture

This document explains how Coachmate ingests Chess.com games, analyzes them in the browser, computes and surfaces weaknesses, and generates coaching text. See `CLAUDE.md` for the quick reference.

## High-level shape

Coachmate is a thin Next.js (App Router) app where **almost all compute happens client-side**. The only server code is one Edge route, `app/api/coach/route.ts`, which exists purely to keep the OpenRouter API key off the client and to turn aggregate stats into a coaching paragraph. There is no database, no auth, and no server-side game storage. Per-run state lives in React `useState` plus `sessionStorage`.

## Data flow

```
                          ┌─────────────────────────── Browser (client) ───────────────────────────┐
                          │                                                                          │
  user types username     │   app/page.tsx (Coach orchestrator, "use client")                       │
  ─────────────────────►  │      │                                                                   │
                          │      │ 1. fetchGames()                                                   │
                          │      ▼                                                                   │
                          │   lib/chesscom.ts ──HTTPS──►  api.chess.com/pub/...   (no key)           │
                          │      │  walk monthly archives newest-first, filter by time control,      │
                          │      │  collect up to N games (min 5)                                    │
                          │      ▼                                                                   │
                          │   for each game: analyzeGame()  (lib/analysis.ts)                        │
                          │      │  replay PGN (chess.js) ──► evaluate positions                     │
                          │      ▼                                                                   │
                          │   lib/engine.ts  ──postMessage(UCI)──►  Worker: public/stockfish.js      │
                          │      │  cp + bestmove per FEN (depth 8)                                  │
                          │      ▼                                                                   │
                          │   classify blunder + hang ──► mergeProfile() ──► Profile                 │
                          │      │  (saved to sessionStorage after every game)                       │
                          │      ▼                                                                   │
                          │   buildPatternPayload() (lib/patterns.ts)                                │
                          │   buildDiagnosis()      (lib/insights.ts)                                │
                          │      │                                                                   │
                          │      │ 3. POST /api/coach  (aggregate Profile only)                      │
                          │      ▼                                                                   │
                          └──────┼───────────────────────────────────────────────────────────────────┘
                                 │
                          ┌──────▼─────────────────── Edge (server) ───────────────────────────────┐
                          │   app/api/coach/route.ts                                                │
                          │     rate-limit (8/min/IP) · size-cap (80KB) · validate                  │
                          │     buildUserPayload(profile)  ── counts, top-5 example moves,           │
                          │       worst hangs, recurring patterns (NO full games / PGN)              │
                          │        │                                                                 │
                          │        ▼                                                                 │
                          │   OpenRouter ──► model COACH_MODEL (default deepseek/deepseek-v4-flash)  │
                          │        │  system prompt: warm direct coach, ≤200 words, no jargon        │
                          │        ▼                                                                 │
                          │   { coaching: "<text>" }  ───────────────────────────────────────►  UI  │
                          └─────────────────────────────────────────────────────────────────────────┘
```

## Game ingestion (`lib/chesscom.ts`)

`fetchGames(username, timeControl, maxGames, onProgress)`:

1. GET `api.chess.com/pub/player/{user}/games/archives` → list of monthly-archive URLs. 404 → `NotFoundError`.
2. Walk archives **newest-first** (reverse the array), up to `MAX_ARCHIVES_TO_WALK = 18` months. Within each month, walk games newest-first.
3. Keep games whose `time_class` matches the requested control (`rapid` / `blitz` / `all`), reducing each to a `FetchedGame` (`pgn`, `timeClass`, `timeControl`, `playerIsWhite`, `playerRating`, `endTime`, `url`). Stop once `maxGames` collected.
4. Fewer than `MIN_GAMES = 5` → `NotEnoughGamesError(found)`. The player's "current rating" is taken from the most recent game.

Chess.com has no "last N games" endpoint, hence the archive walk.

## Position evaluation (`lib/engine.ts`)

`Engine` wraps the Stockfish Worker and speaks UCI:
- Constructor spins up `new Worker("/stockfish.js")`, sends `uci` + `isready`, resolves `ready` on `uciok`/`readyok`.
- `evaluate(fen, depth)` → `{ cp, bestMove }`. It tracks the latest `info ... score cp|mate` line, then on `bestmove` converts the score to **White's perspective** and clamps mate to ±10000.
- Bot mode (`/play`): `setStrength(elo)` maps Elo→Skill Level 0–20; `bestMove` uses `go movetime` scaled by skill; `suggest` temporarily forces full strength for the hint button.

The heavy search runs inside the Worker, so the main thread/UI never freezes. `page.tsx` also `await new Promise(r => setTimeout(r, 0))` between games so the progress bar paints.

## Blunder analysis (`lib/analysis.ts`)

`analyzeGame(game, gameIndex, engine, depth)`:

1. **Replay** the PGN with chess.js into `PlyInfo[]` (capped at `MAX_PLIES = 80`): per-ply FEN before/after, piece moved/captured, clock (`[%clk]`), time spent, castle side, moves-since-castle.
2. For each ply by the analyzed player:
   - Evaluate `fenBefore` and `fenAfter` (cached by FEN). `rawLoss = evalBefore - evalPlayed` (player perspective).
   - **Quick reject** if `rawLoss < BLUNDER_THRESHOLD_CP (250)`.
   - **Re-validate against the engine's best move** at the *same depth* and same horizon: apply `before.bestMove`, evaluate it, compute `trueLoss = bestCp - playedCp`. This removes horizon false-positives (forced/only/best moves in already-lost positions). If the player already played the engine best move, skip. Reject if `trueLoss < 250`.
3. **Phase**: endgame once at most `ENDGAME_MAX_PIECES = 6` queens, rooks, bishops and knights remain (both sides); otherwise full-move `<12` is opening and the rest middlegame.
4. **Hanging-piece rule** (`hangNetLoss`): look at the opponent's *actual next move*; if it captures and nets material after any immediate recapture, the move hung that material. Depth-independent ground truth (known false positives: sacrifices, zwischenzug).
5. **Classify** (`classifyMistake`) into `mistakeTags[]` and a primary `mistakeKind` by priority: `bad_trade → hanging_piece → time_pressure → missed_capture → king_safety → endgame_conversion → tactical_blind_spot`. Inputs: material lost, low-clock detection (`isLowClock` per time class), whether the best move was a capture, whether the reply gives check, phase.
6. Emit a `BlunderExample` with `swingCp`, `bestMoveUci`, `bestCp`, clock data, and a `MistakeContext` (move number, phase, material balance, eval before/after, castle state, game URL).

`mergeProfile` folds each game's result immutably into the running `Profile`: per-phase and per-kind counts, hanging-piece count, the full blunder list, and the worst hang per phase. Tunable constants (`DEFAULT_DEPTH=8`, `BLUNDER_THRESHOLD_CP=250`, `MAX_PLIES=80`, `OPENING_LAST_MOVE=12`, `ENDGAME_MAX_PIECES=6`) are the calibration knobs.

## Weakness surfacing

Three layers turn the raw `Profile` into what the user sees:

- **Diagnosis** (`lib/insights.ts` `buildDiagnosis`): picks the highest-count `mistakeKind`, computes a confidence (`High` if ≥10 games, top-kind count ≥5, and ≥40% share; else `Medium`/`Early signal`), and attaches a title, sub-copy, a concrete drill, and up to 3 representative example blunders.
- **Recurring patterns** (`lib/patterns.ts` `buildPatternPayload`): for each mistake category, cross-tabs against three context fields — `castle_side`, `game_phase`, `material_balance` — and scores each (category × field-value) cell by **concentration** (share within the category) and **over-representation** vs. the global baseline, gated by `MIN_PATTERN_COUNT=2` and `MIN_OVERREPRESENTATION=1.25`. A `leverage` score (count × avg loss × concentration × capped over-rep) ranks them; the top 3 become human-readable phrases like "hanging pieces after kingside castling".
- **Evidence list** (`app/Evidence.tsx`): every flagged blunder, filterable by mistake kind and phase, sorted by swing. Selection drives the board.

## Board drill (`app/BoardDrill.tsx`)

For the selected blunder it runs its own `Engine`. The user tries a move; the drill re-evaluates the resulting position at `PUZZLE_DEPTH=12` and compares to the stored `bestCp` with `SOLVE_TOLERANCE_CP=90`. Buttons reveal the played move ("What happened") and the engine best move; an eval bar shows the live score. Per-blunder practice status (solved/missed/later) is tracked in `page.tsx` state and aggregated into queue stats.

## Play-vs-bot (`app/play/page.tsx`)

Independent mode: configure Elo (→ Skill Level), color, and clock; play full games against the Worker engine, with hint, takeback, resign, flip, and flag-fall handling. Uses `useRef` for the live `Chess` game and `Engine`, `useState` for render-visible board state.

## State management

- **No global store.** `app/page.tsx` holds all coach-flow state in `useState`: `username`, filters, selected blunder, per-blunder `practice` map, `progress` (`idle|fetching|analyzing|coaching|done|error`), `profile`, `coaching`.
- **`sessionStorage`** (`cwc:profile`, `cwc:complete`) persists the partial `Profile` after every analyzed game so an interrupted/killed run can be recovered and shown with a "partial" badge.
- `react-chessboard` is dynamically imported (`ssr: false`); `reactStrictMode` is off to keep its drag backend working.

## Component structure

```
layout.tsx (Navbar + fonts + metadata)
└─ page.tsx (Coach: form, progress, orchestration)
   ├─ BoardDrill.tsx   (selected blunder → interactive trainer + eval bar)
   └─ Evidence.tsx     (filterable blunder list)
play/page.tsx (Play: standalone bot game)
```

## Extension points

- **Add a mistake type:** extend `MistakeKind` in `lib/types.ts`, add detection in `classifyMistake` (`lib/analysis.ts`), and labels/copy/drill in `lib/insights.ts` (`MISTAKE_LABELS`, `MISTAKE_TITLES`, `MISTAKE_DRILLS`, `MISTAKE_SUBS`) and the chip in `app/Evidence.tsx`.
- **New pattern dimension:** add a `PatternField` (and its `MistakeContext` value) and a `fieldLabel` case in `lib/patterns.ts`.
- **Swap LLM / model:** change `COACH_MODEL` env var, or the endpoint/headers in `app/api/coach/route.ts`. The prompt and the privacy-preserving `buildUserPayload` shape are the contract.
- **Add another game source** (e.g. Lichess): implement a fetcher returning `FetchedGame[]` like `lib/chesscom.ts`; the rest of the pipeline is source-agnostic.
- **Recalibrate accuracy/speed:** tune `DEFAULT_DEPTH` / `BLUNDER_THRESHOLD_CP` / `MAX_PLIES` in `lib/analysis.ts` (the README documents the pending physical-device calibration gate).
- **Durable rate limiting:** the in-memory bucket in `app/api/coach/route.ts` is per edge isolate; replace with a shared store (KV/Redis) for sustained traffic.
