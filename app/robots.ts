import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://renisual.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/lab/", "/offerte/"] },
      // Meta's link-preview crawler (WhatsApp, Facebook, Instagram).
      // Most-specific user-agent wins, so this overrides the * disallow
      // and lets WhatsApp generate previews for any URL we share.
      { userAgent: "facebookexternalhit", allow: "/" },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
