"use client";

import { useState } from "react";
import Link from "next/link";
import DynamicMetadata from "@/components/DynamicMetadata";

export default function OffertePage() {
  const [form, setForm] = useState({
    naam: "",
    email: "",
    telefoon: "",
    postcode: "",
    type: "",
    opmerking: "",
    // Honeypot field — invisible to humans, scraping bots fill it.
    // Server silently drops submissions where this is non-empty.
    website: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.naam || !form.email || !form.postcode) {
      setErrorMsg("Vul naam, e-mail en postcode in.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/offerte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Versturen mislukt");
      setStatus("ok");
    } catch {
      setStatus("error");
      setErrorMsg("Versturen mislukt. Probeer het opnieuw of mail ons direct.");
    }
  }

  if (status === "ok") {
    return (
      <main className="min-h-[100dvh] bg-paper p-4 pb-16 text-ink md:p-8">
        <DynamicMetadata page="offerte" />
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-black bg-white p-8 text-center space-y-4">
            <div className="text-4xl">✓</div>
            <h1 className="text-2xl font-bold">Aanvraag ontvangen!</h1>
            <p className="text-sm text-gray-600">
              Bedankt {form.naam}. We nemen zo snel mogelijk contact met u op via {form.email}.
            </p>
            <div className="flex gap-3 justify-center flex-wrap pt-2">
              <Link href="/gevelcalc" className="rounded-xl bg-black text-white px-5 py-2.5 text-sm font-medium">
                Terug naar calculator
              </Link>
              <Link href="/" className="rounded-xl border border-black px-5 py-2.5 text-sm font-medium">
                Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-paper p-4 pb-16 text-ink md:p-8">
      <DynamicMetadata page="offerte" />
      <div className="mx-auto max-w-2xl space-y-6">

        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm underline">← Terug naar home</Link>
        </div>

        <div className="rounded-2xl border border-black bg-white p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Offerte aanvragen</h1>
            <p className="mt-2 text-sm text-gray-600">
              Vul het formulier in en wij nemen contact met u op met een vrijblijvende offerte
              op basis van uw gevelberekening.
            </p>
            <p className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              Onze adviseur neemt contact op met een exacte prijsopgave op basis van uw berekening.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot — never visible to a real user. Off-screen, no
                tabstop, marked aria-hidden so screen readers skip it. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={form.website}
              onChange={handleChange}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Naam *</label>
                <input
                  name="naam"
                  value={form.naam}
                  onChange={handleChange}
                  placeholder="Bijv. Jan de Vries"
                  className="w-full rounded-xl border border-black p-3 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">E-mailadres *</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="jan@example.nl"
                  className="w-full rounded-xl border border-black p-3 text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Telefoonnummer</label>
                <input
                  type="tel"
                  name="telefoon"
                  value={form.telefoon}
                  onChange={handleChange}
                  placeholder="06-12345678"
                  className="w-full rounded-xl border border-black p-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Postcode *</label>
                <input
                  name="postcode"
                  value={form.postcode}
                  onChange={handleChange}
                  placeholder="1234 AB"
                  className="w-full rounded-xl border border-black p-3 text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Type gevel</label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="w-full rounded-xl border border-black p-3 text-sm"
              >
                <option value="">Kies een type</option>
                <option value="gevelpanelen">Gevelpanelen (bijv. Spanl)</option>
                <option value="hout">Houten gevelbekleding</option>
                <option value="baksteen">Baksteen / metselwerk</option>
                <option value="composiet">Composiet</option>
                <option value="verf">Gevelverf / coating</option>
                <option value="anders">Anders / weet niet</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Opmerking</label>
              <textarea
                name="opmerking"
                value={form.opmerking}
                onChange={handleChange}
                placeholder="Bijv. vrijstaande woning, 4 zijdes, voorkeur voor lichte kleur..."
                rows={4}
                className="w-full rounded-xl border border-black p-3 text-sm resize-none"
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-xl bg-black text-white py-3 text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-opacity"
            >
              {status === "loading" ? "Versturen..." : "Offerte aanvragen →"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Door het formulier in te sturen gaat u akkoord met ons{" "}
              <Link href="/privacy" className="underline">privacybeleid</Link>.
              Uw gegevens worden niet gedeeld met derden zonder uw toestemming.
            </p>
          </form>
        </div>

      </div>
    </main>
  );
}