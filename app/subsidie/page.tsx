import type { Metadata } from "next";
import SubsidieClient from "./SubsidieClient";

export const metadata: Metadata = {
  title: "Subsidies Isolatie & Renovatie 2026 — Renisual",
  description:
    "Overzicht van alle subsidies voor isolatie en gevelrenovatie. ISDE, Energiebespaarlening, gemeentelijke subsidies en meer.",
  alternates: { canonical: "https://renisual.com/subsidie" },
};

export default function SubsidiePage() {
  return <SubsidieClient />;
}
