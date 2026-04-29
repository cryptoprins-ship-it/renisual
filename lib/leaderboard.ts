export type LeaderboardEntry = {
  name: string;
  score: number;
  maxTile: number;
  at: string;
};

const STORAGE_KEY = "renisual-leaderboard-v1";
const MAX_ENTRIES = 10;

export function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveScore(entry: LeaderboardEntry): LeaderboardEntry[] {
  const current = loadLeaderboard();
  const next = [...current, entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function topScore(): number {
  const list = loadLeaderboard();
  return list[0]?.score ?? 0;
}
