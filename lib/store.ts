import type { GameReview, LinkedPlayer, PracticeStatus, Report } from "./types";

const REPORT_KEY = "coachmate:report:v2";
const LINK_KEY = "coachmate:link";
const PRACTICE_KEY = "coachmate:practice";
const BOT_GAMES_KEY = "coachmate:bot-games";

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full disk: the run still works, it just won't survive a reload.
  }
}

export const loadReport = () => read<Report>(REPORT_KEY);
export const saveReport = (report: Report) => write(REPORT_KEY, report);
export const loadLink = () => read<LinkedPlayer>(LINK_KEY);
export const saveLink = (player: LinkedPlayer) => write(LINK_KEY, player);
export const loadPractice = () => read<Record<string, PracticeStatus>>(PRACTICE_KEY) ?? {};
export const savePractice = (practice: Record<string, PracticeStatus>) => write(PRACTICE_KEY, practice);

export const loadBotGames = () => read<GameReview[]>(BOT_GAMES_KEY) ?? [];
export const saveBotGames = (games: GameReview[]) => write(BOT_GAMES_KEY, games);

export function clearStored() {
  try {
    window.localStorage.removeItem(REPORT_KEY);
    window.localStorage.removeItem(LINK_KEY);
    window.localStorage.removeItem(PRACTICE_KEY);
  } catch {
    // Nothing stored.
  }
}
