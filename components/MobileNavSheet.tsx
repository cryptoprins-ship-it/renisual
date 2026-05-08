"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavLocaleSwitcher from "./NavLocaleSwitcher";
import PwaInstallButton from "./PwaInstallButton";
import { useLocale } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MobileNavSheet({ open, onClose }: Props) {
  const { locale, t } = useLocale();
  const showSubsidies = locale === "nl";
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);
  const pathname = usePathname();

  // Close on route change.
  useEffect(() => {
    if (open) onClose();
    // We deliberately depend only on pathname — this fires when the user
    // navigates inside the sheet, which is exactly the close trigger we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on Escape key.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Move focus to the first link on open.
  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const linkClass =
    "block border-b border-stone-200 px-6 py-4 font-mono text-sm uppercase tracking-[0.15em] text-ink hover:bg-stone-50 focus-visible:bg-stone-50 motion-safe:transition-colors";

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("nav.menu.close") || "Menu sluiten"}
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/30 motion-safe:animate-[fadeIn_120ms_ease-out] md:hidden"
      />
      {/* Sheet */}
      <nav
        id="mobile-nav-sheet"
        aria-label={t("nav.menu.label") || "Hoofdmenu"}
        className="fixed left-0 right-0 top-[calc(4rem+env(safe-area-inset-top))] z-30 border-b border-ink bg-paper motion-safe:animate-[slideDown_150ms_ease-out] md:hidden"
      >
        <Link
          href="/render"
          ref={firstLinkRef}
          className={linkClass}
          onClick={onClose}
        >
          {t("home.nav.render")}
        </Link>
        <Link
          href="/gevelcalc?modus=quick"
          className={linkClass}
          onClick={onClose}
        >
          {t("home.nav.calculator")}
        </Link>
        {showSubsidies && (
          <Link href="/subsidie" className={linkClass} onClick={onClose}>
            {t("home.nav.subsidies")}
          </Link>
        )}
        <div className="border-b border-stone-200 px-6 py-4">
          <NavLocaleSwitcher />
        </div>
        <div className="px-6 py-4">
          <PwaInstallButton variant="card" />
        </div>
      </nav>
    </>
  );
}
