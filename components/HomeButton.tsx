"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HomeButton() {
  const path = usePathname() ?? "/";
  // Pages that mount <SiteNav> already provide a Renisual logo / home
  // link in the top bar. Suppress the floating button there to avoid
  // double "back to home" affordances.
  if (path === "/") return null;
  if (
    path.startsWith("/gevelcalc") ||
    path.startsWith("/render") ||
    path.startsWith("/offerte") ||
    path.startsWith("/subsidie") ||
    path.startsWith("/wachten")
  ) {
    return null;
  }
  return (
    <Link
      href="/"
      aria-label="Home"
      className="fixed left-3 top-3 z-40 inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm backdrop-blur hover:bg-zinc-100 print:hidden"
    >
      <span aria-hidden>←</span>
      <span>Home</span>
    </Link>
  );
}
