"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import NavLocaleSwitcher from "@/components/NavLocaleSwitcher";

const SPONSOR_MAILTO =
  "mailto:info@renisual.com?subject=Sponsoring%20Renisual";

const ROADMAP_AVAILABLE: string[] = [
  "Gevelcalculator (Spanl, Keralit, Novicell, VinyPlus)",
  "AI Gevel Rendering via Gemini",
  "Kozijnen & deuren visualisatie",
  "ROI Calculator",
  "PDF export & offerte aanvragen",
  "Eenvoudige & professionele modus",
];

const ROADMAP_BINNENKORT: Array<{ heading: string; items: string[] }> = [
  {
    heading: "Exterieur",
    items: [
      "Gevelisolatie calculator",
      "Dakisolatie calculator",
      "Tuin & bestrating calculator",
      "Schutting & hekwerk",
      "Veranda & overkapping",
    ],
  },
  {
    heading: "Interieur per ruimte",
    items: ["Badkamer renovatie", "Keuken renovatie", "Woonkamer", "Slaapkamer"],
  },
  {
    heading: "Interieur per materiaal",
    items: ["Vloeren (parket, laminaat, tegels, PVC)", "Verf & behang", "Tegels", "Plafond"],
  },
];

export default function HomeClient() {
  const [calcHref, setCalcHref] = useState("/gevelcalc?modus=quick");
  const [proHref, setProHref] = useState("/gevelcalc?modus=pro");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile =
      window.matchMedia?.("(max-width: 768px)").matches ||
      /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    if (isMobile) {
      setCalcHref("/gevelcalc/mobile?modus=quick");
      setProHref("/gevelcalc/mobile?modus=pro");
    }
  }, []);

  const [waitEmail, setWaitEmail] = useState("");
  const [waitState, setWaitState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [waitError, setWaitError] = useState("");

  async function submitWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (waitState === "loading") return;
    setWaitState("loading");
    setWaitError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: waitEmail.trim(), topic: "Roadmap" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setWaitState("error");
        setWaitError(data.error ?? "Aanmelden mislukt.");
        return;
      }
      setWaitState("ok");
      setWaitEmail("");
    } catch {
      setWaitState("error");
      setWaitError("Aanmelden mislukt.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-black">
      <nav className="border-b border-black bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span className="text-xl font-bold tracking-tight">Renisual</span>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={calcHref} className="rounded-xl border border-black px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Calculator
            </Link>
            <Link href="/render" className="rounded-xl border border-black px-4 py-2 text-sm font-medium hover:bg-gray-50">
              AI Rendering
            </Link>
            <a href="#roi" className="rounded-xl border border-black px-4 py-2 text-sm font-medium hover:bg-gray-50">
              ROI
            </a>
            <Link href="/subsidie" className="rounded-xl border border-black px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Subsidies
            </Link>
            <a href="#offerte" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80">
              Offerte aanvragen
            </a>
            <NavLocaleSwitcher compact className="ml-1" />
          </div>
        </div>
      </nav>

      <section className="border-b border-black bg-white px-4 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black px-3 py-1 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Gratis te gebruiken
              </div>
              <h1 className="text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
                Renovatie
                <br />
                <span className="italic">slim berekend.</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-gray-600">
                Het complete platform voor huisrenovatie — exterieur én interieur.
                Upload een foto, kies een materiaal en zie direct hoe het eruitziet.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href={calcHref}
                  className="rounded-2xl bg-black px-6 py-3 text-base font-semibold text-white hover:opacity-80"
                >
                  Snelle berekening →
                </Link>
                <Link
                  href="/render"
                  className="rounded-2xl border-2 border-black bg-white px-6 py-3 text-base font-semibold hover:bg-gray-50"
                >
                  Bekijk AI rendering
                </Link>
              </div>
              <Link
                href={proHref}
                className="mt-4 inline-flex text-sm font-medium text-gray-700 underline underline-offset-4 hover:text-black"
              >
                Ben je aannemer? Open de professionele modus →
              </Link>

              <p className="mt-4 text-sm text-gray-400">
                Geen account nodig · Werkt op mobiel · Gratis PDF export
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/render"
                className="col-span-2 rounded-2xl border-2 border-black bg-[#f6f4ef] p-5 hover:bg-white"
              >
                <div className="mb-2 text-3xl">🏠</div>
                <div className="font-semibold">AI Rendering — Exterieur & Interieur</div>
                <div className="mt-1 text-sm text-gray-500">
                  Upload een foto en zie indicatief hoe materialen op jouw huis staan.
                </div>
              </Link>
              <Link
                href={calcHref}
                className="rounded-2xl border border-black bg-[#f6f4ef] p-4 hover:bg-white"
              >
                <div className="mb-2 text-2xl">📐</div>
                <div className="text-sm font-semibold">Calculator</div>
                <div className="mt-1 text-xs text-gray-500">
                  Materiaalkosten op basis van jouw gevelmaten.
                </div>
              </Link>
              <a
                href="#roi"
                className="rounded-2xl border border-black bg-[#f6f4ef] p-4 hover:bg-white"
              >
                <div className="mb-2 text-2xl">💰</div>
                <div className="text-sm font-semibold">ROI overzicht</div>
                <div className="mt-1 text-xs text-gray-500">
                  Wat levert renoveren gemiddeld op?
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-black px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">Zo werkt het</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload een foto",
                desc: "Maak een foto van je gevel en upload hem. Werkt met elke smartphone.",
                href: "/render",
                cta: "Probeer nu →",
              },
              {
                step: "02",
                title: "Kies een materiaal",
                desc: "Kies uit Spanl, Keralit en generieke materialen. Bekijk kleuren en afwerkingen.",
                href: "/render",
                cta: "Bekijk materialen →",
              },
              {
                step: "03",
                title: "Bereken & vraag offerte",
                desc: "Vul je gevelmaten in en bereken de materiaalkosten. Vraag daarna een offerte aan.",
                href: "#offerte",
                cta: "Offerte aanvragen →",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl border border-black bg-white p-6">
                <div className="text-5xl font-bold text-gray-100">{item.step}</div>
                <h3 className="mt-2 text-xl font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{item.desc}</p>
                <Link href={item.href} className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
                  {item.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-black bg-white px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="mb-8 text-center text-sm font-medium text-gray-500">
            Ondersteunde merken
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {["Spanl", "Keralit", "Generiek"].map((brand) => (
              <div
                key={brand}
                className="rounded-xl border border-black bg-[#f6f4ef] px-5 py-2.5 text-sm font-semibold"
              >
                {brand}
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            Meer merken (Novicell, VinyPlus, kozijnen) volgen.
          </p>
        </div>
      </section>

      <section className="border-b border-black px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-3xl font-bold">Alles wat je nodig hebt</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "🤖", title: "AI Rendering", desc: "Gemini AI vervangt je gevelbekleding op je eigen foto. Indicatief — geen 1-op-1 productfoto." },
              { icon: "📊", title: "Materiaalcalculator", desc: "Bereken panelen, profielen, snijverlies en totaalprijs incl. BTW." },
              { icon: "📄", title: "PDF export", desc: "Exporteer je berekening als PDF voor de aannemer of eigen administratie." },
              { icon: "💶", title: "ROI overzicht", desc: "Indicatie van de waarde-impact van gevelrenovatie." },
              { icon: "🎨", title: "Kozijnen & deuren", desc: "Verander ook kozijnen en deuren in de AI rendering. Hout, kunststof of aluminium." },
              { icon: "📱", title: "Werkt op mobiel", desc: "Gebruik de tool op locatie. Foto's direct via camera." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-black bg-white p-5">
                <div className="mb-3 text-2xl">{f.icon}</div>
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roi" className="border-b border-black bg-white px-4 py-16 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold">Wat levert renoveren op?</h2>
              <p className="mt-4 leading-relaxed text-gray-600">
                Niet elke renovatie is even rendabel als je wil verkopen. Gevelbekleding
                en dakisolatie scoren doorgaans hoger dan bijvoorbeeld een nieuwe keuken.
              </p>
              <p className="mt-3 leading-relaxed text-gray-600">
                Onderstaande percentages zijn een ruwe indicatie — het werkelijke
                rendement hangt af van locatie, woningtype en uitvoering.
              </p>
            </div>
            <div className="space-y-3">
              {[
                { label: "Dakisolatie", roi: 90, color: "bg-green-700", advies: "✓ Hoogste ROI van alle renovaties" },
                { label: "Gevelisolatie", roi: 85, color: "bg-green-600", advies: "✓ Beste ROI + ISDE subsidie" },
                { label: "Gevelbekleding", roi: 70, color: "bg-green-500", advies: "✓ Vaak rendabel bij verkoop" },
                { label: "Kozijnen", roi: 60, color: "bg-green-400", advies: "✓ Vaak rendabel bij verkoop" },
                { label: "Nieuwe keuken", roi: 40, color: "bg-amber-400", advies: "~ Soms rendabel" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-black bg-[#f6f4ef] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span className="text-sm font-bold">{item.roi}% ROI*</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200">
                    <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.roi}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{item.advies}</p>
                </div>
              ))}
              <p className="text-xs italic text-gray-500">
                * Indicatieve cijfers gebaseerd op marktgemiddelden in Nederland; werkelijke
                opbrengst varieert per woning en regio.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-800">
              💡 Combineer gevelbekleding met isolatie en profiteer van ISDE subsidie
              tot €30/m²
            </p>
            <Link
              href="/subsidie"
              className="mt-2 inline-block text-sm font-semibold text-green-800 underline underline-offset-4"
            >
              Bekijk alle subsidies →
            </Link>
          </div>
        </div>
      </section>

      <section id="roadmap" className="border-b border-black px-4 py-16 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold">Het complete renovatieplatform</h2>
          <p className="mt-3 max-w-3xl text-gray-600 leading-relaxed">
            Renisual groeit van gevelrenovatie naar het platform voor alle renovaties —
            exterieur én interieur.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-black bg-white p-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black px-3 py-1 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Beschikbaar nu
              </div>
              <ul className="space-y-2">
                {ROADMAP_AVAILABLE.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="font-bold text-green-600">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-black bg-white p-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black px-3 py-1 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Binnenkort
              </div>
              <div className="space-y-5">
                {ROADMAP_BINNENKORT.map((group) => (
                  <div key={group.heading}>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      {group.heading}
                    </h4>
                    <ul className="mt-2 space-y-2">
                      {group.items.map((item) => (
                        <li key={item} className="flex items-center justify-between gap-3 text-sm">
                          <span>{item}</span>
                          <a
                            href={SPONSOR_MAILTO}
                            className="shrink-0 rounded-full border border-amber-500 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                          >
                            Sponsor?
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-gray-500">
                Interesse in sponsoring?{" "}
                <a href={SPONSOR_MAILTO} className="font-medium underline underline-offset-2">
                  info@renisual.com
                </a>
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-black bg-white p-6">
            <h3 className="text-xl font-bold">Blijf op de hoogte</h3>
            <p className="mt-2 text-sm text-gray-600">
              Ontvang een melding als nieuwe modules beschikbaar komen.
            </p>
            <form
              onSubmit={submitWaitlist}
              className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch"
            >
              <input
                type="email"
                required
                placeholder="je@voorbeeld.nl"
                value={waitEmail}
                onChange={(e) => setWaitEmail(e.target.value)}
                disabled={waitState === "loading" || waitState === "ok"}
                className="min-h-[48px] flex-1 rounded-xl border border-black px-3 text-base disabled:bg-neutral-100"
              />
              <button
                type="submit"
                disabled={waitState === "loading" || waitState === "ok"}
                className="min-h-[48px] rounded-xl bg-black px-6 text-base font-semibold text-white hover:opacity-80 disabled:opacity-50"
              >
                {waitState === "loading" ? "Bezig…" : waitState === "ok" ? "Aangemeld ✓" : "Aanmelden"}
              </button>
            </form>
            {waitState === "ok" && (
              <p className="mt-3 text-sm font-medium text-green-700">
                Aanmelding ontvangen — bedankt!
              </p>
            )}
            {waitState === "error" && (
              <p className="mt-3 text-sm font-medium text-red-700">
                {waitError || "Aanmelden mislukt — probeer het later nog eens."}
              </p>
            )}
          </div>
        </div>
      </section>

      <section id="offerte" className="bg-black px-4 py-20 text-white scroll-mt-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Klaar om je gevel te vernieuwen?
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Bereken eerst je materiaal — daarna vraag je rechtstreeks een offerte aan.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href={calcHref}
              className="rounded-2xl bg-white px-8 py-4 text-base font-bold text-black hover:bg-gray-100"
            >
              Start berekening →
            </Link>
            <Link
              href="/render"
              className="rounded-2xl border-2 border-white px-8 py-4 text-base font-bold text-white hover:bg-white/10"
            >
              Bekijk AI rendering
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-500">
            Onderaan de calculator vind je het offerte-formulier — je gegevens worden
            rechtstreeks naar Renisual gemaild.
          </p>
        </div>
      </section>

      <footer className="border-t border-black bg-white px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-bold">Renisual</span>
            <p className="mt-1 text-xs text-gray-400">Het complete renovatieplatform voor Nederland.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href={calcHref} className="hover:underline">Calculator</Link>
            <Link href="/render" className="hover:underline">AI Rendering</Link>
            <a href="#roi" className="hover:underline">ROI</a>
            <Link href="/subsidie" className="hover:underline">Subsidies</Link>
            <a href="#roadmap" className="hover:underline">Roadmap</a>
            <a href="#offerte" className="hover:underline">Offerte</a>
          </div>
          <p className="text-xs text-gray-400">© 2026 Renisual</p>
        </div>
      </footer>
    </main>
  );
}
