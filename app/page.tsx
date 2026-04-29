import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Renisual — Het complete renovatieplatform voor Nederland",
  description:
    "Bereken renovatiekosten, visualiseer materialen op je eigen huis via AI. Exterieur én interieur — gevel, isolatie, tuin, badkamer, keuken en meer.",
  alternates: { canonical: "https://renisual.com" },
};

export default function HomePage() {
  return <HomeClient />;
}
