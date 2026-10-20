# Coachmate

**Type a Chess.com username and get a plain-English report on the mistakes you keep making, then practise those exact positions.**

![Coachmate](public/images/chess-hero.png)

Coachmate pulls your recent Chess.com games, runs Stockfish on them right in your browser, finds the blunders that repeat, and explains them in plain English. You can then replay each flagged position on a board and try to find a better move, or play a bot with adjustable strength. No account, no database, mobile-first.

## Features

- **Weakness report from real games.** Analyzes 5 to 30 recent games (15 recommended) for a chosen time control and flags blunders by game phase (opening, middlegame, endgame) and mistake type: hanging piece, bad trade, missed capture, king safety, time pressure, endgame conversion, tactical blind spot.
- **Recurring patterns.** Finds mistakes that cluster in the same context, such as a mistake type tied to castling state, phase or material balance.
- **Coaching in plain English.** An LLM turns the aggregate numbers into a short coaching paragraph. Full games are never sent off the device.
- **Evidence you can check.** Every flagged move is listed with filters by mistake type and phase, and shows the move played and the engine's best move.
- **"Find a better move" drills.** Practise each blunder on an interactive board; your attempt is scored by Stockfish and tracked as solved, missed or saved for later.
- **Play vs bot.** Adjustable strength (Elo-style levels drive Stockfish's skill setting), colour choice, clocks, hints, takebacks and resign.
- **Demo report** for trying the app without a username.
- **Works without an API key.** Analysis, evidence, drills and play mode all run without the LLM; only the coaching paragraph needs it.

## How it works

Almost all the work happens in the browser. The only server code is one Edge route that keeps the API key off the client.

1. **Fetch** (`lib/chesscom.ts`): walks the player's Chess.com monthly archives newest-first using the public API, filters by time control, and collects the requested number of games.
2. **Analyze** (`lib/engine.ts`, `lib/analysis.ts`): replays each game with chess.js and evaluates positions with Stockfish (WASM) in a Web Worker. A move counts as a blunder if it loses at least 250 centipawns against a same-depth best-move check.
3. **Classify**: each blunder is bucketed by phase and mistake type. Hanging pieces are also caught by a depth-independent next-capture rule. Endgames are detected by material, not move number.
4. **Pattern-match** (`lib/patterns.ts`): scores mistake-type × context combinations by how concentrated and over-represented they are, and keeps the recurring ones.
5. **Coach** (`app/api/coach/route.ts`): sends only aggregate counts, a few example moves and the recurring patterns to an LLM via OpenRouter. The route validates input, caps request size (80 KB) and rate-limits per IP.

Partial results are saved to `sessionStorage` after every game, so an interrupted run still shows a labelled partial report.

A deeper walkthrough with a data-flow diagram is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Tech stack

- **Next.js 14** (App Router) + React 18 + TypeScript (strict)
- **Stockfish** single-threaded WASM build, vendored at `public/stockfish.js` and run in a Web Worker (no `SharedArrayBuffer` or COOP/COEP headers needed)
- **chess.js** for PGN replay, legal moves, phase and material logic
- **react-chessboard** for the board UI
- **OpenRouter** for coaching text (default model `deepseek/deepseek-v4-flash`, set by `COACH_MODEL`)
- Plain CSS, built for Vercel

## Run locally

Requires Node.js 18.17 or newer.

```bash
npm install
cp .env.example .env.local   # add your OPENROUTER_API_KEY (optional)
npm run dev
```

Open http://localhost:3000.

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | For coaching text only | Server-side key for the coach route; never reaches the browser |
| `COACH_MODEL` | No | OpenRouter model, defaults to `deepseek/deepseek-v4-flash` |
| `NEXT_PUBLIC_SITE_URL` | No | Absolute URL for social preview metadata |

## Deploy

Import the repo into Vercel and set the environment variables above.

## Tuning

Analysis constants live in `lib/analysis.ts`:

| Constant | Default | Meaning |
|---|---:|---|
| `DEFAULT_DEPTH` | 8 | Stockfish search depth (kept low so 15 games finish in minutes on a phone) |
| `BLUNDER_THRESHOLD_CP` | 250 | Minimum eval drop to count as a blunder |
| `MAX_PLIES` | 80 | Cap on plies analyzed per game |
| `OPENING_LAST_MOVE` | 12 | Full moves before this count as opening |

## Known limitations

- Chess.com only for now.
- The hanging-piece rule is a simple next-capture check, so intended sacrifices and in-between moves can be flagged.
- A full run can keep a phone's CPU busy for several minutes. Timing on real mid-range phones has not been measured yet.
- The coach route's rate limit is in memory per Edge instance; sustained traffic would need a shared store.

## Credits

Stockfish is © the Stockfish developers and released under the GNU GPL v3; the vendored build keeps its original license header.
