# Coachmate

Type a Chess.com username, get a plain-English coaching report on your recurring
mistakes, then drill the positions on a board or play a tunable bot. Analysis
runs in your browser with Stockfish (WASM); the only server call sends an
aggregate summary to an LLM for the coaching text. Free, mobile-first.

## Stack

- **Next.js (App Router)** on Vercel
- **Stockfish** single-threaded build vendored at `public/stockfish.js`; it runs
  in a Web Worker, with no `SharedArrayBuffer` or COOP/COEP headers required
- **chess.js** for PGN replay, phase detection, and the hanging-piece rule
- **OpenRouter** for coaching through `app/api/coach/route.ts`; the key never
  reaches the browser

## How It Works

1. **Fetch** - walks the player's Chess.com monthly archives newest-first,
   filters by time control, and collects up to 15 games. (`lib/chesscom.ts`)
2. **Analyze** - Stockfish evaluates each candidate position at a low fixed
   depth; a move is a blunder if a same-depth best-move comparison shows a loss
   of at least 250cp from the mover's perspective. (`lib/engine.ts`,
   `lib/analysis.ts`)
3. **Classify** - blunders bucket by phase and concrete mistake type; hanging
   pieces are also flagged by a depth-independent next-capture rule.
4. **Pattern-match** - `lib/patterns.ts` finds recurring context patterns such
   as mistake type by phase, material balance, or castling state.
5. **Coach** - aggregate counts, representative examples, and recurring
   patterns go to the LLM. Full games are never sent.

## Setup

```bash
npm install
cp .env.example .env.local   # add your OPENROUTER_API_KEY
npm run dev
```

Open http://localhost:3000. Without an API key the analysis, evidence list,
board drills, and play-vs-bot mode still work; only the coaching paragraph is
unavailable.

## Deploy

Push the repo, import to Vercel, and set:

- `OPENROUTER_API_KEY` - required for coaching text
- `COACH_MODEL` - optional, defaults to `deepseek/deepseek-v4-flash`
- `NEXT_PUBLIC_SITE_URL` - optional, used for absolute social metadata URLs

## Calibration

Current launch constants:

- `DEFAULT_DEPTH=8`
- `BLUNDER_THRESHOLD_CP=250`
- `MAX_PLIES=80`
- `OPENING_LAST_MOVE=12`

Code calibration status: depth was lowered from 10 to 8 for launch timing, and
the production build is the local verification gate. Physical-device calibration
still must be completed before public launch: run 15 real games on a mid-range
phone and a desktop, record per-game and total wall-clock time, and spot-check
10-15 flagged moves of at least 250cp against the original games.

Target: 15 games in about 3-4 minutes on a mid-range phone with no common
false-positive blunders in the spot check. Record the measured phone and desktop
numbers here after that run:

| Device | Games | Depth | Total Time | Avg/Game | Spot Check |
|---|---:|---:|---:|---:|---|
| Mid-range phone | 15 | 8 | pending | pending | pending |
| Desktop browser | 15 | 8 | pending | pending | pending |

## Tunable Constants (`lib/analysis.ts`)

| Constant | Default | Meaning |
|---|---:|---|
| `DEFAULT_DEPTH` | 8 | Stockfish search depth |
| `BLUNDER_THRESHOLD_CP` | 250 | min eval drop to count as a blunder |
| `MAX_PLIES` | 80 | cap on plies analyzed per game |
| `OPENING_LAST_MOVE` | 12 | full-moves before this value are opening |

## Scope

v1 is deliberately small: no accounts, no database, no payments, Chess.com only.
See `plans/launch.plan.md` for the launch checklist.

## Known Limitations

- The hanging-piece rule is a simple next-capture heuristic; intended sacrifices
  and zwischenzug can produce false positives.
- A full run can pin the phone's CPU for several minutes. Partial results are
  saved per game in `sessionStorage`, so an interrupted run still shows a
  labeled report.
- The `/api/coach` route has a small in-memory edge rate limit and request size
  cap. For sustained traffic across many edge isolates, use a shared store.
