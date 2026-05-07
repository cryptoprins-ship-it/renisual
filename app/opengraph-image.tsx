import { ImageResponse } from "next/og";

// Renisual social-share / OG card. 1200x630 is the canonical Open
// Graph size — covers Facebook, LinkedIn, Twitter (which uses this
// image too because we don't ship a separate twitter-image), and
// most messaging apps. Edge runtime keeps the cold-start fast so
// scrapers see the image quickly.

export const runtime = "edge";
export const alt = "Renisual — Zien is weten.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#f5f4f0",
          color: "#0a0a0a",
          fontFamily: "Times New Roman, serif",
        }}
      >
        {/* Top row — mark + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* Inline isometric mark — three flat-color faces, no
              pattern fill (Satori doesn't support SVG patterns) */}
          <svg width="96" height="96" viewBox="0 0 100 100">
            <path d="M50 12 L86 32 L50 52 L14 32 Z" fill="#2D3437" />
            <path d="M14 32 L50 52 L50 92 L14 72 Z" fill="#6B8E4E" />
            <path d="M86 32 L50 52 L50 92 L86 72 Z" fill="#A14B2A" />
          </svg>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#2D3437",
            }}
          >
            Renisual
          </div>
        </div>

        {/* Center — main slogan, big editorial display */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 132,
              lineHeight: 1.0,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#0a0a0a",
            }}
          >
            Zien is weten.
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#5a5a5a",
              fontStyle: "italic",
            }}
          >
            Render, reken, renoveer.
          </div>
        </div>

        {/* Bottom row — domain + tagline */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 22,
            fontFamily: "monospace",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#5a5a5a",
          }}
        >
          <div>renisual.com</div>
          <div>Gevelrendering · Calculator · Offerte</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
