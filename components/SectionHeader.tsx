"use client";

import { useLocale } from "@/lib/i18n";

type Props = {
  /** Two-digit number prefix shown before the dash, e.g. "01". */
  number: string;
  /** i18n key whose value goes after the dash (rendered upper-case). */
  titleKey: string;
};

/**
 * Architectural numbered section header used on /gevelcalc and /render.
 * Format: `<num> — <UPPERCASE TITLE>` in mono, tracked, stone-500.
 */
export default function SectionHeader({ number, titleKey }: Props) {
  const { t } = useLocale();
  return (
    <header className="mb-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
        {number} — {t(titleKey)}
      </p>
    </header>
  );
}
