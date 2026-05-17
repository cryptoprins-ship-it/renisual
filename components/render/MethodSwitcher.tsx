"use client";

// Top-of-page render-method choice. Bekleden = AI-panelling pipeline,
// Verven = Gemini nano-banana semantic recolor.
// Pure presentational — state lives in /render.

import { useLocale } from "@/lib/i18n";

export type RenderMethod = "bekleden" | "verven";

export type MethodSwitcherProps = {
  method: RenderMethod;
  onChange: (m: RenderMethod) => void;
};

export function MethodSwitcher({ method, onChange }: MethodSwitcherProps) {
  const { t } = useLocale();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <button
        type="button"
        onClick={() => onChange("bekleden")}
        aria-pressed={method === "bekleden"}
        className={`rounded-lg border p-4 text-left transition ${
          method === "bekleden"
            ? "border-stone-900 bg-stone-900 text-stone-50"
            : "border-stone-300 bg-white text-stone-900 hover:border-stone-500"
        }`}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">
          {t("render.method.bekleden.eyebrow")}
        </div>
        <div className="mt-1 text-lg font-semibold">
          {t("render.method.bekleden.title")}
        </div>
        <div className="mt-1 text-sm opacity-80">
          {t("render.method.bekleden.desc")}
        </div>
      </button>
      <button
        type="button"
        onClick={() => onChange("verven")}
        aria-pressed={method === "verven"}
        className={`rounded-lg border p-4 text-left transition ${
          method === "verven"
            ? "border-stone-900 bg-stone-900 text-stone-50"
            : "border-stone-300 bg-white text-stone-900 hover:border-stone-500"
        }`}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">
          {t("render.method.verven.eyebrow")}
        </div>
        <div className="mt-1 text-lg font-semibold">
          {t("render.method.verven.title")}
        </div>
        <div className="mt-1 text-sm opacity-80">
          {t("render.method.verven.desc")}
        </div>
      </button>
    </div>
  );
}
