"use client";

import { useProjectStore } from "@/lib/projectStore";
import { useLocale } from "@/lib/i18n";

/**
 * Small inline link in the top bar that clears the cross-page project
 * state (photo + selected product + calculation). The signed-URL photo
 * in Supabase Storage is also removed via the server-side delete route
 * since the anon key has no DELETE permission.
 *
 * Hidden when there's nothing to reset, so the bar stays clean for
 * first-time visitors.
 */
export default function ResetProjectButton() {
  const { t } = useLocale();
  const photoStoragePath = useProjectStore((s) => s.photoStoragePath);
  const selectedProduct = useProjectStore((s) => s.selectedProduct);

  if (!photoStoragePath && !selectedProduct) return null;

  const handleReset = async () => {
    const path = useProjectStore.getState().photoStoragePath;
    if (path) {
      try {
        await fetch("/api/photo/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
      } catch (err) {
        // Orphaned photo will be cleaned up by a later sweep job; not
        // fatal to the user-facing reset, so we swallow and continue.
        console.error("Failed to delete photo:", err);
      }
    }
    useProjectStore.getState().reset();
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      className="font-mono text-[11px] uppercase tracking-[0.15em] text-stone-500 transition-colors hover:text-ink"
    >
      {t("reset_project")}
    </button>
  );
}
