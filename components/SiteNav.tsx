"use client";

import Link from "next/link";
import NavLocaleSwitcher from "./NavLocaleSwitcher";
import { Logo } from "./Logo";
import { useLocale } from "@/lib/i18n";

/**
 * Sticky architectural site header — single source of truth for the top
 * bar across every page. Same look-and-feel as the homepage nav: just
 * the Renisual logo on the left, locale switcher on the right. The Home
 * back-affordance lives ABOVE the page H1 inside each subpage, not in
 * the top bar — keeps the top bar consistent across home/subpages and
 * gives the back-link contextual placement next to the page heading.
 */
export default function SiteNav() {
  const { locale, t } = useLocale();
  const showSubsidies = locale === "nl";
  const calcHref = "/gevelcalc?modus=quick";

  return (
    <nav className="sticky top-0 z-30 border-b border-stone-200 bg-paper/80 backdrop-blur-md print:hidden pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
        <Link href="/" aria-label="Renisual home" className="inline-flex items-center">
          <Logo variant="horizontal" />
        </Link>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.15em] text-stone-600 md:flex">
            <Link href="/render" className="transition-colors hover:text-ink">
              {t("home.nav.render")}
            </Link>
            <Link href={calcHref} className="transition-colors hover:text-ink">
              {t("home.nav.calculator")}
            </Link>
            {showSubsidies && (
              <Link href="/subsidie" className="transition-colors hover:text-ink">
                {t("home.nav.subsidies")}
              </Link>
            )}
          </div>
          <NavLocaleSwitcher compact className="ml-1" />
        </div>
      </div>
    </nav>
  );
}
