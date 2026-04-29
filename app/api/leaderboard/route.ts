import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export type LeaderboardEntry = {
  name: string;
  score: number;
  maxTile: number;
  at: string;
};

const MAX_ENTRIES = 50;
const MAX_NAME_LEN = 20;

type Store = { entries: LeaderboardEntry[] };

const globalStore = globalThis as unknown as { __renisualLeaderboard?: Store };
if (!globalStore.__renisualLeaderboard) {
  globalStore.__renisualLeaderboard = { entries: [] };
}
const store = globalStore.__renisualLeaderboard;

function topN(): LeaderboardEntry[] {
  return [...store.entries].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
}

function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, MAX_NAME_LEN).replace(/[<>]/g, "");
}

export async function GET() {
  return NextResponse.json({ entries: topN() });
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; score?: unknown; maxTile?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = sanitizeName(body.name);
  const score = Number(body.score);
  const maxTileVal = Number(body.maxTile);

  if (!name) return NextResponse.json({ error: "Naam vereist." }, { status: 400 });
  if (!Number.isFinite(score) || score < 0 || score > 1_000_000) {
    return NextResponse.json({ error: "Ongeldige score." }, { status: 400 });
  }
  if (!Number.isFinite(maxTileVal) || maxTileVal < 0 || maxTileVal > 65536) {
    return NextResponse.json({ error: "Ongeldige max tile." }, { status: 400 });
  }

  const entry: LeaderboardEntry = {
    name,
    score: Math.floor(score),
    maxTile: Math.floor(maxTileVal),
    at: new Date().toISOString(),
  };

  store.entries.push(entry);
  if (store.entries.length > 200) {
    store.entries = store.entries
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
  }

  return NextResponse.json({ ok: true, entries: topN() });
}
