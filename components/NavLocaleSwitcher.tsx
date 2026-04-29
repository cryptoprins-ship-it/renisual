"use client";

import { useLocale, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import FlagIcon from "./FlagIcon";

const LABELS: Record<Locale, string> = {
  nl: "Nederlands",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
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
    if (process.env.NODE_ENV !== "production") {
      console.debug("[i18n] switcher onClick →", l);
    }
    // setLocale updates currentLocale, writes localStorage, syncs <html lang>,
    // and notifies every subscribed useLocale() consumer to re-render. No
    // reload required — components that use t() repaint immediately.
    setLocale(l);
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
            aria-label={`Switch language to ${LABELS[l]}`}
            title={LABELS[l]}
            aria-pressed={active}
            className={[
              "flex items-center justify-center rounded-lg p-1.5 transition",
              active
                ? "bg-black ring-2 ring-black"
                : "hover:bg-zinc-100",
            ].join(" ")}
          >
            <FlagIcon locale={l} />
          </button>
        );
      })}
    </div>
  );
}
