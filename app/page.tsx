"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchGames, NotEnoughGamesError, NotFoundError } from "@/lib/chesscom";
import { DEMO_COACHING, DEMO_PROFILE } from "@/lib/demo";
import { Engine } from "@/lib/engine";
import { analyzeGame, DEFAULT_DEPTH, emptyProfile, mergeProfile } from "@/lib/analysis";
import { buildPatternPayload } from "@/lib/patterns";
import {
  MISTAKE_LABELS,
  bestMoveSan,
  blunderId,
  buildDiagnosis,
} from "@/lib/insights";
import type { MistakeKind, Phase, PracticeStatus, Profile, ProgressState, TimeControl } from "@/lib/types";
import BoardDrill from "./BoardDrill";
import Evidence, { type FilterKey } from "./Evidence";

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

function PreviewPanel() {
  const ranks = [
    ["♜", "", "", "", "♚", "", "", "♜"],
    ["♟", "♟", "", "", "", "♟", "♟", "♟"],
    ["", "", "♞", "", "", "♛", "", ""],
    ["", "", "", "♙", "♘", "", "", ""],
    ["", "", "♗", "", "", "", "", ""],
    ["", "", "", "", "", "♕", "", ""],
    ["♙", "♙", "♙", "", "", "♙", "♙", "♙"],
    ["♖", "", "", "", "♔", "", "", "♖"],
  ];

  return (
    <div className="preview-card card" aria-label="Sample weakness report">
      <p className="card-eyebrow">What you get</p>
      <div className="preview-grid">
        <div className="preview-board" aria-hidden="true">
          {ranks.flatMap((rank, r) =>
            rank.map((piece, f) => (
              <span
                key={`${r}-${f}`}
                className={`preview-square ${(r + f) % 2 ? "dark" : "light"}${
                  r === 3 && f === 4 ? " target" : ""
                }`}
              >
                {piece}
              </span>
            ))
          )}
        </div>
        <div className="preview-stack">
          <div>
            <span className="preview-k">Diagnosis</span>
            <strong>Hanging pieces after normal development</strong>
          </div>
          <div>
            <span className="preview-k">Evidence</span>
            <strong>6 matching positions from 15 games</strong>
          </div>
          <div>
            <span className="preview-k">Drill</span>
            <strong>Name every loose piece before you move</strong>
          </div>
        </div>
      </div>
    </div>
  );
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
    !!profile || progress.status === "analyzing" || progress.status === "coaching";

  function markPractice(status: PracticeStatus) {
    if (!currentId) return;
    setPractice((p) => ({ ...p, [currentId]: status }));
  }


  function focusBlunder(blunderIdToFocus: string) {
    setFilterRaw("all");
    const all = [...(profile?.blunders ?? [])].sort((a, b) => b.swingCp - a.swingCp);
    const idx = all.findIndex((b) => blunderId(b) === blunderIdToFocus);
    setSelIdx(idx === -1 ? 0 : idx);
  }

  return (
    <main className="wrap">
      {/* Landing — search first, board appears after you run */}
      {!started && (
        <div className="landing">
          <div className="landing-copy">
            <h1 className="hero-title">
              Find the leak in <em>your</em> chess.
            </h1>
            <p className="hero-sub">
              Your recurring mistakes from recent Chess.com games — found by a real engine, put back
              on the board to fix. Free, runs on your phone.
            </p>

            <div className="card">
              <label htmlFor="u">Chess.com username</label>
              <input
                id="u"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. hikaru"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={running}
              />
              <div className="field-pair">
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
                  <label htmlFor="gc">Games</label>
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
              <button className="primary" onClick={run} disabled={running || !username.trim()}>
                {progress.status === "fetching" ? "Finding games…" : "Analyze my games"}
              </button>
              <button className="secondary demo" onClick={loadDemo} disabled={running}>
                View demo report
              </button>
            </div>
          </div>

          <PreviewPanel />

          {error && (
            <div className="card">
              <p className="error">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Results header */}
      {hasResults && (
        <div className="results-top">
          <span className="results-for">
            <strong>{username}</strong> · {profile.gamesAnalyzed} games
            {profile.rating ? ` · ~${profile.rating}` : ""}
            {progress.partial && <span className="partial-badge">partial</span>}
          </span>
          <button
            className="link"
            onClick={() => {
              setProfile(null);
              setCoaching(null);
              setError(null);
              setPractice({});
              setFilter("all");
              sessionStorage.removeItem(STORE_KEY);
              setProgress({ status: "idle", current: 0, total: 0, message: "", partial: false });
            }}
          >
            ← New search
          </button>
        </div>
      )}

      {(progress.status === "analyzing" || progress.status === "coaching") && (
        <div className="card">
          <div className="warn">
            Keep this screen on and stay on this tab — analysis runs on your device and can take a
            couple of minutes.
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: progress.status === "coaching" ? "100%" : `${pct}%` }}
            />
          </div>
          <p className="progress-label">
            <span className="spinner" />
            {progress.message}
          </p>
        </div>
      )}

      {/* Board hero (left) + diagnosis / evidence / chart (right) */}
      {started && (
        <div className="drill-layout">
          <div className="area-board">
            <BoardDrill
              blunder={current}
              analyzing={progress.status === "analyzing"}
              cleanDone={!!noBlunders}
              practiceStatus={currentPractice}
              queueStats={queueStats}
              selIdx={selIdx}
              onPractice={markPractice}
              onPrev={() => setSelIdx((i) => Math.max(0, i - 1))}
              onNext={() => setSelIdx((i) => Math.min(filtered.length - 1, i + 1))}
            />
          </div>

          <div className="area-side">
          <div className="area-diag">
            {hasResults && !noBlunders && diagnosis && (
              <div className="card diagnosis fade-in">
                <p className="card-eyebrow">Diagnosis</p>
                <p className="diag-headline">{diagnosis.title}</p>
                <p className="diag-sub">{diagnosis.summary}</p>
                <div className="diag-meta">
                  <span className={`confidence ${diagnosis.confidence.toLowerCase().replace(" ", "-")}`}>
                    {diagnosis.confidence} confidence
                  </span>
                  <span>{diagnosis.confidenceDetail}</span>
                </div>
                <div className="diag-drill">
                  <span>Drill</span>
                  <strong>{diagnosis.drill}</strong>
                </div>
                {diagnosis.examples.length > 0 && (
                  <div className="diag-examples">
                    {diagnosis.examples.map((b) => (
                      <button key={blunderId(b)} onClick={() => focusBlunder(blunderId(b))}>
                        <span>{MISTAKE_LABELS[b.mistakeKind]}</span>
                        <strong>
                          {b.move} → {bestMoveSan(b) ?? "stronger move"}
                        </strong>
                      </button>
                    ))}
                  </div>
                )}
                {patternPayload && patternPayload.top_patterns.length > 0 && (
                  <div className="pattern-box">
                    <span>Recurring patterns</span>
                    {patternPayload.top_patterns.map((p) => (
                      <button
                        key={`${p.description}-${p.count}`}
                        onClick={() => {
                          const url = p.examples[0]?.game_url;
                          if (url) window.open(url, "_blank", "noopener,noreferrer");
                        }}
                      >
                        <strong>{p.description}</strong>
                        <small>
                          {p.count} times, avg loss {p.avg_eval_loss.toFixed(1)} pawns
                        </small>
                      </button>
                    ))}
                  </div>
                )}
                {coaching ? (
                  <p className="coaching">{coaching}</p>
                ) : progress.status === "coaching" ? (
                  <p className="progress-label">
                    <span className="spinner" />
                    Writing your coaching notes…
                  </p>
                ) : coachError ? (
                  <button className="link" onClick={retryCoaching}>
                    Coaching unavailable — retry
                  </button>
                ) : (
                  <button className="link" onClick={retryCoaching}>
                    Get coaching notes
                  </button>
                )}
              </div>
            )}
            {hasResults && noBlunders && (
              <div className="card fade-in">
                <p className="card-eyebrow">Diagnosis</p>
                <p className="diag-headline">Clean games.</p>
                <p className="diag-sub">
                  Nothing major flagged across {profile.gamesAnalyzed} games. Nice.
                </p>
              </div>
            )}
          </div>

          {profile && !noBlunders && (
            <div className="area-evidence">
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
          )}
          </div>
        </div>
      )}

      <p className="footer">Analysis runs in your browser · games from Chess.com · no account needed</p>
    </main>
  );
}
