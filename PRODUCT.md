# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Club players rated roughly 800 to 1800 who play online a few times a week on Chess.com or Lichess, on a laptop or a phone, and want to know why they keep losing. They are not studying openings for hours. They finish a session, feel they threw games away, and want a straight answer they can act on before the next one.

## Product Purpose

Link a Chess.com or Lichess profile, pull the last 10 to 15 games, read every move with Stockfish, and hand back a review of each game plus an AI coach's plain-English read on the habit costing the most points. Then let the player fix that habit on positions from their own games.

Success: a player opens one game, sees exactly where it turned, understands why in words, and solves that position themselves.

## Positioning

Free, no account, and the engine runs on the player's own device. A coach reads the patterns across their games rather than one game at a time, and the drills are their own positions rather than a generic puzzle feed.

## Operating Context

Used right after a session or on a quiet evening. Analysis takes minutes and the player may leave the tab open while it runs. Reports get read on a phone as often as on a laptop. Players already know Chess.com and Lichess board conventions: last-move highlight, drag or tap to move, arrows, move glyphs, eval bar.

## Capabilities and Constraints

- Chess.com and Lichess public game data, no key and no sign-in.
- Stockfish runs in a Web Worker in the browser. No SharedArrayBuffer or COOP/COEP headers.
- The only server call is the coach route. It sends aggregate statistics and a few representative moves to the LLM through OpenRouter. Full games and PGNs never leave the device.
- If the coach is unavailable or no key is set, every other part of the product still works.
- Play-vs-bot with a tunable strength lives alongside the coach.
- No accounts, no database, no payments.
- Terminology: game review, accuracy, inaccuracy, mistake, blunder, drill.

## Brand Commitments

- Name: Coachmate.
- Voice: direct, warm, plain English. A coach talking to a player, never an engine report.
- Must not read as a SaaS dashboard, and must not read as a copy of Chess.com's Game Review.
- Free and private are product facts and may be stated plainly.

## Evidence on Hand

- `public/engine/`: vendored Stockfish 19 lite single-threaded, GPLv3.
- Sample report data in `lib/sample.json`: real games between weakened Stockfish bots, built by `scripts/build-sample.ts` and always labeled as bot games.
- No testimonials, user counts, accuracy benchmarks, press or partnerships exist. None may be implied.
- Device timing calibration from `README.md` is still pending. No speed claims.

## Product Principles

- Every number is derived, and the method is published. A player or a skeptic can see why a move earned its label.
- Words before numbers. The coach explains first, the engine backs it up.
- The board is the product. Anything that moves on it must be exact.
- One thing to fix, not a hundred engine lines.
- A partial or failed step still leaves the player with something useful.

## Accessibility & Inclusion

Keyboard operable board and move list, screen-reader status for moves and feedback, reduced-motion support, and move quality never carried by color alone.
