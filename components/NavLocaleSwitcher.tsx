"use client";

import { useLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";

const FLAGS: Record<Locale, { flag: string; code: string }> = {
  nl: { flag: "🇳🇱", code: "NL" },
  en: { flag: "🇬🇧", code: "EN" },
  de: { flag: "🇩🇪", code: "DE" },
  fr: { flag: "🇫🇷", code: "FR" },
  es: { flag: "🇪🇸", code: "ES" },
};

type Props = {
  className?: string;
  /** When true, omits the rounded container background — useful inline in nav. */
  compact?: boolean;
};

export default function NavLocaleSwitcher({ className, compact }: Props) {
  const { locale, setLocale } = useLocale();

  const onPick = (l: Locale) => {
    if (l === locale) return;
    setLocale(l); // writes to localStorage + updates html lang
    if (typeof window !== "undefined") {
      // Reload so any module-level state / SSR copy that doesn't subscribe to
      // useLocale repaints in the new language.
      window.location.reload();
    }
  };

  return (
    <div
      role="group"
      aria-label="Language"
      className={[
        "flex items-center gap-1 print:hidden",
        compact ? "" : "rounded-xl border border-zinc-200 bg-white/90 p-1 shadow-sm backdrop-blur",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {SUPPORTED_LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onPick(l)}
            aria-label={`Switch language to ${FLAGS[l].code}`}
            aria-pressed={active}
            className={[
              "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition",
              active
                ? "bg-black text-white"
                : "text-zinc-700 hover:bg-zinc-100",
            ].join(" ")}
          >
            <span aria-hidden>{FLAGS[l].flag}</span>
            <span>{FLAGS[l].code}</span>
          </button>
        );
      })}
    </div>
  );
}
