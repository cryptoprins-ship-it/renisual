import type { Metadata } from "next";
import WachtenClient from "./WachtenClient";

export const metadata: Metadata = {
  title: "Wachtkamer — speel 2048 terwijl je render laadt | Renisual",
  description:
    "Speel 2048 terwijl je AI gevel-render genereert. Je topscore wordt opgeslagen in de leaderboard.",
  alternates: { canonical: "https://renisual.com/wachten" },
};

export default function WachtenPage() {
  return <WachtenClient />;
}
