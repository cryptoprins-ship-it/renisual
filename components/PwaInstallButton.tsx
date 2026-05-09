"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

// Two surfaces:
//   variant="card"     – inline card (homepage hero / explainer area).
//                        Always visible to mobile users until installed.
//   variant="floating" – small floating pill at the bottom-right on
//                        mobile only, dismissable. Stays hidden for 7 days
//                        after dismiss via localStorage.

type Platform = "ios" | "android" | "desktop" | "unknown";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "renisual-pwa-dismissed-at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  // iPadOS 13+ identifies as Mac with touch — pick that up too so the
  // iOS install instructions still appear on modern iPads.
  const isIpadOS =
    /macintosh/.test(ua) && typeof navigator !== "undefined" &&
    (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1;
  if (/iphone|ipad|ipod/.test(ua) || isIpadOS) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function recentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

type Props = { variant?: "card" | "floating" };

export default function PwaInstallButton({ variant = "card" }: Props) {
  const { t } = useLocale();
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [installed, setInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setDismissed(recentlyDismissed());

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
  // Floating banner is mobile-only. The card variant still renders a
  // helpful "open on phone" message on desktop.
  if (variant === "floating" && platform === "desktop") return null;
  if (variant === "floating" && dismissed) return null;

  const onAndroidInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const dismiss = () => {
    markDismissed();
    setDismissed(true);
  };

  if (variant === "floating") {
    // Top-positioned so it never collides with fixed bottom action bars
    // (e.g. /gevelcalc). Mobile-only — md and up still has the card.
    return (
      <>
        <div className="fixed inset-x-3 top-[calc(4rem+0.5rem+env(safe-area-inset-top))] z-40 mx-auto max-w-md rounded-2xl border border-stone-300 bg-paper/95 shadow-lg backdrop-blur print:hidden md:hidden">
          <div className="flex items-center gap-3 p-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink text-paper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
                <rect x="6" y="2" width="12" height="20" rx="2" />
                <line x1="11" y1="18" x2="13" y2="18" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                {t("pwa.banner.eyebrow")}
              </p>
              <p className="truncate text-sm text-ink">{t("pwa.banner.title")}</p>
            </div>
            {platform === "android" && deferredPrompt && (
              <button
                type="button"
                onClick={onAndroidInstall}
                className="flex-shrink-0 rounded-full bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-paper hover:bg-stone-800"
              >
                {t("pwa.cta.install")}
              </button>
            )}
            {platform === "android" && !deferredPrompt && (
              <button
                type="button"
                onClick={() => setShowIosSheet(false)}
                className="flex-shrink-0 rounded-full border border-stone-300 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-stone-600"
                disabled
                aria-label={t("pwa.android.menuHint")}
                title={t("pwa.android.menuHint")}
              >
                ⋮
              </button>
            )}
            {platform === "ios" && (
              <button
                type="button"
                onClick={() => setShowIosSheet(true)}
                className="flex-shrink-0 rounded-full bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-paper hover:bg-stone-800"
              >
                {t("pwa.cta.how")}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("pwa.dismiss")}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>
        {showIosSheet && <IosInstructionsSheet onClose={() => setShowIosSheet(false)} t={t} />}
      </>
    );
  }

  // variant === "card"
  return (
    <>
      <div className="my-6 rounded-lg border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-stone-900 text-paper dark:bg-stone-100 dark:text-stone-900">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
              <rect x="6" y="2" width="12" height="20" rx="2" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t("pwa.card.title")}
            </h3>
            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400">
              {t("pwa.card.subtitle")}
            </p>
            {platform === "android" && deferredPrompt && (
              <button
                onClick={onAndroidInstall}
                className="mt-3 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-paper hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                {t("pwa.cta.install")}
              </button>
            )}
            {platform === "android" && !deferredPrompt && (
              <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">
                {t("pwa.android.menuHint")}
              </p>
            )}
            {platform === "ios" && (
              <button
                onClick={() => setShowIosSheet(true)}
                className="mt-3 rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-paper hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                {t("pwa.cta.how")}
              </button>
            )}
            {platform === "desktop" && (
              <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">
                {t("pwa.desktop.hint")}
              </p>
            )}
          </div>
        </div>
      </div>

      {showIosSheet && <IosInstructionsSheet onClose={() => setShowIosSheet(false)} t={t} />}
    </>
  );
}

function IosInstructionsSheet({
  onClose,
  t,
}: {
  onClose: () => void;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-semibold text-stone-900 dark:text-stone-100">
          {t("pwa.ios.heading")}
        </h3>
        <ol className="space-y-3 text-sm text-stone-700 dark:text-stone-300">
          {[1, 2, 3, 4].map((n) => (
            <li key={n} className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-medium text-paper dark:bg-stone-100 dark:text-stone-900">
                {n}
              </span>
              <span dangerouslySetInnerHTML={{ __html: t(`pwa.ios.step${n}`) }} />
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">
          {t("pwa.ios.troubleshoot")}
        </p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-paper hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          {t("pwa.close")}
        </button>
      </div>
    </div>
  );
}
