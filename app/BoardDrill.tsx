"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Chess } from "chess.js";
import { Engine } from "@/lib/engine";
import {
  MISTAKE_LABELS,
  PHASE_LABELS,
  bestMoveSan,
  formatClock,
  mistakeProofLabel,
  whyFlagged,
} from "@/lib/insights";
import type { BlunderExample, PracticeStatus } from "@/lib/types";
import Icon from "./Icon";

const Chessboard = dynamic(() => import("react-chessboard").then((m) => m.Chessboard), {
  ssr: false,
});

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PUZZLE_DEPTH = 12;
const SOLVE_TOLERANCE_CP = 90;

const AMBER_FROM = { background: "rgba(201,138,43,0.30)" };
const AMBER_TO = { background: "rgba(201,138,43,0.45)" };
const GREEN_FROM = { background: "rgba(31,111,85,0.30)" };
const GREEN_TO = { background: "rgba(31,111,85,0.48)" };
const RED_FROM = { background: "rgba(180,69,47,0.28)" };
const RED_TO = { background: "rgba(180,69,47,0.45)" };

function playerIsWhite(fen: string): boolean {
  return fen.split(" ")[1] !== "b";
}

function uciToSan(fen: string, uci: string): string {
  try {
    const c = new Chess(fen);
    const m = c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: (uci.slice(4, 5) || undefined) as any,
    });
    return m ? m.san : uci;
  } catch {
    return uci;
  }
}

function pawnsLabel(cp: number): string {
  const p = Math.abs(cp) / 100;
  if (cp >= 9000) return "winning";
  if (cp <= -9000) return "losing";
  if (Math.abs(cp) < 40) return "roughly equal";
  return `${cp > 0 ? "you're up" : "you're down"} ~${p.toFixed(1)}`;
}

function legalTargets(fen: string, square: string): string[] {
  try {
    const c = new Chess(fen);
    return c.moves({ square: square as any, verbose: true }).map((m: any) => m.to);
  } catch {
    return [];
  }
}

function playedSquares(b: BlunderExample): { from: string; to: string } | null {
  try {
    const c = new Chess(b.fen);
    const m = c.move(b.move);
    return m ? { from: m.from, to: m.to } : null;
  } catch {
    return null;
  }
}

type Status = "ready" | "thinking" | "solved" | "wrong" | "shown" | "best";

type BoardArrow = [string, string, string?];

interface BoardState {
  status: Status;
  fen: string;
  feedback: string;
  highlight: Record<string, React.CSSProperties>;
  arrows: BoardArrow[];
  evalWhiteCp: number;
}

const ARROW_AMBER = "#c98a2b";
const ARROW_GREEN = "#1f6f55";
const ARROW_RED = "#b4452f";

function EvalBar({
  whiteCp,
  height,
  whiteAtBottom,
}: {
  whiteCp: number;
  height: number;
  whiteAtBottom: boolean;
}) {
  const frac = 1 / (1 + Math.exp(-whiteCp / 350));
  const mate = Math.abs(whiteCp) >= 9000;
  const pawns = Math.abs(whiteCp) / 100;
  // Keep the label short enough to fit inside the bar: drop the decimal once we
  // hit double digits ("24" not "24.5"), and show "M" for mate-range scores.
  const label = mate ? "M" : pawns >= 9.95 ? Math.round(pawns).toString() : pawns.toFixed(1);
  const whiteLeads = whiteCp >= 0;
  const numAtBottom = whiteLeads === whiteAtBottom;
  const evaluation = mate
    ? `${whiteLeads ? "White" : "Black"} has a forced mate`
    : `${whiteLeads ? "White" : "Black"} leads by ${label} pawns`;
  return (
    <div
      className="eval-bar"
      style={{ height }}
      role="meter"
      aria-label="Position evaluation"
      aria-valuemin={-10000}
      aria-valuemax={10000}
      aria-valuenow={Math.max(-10000, Math.min(10000, whiteCp))}
      aria-valuetext={evaluation}
    >
      <div
        className="eval-white"
        style={{ height: `${frac * 100}%`, [whiteAtBottom ? "bottom" : "top"]: 0 }}
      />
      <span
        className={`eval-num ${whiteLeads ? "on-white" : "on-black"}`}
        style={{ [numAtBottom ? "bottom" : "top"]: 3 } as React.CSSProperties}
      >
        {label}
      </span>
    </div>
  );
}

export default function BoardDrill({
  blunder,
  analyzing,
  cleanDone,
  practiceStatus,
  queueStats,
  selIdx,
  onPractice,
  onPrev,
  onNext,
  onOpenDrill,
}: {
  blunder: BlunderExample | undefined;
  analyzing: boolean;
  cleanDone: boolean;
  practiceStatus?: PracticeStatus;
  queueStats: { total: number; fixed: number; missed: number; later: number; done: number };
  selIdx: number;
  onPractice: (status: PracticeStatus) => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenDrill?: () => void;
}) {
  const engineRef = useRef<Engine | null>(null);
  const [bs, setBs] = useState<BoardState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [boardW, setBoardW] = useState(360);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const key = blunder ? `${blunder.gameIndex}-${blunder.moveNumber}-${blunder.move}` : "none";

  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth;
      if (!w) return;
      // Keep the board, evaluation bar, gap, and card padding inside the actual
      // container. A small floor is useful, but it must never override width.
      const maxByWidth = Math.max(168, w - 78);
      const viewportLimit = Math.max(168, window.innerHeight - 340);
      const sizeCap = wrapRef.current?.closest(".drill-screen") ? 500 : 560;
      const nextWidth = Math.floor(Math.min(maxByWidth, viewportLimit, sizeCap));
      setBoardW((current) => (current === nextWidth ? current : nextWidth));
    };
    measure();
    const t = setTimeout(measure, 50);
    const observer = new ResizeObserver(measure);
    if (wrapRef.current) observer.observe(wrapRef.current);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [key]);

  useEffect(() => () => engineRef.current?.terminate(), []);

  useEffect(() => {
    setSelected(null);
    if (!blunder) {
      setBs(null);
      return;
    }
    const sq = playedSquares(blunder);
    setBs({
      status: "ready",
      fen: blunder.fen,
      feedback: `You played ${blunder.move} — it cost ${(blunder.swingCp / 100).toFixed(
        1
      )} pawns. Find a stronger move, or see what happened.`,
      highlight: sq ? { [sq.from]: AMBER_FROM, [sq.to]: AMBER_TO } : {},
      arrows: sq ? [[sq.from, sq.to, ARROW_AMBER]] : [],
      evalWhiteCp: toWhite(blunder.fen, blunder.bestCp),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function getEngine(): Promise<Engine> {
    if (!engineRef.current) {
      engineRef.current = new Engine();
      await engineRef.current.init();
    }
    return engineRef.current;
  }

  const toWhite = (fen: string, playerCp: number) =>
    playerIsWhite(fen) ? playerCp : -playerCp;

  function resetBoard() {
    if (!blunder) return;
    const sq = playedSquares(blunder);
    setSelected(null);
    setBs({
      status: "ready",
      fen: blunder.fen,
      feedback: `Find a stronger move than ${blunder.move}.`,
      highlight: sq ? { [sq.from]: AMBER_FROM, [sq.to]: AMBER_TO } : {},
      arrows: sq ? [[sq.from, sq.to, ARROW_AMBER]] : [],
      evalWhiteCp: toWhite(blunder.fen, blunder.bestCp),
    });
  }

  function showPlayed() {
    if (!blunder) return;
    const sq = playedSquares(blunder);
    setSelected(null);
    setBs((p) =>
      p
        ? {
            ...p,
            status: "shown",
            fen: blunder.fenAfter,
            feedback: `This is what happened — you played ${blunder.move}${
              blunder.isHang ? `, hanging ${blunder.materialLost} pawns of material` : ""
            }.`,
            highlight: sq ? { [sq.from]: RED_FROM, [sq.to]: RED_TO } : {},
            arrows: sq ? [[sq.from, sq.to, ARROW_RED]] : [],
            evalWhiteCp: toWhite(blunder.fen, blunder.bestCp - blunder.swingCp),
          }
        : p
    );
  }

  function showBest() {
    if (!blunder || !blunder.bestMoveUci) return;
    const uci = blunder.bestMoveUci;
    const san = uciToSan(blunder.fen, uci);
    const c = new Chess(blunder.fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    c.move({ from, to, promotion: "q" });
    setSelected(null);
    setBs((p) =>
      p
        ? {
            ...p,
            status: "best",
            fen: c.fen(),
            feedback: `The engine plays ${san} — ${pawnsLabel(blunder.bestCp)} after that.`,
            highlight: { [from]: GREEN_FROM, [to]: GREEN_TO },
            arrows: [[from, to, ARROW_GREEN]],
            evalWhiteCp: toWhite(blunder.fen, blunder.bestCp),
          }
        : p
    );
  }

  function onSquareClick(square: string) {
    if (!bs || !blunder || bs.status !== "ready") return;
    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      const moved = tryMove(selected, square);
      setSelected(null);
      if (!moved && legalTargets(blunder.fen, square).length > 0) setSelected(square);
      return;
    }
    if (legalTargets(blunder.fen, square).length > 0) setSelected(square);
  }

  function tryMove(source: string, target: string): boolean {
    if (!bs || !blunder || bs.status === "thinking") return false;
    const c = new Chess(blunder.fen);
    let move;
    try {
      move = c.move({ from: source, to: target, promotion: "q" });
    } catch {
      return false;
    }
    if (!move) return false;
    setSelected(null);

    const resultFen = c.fen();
    setBs((p) =>
      p ? { ...p, status: "thinking", fen: resultFen, feedback: `Analyzing ${move!.san}…`, highlight: {}, arrows: [] } : p
    );

    // If they played the engine's stored best move, say so directly. The drill
    // re-evaluates at PUZZLE_DEPTH, which differs from the depth bestCp was
    // analyzed at, so a depth-noise "loss" would otherwise flag the best move
    // as "there's cleaner" — the same move "Show best move" reveals.
    const playedUci = `${source}${target}${move.promotion ?? ""}`;
    if (blunder.bestMoveUci && playedUci === blunder.bestMoveUci) {
      onPractice("solved");
      setBs((p) =>
        p
          ? {
              ...p,
              status: "solved",
              feedback: `${move!.san} — that's the move. ${pawnsLabel(blunder.bestCp)}.`,
              highlight: { [source]: GREEN_FROM, [target]: GREEN_TO },
              arrows: [[source, target, ARROW_GREEN]],
              evalWhiteCp: toWhite(blunder.fen, blunder.bestCp),
            }
          : p
      );
      return true;
    }

    (async () => {
      const engine = await getEngine();
      const { cp } = await engine.evaluate(resultFen, PUZZLE_DEPTH);
      const white = playerIsWhite(blunder.fen);
      const attemptCp = white ? cp : -cp;
      const loss = blunder.bestCp - attemptCp;
      const solved = loss <= SOLVE_TOLERANCE_CP;
      if (solved) onPractice("solved");

      let feedback: string;
      if (loss <= 30) feedback = `${move!.san} — that's the move. ${pawnsLabel(attemptCp)}.`;
      else if (solved)
        feedback = `${move!.san} holds up — material's safe, ${pawnsLabel(attemptCp)}. Good.`;
      else if (loss <= 250)
        feedback = `${move!.san} is playable but gives some back — ${pawnsLabel(attemptCp)}. There's cleaner.`;
      else feedback = `${move!.san} still loses ground — ${pawnsLabel(attemptCp)}. Look again.`;

      setBs((p) =>
        p
          ? {
              ...p,
              status: solved ? "solved" : "wrong",
              feedback,
              highlight: solved
                ? { [source]: GREEN_FROM, [target]: GREEN_TO }
                : { [source]: RED_FROM, [target]: RED_TO },
              arrows: [[source, target, solved ? ARROW_GREEN : ARROW_RED]],
              evalWhiteCp: toWhite(blunder.fen, attemptCp),
            }
          : p
      );
    })();

    return true;
  }

  function selectionStyles(): Record<string, React.CSSProperties> {
    if (!selected || !blunder) return {};
    const styles: Record<string, React.CSSProperties> = {
      [selected]: { background: "rgba(31,111,85,0.30)" },
    };
    for (const t of legalTargets(blunder.fen, selected)) {
      styles[t] = {
        background: "radial-gradient(circle, rgba(31,111,85,0.45) 22%, transparent 26%)",
      };
    }
    return styles;
  }

  const orientation = blunder ? (playerIsWhite(blunder.fen) ? "white" : "black") : "white";
  const solvedAll = queueStats.total > 0 && queueStats.done >= queueStats.total;

  return (
    <div className="card board-card" ref={wrapRef}>
      <div className="board-card-head">
        <div>
          <p className="card-eyebrow">Training queue</p>
          <h2 className="section-title">Find a better move</h2>
        </div>
        {queueStats.total > 0 && (
          <div className="queue-meter" aria-label="Practice progress">
            <strong>
              {queueStats.fixed} of {queueStats.total}
            </strong>
            <span>fixed</span>
          </div>
        )}
      </div>

      {solvedAll && (
        <div className="practice-summary">
          <strong>Practice summary</strong>
          <span>
            {queueStats.fixed} fixed · {queueStats.missed} missed · {queueStats.later} saved for later
          </span>
        </div>
      )}

      <div className="board-row" role="group" aria-label="Interactive training position">
        <EvalBar
          whiteCp={bs ? bs.evalWhiteCp : 0}
          height={boardW}
          whiteAtBottom={orientation === "white"}
        />
        <Chessboard
          position={bs ? bs.fen : START_FEN}
          boardWidth={boardW}
          boardOrientation={orientation}
          arePiecesDraggable={!!bs && bs.status === "ready"}
          onPieceDrop={(s, t) => tryMove(s, t)}
          onSquareClick={onSquareClick}
          customArrows={(bs ? bs.arrows : []) as any}
          customSquareStyles={bs ? { ...selectionStyles(), ...bs.highlight } : {}}
          customBoardStyle={{ borderRadius: "10px", boxShadow: "none" }}
          customDarkSquareStyle={{ backgroundColor: "#b7c4ba" }}
          customLightSquareStyle={{ backgroundColor: "#eef1ec" }}
        />
      </div>

      <div className="board-scroll">
      {!blunder && (
        <p className="review-empty" role="status">
          {analyzing
            ? "Analyzing your games… blunders will appear here to replay."
            : cleanDone
            ? "Clean games — no blunders to replay. Nice."
            : "Run an analysis — every blunder lands here, on the board, to replay and fix."}
        </p>
      )}

      {blunder && bs && (
        <>
          <p className="review-info">
            Game {blunder.gameIndex + 1} · move {blunder.moveNumber} · {MISTAKE_LABELS[blunder.mistakeKind]} ·{" "}
            {PHASE_LABELS[blunder.phase]} · cost {(blunder.swingCp / 100).toFixed(1)}
          </p>
          <p
            id="drill-feedback"
            aria-live="polite"
            aria-atomic="true"
            className={
              bs.status === "solved"
                ? "drill-feedback ok"
                : bs.status === "wrong"
                ? "drill-feedback bad"
                : "drill-feedback"
            }
          >
            {bs.status === "thinking" && <span className="spinner" />}
            {bs.feedback}
          </p>
          <div className="drill-controls">
            <button
              className="secondary reset"
              onClick={resetBoard}
              disabled={bs.status === "ready"}
              title="Put the pieces back and try the position again"
            >
              <Icon name="rotate-ccw" size={17} /> Reset position
            </button>
            {blunder.bestMoveUci && (
              <button
                className="secondary"
                onClick={showBest}
                disabled={bs.status === "best"}
              >
                <Icon name="lightbulb" size={17} /> Best move
              </button>
            )}
            <button
              className="secondary"
              onClick={showPlayed}
              disabled={bs.status === "shown"}
            >
              <Icon name="eye" size={17} /> What happened
            </button>
            {onOpenDrill && (
              <button className="primary evidence-practice" onClick={onOpenDrill}>
                <Icon name="target" size={17} /> Practice this position
              </button>
            )}
          </div>

          <div className="drill-tag">
            <span className="drill-tag-label">Mark this one</span>
            <div className="drill-chips">
              <button
                className={`drill-chip ok${practiceStatus === "solved" ? " active" : ""}`}
                onClick={() => onPractice("solved")}
                aria-pressed={practiceStatus === "solved"}
              >
                Fixed
              </button>
              <button
                className={`drill-chip bad${practiceStatus === "missed" ? " active" : ""}`}
                onClick={() => onPractice("missed")}
                aria-pressed={practiceStatus === "missed"}
              >
                Missed
              </button>
              <button
                className={`drill-chip${practiceStatus === "later" ? " active" : ""}`}
                onClick={() => onPractice("later")}
                aria-pressed={practiceStatus === "later"}
              >
                Later
              </button>
            </div>
          </div>

          <div className="drill-nav">
            <button className="nav-btn" onClick={onPrev} disabled={selIdx <= 0}>
              <Icon name="arrow-left" size={16} /> Previous
            </button>
            <span className="drill-counter">
              {selIdx + 1} <span className="drill-counter-sep">/</span> {queueStats.total}
            </span>
            <button
              className="nav-btn"
              onClick={onNext}
              disabled={selIdx >= queueStats.total - 1}
            >
              Next <Icon name="arrow-right" size={16} />
            </button>
          </div>
          <details className="why-panel">
            <summary>Why this was flagged</summary>
            <div className="why-grid">
              <span>Your move</span>
              <strong>{blunder.move}</strong>
              <span>Stronger move</span>
              <strong>{bestMoveSan(blunder) ?? "Unavailable"}</strong>
              <span>What changed</span>
              <strong>{(blunder.swingCp / 100).toFixed(1)} pawns of value</strong>
              <span>Proof</span>
              <strong>{mistakeProofLabel(blunder)}</strong>
              {blunder.clockAfterSec != null && (
                <>
                  <span>Clock</span>
                  <strong>
                    {formatClock(blunder.clockAfterSec)}
                    {blunder.timeSpentSec != null ? ` left · ${Math.round(blunder.timeSpentSec)}s spent` : " left"}
                  </strong>
                </>
              )}
            </div>
            <p>{whyFlagged(blunder)}</p>
          </details>
        </>
      )}
      </div>
    </div>
  );
}
