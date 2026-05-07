"use client";

import { useId } from "react";

/**
 * Renisual logo system
 * --------------------------------------------------------------------------
 * Usage:
 *   <Logo />                          -> horizontal mark + wordmark
 *   <Logo variant="mark" />           -> mark only (icon)
 *   <Logo variant="stacked" />        -> mark above wordmark
 *   <Logo inverse />                  -> light version for dark backgrounds
 *   <Logo markSize={48} />            -> custom mark size in pixels
 *
 * Colors:
 *   anthracite   #2D3437   donker (top face / wordmark)
 *   grass        #6B8E4E   linker zijvlak
 *   brick        #A14B2A   bakstenen patroon (rechter zijvlak)
 *   mortar       #5C2E18   voeg in patroon
 *   cream        #F0EDE5   inverse (top face op donkere bg)
 * --------------------------------------------------------------------------
 */

export type LogoVariant = "mark" | "horizontal" | "stacked";

interface LogoProps {
  variant?: LogoVariant;
  inverse?: boolean;
  markSize?: number;
  className?: string;
}

interface MarkProps {
  inverse?: boolean;
  size?: number;
  className?: string;
}

export function RenisualMark({
  inverse = false,
  size = 40,
  className,
}: MarkProps) {
  const uid = useId();
  const patternId = `renisual-brick-${uid}`;
  const topFill = inverse ? "#F0EDE5" : "#2D3437";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Renisual"
      className={className}
    >
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="10"
          height="6"
        >
          <rect width="10" height="6" fill="#5C2E18" />
          <rect x="0.3" y="0.3" width="9.4" height="2.4" fill="#A14B2A" />
          <rect x="-4.7" y="3.3" width="9.4" height="2.4" fill="#A14B2A" />
          <rect x="5.3" y="3.3" width="9.4" height="2.4" fill="#A14B2A" />
        </pattern>
      </defs>
      {/* Top face — anthracite (or cream when inverse) */}
      <path d="M50 12 L86 32 L50 52 L14 32 Z" fill={topFill} />
      {/* Left face — grass green */}
      <path d="M14 32 L50 52 L50 92 L14 72 Z" fill="#6B8E4E" />
      {/* Right face — brick pattern */}
      <path d="M86 32 L50 52 L50 92 L86 72 Z" fill={`url(#${patternId})`} />
    </svg>
  );
}

export function Logo({
  variant = "horizontal",
  inverse = false,
  markSize,
  className,
}: LogoProps) {
  const wordColor = inverse ? "#F0EDE5" : "#2D3437";

  if (variant === "mark") {
    return (
      <RenisualMark
        inverse={inverse}
        size={markSize ?? 40}
        className={className}
      />
    );
  }

  if (variant === "stacked") {
    return (
      <div
        className={
          "inline-flex flex-col items-center gap-3 " + (className ?? "")
        }
      >
        <RenisualMark inverse={inverse} size={markSize ?? 56} />
        <span
          className="font-display tracking-tight text-base"
          style={{ color: wordColor }}
        >
          Renisual
        </span>
      </div>
    );
  }

  // horizontal (default)
  return (
    <div
      className={"inline-flex items-center gap-3 " + (className ?? "")}
    >
      <RenisualMark inverse={inverse} size={markSize ?? 32} />
      <span
        className="font-display tracking-tight text-xl leading-none"
        style={{ color: wordColor }}
      >
        Renisual
      </span>
    </div>
  );
}
