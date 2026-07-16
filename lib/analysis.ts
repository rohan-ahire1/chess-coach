import { Chess } from "chess.js";
import type { Engine } from "./engine";
import type {
  BlunderExample,
  CastleSide,
  FetchedGame,
  MaterialBalance,
  MistakeKind,
  Phase,
  Profile,
} from "./types";

// ---- Tunable constants (calibrate DEPTH on a real phone before launch) ----
/** Fixed search depth. Low by design: we catch blunders, not play correspondence. */
export const DEFAULT_DEPTH = 8;
/** A move is a blunder if eval drops by at least this much (mover's perspective). */
export const BLUNDER_THRESHOLD_CP = 250;
/** Cap plies analyzed per game so total runtime stays bounded on phones. */
export const MAX_PLIES = 80;
/** Opening covers full-moves before this number. */
export const OPENING_LAST_MOVE = 12;

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

interface PlyInfo {
  color: "w" | "b";
  san: string;
  fenBefore: string;
  fenAfter: string;
  from: string;
  to: string;
  /** Piece type captured by this move, if any. */
  captured?: string;
  /** Piece type that moved. */
  piece: string;
  /** Remaining clock after this move, if Chess.com included [%clk]. */
  clockAfterSec: number | null;
  /** Approximate seconds spent on this move, if enough clock data exists. */
  timeSpentSec: number | null;
  /** Castling state for the mover before this ply. */
  castleSide: CastleSide;
  /** Number of mover moves since castling before this ply. */
  movesSinceCastle: number | null;
}

export interface GameResult {
  blunders: BlunderExample[];
}

function emptyPhases(): Record<Phase, number> {
  return { opening: 0, middlegame: 0, endgame: 0 };
}

function emptyMistakes(): Record<MistakeKind, number> {
  return {
    hanging_piece: 0,
    bad_trade: 0,
    time_pressure: 0,
    missed_capture: 0,
    king_safety: 0,
    endgame_conversion: 0,
    tactical_blind_spot: 0,
  };
}

function materialScore(fen: string): number {
  const placement = fen.split(" ")[0];
  let score = 0;
  for (const ch of placement) {
    const lower = ch.toLowerCase();
    const val = PIECE_VALUE[lower];
    if (val == null) continue;
    score += ch === lower ? -val : val;
  }
  return score;
}

function materialBalanceOf(fen: string, playerColor: "w" | "b"): MaterialBalance {
  const whiteMinusBlack = materialScore(fen);
  const playerMaterial = playerColor === "w" ? whiteMinusBlack : -whiteMinusBlack;
  if (playerMaterial >= 2) return "ahead";
  if (playerMaterial <= -2) return "behind";
  return "equal";
}

function fullMoveOf(fen: string): number {
  const n = parseInt(fen.split(" ")[5], 10);
  return Number.isNaN(n) ? 1 : n;
}

function phaseByMoveNumber(moveNumber: number): Phase {
  if (moveNumber < 12) return "opening";
  if (moveNumber <= 40) return "middlegame";
  return "endgame";
}

function clockToSeconds(raw: string): number | null {
  const parts = raw.trim().split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
}

function clocksFromPgn(pgn: string): Array<number | null> {
  return [...pgn.matchAll(/\{\s*\[%clk\s+([^\]]+)\]\s*\}/g)].map((m) =>
    clockToSeconds(m[1])
  );
}

function parseLiveTimeControl(timeControl: string): { initialSec: number; incrementSec: number } | null {
  const m = /^(\d+)(?:\+(\d+))?$/.exec(timeControl);
  if (!m) return null;
  return {
    initialSec: Number(m[1]),
    incrementSec: m[2] ? Number(m[2]) : 0,
  };
}

/** Replay a PGN into per-ply info. Returns [] if the PGN can't be parsed. */
function replay(pgn: string, timeControl: string): PlyInfo[] {
  const board = new Chess();
  try {
    board.loadPgn(pgn);
  } catch {
    return [];
  }
  const verbose = board.history({ verbose: true });
  const replayer = new Chess();
  const clocks = clocksFromPgn(pgn);
  const tc = parseLiveTimeControl(timeControl);
  const lastClockByColor: Record<"w" | "b", number | null> = {
    w: tc?.initialSec ?? null,
    b: tc?.initialSec ?? null,
  };
  const castleSideByColor: Record<"w" | "b", CastleSide> = { w: null, b: null };
  const movesSinceCastleByColor: Record<"w" | "b", number | null> = { w: null, b: null };
  const plies: PlyInfo[] = [];
  for (const [idx, mv] of verbose.entries()) {
    const fenBefore = replayer.fen();
    const castleSide = castleSideByColor[mv.color];
    const movesSinceCastle = movesSinceCastleByColor[mv.color];
    try {
      replayer.move(mv.san);
    } catch {
      break;
    }
    const clockAfterSec = clocks[idx] ?? null;
    const prevClock = lastClockByColor[mv.color];
    const timeSpentSec =
      clockAfterSec != null && prevClock != null
        ? Math.max(0, prevClock + (tc?.incrementSec ?? 0) - clockAfterSec)
        : null;
    if (clockAfterSec != null) lastClockByColor[mv.color] = clockAfterSec;
    plies.push({
      color: mv.color,
      san: mv.san,
      fenBefore,
      fenAfter: replayer.fen(),
      from: mv.from,
      to: mv.to,
      captured: mv.captured,
      piece: mv.piece,
      clockAfterSec,
      timeSpentSec,
      castleSide,
      movesSinceCastle,
    });
    if (mv.san === "O-O" || (mv.piece === "k" && mv.from[0] === "e" && mv.to[0] === "g")) {
      castleSideByColor[mv.color] = "kingside";
      movesSinceCastleByColor[mv.color] = 0;
    } else if (mv.san === "O-O-O" || (mv.piece === "k" && mv.from[0] === "e" && mv.to[0] === "c")) {
      castleSideByColor[mv.color] = "queenside";
      movesSinceCastleByColor[mv.color] = 0;
    } else if (movesSinceCastleByColor[mv.color] != null) {
      movesSinceCastleByColor[mv.color]!++;
    }
  }
  return plies;
}

/**
 * Was the player's move a hang? Look at the opponent's actual next move: if it
 * captures and nets material (after any immediate recapture), the player's move
 * hung that material. Ground-truth and depth-independent. Known false positives
 * (intended sacrifices, zwischenzug) are accepted for v1.
 */
function hangNetLoss(playerPly: PlyInfo, oppPly: PlyInfo): number {
  if (!oppPly.captured) return 0;
  const capturedValue = PIECE_VALUE[oppPly.captured] ?? 0;

  // Can the player recapture on the same square right now?
  const after = new Chess(oppPly.fenAfter);
  let recapture = false;
  for (const m of after.moves({ verbose: true })) {
    if (m.to === oppPly.to && m.captured) {
      recapture = true;
      break;
    }
  }
  const regained = recapture ? PIECE_VALUE[oppPly.piece] ?? 0 : 0;
  return capturedValue - regained;
}

function applyUci(fen: string, uci: string): { fen: string; captured?: string } | null {
  try {
    const c = new Chess(fen);
    const m = c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: (uci.slice(4, 5) || undefined) as any,
    });
    return m ? { fen: c.fen(), captured: m.captured } : null;
  } catch {
    return null;
  }
}

function isLowClock(clockAfterSec: number | null, timeClass: string, timeControl: string): boolean {
  if (clockAfterSec == null) return false;
  const tc = parseLiveTimeControl(timeControl);
  if (timeClass === "bullet") return clockAfterSec <= 10;
  if (timeClass === "blitz") return clockAfterSec <= 20;
  if (timeClass === "rapid") {
    const threshold = tc ? Math.max(30, Math.min(90, tc.initialSec * 0.1)) : 60;
    return clockAfterSec <= threshold;
  }
  return false;
}

function classifyMistake({
  ply,
  oppPly,
  phase,
  materialLost,
  bestMoveCaptured,
  timeClass,
  timeControl,
}: {
  ply: PlyInfo;
  oppPly: PlyInfo | undefined;
  phase: Phase;
  materialLost: number;
  bestMoveCaptured: boolean;
  timeClass: string;
  timeControl: string;
}): { mistakeKind: MistakeKind; mistakeTags: MistakeKind[] } {
  const tags: MistakeKind[] = [];

  if (materialLost > 0 && ply.captured) tags.push("bad_trade");
  else if (materialLost > 0) tags.push("hanging_piece");

  if (isLowClock(ply.clockAfterSec, timeClass, timeControl)) tags.push("time_pressure");
  if (bestMoveCaptured && !ply.captured) tags.push("missed_capture");
  if (oppPly?.san.includes("+") || oppPly?.san.includes("#")) tags.push("king_safety");
  if (phase === "endgame") tags.push("endgame_conversion");

  if (tags.length === 0) tags.push("tactical_blind_spot");

  const priority: MistakeKind[] = [
    "bad_trade",
    "hanging_piece",
    "time_pressure",
    "missed_capture",
    "king_safety",
    "endgame_conversion",
    "tactical_blind_spot",
  ];

  return {
    mistakeKind: priority.find((k) => tags.includes(k)) ?? "tactical_blind_spot",
    mistakeTags: tags,
  };
}

/**
 * Analyze a single game for the analyzed player's blunders and hangs.
 * Evaluates positions sequentially via the worker so the UI stays responsive.
 */
export async function analyzeGame(
  game: FetchedGame,
  gameIndex: number,
  engine: Engine,
  depth: number
): Promise<GameResult> {
  const result: GameResult = { blunders: [] };
  const plies = replay(game.pgn, game.timeControl).slice(0, MAX_PLIES);
  if (plies.length === 0) return result;

  const playerColor: "w" | "b" = game.playerIsWhite ? "w" : "b";
  const white = playerColor === "w";
  const toPlayer = (whiteCp: number) => (white ? whiteCp : -whiteCp);

  // Cache evals by FEN. Stores both the eval (White POV) and the best move.
  const cache = new Map<string, { cp: number; bestMove: string | null }>();
  const evalPos = async (fen: string) => {
    const hit = cache.get(fen);
    if (hit) return hit;
    const { cp, bestMove } = await engine.evaluate(fen, depth);
    const val = { cp, bestMove };
    cache.set(fen, val);
    return val;
  };

  for (let i = 0; i < plies.length; i++) {
    const ply = plies[i];
    if (ply.color !== playerColor) continue;

    const before = await evalPos(ply.fenBefore);
    const after = await evalPos(ply.fenAfter);
    const playedCp = toPlayer(after.cp);
    const rawLoss = toPlayer(before.cp) - playedCp;

    // Quick reject: not even a raw swing.
    if (rawLoss < BLUNDER_THRESHOLD_CP) continue;

    // Re-validate against the engine's best move, evaluated at the SAME depth and
    // the same horizon as the played move. This removes horizon false-positives:
    // forced/only/best moves in already-lost positions no longer count as blunders.
    let bestCp = playedCp;
    const bestMoveUci = before.bestMove;
    let bestMoveCaptured = false;
    if (bestMoveUci) {
      const bestMove = applyUci(ply.fenBefore, bestMoveUci);
      if (!bestMove || bestMove.fen === ply.fenAfter) {
        // The player already played the engine's best move — not a blunder.
        continue;
      }
      bestMoveCaptured = !!bestMove.captured;
      const bestRes = await evalPos(bestMove.fen);
      bestCp = toPlayer(bestRes.cp);
    }
    const trueLoss = bestCp - playedCp;
    if (trueLoss < BLUNDER_THRESHOLD_CP) continue; // no move did meaningfully better

    const moveNumber = fullMoveOf(ply.fenBefore);
    const phase = phaseByMoveNumber(moveNumber);

    // Did this blunder hang material to the opponent's immediate next capture?
    const oppPly = plies[i + 1];
    let materialLost = 0;
    if (oppPly && oppPly.color !== playerColor) {
      materialLost = Math.max(0, hangNetLoss(ply, oppPly));
    }
    const { mistakeKind, mistakeTags } = classifyMistake({
      ply,
      oppPly,
      phase,
      materialLost,
      bestMoveCaptured,
      timeClass: game.timeClass,
      timeControl: game.timeControl,
    });

    result.blunders.push({
      phase,
      move: ply.san,
      fen: ply.fenBefore,
      fenAfter: ply.fenAfter,
      swingCp: Math.max(0, trueLoss),
      isHang: materialLost > 0,
      materialLost,
      mistakeKind,
      mistakeTags,
      bestMoveUci,
      bestCp,
      clockAfterSec: ply.clockAfterSec,
      timeSpentSec: ply.timeSpentSec,
      timeClass: game.timeClass,
      gameIndex,
      moveNumber,
      context: {
        category: mistakeKind,
        move_number: moveNumber,
        game_phase: phase,
        material_balance: materialBalanceOf(ply.fenBefore, playerColor),
        eval_before: toPlayer(before.cp),
        eval_after: playedCp,
        moves_since_castle: ply.movesSinceCastle,
        castle_side: ply.castleSide,
        game_url: game.url,
      },
    });
  }

  return result;
}

export function emptyProfile(rating: number | null): Profile {
  return {
    rating,
    gamesAnalyzed: 0,
    blundersByPhase: emptyPhases(),
    mistakesByKind: emptyMistakes(),
    hangingPieces: 0,
    blunders: [],
    worstHangs: [],
    totalBlunders: 0,
  };
}

/** Fold a game's result into the running profile (immutably). */
export function mergeProfile(profile: Profile, game: GameResult): Profile {
  const blunders = [...profile.blunders, ...game.blunders];

  const blundersByPhase = emptyPhases();
  const mistakesByKind = emptyMistakes();
  let hangingPieces = 0;
  for (const b of blunders) {
    blundersByPhase[b.phase]++;
    mistakesByKind[b.mistakeKind]++;
    if (b.isHang) hangingPieces++;
  }

  // Worst hang per phase (for the coaching payload).
  const byPhase = new Map<Phase, BlunderExample>();
  for (const b of blunders) {
    if (!b.isHang) continue;
    const cur = byPhase.get(b.phase);
    if (!cur || b.materialLost > cur.materialLost) byPhase.set(b.phase, b);
  }

  return {
    rating: profile.rating,
    gamesAnalyzed: profile.gamesAnalyzed + 1,
    blundersByPhase,
    mistakesByKind,
    hangingPieces,
    blunders,
    worstHangs: [...byPhase.values()].sort((a, b) => b.materialLost - a.materialLost),
    totalBlunders: blunders.length,
  };
}
