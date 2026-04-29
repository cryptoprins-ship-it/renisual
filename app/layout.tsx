import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <LanguageSwitcher />
        {children}
      </body>
    </html>
  );
}
