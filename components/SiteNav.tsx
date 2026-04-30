"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import NavLocaleSwitcher from "./NavLocaleSwitcher";
import { useLocale } from "@/lib/i18n";

/**
 * Sticky architectural site header — single source of truth for the top
 * bar across every page. The homepage used to inline this; subpages had
 * the floating HomeButton + LanguageSwitcher pair which clashed visually
 * with the editorial design system. Mount this once per page.
 */
export default function SiteNav() {
  const { locale, t } = useLocale();
  const showSubsidies = locale === "nl";
  const [calcHref, setCalcHref] = useState("/gevelcalc?modus=quick");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile =
      window.matchMedia?.("(max-width: 768px)").matches ||
      /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    if (isMobile) setCalcHref("/gevelcalc/mobile?modus=quick");
  }, []);

  return (
    <nav className="sticky top-0 z-30 h-16 border-b border-stone-200 bg-paper/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
        <Link href="/" className="font-display text-xl tracking-tight text-ink">
          Renisual
        </Link>
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.15em] text-stone-600 md:flex">
            <Link href={calcHref} className="transition-colors hover:text-ink">
              {t("home.nav.calculator")}
            </Link>
            <Link href="/render" className="transition-colors hover:text-ink">
              {t("home.nav.render")}
            </Link>
            {showSubsidies && (
              <Link href="/subsidie" className="transition-colors hover:text-ink">
                {t("home.nav.subsidies")}
              </Link>
            )}
            <Link href="/offerte" className="transition-colors hover:text-ink">
              {t("home.nav.offerte")}
            </Link>
          </div>
          <NavLocaleSwitcher compact className="ml-1" />
        </div>
      </div>
    </nav>
  );
}
