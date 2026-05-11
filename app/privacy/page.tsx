import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Privacyverklaring — Renisual",
  description:
    "Wat Renisual verzamelt, waarvoor, hoe lang, en welke rechten je hebt. Compliant met de AVG (GDPR).",
  alternates: { canonical: "https://renisual.com/privacy" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "11 mei 2026";
const CONTACT_EMAIL = "cryptoprins@gmail.com";

export default function PrivacyPage() {
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
            Privacyverklaring
          </h1>
          <p className="mt-2 text-sm text-stone-500">Laatst bijgewerkt: {LAST_UPDATED}</p>

          <div className="mt-8 space-y-6 text-base leading-[1.7] text-stone-800">
            <section>
              <h2 className="font-display text-2xl tracking-tight">In het kort</h2>
              <p className="mt-2">
                Renisual is een visualisatie- en rekentool voor gevelrenovatie. Je kunt 'm gebruiken zonder
                account. Als je foto's uploadt, een offerte aanvraagt, of credits koopt, slaan we minimaal de
                data op die daarvoor nodig is. Wij verkopen je gegevens niet door en gebruiken geen
                tracking-cookies.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Welke gegevens we verzamelen</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>
                  <strong>Anonieme bezoekstatistieken</strong> via Plausible Analytics: pagina, land,
                  apparaattype. Plausible plaatst geen cookies en anonimiseert IP-adressen voor opslag.
                </li>
                <li>
                  <strong>Geüploade foto's</strong>: de foto van je gevel die je in de visualisator zet.
                  Wordt versleuteld opgeslagen om de render te kunnen genereren.
                </li>
                <li>
                  <strong>Offerte-data</strong>: als je een offerte aanvraagt slaan we de berekening, het
                  resulterende PDF, en — als je 'm invult — je e-mailadres of telefoonnummer op.
                </li>
                <li>
                  <strong>E-mailadres</strong>: als je je inschrijft voor de wachtlijst.
                </li>
                <li>
                  <strong>Credit-transacties</strong>: als je credits koopt verwerken we de betaling via
                  een externe betalingsprovider (zie hieronder). Wij zien geen kaartgegevens — alleen het
                  bedrag en de transactiestatus.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Waar de data staat</h2>
              <p className="mt-2">
                Alle persoonsgegevens worden opgeslagen bij <strong>Supabase</strong> (EU-regio,
                AWS Frankfurt). De AI-renders worden gegenereerd door externe modellen (Google Gemini en/of
                Black Forest Labs FLUX) waarbij alleen de bron-foto en de prompt worden meegestuurd. Geen
                identificerende gegevens worden gedeeld met deze partijen.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Hoe lang we het bewaren</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Geüploade foto's en renders: <strong>12 maanden</strong>, daarna automatisch verwijderd.</li>
                <li>Offerte-data: <strong>5 jaar</strong> (wettelijke bewaarplicht voor zakelijke documenten).</li>
                <li>Wachtlijst e-mails: tot je je uitschrijft of we 'm wissen op verzoek.</li>
                <li>Credit-transacties: <strong>7 jaar</strong> (wettelijke bewaarplicht administratie).</li>
                <li>Plausible bezoekstatistieken: <strong>geaggregeerd onbeperkt</strong>, individueel niet herleidbaar.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Met wie we delen</h2>
              <p className="mt-2">
                Renisual verkoopt of verhuurt je gegevens niet. Wel gebruiken we deze verwerkers:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li><strong>Supabase</strong> — opslag van foto's, offertes, transacties (EU)</li>
                <li><strong>Plausible</strong> — anonieme analytics (EU)</li>
                <li><strong>Google Gemini / Black Forest Labs</strong> — AI-rendering van foto's</li>
                <li><strong>Betalingsprovider</strong> — verwerkt credit-aankopen (kaartgegevens komen nooit op onze servers)</li>
              </ul>
              <p className="mt-2">
                Met elk van deze partijen is een verwerkersovereenkomst van kracht.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Jouw rechten</h2>
              <p className="mt-2">Onder de AVG heb je het recht om:</p>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Inzage te krijgen in welke gegevens we van je hebben</li>
                <li>Onjuiste gegevens te corrigeren</li>
                <li>Je gegevens te laten verwijderen ("recht op vergetelheid")</li>
                <li>Je data te downloaden in een leesbaar formaat (dataportabiliteit)</li>
                <li>Bezwaar te maken tegen de verwerking</li>
                <li>Een klacht in te dienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl)</li>
              </ul>
              <p className="mt-2">
                Stuur een e-mail naar{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4 hover:text-accent">
                  {CONTACT_EMAIL}
                </a>{" "}
                en we reageren binnen 30 dagen.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Cookies</h2>
              <p className="mt-2">
                Renisual gebruikt alleen functionele opslag (localStorage) voor zaken als taalkeuze en je
                laatst-opgeslagen project. Geen tracking-cookies, geen advertising-cookies.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Wijzigingen</h2>
              <p className="mt-2">
                Als deze verklaring wezenlijk verandert dan zetten we dat bovenaan deze pagina. De laatst
                bijgewerkte datum staat altijd zichtbaar.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Contact</h2>
              <p className="mt-2">
                Vragen, verzoeken, klachten:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4 hover:text-accent">
                  {CONTACT_EMAIL}
                </a>
                . Of via WhatsApp via de groene knop rechtsonder op de site.
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
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">Contact</a>
          </div>
          <p className="text-xs text-stone-400">© 2026 Renisual</p>
        </div>
      </footer>
    </main>
  );
}
