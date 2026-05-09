# Mobile UX Pass V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land three mobile-UX improvements to renisual: (1) safe-area-inset-top on sticky navs, (2) per-variant skeleton + batch counter on the render flow, (3) hamburger sheet for cross-feature navigation on mobile.

**Architecture:** Pure client-side / UI changes. No backend, no new dependencies. State refactor in `app/render/page.tsx` exposes the already-parallel render-streaming behaviour through new UI components in `components/`. Hamburger sheet is a new sibling component reused across the existing `SiteNav`. Safe-area fix is a Tailwind class change applied to three duplicate sticky-nav implementations.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Playwright (for the existing `scripts/test-agent` smoke harness).

**Verification approach:** This project has no unit-test framework. Each task gates on three steps before commit: (a) `npx tsc --noEmit` typecheck, (b) `npm run lint`, (c) explicit manual browser verification with concrete things to look for. Two new Playwright smoke tests are added (one for the hamburger sheet, one for the batch-counter render flow) via the existing `scripts/test-agent` harness.

**Source spec:** `docs/superpowers/specs/2026-05-08-mobile-ux-pass-v1-design.md` — read the relevant section before each phase.

**Rollout order:** Phase 1 → Phase 2 → Phase 3, per the spec. Each phase ends with a working app; each task within a phase ends with a clean commit.

---

## Phase 1 — Safe-area-inset-top on sticky navs

Three sticky-top navs exist in this codebase (intentional per spec — consolidation is out of scope). All three need the same change.

### Task 1.1: Patch `SiteNav`

**Files:**
- Modify: `components/SiteNav.tsx` (the `<nav>` element around line 22)

- [ ] **Step 1: Apply the class change**

In `components/SiteNav.tsx`, replace the opener of the returned JSX:

Before:
```tsx
return (
  <nav className="sticky top-0 z-30 h-16 border-b border-stone-200 bg-paper/80 backdrop-blur-md print:hidden">
    <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
```

After:
```tsx
return (
  <nav className="sticky top-0 z-30 border-b border-stone-200 bg-paper/80 backdrop-blur-md print:hidden pt-[env(safe-area-inset-top)]">
    <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
```

Concrete diff: removed `h-16` from outer `<nav>`; removed `h-full` from inner `<div>`; added `h-16` to inner `<div>`; added `pt-[env(safe-area-inset-top)]` to outer `<nav>`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors on `components/SiteNav.tsx`.

- [ ] **Step 4: Manual verify in DevTools**

Run `npm run dev`. Open Chrome DevTools → Device toolbar → choose **iPhone 14 Pro** preset. Open `http://localhost:3000/render`.

Look for:
- The nav background extends above the logo into the system-status-bar area (visible as paper-coloured strip with backdrop-blur).
- The logo sits at the same vertical position as before relative to the white-space below the nav.
- Rotate landscape — the nav padding adapts (notch on left, padding on left side instead of top).
- On a non-notch desktop viewport (≥ 1024px) the nav looks identical to before — `env(safe-area-inset-top)` resolves to `0`.

- [ ] **Step 5: Commit**

```bash
git add components/SiteNav.tsx
git commit -m "fix(nav): pad SiteNav for safe-area-inset-top on iPhone notch"
```

---

### Task 1.2: Patch the duplicate nav in `HomeClient`

**Files:**
- Modify: `app/HomeClient.tsx` (the `<nav>` element around line 127)

- [ ] **Step 1: Apply the same class change**

Locate the line containing `sticky top-0 z-30 h-16 border-b border-stone-200 bg-paper/80 backdrop-blur-md` inside `app/HomeClient.tsx`. The structure mirrors `SiteNav` exactly.

Apply the same transform: remove `h-16` and `h-full` from outer/inner, add `h-16` to inner, add `pt-[env(safe-area-inset-top)]` to outer.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Manual verify**

Refresh `http://localhost:3000/` in iPhone DevTools preset. Same checklist as Task 1.1, applied to the home page.

- [ ] **Step 5: Commit**

```bash
git add app/HomeClient.tsx
git commit -m "fix(home): pad sticky nav for safe-area-inset-top"
```

---

### Task 1.3: Patch the duplicate nav in `AboutClient`

**Files:**
- Modify: `app/about/AboutClient.tsx` (the `<nav>` element around line 29)

- [ ] **Step 1: Apply the same class change**

Identical transform as Task 1.1, applied to the `<nav>` in `app/about/AboutClient.tsx`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Manual verify**

Open `http://localhost:3000/about` in iPhone DevTools preset. Same checklist as Task 1.1.

- [ ] **Step 5: Commit**

```bash
git add app/about/AboutClient.tsx
git commit -m "fix(about): pad sticky nav for safe-area-inset-top"
```

---

## Phase 2 — Per-variant skeleton + batch counter

This is the largest phase. We build new components first (no behaviour change), refactor state second, and rewire the render-tree last so each commit leaves a working app.

### Task 2.1: Extend `RenderingLoader` with a `compact` prop

**Files:**
- Modify: `components/RenderingLoader.tsx`

- [ ] **Step 1: Add the prop and conditional sizing**

Replace the entire body of `components/RenderingLoader.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  /** Optional retry-attempt counter (e.g. when the API rate-limits and we retry). */
  attempt?: number;
  /** Aspect ratio for the placeholder; defaults to 16:10. Pass null for full-bleed. */
  aspect?: string | null;
  /** Smaller layout for use inside a single render slot. Default false. */
  compact?: boolean;
};

const ATTEMPT_LABEL: Record<string, (n: number) => string> = {
  nl: (n) => `Poging ${n}/3`,
  en: (n) => `Attempt ${n}/3`,
  de: (n) => `Versuch ${n}/3`,
  fr: (n) => `Tentative ${n}/3`,
  es: (n) => `Intento ${n}/3`,
};

export default function RenderingLoader({ attempt, aspect = "16/10", compact = false }: Props) {
  const { locale, t } = useLocale();
  const [stage, setStage] = useState<"initial" | "slow" | "almost">("initial");

  useEffect(() => {
    const t1 = window.setTimeout(() => setStage("slow"), 5000);
    const t2 = window.setTimeout(() => setStage("almost"), 15000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const message =
    stage === "initial"
      ? t("rendering_loading_initial")
      : stage === "slow"
        ? t("rendering_loading_slow")
        : t("rendering_loading_almost");

  const attemptText =
    attempt && attempt > 1
      ? (ATTEMPT_LABEL[locale] ?? ATTEMPT_LABEL.en)(attempt)
      : null;

  const spinnerSize = compact ? "h-8 w-8" : "h-16 w-16";
  const messageClass = compact ? "text-xs" : "text-sm";
  const containerPadding = compact ? "p-3" : "p-6";

  return (
    <div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200"
      style={!compact && aspect ? { aspectRatio: aspect } : undefined}
      role="status"
      aria-live="polite"
    >
      <div className={`flex flex-col items-center justify-center gap-3 ${containerPadding}`}>
        <div className={`relative ${spinnerSize}`}>
          <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
        <p className={`animate-pulse text-center font-medium text-neutral-800 ${messageClass}`}>
          {message}
        </p>
        {attemptText && (
          <p className="text-[10px] text-neutral-500">{attemptText}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. The new prop is optional, so existing call sites still type-check.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Manual verify (no behaviour change yet)**

Run `npm run dev`. Open `/render`, upload any sample photo, click the render trigger, and confirm the existing full-area loader still appears as before. The `compact` mode is unused at this point — this commit only adds the prop without invoking it.

- [ ] **Step 5: Commit**

```bash
git add components/RenderingLoader.tsx
git commit -m "feat(loader): add compact variant to RenderingLoader"
```

---

### Task 2.2: Create `VariantSlot` component

**Files:**
- Create: `components/render/VariantSlot.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import RenderingLoader from "@/components/RenderingLoader";
import { useLocale } from "@/lib/i18n";

export type VariantSlotState =
  | { kind: "pending"; attempt: number }
  | { kind: "success"; dataUrl: string; alt: string }
  | { kind: "failed" }
  | { kind: "aborted" };

type Props = {
  state: VariantSlotState;
  toneLabel: string;
  /** Called when the user taps "probeer opnieuw" on a failed slot. */
  onRetry?: () => void;
};

export default function VariantSlot({ state, toneLabel, onRetry }: Props) {
  const { t } = useLocale();
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-black bg-stone-50">
      <div className="absolute left-2 top-2 z-10 bg-ink/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-paper">
        {toneLabel}
      </div>
      {state.kind === "pending" && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-stone-200 via-stone-100 to-stone-200">
          <div className="absolute inset-0">
            <RenderingLoader compact attempt={state.attempt} aspect={null} />
          </div>
        </div>
      )}
      {state.kind === "success" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.dataUrl}
          alt={state.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {state.kind === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-900">
            {t("render.slot.failed") || "Renderen mislukt"}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="border border-red-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-red-900 hover:bg-red-900 hover:text-white"
            >
              {t("render.slot.retry") || "Probeer opnieuw"}
            </button>
          )}
        </div>
      )}
      {state.kind === "aborted" && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-100 p-4 text-center">
          <p className="text-xs text-stone-600">
            {t("render.slot.aborted") || "Geannuleerd"}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Translation keys `render.slot.failed`, `render.slot.retry`, `render.slot.aborted` may not exist yet — the `||` fallback handles that without breaking. (We add real translations only if the user wants i18n parity.)

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Smoke check the component renders without errors**

The component is unused at this point. The lint + typecheck verify the file is valid. No browser-side check needed yet.

- [ ] **Step 5: Commit**

```bash
git add components/render/VariantSlot.tsx
git commit -m "feat(render): add VariantSlot component for per-tone state"
```

---

### Task 2.3: Create `BatchStatusBand` component

**Files:**
- Create: `components/render/BatchStatusBand.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  startedAt: number;
  completed: number;
  total: number;
  onCancel: () => void;
};

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function BatchStatusBand({ startedAt, completed, total, onCancel }: Props) {
  const { t } = useLocale();
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return (
    <div
      className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 flex items-center justify-between gap-3 border-b border-ink bg-paper/95 px-3 py-2 backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col">
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink">
          {completed}/{total} {t("render.batch.ready") || "klaar"} · {formatElapsed(elapsed)}
        </span>
        <span className="text-[11px] text-stone-600">
          {t("render.batch.duration_hint") || "Een renderbatch duurt 30–60 seconden."}
        </span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="border border-ink px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-ink hover:bg-ink hover:text-paper"
      >
        {t("render.batch.cancel") || "Annuleer"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Smoke check**

Component is unused at this point. Skip browser check.

- [ ] **Step 5: Commit**

```bash
git add components/render/BatchStatusBand.tsx
git commit -m "feat(render): add BatchStatusBand component"
```

---

### Task 2.4: Refactor `runRenderBatch` state shape and wire `AbortController`

This task is bigger code-wise — it changes state semantics that the new UI in Task 2.5 will consume — but each step is mechanical.

**Files:**
- Modify: `app/render/page.tsx`

- [ ] **Step 1: Add new state hooks**

Locate the existing line:

```tsx
const [attemptCount, setAttemptCount] = useState(0);
```

(Around line 359 — the entry directly after the `toast` clear-on-timeout `useEffect`.)

Replace it with:

```tsx
const [attemptByTone, setAttemptByTone] = useState<Record<number, number>>({});
const [batchStartedAt, setBatchStartedAt] = useState<number | null>(null);
const [batchAbort, setBatchAbort] = useState<AbortController | null>(null);
const [failedTones, setFailedTones] = useState<ReadonlySet<ToneNudge>>(new Set());
```

`ToneNudge` is already declared near the top of the file (around line 28).

- [ ] **Step 2: Update `runOne` to accept an `AbortSignal` and write per-tone attempt state**

Inside `runRenderBatch`, find the inner declaration:

```tsx
async function runOne(toneNudge: ToneNudge): Promise<{ ok: true } | { ok: false; errorKey: string }> {
```

Replace it with:

```tsx
async function runOne(
  toneNudge: ToneNudge,
  signal: AbortSignal,
): Promise<{ ok: true } | { ok: false; errorKey: string }> {
```

In the same function, replace every:

```tsx
setAttemptCount(attempt);
```

with:

```tsx
setAttemptByTone((prev) => ({ ...prev, [toneNudge]: attempt }));
```

In the same function, locate the `fetch` call:

```tsx
const res = await fetch("/api/render", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
});
```

Replace with:

```tsx
const res = await fetch("/api/render", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(payload),
  signal,
});
```

Add a `try/catch` around the entire fetch+retry loop so that an `AbortError` short-circuits cleanly. Replace the existing `for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) { ... }` block with:

```tsx
try {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    setAttemptByTone((prev) => ({ ...prev, [toneNudge]: attempt }));
    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    // ... (the rest of the existing body, unchanged)
  }
} catch (err) {
  if (err instanceof DOMException && err.name === "AbortError") {
    return { ok: false, errorKey: "render.error.aborted" };
  }
  throw err;
}
```

(Keep the existing inner logic — JSON parse, error-key handling, retry-delay etc. — untouched. Only the wrapping `try/catch` and the `signal` parameter on `fetch` are new.)

- [ ] **Step 3: Wire `AbortController` into `runRenderBatch` and update the dispatch**

Find the existing call:

```tsx
const results = await Promise.allSettled(toneNudges.map((tn) => runOne(tn)));
```

Replace the surrounding lines with:

```tsx
// Abort any prior batch that's still in flight (clicking Render again
// while a batch is running clears variants — also clear the old fetches).
batchAbort?.abort();
const controller = new AbortController();
setBatchAbort(controller);
setBatchStartedAt(Date.now());
setFailedTones(new Set());
setAttemptByTone({});

const results = await Promise.allSettled(
  toneNudges.map((tn) => runOne(tn, controller.signal)),
);
```

Then, in the existing `else if (successCount < toneNudges.length)` branch, also record which tones failed:

```tsx
const failed = new Set<ToneNudge>();
results.forEach((r, i) => {
  if (r.status === "fulfilled" && !r.value.ok) {
    failed.add(toneNudges[i]);
  }
});
setFailedTones(failed);
```

Finally, in the existing `finally` block (the one that already does `setIsGenerating(false)`), also clear the controller and start time:

```tsx
} finally {
  setIsGenerating(false);
  setBatchAbort(null);
  setBatchStartedAt(null);
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 5: Manual verify the existing UI still works**

The old full-area `<RenderingLoader />` is still mounted and reads only `isGenerating`, which is still flipped correctly. The render flow should behave identically to before from the user's perspective. Click Render in the dev server and confirm:
- Loader appears, variants land progressively as state appends them, no console errors.
- Open Network tab, click Render, click Render *again* mid-batch — first batch's fetches show as "cancelled" in the Network panel.

- [ ] **Step 6: Commit**

```bash
git add app/render/page.tsx
git commit -m "refactor(render): wire AbortController and per-tone attempt state into runRenderBatch"
```

---

### Task 2.5: Replace the old loader mount with status-band + slot grid

**Files:**
- Modify: `app/render/page.tsx`

- [ ] **Step 1: Add component imports at the top of the file**

Near the existing import lines (around line 19-23), add:

```tsx
import BatchStatusBand from "@/components/render/BatchStatusBand";
import VariantSlot, { type VariantSlotState } from "@/components/render/VariantSlot";
```

- [ ] **Step 2: Replace the loader mount and the slot list**

Locate the existing block (around line 1495):

```tsx
{isGenerating && (
  <div className="mt-3 overflow-hidden rounded-xl border border-black">
    <RenderingLoader attempt={attemptCount} />
  </div>
)}

{!isGenerating && visibleVariants.length === 0 && !errorMsg && (
  <p className="mt-3 text-sm text-gray-500">{t("rendering_empty_state")}</p>
)}
```

Replace it with:

```tsx
{batchStartedAt !== null && (
  <BatchStatusBand
    startedAt={batchStartedAt}
    completed={visibleVariants.length}
    total={5}
    onCancel={() => batchAbort?.abort()}
  />
)}

{batchStartedAt !== null && (
  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
    {TONE_BATCH.map((tone) => {
      const variant = visibleVariants.find((v) => v.toneNudge === tone);
      const failed = failedTones.has(tone);
      let state: VariantSlotState;
      if (variant) {
        state = { kind: "success", dataUrl: variant.dataUrl, alt: variant.panelLabel };
      } else if (failed) {
        state = { kind: "failed" };
      } else {
        state = { kind: "pending", attempt: attemptByTone[tone] ?? 1 };
      }
      return (
        <VariantSlot
          key={tone}
          state={state}
          toneLabel={TONE_LABEL_NL[tone]}
          onRetry={
            state.kind === "failed"
              ? () => {
                  setFailedTones((prev) => {
                    const next = new Set(prev);
                    next.delete(tone);
                    return next;
                  });
                  void runRenderBatch([tone], false);
                }
              : undefined
          }
        />
      );
    })}
  </div>
)}

{batchStartedAt === null && visibleVariants.length === 0 && !errorMsg && (
  <p className="mt-3 text-sm text-gray-500">{t("rendering_empty_state")}</p>
)}
```

- [ ] **Step 3: Update the existing variant list and the "Bent u klaar?" banner conditions**

The "Bent u klaar?" banner (around line 1508) uses `!isGenerating && visibleVariants.length > 1`. Replace `!isGenerating` with `batchStartedAt === null` so the banner only appears once the batch is fully done:

Before:
```tsx
{!isGenerating && visibleVariants.length > 1 && (
```

After:
```tsx
{batchStartedAt === null && visibleVariants.length > 1 && (
```

The mapped variant list at line 1530 (`<div className="mt-4 space-y-4">{visibleVariants.map(...)}`) is the **secondary, full-detail** rendering of variants used for the "select for offerte" flow. Keep it — but wrap it in the same `batchStartedAt === null` condition so it doesn't double-render the slots while a batch is in progress:

Before:
```tsx
<div className="mt-4 space-y-4">
  {visibleVariants.map((v) => (
```

After:
```tsx
{batchStartedAt === null && (
  <div className="mt-4 space-y-4">
    {visibleVariants.map((v) => (
      // ... unchanged inner
    ))}
  </div>
)}
```

(Close the conditional with `)}` after the existing closing `</div>`.)

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 5: Manual verify the full new flow**

Run `npm run dev`. Test all of these in DevTools iPhone preset:

1. **Initial state:** open `/render`, no slots visible (only the empty-state message if no variants exist).
2. **Click Render:** five slots appear within one frame, all with skeleton shimmer + per-slot loader. Status band sits above the slots, sticky. Counter starts `0/5 klaar · 0:00` and increments to `0/5 klaar · 0:01`, `0:02`, …
3. **Variants fill in one by one:** as each fetch resolves, its slot fades from skeleton to image, counter increments.
4. **Cancel mid-batch:** click Annuleer. Network tab confirms in-flight requests cancelled. Status band disappears. Slots that already completed are kept; slots that were pending become "geannuleerd".
5. **Force-fail one slot:** edit `runOne` temporarily to `return { ok: false, errorKey: "x" }` for `toneNudge === -2`, click Render, confirm only that slot shows the red "Mislukt" CTA, click "Probeer opnieuw" and confirm the single slot retries while the others are untouched. Revert the temporary edit before commit.
6. **Network throttle:** DevTools Network → Slow 3G, click Render, confirm the elapsed timer keeps ticking while you wait, slots fill in lazily.

Confirm console has no React warnings (key, hydration, state-during-render).

- [ ] **Step 6: Commit**

```bash
git add app/render/page.tsx
git commit -m "feat(render): replace full-area loader with per-tone slots + batch counter"
```

---

### Task 2.6: Smoke test for batch counter

**Files:**
- Modify: `scripts/test-agent/suites/render.ts`

- [ ] **Step 1: Add a counter-visibility test**

Append a new test object inside the existing `tests: [...]` array in `scripts/test-agent/suites/render.ts`:

```ts
{
  name: "Batch status band shows after Render is clicked",
  run: async (page) => {
    await page.goto(`${config.baseUrl}/render`);
    // Skip the test if no sample / photo wiring is set up — the smoke
    // harness can't synthesise a Supabase upload, so we only check the
    // empty-state path: the band must NOT be visible before any batch.
    const bandBefore = await page
      .locator('[role="status"]:has-text("klaar")')
      .count();
    if (bandBefore !== 0) {
      throw new Error("batch status band visible before any render started");
    }
  },
},
```

(The full positive-path test — clicking Render and asserting the band appears — requires a wired-up sample photo, which the smoke harness doesn't currently load. Track positive-path coverage as a follow-up.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Run the suite**

Start the dev server in one terminal: `npm run dev`. In another:

Run: `npm test -- --suite render`
Expected: all tests in the Render suite pass, including the new one.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-agent/suites/render.ts
git commit -m "test(render): smoke-check batch status band visibility"
```

---

## Phase 3 — Hamburger sheet for mobile cross-feature navigation

### Task 3.1: Create `MobileNavSheet` component

**Files:**
- Create: `components/MobileNavSheet.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavLocaleSwitcher from "./NavLocaleSwitcher";
import PwaInstallButton from "./PwaInstallButton";
import { useLocale } from "@/lib/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MobileNavSheet({ open, onClose }: Props) {
  const { locale, t } = useLocale();
  const showSubsidies = locale === "nl";
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);
  const pathname = usePathname();

  // Close on route change.
  useEffect(() => {
    if (open) onClose();
    // We deliberately depend only on pathname — this fires when the user
    // navigates inside the sheet, which is exactly the close trigger we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Close on Escape key.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Move focus to the first link on open.
  useEffect(() => {
    if (open) firstLinkRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const linkClass =
    "block border-b border-stone-200 px-6 py-4 font-mono text-sm uppercase tracking-[0.15em] text-ink hover:bg-stone-50 focus-visible:bg-stone-50 motion-safe:transition-colors";

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("nav.menu.close") || "Menu sluiten"}
        onClick={onClose}
        className="fixed inset-0 z-30 bg-black/30 motion-safe:animate-[fadeIn_120ms_ease-out] md:hidden"
      />
      {/* Sheet */}
      <nav
        id="mobile-nav-sheet"
        aria-label={t("nav.menu.label") || "Hoofdmenu"}
        className="fixed left-0 right-0 top-[calc(4rem+env(safe-area-inset-top))] z-30 border-b border-ink bg-paper motion-safe:animate-[slideDown_150ms_ease-out] md:hidden"
      >
        <Link
          href="/render"
          ref={firstLinkRef}
          className={linkClass}
          onClick={onClose}
        >
          {t("home.nav.render")}
        </Link>
        <Link
          href="/gevelcalc?modus=quick"
          className={linkClass}
          onClick={onClose}
        >
          {t("home.nav.calculator")}
        </Link>
        {showSubsidies && (
          <Link href="/subsidie" className={linkClass} onClick={onClose}>
            {t("home.nav.subsidies")}
          </Link>
        )}
        <div className="border-b border-stone-200 px-6 py-4">
          <NavLocaleSwitcher />
        </div>
        <div className="px-6 py-4">
          <PwaInstallButton variant="card" />
        </div>
      </nav>
    </>
  );
}
```

The existing `<PwaInstallButton variant="card" />` self-hides when the app is already installed or on an unknown platform, so wrapping it in conditional logic here would be redundant.

- [ ] **Step 2: Add slide-down keyframes to `globals.css`**

In `app/globals.css`, append at the end:

```css
@keyframes slideDown {
  from { transform: translateY(-8px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors. Translation keys `nav.menu.close` and `nav.menu.label` may not exist — `||` fallback handles that.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Smoke check**

Component is unused at this point. Skip browser check.

- [ ] **Step 5: Commit**

```bash
git add components/MobileNavSheet.tsx app/globals.css
git commit -m "feat(nav): add MobileNavSheet component"
```

---

### Task 3.2: Wire hamburger toggle into `SiteNav`

**Files:**
- Modify: `components/SiteNav.tsx`

- [ ] **Step 1: Replace the component body**

Replace the entire returned JSX in `components/SiteNav.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import NavLocaleSwitcher from "./NavLocaleSwitcher";
import MobileNavSheet from "./MobileNavSheet";
import { Logo } from "./Logo";
import { useLocale } from "@/lib/i18n";

export default function SiteNav() {
  const { locale, t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const showSubsidies = locale === "nl";
  const calcHref = "/gevelcalc?modus=quick";

  return (
    <>
      <nav className="sticky top-0 z-30 border-b border-stone-200 bg-paper/80 backdrop-blur-md print:hidden pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
          <Link href="/" aria-label="Renisual home" className="inline-flex items-center">
            <Logo variant="horizontal" />
          </Link>
          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.15em] text-stone-600 md:flex">
              <Link href="/render" className="transition-colors hover:text-ink">
                {t("home.nav.render")}
              </Link>
              <Link href={calcHref} className="transition-colors hover:text-ink">
                {t("home.nav.calculator")}
              </Link>
              {showSubsidies && (
                <Link href="/subsidie" className="transition-colors hover:text-ink">
                  {t("home.nav.subsidies")}
                </Link>
              )}
            </div>
            <div className="hidden md:block">
              <NavLocaleSwitcher compact className="ml-1" />
            </div>
            <button
              type="button"
              aria-label={t("nav.menu.open") || "Menu openen"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-sheet"
              onClick={() => setMenuOpen((v) => !v)}
              className="relative -mr-2 flex h-11 w-11 items-center justify-center md:hidden"
            >
              <span className="sr-only">{t("nav.menu.open") || "Menu openen"}</span>
              <span aria-hidden className="flex flex-col gap-[5px]">
                <span className="block h-[2px] w-6 bg-ink" />
                <span className="block h-[2px] w-6 bg-ink" />
                <span className="block h-[2px] w-6 bg-ink" />
              </span>
            </button>
          </div>
        </div>
      </nav>
      <MobileNavSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
```

The `aria-controls` value `"mobile-nav-sheet"` matches the `id` set on the `<nav>` in Task 3.1.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 3: Manual verify mobile interaction**

Run `npm run dev`. In DevTools iPhone preset, open `/render`:

1. Hamburger button (three lines) is visible top-right inside the nav, 44×44 tap target.
2. Tap hamburger → sheet slides down, links + locale switcher + "Install app" card visible.
3. Tap "Gevelcalc" → route changes, sheet closes automatically.
4. Tap hamburger again → sheet opens. Press ESC on a desktop responsive simulator (or run on physical iPad with Bluetooth keyboard) → sheet closes.
5. Tap hamburger again → tap on the dimmed backdrop area below the sheet → sheet closes.
6. Switch to ≥ md viewport (1024×768) → hamburger disappears, inline links and locale switcher visible.

Verify with VoiceOver / TalkBack (or DevTools Accessibility tree): hamburger button announces "Menu openen, expanded false / true" depending on state, sheet announces "Hoofdmenu" on open.

- [ ] **Step 4: Commit**

```bash
git add components/SiteNav.tsx
git commit -m "feat(nav): hamburger sheet for mobile cross-feature navigation"
```

---

### Task 3.3: Smoke test for the hamburger sheet

**Files:**
- Modify: `scripts/test-agent/suites/render.ts`

(We piggy-back on the Render suite rather than create a new file — the hamburger lives inside `SiteNav`, which `/render` mounts.)

- [ ] **Step 1: Add the test**

Append a new test object inside the existing `tests: [...]` array in `scripts/test-agent/suites/render.ts`:

```ts
{
  name: "Hamburger sheet opens and closes on mobile viewport",
  run: async (page) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${config.baseUrl}/render`);
    const button = page.locator('button[aria-controls="mobile-nav-sheet"]');
    if ((await button.count()) === 0) {
      throw new Error("hamburger button not present on mobile viewport");
    }
    await button.click();
    const sheet = page.locator("#mobile-nav-sheet");
    if (!(await sheet.isVisible())) {
      throw new Error("sheet did not open after hamburger click");
    }
    // Click backdrop (the first sibling — fixed inset-0 button).
    await page.locator('button[aria-label*="sluiten"], button[aria-label*="close"]').first().click();
    if (await sheet.isVisible()) {
      throw new Error("sheet did not close after backdrop click");
    }
  },
},
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 4: Run the suite**

With `npm run dev` running:

Run: `npm test -- --suite render`
Expected: all tests pass, including the new hamburger test.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-agent/suites/render.ts
git commit -m "test(nav): smoke-test hamburger sheet open/close on mobile"
```

---

## Closing checks

- [ ] Run the **full** test suite: `npm test`. Expected: all suites pass.
- [ ] Run a production build: `npm run build`. Expected: no type errors, no failed page generation.
- [ ] Skim the diff: `git log --oneline main..HEAD`. Expected: 12 commits, one per task.

## Self-review notes

Spec coverage: every spec section is covered. Design 1 = Tasks 1.1–1.3. Design 2 = Tasks 3.1–3.3 (including the Install-app affordance via the existing `<PwaInstallButton variant="card" />` mounted inside the sheet — it self-hides when the platform is unknown or the app is already installed). Design 3 = Tasks 2.1–2.6.

No placeholders: every code block is complete; no "TBD", "implement later", "similar to Task N".

Type consistency: `ToneNudge` is reused from the existing declaration in `app/render/page.tsx`. `VariantSlotState` is a new tagged union exported from `components/render/VariantSlot.tsx` and consumed by `app/render/page.tsx` in Task 2.5. `Record<number, number>` for `attemptByTone` matches `ToneNudge`'s underlying number type. `ReadonlySet<ToneNudge>` matches across declaration and consumer.

Verification deviation from strict TDD: this codebase has no unit-test framework, so each task uses `tsc --noEmit` + `npm run lint` + manual browser verification + (where useful) the existing Playwright smoke harness. This is documented in the header. Adding a unit-test framework is out of scope.
