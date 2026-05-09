"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import DynamicMetadata from "@/components/DynamicMetadata";

type RemoteEntry = {
  name: string;
  score: number;
  maxTile: number;
  at: string;
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function LeaderboardClient() {
  const [entries, setEntries] = useState<RemoteEntry[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((data: { entries: RemoteEntry[] }) => {
        setEntries(data.entries ?? []);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  const top = entries[0];

  return (
    <main className="min-h-[100dvh] bg-paper text-ink">
      <DynamicMetadata page="leaderboard" />
      <nav className="border-b border-ink bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Renisual
          </Link>
          <div className="flex gap-2">
            <Link
              href="/wachten"
              className="rounded-xl border border-ink px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
            >
              Speel 2048 →
            </Link>
            <Link
              href="/render"
              className="rounded-xl border border-ink px-3 py-1.5 text-xs font-medium hover:bg-stone-50"
            >
              Render
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="mt-2 text-sm text-stone-600">
          Top 50 2048-scores van alle spelers. Speel mee in de{" "}
          <Link href="/wachten" className="font-semibold underline underline-offset-4">
            wachtkamer
          </Link>
          .
        </p>

        {top && (
          <div className="mt-6 rounded-2xl border-2 border-ink bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-stone-500">#1 om te verslaan</p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xl font-bold">{top.name}</p>
                <p className="text-xs text-stone-500">max tile {top.maxTile}</p>
              </div>
              <p className="text-3xl font-bold">{top.score}</p>
            </div>
            <Link
              href="/wachten"
              className="mt-4 inline-block rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:opacity-80"
            >
              Kun je de #1 verslaan? →
            </Link>
          </div>
        )}

        {state === "loading" ? (
          <p className="mt-8 text-sm text-stone-500">Laden…</p>
        ) : state === "error" ? (
          <p className="mt-8 text-sm text-error">
            Leaderboard niet bereikbaar. Probeer het later nog eens.
          </p>
        ) : entries.length === 0 ? (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-ink bg-white p-8 text-center">
            <p className="text-sm text-stone-600">
              Nog geen scores. Wees de eerste die de wachtkamer beklimt.
            </p>
            <Link
              href="/wachten"
              className="mt-4 inline-block rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-paper hover:opacity-80"
            >
              Speel nu →
            </Link>
          </div>
        ) : (
          <ol className="mt-6 space-y-2">
            {entries.map((e, i) => (
              <li
                key={`${e.at}-${i}`}
                className={`flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 ${
                  i === 0 ? "border-2 border-ink" : "border-ink"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      i === 0
                        ? "bg-warning/15 text-paper"
                        : i === 1
                        ? "bg-stone-400 text-paper"
                        : i === 2
                        ? "bg-warning/15 text-paper"
                        : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{e.name}</p>
                    <p className="text-[11px] text-stone-500">
                      {fmtDate(e.at)} · max tile {e.maxTile}
                    </p>
                  </div>
                </div>
                <p className="text-lg font-bold">{e.score}</p>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-8 text-xs text-stone-500">
          Globale leaderboard via /api/leaderboard. In dev/zonder persistente storage
          worden scores per server-restart gewist.
        </p>
      </section>
    </main>
  );
}
