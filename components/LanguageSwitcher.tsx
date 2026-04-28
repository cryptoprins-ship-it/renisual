"use client";

import { useLocale, LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();
  return (
    <div className="fixed right-3 top-3 z-40 print:hidden">
      <label className="sr-only">{t("common.language")}</label>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="rounded-xl border border-black bg-white px-2 py-1 text-xs"
        aria-label={t("common.language")}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
