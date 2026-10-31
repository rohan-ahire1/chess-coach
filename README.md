# Coachmate

Link a Chess.com or Lichess profile and Stockfish reads your last 10 or 15 games
move by move, in your browser. You get each game back as a review you can replay,
an AI coach's read on the habit costing you the most, drills built from your own
mistakes, and a bot to play against. It's free and there is no account.

## Stack

- Next.js 14 (App Router) on Vercel, with TypeScript and plain CSS
- Stockfish 19 lite single-threaded, vendored in `public/engine/` and run in a Web
  Worker. It needs no `SharedArrayBuffer` or COOP/COEP headers.
- chess.js for PGN replay and legal moves
- OpenRouter for the coach, through `app/api/coach/route.ts`. The key stays on the
  server.

## How it works

1. **Fetch.** `lib/games.ts` pulls public games from Chess.com or Lichess, with no
   key and no sign-in.
2. **Review.** `lib/analysis.ts` searches every position at depth 14. `lib/judge.ts`
   turns each score into chances, move accuracy and a label, using the published
   Lichess formulas. `/method` prints them.
3. **Explain.** `lib/explain.ts` writes a note for each judged move from the board.
   `lib/coach.ts` sends counts and a few single moves to the coach for better notes
   and a read across all games. It never sends a full game, a PGN, a username or a
   game link.
4. **Practise.** Your mistakes and blunders become drills on `/drill`, worst first.

Reviews stay in `localStorage`, so a refresh or a stopped run keeps what's done.

## Setup

Requires Node.js 18.17 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add `OPENROUTER_API_KEY` to `.env.local` to turn the coach on. Without it, reviews,
drills and play all still work, and notes are written by rule from the board.

## Deploy

Set these in Vercel:

- `OPENROUTER_API_KEY`, required for the coach
- `COACH_MODEL`, optional, defaults to `deepseek/deepseek-v4-flash`
- `NEXT_PUBLIC_SITE_URL`, optional, used for absolute social image URLs

## Sample data

`lib/sample.json` and `lib/hero.json` are real games between weakened Stockfish
bots, reviewed the same way as your games. The app always labels them as bot games.
To make new ones:

```bash
npx tsx scripts/build-sample.ts
```

## Calibration

Run 15 real games on a mid-range phone, then record the time here. The site makes
no speed claims until this is done.

| Device | Games | Depth | Total time, with fetch | Avg per game |
|---|---:|---:|---:|---:|
| Mid-range phone | 15 | 14 | pending | pending |
| Mac, desktop browser | 15 | 14 | about 75 s | about 5 s |

## Known limits

- The hanging-piece rule reads the opponent's next move, so a sacrifice or an
  in-between move can be misnamed.
- `/api/coach` rate limits per edge isolate. Sustained traffic needs a shared store.

## Credits

Stockfish is GPLv3 and its license ships in `public/engine/`. Pieces are Cburnett,
GPLv2+. Accuracy and win-chance formulas come from Lichess.
