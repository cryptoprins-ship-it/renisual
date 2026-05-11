"use client";

import Link from "next/link";

type Props = {
  remaining: number;
};

export default function CreditWallNotice({ remaining }: Props) {
  return (
    <div
      className="mt-3 rounded-xl border border-ink bg-stone-50 p-4 text-sm text-ink"
      role="status"
      aria-live="polite"
    >
      <p>
        Je <strong>10 gratis renders</strong> voor vandaag zijn op (
        {remaining}/10 over). Morgen om middernacht weer 10.
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
