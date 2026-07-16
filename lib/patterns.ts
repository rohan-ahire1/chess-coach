import type { BlunderExample, PatternPayload, Profile } from "./types";

type PatternField = "castle_side" | "game_phase" | "material_balance";
type PatternValue = string | null;

interface CandidatePattern {
  field: PatternField;
  value: PatternValue;
  category: string;
  count: number;
  avgLossPawns: number;
  concentration: number;
  overrepresentation: number;
  leverage: number;
  examples: BlunderExample[];
}

const MIN_PATTERN_COUNT = 2;
const MIN_OVERREPRESENTATION = 1.25;

const CATEGORY_LABELS: Record<string, string> = {
  hanging_piece: "hanging pieces",
  bad_trade: "bad trades",
  time_pressure: "low-clock mistakes",
  missed_capture: "missed forcing captures",
  king_safety: "king-safety mistakes",
  endgame_conversion: "endgame conversion mistakes",
  tactical_blind_spot: "tactical blind spots",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function contextValue(b: BlunderExample, field: PatternField): PatternValue {
  return b.context[field] ?? null;
}

function fieldLabel(field: PatternField, value: PatternValue): string {
  if (field === "castle_side") {
    if (value === "kingside") return "after kingside castling";
    if (value === "queenside") return "after queenside castling";
    return "before castling or in games where castling was not reached";
  }
  if (field === "game_phase") return `in the ${String(value)}`;
  if (value === "ahead") return "while ahead in material";
  if (value === "behind") return "while behind in material";
  return "in equal-material positions";
}

function noteForExample(b: BlunderExample): string {
  const loss = round1(b.swingCp / 100);
  const castle =
    b.context.castle_side && b.context.moves_since_castle != null
      ? ` ${b.context.moves_since_castle} moves after ${b.context.castle_side} castle`
      : "";
  return `${CATEGORY_LABELS[b.context.category] ?? b.context.category} for ${loss} pawns${castle}`;
}

function buildCandidates(blunders: BlunderExample[]): CandidatePattern[] {
  const total = blunders.length;
  if (total === 0) return [];

  const categories = new Map<string, BlunderExample[]>();
  for (const b of blunders) {
    const arr = categories.get(b.context.category) ?? [];
    arr.push(b);
    categories.set(b.context.category, arr);
  }

  const fields: PatternField[] = ["castle_side", "game_phase", "material_balance"];
  const candidates: CandidatePattern[] = [];

  for (const field of fields) {
    const globalByValue = new Map<PatternValue, number>();
    for (const b of blunders) {
      const value = contextValue(b, field);
      globalByValue.set(value, (globalByValue.get(value) ?? 0) + 1);
    }

    for (const [category, categoryBlunders] of categories) {
      const categoryTotal = categoryBlunders.length;
      const byValue = new Map<PatternValue, BlunderExample[]>();
      for (const b of categoryBlunders) {
        const value = contextValue(b, field);
        const arr = byValue.get(value) ?? [];
        arr.push(b);
        byValue.set(value, arr);
      }

      for (const [value, examples] of byValue) {
        const count = examples.length;
        if (count < MIN_PATTERN_COUNT) continue;

        const concentration = count / categoryTotal;
        const baseline = (globalByValue.get(value) ?? 0) / total;
        if (baseline <= 0) continue;
        const overrepresentation = concentration / baseline;
        if (overrepresentation < MIN_OVERREPRESENTATION) continue;

        const avgLossPawns = examples.reduce((sum, b) => sum + b.swingCp / 100, 0) / count;
        const leverage = count * avgLossPawns * concentration * Math.min(overrepresentation, 3);
        candidates.push({
          field,
          value,
          category,
          count,
          avgLossPawns,
          concentration,
          overrepresentation,
          leverage,
          examples: [...examples].sort((a, b) => b.swingCp - a.swingCp),
        });
      }
    }
  }

  return candidates.sort((a, b) => b.leverage - a.leverage);
}

export function buildPatternPayload(profile: Profile): PatternPayload {
  const enriched = profile.blunders.filter((b) => b.context);
  const top = buildCandidates(enriched).slice(0, 3);

  return {
    rating: profile.rating,
    games_analyzed: profile.gamesAnalyzed,
    top_patterns: top.map((p) => ({
      description: `${CATEGORY_LABELS[p.category] ?? p.category} ${fieldLabel(p.field, p.value)}`,
      count: p.count,
      avg_eval_loss: round1(p.avgLossPawns),
      examples: p.examples.slice(0, 2).map((b) => ({
        game_url: b.context.game_url,
        move: b.context.move_number,
        note: noteForExample(b),
      })),
    })),
  };
}
