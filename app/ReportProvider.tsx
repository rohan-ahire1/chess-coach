"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ANALYSIS_DEPTH, buildProfile, reviewGame } from "@/lib/analysis";
import { requestCoaching, requestGameNotes } from "@/lib/coach";
import { Engine } from "@/lib/engine";
import { NoGamesError, NotFoundError, PLATFORM_LABEL, RateLimitError, fetchGames } from "@/lib/games";
import {
  clearStored,
  loadBotGames,
  loadLink,
  loadPractice,
  loadReport,
  saveBotGames,
  saveLink,
  savePractice,
  saveReport,
} from "@/lib/store";
import type {
  FetchedGame,
  GameFilter,
  GameReview,
  LinkedPlayer,
  Platform,
  PracticeStatus,
  Report,
  RunState,
} from "@/lib/types";

const IDLE: RunState = { status: "idle", games: [], done: 0, live: null, error: null };
const LIVE_UPDATE_MS = 90;
const BOT_GAMES_KEPT = 5;

interface Session {
  stopped: boolean;
  engine: Engine | null;
}

export interface LinkAttempt {
  platform: Platform;
  username: string;
  filter: GameFilter;
  count: number;
}

interface ReportValue {
  hydrated: boolean;
  report: Report | null;
  sample: Report | null;
  link: LinkedPlayer | null;
  /** The last request, so a failed one comes back to the form as it was typed. */
  attempt: LinkAttempt | null;
  run: RunState;
  practice: Record<string, PracticeStatus>;
  isRunning: boolean;
  start: (platform: Platform, username: string, filter: GameFilter, count: number) => void;
  stop: () => void;
  clear: () => void;
  ensureSample: () => void;
  reviewBotGame: (game: FetchedGame, onProgress: (share: number) => void) => Promise<string | null>;
  loadNotes: (gameId: string) => void;
  mark: (id: string, status: PracticeStatus) => void;
  findGame: (id: string) => { game: GameReview; source: Report | null } | null;
}

const ReportContext = createContext<ReportValue | null>(null);

function fetchErrorText(err: unknown, platform: Platform, username: string): string {
  const site = PLATFORM_LABEL[platform];
  if (err instanceof NotFoundError) return `${site} has no player called ${username.trim() || "that"}. Check the spelling.`;
  if (err instanceof NoGamesError) return `${username.trim()} has no recent games in that time control. Try another one.`;
  if (err instanceof RateLimitError) return `${site} is limiting requests right now. Try again in a minute.`;
  return `Couldn't reach ${site}. Check your connection and try again.`;
}

export function useReport(): ReportValue {
  const value = useContext(ReportContext);
  if (!value) throw new Error("useReport needs a ReportProvider");
  return value;
}

export default function ReportProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [sample, setSample] = useState<Report | null>(null);
  const [botGames, setBotGames] = useState<GameReview[]>([]);
  const [link, setLink] = useState<LinkedPlayer | null>(null);
  const [attempt, setAttempt] = useState<LinkAttempt | null>(null);
  const [run, setRun] = useState<RunState>(IDLE);
  const [practice, setPractice] = useState<Record<string, PracticeStatus>>({});
  const session = useRef<Session | null>(null);
  const reportRef = useRef<Report | null>(null);
  const notesAsked = useRef(new Set<string>());
  reportRef.current = report;

  useEffect(() => {
    setReport(loadReport());
    setLink(loadLink());
    setPractice(loadPractice());
    setBotGames(loadBotGames());
    setHydrated(true);
  }, []);

  const isRunning = run.status === "fetching" || run.status === "reading" || run.status === "coaching";

  useEffect(() => {
    if (run.status !== "reading") return;
    const original = document.title;
    document.title = `Reading ${Math.min(run.done + 1, run.games.length)} of ${run.games.length} | Coachmate`;
    return () => {
      document.title = original;
    };
  }, [run.status, run.done, run.games.length]);

  const start = useCallback(async (platform: Platform, username: string, filter: GameFilter, count: number) => {
    if (session.current) {
      session.current.stopped = true;
      session.current.engine?.terminate();
    }
    const current: Session = { stopped: false, engine: null };
    session.current = current;
    setAttempt({ platform, username, filter, count });
    setRun({ ...IDLE, status: "fetching" });

    let fetched;
    try {
      fetched = await fetchGames(platform, username, filter, count, () => undefined);
    } catch (err) {
      if (session.current === current) {
        setRun({ ...IDLE, status: "error", error: fetchErrorText(err, platform, username) });
      }
      return;
    }
    if (current.stopped) return;

    const player: LinkedPlayer = { platform, username: fetched.username, rating: fetched.rating };
    saveLink(player);
    setLink(player);

    const previous = reportRef.current;
    const samePlayer =
      previous?.player.platform === platform &&
      previous.player.username.toLowerCase() === fetched.username.toLowerCase();
    const known = new Map(samePlayer ? previous.reviews.map((r) => [r.id, r] as const) : []);
    let working: Report = {
      player,
      filter,
      reviews: [],
      coaching: null,
      notes: samePlayer ? previous.notes : {},
      isSample: false,
      complete: false,
      createdAt: Date.now(),
    };
    setReport(working);
    setRun({ ...IDLE, status: "reading", games: fetched.games });

    try {
      const engine = new Engine();
      current.engine = engine;
      await engine.init();

      for (let i = 0; i < fetched.games.length && !current.stopped; i++) {
        const game = fetched.games[i];
        const cached = known.get(game.id);
        let lastUpdate = 0;
        const review =
          cached && cached.depth === ANALYSIS_DEPTH
            ? cached
            : await reviewGame(game, engine, {
                isCancelled: () => current.stopped,
                onEval: (whiteWins, plies) => {
                  const now = performance.now();
                  if (now - lastUpdate < LIVE_UPDATE_MS) return;
                  lastUpdate = now;
                  setRun((r) => ({ ...r, live: { gameId: game.id, whiteWins: [...whiteWins], plies } }));
                },
              });
        if (review) {
          working = { ...working, reviews: [...working.reviews, review] };
          setReport(working);
          saveReport(working);
        }
        if (!current.stopped) setRun((r) => ({ ...r, done: i + 1, live: null }));
      }
    } catch {
      if (session.current === current && working.reviews.length === 0) {
        setRun({ ...IDLE, status: "error", error: "The engine couldn't start in this browser." });
        return;
      }
    }

    current.engine?.terminate();
    if (session.current !== current) return;
    if (working.reviews.length === 0) {
      setReport(previous);
      setRun(IDLE);
      return;
    }

    setRun((r) => ({ ...r, status: "coaching", live: null }));
    const coaching = await requestCoaching(buildProfile(working.reviews, player.rating));
    if (session.current !== current) return;
    working = { ...working, coaching, complete: true };
    setReport(working);
    saveReport(working);
    setRun(IDLE);
    session.current = null;
  }, []);

  const stop = useCallback(() => {
    const current = session.current;
    if (!current) return;
    current.stopped = true;
    current.engine?.terminate();
  }, []);

  const clear = useCallback(() => {
    if (session.current) {
      session.current.stopped = true;
      session.current.engine?.terminate();
      session.current = null;
    }
    clearStored();
    setReport(null);
    setLink(null);
    setAttempt(null);
    setPractice({});
    setRun(IDLE);
  }, []);

  const ensureSample = useCallback(() => {
    void import("@/lib/sample.json").then((mod) => setSample(mod.default as unknown as Report));
  }, []);

  const reviewBotGame = useCallback(async (game: FetchedGame, onProgress: (share: number) => void) => {
    const engine = new Engine();
    try {
      await engine.init();
      const review = await reviewGame(game, engine, {
        onEval: (whiteWins, plies) => onProgress(whiteWins.length / (plies + 1)),
      });
      if (!review) return null;
      setBotGames((games) => {
        const next = [review, ...games.filter((g) => g.id !== review.id)].slice(0, BOT_GAMES_KEPT);
        saveBotGames(next);
        return next;
      });
      return review.id;
    } catch {
      return null;
    } finally {
      engine.terminate();
    }
  }, []);

  const loadNotes = useCallback((gameId: string) => {
    const current = reportRef.current;
    const game = current?.reviews.find((r) => r.id === gameId);
    if (!current || !game || current.notes[gameId] || notesAsked.current.has(gameId)) return;
    notesAsked.current.add(gameId);
    void requestGameNotes(game, current.player.rating).then((notes) => {
      if (!notes) return;
      setReport((r) => {
        if (!r) return r;
        const next = { ...r, notes: { ...r.notes, [gameId]: notes } };
        saveReport(next);
        return next;
      });
    });
  }, []);

  const mark = useCallback((id: string, status: PracticeStatus) => {
    setPractice((p) => {
      const next = { ...p, [id]: status };
      savePractice(next);
      return next;
    });
  }, []);

  const findGame = useCallback(
    (id: string) => {
      const mine = report?.reviews.find((r) => r.id === id);
      if (mine) return { game: mine, source: report };
      const bot = botGames.find((r) => r.id === id);
      if (bot) return { game: bot, source: null };
      const shown = sample?.reviews.find((r) => r.id === id);
      return shown ? { game: shown, source: sample } : null;
    },
    [report, botGames, sample]
  );

  const value = useMemo<ReportValue>(
    () => ({
      hydrated,
      report,
      sample,
      link,
      attempt,
      run,
      practice,
      isRunning,
      start,
      stop,
      clear,
      ensureSample,
      reviewBotGame,
      loadNotes,
      mark,
      findGame,
    }),
    [hydrated, report, sample, link, attempt, run, practice, isRunning, start, stop, clear, ensureSample, reviewBotGame, loadNotes, mark, findGame]
  );

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}
