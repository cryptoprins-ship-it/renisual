"use client";

import { usePathname } from "next/navigation";
import NavLocaleSwitcher from "./NavLocaleSwitcher";

/**
 * Globally-mounted floating language switcher. Pages that render their own
 * inline switcher (homepage nav, gevelcalc shell) hide this one to avoid
 * showing two pickers at once.
 */
export default function LanguageSwitcher() {
  const path = usePathname() ?? "/";
  const hasInline = path === "/" || path.startsWith("/gevelcalc");
  if (hasInline) return null;
  return (
    <div className="fixed right-3 top-3 z-40 print:hidden">
      <NavLocaleSwitcher />
    </div>
  );
}
