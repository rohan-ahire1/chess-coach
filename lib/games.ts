import type { Color, FetchResult, FetchedGame, GameFilter, Outcome, Platform } from "./types";

const MAX_ARCHIVES_TO_WALK = 18;

export class NotFoundError extends Error {}
export class NoGamesError extends Error {}
export class RateLimitError extends Error {}

export const PLATFORM_LABEL: Record<Platform, string> = {
  chesscom: "Chess.com",
  lichess: "Lichess",
};

function chessComMatches(timeClass: string | undefined, filter: GameFilter): boolean {
  if (filter === "standard") return timeClass === "rapid" || timeClass === "blitz";
  return timeClass === filter;
}

const LICHESS_PERFS: Record<GameFilter, string> = {
  standard: "blitz,rapid,classical",
  rapid: "rapid,classical",
  blitz: "blitz",
  bullet: "bullet",
};

interface ChessComSide {
  username?: string;
  rating?: number;
  result?: string;
}

interface ChessComGame {
  uuid?: string;
  pgn?: string;
  rules?: string;
  time_class?: string;
  time_control?: string;
  end_time?: number;
  url?: string;
  white?: ChessComSide;
  black?: ChessComSide;
}

const CHESSCOM_DRAWS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
]);

const CHESSCOM_ENDINGS: Record<string, string> = {
  checkmated: "checkmate",
  resigned: "resignation",
  timeout: "time",
  abandoned: "abandonment",
  agreed: "agreement",
  repetition: "repetition",
  stalemate: "stalemate",
  insufficient: "insufficient material",
  "50move": "the 50-move rule",
  timevsinsufficient: "time, with insufficient material",
};

function chessComOpening(pgn: string): string | null {
  const m = /\[ECOUrl "[^"]*\/openings\/([^"]+)"\]/.exec(pgn);
  if (!m) return null;
  const words = decodeURIComponent(m[1]).replace(/\.{2,}.*$/, "").split("-");
  const stop = words.findIndex((w) => /^\d/.test(w));
  const name = stop > 0 ? words.slice(0, stop) : words;
  while (/^(with|and)$/i.test(name[name.length - 1] ?? "")) name.pop();
  return name.join(" ");
}

async function fetchChessCom(
  username: string,
  filter: GameFilter,
  count: number,
  onProgress?: (n: number) => void
): Promise<FetchedGame[]> {
  const archivesRes = await fetch(
    `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`
  );
  if (archivesRes.status === 404) throw new NotFoundError();
  if (archivesRes.status === 429) throw new RateLimitError();
  if (!archivesRes.ok) throw new Error(`Chess.com answered ${archivesRes.status}`);

  const { archives } = (await archivesRes.json()) as { archives?: string[] };
  const collected: FetchedGame[] = [];

  // Chess.com has no "last N games" call, so walk the monthly archives backwards.
  for (const archiveUrl of [...(archives ?? [])].reverse().slice(0, MAX_ARCHIVES_TO_WALK)) {
    if (collected.length >= count) break;
    const res = await fetch(archiveUrl);
    if (!res.ok) continue;
    const { games } = (await res.json()) as { games?: ChessComGame[] };

    for (const g of [...(games ?? [])].reverse()) {
      if (collected.length >= count) break;
      if (!g.pgn || (g.rules && g.rules !== "chess")) continue;
      if (!chessComMatches(g.time_class, filter)) continue;

      const playerColor: Color = g.white?.username?.toLowerCase() === username ? "w" : "b";
      const mine = playerColor === "w" ? g.white : g.black;
      const theirs = playerColor === "w" ? g.black : g.white;
      const outcome: Outcome =
        mine?.result === "win" ? "win" : CHESSCOM_DRAWS.has(mine?.result ?? "") ? "draw" : "loss";
      const endingKey = outcome === "win" ? theirs?.result : mine?.result;

      collected.push({
        id: `cc-${g.uuid ?? g.url ?? collected.length}`,
        platform: "chesscom",
        pgn: g.pgn,
        url: g.url ?? null,
        timeClass: g.time_class ?? "unknown",
        timeControl: g.time_control ?? "",
        white: { name: g.white?.username ?? "White", rating: g.white?.rating ?? null },
        black: { name: g.black?.username ?? "Black", rating: g.black?.rating ?? null },
        playerColor,
        outcome,
        ending: CHESSCOM_ENDINGS[endingKey ?? ""] ?? null,
        opening: chessComOpening(g.pgn),
        endTime: g.end_time ?? 0,
      });
      onProgress?.(collected.length);
    }
  }
  return collected;
}

interface LichessSide {
  user?: { name?: string; id?: string };
  rating?: number;
  aiLevel?: number;
}

interface LichessGame {
  id: string;
  variant?: string;
  speed?: string;
  status?: string;
  lastMoveAt?: number;
  createdAt?: number;
  winner?: "white" | "black";
  players?: { white?: LichessSide; black?: LichessSide };
  opening?: { name?: string };
  clock?: { initial?: number; increment?: number };
  pgn?: string;
}

const LICHESS_ENDINGS: Record<string, string> = {
  mate: "checkmate",
  resign: "resignation",
  stalemate: "stalemate",
  timeout: "abandonment",
  outoftime: "time",
  draw: "agreement",
  insufficientMaterialClaim: "insufficient material",
};

function lichessName(side: LichessSide | undefined, fallback: string): string {
  if (side?.aiLevel) return `Lichess bot, level ${side.aiLevel}`;
  return side?.user?.name ?? fallback;
}

async function fetchLichess(
  username: string,
  filter: GameFilter,
  count: number,
  onProgress?: (n: number) => void
): Promise<FetchedGame[]> {
  const params = new URLSearchParams({
    max: String(count + 4),
    perfType: LICHESS_PERFS[filter],
    pgnInJson: "true",
    clocks: "true",
    opening: "true",
    moves: "true",
    finished: "true",
  });
  const res = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`,
    { headers: { Accept: "application/x-ndjson" } }
  );
  if (res.status === 404) throw new NotFoundError();
  if (res.status === 429) throw new RateLimitError();
  if (!res.ok) throw new Error(`Lichess answered ${res.status}`);

  const games = (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LichessGame);

  const collected: FetchedGame[] = [];
  for (const g of games) {
    if (collected.length >= count) break;
    if (!g.pgn || (g.variant && g.variant !== "standard")) continue;
    if (g.status === "aborted" || g.status === "noStart") continue;

    const whiteId = g.players?.white?.user?.id ?? g.players?.white?.user?.name?.toLowerCase();
    const playerColor: Color = whiteId === username ? "w" : "b";
    const winner: Color | null = g.winner === "white" ? "w" : g.winner === "black" ? "b" : null;

    collected.push({
      id: `li-${g.id}`,
      platform: "lichess",
      pgn: g.pgn,
      url: `https://lichess.org/${g.id}`,
      timeClass: g.speed ?? "unknown",
      timeControl: g.clock ? `${g.clock.initial ?? 0}+${g.clock.increment ?? 0}` : "",
      white: { name: lichessName(g.players?.white, "White"), rating: g.players?.white?.rating ?? null },
      black: { name: lichessName(g.players?.black, "Black"), rating: g.players?.black?.rating ?? null },
      playerColor,
      outcome: winner == null ? "draw" : winner === playerColor ? "win" : "loss",
      ending: LICHESS_ENDINGS[g.status ?? ""] ?? null,
      opening: g.opening?.name ?? null,
      endTime: Math.round((g.lastMoveAt ?? g.createdAt ?? 0) / 1000),
    });
    onProgress?.(collected.length);
  }
  return collected;
}

export async function fetchGames(
  platform: Platform,
  rawUsername: string,
  filter: GameFilter,
  count: number,
  onProgress?: (n: number) => void
): Promise<FetchResult> {
  const username = rawUsername.trim().toLowerCase();
  if (!username) throw new NotFoundError();

  const games =
    platform === "lichess"
      ? await fetchLichess(username, filter, count, onProgress)
      : await fetchChessCom(username, filter, count, onProgress);

  if (games.length === 0) throw new NoGamesError();
  games.sort((a, b) => b.endTime - a.endTime);

  const newest = games[0];
  const rating = (newest.playerColor === "w" ? newest.white : newest.black).rating;
  return { games, rating, username };
}
