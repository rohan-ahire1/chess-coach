import type { Flagged, MistakeKind, Phase, Profile } from "./types";

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
  hanging_piece: "You are leaving pieces loose.",
  bad_trade: "Your trades are costing you material.",
  time_pressure: "Your game falls apart when the clock runs low.",
  missed_capture: "You are walking past captures.",
  king_safety: "Your king is getting caught out.",
  endgame_conversion: "Good positions are slipping away in the endgame.",
  tactical_blind_spot: "One forcing move keeps catching you.",
};

const MISTAKE_DRILLS: Record<MistakeKind, string> = {
  hanging_piece: "Before you move, name every loose piece on the board, yours and theirs.",
  bad_trade: "Before every capture, count the material after the last recapture.",
  time_pressure: "At 30 seconds, run one check: checks, captures, threats, loose pieces.",
  missed_capture: "Look at every capture on the board before you look at quiet moves.",
  king_safety: "Before you push a pawn near your king, list every check your opponent gets.",
  endgame_conversion: "In endgames, ask whether your move helps your king or makes a passed pawn.",
  tactical_blind_spot: "Take ten seconds each move for checks, captures, threats, then loose pieces.",
};

const MISTAKE_SUBS: Record<MistakeKind, string> = {
  hanging_piece: "Most of your big drops come from a piece that could be taken on the very next move.",
  bad_trade: "You start exchanges where the last recapture goes your opponent's way.",
  time_pressure: "Your worst moves come with very little left on the clock.",
  missed_capture: "The stronger move was usually a capture you looked past.",
  king_safety: "The damage tends to come when the next move hits your king.",
  endgame_conversion: "You lose ground after the position simplifies.",
  tactical_blind_spot: "The moves look fine until one forcing reply changes everything.",
};

export interface Diagnosis {
  kind: MistakeKind;
  title: string;
  summary: string;
  drill: string;
  count: number;
  examples: Flagged[];
}

export function buildDiagnosis(profile: Profile): Diagnosis | null {
  if (profile.flagged.length === 0) return null;
  const kinds = Object.keys(MISTAKE_LABELS) as MistakeKind[];
  const topKind = kinds.reduce(
    (best, kind) => (profile.mistakesByKind[kind] > profile.mistakesByKind[best] ? kind : best),
    "tactical_blind_spot" as MistakeKind
  );
  const count = profile.mistakesByKind[topKind];
  return {
    kind: topKind,
    title: MISTAKE_TITLES[topKind],
    summary: `${MISTAKE_SUBS[topKind]} ${count} of your ${profile.flagged.length} costly moves point here.`,
    drill: MISTAKE_DRILLS[topKind],
    count,
    examples: profile.flagged.filter((f) => f.flag.kind === topKind).slice(0, 3),
  };
}
