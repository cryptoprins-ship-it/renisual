"use client";

import type { ChangeEvent } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  onFile: (file: File | null) => void;
  uploadLabel: string;
  cameraLabel?: string;
  hintLabel?: string;
  // Forces the hidden inputs to remount when changed. Callers use this to
  // clear out DOM state after a remove/retry so re-picking the same file
  // still fires `change` (see /gevelcalc inputResetKey).
  inputKey?: string | number;
  pickInputRef?: (el: HTMLInputElement | null) => void;
  cameraInputRef?: (el: HTMLInputElement | null) => void;
  // Clears `input.value` after each change so re-picking the same file
  // fires `change`. Default true.
  clearAfterChange?: boolean;
  accept?: string;
};

export default function PhotoUploader({
  onFile,
  uploadLabel,
  cameraLabel,
  hintLabel,
  inputKey,
  pickInputRef,
  cameraInputRef,
  clearAfterChange = true,
  accept = "image/*",
}: Props) {
  const { locale } = useLocale();
  const camText =
    cameraLabel ??
    (locale === "nl"
      ? "Maak foto"
      : locale === "de"
      ? "Foto aufnehmen"
      : locale === "fr"
      ? "Prendre une photo"
      : locale === "es"
      ? "Tomar foto"
      : "Take photo");

  function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (clearAfterChange) e.target.value = "";
    onFile(file);
  }

  return (
    <div
      className="border border-dashed border-stone-300 bg-stone-50 p-8 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFile(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-2">
          <label className="cursor-pointer">
            <span className="block bg-ink px-7 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-stone-800">
              {uploadLabel}
            </span>
            <input
              key={inputKey != null ? `${inputKey}-pick` : undefined}
              ref={pickInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={handle}
            />
          </label>
          {/* `capture="environment"` triggers the rear camera on mobile.
              Desktop browsers ignore the hint and fall back to the file
              picker, so this button is safe to show everywhere. */}
          <label className="cursor-pointer">
            <span className="block border border-ink px-7 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-ink transition-colors hover:bg-ink hover:text-paper">
              {camText}
            </span>
            <input
              key={inputKey != null ? `${inputKey}-cam` : undefined}
              ref={cameraInputRef}
              type="file"
              accept={accept}
              capture="environment"
              className="hidden"
              onChange={handle}
            />
          </label>
        </div>
        {hintLabel && <span className="text-xs text-stone-500">{hintLabel}</span>}
      </div>
    </div>
  );
}
