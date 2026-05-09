"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  startedAt: number;
  completed: number;
  total: number;
  onCancel: () => void;
};

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BatchStatusBand({ startedAt, completed, total, onCancel }: Props) {
  const { t } = useLocale();
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return (
    <div
      className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 flex items-center justify-between gap-3 border-b border-ink bg-paper/95 px-3 py-2 backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col">
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink">
          {completed}/{total} {t("render.batch.ready") || "klaar"} · {formatElapsed(elapsed)}
        </span>
        <span className="text-[11px] text-stone-600">
          {t("render.batch.duration_hint") || "Een renderbatch duurt 30–60 seconden."}
        </span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="border border-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-ink hover:bg-ink hover:text-paper"
      >
        {t("render.batch.cancel") || "Annuleer"}
      </button>
    </div>
  );
}
