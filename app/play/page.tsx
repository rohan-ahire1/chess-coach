"use client";

import { Chess } from "chess.js";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BOT_LEVELS, Engine, type BotLevel } from "@/lib/engine";
import { formatClock } from "@/lib/format";
import { playSound, soundForSan } from "@/lib/sound";
import type { Color, FetchedGame, Outcome } from "@/lib/types";
import Board, { type BoardArrow, type BoardMove } from "../board/Board";
import Icon from "../Icon";
import { useReport } from "../ReportProvider";
import Scoresheet from "../Scoresheet";

type ColorChoice = Color | "random";

const TIMES = [
  { label: "5 + 0", initial: 300, increment: 0, timeClass: "blitz" },
  { label: "10 + 0", initial: 600, increment: 0, timeClass: "rapid" },
  { label: "15 + 10", initial: 900, increment: 10, timeClass: "rapid" },
  { label: "No clock", initial: 0, increment: 0, timeClass: "rapid" },
];
const START_FEN = new Chess().fen();
const MIN_BOT_MS = 320;
const HINT_MS = 500;
const TICK_MS = 200;

interface Finish {
  outcome: Outcome;
  words: string;
  ending: string;
}

function Setup({ onStart }: { onStart: (color: ColorChoice, level: BotLevel, time: (typeof TIMES)[number]) => void }) {
  const [color, setColor] = useState<ColorChoice>("w");
  const [level, setLevel] = useState(BOT_LEVELS[3]);
  const [time, setTime] = useState(TIMES[1]);

  const colors: { value: ColorChoice; label: string }[] = [
    { value: "w", label: "White" },
    { value: "random", label: "Random" },
    { value: "b", label: "Black" },
  ];

  const clock = time.initial > 0 ? time.initial * 1000 : null;

  return (
    <div className="arena">
      <div className="arena-board setup-board">
        <ClockFace ms={clock} running={false} name={level.name} />
        <div className="board-box">
          <Board fen={START_FEN} orientation={color === "b" ? "b" : "w"} label="Starting position" />
        </div>
        <ClockFace ms={clock} running={false} name="You" />
      </div>

      <section className="setup">
        <h1>Play the bot.</h1>
        <fieldset>
          <legend>Your colour</legend>
          <div className="options">
            {colors.map((c) => (
              <button key={c.value} type="button" aria-pressed={color === c.value} onClick={() => setColor(c.value)}>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Bot strength</legend>
          <div className="options options-grid">
            {BOT_LEVELS.map((l) => (
              <button key={l.level} type="button" aria-pressed={level.level === l.level} onClick={() => setLevel(l)}>
                <span>
                  <b>{l.level}</b>
                  {l.name}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Clock</legend>
          <div className="options">
            {TIMES.map((t) => (
              <button key={t.label} type="button" aria-pressed={time.label === t.label} onClick={() => setTime(t)}>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <button className="btn btn-primary" type="button" onClick={() => onStart(color, level, time)}>
          Start the game
        </button>
      </section>
    </div>
  );
}

function ClockFace({ ms, running, name }: { ms: number | null; running: boolean; name: string }) {
  return (
    <div className={`player-bar${running ? " is-running" : ""}`}>
      <strong>{name}</strong>
      {ms != null && <time className={ms < 20000 ? "is-low" : undefined}>{formatClock(Math.ceil(ms / 1000))}</time>}
    </div>
  );
}

function Game({
  color,
  level,
  time,
  onExit,
}: {
  color: Color;
  level: BotLevel;
  time: (typeof TIMES)[number];
  onExit: () => void;
}) {
  const router = useRouter();
  const { reviewBotGame } = useReport();
  const chess = useRef(new Chess());
  const engine = useRef<Engine | null>(null);
  /** Bumped whenever the position changes under a pending engine reply, which discards it. */
  const turnToken = useRef(0);
  const hasClock = time.initial > 0;
  const clockRef = useRef({ w: time.initial * 1000, b: time.initial * 1000, startedAt: 0 });

  const [fen, setFen] = useState(chess.current.fen());
  const [moves, setMoves] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [clock, setClock] = useState({ w: time.initial * 1000, b: time.initial * 1000 });
  const [finish, setFinish] = useState<Finish | null>(null);
  const [hint, setHint] = useState<BoardArrow | null>(null);
  const [hinting, setHinting] = useState(false);
  const [reviewing, setReviewing] = useState<number | null>(null);

  useEffect(() => {
    const instance = new Engine();
    engine.current = instance;
    return () => {
      turnToken.current++;
      instance.terminate();
    };
  }, []);

  const end = useCallback((result: Finish) => {
    turnToken.current++;
    setFinish(result);
    setHint(null);
    playSound("end");
  }, []);

  const settleResult = useCallback((): Finish | null => {
    const board = chess.current;
    if (board.isCheckmate()) {
      const won = board.turn() !== color;
      return { outcome: won ? "win" : "loss", words: won ? "You won by checkmate." : "Checkmate. The bot won.", ending: "checkmate" };
    }
    if (board.isStalemate()) return { outcome: "draw", words: "Draw by stalemate.", ending: "stalemate" };
    if (board.isDraw()) return { outcome: "draw", words: "Draw.", ending: "a draw" };
    return null;
  }, [color]);

  const stopClock = useCallback(() => {
    const c = clockRef.current;
    if (!hasClock || c.startedAt === 0) return;
    const side = chess.current.turn();
    c[side] = Math.max(0, c[side] - (performance.now() - c.startedAt));
  }, [hasClock]);

  const applyMove = useCallback(
    (move: BoardMove) => {
      stopClock();
      const mover = chess.current.turn();
      const played = chess.current.move({ from: move.from, to: move.to, promotion: move.promotion });
      const c = clockRef.current;
      if (hasClock) {
        c[mover] += time.increment * 1000;
        c.startedAt = performance.now();
        setClock({ w: c.w, b: c.b });
      }
      setFen(chess.current.fen());
      setMoves(chess.current.history());
      setLastMove({ from: move.from, to: move.to });
      setHint(null);
      const result = settleResult();
      if (result) end(result);
      else playSound(soundForSan(played.san));
    },
    [end, hasClock, settleResult, stopClock, time.increment]
  );

  // The clock reads real time, so a throttled tab can't slow it down.
  useEffect(() => {
    if (!hasClock || finish || moves.length === 0) return;
    const timer = window.setInterval(() => {
      const c = clockRef.current;
      const side = chess.current.turn();
      const left = Math.max(0, c[side] - (performance.now() - c.startedAt));
      setClock({ w: side === "w" ? left : c.w, b: side === "b" ? left : c.b });
      if (left <= 0) {
        c[side] = 0;
        const won = side !== color;
        end({ outcome: won ? "win" : "loss", words: won ? "The bot ran out of time." : "You ran out of time.", ending: "time" });
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [color, end, finish, hasClock, moves.length]);

  useEffect(() => {
    if (finish || chess.current.turn() === color) return;
    const token = ++turnToken.current;
    const positionFen = chess.current.fen();
    const startedAt = performance.now();

    (async () => {
      const result = await engine.current?.botMove(positionFen, level);
      const wait = MIN_BOT_MS - (performance.now() - startedAt);
      if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
      if (token !== turnToken.current || !result) return;
      const legal = chess.current.moves({ verbose: true });
      if (Math.random() < level.slip || !result.bestMove) {
        const m = legal[Math.floor(Math.random() * legal.length)];
        if (m) applyMove({ from: m.from, to: m.to, promotion: m.promotion });
        return;
      }
      applyMove({
        from: result.bestMove.slice(0, 2),
        to: result.bestMove.slice(2, 4),
        promotion: result.bestMove[4],
      });
    })();
  }, [applyMove, color, finish, fen, level]);

  const takeBack = () => {
    turnToken.current++;
    const undoing = chess.current.turn() === color ? 2 : 1;
    for (let i = 0; i < undoing; i++) chess.current.undo();
    const history = chess.current.history({ verbose: true });
    const last = history[history.length - 1];
    clockRef.current.startedAt = performance.now();
    setFen(chess.current.fen());
    setMoves(chess.current.history());
    setLastMove(last ? { from: last.from, to: last.to } : null);
    setHint(null);
  };

  const askHint = async () => {
    const token = turnToken.current;
    const position = chess.current.fen();
    setHinting(true);
    const result = await engine.current?.think(position, HINT_MS);
    setHinting(false);
    if (token !== turnToken.current || chess.current.fen() !== position || !result?.bestMove) return;
    setHint({ from: result.bestMove.slice(0, 2), to: result.bestMove.slice(2, 4), kind: "best" });
  };

  const resign = () => {
    stopClock();
    end({ outcome: "loss", words: "You resigned.", ending: "resignation" });
  };

  const review = async () => {
    const id = `bot-${Date.now()}`;
    const you = { name: "You", rating: null };
    const bot = { name: level.name, rating: null };
    const game: FetchedGame = {
      id,
      platform: "lichess",
      pgn: chess.current.pgn(),
      url: null,
      timeClass: time.timeClass,
      timeControl: hasClock ? `${time.initial}+${time.increment}` : "-",
      white: color === "w" ? you : bot,
      black: color === "w" ? bot : you,
      playerColor: color,
      outcome: finish?.outcome ?? "draw",
      ending: finish?.ending ?? null,
      opening: null,
      endTime: Math.floor(Date.now() / 1000),
    };
    setReviewing(0);
    const reviewed = await reviewBotGame(game, setReviewing);
    if (reviewed) router.push(`/review/${reviewed}`);
    else setReviewing(null);
  };

  const turn = fen.split(" ")[1] as Color;
  const yourTurn = turn === color && !finish;
  const bot = color === "w" ? "b" : "w";

  return (
    <div className="arena">
      <div className="arena-board">
        <ClockFace ms={hasClock ? clock[bot] : null} running={!finish && turn === bot} name={level.name} />
        <div className="board-box">
          <Board
            fen={fen}
            orientation={color}
            lastMove={lastMove}
            movable={yourTurn ? color : null}
            onMove={applyMove}
            arrows={hint ? [hint] : []}
            label={`Game against the bot. You are ${color === "w" ? "White" : "Black"}. ${yourTurn ? "Your move." : "Bot to move."}`}
          />
        </div>
        <ClockFace ms={hasClock ? clock[color] : null} running={!finish && turn === color} name="You" />
      </div>

      <section className="arena-panel">
        <div aria-live="polite">
          {finish ? (
            <>
              <h1>{finish.words}</h1>
              <div className="note-actions">
                {moves.length >= 2 && (
                  <button className="btn btn-primary" type="button" onClick={review} disabled={reviewing != null}>
                    {reviewing != null ? `Reading ${Math.round(reviewing * 100)}%` : "Review this game"}
                  </button>
                )}
                <button className="btn" type="button" onClick={onExit}>
                  New game
                </button>
              </div>
            </>
          ) : (
            <h1>{yourTurn ? "Your move." : "The bot is thinking."}</h1>
          )}
        </div>
        <Scoresheet moves={moves.map((san) => ({ san }))} current={moves.length} label="Moves of this game" />
        {!finish && (
          <div className="note-actions">
            <button className="btn" type="button" onClick={askHint} disabled={!yourTurn || hinting}>
              Hint
            </button>
            <button className="btn" type="button" onClick={takeBack} disabled={moves.length < 2}>
              <Icon name="back" size={16} />
              Take back
            </button>
            <button className="btn-text" type="button" onClick={resign} disabled={moves.length === 0}>
              Resign
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function PlayPage() {
  const [setup, setSetup] = useState<{ color: Color; level: BotLevel; time: (typeof TIMES)[number]; round: number } | null>(null);

  if (!setup) {
    return (
      <Setup
        onStart={(color, level, time) =>
          setSetup({
            color: color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color,
            level,
            time,
            round: Date.now(),
          })
        }
      />
    );
  }
  return <Game key={setup.round} color={setup.color} level={setup.level} time={setup.time} onExit={() => setSetup(null)} />;
}
