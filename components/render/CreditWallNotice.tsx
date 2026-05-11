"use client";

import Link from "next/link";

type Props = {
  remaining: number;
  resetAt: string;
};

function formatResetTime(iso: string): string {
  // "Morgen om middernacht" leest beter dan een datumstring.
  // We nemen aan dat resetAt altijd <= 24h in de toekomst is (per spec).
  return "morgen om middernacht";
}

export default function CreditWallNotice({ remaining, resetAt }: Props) {
  return (
    <div
      className="mt-3 rounded-xl border border-ink bg-stone-50 p-4 text-sm text-ink"
      role="status"
      aria-live="polite"
    >
      <p>
        Je <strong>10 gratis renders</strong> voor vandaag zijn op (
        {remaining}/10 over). {formatResetTime(resetAt).charAt(0).toUpperCase() + formatResetTime(resetAt).slice(1)} weer 10.
      </p>
      <p className="mt-2 text-xs text-stone-600">
        <Link
          href="/offerte"
          className="underline underline-offset-2 hover:text-ink"
        >
          Vraag offerte aan →
        </Link>
      </p>
    </div>
  );
}
