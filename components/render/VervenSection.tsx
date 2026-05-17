"use client";

import { RalPicker } from "@/components/render/RalPicker";
import { useLocale } from "@/lib/i18n";

export type VervenSectionProps = {
  /** Object-URL of the uploaded photo (same one bekleden uses). */
  photoSrc: string | null;
  /** Currently picked RAL code (controlled from parent). */
  ralCode: string | null;
  /** Called when user picks a RAL color. */
  onRalChange: (code: string | null) => void;
};

export function VervenSection({
  photoSrc,
  ralCode,
  onRalChange,
}: VervenSectionProps) {
  const { t } = useLocale();

  if (!photoSrc) {
    return (
      <div className="rounded border border-stone-300 bg-stone-50 p-4 text-sm text-stone-700">
        {t("render.verven.needPhoto")}
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
        {t("render.verven.ral.label")}
      </p>
      <RalPicker selected={ralCode} onSelect={onRalChange} />
    </div>
  );
}
