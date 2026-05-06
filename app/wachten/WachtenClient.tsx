"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import DynamicMetadata from "@/components/DynamicMetadata";
import {
  type Board,
  type Direction,
  isGameOver,
  maxTile,
  move,
  newGame,
  addRandomTile,
} from "@/lib/game2048";
import { saveScore, topScore } from "@/lib/leaderboard";

type Tile = { bg: string; fg: string; label: string };

const RAL_TILES: Record<number, Tile> = {
  0: { bg: "#cfc8be", fg: "transparent", label: "" },
  2: { bg: "#F1ECE1", fg: "#3a3530", label: "Wit" },
  4: { bg: "#E2D6BA", fg: "#3a3530", label: "Crème" },
  8: { bg: "#A5A8A6", fg: "#1a1a1a", label: "9006" },
  16: { bg: "#7B7B79", fg: "#ffffff", label: "7038" },
  32: { bg: "#5C5E4A", fg: "#ffffff", label: "Mosgr." },
  64: { bg: "#7A4A3A", fg: "#ffffff", label: "Mahonie" },
  128: { bg: "#9C5239", fg: "#ffffff", label: "Steenrd." },
  256: { bg: "#3A4F5C", fg: "#ffffff", label: "Mon.bl." },
  512: { bg: "#2A2D2F", fg: "#ffffff", label: "7021" },
  1024: { bg: "#3E2E1F", fg: "#ffffff", label: "D.bruin" },
  2048: { bg: "#0E0E10", fg: "#ffffff", label: "9005" },
};

function tileFor(value: number): Tile {
  return RAL_TILES[value] ?? { bg: "#0E0E10", fg: "#fbbf24", label: String(value) };
}

function tileFontSize(value: number): string {
  if (value >= 1024) return "text-base sm:text-xl";
  if (value >= 128) return "text-lg sm:text-2xl";
  return "text-xl sm:text-3xl";
}

export default function WachtenClient() {
  const [board, setBoard] = useState<Board>(() => newGame());
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("");
  const [savedThisRound, setSavedThisRound] = useState(false);
  const [submitState, setSubmitState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [best, setBest] = useState(0);

  useEffect(() => {
    setBest(topScore());
  }, []);

  const handleMove = useCallback(
    (dir: Direction) => {
      if (over) return;
      const result = move(board, dir);
      if (!result.moved) return;
      const next = addRandomTile(result.board);
      setBoard(next);
      setScore((s) => s + result.gained);
      if (isGameOver(next)) setOver(true);
    },
    [board, over]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, Direction> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        a: "left",
        d: "right",
        w: "up",
        s: "down",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleMove]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? "right" : "left");
    } else {
      handleMove(dy > 0 ? "down" : "up");
    }
  }

  function reset() {
    setBoard(newGame());
    setScore(0);
    setOver(false);
    setSavedThisRound(false);
    setSubmitState("idle");
  }

  async function submitScore(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const max = maxTile(board);
    saveScore({ name: trimmed.slice(0, 20), score, maxTile: max, at: new Date().toISOString() });
    setSavedThisRound(true);
    setBest(topScore());

    setSubmitState("loading");
    try {
      const res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed, score, maxTile: max }),
      });
      if (!res.ok) throw new Error("submit failed");
      setSubmitState("ok");
    } catch {
      setSubmitState("error");
    }
  }

  const personalBest = Math.max(best, score);
  const max = maxTile(board);

  return (
    <main className="min-h-[100dvh] bg-paper text-ink">
      <DynamicMetadata page="wachten" />
      <nav className="border-b border-black bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Renisual
          </Link>
          <div className="flex gap-2">
            <Link
              href="/leaderboard"
              className="rounded-xl border border-black px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Leaderboard →
            </Link>
            <Link
              href="/render"
              className="rounded-xl border border-black px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Terug naar render
            </Link>
          </div>
        </div>
      </nav>

      <div className="border-b border-black bg-amber-50 px-4 py-2 text-center">
        <p className="text-sm font-medium text-amber-900">
          Je render wordt gegenereerd... <span className="text-amber-700">(±20 sec)</span>
        </p>
        <div className="mx-auto mt-1 h-1 max-w-md overflow-hidden rounded-full bg-amber-200">
          <div className="h-full w-full origin-left animate-[wachten-progress_20s_linear_infinite] bg-amber-700" />
        </div>
        <style>{`
          @keyframes wachten-progress {
            0% { transform: scaleX(0); }
            100% { transform: scaleX(1); }
          }
        `}</style>
      </div>

      <section className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold">Wachtkamer — 2048</h1>
        <p className="mt-2 text-sm text-gray-600">
          Speel 2048 met Spanl & Keralit RAL-kleuren als tegels. Pijltjestoetsen of
          WASD op desktop, swipe op mobiel.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-black bg-white p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Score</p>
            <p className="text-2xl font-bold">{score}</p>
          </div>
          <div className="rounded-xl border border-black bg-white p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Best</p>
            <p className="text-2xl font-bold">{personalBest}</p>
          </div>
          <div className="rounded-xl border border-black bg-white p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Max tile</p>
            <p className="text-2xl font-bold">{max}</p>
          </div>
        </div>

        <div
          className="mt-4 select-none touch-none rounded-2xl border border-black bg-neutral-300 p-2 sm:p-3"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {board.flatMap((row, r) =>
              row.map((value, c) => {
                const tile = tileFor(value);
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`flex aspect-square flex-col items-center justify-center rounded-lg font-bold ${tileFontSize(
                      value
                    )}`}
                    style={{ backgroundColor: tile.bg, color: tile.fg }}
                  >
                    <span>{value || ""}</span>
                    {value > 0 && tile.label && (
                      <span className="mt-0.5 text-[8px] font-normal opacity-80 sm:text-[10px]">
                        {tile.label}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] rounded-xl bg-black px-5 text-sm font-semibold text-white hover:opacity-80"
          >
            Nieuw spel
          </button>
          <div className="hidden text-xs text-gray-500 sm:block">
            Pijltjes / WASD om te bewegen.
          </div>
        </div>

        {over && (
          <div className="mt-6 rounded-2xl border-2 border-black bg-white p-5">
            <h2 className="text-xl font-bold">Game over</h2>
            <p className="mt-1 text-sm text-gray-600">
              Eindscore: <span className="font-semibold">{score}</span> · Hoogste tegel:{" "}
              <span className="font-semibold">{max}</span>
            </p>
            {!savedThisRound ? (
              <form onSubmit={submitScore} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  required
                  maxLength={20}
                  placeholder="Naam voor leaderboard"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[44px] flex-1 rounded-xl border border-black px-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={submitState === "loading"}
                  className="min-h-[44px] rounded-xl bg-black px-5 text-sm font-semibold text-white hover:opacity-80 disabled:opacity-50"
                >
                  {submitState === "loading" ? "Bezig…" : "Sla score op"}
                </button>
              </form>
            ) : (
              <div className="mt-4 space-y-1 text-sm">
                <p className="font-medium text-green-700">
                  ✓ Score opgeslagen op dit apparaat.
                </p>
                {submitState === "ok" && (
                  <p className="text-green-700">✓ Ook ingediend bij de globale leaderboard.</p>
                )}
                {submitState === "error" && (
                  <p className="text-amber-700">
                    Globale leaderboard niet bereikbaar — score staat alleen lokaal.
                  </p>
                )}
                <Link
                  href="/leaderboard"
                  className="inline-block font-semibold underline underline-offset-4"
                >
                  Bekijk leaderboard →
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-block text-sm font-semibold underline underline-offset-4"
            >
              Nieuw spel starten →
            </button>
          </div>
        )}

        <p className="mt-8 text-xs text-gray-500">
          Tegelnummers verwijzen naar Spanl en Keralit kleurcodes (bv. 9006 =
          witaluminium). Lokale scores in localStorage; globale scores via
          /api/leaderboard (resetten bij server-restart in dev).
        </p>
      </section>
    </main>
  );
}
