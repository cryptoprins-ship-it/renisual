"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DynamicMetadata from "@/components/DynamicMetadata";
import { Logo } from "@/components/Logo";
import SiteNav from "@/components/SiteNav";

type IsdeIsolationKind = {
  id: string;
  label: string;
  ratePerM2: number;
  note?: string;
};

const ISDE_RATES: IsdeIsolationKind[] = [
  { id: "spouwmuur", label: "Spouwmuurisolatie", ratePerM2: 8 },
  { id: "vloer", label: "Vloerisolatie", ratePerM2: 7 },
  { id: "bodem", label: "Bodemisolatie", ratePerM2: 5 },
  { id: "dak-binnen", label: "Dakisolatie (van binnenuit)", ratePerM2: 23 },
  { id: "dak-buiten", label: "Dakisolatie (van buitenaf)", ratePerM2: 30 },
  { id: "gevel-binnen", label: "Gevelisolatie (van binnenuit)", ratePerM2: 30 },
  { id: "gevel-buiten", label: "Gevelisolatie (van buitenaf)", ratePerM2: 38 },
];

const SUBSIDIES = [
  {
    id: "isde",
    title: "ISDE — Investeringssubsidie Duurzame Energie",
    badge: "Tot €38/m²",
    badgeColor: "bg-green-100 text-green-800 border-green-300",
    description:
      "Subsidie voor spouwmuurisolatie, vloerisolatie, bodemisolatie, dakisolatie en gevelisolatie. Ook voor warmtepompen en zonneboilers.",
    link: "https://www.rvo.nl/subsidies-financiering/isde",
    linkLabel: "rvo.nl/isde",
  },
  {
    id: "svn",
    title: "Energiebespaarlening (SVn)",
    badge: "Lage rente",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
    description:
      "Lening met lage rente speciaal voor isolatie en verduurzamingsmaatregelen. Bedragen van €2.500 tot €65.000.",
    link: "https://www.svn.nl/energiebespaarlening",
    linkLabel: "svn.nl",
  },
  {
    id: "gemeente",
    title: "Gemeentelijke subsidies",
    badge: "Per gemeente",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
    description:
      "Veel gemeenten geven extra subsidie bovenop de landelijke regelingen. Bedragen en voorwaarden verschillen per gemeente.",
    link: "https://www.verbeterjehuis.nl/subsidies",
    linkLabel: "verbeterjehuis.nl",
  },
  {
    id: "warmtefonds",
    title: "Nationaal Warmtefonds",
    badge: "0% rente",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
    description:
      "0%-lening voor mensen met een lager inkomen. Geen rente over de leensom, terugbetaling vanuit besparing op de energierekening.",
    link: "https://www.nationaalwarmtefonds.nl",
    linkLabel: "nationaalwarmtefonds.nl",
  },
];

export default function SubsidieClient() {
  const [kindId, setKindId] = useState(ISDE_RATES[0].id);
  const [m2, setM2] = useState("");

  const result = useMemo(() => {
    const kind = ISDE_RATES.find((r) => r.id === kindId);
    if (!kind) return null;
    const area = Number(String(m2).replace(",", "."));
    if (!Number.isFinite(area) || area <= 0) return { kind, amount: 0 };
    return { kind, amount: Math.round(area * kind.ratePerM2) };
  }, [kindId, m2]);

  return (
    <main className="min-h-[100dvh] bg-paper text-ink">
      <DynamicMetadata page="subsidie" />
      <SiteNav />

      <header className="border-b border-black bg-white px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black px-3 py-1 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Bijgewerkt voor 2026
          </div>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Subsidies voor isolatie & renovatie 2026
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Bespaar duizenden euro&apos;s met deze regelingen.
          </p>
        </div>
      </header>

      <section className="border-b border-black px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-4">
          {SUBSIDIES.map((s) => (
            <article key={s.id} className="rounded-2xl border border-black bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-bold">{s.title}</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${s.badgeColor}`}>
                  {s.badge}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{s.description}</p>
              <a
                href={s.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold underline underline-offset-4"
              >
                {s.linkLabel} ↗
              </a>
            </article>
          ))}

          <section className="rounded-2xl border border-black bg-white p-6">
            <h2 className="text-xl font-bold mb-2">
              Gemeentelijke subsidies &amp; toewijzingen
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Naast de landelijke ISDE subsidie hebben veel gemeenten eigen
              subsidieregelingen voor isolatie en gevelrenovatie. Een
              gemeentelijke toewijzing is een officiële goedkeuring waarbij je
              gemeente bevestigt dat je woning in aanmerking komt voor extra
              subsidie.
            </p>

            <div className="grid gap-4 md:grid-cols-2 mb-6">
              <div className="rounded-xl border border-black bg-[#f6f4ef] p-4">
                <h3 className="font-semibold mb-2">Voorbeelden per gemeente</h3>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>🏙️ Amsterdam — tot €1.500 spouwmuurisolatie</li>
                  <li>🏙️ Rotterdam — gratis energieadvies + subsidie</li>
                  <li>🏙️ Den Haag — buurtaanpak hele straten</li>
                  <li>🏙️ Utrecht — isolatielening 0% rente</li>
                  <li>🏙️ Alle gemeenten — check je postcode</li>
                </ul>
              </div>
              <div className="rounded-xl border border-black bg-[#f6f4ef] p-4">
                <h3 className="font-semibold mb-2">Hoe werkt een toewijzing?</h3>
                <ol className="text-sm space-y-1 text-gray-700 list-decimal list-inside">
                  <li>Aanvraag indienen bij je gemeente</li>
                  <li>Gemeente keurt je woning goed</li>
                  <li>Je ontvangt een toewijzingsbrief</li>
                  <li>Werkzaamheden uitvoeren</li>
                  <li>Factuur opsturen → subsidie ontvangen</li>
                </ol>
              </div>
            </div>

            <div className="rounded-xl border-2 border-black bg-black text-white p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold">Controleer subsidies in je gemeente</p>
                <p className="text-sm text-gray-300 mt-1">
                  Vul je postcode in op verbeterjehuis.nl en zie direct welke
                  regelingen beschikbaar zijn.
                </p>
              </div>
              <a
                href="https://www.verbeterjehuis.nl/subsidies"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-white text-black px-5 py-2.5 text-sm font-semibold hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                Check je gemeente →
              </a>
            </div>

            <p className="mt-4 text-xs text-gray-400">
              Renisual helpt je bij het samenstellen van je aanvraagdossier.
              Gemeentelijk beleid wijzigt regelmatig — controleer altijd de
              actuele informatie via je gemeente of verbeterjehuis.nl.
            </p>
          </section>

        </div>
      </section>

      <section className="border-b border-black bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold">Bereken je subsidie</h2>
          <p className="mt-2 text-sm text-gray-600">
            Indicatieve berekening op basis van ISDE-tarieven 2026. Definitieve
            bedragen worden bepaald door RVO bij de aanvraag.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Type isolatie</span>
              <select
                className="min-h-[48px] w-full rounded-xl border border-black px-3 text-base"
                value={kindId}
                onChange={(e) => setKindId(e.target.value)}
              >
                {ISDE_RATES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} (€{r.ratePerM2}/m²)
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Aantal m²</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="bv. 80"
                value={m2}
                onChange={(e) => setM2(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-black px-3 text-base"
              />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border-2 border-black bg-[#f6f4ef] p-6">
            <p className="text-xs uppercase tracking-wide text-gray-500">Geschatte ISDE-subsidie</p>
            <p className="mt-1 text-3xl font-bold">
              {result && result.amount > 0
                ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(
                    result.amount
                  )
                : "—"}
            </p>
            {result && result.amount > 0 && (
              <p className="mt-2 text-xs text-gray-600">
                Op basis van {result.kind.label.toLowerCase()} × €{result.kind.ratePerM2}/m².
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/gevelcalc"
              className="rounded-2xl bg-black px-6 py-3 text-base font-semibold text-white hover:opacity-80"
            >
              Bereken volledige renovatiekosten →
            </Link>
            <a
              href="https://www.rvo.nl/subsidies-financiering/isde"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border-2 border-black bg-white px-6 py-3 text-base font-semibold hover:bg-gray-50"
            >
              ISDE-tarieven bij RVO ↗
            </a>
          </div>
        </div>
      </section>

      <section className="border-b border-black bg-[#f6f4ef] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-3xl border-2 border-black bg-white p-8 md:p-12">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-black px-3 py-1 text-xs font-medium">
                Aanvraagservice
              </span>
              <h2 className="mt-4 text-3xl font-bold md:text-4xl">
                Wij bereiden je subsidieaanvraag voor — jij dient in
              </h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-black bg-[#f6f4ef] p-5">
                <div className="text-2xl">📋</div>
                <h3 className="mt-2 font-bold">Compleet pakket</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Wij vullen alle formulieren in en leveren een kant-en-klaar
                  aanvraagpakket.
                </p>
              </div>
              <div className="rounded-2xl border border-black bg-[#f6f4ef] p-5">
                <div className="text-2xl">⚡</div>
                <h3 className="mt-2 font-bold">Je dient zelf in</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Met je DigiD via rvo.nl — duurt slechts 5 minuten.
                  Stap-voor-stap begeleiding inbegrepen.
                </p>
              </div>
              <div className="rounded-2xl border border-black bg-[#f6f4ef] p-5">
                <div className="text-2xl">💶</div>
                <h3 className="mt-2 font-bold">€25 vaste prijs</h3>
                <p className="mt-2 text-sm text-gray-700">
                  Eenmalig €25 voor het complete aanvraagpakket. Niet
                  tevreden = geld terug.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-bold">Hoe het werkt</h3>
              <ol className="mt-4 space-y-3">
                {[
                  "Je vraagt het aanvraagpakket aan (€25)",
                  "Wij stellen alle documenten op binnen 2 werkdagen",
                  "Je dient in via DigiD op rvo.nl (5 minuten)",
                  "RVO beoordeelt je aanvraag (6–8 weken)",
                  "Subsidie wordt uitbetaald op je rekening",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="pt-0.5 text-sm">
                      <strong>Stap {i + 1}:</strong> {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/contact?onderwerp=subsidie-aanvraagpakket"
                className="inline-block rounded-2xl bg-black px-8 py-4 text-base font-bold text-white hover:opacity-80"
              >
                Aanvraagpakket bestellen voor €25 →
              </Link>
            </div>

            <p className="mt-6 text-xs text-gray-500">
              Renisual stelt het aanvraagpakket op en begeleidt je bij de
              indiening. De aanvraag wordt door jou persoonlijk ingediend via
              DigiD op rvo.nl. Renisual is niet verantwoordelijk voor de
              uitkomst van de beoordeling door RVO.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-black bg-white px-4 py-8">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div>
            <Logo variant="horizontal" markSize={28} />
            <p className="mt-1 text-xs text-gray-400">Het complete renovatieplatform voor Nederland.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/render" className="hover:underline">Gevelvisualisatie</Link>
            <Link href="/gevelcalc" className="hover:underline">Calculator</Link>
            <Link href="/subsidie" className="hover:underline">Subsidies</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
