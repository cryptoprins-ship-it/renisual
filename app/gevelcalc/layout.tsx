import type { Metadata } from "next";
import NavLocaleSwitcher from "@/components/NavLocaleSwitcher";

export const metadata: Metadata = {
  title: "Renisual GevelCalc",
  description: "Bereken gevelpanelen, profielen, openingen en prijs voor je renovatieproject.",
};

export default function GevelCalcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed right-3 top-3 z-40 print:hidden">
        <NavLocaleSwitcher />
      </div>
      {children}
    </>
  );
}
