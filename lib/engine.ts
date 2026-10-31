/**
 * Client wrapper around the vendored single-threaded Stockfish 19 lite worker.
 * The search runs in a Web Worker, so the page never freezes. Jobs run one at a
 * time from a queue: UCI has a single search, and overlapping `go` commands
 * would hand one caller's result to another.
 *
 * Scores come back from White's side.
 */

export interface EvalResult {
  cp: number | null;
  mate: number | null;
  bestMove: string | null;
  /** Principal variation in UCI. */
  pv: string[];
}

/** What the review needs from an engine, so a script can run it outside a browser. */
export interface Analyzer {
  newGame(): void;
  analyze(fen: string, depth: number): Promise<EvalResult>;
}

/** Parses UCI output into a result. Shared with the sample builder. */
export class UciReader {
  private cp: number | null = 0;
  private mate: number | null = null;
  private pv: string[] = [];

  reset() {
    this.cp = 0;
    this.mate = null;
    this.pv = [];
  }

  /** Feed one line. Returns the result once `bestmove` arrives. */
  read(line: string, whiteToMove: boolean): EvalResult | null {
    if (line.startsWith("info") && line.includes(" score ")) {
      if (/ multipv (?!1 )/.test(line) || line.includes(" lowerbound") || line.includes(" upperbound")) return null;
      const cp = / score cp (-?\d+)/.exec(line);
      const mate = / score mate (-?\d+)/.exec(line);
      if (cp) {
        this.cp = parseInt(cp[1], 10);
        this.mate = null;
      } else if (mate) {
        this.mate = parseInt(mate[1], 10);
        this.cp = null;
      }
      const pv = / pv (.+)$/.exec(line);
      if (pv) this.pv = pv[1].trim().split(/\s+/);
      return null;
    }
    if (!line.startsWith("bestmove")) return null;
    const token = line.split(/\s+/)[1];
    const sign = whiteToMove ? 1 : -1;
    return {
      cp: this.cp == null ? null : this.cp * sign,
      mate: this.mate == null ? null : this.mate * sign,
      bestMove: token && token !== "(none)" ? token : null,
      pv: this.pv,
    };
  }
}

const WORKER_URL = "/engine/stockfish-19-lite-single.js";

export interface BotLevel {
  level: number;
  name: string;
  skill: number;
  depth: number;
  movetime: number;
  /** Chance of playing a random legal move instead of the engine's choice. */
  slip: number;
}

export const BOT_LEVELS: BotLevel[] = [
  { level: 1, name: "New to the game", skill: 0, depth: 1, movetime: 60, slip: 0.34 },
  { level: 2, name: "Casual", skill: 0, depth: 2, movetime: 80, slip: 0.22 },
  { level: 3, name: "Improving", skill: 1, depth: 3, movetime: 120, slip: 0.14 },
  { level: 4, name: "Club player", skill: 3, depth: 4, movetime: 180, slip: 0.08 },
  { level: 5, name: "Strong club", skill: 6, depth: 6, movetime: 260, slip: 0.04 },
  { level: 6, name: "Expert", skill: 10, depth: 9, movetime: 360, slip: 0 },
  { level: 7, name: "Master", skill: 15, depth: 13, movetime: 500, slip: 0 },
  { level: 8, name: "Full strength", skill: 20, depth: 20, movetime: 1000, slip: 0 },
];

export class Engine implements Analyzer {
  private worker: Worker;
  private ready: Promise<void>;
  private tail: Promise<unknown> = Promise.resolve();
  private reader = new UciReader();
  private whiteToMove = true;
  private settle: ((r: EvalResult) => void) | null = null;
  private dead = false;

  constructor() {
    this.worker = new Worker(WORKER_URL);
    this.worker.addEventListener("error", () => this.fail());
    this.ready = new Promise((resolve) => {
      const onReady = (e: MessageEvent) => {
        if (String(e.data).startsWith("readyok")) {
          this.worker.removeEventListener("message", onReady);
          resolve();
        }
      };
      this.worker.addEventListener("message", onReady);
    });
    this.worker.addEventListener("message", (e: MessageEvent) => this.onMessage(String(e.data)));
    this.worker.postMessage("uci");
    this.worker.postMessage("setoption name Hash value 32");
    this.worker.postMessage("isready");
  }

  init(): Promise<void> {
    return this.ready;
  }

  private onMessage(line: string) {
    if (!this.settle) return;
    const result = this.reader.read(line, this.whiteToMove);
    if (!result) return;
    const settle = this.settle;
    this.settle = null;
    settle(result);
  }

  private fail() {
    const settle = this.settle;
    this.settle = null;
    settle?.({ cp: 0, mate: null, bestMove: null, pv: [] });
  }

  private run(fen: string, go: string, skill: number): Promise<EvalResult> {
    const job = this.tail.then(async () => {
      if (this.dead) return { cp: 0, mate: null, bestMove: null, pv: [] };
      await this.ready;
      this.worker.postMessage(`setoption name Skill Level value ${skill}`);
      this.whiteToMove = fen.split(" ")[1] !== "b";
      this.reader.reset();
      return new Promise<EvalResult>((resolve) => {
        this.settle = resolve;
        this.worker.postMessage(`position fen ${fen}`);
        this.worker.postMessage(go);
      });
    });
    this.tail = job.catch(() => undefined);
    return job;
  }

  /** Clears search history. Call once per game, not once per position. */
  newGame() {
    this.tail = this.tail.then(() => this.worker.postMessage("ucinewgame"));
  }

  /** Full-strength analysis at a fixed depth. */
  analyze(fen: string, depth: number): Promise<EvalResult> {
    return this.run(fen, `go depth ${depth}`, 20);
  }

  /** Full-strength answer inside a time budget, for hints and drill checks. */
  think(fen: string, movetime: number): Promise<EvalResult> {
    return this.run(fen, `go movetime ${movetime}`, 20);
  }

  /** The bot's reply at a level. */
  botMove(fen: string, level: BotLevel): Promise<EvalResult> {
    return this.run(fen, `go depth ${level.depth} movetime ${level.movetime}`, level.skill);
  }

  terminate() {
    this.dead = true;
    this.fail();
    this.worker.terminate();
  }
}
