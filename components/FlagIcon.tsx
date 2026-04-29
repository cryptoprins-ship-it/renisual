"use client";

import { useId } from "react";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  size?: number;
};

/**
 * Tiny inline SVG flags. Windows does not render Unicode flag emoji as
 * pictograms (it falls back to the two-letter region indicator like "NL"),
 * so we ship our own minimal flags to keep the switcher visually consistent
 * across platforms.
 */
export default function FlagIcon({ locale, size = 18 }: Props) {
  // height-to-width ratio fixed to 3:2 (FR/ES use 3:2; NL uses 3:2; DE uses 5:3
  // but visually negligible at this size; UK uses 2:1 — close enough).
  const w = size;
  const h = Math.round((size * 2) / 3);
  const ukClipId = useId();

  switch (locale) {
    case "nl":
      return (
        <svg viewBox="0 0 9 6" width={w} height={h} aria-hidden className="rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
          <rect width="9" height="6" fill="#fff" />
          <rect width="9" height="2" fill="#AE1C28" />
          <rect y="4" width="9" height="2" fill="#21468B" />
        </svg>
      );
    case "en":
      return (
        <svg viewBox="0 0 60 30" width={w} height={h} aria-hidden className="rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
          <clipPath id={ukClipId}>
            <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
          </clipPath>
          <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
          <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
          <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${ukClipId})`} stroke="#C8102E" strokeWidth="4" />
          <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
          <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
        </svg>
      );
    case "de":
      return (
        <svg viewBox="0 0 5 3" width={w} height={h} aria-hidden className="rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
          <rect width="5" height="1" fill="#000" />
          <rect y="1" width="5" height="1" fill="#DD0000" />
          <rect y="2" width="5" height="1" fill="#FFCE00" />
        </svg>
      );
    case "fr":
      return (
        <svg viewBox="0 0 3 2" width={w} height={h} aria-hidden className="rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
          <rect width="1" height="2" fill="#0055A4" />
          <rect x="1" width="1" height="2" fill="#fff" />
          <rect x="2" width="1" height="2" fill="#EF4135" />
        </svg>
      );
    case "es":
      return (
        <svg viewBox="0 0 3 2" width={w} height={h} aria-hidden className="rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
          <rect width="3" height="2" fill="#AA151B" />
          <rect y="0.5" width="3" height="1" fill="#F1BF00" />
        </svg>
      );
  }
}
