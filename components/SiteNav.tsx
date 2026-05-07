"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import NavLocaleSwitcher from "./NavLocaleSwitcher";
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
  // /gevelcalc is responsive — modus=quick is the entry mode. The dead
  // /gevelcalc/mobile route 301-redirects here anyway, so we save a hop
  // by linking directly.
  const calcHref = "/gevelcalc?modus=quick";
  const pathname = usePathname() ?? "/";
  const isHome = pathname === "/";

  return (
    <nav className="sticky top-0 z-30 h-16 border-b border-stone-200 bg-paper/80 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
        <div className="flex items-center gap-2">
          {!isHome && (
            <Link
              href="/"
              aria-label="Home"
              className="inline-flex items-center gap-1 rounded-full border border-stone-300 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-600 transition-colors hover:bg-stone-100 hover:text-ink"
            >
              <span aria-hidden>←</span>
              {/* On narrow mobile viewports the "Home" word + the
                  Renisual logo + the right-side controls don't fit on
                  one row and the pill wrapped under the logo. Hide
                  the word on mobile, keep just the arrow as the back
                  affordance — same look-and-feel pattern across pages. */}
              <span className="hidden sm:inline">Home</span>
            </Link>
          )}
          <Link href="/" aria-label="Renisual home" className="inline-flex items-center">
            <Logo variant="horizontal" />
          </Link>
        </div>
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
