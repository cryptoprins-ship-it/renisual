import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Renisual GevelCalc — bereken panelen, profielen en prijs",
  description: "Bereken gevelpanelen, profielen, openingen en prijs voor je renovatieproject.",
  alternates: { canonical: "https://renisual.com/gevelcalc" },
};

export default function GevelCalcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SiteNav (rendered inside the page itself) already includes the
  // NavLocaleSwitcher inline. Mounting another one here as a floating
  // fixed-position element gave users two flag pickers — the floating
  // one overlapped the inline one in the top-right and partially
  // covered the Renisual wordmark on small viewports.
  return (
    <>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "HowTo",
              "@id": "https://renisual.com/gevelcalc#howto",
              name: "Bereken gevelmateriaal voor je renovatie",
              description:
                "Stap-voor-stap je gevelpanelen, profielen, openingen en materiaalprijs berekenen.",
              url: "https://renisual.com/gevelcalc",
              inLanguage: "nl",
              totalTime: "PT5M",
              tool: [{ "@type": "HowToTool", name: "Renisual GevelCalc" }],
              step: [
                {
                  "@type": "HowToStep",
                  position: 1,
                  name: "Kies modus",
                  text: "Snel (één vierkante gevel) of Per zijde (exacte invoer per gevelzijde).",
                },
                {
                  "@type": "HowToStep",
                  position: 2,
                  name: "Selecteer paneel of materiaal",
                  text: "Kies uit Spanl, Keralit, Novicell, VinyPlus of andere leveranciers. Selecteer kleur en oriëntatie.",
                },
                {
                  "@type": "HowToStep",
                  position: 3,
                  name: "Voer maten en openingen in",
                  text: "Breedte, hoogte per zijde plus ramen en deuren met afmetingen.",
                },
                {
                  "@type": "HowToStep",
                  position: 4,
                  name: "Bekijk berekening",
                  text: "Aantal panelen, beginprofielen, eindprofielen, hoekprofielen en materiaalprijs ex BTW.",
                },
                {
                  "@type": "HowToStep",
                  position: 5,
                  name: "Vraag offerte aan (optioneel)",
                  text: "Genereer een PDF-offerte met visualisatie, maten en BOM voor je leverancier.",
                },
              ],
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
                  name: "Gevel berekenen",
                  item: "https://renisual.com/gevelcalc",
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
