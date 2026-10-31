"use client";

import { useEffect, useRef } from "react";
import { JUDGEMENT_GLYPH } from "@/lib/judge";
import type { Judgement } from "@/lib/types";

export interface SheetMove {
  san: string;
  judgement?: Judgement | null;
}

interface ScoresheetProps {
  moves: SheetMove[];
  /** How many moves in the board is showing, 0 for the start. */
  current: number;
  onSelect?: (index: number) => void;
  /** Starts at Black's move when the game does not begin with White. */
  label: string;
}

export default function Scoresheet({ moves, current, onSelect, label }: ScoresheetProps) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = box.current;
    const active = scroller?.querySelector<HTMLElement>("[aria-current='true']");
    if (!scroller || !active) return;
    const top = active.offsetTop;
    if (top < scroller.scrollTop + 32 || top > scroller.scrollTop + scroller.clientHeight - 64) {
      scroller.scrollTop = top - scroller.clientHeight / 2;
    }
  }, [current]);

  const rows: SheetMove[][] = [];
  for (let i = 0; i < moves.length; i += 2) rows.push(moves.slice(i, i + 2));

  const cell = (move: SheetMove | undefined, index: number) => {
    if (!move) return <span />;
    const content = (
      <>
        {move.san}
        {move.judgement && <i className={`is-${move.judgement}`}>{JUDGEMENT_GLYPH[move.judgement]}</i>}
      </>
    );
    return onSelect ? (
      <button type="button" aria-current={index === current ? "true" : undefined} onClick={() => onSelect(index)}>
        {content}
      </button>
    ) : (
      <span className="sheet-move" aria-current={index === current ? "true" : undefined}>
        {content}
      </span>
    );
  };

  return (
    <div className="sheet" ref={box} role="group" aria-label={label}>
      {rows.map((row, i) => (
        <div className="sheet-row" key={i}>
          <span className="sheet-no">{i + 1}</span>
          {cell(row[0], i * 2 + 1)}
          {cell(row[1], i * 2 + 2)}
        </div>
      ))}
    </div>
  );
}
