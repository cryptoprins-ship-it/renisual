import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Cookiebeleid — Renisual",
  description:
    "Welke cookies Renisual gebruikt, waarvoor, en waarom je geen cookie-banner ziet. Strikt noodzakelijke en functionele cookies, geen tracking.",
  alternates: { canonical: "https://renisual.com/cookiebeleid" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "15 mei 2026";
const CONTACT_EMAIL = "info@renisual.com";

export default function CookiebeleidPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-paper text-ink">
      <nav className="sticky top-0 z-30 border-b border-stone-200 bg-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-12 lg:px-20">
          <Link href="/" aria-label="Renisual home" className="inline-flex items-center">
            <Logo variant="horizontal" />
          </Link>
        </div>
      </nav>

      <article className="flex-1 px-6 py-10 md:px-12 md:py-14 lg:px-20 lg:py-16">
        <div className="mx-auto max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-600">
            Renisual
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
            Cookiebeleid
          </h1>
          <p className="mt-2 text-sm text-stone-500">Laatst bijgewerkt: {LAST_UPDATED}</p>

          <div className="mt-8 space-y-6 text-base leading-[1.7] text-stone-800">
            <section>
              <h2 className="font-display text-2xl tracking-tight">In het kort</h2>
              <p className="mt-2">
                Renisual zet geen tracking- of advertentiecookies. De cookies die we wel gebruiken zijn
                strikt nodig om de site te laten werken — denk aan een veilige sessie en een teller
                die bijhoudt hoeveel gratis renders je vandaag al hebt gebruikt. Daarom zie je ook
                geen cookie-banner: voor strikt noodzakelijke cookies is volgens de AVG en
                ePrivacy geen toestemming vereist.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Welke cookies we gebruiken</h2>
              <ul className="mt-3 list-disc space-y-3 pl-5">
                <li>
                  <strong>
                    <code className="font-mono text-[13px]">__rs_uid</code>
                  </strong>{" "}
                  — onthoudt anoniem hoeveel gratis renders je vandaag gebruikt hebt (cap 10 per
                  dag). De cookie bevat een ondertekende, willekeurige identifier — geen naam, geen
                  e-mailadres, geen profiel. HttpOnly, SameSite=Lax, vervalt na 1 jaar.
                </li>
                <li>
                  <strong>Supabase-sessiecookies</strong> (<code className="font-mono text-[13px]">sb-*</code>)
                  — houden een veilige sessie in stand zodat renders, credits en offertes goed
                  werken. Worden gezet door onze server-side Supabase-integratie.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Wat we lokaal in je browser bewaren</h2>
              <p className="mt-2">
                In <strong>localStorage</strong> (geen cookie) bewaren we je taalkeuze en je laatst
                opgeslagen project. Deze data verlaat je apparaat niet — we kunnen er als Renisual
                niet bij.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Wat we niet gebruiken</h2>
              <p className="mt-2">
                Geen tracking-cookies, geen advertentiecookies, geen marketing-pixels van derden.
                Bezoekstatistieken lopen via <strong>Plausible Analytics</strong>, dat volledig
                cookieloos werkt en IP-adressen anonimiseert.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Waarom je geen cookie-banner ziet</h2>
              <p className="mt-2">
                Alle bovenstaande cookies zijn strikt noodzakelijk of functioneel. Voor dat type
                cookies vereist de AVG/ePrivacy-wetgeving geen toestemming — een banner zou je
                alleen wegklikken zonder dat het iets verandert. Zodra we ooit een
                tracking- of advertentiecookie zouden toevoegen, krijg je eerst een echte
                toestemmingskeuze te zien.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Hoe je het beheert</h2>
              <p className="mt-2">
                Cookies en localStorage wis je via je browserinstellingen. De site blijft daarna
                werken — je verliest alleen je voorkeuren (taal, laatste project) en je
                gratis-render-teller wordt gereset.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Als dit verandert</h2>
              <p className="mt-2">
                Voegen we ooit advertenties of tracking toe (bijvoorbeeld Google AdSense voor
                inkomsten), dan zie je eerst een toestemmingskeuze en wordt dit beleid bijgewerkt.
                De datum bovenaan deze pagina verandert dan mee, zodat je altijd kunt zien wanneer
                we iets wezenlijks hebben veranderd.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Zie ook</h2>
              <p className="mt-2">
                Voor alles wat we verzamelen aan persoonsgegevens (foto's, offertes, e-mailadressen):{" "}
                <Link href="/privacy" className="underline underline-offset-4 hover:text-accent">
                  privacyverklaring
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl tracking-tight">Contact</h2>
              <p className="mt-2">
                Vragen of opmerkingen over dit cookiebeleid:{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4 hover:text-accent">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </article>

      <footer className="border-t border-stone-200 bg-paper px-6 py-8 md:px-12 lg:px-20">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div>
            <Logo variant="horizontal" markSize={28} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-stone-600">
            <Link href="/" className="hover:text-ink">Home</Link>
            <Link href="/about" className="hover:text-ink">Over</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Voorwaarden</Link>
            <Link href="/cookiebeleid" className="hover:text-ink">Cookies</Link>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-ink">Contact</a>
          </div>
          <p className="text-xs text-stone-400">© 2026 Renisual</p>
        </div>
      </footer>
    </main>
  );
}
