import { fenBefore } from "./analysis";
import { MISTAKE_LABELS, buildDiagnosis } from "./insights";
import { findPatterns } from "./patterns";
import { opponentOf } from "./format";
import type { GameReview, Profile } from "./types";

/**
 * Everything that leaves the device lives here: aggregate counts and a few
 * single moves. Never add a PGN, a full move list, a username or a game link.
 */
export function reportPayload(profile: Profile) {
  return {
    rating: profile.rating,
    games: profile.gamesAnalyzed,
    record: profile.record,
    accuracy: Math.round(profile.accuracy * 10) / 10,
    blunders: profile.blunders,
    mistakes: profile.mistakes,
    inaccuracies: profile.inaccuracies,
    by_phase: profile.flaggedByPhase,
    by_kind: profile.mistakesByKind,
    patterns: findPatterns(profile),
    worst_moves: profile.flagged.slice(0, 5).map((f) => ({
      kind: f.flag.kind,
      phase: f.phase,
      judgement: f.judgement,
      played: f.move,
      better: f.bestSan,
      move_number: f.moveNumber,
      chances_before: Math.round(f.winBefore),
      chances_after: Math.round(f.winAfter),
      material_lost: f.flag.materialLost,
      clock_after_seconds: f.clockAfterSec,
    })),
  };
}

export function gamePayload(game: GameReview, rating: number | null) {
  return {
    rating,
    result: game.outcome,
    moments: game.moments.map((ply) => {
      const i = ply - 1;
      const m = game.moves[i];
      const reply = game.moves[i + 1];
      return {
        ply,
        move_number: m.moveNumber,
        side: m.color === "w" ? "White" : "Black",
        phase: m.phase,
        judgement: m.judgement,
        played: m.san,
        opponent_reply: reply?.san ?? null,
        better: m.bestSan,
        engine_line: m.line.slice(0, 4),
        chances_before: Math.round(chanceAfter(game, i) + m.drop),
        chances_after: Math.round(chanceAfter(game, i)),
        kind: m.flag?.kind ?? null,
        material_lost: m.flag?.materialLost ?? 0,
        position: fenBefore(game, i),
      };
    }),
  };
}

function chanceAfter(game: GameReview, index: number): number {
  const white = game.moves[index].whiteWin;
  return game.playerColor === "w" ? white : 100 - white;
}

export async function requestCoaching(profile: Profile): Promise<string | null> {
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "report", data: reportPayload(profile) }),
    });
    if (!res.ok) return null;
    const { coaching } = (await res.json()) as { coaching?: string };
    return coaching ?? null;
  } catch {
    return null;
  }
}

export async function requestGameNotes(
  game: GameReview,
  rating: number | null
): Promise<Record<number, string> | null> {
  if (game.moments.length === 0) return null;
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "game", data: gamePayload(game, rating) }),
    });
    if (!res.ok) return null;
    const { notes } = (await res.json()) as { notes?: Record<number, string> };
    return notes ?? null;
  } catch {
    return null;
  }
}

/** The coach's read when the AI is off, built from the same numbers. */
export function fallbackRead(profile: Profile): string {
  const diagnosis = buildDiagnosis(profile);
  if (!diagnosis) {
    return "No mistakes or blunders in these games. Keep playing and link again after a rough session.";
  }
  const label = MISTAKE_LABELS[diagnosis.kind].toLowerCase();
  const worst = diagnosis.examples[0];
  const example = worst
    ? ` The clearest one was ${worst.move} on move ${worst.moveNumber}${worst.bestSan ? `, where ${worst.bestSan} was there` : ""}.`
    : "";
  return `${diagnosis.summary}${example} One habit will do more for you than any opening. ${diagnosis.drill} Work through the drills below, because they are all ${label} from your own games.`;
}

export function opponentLabel(game: GameReview): string {
  const opp = opponentOf(game);
  return opp.rating ? `${opp.name} (${opp.rating})` : opp.name;
}
