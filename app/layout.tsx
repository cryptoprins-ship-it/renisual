import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import HomeButton from "@/components/HomeButton";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PwaInstallButton from "@/components/PwaInstallButton";
import WhatsAppButton from "@/components/WhatsAppButton";

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
  title: "Renisual — Zien is weten.",
  description: "Render je gevel, bereken je materiaal, vraag je offerte aan. Render, reken, renoveer.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Renisual — Zien is weten.",
    description: "Render, reken, renoveer. Upload een foto, kies een paneel, en zie je nieuwe gevel.",
    url: "https://renisual.com",
    siteName: "Renisual",
    locale: "nl_NL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Renisual — Zien is weten.",
    description: "Render, reken, renoveer.",
  },
  appleWebApp: {
    capable: true,
    title: "Renisual",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
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
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-[100dvh] flex flex-col bg-paper text-ink">
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
        {/* Mobile-only top banner; auto-hides for 7 days after dismiss
            and never shows once the app is already installed. */}
        <PwaInstallButton variant="floating" />
        <WhatsAppButton />
        {children}
      </body>
    </html>
  );
}
