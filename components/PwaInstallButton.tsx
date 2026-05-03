"use client";

import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "desktop" | "unknown";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari standalone flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PwaInstallButton() {
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSheet, setShowIosSheet] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (installed) return null;
  if (platform === "unknown") return null;

  const onAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      <div className="my-6 rounded-lg border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <rect x="6" y="2" width="12" height="20" rx="2" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Installeer Renisual als app
            </h3>
            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
              Open zonder browser, sneller starten, eigen icoon op je beginscherm.
            </p>
            {platform === "android" && deferredPrompt && (
              <button
                onClick={onAndroidInstall}
                className="mt-3 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                App installeren
              </button>
            )}
            {platform === "android" && !deferredPrompt && (
              <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">
                Open menu (⋮) → <strong>App installeren</strong> of <strong>Toevoegen aan startscherm</strong>.
              </p>
            )}
            {platform === "ios" && (
              <button
                onClick={() => setShowIosSheet(true)}
                className="mt-3 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                Toon instructies
              </button>
            )}
            {platform === "desktop" && (
              <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">
                Open <code className="rounded bg-stone-200 px-1 py-0.5 text-[11px] dark:bg-stone-800">renisual.com</code> op je telefoon om als app te installeren.
              </p>
            )}
          </div>
        </div>
      </div>

      {showIosSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowIosSheet(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold text-stone-900 dark:text-stone-100">
              Installeren op iPhone / iPad
            </h3>
            <ol className="space-y-3 text-sm text-stone-700 dark:text-stone-300">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-900">1</span>
                <span>Tap op de <strong>deel-knop</strong> onderin Safari (vierkantje met pijl ↑).</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-900">2</span>
                <span>Scroll omlaag en tap <strong>&laquo;Zet op beginscherm&raquo;</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-900">3</span>
                <span>Tap <strong>&laquo;Voeg toe&raquo;</strong> rechtsbovenin.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-medium text-white dark:bg-stone-100 dark:text-stone-900">4</span>
                <span>Het Renisual-icoon staat nu op je beginscherm. Open vanaf daar — opent zonder browser.</span>
              </li>
            </ol>
            <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">
              Lukt het niet? Zorg dat je in <strong>Safari</strong> bent (niet Chrome of in-app browser zoals Instagram).
            </p>
            <button
              onClick={() => setShowIosSheet(false)}
              className="mt-4 w-full rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              Sluiten
            </button>
          </div>
        </div>
      )}
    </>
  );
}
