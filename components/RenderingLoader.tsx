"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  /** Optional retry-attempt counter (e.g. when the API rate-limits and we retry). */
  attempt?: number;
  /** Aspect ratio for the placeholder; defaults to 16:10. Pass null for full-bleed. */
  aspect?: string | null;
  /** Smaller layout for use inside a single render slot. Default false. */
  compact?: boolean;
};

const ATTEMPT_LABEL: Record<string, (n: number) => string> = {
  nl: (n) => `Poging ${n}/3`,
  en: (n) => `Attempt ${n}/3`,
  de: (n) => `Versuch ${n}/3`,
  fr: (n) => `Tentative ${n}/3`,
  es: (n) => `Intento ${n}/3`,
};

export default function RenderingLoader({ attempt, aspect = "16/10", compact = false }: Props) {
  const { locale, t } = useLocale();
  const [stage, setStage] = useState<"initial" | "slow" | "almost">("initial");

  useEffect(() => {
    const t1 = window.setTimeout(() => setStage("slow"), 5000);
    const t2 = window.setTimeout(() => setStage("almost"), 15000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const message =
    stage === "initial"
      ? t("rendering_loading_initial")
      : stage === "slow"
        ? t("rendering_loading_slow")
        : t("rendering_loading_almost");

  const attemptText =
    attempt && attempt > 1
      ? (ATTEMPT_LABEL[locale] ?? ATTEMPT_LABEL.en)(attempt)
      : null;

  const spinnerSize = compact ? "h-8 w-8" : "h-16 w-16";
  const messageClass = compact ? "text-xs" : "text-sm";
  const containerPadding = compact ? "p-3" : "p-6";

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200"
      style={!compact && aspect ? { aspectRatio: aspect } : undefined}
      role="status"
      aria-live="polite"
    >
      <div className={`flex flex-col items-center justify-center gap-3 ${containerPadding}`}>
        <div className={`relative ${spinnerSize}`}>
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-ink border-t-transparent" />
        </div>
        <p className={`animate-pulse text-center font-medium text-neutral-800 ${messageClass}`}>
          {message}
        </p>
        {attemptText && (
          <p className="text-[10px] text-neutral-500">{attemptText}</p>
        )}
      </div>
    </div>
  );
}
