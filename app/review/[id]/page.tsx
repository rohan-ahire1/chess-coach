"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { explainMove } from "@/lib/explain";
import { JUDGEMENT_GLYPH, JUDGEMENT_LABEL } from "@/lib/judge";
import { formatClock, formatEval, moveLabel, opponentOf, playerOf, timeControlLabel } from "@/lib/format";
import { isMuted, playSound, setMuted, soundForSan } from "@/lib/sound";
import type { Color, GameReview, PlayerRef } from "@/lib/types";
import Board, { type BoardArrow } from "../../board/Board";
import { resultWords } from "../../GameRow";
import Icon from "../../Icon";
import { useReport } from "../../ReportProvider";
import Scoresheet from "../../Scoresheet";
import Strip, { stripOf } from "../../Strip";

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/** Material edge for each side, read straight off the position. */
function materialEdge(fen: string): Record<Color, number> {
  let balance = 0;
  for (const ch of fen.split(" ")[0]) {
    const value = VALUES[ch.toLowerCase()];
    if (value) balance += ch === ch.toLowerCase() ? -value : value;
  }
  return { w: Math.max(0, balance), b: Math.max(0, -balance) };
}

function PlayerBar({ player, color, clock, edge, isYou }: { player: PlayerRef; color: Color; clock: number | null; edge: number; isYou: boolean }) {
  return (
    <div className="player-bar">
      <span className={`player-side is-${color}`} aria-label={color === "w" ? "White" : "Black"} />
      <strong>{isYou ? "You" : player.name}</strong>
      {player.rating != null && <small>{player.rating}</small>}
      {edge > 0 && <small className="player-edge">+{edge}</small>}
      {clock != null && <time>{formatClock(clock)}</time>}
    </div>
  );
}

function Review({ game, notes, initialPly, back }: { game: GameReview; notes: Record<number, string> | undefined; initialPly: number; back: { href: string; label: string } }) {
  const [index, setIndex] = useState(() => Math.min(Math.max(0, initialPly), game.moves.length));
  const [flipped, setFlipped] = useState(false);
  const [showBest, setShowBest] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [muted, setMutedState] = useState(false);
  const strip = useMemo(() => stripOf(game), [game]);
  const total = game.moves.length;

  useEffect(() => setMutedState(isMuted()), []);

  const step = useCallback(
    (next: number) => {
      setIndex((current) => {
        const target = Math.min(total, Math.max(0, next));
        if (target === current + 1) playSound(soundForSan(game.moves[target - 1].san));
        return target;
      });
    },
    [game, total]
  );

  const nextTurn = useCallback(() => {
    setIndex((current) => game.moments.find((ply) => ply > current) ?? game.moments[0] ?? current);
  }, [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, select, textarea, [role='slider']")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") step(index - 1);
      else if (e.key === "ArrowRight") step(index + 1);
      else if (e.key === "Home") step(0);
      else if (e.key === "End") step(total);
      else if (e.key === "f") setFlipped((f) => !f);
      else if (e.key === "b") setShowBest((b) => !b);
      else if (e.key === "n") nextTurn();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, nextTurn, step, total]);

  const move = index > 0 ? game.moves[index - 1] : null;
  const fen = move?.fen ?? game.startFen;
  const mine = move?.color === game.playerColor;
  const orientation: Color = flipped ? (game.playerColor === "w" ? "b" : "w") : game.playerColor;
  const top: Color = orientation === "w" ? "b" : "w";
  const edge = materialEdge(fen);
  const clockFor = (color: Color) => {
    for (let i = index - 1; i >= 0; i--) {
      if (game.moves[i].color === color) return game.moves[i].clockAfterSec;
    }
    return null;
  };
  const sideOf = (color: Color) => (color === "w" ? game.white : game.black);
  const hasBest = !!(move?.bestUci && !move.isBest && move.judgement);
  const arrows: BoardArrow[] =
    hasBest && showBest && move?.bestUci
      ? [{ from: move.bestUci.slice(0, 2), to: move.bestUci.slice(2, 4), kind: "best" }]
      : [];
  const momentNumber = move ? game.moments.indexOf(move.ply) + 1 : 0;
  const note = move ? notes?.[move.ply] ?? explainMove(game, index - 1) : null;
  const chancesBefore = Math.round(strip.chances[Math.max(0, index - 1)]);
  const chancesNow = Math.round(strip.chances[index]);
  const opponent = opponentOf(game);
  const drillId = move && mine && move.flag ? `${game.id}:${move.ply}` : null;
  const hasMoments = game.moments.length > 0;

  return (
    <div className="review">
      <header className="review-head">
        <Link className="back" href={back.href}>
          <Icon name="left" size={16} />
          {back.label}
        </Link>
        <h1>
          <span className={`result is-${game.outcome}`}>{resultWords(game)}</span> against {opponent.name}
        </h1>
        <p className="print-line">
          {game.opening && <span>{game.opening}</span>}
          <span>{timeControlLabel(game.timeControl, game.timeClass)}</span>
          <span>
            Accuracy: you {game.accuracy[game.playerColor].toFixed(1)}, {opponent.name}{" "}
            {game.accuracy[game.playerColor === "w" ? "b" : "w"].toFixed(1)}
          </span>
        </p>
      </header>

      <div className="review-grid">
        <div className="review-board">
          <PlayerBar player={sideOf(top)} color={top} clock={clockFor(top)} edge={edge[top]} isYou={top === game.playerColor} />
          <div className="board-box">
            <Board
              fen={fen}
              orientation={orientation}
              lastMove={move ? { from: move.from, to: move.to } : null}
              arrows={arrows}
              badge={move?.judgement ? { square: move.to, glyph: JUDGEMENT_GLYPH[move.judgement], tone: move.judgement } : null}
              quick={scrubbing}
              label={move ? `Position after ${moveLabel(move)}` : "Starting position"}
            />
          </div>
          <PlayerBar
            player={sideOf(orientation)}
            color={orientation}
            clock={clockFor(orientation)}
            edge={edge[orientation]}
            isYou={orientation === game.playerColor}
          />
        </div>

        <section className="note" aria-live="polite">
          {move ? (
            <>
              <p className="note-move">
                <b>
                  {moveLabel(move)}
                  {move.judgement && <i className={`is-${move.judgement}`}>{JUDGEMENT_GLYPH[move.judgement]}</i>}
                </b>
                {momentNumber > 0 && <span className="turn-no">{momentNumber}</span>}
              </p>
              <p className="machine">
                <span>{mine ? "Your move" : "Their move"}</span>
                {move.judgement && <span>{JUDGEMENT_LABEL[move.judgement]}</span>}
                <span>
                  Chances {chancesBefore} to {chancesNow}
                </span>
                <span>Eval {formatEval(move)}</span>
                {move.timeSpentSec != null && <span>{formatClock(move.timeSpentSec)} spent</span>}
              </p>
              <p className="coach-note">{note}</p>
              {hasBest && move.bestSan && (
                <p className="machine">
                  <span>Best was {move.bestSan}</span>
                  {move.line.length > 1 && <span>Line {move.line.join(" ")}</span>}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="note-move">
                <b>Start of the game</b>
              </p>
              <p className="coach-note">
                {hasMoments
                  ? `This game turned ${game.moments.length === 1 ? "once" : `${game.moments.length} times`}. Jump to each turning point, or drag along the strip below.`
                  : "No big swings against you in this one. Drag along the strip to replay it."}
              </p>
            </>
          )}
          <div className="note-actions">
            {hasMoments && (
              <button className="btn" type="button" onClick={nextTurn}>
                Next turning point
              </button>
            )}
            {hasBest && (
              <button className="btn-text" type="button" aria-pressed={showBest} onClick={() => setShowBest((b) => !b)}>
                {showBest ? "Hide best move" : "Show best move"}
              </button>
            )}
            {drillId && (
              <Link className="btn-text" href={`/drill?id=${encodeURIComponent(drillId)}${game.id.startsWith("sample-") ? "&sample=1" : ""}`}>
                Try it yourself
              </Link>
            )}
          </div>
        </section>

        <div className="review-sheet">
          <Scoresheet
            moves={game.moves}
            current={index}
            onSelect={step}
            label="Moves of the game"
          />
          <div className="transport" role="group" aria-label="Move through the game">
            <button type="button" aria-label="First move" onClick={() => step(0)} disabled={index === 0}>
              <Icon name="start" />
            </button>
            <button type="button" aria-label="Previous move" onClick={() => step(index - 1)} disabled={index === 0}>
              <Icon name="back" />
            </button>
            <button type="button" aria-label="Next move" onClick={() => step(index + 1)} disabled={index === total}>
              <Icon name="forward" />
            </button>
            <button type="button" aria-label="Last move" onClick={() => step(total)} disabled={index === total}>
              <Icon name="end" />
            </button>
            <button type="button" aria-label="Flip the board" onClick={() => setFlipped((f) => !f)}>
              <Icon name="flip" />
            </button>
            <button
              type="button"
              aria-label={muted ? "Turn sound on" : "Turn sound off"}
              onClick={() => {
                setMuted(!muted);
                setMutedState(!muted);
              }}
            >
              <Icon name={muted ? "muted" : "sound"} />
            </button>
          </div>
        </div>

        <div className="review-strip">
          <Strip
            {...strip}
            index={index}
            onScrub={(i) => {
              setScrubbing(true);
              setIndex(i);
            }}
            onScrubEnd={() => setScrubbing(false)}
            ariaLabel={`Your chances through the game. ${playerOf(game).name} against ${opponent.name}.`}
          />
        </div>
      </div>
    </div>
  );
}

function ReviewScreen({ id }: { id: string }) {
  const params = useSearchParams();
  const { hydrated, findGame, sample, ensureSample, loadNotes } = useReport();
  const isSample = id.startsWith("sample-");

  useEffect(() => {
    if (isSample && !sample) ensureSample();
  }, [isSample, sample, ensureSample]);

  useEffect(() => {
    if (hydrated && !isSample) loadNotes(id);
  }, [hydrated, id, isSample, loadNotes]);

  const found = findGame(id);
  if (!found) {
    if (!hydrated || isSample) return <div className="page wait" />;
    return (
      <div className="page empty">
        <h1>This game isn&apos;t here.</h1>
        <p>Reviews live in the browser that made them, so a link won&apos;t open on another device.</p>
        <p>
          <Link href="/report">Back to your games</Link>
        </p>
      </div>
    );
  }

  return (
    <Review
      key={id}
      game={found.game}
      notes={found.source?.notes[id]}
      initialPly={Number(params.get("ply") ?? 0)}
      back={
        id.startsWith("bot-")
          ? { href: "/play", label: "Play again" }
          : { href: isSample ? "/report?sample=1" : "/report", label: "All games" }
      }
    />
  );
}

export default function ReviewPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="page wait" />}>
      <ReviewScreen id={decodeURIComponent(params.id)} />
    </Suspense>
  );
}
