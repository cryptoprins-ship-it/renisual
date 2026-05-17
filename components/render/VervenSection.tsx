"use client";

import { useEffect, useState } from "react";
import { RalPicker } from "@/components/render/RalPicker";
import CreditCounter from "@/components/render/CreditCounter";
import CreditWallNotice from "@/components/render/CreditWallNotice";
import { useLocale } from "@/lib/i18n";

export type VervenSectionProps = {
  /** Object-URL of the uploaded photo (same one bekleden uses). */
  photoSrc: string | null;
  /** Raw File handle to POST. */
  photoFile: File | null;
  /** Current credits remaining (shared cap with bekleden). null = unknown. */
  creditsRemaining: number | null;
  /** Called after a successful render so the page can refresh credit-counter. */
  onCreditsChanged?: (remaining: number) => void;
};

export function VervenSection({
  photoSrc,
  photoFile,
  creditsRemaining,
  onCreditsChanged,
}: VervenSectionProps) {
  const { t } = useLocale();
  const [ralCode, setRalCode] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  if (!photoSrc || !photoFile) {
    return (
      <div className="rounded border border-stone-300 bg-stone-50 p-4 text-sm text-stone-700">
        {t("render.verven.needPhoto")}
      </div>
    );
  }

  const capped =
    creditsRemaining !== null && creditsRemaining >= 0 && creditsRemaining < 1;
  const canRender = ralCode !== null && !loading && !capped;

  async function handleRender() {
    if (!photoFile || !ralCode) return;
    setLoading(true);
    setError(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      fd.append("ralCode", ralCode);
      const res = await fetch("/api/render/paint", { method: "POST", body: fd });
      if (!res.ok) {
        let body: { error?: string; remaining?: number } = {};
        try {
          body = await res.json();
        } catch {
          /* non-JSON */
        }
        if (res.status === 402 && typeof body.remaining === "number") {
          if (onCreditsChanged) onCreditsChanged(body.remaining);
        }
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const remainingHdr = res.headers.get("x-credit-remaining");
      const remaining = remainingHdr ? parseInt(remainingHdr, 10) : NaN;
      if (!Number.isNaN(remaining) && onCreditsChanged) {
        onCreditsChanged(remaining);
      }
      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "render_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
          {t("render.verven.ral.label")}
        </p>
        <RalPicker selected={ralCode} onSelect={setRalCode} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRender}
            disabled={!canRender}
            className="bg-stone-900 px-8 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-stone-50 transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading
              ? t("render.verven.loading")
              : t("render.generate.cta", { credits: 1 })}
          </button>
          <CreditCounter remaining={creditsRemaining} />
        </div>
        {capped && <CreditWallNotice remaining={creditsRemaining ?? 0} />}
        {error && (
          <div className="text-sm text-red-700">
            {t("render.verven.errorPrefix")} {error}
          </div>
        )}
      </div>

      {resultUrl && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
            {t("render.verven.result.label")}
          </p>
          <img
            src={resultUrl}
            alt={t("render.verven.result.alt")}
            className="block max-w-full"
          />
          <a
            href={resultUrl}
            download="renisual-verfvariant.jpg"
            className="mt-2 inline-block text-sm underline"
          >
            {t("render.download")}
          </a>
          <p className="mt-2 text-xs text-stone-600">
            {t("render.verven.disclaimer")}
          </p>
        </div>
      )}
    </div>
  );
}
