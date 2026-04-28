"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";

export default function Home() {
  const { t } = useLocale();
  return (
    <main className="min-h-screen bg-[#f6f4ef] p-6 text-black">
      <section className="mx-auto max-w-5xl rounded-2xl border border-black bg-white p-8">
        <h1 className="text-4xl font-bold">{t("home.title")}</h1>
        <p className="mt-3 max-w-2xl text-lg">{t("home.tagline")}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/gevelcalc"
            className="rounded-2xl border border-black bg-white p-6 hover:bg-neutral-100"
          >
            <h2 className="text-2xl font-semibold">{t("home.gevelcalc.title")}</h2>
            <p className="mt-2">{t("home.gevelcalc.desc")}</p>
          </Link>

          <Link
            href="/render"
            className="rounded-2xl border border-black bg-white p-6 hover:bg-neutral-100"
          >
            <h2 className="text-2xl font-semibold">{t("home.render.title")}</h2>
            <p className="mt-2">{t("home.render.desc")}</p>
          </Link>
        </div>
      </section>
    </main>
  );
}
