# Chess Weakness Coach

Type a Chess.com username, get a plain-English coaching report on your recurring
mistakes. Analysis runs in your browser with Stockfish (WASM); the only server
call sends an aggregate summary to an LLM for the coaching text. Free, mobile-first.

## Stack

- **Next.js (App Router)** on Vercel
- **Stockfish** single-threaded build vendored at `public/stockfish.js` — runs in
  a Web Worker, no `SharedArrayBuffer` / COOP-COEP headers needed (mobile-safe)
- **chess.js** for PGN replay, phase detection, and the hanging-piece rule
- **OpenRouter** for coaching (one server route, key never hits the browser)

## How it works

1. **Fetch** — walks the player's Chess.com monthly archives newest-first,
   filters by time control, collects up to 15 games. (`lib/chesscom.ts`)
2. **Analyze** — Stockfish evaluates each position at a low fixed depth; a move
   is a blunder if the eval drops ≥250cp from the mover's perspective.
   (`lib/engine.ts`, `lib/analysis.ts`)
3. **Classify** — blunders bucket by game phase (opening ≤ move 12 / endgame by
   material / else middlegame). Hung pieces are flagged separately by a
   ground-truth next-capture rule.
4. **Coach** — aggregate counts + the single worst hang per phase + the player's
   real rating go to the LLM. Full games are never sent. (`app/api/coach/route.ts`)

## Setup

```bash
npm install
cp .env.example .env.local   # add your OPENROUTER_API_KEY
npm run dev
```

Open http://localhost:3000. Without an API key the analysis + chart still work;
only the coaching paragraph is unavailable (it degrades gracefully).

### Deploy (Vercel)

Push the repo, import to Vercel, set `OPENROUTER_API_KEY` (and optionally
`COACH_MODEL`, default `deepseek/deepseek-v4-flash`) as environment variables.

## ⚠️ Calibration gate (do this before trusting results)

The analysis **depth** (`DEFAULT_DEPTH` in `lib/analysis.ts`, currently `10`) is
the single highest-risk constant. It has only been verified to build and serve —
**not** measured on a real phone. Before relying on output:

1. Run a real analysis on a physical mid-range phone.
2. Measure per-game and total wall-clock time. Target: under ~3–4 minutes for 15
   games. If too slow, lower `DEFAULT_DEPTH` (try 8) or `MAX_PLIES`.
3. Spot-check that flagged ≥250cp moves are genuine mistakes, not low-depth noise.

The vendored `public/stockfish.js` is the classic v10 single-threaded UCI build.
Its in-browser behavior follows the standard Worker UCI protocol that
`lib/engine.ts` speaks, but the actual engine run + phone timing is the one thing
that needs verification in a real browser.

## Tunable constants (`lib/analysis.ts`)

| Constant | Default | Meaning |
|---|---|---|
| `DEFAULT_DEPTH` | 10 | Stockfish search depth |
| `BLUNDER_THRESHOLD_CP` | 250 | min eval drop to count as a blunder |
| `MAX_PLIES` | 80 | cap on plies analyzed per game |
| `ENDGAME_MATERIAL` | 13 | non-pawn material ≤ this ⇒ endgame |
| `OPENING_LAST_MOVE` | 12 | full-moves ≤ this ⇒ opening |

## Scope

v1 is deliberately small: no accounts, no database, no payments, Chess.com only.
See `plans/chess-weakness-coach-v1.plan.md` for the full spec and the deferred
v2 backlog.

## Known limitations (accepted for v1)

- The hanging-piece rule is a simple next-capture heuristic; intended sacrifices
  and zwischenzug can produce false positives.
- A full run pins the phone's CPU for 1–4 minutes. Partial results are saved per
  game (`sessionStorage`) so an interrupted run still shows a labeled report.
- Phase blunder counts are eval-swing based; concrete examples shown to the user
  come only from the depth-independent hanging rule, so a noisy eval can never
  surface as a fake "worst blunder."
