"use client";

import Link from "next/link";
import NavLocaleSwitcher from "@/components/NavLocaleSwitcher";
import DynamicMetadata from "@/components/DynamicMetadata";
import { Logo } from "@/components/Logo";
import { useLocale } from "@/lib/i18n";

const PARAGRAPH_KEYS = ["about.p1", "about.p2", "about.p3", "about.p4"];

export default function AboutClient() {
  const { locale, t } = useLocale();
  const showSubsidies = locale === "nl";

  return (
    <main className="flex min-h-[100dvh] flex-col bg-paper text-ink">
      <DynamicMetadata page="about" />

      <nav className="sticky top-0 z-30 border-b border-stone-200 bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
          <Link href="/" aria-label="Renisual home" className="inline-flex items-center">
            <Logo variant="horizontal" />
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

      <article className="flex-1 px-6 py-10 md:px-12 md:py-14 lg:px-20 lg:py-16">
        <div className="mx-auto max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
            {t("about.eyebrow")}
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
            {t("about.title")}
          </h1>
          <div className="mt-8 space-y-5 text-base leading-[1.7] text-stone-800 md:text-lg">
            {PARAGRAPH_KEYS.map((key) => (
              <p key={key}>{t(key)}</p>
            ))}
          </div>
          <p className="mt-8 font-display italic text-stone-700">
            {t("about.signature")}
          </p>
          <Link
            href="/render"
            className="mt-8 inline-block bg-ink px-7 py-4 font-mono text-xs uppercase tracking-[0.15em] text-paper transition-colors hover:bg-stone-800"
          >
            {t("about.cta.button")} →
          </Link>
        </div>
      </article>

      <footer className="border-t border-stone-200 bg-paper px-6 py-8 md:px-12 lg:px-20">
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
