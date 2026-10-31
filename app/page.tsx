"use client";

import Link from "next/link";
import { useEffect } from "react";
import GameRow from "./GameRow";
import Hero from "./Hero";
import Mark from "./Mark";
import { useReport } from "./ReportProvider";

const SOURCES = [
  { href: "https://stockfishchess.org", label: "Stockfish", note: "GPLv3" },
  { href: "https://lichess.org/page/accuracy", label: "Lichess accuracy", note: "method" },
  { href: "https://github.com/lichess-org/lila", label: "Cburnett pieces", note: "GPLv2+" },
];

export default function Home() {
  const { sample, ensureSample } = useReport();

  useEffect(() => {
    if (!sample) ensureSample();
  }, [sample, ensureSample]);

  return (
    <>
      <Hero />

      <section className="band">
        <div className="page">
          <div className="band-head">
            <h2>Every game is a strip you can read at a glance.</h2>
            <p>
              The line is your chances of winning, move by move. Where it falls in red, you gave the game away. Run
              your finger along any strip to see the move.
            </p>
          </div>
          <ul className="rows rows-preview">
            {sample ? (
              sample.reviews.slice(0, 5).map((game) => <GameRow key={game.id} game={game} />)
            ) : (
              <li className="rows-wait" />
            )}
          </ul>
          <p className="band-foot">
            <Link href="/report?sample=1">Open the full sample report</Link>
          </p>
        </div>
      </section>

      <section className="band chart-paper">
        <div className="page ledger">
          <h2>What leaves your device</h2>
          <dl>
            <div>
              <dt>Stays here</dt>
              <dd>Your full games and every engine search. Stockfish runs in this browser tab.</dd>
            </div>
            <div>
              <dt>Goes to the coach</dt>
              <dd>
                Your mistake counts and a few single moves, so an AI model can write your notes. It never gets a full
                game, your username or a link to your profile.
              </dd>
            </div>
            <div>
              <dt>Comes from your site</dt>
              <dd>Your public games from Chess.com or Lichess. No password and no sign-in.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="band band-play">
        <div className="page play-cta">
          <h2>Then go test it on a bot.</h2>
          <p>Eight levels, clocks, hints and takebacks. When the game ends, review it the same way.</p>
          <Link className="btn" href="/play">
            Play a game
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="page footer-row">
          <span className="wordmark">
            <Mark />
            Coachmate
          </span>
          <nav aria-label="Credits">
            <Link href="/method">Method</Link>
            {SOURCES.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                {s.label}
                <small>{s.note}</small>
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
