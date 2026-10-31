"use client";

import { useCallback, useMemo, useRef } from "react";
import { chanceSeries } from "@/lib/analysis";
import { JUDGEMENT_GLYPH } from "@/lib/judge";
import { moveLabel } from "@/lib/format";
import type { GameReview, Judgement } from "@/lib/types";

export interface StripMark {
  index: number;
  judgement: Judgement;
}

interface StripProps {
  /** The player's chances at each position recorded so far, 0 to 100. */
  chances: number[];
  /** Positions on the full strip, minus one. Fixes the horizontal scale. */
  total: number;
  /** Position the printhead sits on. */
  index?: number | null;
  onScrub?: (index: number) => void;
  onScrubEnd?: () => void;
  onLeave?: () => void;
  scrubOnHover?: boolean;
  /** Plies whose segment fell because of the player's move. */
  falls?: number[];
  marks?: StripMark[];
  /** Turning points in reading order, shown as numbered pen circles. */
  moments?: number[];
  /** A ply whose whole fall gets one large pen ring. */
  ringed?: number;
  /** Printhead readout and the slider's spoken value. */
  describe?: (index: number) => string;
  size?: "full" | "mini";
  /** Share of the strip revealed, for a trace printing at constant speed. */
  revealed?: number;
  ariaLabel: string;
}

const PEN_RING = "M21 3.5C31 3 37.5 10.5 37 20.5 36.5 31 29 37.5 19.5 37 9 36.5 2.5 29 3 19 3.5 9.5 11 4 22.5 4.5";
const RING_WIDTH = 64;
const RING_PAD = 32;

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

/** The pen ring stretched to a box in its own coordinates, so the stroke stays one width and still draws on. */
const ringTo = (width: number, height: number) =>
  PEN_RING.replace(/([\d.]+) ([\d.]+)/g, (_, x, y) => `${((x / 40) * width).toFixed(1)} ${((y / 40) * height).toFixed(1)}`);

/**
 * The chart-recorder strip. The horizontal axis is the game, the vertical axis
 * is literal: one small box is 5% chances, 50% is the bold line.
 */
export default function Strip({
  chances,
  total,
  index = null,
  onScrub,
  onScrubEnd,
  onLeave,
  scrubOnHover = false,
  falls = [],
  marks = [],
  moments = [],
  ringed,
  describe,
  size = "full",
  revealed,
  ariaLabel,
}: StripProps) {
  const plot = useRef<HTMLDivElement>(null);
  const held = useRef(false);
  const span = Math.max(total, 1);
  const pos = (i: number) => (i / span) * 100;

  const points = useMemo(
    () => chances.map((c, i) => `${((i / span) * 1000).toFixed(1)},${(100 - clamp(c, 0, 100)).toFixed(2)}`).join(" "),
    [chances, span]
  );

  const indexAt = useCallback(
    (clientX: number) => {
      const rect = plot.current?.getBoundingClientRect();
      if (!rect) return 0;
      return clamp(Math.round(((clientX - rect.left) / rect.width) * span), 0, span);
    },
    [span]
  );

  const scrubbable = !!onScrub && size === "full";
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onScrub || e.button !== 0) return;
    held.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onScrub(indexAt(e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onScrub) return;
    if (held.current || (scrubOnHover && e.pointerType === "mouse")) onScrub(indexAt(e.clientX));
  };
  const release = () => {
    if (held.current) onScrubEnd?.();
    held.current = false;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onScrub || index == null) return;
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      PageDown: index - 10,
      PageUp: index + 10,
      Home: 0,
      End: span,
    };
    const next = moves[e.key];
    if (next == null) return;
    e.preventDefault();
    e.stopPropagation();
    onScrub(clamp(next, 0, span));
  };

  const ticks = useMemo(() => {
    const moves = Math.ceil(span / 2);
    const step = moves > 60 ? 10 : 5;
    const out: number[] = [];
    for (let move = step; move <= moves; move += step) out.push(move);
    return out;
  }, [span]);

  const headLeft = index == null ? 0 : pos(index);
  const readout = index != null ? describe?.(index) : null;
  const ring =
    ringed != null && chances[ringed] != null && chances[ringed - 1] != null
      ? {
          drop: Math.abs(chances[ringed - 1] - chances[ringed]),
          top: 100 - (chances[ringed - 1] + chances[ringed]) / 2,
          left: pos(ringed - 0.5),
        }
      : null;
  const ringHeight = ring ? ((plot.current?.clientHeight ?? 160) * ring.drop) / 100 + RING_PAD : 0;

  return (
    <div className={`strip strip-${size}`}>
      {size === "full" && (
        <div className="strip-rail" aria-hidden="true">
          {marks.map((m) => (
            <span key={m.index} className={`strip-event is-${m.judgement}`} style={{ left: `${pos(m.index)}%` }}>
              {JUDGEMENT_GLYPH[m.judgement]}
            </span>
          ))}
          {readout && (
            <span className="strip-readout" style={{ left: `${headLeft}%`, transform: `translateX(-${headLeft}%)` }}>
              {readout}
            </span>
          )}
        </div>
      )}
      <div
        ref={plot}
        className={`strip-plot${onScrub ? " can-scrub" : ""}`}
        role={scrubbable ? "slider" : "img"}
        aria-label={ariaLabel}
        tabIndex={scrubbable ? 0 : undefined}
        aria-valuemin={scrubbable ? 0 : undefined}
        aria-valuemax={scrubbable ? span : undefined}
        aria-valuenow={scrubbable ? index ?? 0 : undefined}
        aria-valuetext={scrubbable && index != null ? describe?.(index) : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={onLeave}
        onKeyDown={onKeyDown}
      >
        <span className="strip-mid" aria-hidden="true" />
        {index != null && (
          <span
            className="strip-here"
            aria-hidden="true"
            style={
              {
                "--band": `clamp(4px, ${100 / span}%, 16px)`,
                width: "var(--band)",
                left: `clamp(0px, calc(${headLeft}% - var(--band) / 2), calc(100% - var(--band)))`,
              } as React.CSSProperties
            }
          />
        )}
        <div
          className="strip-ink"
          style={revealed == null ? undefined : { clipPath: `inset(-8px ${100 - revealed}% -8px -8px)` }}
        >
          <svg viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline className="strip-trace" points={points} />
            {falls.map((ply) =>
              chances[ply] == null || chances[ply - 1] == null ? null : (
                <line
                  key={ply}
                  className="strip-fall"
                  x1={((ply - 1) / span) * 1000}
                  y1={100 - chances[ply - 1]}
                  x2={(ply / span) * 1000}
                  y2={100 - chances[ply]}
                />
              )
            )}
          </svg>
        </div>
        {ring && (
          <span
            className="strip-ring"
            aria-hidden="true"
            style={{ left: `${ring.left}%`, top: `${ring.top}%`, height: `calc(${ring.drop}% + ${RING_PAD}px)` }}
          >
            <svg viewBox={`0 0 ${RING_WIDTH} ${ringHeight.toFixed(1)}`} preserveAspectRatio="none">
              <path pathLength={1} d={ringTo(RING_WIDTH, ringHeight)} />
            </svg>
          </span>
        )}
        {moments.map((ply, n) =>
          chances[ply] == null ? null : ring && ply === ringed ? (
            <span
              key={ply}
              className="strip-moment is-ringed"
              style={{ left: `calc(${ring.left}% + ${RING_WIDTH / 2}px)`, top: `${ring.top}%` }}
              aria-hidden="true"
            >
              <b>{n + 1}</b>
            </span>
          ) : (
            <span
              key={ply}
              className={`strip-moment${chances[ply] < 24 ? " sits-above" : ""}`}
              style={{ left: `${pos(ply)}%`, top: `${100 - chances[ply]}%` }}
              aria-hidden="true"
            >
              {size === "full" && (
                <>
                  <svg viewBox="0 0 40 40">
                    <path pathLength={1} d={PEN_RING} />
                  </svg>
                  <b>{n + 1}</b>
                </>
              )}
            </span>
          )
        )}
        {index != null && <span className="strip-head" aria-hidden="true" style={{ left: `${headLeft}%` }} />}
      </div>
      {size === "full" && (
        <div className="strip-ruler" aria-hidden="true">
          {ticks.map((move) => (
            <span key={move} style={{ left: `${pos(move * 2 - 1)}%` }}>
              {move}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Strip props for a finished game, so every screen draws it the same way. */
export function stripOf(game: GameReview) {
  const chances = chanceSeries(game);
  const mine = game.moves.filter((m) => m.color === game.playerColor);
  return {
    chances,
    total: game.moves.length,
    falls: mine.filter((m) => m.judgement === "blunder" || m.judgement === "mistake").map((m) => m.ply),
    marks: mine
      .filter((m) => m.judgement === "blunder" || m.judgement === "mistake")
      .map((m) => ({ index: m.ply, judgement: m.judgement as Judgement })),
    moments: game.moments,
    describe: (index: number) => {
      const chance = Math.round(chances[index]);
      if (index === 0) return `Start, your chances ${chance}%`;
      return `${moveLabel(game.moves[index - 1])}, your chances ${chance}%`;
    },
  };
}
