# Chess Weakness Coach (Coachmate) — Launch Plan

## Summary

Ship the chess coach as a free, public web app ready to post on subreddits
(r/chess, r/chessbeginners, etc.). Scope is the existing v1: enter a Chess.com username,
get an in-browser Stockfish analysis + an LLM coaching report; plus the in-progress
**play-vs-bot / BoardDrill** mode and the **"Coachmate" rebrand**. No accounts, no DB,
no payments. Finish the uncommitted WIP, close the **calibration gate** (the one real risk),
and deploy to Vercel.

This plan assumes the current uncommitted WIP is **kept and completed**, not reverted.

## Current State (as inspected)

- Next.js (App Router) on Vercel; Stockfish v10 single-threaded WASM vendored at
  `public/stockfish.js`, run in a Web Worker; chess.js for PGN replay; OpenRouter for coaching
  via one server route (`app/api/coach/route.ts`).
- Pipeline: fetch Chess.com archives → Stockfish analysis → blunder classification by phase →
  hanging-piece heuristic → LLM coaching on aggregates only (full games never sent).
- Single squashed commit; substantial uncommitted WIP:
  - Rebrand to **"Coachmate"** + branding/navbar/logo, board arrows.
  - `app/BoardDrill.tsx` (+125 lines), `app/play/` (play-vs-bot), `app/page.tsx` rewrite.
  - `lib/analysis.ts` (+78), `lib/types.ts` (+36), `lib/demo.ts`, `lib/chesscom.ts`.
  - **New `lib/patterns.ts` (139 lines)** — untracked, not yet integrated/committed.
  - `lib/insights.ts`, `app/Evidence.tsx` present.
- Env: `OPENROUTER_API_KEY` (required), `COACH_MODEL` (optional, default `deepseek/deepseek-v4-flash`).
- README documents a **calibration gate**: `DEFAULT_DEPTH=10` in `lib/analysis.ts` has only
  been verified to build/serve, never measured on a real phone.

## Implementation Changes

### 1. Finish the WIP (Coachmate rebrand + play/drill)
- Complete the "Coachmate" rebrand consistently: app title, `app/Logo.tsx`, `Navbar.tsx`,
  `layout.tsx` metadata, OG/social tags, favicon, `package.json` name, README. No stray
  "Chess Weakness Coach" strings left in user-facing UI.
- Integrate the new `lib/patterns.ts`: confirm what it exports and wire it into the analysis/
  insights flow (`lib/analysis.ts` / `lib/insights.ts`). If it is a richer
  weakness-pattern classifier, it must be actually called and its output surfaced in the
  report (`app/Evidence.tsx` / report UI). Do not leave it as dead code.
- Finish `app/play/` (play-vs-bot) and `app/BoardDrill.tsx`: must be reachable from the
  navbar, playable start-to-finish, with board arrows working. Bot move generation must not
  block the UI (run engine in the Worker, not the main thread).
- Verify graceful degradation: with no `OPENROUTER_API_KEY`, analysis + charts + drills still
  work; only the coaching paragraph is unavailable (per README contract).

### 2. Close the calibration gate (the launch-critical step)
This is the single highest risk: if a real analysis is too slow or flags noise as blunders,
the Reddit launch looks broken. Resolve before deploy.
- Run a real analysis (15 games) in a browser on a **real mid-range phone** AND a desktop.
- Measure per-game and total wall-clock time. Target: **under ~3–4 minutes** for 15 games on
  mobile. If over, lower `DEFAULT_DEPTH` (try 8) and/or `MAX_PLIES` until the target is met.
- Spot-check 10–15 flagged ≥250cp moves against the actual games: confirm they are genuine
  mistakes, not low-depth noise. Adjust `DEFAULT_DEPTH` / `BLUNDER_THRESHOLD_CP` if false
  positives are common.
- Record the chosen constants and the measured timings in the README (replace the "unverified"
  calibration warning with verified numbers). The calibration gate section must no longer say
  "not measured on a real phone."

### 3. UX hardening for public traffic
- Loading/progress UX during the 1–4 min analysis: visible per-game progress, since the run
  pins the CPU. Confirm the existing `sessionStorage` partial-results behavior works if the
  user navigates away and back.
- Handle Chess.com edge cases: nonexistent username, private/empty archives, users with <15
  games, rate-limit/network errors — each must show a clear message, not a crash or blank.
- Protect the `/api/coach` route: basic rate limiting or input size cap so a Reddit traffic
  spike can't run up the OpenRouter bill. Confirm the key never reaches the client.
- Mobile-first layout check on a real phone (board, arrows, report, charts).

### 4. Deployment (Vercel)
- Deploy to Vercel; set `OPENROUTER_API_KEY` (and optionally `COACH_MODEL`) as env vars.
- Confirm the Stockfish Worker loads from `public/stockfish.js` on the deployed domain with no
  COOP/COEP/`SharedArrayBuffer` requirement (the whole point of the single-threaded build).
- Verify OG/social meta renders a good preview (Reddit auto-embeds): title, description,
  1200×630 `og:image`. Set favicon + PWA-ish metadata.

## Test Plan

1. `npm install && npm run build` — zero errors.
2. Local smoke (`npm run dev`):
   - Real Chess.com username → full run completes, report renders with phase blunder counts
     and at least one concrete hanging-piece example.
   - Coaching paragraph appears with a valid `OPENROUTER_API_KEY`; degrades gracefully without.
   - Play-vs-bot and BoardDrill are reachable and playable; board arrows render.
   - Error cases: bad username, private profile, <15 games — all show friendly messages.
3. **Calibration run** on a real mid-range phone: record per-game + total time; confirm
   ≤ ~4 min for 15 games; spot-check flagged blunders are real.
4. Deployed Vercel URL: Worker loads, full run works on mobile + desktop, OG preview renders,
   coaching route works and is rate-limited/size-capped.

## Assumptions

- v1 scope only: no accounts, DB, or payments (per README); Chess.com only.
- WIP (Coachmate rebrand, play-vs-bot, BoardDrill, `patterns.ts`) is kept and completed
  (user-confirmed).
- User provides an OpenRouter API key and a Vercel project; Codex wires config.
- `lib/patterns.ts` is intended to be integrated (not abandoned); if Codex finds it is
  redundant with `insights.ts`, it should reconcile them into one path rather than ship both.

## Risks & Acceptance Criteria

**Risks**
- Calibration: depth too high → slow/unusable on mobile; too low → noisy false-positive
  blunders. Must be measured, not guessed.
- OpenRouter cost blowout under a Reddit spike without rate limiting.
- `patterns.ts` left as dead code, or rebrand left half-applied.

**Acceptance criteria (launch-ready)**
- Clean production build.
- Deployed Vercel URL runs a full real analysis end-to-end on a real phone in ≤ ~4 min with
  verified (not noisy) blunder flagging.
- Coaching works and is rate-limited; key never client-side.
- Play-vs-bot + BoardDrill playable; "Coachmate" branding consistent everywhere.
- Error states handled; OG preview + README (with verified calibration numbers) present.
