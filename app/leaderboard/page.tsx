import type { Metadata } from "next";
import LeaderboardClient from "./LeaderboardClient";

export const metadata: Metadata = {
  title: "Leaderboard — 2048 topscores | Renisual",
  description: "Top 10 hoogste 2048 scores in de Renisual wachtkamer.",
  alternates: { canonical: "https://renisual.com/leaderboard" },
};

export default function LeaderboardPage() {
  return <LeaderboardClient />;
}
