"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NavLocaleSwitcher from "./NavLocaleSwitcher";
import ResetProjectButton from "./ResetProjectButton";
import { Logo } from "./Logo";
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
  const pathname = usePathname() ?? "/";
  const isHome = pathname === "/";

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
        <div className="flex items-center gap-3">
          {!isHome && (
            <Link
              href="/"
              aria-label="Home"
              className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-600 transition-colors hover:bg-stone-100 hover:text-ink"
            >
              <span aria-hidden>←</span>
              <span>Home</span>
            </Link>
          )}
          <Link href="/" aria-label="Renisual home" className="inline-flex items-center">
            <Logo variant="horizontal" />
          </Link>
        </div>
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
          </div>
          <ResetProjectButton />
          <NavLocaleSwitcher compact className="ml-1" />
        </div>
      </div>
    </nav>
  );
}
