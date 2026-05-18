import type { Metadata } from "next";
import SubsidieClient from "./SubsidieClient";

export const metadata: Metadata = {
  title: "Subsidies Isolatie & Renovatie 2026 — Renisual",
  description:
    "Overzicht van alle subsidies voor isolatie en gevelrenovatie. ISDE, Energiebespaarlening, gemeentelijke subsidies en meer.",
  alternates: { canonical: "https://renisual.com/subsidie" },
};

// Server-side mirror van de SUBSIDIES-array in SubsidieClient (client
// component). Bewust gedupliceerd zodat Google's crawler de ItemList
// direct uit SSR-output kan lezen zonder JS te draaien. Synchroniseer
// handmatig als SUBSIDIES wijzigt — kort genoeg dat een gedeelde
// constante (export uit /lib) nu niet de moeite waard is.
const SUBSIDIE_ITEMS = [
  {
    name: "ISDE — Investeringssubsidie Duurzame Energie",
    description:
      "Subsidie voor spouwmuur-, vloer-, bodem-, dak- en gevelisolatie en warmtepompen. Tot €38/m².",
    url: "https://www.rvo.nl/subsidies-financiering/isde",
  },
  {
    name: "Energiebespaarlening (SVn)",
    description:
      "Lening met lage rente voor isolatie en verduurzaming. €2.500 tot €65.000.",
    url: "https://www.svn.nl/energiebespaarlening",
  },
  {
    name: "Gemeentelijke subsidies",
    description:
      "Extra gemeentelijke regelingen bovenop landelijke subsidies. Verschilt per gemeente.",
    url: "https://www.verbeterjehuis.nl/subsidies",
  },
  {
    name: "Nationaal Warmtefonds",
    description:
      "0%-lening voor lagere inkomens. Geen rente, terugbetaling uit energiebesparing.",
    url: "https://www.nationaalwarmtefonds.nl",
  },
];

export default function SubsidiePage() {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              "@id": "https://renisual.com/subsidie#article",
              headline: "Subsidies Isolatie & Renovatie 2026",
              description:
                "Overzicht van alle Nederlandse subsidies voor isolatie en gevelrenovatie, bijgewerkt voor 2026.",
              url: "https://renisual.com/subsidie",
              inLanguage: "nl",
              datePublished: "2026-01-01",
              dateModified: "2026-05-18",
              author: { "@id": "https://renisual.com/#organization" },
              publisher: { "@id": "https://renisual.com/#organization" },
              isPartOf: { "@id": "https://renisual.com/#website" },
            },
            {
              "@type": "ItemList",
              "@id": "https://renisual.com/subsidie#itemlist",
              name: "Subsidies voor isolatie en renovatie 2026",
              numberOfItems: SUBSIDIE_ITEMS.length,
              itemListElement: SUBSIDIE_ITEMS.map((s, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: s.name,
                description: s.description,
                url: s.url,
              })),
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
                  name: "Subsidies",
                  item: "https://renisual.com/subsidie",
                },
              ],
            },
          ],
        })}
      </script>
      <SubsidieClient />
    </>
  );
}
