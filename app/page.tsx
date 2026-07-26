"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGames, NotEnoughGamesError, NotFoundError } from "@/lib/chesscom";
import { DEMO_COACHING, DEMO_PROFILE } from "@/lib/demo";
import { Engine } from "@/lib/engine";
import { analyzeGame, DEFAULT_DEPTH, emptyProfile, mergeProfile } from "@/lib/analysis";
import { buildPatternPayload } from "@/lib/patterns";
import { MISTAKE_LABELS, blunderId, buildDiagnosis } from "@/lib/insights";
import type { MistakeKind, Phase, PracticeStatus, Profile, ProgressState, TimeControl } from "@/lib/types";
import BoardDrill from "./BoardDrill";
import Evidence, { type FilterKey } from "./Evidence";
import {
  AnalysisProgress,
  DiagnosisRail,
  DrillCoachPanel,
  HeroArtwork,
  PrivacyPill,
  ReportStepper,
  ReportSummary,
  type ReportView,
} from "./CoachViews";

const STORE_KEY = "cwc:profile";
const COMPLETE_KEY = "cwc:complete";

async function getCoaching(profile: Profile): Promise<string> {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("coach-failed");
  const data = await res.json();
  return data.coaching as string;
}

function normalizeProfile(profile: Profile): Profile {
  const kinds = Object.keys(MISTAKE_LABELS) as MistakeKind[];
  const mistakesByKind = kinds.reduce((acc, kind) => {
    acc[kind] = 0;
    return acc;
  }, {} as Record<MistakeKind, number>);
  const blunders = profile.blunders.map((b) => {
    const fallbackKind: MistakeKind = b.mistakeKind ?? (b.isHang ? "hanging_piece" : "tactical_blind_spot");
    const mistakeTags = b.mistakeTags?.length ? b.mistakeTags : [fallbackKind];
    mistakesByKind[fallbackKind]++;
    return {
      ...b,
      mistakeKind: fallbackKind,
      mistakeTags,
      clockAfterSec: b.clockAfterSec ?? null,
      timeSpentSec: b.timeSpentSec ?? null,
      timeClass: b.timeClass ?? "unknown",
      context: b.context ?? {
        category: fallbackKind,
        move_number: b.moveNumber,
        game_phase: b.phase,
        material_balance: "equal",
        eval_before: b.bestCp,
        eval_after: b.bestCp - b.swingCp,
        moves_since_castle: null,
        castle_side: null,
        game_url: null,
      },
    };
  });

  return {
    ...profile,
    blunders,
    mistakesByKind: profile.mistakesByKind ?? mistakesByKind,
    worstHangs: profile.worstHangs.map((b) => ({
      ...b,
      mistakeKind: b.mistakeKind ?? (b.isHang ? "hanging_piece" : "tactical_blind_spot"),
      mistakeTags: b.mistakeTags?.length ? b.mistakeTags : [b.isHang ? "hanging_piece" : "tactical_blind_spot"],
      clockAfterSec: b.clockAfterSec ?? null,
      timeSpentSec: b.timeSpentSec ?? null,
      timeClass: b.timeClass ?? "unknown",
      context: b.context ?? {
        category: b.mistakeKind ?? (b.isHang ? "hanging_piece" : "tactical_blind_spot"),
        move_number: b.moveNumber,
        game_phase: b.phase,
        material_balance: "equal",
        eval_before: b.bestCp,
        eval_after: b.bestCp - b.swingCp,
        moves_since_castle: null,
        castle_side: null,
        game_url: null,
      },
    })),
  };
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [timeControl, setTimeControl] = useState<TimeControl>("rapid");
  const [gameCount, setGameCount] = useState(15);
  const [filter, setFilterRaw] = useState<FilterKey>("all");
  const [selIdx, setSelIdx] = useState(0);
  const [practice, setPractice] = useState<Record<string, PracticeStatus>>({});
  const [progress, setProgress] = useState<ProgressState>({
    status: "idle",
    current: 0,
    total: 0,
    message: "",
    partial: false,
  });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [coaching, setCoaching] = useState<string | null>(null);
  const [coachError, setCoachError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportView, setReportView] = useState<ReportView>("summary");

  // Recover a partial profile left by an interrupted run (tab was killed).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE_KEY);
      const complete = sessionStorage.getItem(COMPLETE_KEY) === "true";
      if (saved && !complete) {
        const p = normalizeProfile(JSON.parse(saved) as Profile);
        if (p.gamesAnalyzed > 0) {
          setProfile(p);
          setProgress({
            status: "done",
            current: p.gamesAnalyzed,
            total: p.gamesAnalyzed,
            message: "",
            partial: true,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const running = progress.status === "fetching" || progress.status === "analyzing";

  async function run() {
    setError(null);
    setCoaching(null);
    setCoachError(false);
    setProfile(null);
    setReportView("summary");
    setPractice({});
    sessionStorage.removeItem(STORE_KEY);
    sessionStorage.setItem(COMPLETE_KEY, "false");

    setProgress({ status: "fetching", current: 0, total: 0, message: "Finding games…", partial: false });

    let games;
    let rating: number | null = null;
    try {
      const result = await fetchGames(username, timeControl, gameCount, (n) =>
        setProgress((s) => ({ ...s, message: `Found ${n} of up to ${gameCount} games…` }))
      );
      games = result.games;
      rating = result.rating;
    } catch (e) {
      if (e instanceof NotFoundError) {
        setError("No player found — check the spelling.");
      } else if (e instanceof NotEnoughGamesError) {
        setError(
          `Only ${e.found} ${timeControl === "all" ? "" : timeControl + " "}games found. Play a few more (need at least 5) and come back.`
        );
      } else {
        setError("Couldn't reach Chess.com. Check your connection and try again.");
      }
      setProgress((s) => ({ ...s, status: "error" }));
      return;
    }

    let acc = emptyProfile(rating);
    const engine = new Engine();
    try {
      await engine.init();
      for (let i = 0; i < games.length; i++) {
        setProgress({
          status: "analyzing",
          current: i + 1,
          total: games.length,
          message: `Analyzing game ${i + 1} of ${games.length}…`,
          partial: false,
        });
        // Yield to the browser so the progress bar paints before heavy work.
        await new Promise((r) => setTimeout(r, 0));
        const gameResult = await analyzeGame(games[i], i, engine, DEFAULT_DEPTH);
        acc = mergeProfile(acc, gameResult);
        setProfile({ ...acc });
        sessionStorage.setItem(STORE_KEY, JSON.stringify(acc));
      }
    } catch {
      // Partial results survive: show what we have rather than nothing.
      if (acc.gamesAnalyzed > 0) {
        setProgress({
          status: "done",
          current: acc.gamesAnalyzed,
          total: games.length,
          message: "",
          partial: true,
        });
        setProfile({ ...acc });
      } else {
        setError("Analysis failed before finishing a game. Try again.");
        setProgress((s) => ({ ...s, status: "error" }));
      }
      engine.terminate();
      return;
    }
    engine.terminate();
    sessionStorage.setItem(COMPLETE_KEY, "true");

    // Coaching (chart already renders; coaching is best-effort).
    setProgress({
      status: "coaching",
      current: games.length,
      total: games.length,
      message: "Writing your coaching report…",
      partial: false,
    });
    try {
      const text = await getCoaching(acc);
      setCoaching(text);
    } catch {
      setCoachError(true);
    }
    setProgress({
      status: "done",
      current: games.length,
      total: games.length,
      message: "",
      partial: false,
    });
  }

  async function retryCoaching() {
    if (!profile) return;
    setCoachError(false);
    setProgress((s) => ({ ...s, status: "coaching", message: "Writing your coaching report…" }));
    try {
      const text = await getCoaching(profile);
      setCoaching(text);
    } catch {
      setCoachError(true);
    }
    setProgress((s) => ({ ...s, status: "done", message: "" }));
  }

  function loadDemo() {
    setUsername("demo_player");
    setError(null);
    setCoachError(false);
    setPractice({});
    setFilterRaw("all");
    setSelIdx(0);
    setReportView("summary");
    setProfile(DEMO_PROFILE);
    setCoaching(DEMO_COACHING);
    setProgress({
      status: "done",
      current: DEMO_PROFILE.gamesAnalyzed,
      total: DEMO_PROFILE.gamesAnalyzed,
      message: "",
      partial: false,
    });
    sessionStorage.setItem(STORE_KEY, JSON.stringify(DEMO_PROFILE));
    sessionStorage.setItem(COMPLETE_KEY, "true");
  }

  // Useful for sharing and QA: /?demo=1 opens the same report as the demo button.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      loadDemo();
      const requestedView = params.get("view");
      if (requestedView === "evidence" || requestedView === "drill") setReportView(requestedView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const hasResults = !!profile && progress.status === "done";
  const noBlunders =
    !!profile && hasResults && profile.totalBlunders === 0 && profile.hangingPieces === 0;

  const setFilter = (f: FilterKey) => {
    setFilterRaw(f);
    setSelIdx(0);
  };

  const phaseFilters: Phase[] = ["opening", "middlegame", "endgame"];
  const isPhaseFilter = (f: FilterKey): f is Phase => phaseFilters.includes(f as Phase);

  const filtered = useMemo(() => {
    const bl = profile?.blunders ?? [];
    const list =
      filter === "all"
        ? bl
        : isPhaseFilter(filter)
        ? bl.filter((b) => b.phase === filter)
        : bl.filter((b) => b.mistakeKind === filter || b.mistakeTags?.includes(filter));
    return [...list].sort((a, b) => b.swingCp - a.swingCp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, filter]);

  useEffect(() => {
    if (selIdx >= filtered.length) setSelIdx(0);
  }, [filtered.length, selIdx]);

  const current = filtered[selIdx];
  const diagnosis = profile && !noBlunders ? buildDiagnosis(profile) : null;
  const patternPayload = useMemo(
    () => (profile && !noBlunders ? buildPatternPayload(profile) : null),
    [noBlunders, profile]
  );
  const currentId = current ? blunderId(current) : null;
  const currentPractice = currentId ? practice[currentId] : undefined;
  const queueStats = useMemo(() => {
    const ids = filtered.map(blunderId);
    const fixed = ids.filter((id) => practice[id] === "solved").length;
    const missed = ids.filter((id) => practice[id] === "missed").length;
    const later = ids.filter((id) => practice[id] === "later").length;
    return {
      total: ids.length,
      fixed,
      missed,
      later,
      done: fixed + missed + later,
    };
  }, [filtered, practice]);
  const started =
    !!profile ||
    progress.status === "fetching" ||
    progress.status === "analyzing" ||
    progress.status === "coaching";

  function markPractice(status: PracticeStatus) {
    if (!currentId) return;
    setPractice((p) => ({ ...p, [currentId]: status }));
  }


  function focusBlunder(blunderIdToFocus: string) {
    setFilterRaw("all");
    const all = [...(profile?.blunders ?? [])].sort((a, b) => b.swingCp - a.swingCp);
    const idx = all.findIndex((b) => blunderId(b) === blunderIdToFocus);
    setSelIdx(idx === -1 ? 0 : idx);
    setReportView("evidence");
  }

  return (
    <main className={`wrap${!started ? " landing-wrap" : " report-wrap"}`}>
      {!started && (
        <div className="landing-page fade-in">
          <section className="landing-hero">
            <div className="landing-copy">
              <PrivacyPill />
              <h1 className="hero-title">
                Understand your chess.
                <br />
                Improve faster.
              </h1>
              <p className="hero-sub">
                We analyze your recent Chess.com games with Stockfish right in your browser—no
                uploads, no cloud. Clear insights. Personalized coaching.
              </p>

              <div className="hero-form">
                <div>
                  <label htmlFor="u">Chess.com username</label>
                  <input
                    id="u"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. Hikaru"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={running}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && username.trim()) run();
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="tc">Time control</label>
                  <select
                    id="tc"
                    value={timeControl}
                    onChange={(e) => setTimeControl(e.target.value as TimeControl)}
                    disabled={running}
                  >
                    <option value="rapid">Rapid</option>
                    <option value="blitz">Blitz</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="gc">Recent games</label>
                  <select
                    id="gc"
                    value={gameCount}
                    onChange={(e) => setGameCount(Number(e.target.value))}
                    disabled={running}
                  >
                    <option value={5}>5 — fastest</option>
                    <option value={10}>10</option>
                    <option value={15}>15 — recommended</option>
                    <option value={20}>20</option>
                    <option value={30}>30 — slowest</option>
                  </select>
                </div>
              </div>
              <div className="hero-actions">
                <button className="primary inline" onClick={run} disabled={running || !username.trim()}>
                  ✦ Analyze my games
                </button>
                <button className="secondary" onClick={loadDemo} disabled={running}>
                  ▤ View demo report
                </button>
              </div>
              <p className="hero-privacy">▣ Private &amp; local: your games stay on your device.</p>
            </div>

            <HeroArtwork />
          </section>

          {error && (
            <div className="card landing-error">
              <p className="error">{error}</p>
            </div>
          )}

          <section className="how-it-works">
            <h2>Three simple steps to better chess</h2>
            <div>
              <article>
                <span>⌕</span>
                <small>1</small>
                <h3>Diagnose</h3>
                <p>We analyze your games with Stockfish and surface recurring mistakes.</p>
              </article>
              <b aria-hidden="true">›</b>
              <article>
                <span>▤</span>
                <small>2</small>
                <h3>Review evidence</h3>
                <p>Explore annotated moments so you understand what went wrong and why.</p>
              </article>
              <b aria-hidden="true">›</b>
              <article>
                <span>◎</span>
                <small>3</small>
                <h3>Drill positions</h3>
                <p>Practice the positions that matter most and turn insight into improvement.</p>
              </article>
            </div>
          </section>

          <section className="privacy-band">
            <div>
              <span aria-hidden="true">▣</span>
              <div>
                <h2>Your data stays private</h2>
                <p>All analysis runs locally in your browser using Stockfish.</p>
              </div>
            </div>
            <div className="privacy-points">
              <span>
                <b>♙</b>
                <strong>100% local</strong>
                <small>Runs in your browser</small>
              </span>
              <span>
                <b>◉</b>
                <strong>No uploads</strong>
                <small>Games never leave</small>
              </span>
              <span>
                <b>♙</b>
                <strong>No accounts</strong>
                <small>No sign-up required</small>
              </span>
              <span>
                <b>✓</b>
                <strong>Open &amp; transparent</strong>
                <small>Built on open technology</small>
              </span>
            </div>
          </section>

          <section className="report-features">
            <h2>What’s inside your report</h2>
            <div>
              {[
                ["◎", "Main weakness", "Your biggest patterns, ranked by impact."],
                ["▥", "Annotated games", "Key moments with engine explanations."],
                ["✓", "Recurring patterns", "Themes and tactical motifs you miss."],
                ["✦", "Training positions", "Curated drills from your own games."],
                ["↗", "Progress over time", "Track improvement across reports."],
              ].map(([icon, title, copy]) => (
                <article key={title}>
                  <span>{icon}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {hasResults && (
        <div className="results-top report-context">
          <span className="results-for">
            <strong>{username}</strong> · {profile.gamesAnalyzed} games
            {profile.rating ? ` · ~${profile.rating}` : ""}
            {progress.partial && <span className="partial-badge">partial</span>}
            {coachError && (
              <button className="link coaching-retry" onClick={retryCoaching}>
                Coach notes unavailable · retry
              </button>
            )}
          </span>
          <button
            className="link"
            onClick={() => {
              setProfile(null);
              setCoaching(null);
              setError(null);
              setPractice({});
              setFilter("all");
              setReportView("summary");
              sessionStorage.removeItem(STORE_KEY);
              setProgress({ status: "idle", current: 0, total: 0, message: "", partial: false });
            }}
          >
            ← New search
          </button>
        </div>
      )}

      {(progress.status === "fetching" ||
        progress.status === "analyzing" ||
        progress.status === "coaching") && (
        <AnalysisProgress
          progress={progress}
          percent={pct}
          gamesAnalyzed={profile?.gamesAnalyzed ?? 0}
        />
      )}

      {hasResults && !noBlunders && diagnosis && (
        <>
          <ReportStepper view={reportView} onChange={setReportView} />

          {reportView === "summary" && (
            <ReportSummary
              profile={profile}
              diagnosis={diagnosis}
              patternPayload={patternPayload}
              coaching={coaching}
              onEvidence={() => setReportView("evidence")}
              onDrill={() => setReportView("drill")}
              onPosition={focusBlunder}
            />
          )}

          {reportView === "evidence" && (
            <section className="evidence-screen fade-in">
              <DiagnosisRail diagnosis={diagnosis} onSummary={() => setReportView("summary")} />
              <div className="evidence-queue">
                <Evidence
                  blunders={profile.blunders}
                  filtered={filtered}
                  selIdx={selIdx}
                  setSelIdx={setSelIdx}
                  filter={filter}
                  setFilter={setFilter}
                  practice={practice}
                />
              </div>
              <div className="evidence-board">
                <BoardDrill
                  blunder={current}
                  analyzing={false}
                  cleanDone={false}
                  practiceStatus={currentPractice}
                  queueStats={queueStats}
                  selIdx={selIdx}
                  onPractice={markPractice}
                  onPrev={() => setSelIdx((i) => Math.max(0, i - 1))}
                  onNext={() => setSelIdx((i) => Math.min(filtered.length - 1, i + 1))}
                />
              </div>
            </section>
          )}

          {reportView === "drill" && (
            <section className="drill-screen fade-in">
              <div className="drill-board-column">
                <div className="drill-theme-bar">
                  <div>
                    <small>Theme</small>
                    <strong>{diagnosis.title.replace("Your biggest leak: ", "")}</strong>
                  </div>
                  <div>
                    <small>Position</small>
                    <strong>
                      {selIdx + 1} of {queueStats.total}
                    </strong>
                  </div>
                  <div>
                    <small>Your turn</small>
                    <strong>Find the best move.</strong>
                  </div>
                </div>
                <BoardDrill
                  blunder={current}
                  analyzing={false}
                  cleanDone={false}
                  practiceStatus={currentPractice}
                  queueStats={queueStats}
                  selIdx={selIdx}
                  onPractice={markPractice}
                  onPrev={() => setSelIdx((i) => Math.max(0, i - 1))}
                  onNext={() => setSelIdx((i) => Math.min(filtered.length - 1, i + 1))}
                />
              </div>
              <DrillCoachPanel
                diagnosis={diagnosis}
                current={current}
                onEvidence={() => setReportView("evidence")}
              />
            </section>
          )}
        </>
      )}

      {hasResults && noBlunders && (
        <section className="clean-report card fade-in">
          <p className="card-eyebrow">Diagnosis</p>
          <h1>Clean games.</h1>
          <p>Nothing major was flagged across {profile.gamesAnalyzed} games. Nice work.</p>
          <button className="secondary" onClick={() => setProfile(null)}>
            Analyze another player
          </button>
        </section>
      )}

      {!started && (
        <p className="footer landing-footer">
          Private by design · powered by Stockfish · no account needed
        </p>
      )}
      {hasResults && (
        <p className="footer">
          ▣ Private &amp; local: your games are analyzed on your device. Nothing is uploaded.
        </p>
      )}
    </main>
  );
}
