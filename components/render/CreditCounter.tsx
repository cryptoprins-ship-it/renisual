"use client";

type Props = {
  remaining: number | null;  // null = nog niet geladen
  total?: number;
};

export default function CreditCounter({ remaining, total = 10 }: Props) {
  if (remaining === null || remaining < 0) return null;
  const low = remaining < 5;
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
        low ? "text-red-900" : "text-stone-600"
      }`}
      aria-live="polite"
    >
      {remaining}/{total} over deze week
    </span>
  );
}
