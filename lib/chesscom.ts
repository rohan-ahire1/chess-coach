import type { FetchResult, FetchedGame, TimeControl } from "./types";

const DEFAULT_MAX_GAMES = 15;
const MIN_GAMES = 5;
const MAX_ARCHIVES_TO_WALK = 18; // up to ~1.5 years back; stop early once we have enough.

export class NotFoundError extends Error {}
export class NotEnoughGamesError extends Error {
  constructor(public found: number) {
    super(`Only ${found} games found`);
  }
}

interface ChessComGame {
  pgn?: string;
  time_class?: string;
  time_control?: string;
  end_time?: number;
  white?: { username?: string; rating?: number };
  black?: { username?: string; rating?: number };
}

function matchesTimeControl(timeClass: string | undefined, tc: TimeControl): boolean {
  if (tc === "all") return true;
  return timeClass === tc;
}

/**
 * Walk a player's monthly archives newest-first, collecting up to MAX_GAMES
 * games matching the requested time control. Chess.com has no "last N games"
 * endpoint, so we page through monthly archives.
 */
export async function fetchGames(
  rawUsername: string,
  timeControl: TimeControl,
  maxGames: number = DEFAULT_MAX_GAMES,
  onProgress?: (collected: number) => void
): Promise<FetchResult> {
  const username = rawUsername.trim().toLowerCase();
  if (!username) throw new NotFoundError("Empty username");

  const archivesRes = await fetch(
    `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`
  );
  if (archivesRes.status === 404) throw new NotFoundError("Player not found");
  if (!archivesRes.ok) throw new Error(`Chess.com API error: ${archivesRes.status}`);

  const { archives } = (await archivesRes.json()) as { archives: string[] };
  if (!archives || archives.length === 0) throw new NotEnoughGamesError(0);

  const collected: FetchedGame[] = [];
  // Newest archives are last in the array.
  const ordered = [...archives].reverse().slice(0, MAX_ARCHIVES_TO_WALK);

  for (const archiveUrl of ordered) {
    if (collected.length >= maxGames) break;
    const res = await fetch(archiveUrl);
    if (!res.ok) continue; // skip a bad month rather than failing the whole run
    const { games } = (await res.json()) as { games: ChessComGame[] };
    if (!games) continue;

    // Within a month, newest games are last.
    for (const g of [...games].reverse()) {
      if (collected.length >= maxGames) break;
      if (!g.pgn) continue;
      if (!matchesTimeControl(g.time_class, timeControl)) continue;

      const isWhite = g.white?.username?.toLowerCase() === username;
      const playerSide = isWhite ? g.white : g.black;

      collected.push({
        pgn: g.pgn,
        timeClass: g.time_class ?? "unknown",
        timeControl: g.time_control ?? "",
        playerRating: playerSide?.rating ?? null,
        playerIsWhite: isWhite,
        endTime: g.end_time ?? 0,
      });
      onProgress?.(collected.length);
    }
  }

  if (collected.length < MIN_GAMES) throw new NotEnoughGamesError(collected.length);

  // Most recent game first → its rating is the player's current rating.
  collected.sort((a, b) => b.endTime - a.endTime);
  const rating = collected.find((g) => g.playerRating != null)?.playerRating ?? null;

  return { games: collected, rating, username };
}
