"use client";

import { Chess } from "chess.js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildProfile } from "@/lib/analysis";
import { Engine } from "@/lib/engine";
import { whiteWinPercent } from "@/lib/judge";
import { formatClock, opponentOf } from "@/lib/format";
import { playSound, soundForSan } from "@/lib/sound";
import type { Flagged, GameReview, Report } from "@/lib/types";
import Board, { type BoardArrow, type BoardMove } from "../board/Board";
import { useReport } from "../ReportProvider";
import Strip, { stripOf } from "../Strip";

const CHECK_DEPTH = 12;
/** A move within an inaccuracy of the position's value counts as solving it. */
const TOLERANCE = 5;

type Stage = "solving" | "checking" | "wrong" | "solved" | "shown";

function Drill({ report, queue, startId }: { report: Report; queue: Flagged[]; startId: string | null }) {
  const { practice, mark } = useReport();
  const engine = useRef<Engine | null>(null);
  const undo = useRef<number | undefined>(undefined);
  const unsolved = useMemo(() => queue.filter((f) => practice[f.id] !== "solved"), [queue, practice]);
  const [currentId, setCurrentId] = useState<string | null>(() => startId ?? unsolved[0]?.id ?? queue[0]?.id ?? null);
  const flagged = queue.find((f) => f.id === currentId) ?? null;

  const [fen, setFen] = useState(flagged?.fen ?? "");
  const [stage, setStage] = useState<Stage>("solving");
  const [played, setPlayed] = useState<{ from: string; to: string } | null>(null);
  const [hint, setHint] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      window.clearTimeout(undo.current);
      engine.current?.terminate();
    };
  }, []);

  const game: GameReview | undefined = report.reviews.find((r) => r.id === flagged?.gameId);
  const strip = useMemo(() => (game ? stripOf(game) : null), [game]);

  const goTo = useCallback((id: string | null, next: Flagged | undefined) => {
    window.clearTimeout(undo.current);
    setCurrentId(id);
    setFen(next?.fen ?? "");
    setStage("solving");
    setPlayed(null);
    setHint(false);
    setMessage(null);
  }, []);

  const position = flagged ? queue.indexOf(flagged) + 1 : 0;
  const solvedCount = queue.filter((f) => practice[f.id] === "solved").length;

  const next = useCallback(() => {
    const later = queue.slice(position).concat(queue.slice(0, position)).find((f) => practice[f.id] !== "solved" && f.id !== currentId);
    goTo(later?.id ?? null, later);
  }, [currentId, goTo, position, practice, queue]);

  if (!flagged) {
    return (
      <div className="page empty">
        <h1>{queue.length > 0 ? "All solved." : "Nothing to drill."}</h1>
        <p>
          {queue.length > 0
            ? `You worked through ${solvedCount} of your own positions. Play some more games and read them again.`
            : "These games had no mistakes or blunders of yours to practise."}
        </p>
        <p>
          <Link href="/play">Play the bot</Link>
        </p>
      </div>
    );
  }

  const bestArrow: BoardArrow[] =
    stage === "shown" && flagged.bestUci
      ? [{ from: flagged.bestUci.slice(0, 2), to: flagged.bestUci.slice(2, 4), kind: "best" }]
      : [];

  const onMove = async ({ from, to, promotion }: BoardMove) => {
    const board = new Chess(flagged.fen);
    const move = board.move({ from, to, promotion });
    playSound(soundForSan(move.san));
    setFen(board.fen());
    setPlayed({ from, to });
    const uci = from + to + (promotion ?? "");

    let solved = uci === flagged.bestUci;
    if (!solved) {
      setStage("checking");
      if (board.isCheckmate()) solved = true;
      else {
        engine.current ??= new Engine();
        const result = await engine.current.analyze(board.fen(), CHECK_DEPTH);
        if (!result.bestMove && !board.isGameOver()) {
          setFen(flagged.fen);
          setPlayed(null);
          setStage("solving");
          setMessage("The engine stopped before it could check that. Try again.");
          engine.current = null;
          return;
        }
        const white = whiteWinPercent(result.cp, result.mate);
        const mine = flagged.color === "w" ? white : 100 - white;
        solved = mine >= flagged.winBefore - TOLERANCE;
      }
    }

    if (solved) {
      setStage("solved");
      setMessage(
        uci === flagged.bestUci
          ? `That's the move. In the game you played ${flagged.move}, and your chances fell from ${Math.round(flagged.winBefore)}% to ${Math.round(flagged.winAfter)}%.`
          : `That works too, and keeps your chances about the same. The engine's first choice was ${flagged.bestSan}. In the game you played ${flagged.move}.`
      );
      mark(flagged.id, "solved");
      return;
    }

    setStage("wrong");
    setMessage(`${move.san} gives too much away. Look again.`);
    mark(flagged.id, "missed");
    undo.current = window.setTimeout(() => {
      setFen(flagged.fen);
      setPlayed(null);
      setStage("solving");
    }, 700);
  };

  const reveal = () => {
    window.clearTimeout(undo.current);
    setFen(flagged.fen);
    setPlayed(null);
    setStage("shown");
    setMessage(
      `${flagged.bestSan} was the move. In the game you played ${flagged.move}, and your chances fell from ${Math.round(flagged.winBefore)}% to ${Math.round(flagged.winAfter)}%.`
    );
    mark(flagged.id, "missed");
  };

  const side = flagged.color === "w" ? "White" : "Black";
  const opponent = game ? opponentOf(game).name : null;

  return (
    <div className="drill">
      <div className="drill-board">
        <div className="board-box">
          <Board
            fen={fen}
            orientation={flagged.color}
            lastMove={played ?? game?.moves[flagged.ply - 2] ?? null}
            movable={stage === "solving" ? flagged.color : null}
            onMove={onMove}
            arrows={bestArrow}
            hintSquare={hint && stage === "solving" ? flagged.bestUci?.slice(0, 2) : null}
            label={`Drill position. ${side} to move.`}
          />
        </div>
      </div>

      <section className="drill-panel">
        <p className="print-line">
          <span>
            Position {position} of {queue.length}
          </span>
          <span>{solvedCount} solved</span>
        </p>
        <h1>{stage === "solved" ? "Solved." : `${side} to move. Find it.`}</h1>
        <p className="machine">
          <span>Move {flagged.moveNumber}</span>
          {opponent && <span>Against {opponent}</span>}
          <span>Your chances {Math.round(flagged.winBefore)}%</span>
          {flagged.clockAfterSec != null && <span>{formatClock(flagged.clockAfterSec)} left</span>}
        </p>

        <div className="note-actions">
          {stage === "solved" || stage === "shown" ? (
            <button className="btn btn-primary" type="button" onClick={next}>
              Next position
            </button>
          ) : (
            <>
              <button className="btn" type="button" onClick={() => setHint(true)} disabled={hint || stage !== "solving"}>
                Show a hint
              </button>
              <button className="btn-text" type="button" onClick={reveal} disabled={stage === "checking"}>
                Show the answer
              </button>
              <button className="btn-text" type="button" onClick={next} disabled={stage === "checking"}>
                Skip
              </button>
            </>
          )}
        </div>

        <div aria-live="polite">
          {stage === "checking" && <p className="machine">Checking your move.</p>}
          {message && stage !== "checking" && <p className="coach-note">{message}</p>}
          {stage === "solved" && <p className="hand">nice</p>}
        </div>

        {game && strip && (
          <div className="drill-source">
            <Strip {...strip} index={flagged.ply - 1} size="mini" ariaLabel="Where this position came from in the game" />
            <Link href={`/review/${game.id}?ply=${flagged.ply}`}>Open the game at this move</Link>
          </div>
        )}
      </section>
    </div>
  );
}

function DrillScreen() {
  const params = useSearchParams();
  const wantsSample = params.get("sample") != null;
  const id = params.get("id");
  const { hydrated, report, sample, ensureSample } = useReport();

  useEffect(() => {
    if (wantsSample && !sample) ensureSample();
  }, [wantsSample, sample, ensureSample]);

  const source = wantsSample ? sample : report;
  const queue = useMemo(
    () => (source ? buildProfile(source.reviews, source.player.rating).flagged.filter((f) => f.bestUci) : []),
    [source]
  );

  if (!hydrated || (wantsSample && !sample)) return <div className="page wait" />;
  if (!source) {
    return (
      <div className="page empty">
        <h1>Drills come from your games.</h1>
        <p>Link your profile first, and every mistake you made turns into a position to solve.</p>
        <p>
          <Link href="/report">Link your profile</Link>
        </p>
      </div>
    );
  }
  return <Drill key={source.createdAt} report={source} queue={queue} startId={id} />;
}

export default function DrillPage() {
  return (
    <Suspense fallback={<div className="page wait" />}>
      <DrillScreen />
    </Suspense>
  );
}
