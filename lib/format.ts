import type { GameReview, ReviewMove } from "./types";

export function formatClock(sec: number | null): string {
  if (sec == null) return "";
  const safe = Math.max(0, sec);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return hours > 0 ? `${hours}:${String(mins).padStart(2, "0")}:${seconds}` : `${mins}:${seconds}`;
}

export function moveLabel(m: Pick<ReviewMove, "moveNumber" | "color" | "san">): string {
  return `${m.moveNumber}${m.color === "w" ? "." : "..."} ${m.san}`;
}

/** Engine score as players read it, from White's side: +1.3, -0.4, M3. */
export function formatEval(m: Pick<ReviewMove, "cp" | "mate">): string {
  if (m.mate != null) return `${m.mate < 0 ? "-" : ""}M${Math.abs(m.mate)}`;
  const pawns = (m.cp ?? 0) / 100;
  return `${pawns >= 0 ? "+" : "−"}${Math.abs(pawns).toFixed(1)}`;
}

export function opponentOf(game: Pick<GameReview, "playerColor" | "white" | "black">) {
  return game.playerColor === "w" ? game.black : game.white;
}

export function playerOf(game: Pick<GameReview, "playerColor" | "white" | "black">) {
  return game.playerColor === "w" ? game.white : game.black;
}

const DAY = 86400;

export function formatDate(unixSec: number): string {
  if (!unixSec) return "";
  const date = new Date(unixSec * 1000);
  const days = Math.floor((Date.now() / 1000 - unixSec) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function timeControlLabel(timeControl: string, timeClass: string): string {
  const m = /^(\d+)(?:\+(\d+))?$/.exec(timeControl);
  const name = timeClass.charAt(0).toUpperCase() + timeClass.slice(1);
  if (!m) return name;
  return `${name} ${Math.round(Number(m[1]) / 60)}+${m[2] ?? 0}`;
}
