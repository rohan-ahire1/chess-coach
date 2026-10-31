"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { JUDGEMENT_GLYPH } from "@/lib/judge";
import { formatDate, opponentOf, timeControlLabel } from "@/lib/format";
import type { GameReview, Judgement, Outcome } from "@/lib/types";
import Strip, { stripOf } from "./Strip";

const RESULT: Record<Outcome, string> = { win: "Won", loss: "Lost", draw: "Drew" };
const COUNTED: Judgement[] = ["blunder", "mistake", "inaccuracy"];

export function resultWords(game: Pick<GameReview, "outcome" | "ending">): string {
  return game.ending ? `${RESULT[game.outcome]} by ${game.ending}` : RESULT[game.outcome];
}

export function GameLine({ game }: { game: GameReview }) {
  const opponent = opponentOf(game);
  return (
    <>
      <span className={`result is-${game.outcome}`}>{RESULT[game.outcome]}</span>
      <span className="grow-who">
        <strong>{opponent.name}</strong>
        {opponent.rating != null && <small>{opponent.rating}</small>}
      </span>
    </>
  );
}

export default function GameRow({ game }: { game: GameReview }) {
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);
  const touched = useRef(0);
  const strip = stripOf(game);
  const href = `/review/${game.id}`;
  const counts = game.counts[game.playerColor];
  const opponent = opponentOf(game);

  return (
    <li className="grow">
      <Link className="grow-link" href={href}>
        <span className="sr-only">Open the game against {opponent.name}</span>
      </Link>
      <GameLine game={game} />
      <span className="grow-meta">
        {hover != null ? strip.describe(hover) : game.opening ?? "Opening not named"}
        <small>
          {game.playerColor === "w" ? "White" : "Black"}, {timeControlLabel(game.timeControl, game.timeClass)}
          {game.endTime ? `, ${formatDate(game.endTime).toLowerCase()}` : ""}
        </small>
      </span>
      <div
        className="grow-strip"
        onClick={() => router.push(`${href}?ply=${touched.current}`)}
        title="Open the game at this move"
      >
        <Strip
          {...strip}
          size="mini"
          index={hover}
          onScrub={(ply) => {
            touched.current = ply;
            setHover(ply);
          }}
          onLeave={() => setHover(null)}
          scrubOnHover
          ariaLabel={`Your chances through the game against ${opponent.name}`}
        />
      </div>
      <span className="grow-acc">
        {game.accuracy[game.playerColor].toFixed(1)}
        <small>accuracy</small>
      </span>
      <span className="grow-counts">
        {COUNTED.map((j) => (
          <span key={j} className={`count is-${j}`}>
            <i>{JUDGEMENT_GLYPH[j]}</i>
            {counts[j]}
          </span>
        ))}
      </span>
    </li>
  );
}
