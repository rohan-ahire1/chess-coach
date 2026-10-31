import type { Flagged, PlayerPattern, Profile } from "./types";

type PatternField = "castleSide" | "phase" | "materialBalance";
type PatternValue = string | null;

const MIN_PATTERN_COUNT = 2;
const MIN_OVERREPRESENTATION = 1.25;

const CATEGORY_LABELS: Record<string, string> = {
  hanging_piece: "hanging pieces",
  bad_trade: "bad trades",
  time_pressure: "low-clock mistakes",
  missed_capture: "missed captures",
  king_safety: "king-safety mistakes",
  endgame_conversion: "endgame conversion mistakes",
  tactical_blind_spot: "tactical blind spots",
};

function valueOf(f: Flagged, field: PatternField): PatternValue {
  return field === "phase" ? f.phase : f.flag[field];
}

function fieldLabel(field: PatternField, value: PatternValue): string {
  if (field === "castleSide") {
    if (value === "kingside") return "after castling kingside";
    if (value === "queenside") return "after castling queenside";
    return "before castling";
  }
  if (field === "phase") return `in the ${String(value)}`;
  if (value === "ahead") return "while ahead in material";
  if (value === "behind") return "while behind in material";
  return "with material level";
}

/**
 * Finds mistake kinds that cluster in one context: a kind that happens more in
 * that context than the player's mistakes do overall.
 */
export function findPatterns(profile: Profile, limit = 3): PlayerPattern[] {
  const flagged = profile.flagged;
  if (flagged.length === 0) return [];

  const byKind = new Map<string, Flagged[]>();
  for (const f of flagged) byKind.set(f.flag.kind, [...(byKind.get(f.flag.kind) ?? []), f]);

  const candidates: (PlayerPattern & { leverage: number })[] = [];
  for (const field of ["castleSide", "phase", "materialBalance"] as PatternField[]) {
    const overall = new Map<PatternValue, number>();
    for (const f of flagged) overall.set(valueOf(f, field), (overall.get(valueOf(f, field)) ?? 0) + 1);

    for (const [kind, kindFlags] of byKind) {
      const byValue = new Map<PatternValue, Flagged[]>();
      for (const f of kindFlags) byValue.set(valueOf(f, field), [...(byValue.get(valueOf(f, field)) ?? []), f]);

      for (const [value, examples] of byValue) {
        if (examples.length < MIN_PATTERN_COUNT) continue;
        const concentration = examples.length / kindFlags.length;
        const baseline = (overall.get(value) ?? 0) / flagged.length;
        const overrepresentation = concentration / baseline;
        if (overrepresentation < MIN_OVERREPRESENTATION) continue;
        const avgDrop = examples.reduce((sum, f) => sum + f.drop, 0) / examples.length;
        candidates.push({
          description: `${CATEGORY_LABELS[kind] ?? kind} ${fieldLabel(field, value)}`,
          count: examples.length,
          avgDrop: Math.round(avgDrop),
          leverage: examples.length * avgDrop * concentration * Math.min(overrepresentation, 3),
        });
      }
    }
  }

  return candidates
    .sort((a, b) => b.leverage - a.leverage)
    .slice(0, limit)
    .map(({ description, count, avgDrop }) => ({ description, count, avgDrop }));
}
