import { Chess } from "chess.js";
import type { BlunderExample, MistakeKind, Phase, Profile } from "./types";

export const PHASE_LABELS: Record<Phase, string> = {
  opening: "Opening",
  middlegame: "Middlegame",
  endgame: "Endgame",
};

export const MISTAKE_LABELS: Record<MistakeKind, string> = {
  hanging_piece: "Hanging pieces",
  bad_trade: "Bad trades",
  time_pressure: "Low-clock mistakes",
  missed_capture: "Missed captures",
  king_safety: "King safety",
  endgame_conversion: "Endgame conversion",
  tactical_blind_spot: "Tactical blind spots",
};

const MISTAKE_TITLES: Record<MistakeKind, string> = {
  hanging_piece: "Your biggest leak: hanging pieces.",
  bad_trade: "Your biggest leak: bad trades.",
  time_pressure: "Your biggest leak: low-clock decisions.",
  missed_capture: "Your biggest leak: missed forcing captures.",
  king_safety: "Your biggest leak: king safety.",
  endgame_conversion: "Your biggest leak: endgame conversion.",
  tactical_blind_spot: "Your biggest leak: tactical blind spots.",
};

const MISTAKE_DRILLS: Record<MistakeKind, string> = {
  hanging_piece: "Before you move, name every loose piece for both sides.",
  bad_trade: "Before every capture, count the final material after the recapture.",
  time_pressure: "At 30 seconds, switch to a simple checklist: checks, captures, threats, loose pieces.",
  missed_capture: "For every candidate move, inspect forcing captures before quiet moves.",
  king_safety: "Before pushing a pawn near your king, check every opponent check.",
  endgame_conversion: "In endgames, ask whether your move improves king activity or creates a passer.",
  tactical_blind_spot: "Use a 10-second scan: checks, captures, threats, then undefended pieces.",
};

const MISTAKE_SUBS: Record<MistakeKind, string> = {
  hanging_piece: "Your losses cluster around pieces that could be taken immediately.",
  bad_trade: "You often start exchanges where the final recapture favors the opponent.",
  time_pressure: "Your flagged moves happen with very little time left on the clock.",
  missed_capture: "The stronger move was usually a forcing capture that your move skipped.",
  king_safety: "The damage often comes when the next move hits your king.",
  endgame_conversion: "Your endgames are losing value after the position simplifies.",
  tactical_blind_spot: "The pattern is tactical rather than phase-specific: one forcing move changes the position.",
};

export function blunderId(b: BlunderExample): string {
  return `${b.gameIndex}:${b.moveNumber}:${b.move}:${b.fen}`;
}

export function formatClock(sec: number | null): string {
  if (sec == null) return "unknown";
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${seconds}`;
}

export function bestMoveSan(b: BlunderExample): string | null {
  if (!b.bestMoveUci) return null;
  try {
    const c = new Chess(b.fen);
    const m = c.move({
      from: b.bestMoveUci.slice(0, 2),
      to: b.bestMoveUci.slice(2, 4),
      promotion: (b.bestMoveUci.slice(4, 5) || undefined) as any,
    });
    return m?.san ?? b.bestMoveUci;
  } catch {
    return b.bestMoveUci;
  }
}

export function mistakeProofLabel(b: BlunderExample): string {
  if (b.isHang || b.mistakeKind === "bad_trade") return "Concrete material loss";
  if (b.clockAfterSec != null && b.mistakeKind === "time_pressure") return "Clock-backed pattern";
  return "Engine comparison";
}

export function whyFlagged(b: BlunderExample): string {
  if (b.mistakeKind === "bad_trade") {
    return `The exchange sequence lost about ${b.materialLost} pawns of material after the reply.`;
  }
  if (b.isHang) {
    return `The opponent's next capture won about ${b.materialLost} pawns of material.`;
  }
  if (b.mistakeKind === "time_pressure" && b.clockAfterSec != null) {
    return `Chess.com clock data shows ${formatClock(b.clockAfterSec)} left after the move.`;
  }
  if (b.mistakeKind === "missed_capture") {
    return "The stronger move was a forcing capture; your move let the chance pass.";
  }
  if (b.mistakeKind === "king_safety") {
    return "The next sequence exposed your king, and the engine swing confirms the damage.";
  }
  if (b.mistakeKind === "endgame_conversion") {
    return "In a simplified position, the engine found a much stronger conversion path.";
  }
  return "Same-depth engine comparison found a stronger move by a clear margin.";
}

export interface Diagnosis {
  kind: MistakeKind;
  title: string;
  summary: string;
  confidence: "High" | "Medium" | "Early signal";
  confidenceDetail: string;
  drill: string;
  examples: BlunderExample[];
}

export function buildDiagnosis(profile: Profile): Diagnosis {
  const counts = profile.mistakesByKind ?? ({} as Record<MistakeKind, number>);
  const kinds = Object.keys(MISTAKE_LABELS) as MistakeKind[];
  const topKind = kinds.reduce((best, kind) => {
    const bestN = counts[best] ?? 0;
    const nextN = counts[kind] ?? 0;
    return nextN > bestN ? kind : best;
  }, "tactical_blind_spot" as MistakeKind);
  const topCount = counts[topKind] ?? 0;
  const share = profile.totalBlunders > 0 ? topCount / profile.totalBlunders : 0;
  const confidence =
    profile.gamesAnalyzed >= 10 && topCount >= 5 && share >= 0.4
      ? "High"
      : topCount >= 3
      ? "Medium"
      : "Early signal";
  const examples = [...profile.blunders]
    .filter((b) => b.mistakeKind === topKind || b.mistakeTags?.includes(topKind))
    .sort((a, b) => b.swingCp - a.swingCp)
    .slice(0, 3);

  return {
    kind: topKind,
    title: MISTAKE_TITLES[topKind],
    summary: `${MISTAKE_SUBS[topKind]} ${topCount} of ${profile.totalBlunders} flagged positions point here.`,
    confidence,
    confidenceDetail: `${topCount} matching positions across ${profile.gamesAnalyzed} games`,
    drill: MISTAKE_DRILLS[topKind],
    examples,
  };
}

