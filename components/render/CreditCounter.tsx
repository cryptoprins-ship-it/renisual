"use client";

type Props = {
  remaining: number | null;  // null = nog niet geladen
  total?: number;
};

export default function CreditCounter({ remaining, total = 10 }: Props) {
  if (remaining === null) return null;
  // remaining = -1 betekent Upstash-fail-open (dev zonder Redis, of upstream
  // hiccup). Toon nog steeds een teller met max-credits zodat user weet hoe
  // ver de wekelijkse cap reikt; productie-Upstash levert het echte cijfer.
  const display = remaining < 0 ? total : remaining;
  const low = remaining >= 0 && remaining < 5;
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.15em] ${
        low ? "text-red-900" : "text-stone-600"
      }`}
      aria-live="polite"
    >
      {display}/{total} over deze week
    </span>
  );
}
