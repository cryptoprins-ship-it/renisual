import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visualiseer je gevel met AI — Renisual",
  description:
    "Upload een foto van je gevel, kies een paneel of RAL-kleur, en zie binnen seconden hoe je gerenoveerde huis eruit ziet. AI-render via FLUX.",
  alternates: { canonical: "https://renisual.com/render" },
};

export default function RenderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "@id": "https://renisual.com/render#app",
              name: "Renisual Gevelvisualisator",
              applicationCategory: "DesignApplication",
              applicationSubCategory: "AI Image Generation",
              operatingSystem: "Web",
              url: "https://renisual.com/render",
              description:
                "AI-tool die in seconden je gevelfoto omtovert naar een renovatievisualisatie met geselecteerde panelen of RAL-kleur.",
              featureList: [
                "Upload eigen gevelfoto",
                "Spanl, Keralit en andere paneeloverzichten",
                "RAL-kleurpicker met verfvisualisatie",
                "FLUX klein-9b AI-render",
              ],
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "EUR",
                description:
                  "10 gratis renders per week. Credit-packs vanaf €5 voor 200 renders.",
              },
              publisher: { "@id": "https://renisual.com/#organization" },
              isPartOf: { "@id": "https://renisual.com/#website" },
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
                  name: "Visualiseer",
                  item: "https://renisual.com/render",
                },
              ],
            },
          ],
        })}
      </script>
      {children}
    </>
  );
}
