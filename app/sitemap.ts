import type { MetadataRoute } from "next";

const BASE = "https://renisual.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{ path: string; priority: number }> = [
    { path: "", priority: 1 },
    { path: "/gevelcalc", priority: 0.7 },
    { path: "/gevelcalc/mobile", priority: 0.7 },
    { path: "/render", priority: 0.7 },
    { path: "/subsidie", priority: 0.8 },
    { path: "/roi", priority: 0.7 },
    { path: "/offerte", priority: 0.7 },
    { path: "/privacy", priority: 0.7 },
    { path: "/contact", priority: 0.7 },
    { path: "/wachten", priority: 0.7 },
    { path: "/leaderboard", priority: 0.7 },
  ];
  return routes.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority,
  }));
}
