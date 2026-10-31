"use client";

import { Chess } from "chess.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Color } from "@/lib/types";

export type ArrowKind = "best" | "user";
export type BadgeTone = "blunder" | "mistake" | "inaccuracy";

export interface BoardArrow {
  from: string;
  to: string;
  kind: ArrowKind;
}

export interface BoardMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface BoardBadge {
  square: string;
  glyph: string;
  tone: BadgeTone;
}

interface BoardProps {
  fen: string;
  orientation?: Color;
  lastMove?: { from: string; to: string } | null;
  /** Which side a person can move. Leave empty for a board that only shows. */
  movable?: Color | "both" | null;
  onMove?: (move: BoardMove) => void;
  arrows?: BoardArrow[];
  badge?: BoardBadge | null;
  /** A square to point at, used for hints. */
  hintSquare?: string | null;
  /** Shorter slides for scrubbing through many moves. */
  quick?: boolean;
  label: string;
}

interface Placed {
  id: number;
  code: string;
  square: string;
  ms: number;
  instant: boolean;
}

interface Ghost {
  id: number;
  code: string;
  square: string;
}

const FILES = "abcdefgh";
const PIECE_NAMES: Record<string, string> = {
  P: "pawn",
  N: "knight",
  B: "bishop",
  R: "rook",
  Q: "queen",
  K: "king",
};
const ALL_PIECES = ["K", "Q", "R", "B", "N", "P"].flatMap((p) => [`w${p}`, `b${p}`]);
const DRAG_THRESHOLD_PX = 4;
const UNIT = 100;

const fileOf = (square: string) => FILES.indexOf(square[0]);
const rankOf = (square: string) => Number(square[1]) - 1;

function view(square: string, orientation: Color): [number, number] {
  return orientation === "w" ? [fileOf(square), 7 - rankOf(square)] : [7 - fileOf(square), rankOf(square)];
}

function squareDistance(a: string, b: string): number {
  return Math.hypot(fileOf(a) - fileOf(b), rankOf(a) - rankOf(b));
}

/** Longer moves take a little longer, so a queen and a pawn feel like the same hand. */
function slideMs(from: string, to: string, quick: boolean): number {
  if (quick) return 90;
  return Math.round(Math.min(260, Math.max(120, 120 + 28 * Math.sqrt(squareDistance(from, to)))));
}

function placement(fen: string): Map<string, string> {
  const squares = new Map<string, string>();
  fen
    .split(" ")[0]
    .split("/")
    .forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        const empty = Number(ch);
        if (empty) {
          f += empty;
          continue;
        }
        const color = ch === ch.toUpperCase() ? "w" : "b";
        squares.set(`${FILES[f]}${8 - r}`, `${color}${ch.toUpperCase()}`);
        f++;
      }
    });
  return squares;
}

let nextPieceId = 1;

function place(fen: string): Placed[] {
  return [...placement(fen)].map(([square, code]) => ({ id: nextPieceId++, code, square, ms: 0, instant: true }));
}

/**
 * Matches the old position to the new one so each piece keeps its identity and
 * slides. Works for castling, en passant, promotion and jumps of many moves.
 */
function reconcile(
  current: Placed[],
  fen: string,
  hint: { from: string; to: string } | null | undefined,
  quick: boolean,
  droppedOn: string | null
): { pieces: Placed[]; ghosts: Ghost[] } {
  const free = placement(fen);
  const left = new Set(current);
  const pieces: Placed[] = [];

  const take = (piece: Placed, square: string, code: string) => {
    pieces.push({
      ...piece,
      code,
      square,
      ms: slideMs(piece.square, square, quick),
      instant: square === droppedOn,
    });
    left.delete(piece);
    free.delete(square);
  };

  for (const piece of current) {
    if (free.get(piece.square) === piece.code) take(piece, piece.square, piece.code);
  }

  if (hint) {
    const mover = [...left].find((p) => p.square === hint.from);
    const code = free.get(hint.to);
    const promoted = mover?.code[1] === "P" && mover.code[0] === code?.[0];
    if (mover && code && (mover.code === code || promoted)) take(mover, hint.to, code);
  }

  const pairs: { piece: Placed; square: string; code: string; distance: number }[] = [];
  for (const [square, code] of free) {
    for (const piece of left) {
      if (piece.code === code) pairs.push({ piece, square, code, distance: squareDistance(piece.square, square) });
    }
  }
  pairs.sort((a, b) => a.distance - b.distance);
  for (const { piece, square, code } of pairs) {
    if (left.has(piece) && free.has(square)) take(piece, square, code);
  }

  for (const [square, code] of free) {
    pieces.push({ id: nextPieceId++, code, square, ms: 0, instant: true });
  }

  return {
    pieces: pieces.sort((a, b) => a.id - b.id),
    ghosts: [...left].map(({ id, code, square }) => ({ id, code, square })),
  };
}

interface ArrowShape {
  shaft: string;
  head: string;
}

/** Arrow geometry in board units. A knight's arrow turns at a true right angle. */
function arrowShape(from: string, to: string, orientation: Color): ArrowShape {
  const [fx, fy] = view(from, orientation);
  const [tx, ty] = view(to, orientation);
  const start = [(fx + 0.5) * UNIT, (fy + 0.5) * UNIT];
  const end = [(tx + 0.5) * UNIT, (ty + 0.5) * UNIT];
  const dx = tx - fx;
  const dy = ty - fy;
  const isKnight = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);

  const corner = isKnight ? (Math.abs(dx) > Math.abs(dy) ? [end[0], start[1]] : [start[0], end[1]]) : null;
  const towards = corner ?? end;
  const first = Math.hypot(towards[0] - start[0], towards[1] - start[1]);
  const ux = (towards[0] - start[0]) / first;
  const uy = (towards[1] - start[1]) / first;
  const tail = [start[0] + ux * 30, start[1] + uy * 30];

  const lead = corner ?? start;
  const last = Math.hypot(end[0] - lead[0], end[1] - lead[1]);
  const vx = (end[0] - lead[0]) / last;
  const vy = (end[1] - lead[1]) / last;
  const tip = [end[0] - vx * 10, end[1] - vy * 10];
  const base = [tip[0] - vx * 38, tip[1] - vy * 38];
  const shaftEnd = [tip[0] - vx * 32, tip[1] - vy * 32];
  const wing = 21;

  const points = corner ? [tail, corner, shaftEnd] : [tail, shaftEnd];
  return {
    shaft: `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}`,
    head: [
      tip,
      [base[0] - vy * wing, base[1] + vx * wing],
      [base[0] + vy * wing, base[1] - vx * wing],
    ]
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" "),
  };
}

function Arrow({ arrow, orientation }: { arrow: BoardArrow; orientation: Color }) {
  const { shaft, head } = arrowShape(arrow.from, arrow.to, orientation);
  return (
    <g className={`b-arrow b-arrow-${arrow.kind}`}>
      <path d={shaft} pathLength={1} />
      <polygon points={head} />
    </g>
  );
}

function sayPiece(code: string, square: string): string {
  return `${code[0] === "w" ? "White" : "Black"} ${PIECE_NAMES[code[1]]} on ${square}`;
}

interface Press {
  square: string;
  wasSelected: boolean;
  x: number;
  y: number;
  dragging: boolean;
  touch: boolean;
}

export default function Board({
  fen,
  orientation = "w",
  lastMove,
  movable = null,
  onMove,
  arrows = [],
  badge = null,
  hintSquare = null,
  quick = false,
  label,
}: BoardProps) {
  const root = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const droppedOn = useRef<string | null>(null);
  const annotating = useRef<string | null>(null);

  const [shown, setShown] = useState(() => ({ fen, pieces: place(fen), ghosts: [] as Ghost[] }));
  const [selected, setSelected] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<BoardMove | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [userArrows, setUserArrows] = useState<BoardArrow[]>([]);
  const [userMarks, setUserMarks] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");

  if (shown.fen !== fen) {
    const next = reconcile(shown.pieces, fen, lastMove, quick, droppedOn.current);
    droppedOn.current = null;
    setShown({ fen, pieces: next.pieces, ghosts: [...shown.ghosts, ...next.ghosts] });
    setSelected(null);
    setPromotion(null);
    setUserArrows([]);
    setUserMarks([]);
  }

  useEffect(() => {
    ALL_PIECES.forEach((code) => {
      new Image().src = `/pieces/${code}.svg`;
    });
  }, []);

  const position = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return null;
    }
  }, [fen]);

  const turn = fen.split(" ")[1] as Color;
  const canMove = !!movable && (movable === "both" || movable === turn) && !!position;
  const legal = useMemo(() => (canMove && position ? position.moves({ verbose: true }) : []), [canMove, position]);
  const targets = useMemo(
    () => (selected ? legal.filter((m) => m.from === selected) : []),
    [legal, selected]
  );

  const checkedKing = useMemo(() => {
    if (!position?.inCheck()) return null;
    const king = `${position.turn()}K`;
    return [...placement(fen)].find(([, code]) => code === king)?.[0] ?? null;
  }, [position, fen]);

  const codeAt = useCallback((square: string) => shown.pieces.find((p) => p.square === square)?.code ?? null, [shown]);
  const isMine = useCallback(
    (square: string) => {
      const code = codeAt(square);
      return !!code && canMove && code[0] === turn;
    },
    [canMove, codeAt, turn]
  );

  const squareAt = (clientX: number, clientY: number): string | null => {
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const y = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    return orientation === "w" ? `${FILES[x]}${8 - y}` : `${FILES[7 - x]}${y + 1}`;
  };

  const pieceElement = (square: string) =>
    root.current?.querySelector<HTMLElement>(`.b-piece[data-square="${square}"]`) ?? null;

  const commit = (from: string, to: string, dropped: boolean) => {
    const options = legal.filter((m) => m.from === from && m.to === to);
    if (options.length === 0) return false;
    if (options.some((m) => m.promotion)) {
      setPromotion({ from, to });
      setSelected(null);
      return true;
    }
    if (dropped) droppedOn.current = to;
    onMove?.({ from, to });
    setSelected(null);
    return true;
  };

  const endDrag = (square: string) => {
    const el = pieceElement(square);
    if (!el) return;
    el.classList.remove("is-dragging");
    el.style.removeProperty("--dx");
    el.style.removeProperty("--dy");
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const square = squareAt(e.clientX, e.clientY);
    if (e.button === 2) {
      annotating.current = square;
      return;
    }
    if (e.button !== 0 || !square) return;
    setUserArrows([]);
    setUserMarks([]);
    if (!canMove) return;
    if (selected && commit(selected, square, false)) return;
    if (isMine(square)) {
      press.current = {
        square,
        wasSelected: selected === square,
        x: e.clientX,
        y: e.clientY,
        dragging: false,
        touch: e.pointerType === "touch",
      };
      root.current?.setPointerCapture(e.pointerId);
      setSelected(square);
      return;
    }
    setSelected(null);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const held = press.current;
    if (!held) return;
    const dx = e.clientX - held.x;
    const dy = e.clientY - held.y;
    if (!held.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    const el = pieceElement(held.square);
    const rect = root.current?.getBoundingClientRect();
    if (!el || !rect) return;
    const size = rect.width / 8;
    const [vx, vy] = view(held.square, orientation);
    // The piece's centre follows the pointer. On touch it rides above the finger.
    const px = e.clientX - rect.left - (vx + 0.5) * size;
    const py = e.clientY - rect.top - (vy + 0.5) * size - (held.touch ? size * 0.75 : 0);
    if (!held.dragging) {
      held.dragging = true;
      el.classList.add("is-dragging");
    }
    el.style.setProperty("--dx", `${px}px`);
    el.style.setProperty("--dy", `${py}px`);
    const over = squareAt(e.clientX, e.clientY - (held.touch ? size * 0.75 : 0));
    setDropTarget(over && targets.some((m) => m.to === over) ? over : null);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2 && annotating.current) {
      const from = annotating.current;
      const to = squareAt(e.clientX, e.clientY);
      annotating.current = null;
      if (!to) return;
      if (to === from) {
        setUserMarks((marks) => (marks.includes(to) ? marks.filter((m) => m !== to) : [...marks, to]));
      } else {
        setUserArrows((list) =>
          list.some((a) => a.from === from && a.to === to)
            ? list.filter((a) => !(a.from === from && a.to === to))
            : [...list, { from, to, kind: "user" }]
        );
      }
      return;
    }
    const held = press.current;
    press.current = null;
    setDropTarget(null);
    if (!held) return;
    if (held.dragging) {
      const size = (root.current?.getBoundingClientRect().width ?? 0) / 8;
      const to = squareAt(e.clientX, e.clientY - (held.touch ? size * 0.75 : 0));
      if (to && to !== held.square) commit(held.square, to, true);
      endDrag(held.square);
      return;
    }
    if (held.wasSelected) setSelected(null);
  };

  const onPointerCancel = () => {
    const held = press.current;
    press.current = null;
    setDropTarget(null);
    if (held?.dragging) endDrag(held.square);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canMove) return;
    const from = cursor ?? (orientation === "w" ? "e2" : "e7");
    const steps: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    const step = steps[e.key];
    if (step) {
      e.preventDefault();
      e.stopPropagation();
      const sign = orientation === "w" ? 1 : -1;
      const file = Math.min(7, Math.max(0, fileOf(from) + step[0] * sign));
      const rank = Math.min(7, Math.max(0, rankOf(from) + step[1] * sign));
      const next = `${FILES[file]}${rank + 1}`;
      setCursor(next);
      const code = codeAt(next);
      setAnnouncement(code ? sayPiece(code, next) : `${next}, empty`);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (selected && commit(selected, from, false)) return;
      if (isMine(from)) {
        setSelected(from);
        const count = legal.filter((m) => m.from === from).length;
        setAnnouncement(`${sayPiece(codeAt(from) ?? "", from)} selected. ${count} legal moves.`);
      }
      return;
    }
    if (e.key === "Escape") {
      setSelected(null);
      setPromotion(null);
    }
  };

  const choosePromotion = (piece: string) => {
    if (!promotion) return;
    onMove?.({ ...promotion, promotion: piece });
    setPromotion(null);
  };

  const allArrows = [...arrows, ...userArrows];
  const [promoX] = promotion ? view(promotion.to, orientation) : [0];
  const promoFromTop = promotion ? view(promotion.to, orientation)[1] === 0 : true;
  const promoColor = turn;

  return (
    <div
      ref={root}
      className={`board${canMove ? " can-move" : ""}`}
      role={canMove ? "application" : "img"}
      aria-label={label}
      tabIndex={canMove ? 0 : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onKeyDown}
      onBlur={() => setCursor(null)}
    >
      <svg className="b-squares" viewBox="0 0 800 800" shapeRendering="crispEdges" aria-hidden="true">
        <rect className="b-light" width="800" height="800" />
        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8;
          const y = Math.floor(i / 8);
          return (x + y) % 2 === 1 ? (
            <rect key={i} className="b-dark" x={x * UNIT} y={y * UNIT} width={UNIT} height={UNIT} />
          ) : null;
        })}
        {[lastMove?.from, lastMove?.to].map((square, i) => {
          if (!square) return null;
          const [x, y] = view(square, orientation);
          return <rect key={i} className="b-here" x={x * UNIT} y={y * UNIT} width={UNIT} height={UNIT} />;
        })}
        {selected &&
          (() => {
            const [x, y] = view(selected, orientation);
            return <rect className="b-here" x={x * UNIT} y={y * UNIT} width={UNIT} height={UNIT} />;
          })()}
        {dropTarget &&
          (() => {
            const [x, y] = view(dropTarget, orientation);
            return <rect className="b-drop" x={x * UNIT} y={y * UNIT} width={UNIT} height={UNIT} />;
          })()}
        {checkedKing &&
          (() => {
            const [x, y] = view(checkedKing, orientation);
            return <rect className="b-check" x={x * UNIT + 4} y={y * UNIT + 4} width={UNIT - 8} height={UNIT - 8} />;
          })()}
      </svg>

      <div className="b-coords" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={`r${i}`} className={`b-rank${i % 2 === 0 ? " on-light" : " on-dark"}`} style={{ top: `${i * 12.5}%` }}>
            {orientation === "w" ? 8 - i : i + 1}
          </span>
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <span key={`f${i}`} className={`b-file${i % 2 === 0 ? " on-dark" : " on-light"}`} style={{ left: `${i * 12.5}%` }}>
            {orientation === "w" ? FILES[i] : FILES[7 - i]}
          </span>
        ))}
      </div>

      {targets.length > 0 && (
        <svg className="b-layer" viewBox="0 0 800 800" aria-hidden="true">
          {targets.map((m) => {
            const [x, y] = view(m.to, orientation);
            const cx = (x + 0.5) * UNIT;
            const cy = (y + 0.5) * UNIT;
            return m.captured ? (
              <circle key={m.to + (m.promotion ?? "")} className="b-take" cx={cx} cy={cy} r={43} />
            ) : (
              <circle key={m.to + (m.promotion ?? "")} className="b-dot" cx={cx} cy={cy} r={15} />
            );
          })}
        </svg>
      )}

      <div className="b-pieces" key={orientation}>
        {shown.ghosts.map((ghost) => {
          const [x, y] = view(ghost.square, orientation);
          return (
            <div
              key={`ghost-${ghost.id}`}
              className="b-piece b-ghost"
              style={{ "--x": x, "--y": y } as React.CSSProperties}
              onAnimationEnd={() =>
                setShown((s) => ({ ...s, ghosts: s.ghosts.filter((g) => g.id !== ghost.id) }))
              }
            >
              <img src={`/pieces/${ghost.code}.svg`} alt="" draggable={false} />
            </div>
          );
        })}
        {shown.pieces.map((piece) => {
          const [x, y] = view(piece.square, orientation);
          return (
            <div
              key={piece.id}
              className={`b-piece${piece.instant ? " is-placed" : ""}${isMine(piece.square) ? " is-mine" : ""}`}
              data-square={piece.square}
              style={{ "--x": x, "--y": y, "--ms": `${piece.ms}ms` } as React.CSSProperties}
            >
              <img src={`/pieces/${piece.code}.svg`} alt="" draggable={false} />
            </div>
          );
        })}
      </div>

      <svg className="b-layer" viewBox="0 0 800 800" aria-hidden="true">
        {userMarks.map((square) => {
          const [x, y] = view(square, orientation);
          return <circle key={square} className="b-mark" cx={(x + 0.5) * UNIT} cy={(y + 0.5) * UNIT} r={44} />;
        })}
        {allArrows.map((arrow) => (
          <Arrow key={`${arrow.from}${arrow.to}${arrow.kind}`} arrow={arrow} orientation={orientation} />
        ))}
        {[cursor, hintSquare].map((square, i) => {
          if (!square) return null;
          const [x, y] = view(square, orientation);
          return <rect key={i} className="b-cursor" x={x * UNIT + 3} y={y * UNIT + 3} width={UNIT - 6} height={UNIT - 6} />;
        })}
        {badge &&
          (() => {
            const [x, y] = view(badge.square, orientation);
            return (
              <g key={`${badge.square}${badge.glyph}`} className={`b-badge b-badge-${badge.tone}`}>
                <rect x={x * UNIT + 54} y={y * UNIT + 4} width={42} height={30} />
                <text x={x * UNIT + 75} y={y * UNIT + 26}>
                  {badge.glyph}
                </text>
              </g>
            );
          })()}
      </svg>

      {promotion && (
        <div className="b-promo" onPointerDown={(e) => { e.stopPropagation(); setPromotion(null); }}>
          {["q", "n", "r", "b"].map((piece, i) => (
            <button
              key={piece}
              type="button"
              autoFocus={i === 0}
              aria-label={`Promote to ${PIECE_NAMES[piece.toUpperCase()]}`}
              style={{
                left: `${promoX * 12.5}%`,
                top: `${(promoFromTop ? i : 7 - i) * 12.5}%`,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => choosePromotion(piece)}
            >
              <img src={`/pieces/${promoColor}${piece.toUpperCase()}.svg`} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}

      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
