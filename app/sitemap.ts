import type { MetadataRoute } from "next";
import { execFileSync } from "node:child_process";

const BASE = "https://renisual.com";

// Resolve the most-recent commit ISO timestamp for a given path. Falls
// back to build-time when git is unavailable (e.g. shallow CI clone or
// no .git dir). Build-time only — sitemap.xml is prerendered as static
// during `next build`. execFileSync avoids shell-injection vectors.
const buildTime = new Date();
function lastCommitISO(path: string): Date {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", path],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    if (out) return new Date(out);
  } catch {
    /* git not available — fall back */
  }
  return buildTime;
}

export default function sitemap(): MetadataRoute.Sitemap {
  // Per route: which file's mtime drives lastModified. For pages that
  // wrap a *Client component, point at the client file — content lives
  // there. Multiple sources per route is overkill for now.
  const routes: Array<{ path: string; priority: number; source: string }> = [
    { path: "", priority: 1, source: "app/HomeClient.tsx" },
    { path: "/render", priority: 0.9, source: "app/render/page.tsx" },
    { path: "/gevelcalc", priority: 0.8, source: "app/gevelcalc/page.tsx" },
    { path: "/subsidie", priority: 0.8, source: "app/subsidie/SubsidieClient.tsx" },
    { path: "/about", priority: 0.7, source: "app/about/AboutClient.tsx" },
    { path: "/privacy", priority: 0.4, source: "app/privacy/page.tsx" },
    { path: "/terms", priority: 0.4, source: "app/terms/page.tsx" },
    { path: "/cookiebeleid", priority: 0.4, source: "app/cookiebeleid/page.tsx" },
    { path: "/wachten", priority: 0.5, source: "app/wachten/page.tsx" },
    { path: "/leaderboard", priority: 0.5, source: "app/leaderboard/page.tsx" },
  ];
  return routes.map(({ path, priority, source }) => ({
    url: `${BASE}${path}`,
    lastModified: lastCommitISO(source),
    changeFrequency: "weekly" as const,
    priority,
  }));
}
