import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiLimit, clientKeyFromRequest, rateLimitResponse } from "@/lib/ratelimit";
import { verifyOrigin } from "@/lib/verifyOrigin";
import { logger } from "@/lib/logger";

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

const entrySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(MAX_NAME_LEN)
    .transform((s) => s.replace(/[<>]/g, "")),
  score: z.number().finite().min(0).max(1_000_000),
  maxTile: z.number().finite().min(0).max(65536),
});

export async function GET() {
  return NextResponse.json({ entries: topN() });
}

export async function POST(req: NextRequest) {
  const forbidden = verifyOrigin(req);
  if (forbidden) return forbidden;

  const ip = clientKeyFromRequest(req);
  const { success, reset } = await apiLimit.limit(ip);
  if (!success) return rateLimitResponse(reset);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (!data.name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const entry: LeaderboardEntry = {
    name: data.name,
    score: Math.floor(data.score),
    maxTile: Math.floor(data.maxTile),
    at: new Date().toISOString(),
  };

  store.entries.push(entry);
  if (store.entries.length > 200) {
    store.entries = store.entries
      .sort((a, b) => b.score - a.score)
      .slice(0, 100);
  }

  logger.info({ name: entry.name, score: entry.score }, "leaderboard_post");
  return NextResponse.json({ ok: true, entries: topN() });
}
