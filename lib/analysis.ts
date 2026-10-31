import { Chess } from "chess.js";
import type { Analyzer, EvalResult } from "./engine";
import { gameAccuracy, judge, moveAccuracy, whiteWinPercent } from "./judge";
import type {
  CastleSide,
  Color,
  FetchedGame,
  Flagged,
  GameReview,
  Judgement,
  MaterialBalance,
  MistakeKind,
  MoveFlag,
  Phase,
  Profile,
  ReviewMove,
} from "./types";

/** Fixed search depth. Calibrate on a mid-range phone before raising it. */
export const ANALYSIS_DEPTH = 14;
const MAX_PLIES = 400;
export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Lichess's Divider: the endgame starts at six majors and minors, the middlegame at ten. */
const ENDGAME_PIECES = 6;
const MIDDLEGAME_PIECES = 10;
const OPENING_LAST_MOVE = 12;

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

interface Ply {
  color: Color;
  san: string;
  fenBefore: string;
  fenAfter: string;
  from: string;
  to: string;
  promotion?: string;
  captured?: string;
  piece: string;
  clockAfterSec: number | null;
  timeSpentSec: number | null;
  castleSide: CastleSide;
  movesSinceCastle: number | null;
}

export function fenBefore(game: GameReview, index: number): string {
  return index > 0 ? game.moves[index - 1].fen : game.startFen;
}

/** The player's win chance at each position, including the start. */
export function chanceSeries(game: GameReview): number[] {
  const whiteWins = [game.startWhiteWin, ...game.moves.map((m) => m.whiteWin)];
  return game.playerColor === "w" ? whiteWins : whiteWins.map((w) => 100 - w);
}

export function sanLine(fen: string, uci: string[], limit = 6): string[] {
  const line: string[] = [];
  const board = new Chess(fen);
  for (const mv of uci.slice(0, limit)) {
    try {
      const m = board.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] });
      line.push(m.san);
    } catch {
      break;
    }
  }
  return line;
}

function materialScore(fen: string): number {
  let score = 0;
  for (const ch of fen.split(" ")[0]) {
    const lower = ch.toLowerCase();
    const val = PIECE_VALUE[lower];
    if (val == null) continue;
    score += ch === lower ? -val : val;
  }
  return score;
}

function materialBalanceOf(fen: string, color: Color): MaterialBalance {
  const whiteMinusBlack = materialScore(fen);
  const mine = color === "w" ? whiteMinusBlack : -whiteMinusBlack;
  if (mine >= 2) return "ahead";
  if (mine <= -2) return "behind";
  return "equal";
}

function fullMoveOf(fen: string): number {
  const n = parseInt(fen.split(" ")[5], 10);
  return Number.isNaN(n) ? 1 : n;
}

function phaseOf(fen: string): Phase {
  let pieces = 0;
  for (const ch of fen.split(" ")[0]) if ("qrbnQRBN".includes(ch)) pieces++;
  if (pieces <= ENDGAME_PIECES) return "endgame";
  if (pieces > MIDDLEGAME_PIECES && fullMoveOf(fen) <= OPENING_LAST_MOVE) return "opening";
  return "middlegame";
}

function clockToSeconds(raw: string): number | null {
  const parts = raw.trim().split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? null;
}

function clocksFromPgn(pgn: string): Array<number | null> {
  return [...pgn.matchAll(/\[%clk\s+([^\]]+)\]/g)].map((m) => clockToSeconds(m[1]));
}

function parseTimeControl(timeControl: string): { initialSec: number; incrementSec: number } | null {
  const m = /^(\d+)(?:\+(\d+))?$/.exec(timeControl);
  if (!m) return null;
  return { initialSec: Number(m[1]), incrementSec: m[2] ? Number(m[2]) : 0 };
}

function replay(pgn: string, timeControl: string): Ply[] {
  const board = new Chess();
  try {
    board.loadPgn(pgn);
  } catch {
    return [];
  }
  const clocks = clocksFromPgn(pgn);
  const tc = parseTimeControl(timeControl);
  const lastClock: Record<Color, number | null> = { w: tc?.initialSec ?? null, b: tc?.initialSec ?? null };
  const castled: Record<Color, CastleSide> = { w: null, b: null };
  const sinceCastle: Record<Color, number | null> = { w: null, b: null };

  return board.history({ verbose: true }).map((mv, idx) => {
    const clockAfterSec = clocks[idx] ?? null;
    const prev = lastClock[mv.color];
    const timeSpentSec =
      clockAfterSec != null && prev != null
        ? Math.max(0, prev + (tc?.incrementSec ?? 0) - clockAfterSec)
        : null;
    if (clockAfterSec != null) lastClock[mv.color] = clockAfterSec;

    const ply: Ply = {
      color: mv.color,
      san: mv.san,
      fenBefore: mv.before,
      fenAfter: mv.after,
      from: mv.from,
      to: mv.to,
      promotion: mv.promotion,
      captured: mv.captured,
      piece: mv.piece,
      clockAfterSec,
      timeSpentSec,
      castleSide: castled[mv.color],
      movesSinceCastle: sinceCastle[mv.color],
    };

    if (mv.san.startsWith("O-O-O")) {
      castled[mv.color] = "queenside";
      sinceCastle[mv.color] = 0;
    } else if (mv.san.startsWith("O-O")) {
      castled[mv.color] = "kingside";
      sinceCastle[mv.color] = 0;
    } else if (sinceCastle[mv.color] != null) {
      sinceCastle[mv.color]!++;
    }
    return ply;
  });
}

/**
 * Net material the mover loses to the opponent's actual next move. Ground truth
 * and independent of depth. An intended sacrifice can look like a hang here.
 */
export function netMaterialLost(replyFenAfter: string, replyTo: string, captured: string | undefined, piece: string): number {
  if (!captured) return 0;
  const taken = PIECE_VALUE[captured] ?? 0;
  const after = new Chess(replyFenAfter);
  const recapture = after.moves({ verbose: true }).some((m) => m.to === replyTo && m.captured);
  return Math.max(0, taken - (recapture ? PIECE_VALUE[piece] ?? 0 : 0));
}

function isLowClock(clockAfterSec: number | null, timeClass: string, timeControl: string): boolean {
  if (clockAfterSec == null) return false;
  if (timeClass === "bullet") return clockAfterSec <= 10;
  if (timeClass === "blitz") return clockAfterSec <= 20;
  const tc = parseTimeControl(timeControl);
  return clockAfterSec <= (tc ? Math.max(30, Math.min(90, tc.initialSec * 0.1)) : 60);
}

function classify(
  ply: Ply,
  reply: Ply | undefined,
  phase: Phase,
  materialLost: number,
  bestCaptured: boolean,
  game: FetchedGame
): { kind: MistakeKind; tags: MistakeKind[] } {
  const tags: MistakeKind[] = [];
  if (materialLost > 0 && ply.captured) tags.push("bad_trade");
  else if (materialLost > 0) tags.push("hanging_piece");
  if (isLowClock(ply.clockAfterSec, game.timeClass, game.timeControl)) tags.push("time_pressure");
  if (bestCaptured && !ply.captured) tags.push("missed_capture");
  if (reply?.san.includes("+") || reply?.san.includes("#")) tags.push("king_safety");
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
  return { kind: priority.find((k) => tags.includes(k)) ?? "tactical_blind_spot", tags };
}

/** The final position has no search to run when the game ended on the board. */
function terminalResult(fen: string): EvalResult | null {
  const board = new Chess(fen);
  if (board.isCheckmate()) {
    return { cp: null, mate: board.turn() === "w" ? -1 : 1, bestMove: null, pv: [] };
  }
  if (board.isDraw()) return { cp: 0, mate: null, bestMove: null, pv: [] };
  return null;
}

export interface ReviewOptions {
  depth?: number;
  /** Fires after each search with White's chances so far. */
  onEval?: (whiteWins: number[], plies: number) => void;
  isCancelled?: () => boolean;
}

/** Reads every move of a game. Returns null if the PGN can't be replayed or the run stops. */
export async function reviewGame(
  game: FetchedGame,
  engine: Analyzer,
  { depth = ANALYSIS_DEPTH, onEval, isCancelled }: ReviewOptions = {}
): Promise<GameReview | null> {
  const plies = replay(game.pgn, game.timeControl).slice(0, MAX_PLIES);
  if (plies.length === 0) return null;

  engine.newGame();
  const searches: EvalResult[] = [];
  const whiteWins: number[] = [];

  for (let i = 0; i <= plies.length; i++) {
    if (isCancelled?.()) return null;
    const fen = i < plies.length ? plies[i].fenBefore : plies[plies.length - 1].fenAfter;
    const result = (i === plies.length ? terminalResult(fen) : null) ?? (await engine.analyze(fen, depth));
    searches.push(result);
    whiteWins.push(whiteWinPercent(result.cp, result.mate));
    onEval?.(whiteWins, plies.length);
  }

  const toMover = (white: number, color: Color) => (color === "w" ? white : 100 - white);
  const moves: ReviewMove[] = [];

  for (let i = 0; i < plies.length; i++) {
    const ply = plies[i];
    const search = searches[i];
    const after = searches[i + 1];
    const before = toMover(whiteWins[i], ply.color);
    const afterWin = toMover(whiteWins[i + 1], ply.color);
    const uci = ply.from + ply.to + (ply.promotion ?? "");
    const isBest = search.bestMove === uci;

    let drop = isBest ? 0 : Math.max(0, before - afterWin);
    let bestBoard: Chess | null = null;
    let bestCaptured = false;
    if (search.bestMove && !isBest) {
      try {
        bestBoard = new Chess(ply.fenBefore);
        bestCaptured = !!bestBoard.move({
          from: search.bestMove.slice(0, 2),
          to: search.bestMove.slice(2, 4),
          promotion: search.bestMove[4],
        }).captured;
      } catch {
        bestBoard = null;
      }
    }

    // Check real mistakes against the best move at the same depth. This removes
    // horizon false positives: a forced move in a lost position is no blunder.
    if (bestBoard && (judge(drop) === "mistake" || judge(drop) === "blunder")) {
      const best = await engine.analyze(bestBoard.fen(), depth);
      const bestWin = toMover(whiteWinPercent(best.cp, best.mate), ply.color);
      drop = Math.min(drop, Math.max(0, bestWin - afterWin));
    }

    const judgement = judge(drop);
    const phase = phaseOf(ply.fenBefore);
    let flag: MoveFlag | null = null;
    if (ply.color === game.playerColor && (judgement === "mistake" || judgement === "blunder")) {
      const reply = plies[i + 1];
      const materialLost = reply ? netMaterialLost(reply.fenAfter, reply.to, reply.captured, reply.piece) : 0;
      const { kind, tags } = classify(ply, reply, phase, materialLost, bestCaptured, game);
      flag = {
        kind,
        tags,
        isHang: materialLost > 0,
        materialLost,
        materialBalance: materialBalanceOf(ply.fenBefore, ply.color),
        castleSide: ply.castleSide,
        movesSinceCastle: ply.movesSinceCastle,
      };
    }

    moves.push({
      ply: i + 1,
      moveNumber: fullMoveOf(ply.fenBefore),
      color: ply.color,
      san: ply.san,
      from: ply.from,
      to: ply.to,
      promotion: ply.promotion,
      fen: ply.fenAfter,
      whiteWin: Math.round(whiteWins[i + 1] * 10) / 10,
      cp: after.cp,
      mate: after.mate,
      bestUci: search.bestMove,
      bestSan: sanLine(ply.fenBefore, search.bestMove ? [search.bestMove] : [])[0] ?? null,
      line: sanLine(ply.fenBefore, search.pv),
      drop: Math.round(drop * 10) / 10,
      accuracy: Math.round((isBest ? 100 : moveAccuracy(before, afterWin)) * 10) / 10,
      judgement,
      isBest,
      phase,
      clockAfterSec: ply.clockAfterSec,
      timeSpentSec: ply.timeSpentSec,
      flag,
    });
  }

  const emptyCounts = (): Record<Judgement, number> => ({ inaccuracy: 0, mistake: 0, blunder: 0 });
  const counts: Record<Color, Record<Judgement, number>> = { w: emptyCounts(), b: emptyCounts() };
  for (const m of moves) if (m.judgement) counts[m.color][m.judgement]++;

  const moments = moves
    .filter((m) => m.color === game.playerColor && m.judgement)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 3)
    .map((m) => m.ply)
    .sort((a, b) => a - b);

  return {
    id: game.id,
    platform: game.platform,
    url: game.url,
    white: game.white,
    black: game.black,
    playerColor: game.playerColor,
    outcome: game.outcome,
    ending: game.ending,
    opening: game.opening,
    timeClass: game.timeClass,
    timeControl: game.timeControl,
    endTime: game.endTime,
    startFen: plies[0].fenBefore,
    startWhiteWin: Math.round(whiteWins[0] * 10) / 10,
    moves,
    accuracy: gameAccuracy(whiteWins),
    counts,
    moments,
    depth,
  };
}

export function flaggedMoves(game: GameReview): Flagged[] {
  const out: Flagged[] = [];
  const chances = chanceSeries(game);
  game.moves.forEach((m, i) => {
    if (!m.flag || !m.judgement) return;
    out.push({
      id: `${game.id}:${m.ply}`,
      gameId: game.id,
      ply: m.ply,
      judgement: m.judgement,
      phase: m.phase,
      color: m.color,
      move: m.san,
      moveNumber: m.moveNumber,
      fen: fenBefore(game, i),
      fenAfter: m.fen,
      winBefore: chances[i],
      winAfter: chances[i + 1],
      drop: m.drop,
      bestUci: m.bestUci,
      bestSan: m.bestSan,
      line: m.line,
      clockAfterSec: m.clockAfterSec,
      timeSpentSec: m.timeSpentSec,
      timeClass: game.timeClass,
      flag: m.flag,
    });
  });
  return out;
}

export function buildProfile(reviews: GameReview[], rating: number | null): Profile {
  const profile: Profile = {
    rating,
    gamesAnalyzed: reviews.length,
    mistakesByKind: {
      hanging_piece: 0,
      bad_trade: 0,
      time_pressure: 0,
      missed_capture: 0,
      king_safety: 0,
      endgame_conversion: 0,
      tactical_blind_spot: 0,
    },
    flaggedByPhase: { opening: 0, middlegame: 0, endgame: 0 },
    flagged: [],
    blunders: 0,
    mistakes: 0,
    inaccuracies: 0,
    accuracy: 0,
    record: { win: 0, loss: 0, draw: 0 },
  };
  for (const game of reviews) {
    const c = game.counts[game.playerColor];
    profile.blunders += c.blunder;
    profile.mistakes += c.mistake;
    profile.inaccuracies += c.inaccuracy;
    profile.record[game.outcome]++;
    profile.accuracy += game.accuracy[game.playerColor];
    for (const f of flaggedMoves(game)) {
      profile.flagged.push(f);
      profile.flaggedByPhase[f.phase]++;
      profile.mistakesByKind[f.flag.kind]++;
    }
  }
  profile.flagged.sort((a, b) => b.drop - a.drop);
  profile.accuracy = reviews.length ? profile.accuracy / reviews.length : 0;
  return profile;
}
