import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f4ef] p-6 text-black">
      <section className="mx-auto max-w-5xl rounded-2xl border border-black bg-white p-8">
        <h1 className="text-4xl font-bold">Renisual</h1>
        <p className="mt-3 max-w-2xl text-lg">
          Tools voor renovatie, gevelcalculatie en visuele materiaalkeuze.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/gevelcalc"
            className="rounded-2xl border border-black bg-white p-6 hover:bg-neutral-100"
          >
            <h2 className="text-2xl font-semibold">GevelCalc</h2>
            <p className="mt-2">
              Bereken bruto oppervlak, openingen en netto geveloppervlak.
            </p>
          </Link>

          <Link
            href="/render"
            className="rounded-2xl border border-black bg-white p-6 hover:bg-neutral-100"
          >
            <h2 className="text-2xl font-semibold">Render</h2>
            <p className="mt-2">
              Upload een foto en visualiseer kleur, materiaal of stijl.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}