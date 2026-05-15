import type { MetadataRoute } from "next";

const BASE = "https://renisual.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{ path: string; priority: number }> = [
    { path: "", priority: 1 },
    { path: "/render", priority: 0.9 },
    { path: "/gevelcalc", priority: 0.8 },
    { path: "/subsidie", priority: 0.8 },
    { path: "/about", priority: 0.7 },
    { path: "/privacy", priority: 0.4 },
    { path: "/terms", priority: 0.4 },
    { path: "/cookiebeleid", priority: 0.4 },
    { path: "/wachten", priority: 0.5 },
    { path: "/leaderboard", priority: 0.5 },
  ];
  return routes.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority,
  }));
}
