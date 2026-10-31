# Coachmate architecture

Almost everything runs in the browser. The one server route exists to keep the OpenRouter key off the client. There is no database and no auth, and reviews live in `localStorage`.

## Data flow

```
LinkForm -> ReportProvider.start()
  lib/games.ts           public games from Chess.com or Lichess
  for each game:
    lib/analysis.ts      reviewGame(): replay with chess.js, search every position
    lib/engine.ts        queued UCI jobs in a Web Worker, depth 14
    lib/judge.ts         win%, move accuracy, label, game accuracy
    lib/store.ts         partial report saved after every game
  lib/analysis.ts        buildProfile(): counts and flagged moves, worst first
  lib/coach.ts           reportPayload() -> POST /api/coach -> coach's read
```

Opening a game calls `loadNotes(id)`, which sends `gamePayload()` for that game's turning points and stores the notes. If the coach is unavailable, `lib/explain.ts` and `fallbackRead()` write the same text by rule, and the report says so.

## Games

`fetchGames(platform, username, filter, count, onProgress)` returns `FetchedGame[]`. Chess.com has no "last N" endpoint, so it walks monthly archives newest first. Lichess streams NDJSON from its export API. Both are public and need no key. `NotFoundError`, `NoGamesError` and `RateLimitError` carry no text; the provider maps them to words.

## Engine

`Engine` runs jobs one at a time, because UCI has a single search and overlapping `go` commands would hand one caller's result to another. `newGame()` runs once per game so the hash isn't flushed between positions. Scores come back from White's side.

## Review

`reviewGame()` searches each position at depth 14 and gets a score and best move. `judge()` applies the Lichess thresholds: the mover's drop in win chance of 5, 10 or 15 points makes an inaccuracy, mistake or blunder. Phases follow the Lichess Divider. The player's own mistakes and blunders also get a `MoveFlag` naming the likely cause, and `moments` keeps the three costliest in game order.

## Coach route

`app/api/coach/route.ts` validates the payload shape, rate limits at 12 per minute per IP, caps the body at 24 KB and returns 503 without a key. The rate limit is per edge isolate.

## Board

`Board` keeps a stable id for each piece. `reconcile()` matches the old position to the new one, so castling, en passant, promotion and multi-move jumps all slide the right pieces. Pieces are positioned with a CSS transform from `--x` and `--y`, and slide time scales with distance. Captured pieces stay as short-lived ghosts.

## Strip

`Strip` draws the player's chances as a polyline in a 0 to 100 viewBox, so one small box is always 5%. `stripOf(game)` gives every screen the same props.

## Extending

- New mistake kind: `MistakeKind` in `lib/types.ts`, detection in `lib/analysis.ts`, copy in `lib/insights.ts`.
- New game source: return `FetchedGame[]` from `lib/games.ts`. The rest doesn't care where games came from.
- New model: set `COACH_MODEL`.
