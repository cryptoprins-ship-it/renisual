"use client";

import Link from "next/link";
import { useState } from "react";
import NavLocaleSwitcher from "./NavLocaleSwitcher";
import MobileLocaleToggle from "./MobileLocaleToggle";
import MobileNavSheet from "./MobileNavSheet";
import { Logo } from "./Logo";
import { useLocale } from "@/lib/i18n";

export default function SiteNav() {
  const { locale, t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const showSubsidies = locale === "nl";
  const calcHref = "/gevelcalc?modus=quick";

  return (
    <>
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
            <div className="hidden md:block">
              <NavLocaleSwitcher compact className="ml-1" />
            </div>
            <MobileLocaleToggle className="md:hidden" />
            <button
              type="button"
              aria-label={t("nav.menu.open") || "Menu openen"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-sheet"
              onClick={() => setMenuOpen((v) => !v)}
              className="relative -mr-2 flex h-11 w-11 items-center justify-center md:hidden"
            >
              <span className="sr-only">{t("nav.menu.open") || "Menu openen"}</span>
              <span aria-hidden className="flex flex-col gap-[5px]">
                <span className="block h-[2px] w-6 bg-ink" />
                <span className="block h-[2px] w-6 bg-ink" />
                <span className="block h-[2px] w-6 bg-ink" />
              </span>
            </button>
          </div>
        </div>
      </nav>
      <MobileNavSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
