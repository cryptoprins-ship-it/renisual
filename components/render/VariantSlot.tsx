"use client";

import RenderingLoader from "@/components/RenderingLoader";
import { useLocale } from "@/lib/i18n";

export type VariantSlotState =
  | { kind: "pending"; attempt: number }
  | { kind: "success"; dataUrl: string; alt: string }
  | { kind: "failed" }
  | { kind: "aborted" };

type Props = {
  state: VariantSlotState;
  toneLabel: string;
  /** Called when the user taps "probeer opnieuw" on a failed slot. */
  onRetry?: () => void;
};

export default function VariantSlot({ state, toneLabel, onRetry }: Props) {
  const { t } = useLocale();
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-black bg-stone-50">
      <div className="absolute left-2 top-2 z-10 bg-ink/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-paper">
        {toneLabel}
      </div>
      {state.kind === "pending" && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-stone-200 via-stone-100 to-stone-200">
          <div className="absolute inset-0">
            <RenderingLoader compact attempt={state.attempt} aspect={null} />
          </div>
        </div>
      )}
      {state.kind === "success" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.dataUrl}
          alt={state.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {state.kind === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-900">
            {t("render.slot.failed") || "Renderen mislukt"}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="border border-red-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-red-900 hover:bg-red-900 hover:text-white"
            >
              {t("render.slot.retry") || "Probeer opnieuw"}
            </button>
          )}
        </div>
      )}
      {state.kind === "aborted" && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100 p-4 text-center">
          <p className="text-xs text-stone-600">
            {t("render.slot.aborted") || "Geannuleerd"}
          </p>
        </div>
      )}
    </div>
  );
}
