import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "Over Renisual — onafhankelijke renovatie-site",
  description:
    "Het verhaal achter Renisual: ontstaan uit een eigen woonboot-renovatie. Onafhankelijk, eigen visualisatie-tool, plannen voor keuken, badkamer en tuin.",
  alternates: { canonical: "https://renisual.com/about" },
};

export default function AboutPage() {
  return <AboutClient />;
}
