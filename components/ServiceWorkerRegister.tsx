"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

// Registers /sw.js, then watches for an installed-but-waiting service
// worker so we can prompt the user before activating it. Without this
// banner a deploy quietly stalls the PWA on the previously-cached
// bundles until the user manually closes every renisual tab/window —
// on iOS that means quitting the home-screen app, which most users
// don't think to do. Tapping "Update" posts SKIP_WAITING and reloads.
export default function ServiceWorkerRegister() {
  const { locale } = useLocale();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (cancelled) return;

        // SW already in waiting state at registration time — typical
        // when the user revisits after a deploy, the new SW installed
        // last visit but the old one was still controlling the page.
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaiting(registration.waiting);
        }

        // SW updates discovered during this session: listen for the
        // updatefound -> installing -> installed transition and surface
        // the prompt as soon as the new SW is ready to take over.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaiting(newWorker);
            }
          });
        });

        // When the active SW changes (because we just sent SKIP_WAITING),
        // reload so the page is served by the new SW + new bundles.
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(() => {
        /* registration failed — nothing actionable from the UI */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!waiting) return null;

  const copy =
    locale === "en"
      ? { title: "New version available", action: "Update now" }
      : locale === "de"
        ? { title: "Neue Version verfügbar", action: "Jetzt aktualisieren" }
        : locale === "fr"
          ? { title: "Nouvelle version disponible", action: "Mettre à jour" }
          : locale === "es"
            ? { title: "Nueva versión disponible", action: "Actualizar ahora" }
            : { title: "Nieuwe versie beschikbaar", action: "Update nu" };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      role="alert"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink">
          {copy.title}
        </p>
        <button
          type="button"
          onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
          className="rounded-xl bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-paper hover:bg-stone-800"
        >
          {copy.action}
        </button>
      </div>
    </div>
  );
}
