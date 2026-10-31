export type Platform = "chesscom" | "lichess";
export type GameFilter = "standard" | "rapid" | "blitz" | "bullet";
export type Color = "w" | "b";
export type Phase = "opening" | "middlegame" | "endgame";
export type Judgement = "inaccuracy" | "mistake" | "blunder";
export type Outcome = "win" | "loss" | "draw";
export type PracticeStatus = "solved" | "missed" | "later";
export type MaterialBalance = "ahead" | "equal" | "behind";
export type CastleSide = "kingside" | "queenside" | null;

export type MistakeKind =
  | "hanging_piece"
  | "bad_trade"
  | "time_pressure"
  | "missed_capture"
  | "king_safety"
  | "endgame_conversion"
  | "tactical_blind_spot";

export interface PlayerRef {
  name: string;
  rating: number | null;
}

/** One game from Chess.com or Lichess, reduced to what the review needs. */
export interface FetchedGame {
  id: string;
  platform: Platform;
  pgn: string;
  url: string | null;
  timeClass: string;
  /** "600+5" style, seconds + increment. */
  timeControl: string;
  white: PlayerRef;
  black: PlayerRef;
  playerColor: Color;
  outcome: Outcome;
  /** Plain words for how it ended, e.g. "resignation". */
  ending: string | null;
  opening: string | null;
  /** Unix seconds. */
  endTime: number;
}

export interface FetchResult {
  games: FetchedGame[];
  rating: number | null;
  username: string;
}

/** Why a mistake happened, for the player's own mistakes and blunders. */
export interface MoveFlag {
  kind: MistakeKind;
  tags: MistakeKind[];
  isHang: boolean;
  materialLost: number;
  materialBalance: MaterialBalance;
  castleSide: CastleSide;
  movesSinceCastle: number | null;
}

export interface ReviewMove {
  ply: number;
  moveNumber: number;
  color: Color;
  san: string;
  from: string;
  to: string;
  promotion?: string;
  /** FEN after the move. */
  fen: string;
  /** White's win chance after the move, 0 to 100. */
  whiteWin: number;
  /** Engine score after the move, White's side. Null when `mate` is set. */
  cp: number | null;
  mate: number | null;
  bestUci: string | null;
  bestSan: string | null;
  /** The engine's line from the position before the move, in SAN. */
  line: string[];
  /** Win chance the mover gave away, in percentage points. */
  drop: number;
  accuracy: number;
  judgement: Judgement | null;
  isBest: boolean;
  phase: Phase;
  clockAfterSec: number | null;
  timeSpentSec: number | null;
  flag: MoveFlag | null;
}

export interface GameReview {
  id: string;
  platform: Platform;
  url: string | null;
  white: PlayerRef;
  black: PlayerRef;
  playerColor: Color;
  outcome: Outcome;
  ending: string | null;
  opening: string | null;
  timeClass: string;
  timeControl: string;
  endTime: number;
  startFen: string;
  /** White's win chance before the first move. */
  startWhiteWin: number;
  moves: ReviewMove[];
  accuracy: Record<Color, number>;
  counts: Record<Color, Record<Judgement, number>>;
  /** Plies of the player's costliest moves, in game order, at most three. */
  moments: number[];
  depth: number;
}

/** A player's mistake or blunder, lifted out of its game for drills and patterns. */
export interface Flagged {
  id: string;
  gameId: string;
  ply: number;
  judgement: Judgement;
  phase: Phase;
  color: Color;
  move: string;
  moveNumber: number;
  /** FEN the player was looking at. */
  fen: string;
  fenAfter: string;
  /** Chances for the player, 0 to 100. */
  winBefore: number;
  winAfter: number;
  drop: number;
  bestUci: string | null;
  bestSan: string | null;
  line: string[];
  clockAfterSec: number | null;
  timeSpentSec: number | null;
  timeClass: string;
  flag: MoveFlag;
}

export interface Profile {
  rating: number | null;
  gamesAnalyzed: number;
  mistakesByKind: Record<MistakeKind, number>;
  flaggedByPhase: Record<Phase, number>;
  /** Mistakes and blunders, worst first. */
  flagged: Flagged[];
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  accuracy: number;
  record: Record<Outcome, number>;
}

/** A mistake kind that clusters in one context. */
export interface PlayerPattern {
  description: string;
  count: number;
  /** Average win chance lost, in percentage points. */
  avgDrop: number;
}

export interface LinkedPlayer {
  platform: Platform;
  username: string;
  rating: number | null;
}

export interface Report {
  player: LinkedPlayer;
  filter: GameFilter;
  reviews: GameReview[];
  /** The coach's read across all games. Null until written or if unavailable. */
  coaching: string | null;
  /** The coach's notes on single moves, by game id then ply. */
  notes: Record<string, Record<number, string>>;
  isSample: boolean;
  complete: boolean;
  createdAt: number;
}

export interface LiveTrace {
  gameId: string;
  /** White's win chance before each ply so far. */
  whiteWins: number[];
  plies: number;
}

export type RunStatus = "idle" | "fetching" | "reading" | "coaching" | "done" | "error";

export interface RunState {
  status: RunStatus;
  games: FetchedGame[];
  done: number;
  live: LiveTrace | null;
  error: string | null;
}
