import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Renisual GevelCalc",
  description: "Bereken gevelpanelen, profielen, openingen en prijs voor je renovatieproject.",
};

export default function GevelCalcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SiteNav (rendered inside the page itself) already includes the
  // NavLocaleSwitcher inline. Mounting another one here as a floating
  // fixed-position element gave users two flag pickers — the floating
  // one overlapped the inline one in the top-right and partially
  // covered the Renisual wordmark on small viewports.
  return <>{children}</>;
}
