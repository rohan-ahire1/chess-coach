/**
 * Thin client-side wrapper around the vendored single-threaded Stockfish
 * worker (public/stockfish.js). The heavy search runs inside the Web Worker,
 * so the main thread / UI never freezes. We speak UCI and parse eval output.
 *
 * Scores are returned from White's perspective, in centipawns. Mate scores are
 * clamped to a large finite value so downstream swing math never overflows.
 */

const MATE_CP = 10000;

export interface EvalResult {
  /** Centipawns from White's perspective. */
  cp: number;
  /** Engine's best move in UCI (e.g. "g1f3"), or null. */
  bestMove: string | null;
}

export class Engine {
  private worker: Worker;
  private ready: Promise<void>;
  private resolveCurrent: ((r: EvalResult) => void) | null = null;
  private lastScoreCp = 0; // from side-to-move perspective, latest info line
  private sideToMoveWhite = true;
  private configuredSkill = 20; // current bot Skill Level (0–20)

  constructor() {
    this.worker = new Worker("/stockfish.js");
    this.ready = new Promise((resolve) => {
      const onMsg = (e: MessageEvent) => {
        const line = String(e.data);
        if (line.includes("uciok") || line.includes("readyok")) {
          this.worker.removeEventListener("message", onMsg);
          resolve();
        }
      };
      this.worker.addEventListener("message", onMsg);
      this.worker.postMessage("uci");
      this.worker.postMessage("isready");
    });

    this.worker.addEventListener("message", (e: MessageEvent) => this.onMessage(String(e.data)));
  }

  async init(): Promise<void> {
    await this.ready;
  }

  private onMessage(line: string) {
    // Track the latest score from "info ... score cp X" / "score mate Y".
    const scoreIdx = line.indexOf("score ");
    if (scoreIdx !== -1) {
      const rest = line.slice(scoreIdx + 6).trim().split(/\s+/);
      const kind = rest[0];
      const val = parseInt(rest[1], 10);
      if (kind === "cp" && !Number.isNaN(val)) {
        this.lastScoreCp = val;
      } else if (kind === "mate" && !Number.isNaN(val)) {
        this.lastScoreCp = val > 0 ? MATE_CP - val : -MATE_CP - val;
      }
    }

    if (line.startsWith("bestmove") && this.resolveCurrent) {
      // Convert side-to-move score to White's perspective.
      const whiteCp = this.sideToMoveWhite ? this.lastScoreCp : -this.lastScoreCp;
      const clamped = Math.max(-MATE_CP, Math.min(MATE_CP, whiteCp));
      const token = line.split(/\s+/)[1];
      const bestMove = token && token !== "(none)" ? token : null;
      const resolve = this.resolveCurrent;
      this.resolveCurrent = null;
      resolve({ cp: clamped, bestMove });
    }
  }

  /** Evaluate a FEN at the given fixed depth. Returns White-perspective cp. */
  evaluate(fen: string, depth: number): Promise<EvalResult> {
    return new Promise((resolve) => {
      this.sideToMoveWhite = fen.split(" ")[1] !== "b";
      this.lastScoreCp = 0;
      this.resolveCurrent = resolve;
      this.worker.postMessage("ucinewgame");
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  /**
   * Tune bot strength from an approximate Elo. We drive Stockfish's "Skill
   * Level" (0–20), which is universally supported, rather than UCI_Elo (whose
   * support varies by build and which can't go below ~1320). Elo 600 → skill 0,
   * 2600 → skill 20, clamped.
   */
  async setStrength(elo: number): Promise<void> {
    await this.ready;
    const skill = Math.max(0, Math.min(20, Math.round((elo - 600) / 100)));
    this.configuredSkill = skill;
    this.worker.postMessage(`setoption name Skill Level value ${skill}`);
  }

  /** How long the bot should "think", scaled by configured strength. */
  thinkTimeMs(): number {
    return 250 + this.configuredSkill * 25; // 250ms (weak) → 750ms (max)
  }

  /** Ask the bot for a move at its configured strength. */
  bestMove(fen: string, movetime = this.thinkTimeMs()): Promise<EvalResult> {
    return this.go(fen, `go movetime ${movetime}`);
  }

  /**
   * A full-strength suggestion for the "hint" button, independent of the bot's
   * configured (possibly weak) skill. Restores the bot skill afterwards.
   */
  async suggest(fen: string, movetime = 600): Promise<EvalResult> {
    this.worker.postMessage("setoption name Skill Level value 20");
    const r = await this.go(fen, `go movetime ${movetime}`);
    this.worker.postMessage(`setoption name Skill Level value ${this.configuredSkill}`);
    return r;
  }

  /** Shared search runner: position + go command, resolves on bestmove. */
  private go(fen: string, goCmd: string): Promise<EvalResult> {
    return new Promise((resolve) => {
      this.sideToMoveWhite = fen.split(" ")[1] !== "b";
      this.lastScoreCp = 0;
      this.resolveCurrent = resolve;
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(goCmd);
    });
  }

  terminate() {
    this.worker.terminate();
  }
}
