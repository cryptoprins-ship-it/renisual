import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "Over Renisual — onafhankelijke renovatie-site",
  description:
    "Het verhaal achter Renisual: ontstaan uit een eigen woonboot-renovatie. Onafhankelijk, eigen visualisatie-tool, plannen voor keuken, badkamer en tuin.",
  alternates: { canonical: "https://renisual.com/about" },
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "AboutPage",
              "@id": "https://renisual.com/about#aboutpage",
              url: "https://renisual.com/about",
              name: "Over Renisual",
              description:
                "Onafhankelijk renovatieplatform ontstaan uit een eigen woonboot-renovatie. Eigen AI-visualisatie-tool, geen affiliatie met leveranciers.",
              isPartOf: { "@id": "https://renisual.com/#website" },
              mainEntity: { "@id": "https://renisual.com/#organization" },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: "https://renisual.com",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Over",
                  item: "https://renisual.com/about",
                },
              ],
            },
          ],
        })}
      </script>
      <AboutClient />
    </>
  );
}
