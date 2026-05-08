# Mobile UX Pass V1 — Design

**Date:** 2026-05-08
**Status:** Draft, awaiting user review
**Scope:** Three discrete mobile-UX improvements to the existing renisual app.

## Summary

Three independent mobile improvements bundled in one pass because they all touch top-bar / loader UI and benefit from one round of testing:

1. **Safe-area-inset-top on every sticky nav** — fixes content sitting under the iPhone notch when `viewportFit: "cover"` is in effect.
2. **Hamburger sheet for mobile cross-feature navigation** — replaces the currently-hidden inline links in `SiteNav` so a mobile user can move between Render / Gevelcalc / Subsidie without a homepage detour.
3. **Per-variant skeleton + batch counter for the render loader** — surfaces the already-parallel render-streaming so the user sees activity from second one instead of waiting on a single full-area spinner for 30–60 s.

No backend changes. No new dependencies.

## Why now

- iPhone notch + `viewportFit: "cover"` is currently uncompensated; logo and tap targets crowd the system UI.
- Mobile users on `/render` or `/gevelcalc` have no path to other features without going home first.
- Render API calls already run in parallel via `Promise.allSettled(toneNudges.map(runOne))` (`app/render/page.tsx:911`) and append variants as they complete (line 880), but the UI shows a single full-area `<RenderingLoader />` for the whole batch, hiding the streaming behaviour from the user.

## Goals

- Mobile users on iPhone with notch see a correctly-padded top bar in portrait and landscape.
- Mobile users can reach Render / Gevelcalc / Subsidie from any page in two taps maximum.
- Mobile users see at least one rendered variant within ~10 s of clicking Render, with a visible counter and cancel option.

## Non-goals

- Not redesigning the bottom action bars on `/render` and `/gevelcalc`.
- Not consolidating the three duplicate sticky-nav implementations (`SiteNav`, `HomeClient`, `AboutClient`) into one shared component. Tracked as a separate cleanup.
- Not replacing or restyling `<RenderingLoader />` itself — only changing where it is mounted.
- Not adding SSE / chunked-transfer streaming. The existing parallel-fetch pattern is enough.
- Not folding `WhatsAppButton` into the hamburger sheet.

---

## Design 1 — Safe-area-inset-top on sticky navs

### Files touched

- `components/SiteNav.tsx`
- `app/HomeClient.tsx` (its own duplicate sticky nav at line 127)
- `app/about/AboutClient.tsx` (its own duplicate sticky nav at line 29)

### Change

For each of the three sticky-top navs, move the height onto the inner content row and add `pt-[env(safe-area-inset-top)]` to the outer `<nav>`:

Before:

```tsx
<nav className="sticky top-0 z-30 h-16 border-b ...">
  <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between ...">
```

After:

```tsx
<nav className="sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] ...">
  <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between ...">
```

The outer `<nav>` extends behind the notch (background fills the inset region), while the inner content row stays at `h-16`. Logo + locale switcher remain at a stable visual position below the notch.

### Cascade verification

Searched the codebase for hardcoded coordinates that depend on the previous nav height:

- No occurrences of `top-16`, `top-[64px]`, or `top-[4rem]`.
- `scroll-mt-20` / `scroll-mt-24` (anchor scroll-margin) is independent of nav height — counts from scrollport top.
- The two `lg:sticky lg:top-24` asides (`render/page.tsx:1460`, `gevelcalc/page.tsx:2567`) are desktop-only; safe-area-inset-top is zero on desktop.

No further changes required.

### Visual treatment behind the notch

`themeColor: "#0a0a0a"` is set, but the nav background is `bg-paper/80` (off-white). On iPhone Safari with notch the inset region will show the paper background plus backdrop blur. Acceptable: matches the rest of the bar. No additional styling needed.

### Testing

- Manual on iPhone with notch (Safari) in both portrait and landscape, with and without PWA standalone mode.
- iPad Safari (modern iPadOS reports as Mac with touch — no notch but should still render correctly).
- Android Chrome (no notch — `env(safe-area-inset-top)` is `0`, no visual change).
- Desktop Safari/Chrome — `env(safe-area-inset-top)` is `0`, no visual change.

---

## Design 2 — Hamburger sheet for mobile cross-feature navigation

### Files touched

- `components/SiteNav.tsx` — replace `hidden md:flex` link cluster with a hamburger toggle on mobile.
- `components/MobileNavSheet.tsx` — **new file**, the slide-down sheet.
- `components/NavLocaleSwitcher.tsx` — exported as-is, no changes; reused inside the sheet.

### Mobile (`< md`) layout

Before: `[Logo] ----------------- [LocaleSwitcher]`

After: `[Logo] ----------------- [Hamburger 44×44]`

Tap on hamburger opens `<MobileNavSheet>` directly under the nav. Sheet height is content-sized, not full-screen — user still sees ~30 % of the page behind the backdrop, anchoring them in context.

### Sheet contents (in order)

1. **Render** → `/render`
2. **Gevelcalc** → `/gevelcalc?modus=quick`
3. **Subsidies** → `/subsidie` *(only when `locale === "nl"`)*
4. Divider
5. **Locale switcher** — inline horizontal row of 5 flag-buttons (NL / EN / DE / FR / ES). Reuses `NavLocaleSwitcher` in a non-compact rendering.
6. Divider
7. **Install app** affordance — only when `PwaInstallButton`'s detection logic returns a non-`unknown`, non-installed platform. Reuses platform detection + iOS instruction sheet.

### Desktop (`md+`) layout

Unchanged. Inline links + `NavLocaleSwitcher` stay as they are. Hamburger is hidden via `md:hidden`.

### Open / close behaviour

- Open via: hamburger tap.
- Close via: tap on backdrop, ESC, route change, hamburger toggle.
- Hamburger button: `aria-expanded` reflects open state, `aria-controls` references the sheet's `id`.
- Sheet element: a `<nav aria-label="Hoofdmenu">` (or localised), conditionally mounted. Not a `role="dialog"` — this is a disclosure / nav-menu pattern, not a modal.
- Focus moves to the first link inside the sheet on open.
- Focus returns to the hamburger on close.
- Focus is **not** trapped — the user can tap outside to dismiss, ESC handler still works.

### Animation

- Default: slide-down from the nav baseline, ~150 ms ease-out.
- `prefers-reduced-motion`: no slide, just fade-in over 80 ms.
- Backdrop: fade-in to ~40 % opacity.

### State management

Local component state in `SiteNav` — `const [open, setOpen] = useState(false)`. No global state needed. `useEffect` adds an ESC keydown listener and a `usePathname` effect that closes on route change.

### Accessibility

- Hamburger button: 44×44 px tap target, visible focus ring.
- Sheet links: 44 px minimum tap height, font size ≥ 16 px to prevent iOS auto-zoom on focus (not relevant here since they're not inputs, but kept consistent).
- All text uses existing `font-mono` / `tracking-[0.15em]` style for visual consistency with the desktop nav.

### Testing

- Mobile portrait + landscape, tap each nav item, confirm route change closes the sheet.
- ESC key on a Bluetooth keyboard / desktop responsive-design simulator closes the sheet.
- Tap-outside dismisses; focus returns to hamburger.
- VoiceOver / TalkBack announces the menu by its `aria-label` ("Hoofdmenu") on open.
- Navigating to a route via the sheet leaves no orphaned scroll position or backdrop.

---

## Design 3 — Per-variant skeleton + batch counter

### Files touched

- `app/render/page.tsx` — refactor of `runRenderBatch` state and the render-section render tree.
- `components/RenderingLoader.tsx` — add a `compact?: boolean` prop for use inside a slot.

### Current behaviour

- Click "Render" → `setIsGenerating(true)`, `setVariants([])` for the relevant scope, then `Promise.allSettled(toneNudges.map(runOne))`.
- Each `runOne` calls `/api/render` with up to 3 retries, then appends a `RenderVariant` to `variants` and re-sorts by tone-batch order.
- UI shows one full-area `<RenderingLoader>` until `isGenerating` is `false` — variants only become visible after the entire batch resolves.

### Target behaviour

- Click "Render" → 5 placeholder slots appear immediately in tone-batch order, each with skeleton shimmer.
- A sticky batch-status band sits above the slots:
  - Counter: `0/5 klaar` → updates as variants land.
  - Elapsed timer: `0:00`, ticking each second.
  - Subtitle: `Een renderbatch duurt 30–60 seconden.`
  - Annuleer button (right side) — fires `AbortController.abort()`, which cancels all in-flight `fetch` calls and ends the batch.
- Each variant slot:
  - While pending: skeleton shimmer + small inline `<RenderingLoader compact />` showing per-tone retry attempt if `> 1`.
  - On success: fade-in the real image, replace skeleton.
  - On failure: red-tinted slot with `Mislukt — probeer opnieuw` mini-CTA that re-runs `runOne(tone)` for that single slot.
- When batch finishes (all settled or aborted):
  - Hide batch-status band.
  - Keep counter visible for 2 s as confirmation, then fade out.

### State changes

In `app/render/page.tsx`:

| Existing | New |
|---|---|
| `attemptCount: number` | `attemptByTone: Record<ToneNudge, number>` |
| — | `batchStartedAt: number \| null` |
| — | `batchAbort: AbortController \| null` |
| — | `failedTones: ReadonlySet<ToneNudge>` |
| — | `pendingTones: ReadonlySet<ToneNudge>` *(derived from `TONE_BATCH \ (success ∪ failed)`)* |

`runOne(toneNudge)` gains a second parameter `signal: AbortSignal` and passes it into `fetch(url, { signal, ... })`. On `AbortError`, the function returns `{ ok: false, errorKey: "render.error.aborted" }` without retrying.

`runRenderBatch` constructs a fresh `AbortController` at start, stores it in state, hands `controller.signal` into each `runOne`, and clears it in `finally`.

The elapsed-timer is a sibling component reading `batchStartedAt` and ticking via `setInterval(1000)`; it unmounts when `batchStartedAt` is `null`.

### Render-tree change

The block at `app/render/page.tsx:1495` (`{isGenerating && <RenderingLoader />}`) is replaced by:

1. **Batch-status band** — rendered when `batchStartedAt !== null`. Sticky directly under `SiteNav`: `sticky top-[calc(4rem+env(safe-area-inset-top))]` so it stays visible above the variant slots while the user scrolls.
2. **Slot grid** — always renders 5 slots if there is a pending or completed batch, in `TONE_BATCH` order. Each slot reads its state from `variants` / `failedTones` / `pendingTones`.

The "Bent u klaar?"-banner and the `visibleVariants.length === 0` empty-state remain untouched; their visibility conditions (`!isGenerating && ...`) just become `batchStartedAt === null && ...`.

### `<RenderingLoader compact />` change

When `compact` is true:

- Smaller spinner (`h-8 w-8` instead of `h-16 w-16`).
- Single-line message instead of stacked.
- No aspect-ratio placeholder — the slot's parent provides the box.

The 3-stage timing (5s / 15s) stays the same in compact mode — it now applies per-slot, which is correct because each slot represents one render call.

### Cancel semantics

- Cancel button visible from the moment `batchStartedAt` is set.
- On cancel: `batchAbort?.abort()`, all in-flight `runOne` reject with `AbortError`, no retries fire, no slots are marked failed (the slot state shows "geannuleerd" with a "Probeer opnieuw" CTA per slot? — **no**, simpler: clear all pending slots and show a single toast "Render geannuleerd").
- Variants that already completed before cancel are kept.

### Edge cases

- User clicks Render while a batch is already running: existing behaviour calls `setVariants([])` for the scope. We keep this — but also abort the previous controller so we don't have orphaned `fetch` calls writing into stale state.
- 429 rate-limit on one slot: existing behaviour waits and retries internally. The slot shows compact loader with `Poging 2/3` etc. Counter does not increment until success or final failure.
- All five fail: existing `errorMsg` shows above the slots. Slots stay in failed state with per-slot retry CTAs.
- User navigates away during a batch: `useEffect` cleanup aborts the controller. Existing pattern; no new code needed beyond holding the controller.

### Testing

- Trigger a render, confirm 5 skeletons appear within one frame, counter starts at `0/5`.
- Throttle network, confirm slots fill in one by one.
- Cancel mid-batch, confirm in-flight requests abort (Network tab shows "cancelled") and no further slots fill.
- Force a 429 (mock), confirm retry attempt is visible per affected slot only.
- Force one slot to fail, confirm per-slot retry CTA works without restarting the whole batch.
- Mobile portrait: scroll while rendering, confirm sticky status band stays visible.

---

## Rollout

These three changes ship together as one PR. Order of implementation within the PR:

1. Design 1 (smallest, lowest risk) — verify on real iPhone before moving on.
2. Design 3 (state refactor in `runRenderBatch`) — most code, biggest perceived-speed win.
3. Design 2 (new component) — last because it depends on `SiteNav` height being stable from Design 1.

## Open questions

- None blocking. The "WhatsAppButton in sheet?" question has been resolved: keep it floating, do not fold into sheet.

## References

- `app/render/page.tsx:770-930` — current `runRenderBatch` implementation.
- `app/render/page.tsx:1495-1499` — current full-area loader mount point.
- `components/RenderingLoader.tsx` — component to extend with `compact` prop.
- `components/SiteNav.tsx` — primary sticky nav; pattern duplicated in `HomeClient.tsx:127` and `AboutClient.tsx:29`.
- `components/PwaInstallButton.tsx:23-34` — platform detection reused inside the hamburger sheet.
