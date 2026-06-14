"use client";

import { MISTAKE_LABELS, PHASE_LABELS, blunderId } from "@/lib/insights";
import type { BlunderExample, MistakeKind, Phase, PracticeStatus } from "@/lib/types";

export type FilterKey = "all" | Phase | MistakeKind;

export default function Evidence({
  blunders,
  filtered,
  selIdx,
  setSelIdx,
  filter,
  setFilter,
  practice,
}: {
  blunders: BlunderExample[];
  filtered: BlunderExample[];
  selIdx: number;
  setSelIdx: (i: number) => void;
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  practice: Record<string, PracticeStatus>;
}) {
  const counts: Record<FilterKey, number> = {
    all: blunders.length,
    opening: blunders.filter((b) => b.phase === "opening").length,
    middlegame: blunders.filter((b) => b.phase === "middlegame").length,
    endgame: blunders.filter((b) => b.phase === "endgame").length,
    hanging_piece: blunders.filter((b) => b.mistakeTags?.includes("hanging_piece")).length,
    bad_trade: blunders.filter((b) => b.mistakeTags?.includes("bad_trade")).length,
    time_pressure: blunders.filter((b) => b.mistakeTags?.includes("time_pressure")).length,
    missed_capture: blunders.filter((b) => b.mistakeTags?.includes("missed_capture")).length,
    king_safety: blunders.filter((b) => b.mistakeTags?.includes("king_safety")).length,
    endgame_conversion: blunders.filter((b) => b.mistakeTags?.includes("endgame_conversion")).length,
    tactical_blind_spot: blunders.filter((b) => b.mistakeTags?.includes("tactical_blind_spot")).length,
  };

  const chips: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "hanging_piece", label: "Hanging" },
    { key: "bad_trade", label: "Trades" },
    { key: "time_pressure", label: "Low clock" },
    { key: "missed_capture", label: "Missed captures" },
    { key: "king_safety", label: "King safety" },
    { key: "opening", label: "Opening" },
    { key: "middlegame", label: "Middlegame" },
    { key: "endgame", label: "Endgame" },
  ];

  return (
    <div className="card evidence-card">
      <p className="card-eyebrow">Evidence</p>
      <h2 className="section-title">Your blunders</h2>

      <div className="filter-chips">
        {chips.map((c) => (
          <button
            key={c.key}
            className={`chip${filter === c.key ? " active" : ""}`}
            onClick={() => setFilter(c.key)}
            disabled={counts[c.key] === 0 && c.key !== "all"}
          >
            {c.label} <span className="chip-n">{counts[c.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length > 0 && (
        <div className="review-nav">
          <button className="navbtn" onClick={() => setSelIdx(Math.max(0, selIdx - 1))} disabled={selIdx === 0}>
            ◀
          </button>
          <span className="navlabel">
            {selIdx + 1} of {filtered.length}
          </span>
          <button
            className="navbtn"
            onClick={() => setSelIdx(Math.min(filtered.length - 1, selIdx + 1))}
            disabled={selIdx >= filtered.length - 1}
          >
            ▶
          </button>
        </div>
      )}

      <div className="blunder-list">
        {filtered.length === 0 && <p className="muted-note">No blunders in this filter.</p>}
        {filtered.map((b, i) => {
          const status = practice[blunderId(b)];
          return (
            <button
              key={`${blunderId(b)}-${i}`}
              className={`blunder-row${i === selIdx ? " active" : ""}${status ? ` ${status}` : ""}`}
              onClick={() => setSelIdx(i)}
            >
              <span className="br-move">{b.move}</span>
              <span className="br-meta">
                {MISTAKE_LABELS[b.mistakeKind]} · {PHASE_LABELS[b.phase]} · g{b.gameIndex + 1}
              </span>
              <span className="br-status">
                {status === "solved" ? "Fixed" : status === "missed" ? "Missed" : status === "later" ? "Later" : ""}
              </span>
              <span className={`br-sev${b.isHang ? " hang" : ""}`}>
                −{(b.swingCp / 100).toFixed(1)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
