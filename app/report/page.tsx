"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo } from "react";
import { buildProfile } from "@/lib/analysis";
import { fallbackRead } from "@/lib/coach";
import { PLATFORM_LABEL } from "@/lib/games";
import { MISTAKE_LABELS, buildDiagnosis } from "@/lib/insights";
import { findPatterns } from "@/lib/patterns";
import type { FetchedGame, LiveTrace, Report } from "@/lib/types";
import GameRow from "../GameRow";
import LinkForm from "../LinkForm";
import { useReport } from "../ReportProvider";
import Strip from "../Strip";

function ReadingRow({ game, live, active }: { game: FetchedGame; live: LiveTrace | null; active: boolean }) {
  const chances =
    live?.gameId === game.id
      ? live.whiteWins.map((w) => (game.playerColor === "w" ? w : 100 - w))
      : [];
  const opponent = game.playerColor === "w" ? game.black : game.white;
  return (
    <li className={`grow is-pending${active ? " is-live" : ""}`}>
      <span className="result">{active ? "Reading" : "Next"}</span>
      <span className="grow-who">
        <strong>{opponent.name}</strong>
        {opponent.rating != null && <small>{opponent.rating}</small>}
      </span>
      <span className="grow-meta">{game.opening ?? ""}</span>
      <div className="grow-strip">
        <Strip chances={chances} total={live?.gameId === game.id ? live.plies : 1} size="mini" ariaLabel={`Reading the game against ${opponent.name}`} />
      </div>
      <span className="grow-acc" />
      <span className="grow-counts" />
    </li>
  );
}

function Finished({ report, onDrill }: { report: Report; onDrill: string }) {
  const { run, stop, isRunning, clear } = useReport();
  const profile = useMemo(() => buildProfile(report.reviews, report.player.rating), [report]);
  const diagnosis = useMemo(() => buildDiagnosis(profile), [profile]);
  const patterns = useMemo(() => findPatterns(profile), [profile]);
  const reading = run.status === "reading";
  const waiting = run.status === "coaching";
  const read = report.coaching ?? fallbackRead(profile);
  const thin = report.reviews.length < 5;
  const pending = reading ? run.games.filter((g) => !report.reviews.some((r) => r.id === g.id)) : [];

  return (
    <div className="page report">
      <header className="report-head">
        <h1>
          {report.player.username}
          <small>
            {report.isSample ? "Sample report, bot games" : PLATFORM_LABEL[report.player.platform]}
            {report.player.rating != null ? `, ${report.player.rating}` : ""}
          </small>
        </h1>
        {reading ? (
          <div className="report-progress" role="status">
            <span>
              Reading game {Math.min(run.done + 1, run.games.length)} of {run.games.length}
            </span>
            <button className="btn" type="button" onClick={stop} disabled={report.reviews.length === 0}>
              Stop and use what&apos;s done
            </button>
          </div>
        ) : (
          !report.isSample &&
          !isRunning && (
            <button className="btn-text" type="button" onClick={clear}>
              Unlink and clear
            </button>
          )
        )}
      </header>

      {!reading && (
        <section className="read" aria-label="The coach's read">
          {waiting ? (
            <p className="read-wait" role="status">
              The coach is reading your games.
            </p>
          ) : (
            read.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)
          )}
          {!waiting && !report.coaching && !report.isSample && (
            <small>Written by rule from your numbers. The AI coach is offline right now.</small>
          )}
          {!waiting && report.isSample && <small>Written by rule from the numbers below, the same way it works when the AI is offline.</small>}
          {!waiting && thin && <small>Only {report.reviews.length} of your games so far, so treat this as a first look.</small>}
        </section>
      )}
      {!reading && !waiting && profile.flagged.length > 0 && (
        <Link className="btn btn-primary read-drill" href={onDrill}>
          Drill {profile.flagged.length} of your own positions
        </Link>
      )}

      <p className="print-line" aria-label="Totals across these games">
        <span>{profile.gamesAnalyzed === 1 ? "1 game" : `${profile.gamesAnalyzed} games`}</span>
        <span>
          {profile.record.win}W {profile.record.loss}L {profile.record.draw}D
        </span>
        <span>Accuracy {profile.accuracy.toFixed(1)}</span>
        <span className="count is-blunder">
          <i>??</i>
          {profile.blunders}
        </span>
        <span className="count is-mistake">
          <i>?</i>
          {profile.mistakes}
        </span>
        <span className="count is-inaccuracy">
          <i>?!</i>
          {profile.inaccuracies}
        </span>
      </p>

      <ol className="rows">
        {report.reviews.map((game) => (
          <GameRow key={game.id} game={game} />
        ))}
        {pending.map((game) => (
          <ReadingRow key={game.id} game={game} live={run.live} active={run.live?.gameId === game.id} />
        ))}
      </ol>

      {!reading && diagnosis && (
        <section className="habit">
          <div>
            <h2>{diagnosis.title}</h2>
            <p>{diagnosis.drill}</p>
            <Link className="btn btn-primary" href={onDrill}>
              Drill {profile.flagged.length} of your own positions
            </Link>
          </div>
          <dl>
            {(Object.keys(MISTAKE_LABELS) as (keyof typeof MISTAKE_LABELS)[])
              .filter((kind) => profile.mistakesByKind[kind] > 0)
              .sort((a, b) => profile.mistakesByKind[b] - profile.mistakesByKind[a])
              .map((kind) => (
                <div key={kind}>
                  <dt>{MISTAKE_LABELS[kind]}</dt>
                  <dd>{profile.mistakesByKind[kind]}</dd>
                </div>
              ))}
            {patterns.slice(0, 1).map((p) => (
              <div key={p.description} className="habit-pattern">
                <dt>{p.description.charAt(0).toUpperCase() + p.description.slice(1)}</dt>
                <dd>{p.count}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

function ReportScreen() {
  const params = useSearchParams();
  const wantsSample = params.get("sample") != null;
  const { hydrated, report, sample, run, ensureSample, isRunning } = useReport();

  useEffect(() => {
    if (wantsSample && !sample) ensureSample();
  }, [wantsSample, sample, ensureSample]);

  if (wantsSample) {
    return sample ? <Finished report={sample} onDrill="/drill?sample=1" /> : <div className="page wait" />;
  }
  if (!hydrated) return <div className="page wait" />;

  if (run.status === "fetching") {
    return (
      <div className="page empty" role="status">
        <h1>Pulling your games.</h1>
        <p>Public games only. This takes a few seconds.</p>
      </div>
    );
  }
  if (report && (report.reviews.length > 0 || isRunning)) {
    return <Finished report={report} onDrill="/drill" />;
  }
  if (run.status === "reading") {
    return (
      <div className="page empty" role="status">
        <h1>Starting the engine.</h1>
      </div>
    );
  }

  return (
    <div className="page empty">
      <h1>{run.status === "error" ? "That didn't work." : "Link your profile."}</h1>
      {run.status === "error" ? (
        <p role="alert">{run.error}</p>
      ) : (
        <p>Stockfish reads your last 15 games in this tab. It takes a few minutes, and you can leave it running.</p>
      )}
      <LinkForm />
      <p>
        <Link href="/report?sample=1">See a sample report</Link>
      </p>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="page wait" />}>
      <ReportScreen />
    </Suspense>
  );
}
