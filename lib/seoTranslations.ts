import type { Locale } from "./i18n";

export type SeoPageKey =
  | "home"
  | "gevelcalc"
  | "render"
  | "subsidie"
  | "leaderboard"
  | "wachten"
  | "offerte"
  | "about";

export type SeoMeta = { title: string; description: string };

export const seoMeta: Record<SeoPageKey, Record<Locale, SeoMeta>> = {
  home: {
    nl: {
      title: "Renisual — Het complete renovatieplatform voor Nederland",
      description:
        "Bereken renovatiekosten en visualiseer materialen op je eigen huis via AI. Exterieur én interieur — gevel, isolatie, tuin, badkamer, keuken en meer.",
    },
    en: {
      title: "Renisual — The complete renovation platform",
      description:
        "Calculate renovation costs and visualise materials on your own home using AI. Exterior and interior — facade, insulation, garden, bathroom, kitchen and more.",
    },
    de: {
      title: "Renisual — Die komplette Renovierungsplattform",
      description:
        "Berechnen Sie Renovierungskosten und visualisieren Sie Materialien an Ihrem eigenen Haus mit KI. Außen und innen — Fassade, Dämmung, Garten, Bad, Küche und mehr.",
    },
    fr: {
      title: "Renisual — La plateforme complète de rénovation",
      description:
        "Calculez les coûts de rénovation et visualisez les matériaux sur votre propre maison avec l'IA. Extérieur et intérieur — façade, isolation, jardin, salle de bain, cuisine et plus.",
    },
    es: {
      title: "Renisual — La plataforma completa de renovación",
      description:
        "Calcule costes de renovación y visualice materiales en su propia casa con IA. Exterior e interior — fachada, aislamiento, jardín, baño, cocina y más.",
    },
  },
  gevelcalc: {
    nl: {
      title: "GevelCalc — Bereken gevelpanelen & prijs | Renisual",
      description:
        "Bereken gevelpanelen, profielen, openingen en prijs voor uw renovatieproject. Inclusief Spanl- en Keralit-catalogus.",
    },
    en: {
      title: "Facade Calculator — Panels & price | Renisual",
      description:
        "Calculate facade panels, profiles, openings and price for your renovation project. Includes the Spanl and Keralit catalogues.",
    },
    de: {
      title: "Fassadenrechner — Paneele & Preis | Renisual",
      description:
        "Berechnen Sie Fassadenpaneele, Profile, Öffnungen und Preis für Ihr Renovierungsprojekt. Inklusive Spanl- und Keralit-Katalog.",
    },
    fr: {
      title: "Calculateur de façade — Panneaux & prix | Renisual",
      description:
        "Calculez panneaux de façade, profilés, ouvertures et prix pour votre projet de rénovation. Catalogues Spanl et Keralit inclus.",
    },
    es: {
      title: "Calculadora de fachada — Paneles & precio | Renisual",
      description:
        "Calcule paneles de fachada, perfiles, aberturas y precio para su proyecto de renovación. Incluye catálogos Spanl y Keralit.",
    },
  },
  render: {
    nl: {
      title: "Render — AI-visualisatie van uw gevel | Renisual",
      description:
        "Upload een foto van uw gevel en zie hoe nieuwe panelen, kleuren en materialen er in werkelijkheid uitzien. AI-aangedreven visualisatie.",
    },
    en: {
      title: "Render — AI facade visualisation | Renisual",
      description:
        "Upload a photo of your facade and see how new panels, colours and materials look on your real home. AI-powered visualisation.",
    },
    de: {
      title: "Render — KI-Fassadenvisualisierung | Renisual",
      description:
        "Laden Sie ein Foto Ihrer Fassade hoch und sehen Sie, wie neue Paneele, Farben und Materialien wirklich aussehen. KI-gestützte Visualisierung.",
    },
    fr: {
      title: "Render — Visualisation IA de la façade | Renisual",
      description:
        "Téléchargez une photo de votre façade et voyez à quoi ressemblent les nouveaux panneaux, couleurs et matériaux. Visualisation par IA.",
    },
    es: {
      title: "Render — Visualización de fachada con IA | Renisual",
      description:
        "Suba una foto de su fachada y vea cómo lucen nuevos paneles, colores y materiales sobre su casa real. Visualización con IA.",
    },
  },
  subsidie: {
    nl: {
      title: "Subsidies Isolatie & Renovatie 2026 — Renisual",
      description:
        "Overzicht van alle subsidies voor isolatie en gevelrenovatie. ISDE, Energiebespaarlening, gemeentelijke subsidies en meer.",
    },
    en: {
      title: "Insulation & renovation grants 2026 — Renisual",
      description:
        "Overview of grants and subsidies for insulation and facade renovation in the Netherlands. ISDE, low-rate loans, municipal schemes and more.",
    },
    de: {
      title: "Förderungen Dämmung & Renovierung 2026 — Renisual",
      description:
        "Übersicht aller Förderungen für Dämmung und Fassadenrenovierung in den Niederlanden. ISDE, Energiesparkredit, kommunale Programme und mehr.",
    },
    fr: {
      title: "Aides isolation & rénovation 2026 — Renisual",
      description:
        "Aperçu des aides pour l'isolation et la rénovation de façade aux Pays-Bas. ISDE, prêt énergie, aides municipales et plus.",
    },
    es: {
      title: "Subvenciones aislamiento & renovación 2026 — Renisual",
      description:
        "Resumen de las subvenciones para aislamiento y renovación de fachada en los Países Bajos. ISDE, préstamos energéticos, ayudas municipales y más.",
    },
  },
  leaderboard: {
    nl: {
      title: "Leaderboard — 2048 topscores | Renisual",
      description: "Top 10 hoogste 2048 scores in de Renisual wachtkamer.",
    },
    en: {
      title: "Leaderboard — 2048 top scores | Renisual",
      description: "Top 10 highest 2048 scores from the Renisual waiting room.",
    },
    de: {
      title: "Leaderboard — 2048 Bestenliste | Renisual",
      description: "Top 10 der höchsten 2048-Punktzahlen aus dem Renisual-Warteraum.",
    },
    fr: {
      title: "Classement — meilleurs scores 2048 | Renisual",
      description: "Top 10 des meilleurs scores 2048 de la salle d'attente Renisual.",
    },
    es: {
      title: "Clasificación — mejores puntuaciones 2048 | Renisual",
      description: "Top 10 de las mejores puntuaciones de 2048 de la sala de espera Renisual.",
    },
  },
  wachten: {
    nl: {
      title: "Wachtkamer — speel 2048 terwijl je render laadt | Renisual",
      description:
        "Speel 2048 terwijl je AI gevel-render genereert. Je topscore wordt opgeslagen in de leaderboard.",
    },
    en: {
      title: "Waiting room — play 2048 while your render loads | Renisual",
      description:
        "Play 2048 while your AI facade render is generating. Your top score is saved to the leaderboard.",
    },
    de: {
      title: "Warteraum — spielen Sie 2048, während Ihr Render lädt | Renisual",
      description:
        "Spielen Sie 2048, während Ihr KI-Fassadenrender erzeugt wird. Ihre Bestleistung landet in der Bestenliste.",
    },
    fr: {
      title: "Salle d'attente — jouez à 2048 pendant le rendu | Renisual",
      description:
        "Jouez à 2048 pendant que votre rendu IA de façade se génère. Votre meilleur score est enregistré au classement.",
    },
    es: {
      title: "Sala de espera — juegue al 2048 mientras se genera | Renisual",
      description:
        "Juegue al 2048 mientras se genera su render de fachada con IA. Su mejor puntuación se guarda en la clasificación.",
    },
  },
  offerte: {
    nl: {
      title: "Offerte aanvragen — Renisual",
      description:
        "Vraag een vrijblijvende offerte aan op basis van uw gevelberekening. Onze adviseur neemt contact op met een exacte prijsopgave.",
    },
    en: {
      title: "Request a quote — Renisual",
      description:
        "Request a no-obligation quote based on your facade calculation. Our adviser will contact you with an exact price.",
    },
    de: {
      title: "Angebot anfragen — Renisual",
      description:
        "Fordern Sie ein unverbindliches Angebot auf Basis Ihrer Fassadenberechnung an. Unser Berater meldet sich mit einem genauen Preis.",
    },
    fr: {
      title: "Demander un devis — Renisual",
      description:
        "Demandez un devis sans engagement basé sur votre calcul de façade. Notre conseiller vous contactera avec un prix exact.",
    },
    es: {
      title: "Solicitar presupuesto — Renisual",
      description:
        "Solicite un presupuesto sin compromiso basado en su cálculo de fachada. Nuestro asesor le contactará con un precio exacto.",
    },
  },
  about: {
    nl: {
      title: "Over Renisual — onafhankelijke renovatie-site",
      description:
        "Het verhaal achter Renisual: ontstaan uit een eigen woonboot-renovatie. Onafhankelijk, eigen visualisatie-tool, plannen voor keuken, badkamer en tuin.",
    },
    en: {
      title: "About Renisual — independent renovation site",
      description:
        "The story behind Renisual: born from a personal houseboat renovation. Independent, own visualisation tool, plans for kitchen, bathroom and garden.",
    },
    de: {
      title: "Über Renisual — unabhängige Renovierungs-Seite",
      description:
        "Die Geschichte hinter Renisual: entstanden aus einer eigenen Hausboot-Renovierung. Unabhängig, eigenes Visualisierungs-Tool, Pläne für Küche, Bad und Garten.",
    },
    fr: {
      title: "À propos de Renisual — site de rénovation indépendant",
      description:
        "L'histoire derrière Renisual : née d'une rénovation personnelle de péniche. Indépendant, outil de visualisation maison, projets pour cuisine, salle de bain et jardin.",
    },
    es: {
      title: "Sobre Renisual — sitio de renovación independiente",
      description:
        "La historia detrás de Renisual: nacido de una renovación personal de casa flotante. Independiente, herramienta de visualización propia, planes para cocina, baño y jardín.",
    },
  },
};

export function getSeoMeta(page: SeoPageKey, locale: Locale): SeoMeta {
  return seoMeta[page][locale] ?? seoMeta[page].en ?? seoMeta[page].nl;
}
