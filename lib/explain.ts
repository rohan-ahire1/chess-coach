import { Chess } from "chess.js";
import { fenBefore, netMaterialLost } from "./analysis";
import type { GameReview, ReviewMove } from "./types";
import { formatClock } from "./format";

const PIECE_NAME: Record<string, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};

function matesFor(m: ReviewMove | undefined, color: "w" | "b"): number | null {
  if (m?.mate == null) return null;
  return m.mate > 0 === (color === "w") ? Math.abs(m.mate) : null;
}

function capturedBy(fen: string, san: string, to: string): { piece: string; square: string } | null {
  if (!san.includes("x")) return null;
  const hit = new Chess(fen).get(to as never);
  return { piece: hit ? hit.type : "p", square: to };
}

function betterClause(game: GameReview, index: number): string {
  const m = game.moves[index];
  if (!m.bestSan) return "";
  if (m.bestSan.endsWith("#")) return ` ${m.bestSan} was checkmate.`;
  const before = fenBefore(game, index);
  const took = capturedBy(before, m.bestSan, m.bestUci?.slice(2, 4) ?? "");
  if (took) return ` Better was ${m.bestSan}, taking the ${PIECE_NAME[took.piece]} on ${took.square}.`;
  if (m.bestSan.endsWith("+")) return ` Better was ${m.bestSan}, with check.`;
  return ` Better was ${m.bestSan}.`;
}

/**
 * Plain words for a move, built only from facts on the board and the engine's
 * numbers. This is what the player reads when the AI coach is unavailable.
 */
export function explainMove(game: GameReview, index: number): string {
  const m = game.moves[index];
  const mine = m.color === game.playerColor;
  const reply = game.moves[index + 1];
  const you = mine ? "you" : "your opponent";
  const your = mine ? "your" : "their";
  const You = mine ? "You" : "Your opponent";

  if (!m.judgement) {
    if (m.isBest) return "The engine's first choice.";
    if (m.bestSan && m.drop >= 1) return `Fine. The engine liked ${m.bestSan} a little more, and the gap is small.`;
    return "As good as the engine's first choice.";
  }

  const better = betterClause(game, index);
  const missedMate = index > 0 ? matesFor(game.moves[index - 1], m.color) : null;
  if (missedMate != null) {
    return `${You} had mate in ${missedMate} here, starting with ${m.bestSan}.`;
  }
  if (reply?.san.endsWith("#")) {
    return `This runs into ${reply.san}, which is checkmate.${better}`;
  }
  const mateAgainst = matesFor(m, m.color === "w" ? "b" : "w");
  if (mateAgainst != null) {
    return `This allows a forced mate in ${mateAgainst}.${better}`;
  }

  if (reply) {
    const took = capturedBy(m.fen, reply.san, reply.to);
    if (took) {
      const piece = new Chess(m.fen).get(reply.from as never)?.type ?? "p";
      const lost = netMaterialLost(reply.fen, reply.to, took.piece, piece);
      if (lost > 0 && m.san.includes("x")) {
        return `This trade costs material. After ${reply.san}, ${you === "you" ? "you come" : "your opponent comes"} out about ${lost} points down.${better}`;
      }
      if (lost > 0) {
        return `This leaves ${your} ${PIECE_NAME[took.piece]} on ${took.square} loose, and ${reply.san} takes it.${better}`;
      }
    }
  }

  const clock =
    mine && m.flag?.kind === "time_pressure" && m.clockAfterSec != null
      ? `With ${formatClock(m.clockAfterSec)} on the clock, this one slips. `
      : "";
  const size = m.judgement === "blunder" ? "This gives away most of" : "This gives away a good part of";
  const lead = m.judgement === "inaccuracy" ? "A small slip." : `${size} ${your} position.`;
  return `${clock}${lead}${better}`.trim();
}
