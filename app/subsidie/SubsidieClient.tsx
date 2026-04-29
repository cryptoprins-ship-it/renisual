"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
    <main className="min-h-screen bg-[#f6f4ef] text-black">
      <nav className="border-b border-black bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Renisual
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/gevelcalc" className="rounded-xl border border-black px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Calculator
            </Link>
            <Link href="/render" className="rounded-xl border border-black px-4 py-2 text-sm font-medium hover:bg-gray-50">
              AI Rendering
            </Link>
            <Link href="/offerte" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80">
              Offerte aanvragen
            </Link>
          </div>
        </div>
      </nav>

      <header className="border-b border-black bg-white px-4 py-12 md:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black px-3 py-1 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Bijgewerkt voor 2026
          </div>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            Subsidies voor isolatie & renovatie
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

          <article className="rounded-2xl border border-dashed border-black bg-[#f6f4ef] p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-lg font-bold">Bonus: Saldering zonnepanelen</h2>
              <span className="rounded-full border border-yellow-300 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-800">
                Tip
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Wek je zelf stroom op? De salderingsregeling laat je opgewekte stroom
              wegstrepen tegen verbruikte stroom — een aanzienlijke verlaging van je
              energierekening.
            </p>
            <a
              href="https://www.rvo.nl/subsidies-financiering/saldering"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold underline underline-offset-4"
            >
              rvo.nl/saldering ↗
            </a>
          </article>
        </div>
      </section>

      <section className="border-b border-black bg-white px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold">Bereken uw subsidie</h2>
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

      <section className="bg-black px-4 py-16 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Vraag offerte aan inclusief subsidieadvies
          </h2>
          <p className="mt-3 text-gray-400">
            Onze partner-installateurs kennen de regionale regelingen en helpen je de
            aanvraag in te dienen.
          </p>
          <Link
            href="/offerte"
            className="mt-8 inline-block rounded-2xl bg-white px-8 py-4 text-base font-bold text-black hover:bg-gray-100"
          >
            Offerte aanvragen →
          </Link>
        </div>
      </section>

      <footer className="border-t border-black bg-white px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-bold">Renisual</span>
            <p className="mt-1 text-xs text-gray-400">Het complete renovatieplatform voor Nederland.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/gevelcalc" className="hover:underline">Calculator</Link>
            <Link href="/render" className="hover:underline">AI Rendering</Link>
            <Link href="/subsidie" className="hover:underline">Subsidies</Link>
            <Link href="/offerte" className="hover:underline">Offerte</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
