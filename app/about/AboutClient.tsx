"use client";

import Link from "next/link";
import NavLocaleSwitcher from "@/components/NavLocaleSwitcher";
import DynamicMetadata from "@/components/DynamicMetadata";
import { Logo } from "@/components/Logo";
import { useLocale } from "@/lib/i18n";

const PARAGRAPH_KEYS = [
  "about.p1",
  "about.p2",
  "about.p3",
  "about.p4",
  "about.p5",
  "about.p6",
  "about.p7",
  "about.p8",
];

export default function AboutClient() {
  const { locale, t } = useLocale();
  const showSubsidies = locale === "nl";

  return (
    <main className="min-h-[100dvh] bg-paper text-ink">
      <DynamicMetadata page="about" />

      {/* Slim architectural header — mirrors homepage */}
      <nav className="sticky top-0 z-30 h-16 border-b border-stone-200 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
          <Link href="/" className="font-display text-xl tracking-tight">
            Renisual
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.15em] text-stone-600 md:flex">
              <Link href="/gevelcalc" className="hover:text-ink transition-colors">
                {t("home.nav.calculator")}
              </Link>
              <Link href="/render" className="hover:text-ink transition-colors">
                {t("home.nav.render")}
              </Link>
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

      {/* Editorial hero — full-bleed image, bottom-left text overlay */}
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
            {t("about.eyebrow")}
          </p>
          <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-paper md:text-6xl lg:text-7xl">
            {t("about.title")}
          </h1>
        </div>
      </section>

      {/* Body — editorial prose, max-w-2xl, generous whitespace */}
      <section className="px-6 py-20 md:px-12 md:py-28 lg:px-20">
        <div className="mx-auto max-w-2xl space-y-8 text-lg leading-[1.7] text-stone-800">
          {PARAGRAPH_KEYS.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
        </div>
      </section>

      {/* CTA — architectural button matching homepage hero CTA, inverted for light bg */}
      <section className="border-t border-stone-200 px-6 py-20 md:px-12 md:py-28 lg:px-20">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/render"
            className="inline-block bg-ink px-7 py-4 font-mono text-xs uppercase tracking-[0.15em] text-paper transition-colors hover:bg-stone-800"
          >
            {t("about.cta.button")} →
          </Link>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-paper px-6 py-10 md:px-12 lg:px-20">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div>
            <Logo variant="horizontal" markSize={28} />
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
              {t("home.footer.tagline")}
            </p>
          </div>
          <div className="flex flex-wrap gap-6 font-mono text-xs uppercase tracking-[0.15em] text-stone-600">
            <Link href="/gevelcalc" className="hover:text-ink transition-colors">
              {t("home.nav.calculator")}
            </Link>
            <Link href="/render" className="hover:text-ink transition-colors">
              {t("home.nav.render")}
            </Link>
            {showSubsidies && (
              <Link href="/subsidie" className="hover:text-ink transition-colors">
                {t("home.nav.subsidies")}
              </Link>
            )}
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
            © 2026 Renisual
          </p>
        </div>
      </footer>
    </main>
  );
}
