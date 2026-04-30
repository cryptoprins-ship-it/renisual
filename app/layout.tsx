import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import HomeButton from "@/components/HomeButton";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Renisual",
  description: "Renovation, facade calculation, and material visualisation tools.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Renisual",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  // Single-URL multilingual setup: language is decided client-side via IP
  // detection + localStorage, so each hreflang points at the same canonical
  // URL. Search engines will treat this as language-neutral with declared
  // alternates rather than as separate per-locale pages.
  alternates: {
    canonical: "https://renisual.com",
    languages: {
      nl: "https://renisual.com",
      en: "https://renisual.com",
      de: "https://renisual.com",
      fr: "https://renisual.com",
      es: "https://renisual.com",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {/* Plausible analytics — cookieless, no PII, GDPR-exempt by
            design. Mirrors the BrainArena setup so both sites report
            into the same Plausible account. */}
        <Script
          defer
          data-domain="renisual.com"
          src="https://plausible.io/js/script.js"
          strategy="afterInteractive"
        />
        <ServiceWorkerRegister />
        <HomeButton />
        <LanguageSwitcher />
        {children}
      </body>
    </html>
  );
}
