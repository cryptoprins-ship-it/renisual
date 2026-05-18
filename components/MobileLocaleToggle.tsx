"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import FlagIcon from "./FlagIcon";

const LABELS: Record<Locale, string> = {
  nl: "Nederlands",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
};

export default function MobileLocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const others = SUPPORTED_LOCALES.filter((l) => l !== locale);

  return (
    <div ref={rootRef} className={["relative", className ?? ""].filter(Boolean).join(" ")}>
      <button
        type="button"
        aria-label={`Language: ${LABELS[locale]}. Tap to change.`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white/90 shadow-sm"
      >
        <FlagIcon locale={locale} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Language"
          className="absolute right-0 top-full z-40 mt-2 flex flex-col gap-1 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg"
        >
          {others.map((l) => (
            <button
              key={l}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              title={LABELS[l]}
              aria-label={`Switch language to ${LABELS[l]}`}
              className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-stone-100"
            >
              <FlagIcon locale={l} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
