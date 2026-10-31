/**
 * Writes lib/sample.json and lib/hero.json: real engine-reviewed games between
 * weakened Stockfish bots. Nothing here is invented, and the app labels it as
 * bot games. Run: npx tsx scripts/build-sample.ts
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { Chess } from "chess.js";
import { ANALYSIS_DEPTH, buildProfile, reviewGame } from "../lib/analysis";
import { UciReader, type Analyzer, type EvalResult } from "../lib/engine";
import type { Color, FetchedGame, GameReview, Outcome, Report } from "../lib/types";

const ENGINE_PATH = process.env.ENGINE_PATH ?? "public/engine/stockfish-19-lite-single.js";
const GAMES_TO_PLAY = Number(process.env.GAMES ?? 28);
const WORKERS = Number(process.env.WORKERS ?? 4);
const GAMES_TO_KEEP = 8;

const OPENINGS: { name: string; moves: string[] }[] = [
  { name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
  { name: "Sicilian Defense", moves: ["e4", "c5", "Nf3", "d6"] },
  { name: "French Defense", moves: ["e4", "e6", "d4", "d5"] },
  { name: "Caro-Kann Defense", moves: ["e4", "c6", "d4", "d5"] },
  { name: "Queen's Gambit", moves: ["d4", "d5", "c4", "e6"] },
  { name: "London System", moves: ["d4", "d5", "Bf4", "Nf6"] },
  { name: "Scandinavian Defense", moves: ["e4", "d5", "exd5", "Qxd5"] },
  { name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
];

const OPPONENTS = ["Casual bot", "Improving bot", "Club bot"];

class NodeEngine implements Analyzer {
  private proc = spawn(process.execPath, [ENGINE_PATH], { stdio: ["pipe", "pipe", "inherit"] });
  private reader = new UciReader();
  private whiteToMove = true;
  private settle: ((r: EvalResult) => void) | null = null;
  private ready: (() => void) | null = null;

  constructor() {
    createInterface({ input: this.proc.stdout }).on("line", (line) => this.onLine(line));
  }

  private send(cmd: string) {
    this.proc.stdin.write(`${cmd}\n`);
  }

  private onLine(line: string) {
    if (line.startsWith("readyok")) {
      this.ready?.();
      this.ready = null;
      return;
    }
    if (!this.settle) return;
    const result = this.reader.read(line, this.whiteToMove);
    if (!result) return;
    const settle = this.settle;
    this.settle = null;
    settle(result);
  }

  async init() {
    this.send("uci");
    this.send("setoption name Hash value 32");
    await new Promise<void>((resolve) => {
      this.ready = resolve;
      this.send("isready");
    });
  }

  private go(fen: string, go: string, skill: number): Promise<EvalResult> {
    this.send(`setoption name Skill Level value ${skill}`);
    this.whiteToMove = fen.split(" ")[1] !== "b";
    this.reader.reset();
    return new Promise((resolve) => {
      this.settle = resolve;
      this.send(`position fen ${fen}`);
      this.send(go);
    });
  }

  newGame() {
    this.send("ucinewgame");
  }

  analyze(fen: string, depth: number) {
    return this.go(fen, `go depth ${depth}`, 20);
  }

  bot(fen: string, skill: number, depth: number) {
    return this.go(fen, `go depth ${depth}`, skill);
  }

  quit() {
    this.send("quit");
    this.proc.kill();
  }
}

interface Style {
  skill: number;
  depth: number;
  slip: number;
}

const YOU: Style = { skill: 3, depth: 4, slip: 0.06 };
const THEM: Style[] = [
  { skill: 1, depth: 2, slip: 0.12 },
  { skill: 4, depth: 5, slip: 0.05 },
  { skill: 9, depth: 8, slip: 0.02 },
];

async function play(engine: NodeEngine, n: number): Promise<FetchedGame> {
  const opening = OPENINGS[n % OPENINGS.length];
  const opponent = n % THEM.length;
  const playerColor: Color = n % 2 === 0 ? "w" : "b";
  const board = new Chess();
  for (const san of opening.moves) board.move(san);
  engine.newGame();

  let result: Outcome | null = null;
  let ending = "checkmate";
  let lost = 0;
  while (!board.isGameOver() && board.history().length < 110) {
    const style = board.turn() === playerColor ? YOU : THEM[opponent];
    const fen = board.fen();
    const { bestMove, cp, mate } = await engine.bot(fen, style.skill, style.depth);
    const legal = board.moves({ verbose: true });
    if (Math.random() < style.slip) {
      const m = legal[Math.floor(Math.random() * legal.length)];
      board.move(m.san);
    } else if (bestMove) {
      board.move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: bestMove[4] });
    } else {
      break;
    }
    const sideScore = (mate != null ? (mate > 0 ? 1 : -1) * 2000 : cp ?? 0) * (fen.split(" ")[1] === "w" ? 1 : -1);
    lost = sideScore < -900 ? lost + 1 : 0;
    if (lost >= 6 && !board.isGameOver()) {
      const resigner = fen.split(" ")[1];
      result = resigner === playerColor ? "loss" : "win";
      ending = "resignation";
      break;
    }
  }
  if (!result) {
    if (board.isCheckmate()) result = board.turn() === playerColor ? "loss" : "win";
    else {
      result = "draw";
      ending = board.isStalemate() ? "stalemate" : "agreement";
    }
  }

  const me = { name: "You", rating: null };
  const them = { name: OPPONENTS[opponent], rating: null };
  return {
    id: `sample-${n + 1}`,
    platform: "lichess",
    pgn: board.pgn(),
    url: null,
    timeClass: "rapid",
    timeControl: "600+0",
    white: playerColor === "w" ? me : them,
    black: playerColor === "w" ? them : me,
    playerColor,
    outcome: result,
    ending,
    opening: opening.name,
    endTime: 0,
  };
}

function heroScore(game: GameReview): number {
  const plies = game.moves.length;
  if (plies < 30 || plies > 90 || game.outcome !== "loss") return -1;
  const fall = [...game.moves]
    .filter((m) => m.color === game.playerColor && m.judgement === "blunder")
    .sort((a, b) => b.drop - a.drop)[0];
  if (!fall || fall.ply < 14) return -1;
  const before = game.playerColor === "w" ? game.moves[fall.ply - 2]?.whiteWin : 100 - game.moves[fall.ply - 2]?.whiteWin;
  return before >= 50 ? fall.drop + before / 4 : -1;
}

async function main() {
  const reviews: GameReview[] = [];
  let nextGame = 0;
  const worker = async () => {
    const engine = new NodeEngine();
    await engine.init();
    while (nextGame < GAMES_TO_PLAY) {
      const n = nextGame++;
      const game = await play(engine, n);
      const review = await reviewGame(game, engine);
      if (review) reviews.push(review);
      console.log(`game ${n + 1}: ${game.outcome} in ${review?.moves.length} plies, accuracy ${review?.accuracy[game.playerColor]}`);
    }
    engine.quit();
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));

  const ranked = [...reviews].sort((a, b) => heroScore(b) - heroScore(a));
  const hero = ranked[0];
  if (heroScore(hero) < 0) throw new Error("No clear hero game. Run again.");

  const others = (outcome: Outcome) => reviews.filter((r) => r.outcome === outcome && r !== hero);
  const kept = [hero, ...others("win").slice(0, 3), ...others("loss").slice(0, 3), ...others("draw").slice(0, 1)];
  const day = 86400;
  const now = Math.floor(Date.now() / 1000);
  kept.forEach((game, i) => {
    game.endTime = now - (i + 1) * day;
  });

  const report: Report = {
    player: { platform: "lichess", username: "Sample player", rating: null },
    filter: "standard",
    reviews: kept,
    coaching: null,
    notes: {},
    isSample: true,
    complete: true,
    createdAt: now * 1000,
  };
  writeFileSync("lib/sample.json", JSON.stringify(report));
  writeFileSync(
    "lib/hero.json",
    JSON.stringify({
      ...hero,
      moves: hero.moves.map((m) => (hero.moments.includes(m.ply) ? m : { ...m, line: [], flag: null })),
    })
  );

  const profile = buildProfile(kept, null);
  console.log(`hero ${hero.id}: ${hero.opening}, ${hero.moves.length} plies, moments ${hero.moments}`);
  console.log(`kept ${kept.length}: ${JSON.stringify(profile.record)} accuracy ${profile.accuracy.toFixed(1)} flagged ${profile.flagged.length}`);
  console.log(JSON.stringify(profile.mistakesByKind));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
