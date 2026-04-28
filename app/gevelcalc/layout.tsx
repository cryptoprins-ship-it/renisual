import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Renisual GevelCalc",
  description: "Bereken gevelpanelen, profielen, openingen en prijs voor uw renovatieproject.",
};

export default function GevelCalcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
