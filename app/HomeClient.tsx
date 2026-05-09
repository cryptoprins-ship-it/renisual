"use client";

import Link from "next/link";
import { useState } from "react";
import NavLocaleSwitcher from "@/components/NavLocaleSwitcher";
import DynamicMetadata from "@/components/DynamicMetadata";
import PwaInstallButton from "@/components/PwaInstallButton";
import { Logo } from "@/components/Logo";
import { useLocale } from "@/lib/i18n";

const SPONSOR_MAILTO =
  "mailto:info@renisual.com?subject=Sponsoring%20Renisual";

// Removed entries:
// - aiRender ("AI Gevel Rendering via Gemini") — implementation
//   detail, not a user-facing capability the homepage needs to brag
//   about. Render flow is its own /render entry; no need to call out
//   the model provider in the roadmap.
// - frames ("Kozijnen & deuren visualisatie") — feature was pulled
//   from v1 (too much klein-9b prompt drift); shouldn't claim it as
//   shipped until it lands again.
const ROADMAP_AVAILABLE_KEYS = [
  "home.roadmap.avail.calc",
  "home.roadmap.avail.roi",
  "home.roadmap.avail.pdf",
  "home.roadmap.avail.modes",
];

const ROADMAP_BINNENKORT_KEYS: Array<{ headingKey: string; itemKeys: string[] }> = [
  {
    headingKey: "home.roadmap.exterior",
    itemKeys: [
      "home.roadmap.ext.gevelIso",
      "home.roadmap.ext.dakIso",
      "home.roadmap.ext.garden",
      "home.roadmap.ext.fence",
      "home.roadmap.ext.veranda",
    ],
  },
  {
    headingKey: "home.roadmap.interiorRoom",
    itemKeys: [
      "home.roadmap.intRoom.bath",
      "home.roadmap.intRoom.kitchen",
      "home.roadmap.intRoom.living",
      "home.roadmap.intRoom.bed",
    ],
  },
  {
    headingKey: "home.roadmap.interiorMaterial",
    itemKeys: [
      "home.roadmap.intMat.floor",
      "home.roadmap.intMat.paint",
      "home.roadmap.intMat.tiles",
      "home.roadmap.intMat.ceiling",
    ],
  },
];

const ROI_BARS: Array<{ labelKey: string; adviceKey: string; roi: number; color: string }> = [
  { labelKey: "home.roi.bar.dak.label", adviceKey: "home.roi.bar.dak.advice", roi: 90, color: "bg-green-700" },
  { labelKey: "home.roi.bar.gevelIso.label", adviceKey: "home.roi.bar.gevelIso.advice", roi: 85, color: "bg-green-600" },
  { labelKey: "home.roi.bar.cladding.label", adviceKey: "home.roi.bar.cladding.advice", roi: 70, color: "bg-green-500" },
  { labelKey: "home.roi.bar.frames.label", adviceKey: "home.roi.bar.frames.advice", roi: 60, color: "bg-green-400" },
  { labelKey: "home.roi.bar.kitchen.label", adviceKey: "home.roi.bar.kitchen.advice", roi: 40, color: "bg-amber-400" },
];

const HOW_STEPS: Array<{ step: string; titleKey: string; descKey: string; href: string; ctaKey: string }> = [
  { step: "01", titleKey: "home.how.step1.title", descKey: "home.how.step1.desc", href: "/render", ctaKey: "home.how.step1.cta" },
  { step: "02", titleKey: "home.how.step2.title", descKey: "home.how.step2.desc", href: "/render", ctaKey: "home.how.step2.cta" },
];

const FEATURE_CARDS: Array<{ icon: string; titleKey: string; descKey: string }> = [
  { icon: "🤖", titleKey: "home.feature.ai.title", descKey: "home.feature.ai.desc" },
  { icon: "📊", titleKey: "home.feature.calc.title", descKey: "home.feature.calc.desc" },
  { icon: "📄", titleKey: "home.feature.pdf.title", descKey: "home.feature.pdf.desc" },
  { icon: "💶", titleKey: "home.feature.roi.title", descKey: "home.feature.roi.desc" },
  { icon: "🎨", titleKey: "home.feature.frames.title", descKey: "home.feature.frames.desc" },
  { icon: "📱", titleKey: "home.feature.mobile.title", descKey: "home.feature.mobile.desc" },
];

export default function HomeClient() {
  const { locale, t } = useLocale();
  const showSubsidies = locale === "nl";
  // Single calculator entry point. The /gevelcalc page renders responsively
  // on mobile and desktop, and the modus is now a state-toggle inside the
  // calculator — not a homepage choice.
  const calcHref = "/gevelcalc";

  const [waitEmail, setWaitEmail] = useState("");
  // Honeypot — invisible field that real users never fill. Bots that
  // populate every input land here and the server silently drops them.
  const [waitHoney, setWaitHoney] = useState("");
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
        body: JSON.stringify({ email: waitEmail.trim(), topic: "Roadmap", website: waitHoney }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setWaitState("error");
        setWaitError(data.error ?? t("home.waitlist.errorGeneric"));
        return;
      }
      setWaitState("ok");
      setWaitEmail("");
    } catch {
      setWaitState("error");
      setWaitError(t("home.waitlist.errorGeneric"));
    }
  }

  return (
    <main className="min-h-[100dvh] bg-paper text-ink">
      <DynamicMetadata page="home" />

      {/* Slim architectural header */}
      <nav className="sticky top-0 z-30 border-b border-stone-200 bg-paper/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
          <Link href="/" aria-label="Renisual home" className="inline-flex items-center">
            <Logo variant="horizontal" />
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.15em] text-stone-600 md:flex">
              <Link href="/render" className="hover:text-ink transition-colors">
                {t("home.nav.render")}
              </Link>
              <Link href={calcHref} className="hover:text-ink transition-colors">
                {t("home.nav.calculator")}
              </Link>
              <a href="#roi" className="hover:text-ink transition-colors">
                {t("home.nav.roi")}
              </a>
              {showSubsidies && (
                <Link href="/subsidie" className="hover:text-ink transition-colors">
                  {t("home.nav.subsidies")}
                </Link>
              )}
            </div>
            <NavLocaleSwitcher compact className="ml-1" />
          </div>
        </div>
      </nav>

      {/* Editorial hero — full-bleed image, bottom-left text */}
      <section className="relative h-[calc(100dvh-4rem)] min-h-[640px] w-full overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center brightness-90 contrast-105"
          style={{ backgroundImage: "url(/samples/houses/woning-2.jpg)" }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-ink/60 via-ink/30 to-transparent" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent" />

        <div className="relative z-10 mx-auto flex h-full max-w-[1400px] flex-col justify-end px-6 pb-16 md:px-12 md:pb-20 lg:px-20 lg:pb-24">
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-paper/80">
            {t("home.hero.eyebrow")}
          </p>
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-paper md:text-6xl lg:text-7xl">
            {t("home.hero.tagline")}
          </h1>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-paper/80 md:text-lg">
            {t("home.hero.subtitle")}
          </p>
          <div className="mt-10 flex flex-col items-start gap-3">
            <Link
              href="/render"
              className="bg-paper px-7 py-4 font-mono text-xs uppercase tracking-[0.15em] text-ink transition-colors hover:bg-stone-100"
            >
              {t("home.hero.cta")}
            </Link>
            <p className="font-mono text-[11px] tracking-[0.05em] text-paper/70">
              {t("home.hero.ctaHint")}
            </p>
            {/* Secondary path for users who only want a quick m² + price
                estimate without going through the render flow first. */}
            <Link
              href="/gevelcalc?modus=snel"
              className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-paper/80 underline underline-offset-4 transition-colors hover:text-paper"
            >
              {t("home.hero.ctaCalc")} →
            </Link>
          </div>
        </div>
      </section>

      {/* Two primary tools — visible architectural cards */}
      <section className="border-b border-stone-200 bg-paper px-6 py-20 md:px-12 md:py-28 lg:px-20">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-px bg-stone-200 md:grid-cols-2">
            <Link
              href="/render"
              className="group relative flex flex-col justify-between bg-paper p-8 transition-colors hover:bg-stone-50 md:p-12 lg:p-16"
            >
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
                  01 — {t("home.nav.render")}
                </p>
                <h2 className="mt-6 font-display text-4xl tracking-tight text-ink md:text-5xl lg:text-6xl">
                  {t("home.cards.render.title")}
                </h2>
                <p className="mt-5 max-w-md text-base leading-relaxed text-stone-600">
                  {t("home.cards.render.desc")}
                </p>
              </div>
              <div className="mt-12 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.15em] text-ink">
                <span>{t("home.hero.cta")}</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </Link>

            <Link
              href={calcHref}
              className="group relative flex flex-col justify-between bg-paper p-8 transition-colors hover:bg-stone-50 md:p-12 lg:p-16"
            >
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-600">
                  02 — {t("home.nav.calculator")}
                </p>
                <h2 className="mt-6 font-display text-4xl tracking-tight text-ink md:text-5xl lg:text-6xl">
                  {t("home.cards.calc.title")}
                </h2>
                <p className="mt-5 max-w-md text-base leading-relaxed text-stone-600">
                  {t("home.cards.calc.desc")}
                </p>
              </div>
              <div className="mt-12 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.15em] text-ink">
                <span>{t("home.hero.cta")}</span>
                <span aria-hidden className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </Link>
          </div>

          <div className="mx-auto mt-12 max-w-2xl">
            <PwaInstallButton />
          </div>
        </div>
      </section>

      <section className="border-b border-black px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-3xl font-bold">{t("home.how.heading")}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {HOW_STEPS.map((item) => (
              <div key={item.step} className="rounded-2xl border border-black bg-white p-6">
                <div className="text-5xl font-bold text-gray-100">{item.step}</div>
                <h3 className="mt-2 text-xl font-bold">{t(item.titleKey)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{t(item.descKey)}</p>
                <Link href={item.href} className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
                  {t(item.ctaKey)}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-black bg-white px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="mb-8 text-center text-sm font-medium text-gray-500">
            {t("home.brands.heading")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {["Spanl", "Keralit", t("home.brands.generic")].map((brand) => (
              <div
                key={brand}
                className="rounded-xl border border-black bg-[#f6f4ef] px-5 py-2.5 text-sm font-semibold"
              >
                {brand}
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-gray-400">
            {t("home.brands.more")}
          </p>
        </div>
      </section>

      <section className="border-b border-black px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-3xl font-bold">{t("home.features.heading")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURE_CARDS.map((f) => (
              <div key={f.titleKey} className="rounded-2xl border border-black bg-white p-5">
                <div className="mb-3 text-2xl">{f.icon}</div>
                <h3 className="font-bold">{t(f.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roi" className="border-b border-black bg-white px-4 py-16 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-3xl font-bold">{t("home.roi.heading")}</h2>
              <p className="mt-4 leading-relaxed text-gray-600">
                {t("home.roi.intro1")}
              </p>
              <p className="mt-3 leading-relaxed text-gray-600">
                {t("home.roi.intro2")}
              </p>
            </div>
            <div className="space-y-3">
              {ROI_BARS.map((item) => (
                <div key={item.labelKey} className="rounded-xl border border-black bg-[#f6f4ef] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{t(item.labelKey)}</span>
                    <span className="text-sm font-bold">{item.roi}% ROI*</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200">
                    <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${item.roi}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{t(item.adviceKey)}</p>
                </div>
              ))}
              <p className="text-xs italic text-gray-500">
                {t("home.roi.disclaimer")}
              </p>
            </div>
          </div>

          {showSubsidies && (
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
          )}
        </div>
      </section>

      <section id="roadmap" className="border-b border-black px-4 py-16 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold">{t("home.roadmap.heading")}</h2>
          <p className="mt-3 max-w-3xl text-gray-600 leading-relaxed">
            {t("home.roadmap.subtitle")}
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-black bg-white p-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black px-3 py-1 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {t("home.roadmap.available")}
              </div>
              <ul className="space-y-2">
                {ROADMAP_AVAILABLE_KEYS.map((key) => (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="font-bold text-green-600">✓</span>
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-black bg-white p-6">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black px-3 py-1 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {t("home.roadmap.soon")}
              </div>
              <div className="space-y-5">
                {ROADMAP_BINNENKORT_KEYS.map((group) => (
                  <div key={group.headingKey}>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      {t(group.headingKey)}
                    </h4>
                    <ul className="mt-2 space-y-2">
                      {group.itemKeys.map((itemKey) => (
                        <li key={itemKey} className="flex items-center justify-between gap-3 text-sm">
                          <span>{t(itemKey)}</span>
                          <a
                            href={SPONSOR_MAILTO}
                            className="shrink-0 rounded-full border border-amber-500 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100"
                          >
                            {t("home.roadmap.sponsor")}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-gray-500">
                {t("home.roadmap.sponsorPrompt")}{" "}
                <a href={SPONSOR_MAILTO} className="font-medium underline underline-offset-2">
                  info@renisual.com
                </a>
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-black bg-white p-6">
            <h3 className="text-xl font-bold">{t("home.waitlist.heading")}</h3>
            <p className="mt-2 text-sm text-gray-600">
              {t("home.waitlist.subtitle")}
            </p>
            <form
              onSubmit={submitWaitlist}
              className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch"
            >
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={waitHoney}
                onChange={(e) => setWaitHoney(e.target.value)}
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />
              <input
                type="email"
                required
                placeholder={t("home.waitlist.placeholder")}
                value={waitEmail}
                onChange={(e) => setWaitEmail(e.target.value)}
                disabled={waitState === "loading" || waitState === "ok"}
                className="min-h-[48px] flex-1 rounded-xl border border-black px-3 text-base disabled:bg-neutral-100"
                suppressHydrationWarning
              />
              <button
                type="submit"
                disabled={waitState === "loading" || waitState === "ok"}
                className="min-h-[48px] rounded-xl bg-black px-6 text-base font-semibold text-white hover:opacity-80 disabled:opacity-50"
              >
                {waitState === "loading"
                  ? t("home.waitlist.btnLoading")
                  : waitState === "ok"
                  ? t("home.waitlist.btnDone")
                  : t("home.waitlist.btnIdle")}
              </button>
            </form>
            {waitState === "ok" && (
              <p className="mt-3 text-sm font-medium text-green-700">
                {t("home.waitlist.success")}
              </p>
            )}
            {waitState === "error" && (
              <p className="mt-3 text-sm font-medium text-red-700">
                {waitError || t("home.waitlist.errorGeneric")}
              </p>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-black bg-white px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Logo variant="horizontal" markSize={28} />
            <p className="mt-1 text-xs text-gray-400">{t("home.footer.tagline")}</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/render" className="hover:underline">{t("home.nav.render")}</Link>
            <Link href={calcHref} className="hover:underline">{t("home.nav.calculator")}</Link>
            <a href="#roi" className="hover:underline">{t("home.nav.roi")}</a>
            {showSubsidies && <Link href="/subsidie" className="hover:underline">{t("home.nav.subsidies")}</Link>}
            <a href="#roadmap" className="hover:underline">{t("home.roadmap.soon")}</a>
          </div>
          <p className="text-xs text-gray-400">© 2026 Renisual</p>
        </div>
      </footer>
    </main>
  );
}
