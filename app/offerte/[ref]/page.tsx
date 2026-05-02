// Public offerte page — opened by suppliers via QR scan or shared
// link. Authentication is intentionally NOT required: the random ref
// in the URL is the access token. Anyone with the link can view; only
// the original creator can mutate (enforced by RLS on the table).

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createAdminClient } from "@/utils/supabase/admin";
import { isValidRef } from "@/lib/offerte/ref";

const PHOTO_BUCKET = "offerte-photos";
const RENDER_BUCKET = "offerte-renders";
const PDF_BUCKET = "offerte-pdfs";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type OfferteRow = {
  id: string;
  ref: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_company: string | null;
  project_address: string | null;
  panel_count: number;
  profile_end_count: number;
  profile_middle_count: number;
  profile_corner_count: number;
  subtotal_excl_btw: string | number;
  total_incl_btw: string | number;
  photo_path: string | null;
  render_path: string | null;
  pdf_path: string | null;
};

async function loadOfferte(ref: string): Promise<OfferteRow | null> {
  if (!isValidRef(ref)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("offertes")
    .select(
      "id, ref, created_at, customer_name, customer_email, customer_company, project_address, panel_count, profile_end_count, profile_middle_count, profile_corner_count, subtotal_excl_btw, total_incl_btw, photo_path, render_path, pdf_path"
    )
    .eq("ref", ref)
    .maybeSingle();
  return (data as OfferteRow | null) ?? null;
}

async function signedUrl(bucket: string, path: string | null): Promise<string | null> {
  if (!path) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

const toNumber = (v: string | number) => (typeof v === "number" ? v : Number(v) || 0);

type PageProps = {
  params: Promise<{ ref: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ref } = await params;
  const offerte = await loadOfferte(ref);
  if (!offerte) {
    return { title: "Offerte niet gevonden — Renisual", robots: { index: false, follow: false } };
  }
  return {
    title: `Renisual offerte ${offerte.ref}`,
    description: `${offerte.panel_count} panelen, totaal ${fmtMoney(toNumber(offerte.total_incl_btw))} incl. BTW`,
    // Private quotes — keep them out of search indexes regardless of
    // whether anyone shares the link in a discoverable channel.
    robots: { index: false, follow: false },
    openGraph: {
      title: `Renisual offerte ${offerte.ref}`,
      description: `${offerte.panel_count} panelen, totaal ${fmtMoney(toNumber(offerte.total_incl_btw))} incl. BTW`,
    },
  };
}

export default async function OfferteRefPage({ params }: PageProps) {
  const { ref } = await params;
  const offerte = await loadOfferte(ref);
  if (!offerte) notFound();

  // Bump view_count fire-and-forget. Don't await — page render must
  // not block on telemetry, and a missed bump is harmless.
  void bumpViewCount(offerte.id);

  const [photoUrl, renderUrl, pdfUrl] = await Promise.all([
    signedUrl(PHOTO_BUCKET, offerte.photo_path),
    signedUrl(RENDER_BUCKET, offerte.render_path),
    signedUrl(PDF_BUCKET, offerte.pdf_path),
  ]);

  const subtotal = toNumber(offerte.subtotal_excl_btw);
  const total = toNumber(offerte.total_incl_btw);
  const btw = Math.round((total - subtotal) * 100) / 100;

  return (
    <main className="min-h-[100dvh] bg-paper text-ink">
      <div className="mx-auto max-w-[960px] px-5 py-10 md:px-10 md:py-14">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Renisual offerte
            </p>
            <h1 className="mt-2 font-display text-3xl tracking-tight text-ink md:text-4xl">
              {offerte.ref}
            </h1>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500">
              Opgesteld
            </p>
            <p className="mt-2 text-sm text-ink">{fmtDate(offerte.created_at)}</p>
          </div>
        </header>

        {(photoUrl || renderUrl) && (
          <section className="mb-10 grid gap-4 md:grid-cols-2">
            <figure className="border border-stone-200 bg-white">
              {photoUrl ? (
                <img src={photoUrl} alt="Bestaande situatie" className="block h-auto w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 text-xs text-stone-400">
                  Geen foto beschikbaar
                </div>
              )}
              <figcaption className="border-t border-stone-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Bestaande situatie
              </figcaption>
            </figure>
            <figure className="border border-stone-200 bg-white">
              {renderUrl ? (
                <img src={renderUrl} alt="Voorgesteld eindresultaat" className="block h-auto w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 text-xs text-stone-400">
                  Geen render beschikbaar
                </div>
              )}
              <figcaption className="border-t border-stone-200 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
                Voorgesteld eindresultaat
              </figcaption>
            </figure>
          </section>
        )}

        <section className="mb-8 grid gap-6 md:grid-cols-2">
          <div className="border border-stone-200 bg-white p-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Klant
            </p>
            <p className="text-sm text-ink">{offerte.customer_name ?? "Anonieme aanvraag"}</p>
            {offerte.customer_company && <p className="text-sm text-stone-600">{offerte.customer_company}</p>}
            {offerte.customer_email && <p className="text-sm text-stone-600">{offerte.customer_email}</p>}
          </div>
          <div className="border border-stone-200 bg-white p-5">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
              Project
            </p>
            <p className="text-sm text-ink">{offerte.project_address ?? "Adres niet opgegeven"}</p>
          </div>
        </section>

        <section className="mb-8 border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 font-mono text-[10px] uppercase tracking-[0.15em] text-stone-500">
                <th className="px-4 py-3 text-left">Omschrijving</th>
                <th className="px-4 py-3 text-right">Aantal</th>
              </tr>
            </thead>
            <tbody>
              <SpecRow label="Gevelpanelen" qty={offerte.panel_count} />
              <SpecRow label="Eindprofielen" qty={offerte.profile_end_count} />
              <SpecRow label="Tussenprofielen" qty={offerte.profile_middle_count} />
              <SpecRow label="Hoekprofielen" qty={offerte.profile_corner_count} />
            </tbody>
          </table>
        </section>

        <section className="mb-8 border border-stone-200 bg-white p-5">
          <div className="ml-auto max-w-sm space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-600">Subtotaal (excl. BTW)</span>
              <span className="font-medium">{fmtMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-600">BTW (21%)</span>
              <span className="font-medium">{fmtMoney(btw)}</span>
            </div>
            <div className="flex justify-between border-t border-ink pt-2 text-base">
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink">
                Totaal
              </span>
              <span className="font-display">{fmtMoney(total)}</span>
            </div>
          </div>
        </section>

        <section className="mb-8 border border-stone-200 bg-stone-100 p-5">
          <p className="text-sm leading-relaxed text-stone-700">
            Adviesprijzen — exclusief BTW. Vraag je leverancier voor de definitieve prijs.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            Stuur deze pagina door naar je leverancier voor een definitieve prijsopgave.
            Leveranciers werken met staffelkortingen op basis van afnamevolume.
          </p>
        </section>

        <section className="mb-12 flex flex-wrap items-center gap-4">
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-2 bg-ink px-7 py-3 font-mono text-[11px] uppercase tracking-[0.15em] text-paper transition-colors hover:bg-stone-800"
            >
              Download offerte (PDF)
              <span aria-hidden>↓</span>
            </a>
          ) : (
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-stone-500">
              PDF wordt gegenereerd. Ververs de pagina over een paar seconden.
            </span>
          )}
          <p className="text-xs text-stone-500">
            Stuur deze pagina door naar je leverancier voor een definitieve prijsopgave.
          </p>
        </section>

        <footer className="border-t border-stone-200 pt-6 text-xs text-stone-500">
          Gegenereerd via Renisual.com — het platform voor gevelvisualisatie en m²-berekening.
        </footer>
      </div>
    </main>
  );
}

function SpecRow({ label, qty }: { label: string; qty: number }) {
  if (!qty) return null;
  return (
    <tr className="border-b border-stone-100 last:border-0">
      <td className="px-4 py-3 text-stone-700">{label}</td>
      <td className="px-4 py-3 text-right font-medium text-ink">{qty}</td>
    </tr>
  );
}

async function bumpViewCount(id: string): Promise<void> {
  try {
    const admin = createAdminClient();
    // Read-modify-write so we don't need a stored procedure for this
    // single counter. Best-effort; we don't surface failures.
    const { data } = await admin.from("offertes").select("view_count").eq("id", id).maybeSingle();
    const next = ((data as { view_count?: number } | null)?.view_count ?? 0) + 1;
    await admin
      .from("offertes")
      .update({ view_count: next, last_viewed_at: new Date().toISOString() })
      .eq("id", id);
  } catch {
    /* swallow — view counter is best-effort telemetry */
  }
}
