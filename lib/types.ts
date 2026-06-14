export type TimeControl = "blitz" | "rapid" | "all";

export type Phase = "opening" | "middlegame" | "endgame";

export type MistakeKind =
  | "hanging_piece"
  | "bad_trade"
  | "time_pressure"
  | "missed_capture"
  | "king_safety"
  | "endgame_conversion"
  | "tactical_blind_spot";

export type PracticeStatus = "solved" | "missed" | "later";

/** A single game pulled from Chess.com, reduced to what we need. */
export interface FetchedGame {
  pgn: string;
  timeClass: string;
  /** PGN-compliant time control string from Chess.com, e.g. "600+5". */
  timeControl: string;
  /** Rating of the player we're analyzing, in this game. */
  playerRating: number | null;
  /** Which side the analyzed player was. */
  playerIsWhite: boolean;
  endTime: number;
}

export interface FetchResult {
  games: FetchedGame[];
  /** Player's rating from the most recent game (null if unknown). */
  rating: number | null;
  username: string;
}

/** A single flagged blunder — every one is reviewable on the board. */
export interface BlunderExample {
  phase: Phase;
  /** SAN of the move the player actually played. */
  move: string;
  /** FEN before the move (the position the player was looking at). */
  fen: string;
  /** FEN after the played move. */
  fenAfter: string;
  /** Eval swing in centipawns (how much the move cost, mover's perspective). */
  swingCp: number;
  /** True if the move hung material to the opponent's immediate next capture. */
  isHang: boolean;
  /** Net material lost in pawns (0 if not a hang). */
  materialLost: number;
  /** Primary, data-derived mistake bucket used for diagnosis and filters. */
  mistakeKind: MistakeKind;
  /** Secondary data-derived buckets for this same move. */
  mistakeTags: MistakeKind[];
  /** Engine's best move (UCI) in this position, or null. */
  bestMoveUci: string | null;
  /** Eval after the best move, player's perspective (centipawns). */
  bestCp: number;
  /** Remaining clock after this move, when Chess.com PGN has [%clk]. */
  clockAfterSec: number | null;
  /** Approximate time spent on this move, derived from clock comments. */
  timeSpentSec: number | null;
  timeClass: string;
  gameIndex: number;
  moveNumber: number;
}

/** Kept as an alias for the coaching payload (a blunder that hung material). */
export type HangExample = BlunderExample;

/** The aggregate weakness profile. */
export interface Profile {
  rating: number | null;
  gamesAnalyzed: number;
  blundersByPhase: Record<Phase, number>;
  mistakesByKind: Record<MistakeKind, number>;
  hangingPieces: number;
  /** Every flagged blunder, newest game first — the review list. */
  blunders: BlunderExample[];
  /** Worst hang per phase (largest material loss) — used for the coaching payload. */
  worstHangs: HangExample[];
  /** Total blunders across all phases. */
  totalBlunders: number;
}

export interface ProgressState {
  status: "idle" | "fetching" | "analyzing" | "coaching" | "done" | "error";
  current: number;
  total: number;
  message: string;
  partial: boolean;
}
