import type { Color, Judgement } from "./types";

/**
 * Every label and percentage comes from Lichess's published model, so a player
 * can check any number.
 * Win chance: scalachess `WinPercent`. Move and game accuracy: lila
 * `AccuracyPercent`. Judgement thresholds: lila `Advice`.
 */
const CP_CEILING = 1000;
const WIN_MULTIPLIER = -0.00368208;

/** -1 to 1. */
export function winningChances(cp: number): number {
  const ceiled = Math.max(-CP_CEILING, Math.min(CP_CEILING, cp));
  return 2 / (1 + Math.exp(WIN_MULTIPLIER * ceiled)) - 1;
}

/** 0 to 100, from White's side. A mate score counts as the ceiling. */
export function whiteWinPercent(cp: number | null, mate: number | null): number {
  if (mate != null) return 50 + 50 * winningChances(mate > 0 ? CP_CEILING : -CP_CEILING);
  return 50 + 50 * winningChances(cp ?? 0);
}

export function moveAccuracy(before: number, after: number): number {
  if (after >= before) return 100;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (before - after)) - 3.166924740191411;
  return Math.max(0, Math.min(100, raw + 1));
}

/** Lichess compares winning chances on a -1 to 1 scale: 0.3, 0.2, 0.1. */
export function judge(drop: number): Judgement | null {
  const delta = drop / 50;
  if (delta >= 0.3) return "blunder";
  if (delta >= 0.2) return "mistake";
  if (delta >= 0.1) return "inaccuracy";
  return null;
}

function stdDev(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Game accuracy: the mean of a volatility-weighted mean and a harmonic mean, so
 * one disaster in a calm game costs more than the same swing in a wild one.
 * `whiteWins` has one entry per position, including the start.
 */
export function gameAccuracy(whiteWins: number[]): Record<Color, number> {
  const out: Record<Color, number> = { w: 100, b: 100 };
  if (whiteWins.length < 2) return out;

  const size = clamp(Math.floor((whiteWins.length - 1) / 10), 2, 8);
  const windows: number[][] = [];
  const first = whiteWins.slice(0, size);
  for (let i = 0; i < Math.min(size, whiteWins.length) - 2; i++) windows.push(first);
  for (let i = 0; i + size <= whiteWins.length; i++) windows.push(whiteWins.slice(i, i + size));
  const weights = windows.map((w) => clamp(stdDev(w), 0.5, 12));

  const entries: Record<Color, { accuracy: number; weight: number }[]> = { w: [], b: [] };
  for (let i = 0; i + 1 < whiteWins.length; i++) {
    const color: Color = i % 2 === 0 ? "w" : "b";
    const [prev, next] = [whiteWins[i], whiteWins[i + 1]];
    const accuracy = color === "w" ? moveAccuracy(prev, next) : moveAccuracy(100 - prev, 100 - next);
    entries[color].push({ accuracy, weight: weights[i] ?? 0.5 });
  }

  for (const color of ["w", "b"] as Color[]) {
    const list = entries[color];
    if (list.length === 0) continue;
    const totalWeight = list.reduce((a, e) => a + e.weight, 0);
    const weighted = list.reduce((a, e) => a + e.accuracy * e.weight, 0) / totalWeight;
    const harmonic = list.length / list.reduce((a, e) => a + 1 / Math.max(e.accuracy, 1), 0);
    out[color] = (weighted + harmonic) / 2;
  }
  return out;
}

export const JUDGEMENT_GLYPH: Record<Judgement, string> = {
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

export const JUDGEMENT_LABEL: Record<Judgement, string> = {
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
};
