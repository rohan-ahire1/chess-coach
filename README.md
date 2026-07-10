# Chess Weakness Coach

A mobile-first web app that turns recent Chess.com games into a plain-English coaching report. Enter a Chess.com username, choose a time control and receive a breakdown of recurring mistakes by game phase.

Position analysis runs locally in the browser using Stockfish WebAssembly. Only aggregate findings are sent to the configured language model for the final coaching narrative.

## Features

- Fetches recent public games from Chess.com monthly archives
- Filters games by time control
- Replays PGNs with `chess.js`
- Evaluates positions in-browser with a Stockfish Web Worker
- Detects large evaluation losses and likely hanging-piece mistakes
- Groups mistakes into opening, middlegame and endgame
- Produces charts and a concise coaching summary
- Preserves partial progress in `sessionStorage`
- Works without an LLM key except for the generated coaching paragraph
- Requires no user accounts or database

## How it works

```text
Chess.com username
       │
       ▼
Fetch up to 15 recent games
       │
       ▼
Replay moves with chess.js
       │
       ▼
Evaluate positions with browser Stockfish
       │
       ├── classify phase and mistake type
       └── aggregate counts and representative examples
                    │
                    ▼
      Optional server-side LLM coaching summary
                    │
                    ▼
             Browser report
```

1. **Fetch** — `lib/chesscom.ts` walks monthly Chess.com archives newest-first and collects matching games.
2. **Analyze** — `lib/engine.ts` communicates with vendored Stockfish through the UCI protocol; `lib/analysis.ts` measures evaluation swings.
3. **Classify** — mistakes are bucketed by phase, with a separate next-capture heuristic for hanging pieces.
4. **Coach** — `app/api/coach/route.ts` sends aggregate statistics and selected examples to OpenRouter. Complete games are not sent.

## Technology

- Next.js 14 App Router
- React 18 and TypeScript
- `chess.js`
- `react-chessboard`
- Vendored single-threaded Stockfish WASM/JavaScript worker
- OpenRouter for optional coaching text
- Vercel-compatible deployment

## Local development

### Prerequisites

- Node.js 18 or newer
- npm
- Optional OpenRouter API key

### Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Configure the optional coaching integration:

```env
OPENROUTER_API_KEY=your_key_here
COACH_MODEL=deepseek/deepseek-v4-flash
```

Without `OPENROUTER_API_KEY`, game fetching, local analysis and visual results still work; only the generated coaching paragraph is unavailable.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run the configured Next.js lint command |

## Analysis rules

Default values live in `lib/analysis.ts`.

| Constant | Default | Meaning |
| --- | ---: | --- |
| `DEFAULT_DEPTH` | `10` | Stockfish search depth |
| `BLUNDER_THRESHOLD_CP` | `250` | Minimum evaluation loss counted as a blunder |
| `MAX_PLIES` | `80` | Maximum half-moves analyzed per game |
| `ENDGAME_MATERIAL` | `13` | Non-pawn material threshold for endgame classification |
| `OPENING_LAST_MOVE` | `12` | Final full move treated as opening |

These are product heuristics, not universal chess definitions.

## Calibration requirement

The most important operational setting is `DEFAULT_DEPTH`. The application builds successfully, but analysis speed and quality should be validated on a physical mid-range phone before results are treated as reliable.

Recommended check:

1. Analyze 15 real games on a phone.
2. Measure total wall-clock time; target roughly three to four minutes.
3. Reduce depth or `MAX_PLIES` if the experience is too slow.
4. Spot-check flagged 250-centipawn losses against a stronger desktop analysis.
5. Confirm that representative hanging-piece examples are genuine mistakes rather than sacrifices or tactical intermediates.

## Privacy model

- Stockfish analysis runs in the browser.
- No account or local database is used.
- Public Chess.com game data is fetched for the requested username.
- Only aggregated findings and selected mistake context are sent to OpenRouter.
- API keys remain server-side.

Review the payload in `app/api/coach/route.ts` before deploying with a different model provider.

## Deployment

For Vercel:

1. Import the repository.
2. Use the default Next.js build settings.
3. Add `OPENROUTER_API_KEY`.
4. Optionally set `COACH_MODEL`.
5. Run a production analysis on desktop and mobile after deployment.

The vendored single-threaded engine avoids requiring `SharedArrayBuffer` and COOP/COEP headers, improving mobile compatibility.

## Known limitations

- Chess.com is the only supported game source.
- The hanging-piece detector uses a simple next-capture heuristic and can misclassify sacrifices or zwischenzug.
- Low-depth evaluation may produce noisy blunder labels.
- A full run can keep a phone CPU busy for several minutes.
- Partial results use session storage and disappear when the browser session is cleared.
- The app provides training guidance, not authoritative engine annotation.

## Scope

Version 1 deliberately excludes accounts, payments, persistent cloud history and multi-platform game imports. See `plans/chess-weakness-coach-v1.plan.md` for the original specification and deferred work.