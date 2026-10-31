"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import heroData from "@/lib/hero.json";
import { explainMove } from "@/lib/explain";
import { JUDGEMENT_GLYPH } from "@/lib/judge";
import { moveLabel } from "@/lib/format";
import type { GameReview } from "@/lib/types";
import Board, { type BoardArrow, type BoardBadge } from "./board/Board";
import LinkForm from "./LinkForm";
import Strip, { stripOf } from "./Strip";

const game = heroData as unknown as GameReview;
const PLY_MS = 360;

/** The landing page's whole argument: one game prints, stops at the fall, and answers to the strip. */
export default function Hero() {
  const strip = useMemo(() => stripOf(game), []);
  const fall = useMemo(
    () => game.moments.reduce((worst, ply) => (game.moves[ply - 1].drop > game.moves[worst - 1].drop ? ply : worst), game.moments[0]),
    []
  );
  const [index, setIndex] = useState(0);
  const [printing, setPrinting] = useState(true);
  const [scrubbed, setScrubbed] = useState(false);
  const paused = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIndex(fall);
      setPrinting(false);
      return;
    }
    const timer = window.setInterval(() => {
      if (paused.current) return;
      setIndex((i) => {
        if (i + 1 >= fall) {
          window.clearInterval(timer);
          setPrinting(false);
          return fall;
        }
        return i + 1;
      });
    }, PLY_MS);
    return () => window.clearInterval(timer);
  }, [fall]);

  const scrub = (next: number) => {
    paused.current = true;
    setPrinting(false);
    setScrubbed(true);
    setIndex(next);
  };

  const move = index > 0 ? game.moves[index - 1] : null;
  const atFall = !printing && index === fall;
  const printedTo = scrubbed ? game.moves.length : index;
  const arrows: BoardArrow[] =
    move?.bestUci && move.judgement && !printing
      ? [{ from: move.bestUci.slice(0, 2), to: move.bestUci.slice(2, 4), kind: "best" }]
      : [];
  const badge: BoardBadge | null =
    move?.judgement && (move.judgement !== "inaccuracy" || !printing)
      ? { square: move.to, glyph: JUDGEMENT_GLYPH[move.judgement], tone: move.judgement }
      : null;

  return (
    <section className="hero chart-paper">
      <div className="hero-main">
        <div className="hero-copy">
          <h1>Find the move that cost you the game.</h1>
          <p>
            Link your profile. Stockfish reads your last 15 games, move by move, right in your browser. A coach tells
            you what keeps going wrong.
          </p>
          <LinkForm />
          <p className="hero-sample">
            <a href="/report?sample=1">See a sample report</a>
            <span>Free, no account.</span>
          </p>
        </div>
        <div className="hero-stage">
          <div className="board-box">
            <Board
              fen={move?.fen ?? game.startFen}
              orientation={game.playerColor}
              lastMove={move ? { from: move.from, to: move.to } : null}
              arrows={arrows}
              badge={badge}
              label={move ? `Sample game, after ${moveLabel(move)}` : "Sample game, starting position"}
            />
          </div>
          <div className="hero-margin" aria-live="polite">
            {atFall && move && (
              <>
                <p className="hand">it turned here</p>
                <p className="coach-note">{explainMove(game, index - 1)}</p>
                <p className="machine">
                  {moveLabel(move)}
                  {JUDGEMENT_GLYPH[move.judgement ?? "blunder"]}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="hero-strip">
        <Strip
          {...strip}
          marks={strip.marks.filter((m) => m.index <= printedTo)}
          moments={game.moments.filter((m) => m <= printedTo)}
          ringed={printing ? undefined : fall}
          index={index}
          onScrub={scrub}
          scrubOnHover
          revealed={(printedTo / game.moves.length) * 100}
          ariaLabel="Sample game, your chances move by move. Drag to replay the game on the board."
        />
        <p className="hero-credit">
          A real game between two Stockfish bots, read at depth {game.depth}. Drag the strip to replay it.
        </p>
      </div>
    </section>
  );
}

