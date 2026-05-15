import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Voorwaarden — Renisual",
  description:
    "Korte algemene voorwaarden voor het gebruik van Renisual en de aankoop van credits voor AI-rendering.",
  alternates: { canonical: "https://renisual.com/terms" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "11 mei 2026";
const CONTACT_EMAIL = "info@renisual.com";

export default function TermsPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-paper text-ink">
      <nav className="sticky top-0 z-30 border-b border-stone-200 bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
          <Link href="/" aria-label="Renisual home" className="inline-flex items-center">
            <Logo variant="horizontal" />
          </Link>
        </div>
      </nav>

      <article className="flex-1 px-6 py-10 md:px-12 md:py-14 lg:px-20 lg:py-16">
        <div className="mx-auto max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
            Renisual
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
            Algemene voorwaarden
          </h1>
          <p className="mt-2 text-sm text-stone-500">Laatst bijgewerkt: {LAST_UPDATED}</p>

          <div className="mt-8 space-y-6 text-base leading-[1.7] text-stone-800">
            <section>
              <h2 className="font-display text-2xl tracking-tight">1. Wat Renisual is</h2>
              <p className="mt-2">
                Renisual is een online tool die je helpt om gevelrenovatie te visualiseren, berekenen en
                offertes aan te vragen. Renisual is een <strong>tussenpersoon</strong>: wij verbinden
                gebruikers met leveranciers van gevelpanelen (zoals Spanl en Keralit). Wij verkopen niet
                zelf de panelen, voeren niet zelf de installatie uit, en zijn niet verantwoordelijk voor de
                uitvoering door derden.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">2. Gebruik van de tool</h2>
              <p className="mt-2">
                De reken- en visualisatiefuncties zijn gratis en zonder account te gebruiken. Het uploaden
                van foto's, het laten genereren van renders, en het aanvragen van een offerte is op eigen
                initiatief van de gebruiker.
              </p>
              <p className="mt-2">
                Bij het uploaden van foto's verklaart de gebruiker dat hij/zij over de rechten beschikt om
                deze foto te gebruiken.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">3. Credits voor AI-rendering</h2>
              <p className="mt-2">
                Renders worden gegenereerd via AI-modellen. De eerste paar renders zijn gratis; voor extra
                renders kun je credits kopen. Voor credit-aankopen gelden de volgende regels:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>De prijs per credit staat op de aankooppagina op het moment van betaling.</li>
                <li>Credits zijn persoonsgebonden en niet overdraagbaar.</li>
                <li>
                  Credits vervallen <strong>12 maanden</strong> na aankoop als ze niet gebruikt zijn.
                </li>
                <li>
                  Eenmaal gebruikte credits worden niet vergoed, ook niet als het resultaat van de render
                  niet aan je verwachting voldoet.
                </li>
                <li>
                  Niet-gebruikte credits worden binnen 14 dagen na aankoop op verzoek terugbetaald
                  (wettelijk herroepingsrecht), tenzij je daar bij de aankoop expliciet afstand van hebt
                  gedaan.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">4. Renders zijn artistieke impressies</h2>
              <p className="mt-2">
                De renders die Renisual genereert zijn <strong>artistieke impressies</strong>, geen
                technische tekeningen. Kleur, schaduw, perspectief en materiaaltextuur kunnen afwijken van
                het eindresultaat. Gebruik de render als richting, niet als bindend voorbeeld. De
                uiteindelijke uitvoering door een leverancier kan andere keuzes maken.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">5. Offertes</h2>
              <p className="mt-2">
                Een via Renisual aangevraagde offerte is een <strong>indicatie</strong> op basis van de
                ingevoerde gegevens en huidige catalogusprijzen. De daadwerkelijke prijs en levertijd
                worden bevestigd door de leverancier zelf. Renisual is geen partij in de overeenkomst
                tussen klant en leverancier.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">6. Aansprakelijkheid</h2>
              <p className="mt-2">
                Renisual spant zich in om de tool zorgvuldig en up-to-date te houden, maar geeft geen
                garantie op onafgebroken beschikbaarheid of foutloze werking. Renisual is niet aansprakelijk
                voor schade die voortvloeit uit beslissingen genomen op basis van de tool (verkeerd
                bestelde aantallen, kleurkeuzes, etc.). Onze aansprakelijkheid is in elk geval beperkt tot
                het bedrag dat de gebruiker aan credits heeft betaald.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">7. Wijzigingen</h2>
              <p className="mt-2">
                Renisual mag deze voorwaarden aanpassen. Wezenlijke wijzigingen worden bovenaan deze
                pagina vermeld. Voor reeds gekochte credits gelden altijd de voorwaarden zoals op het
                moment van aankoop.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">8. Toepasselijk recht</h2>
              <p className="mt-2">
                Op deze voorwaarden is Nederlands recht van toepassing. Geschillen worden voorgelegd aan
                de bevoegde rechter in Nederland.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">9. Contact</h2>
              <p className="mt-2">
                Vragen, klachten of verzoeken:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4 hover:text-accent">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </article>

      <footer className="border-t border-stone-200 bg-paper px-6 py-8 md:px-12 lg:px-20">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div>
            <Logo variant="horizontal" markSize={28} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-stone-600">
            <Link href="/" className="hover:text-ink">Home</Link>
            <Link href="/about" className="hover:text-ink">Over</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Voorwaarden</Link>
            <Link href="/cookiebeleid" className="hover:text-ink">Cookies</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">Contact</a>
          </div>
          <p className="text-xs text-stone-400">© 2026 Renisual</p>
        </div>
      </footer>
    </main>
  );
}
