"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/i18n";
import { getSeoMeta, type SeoPageKey } from "@/lib/seoTranslations";

function setMetaTag(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setOgTag(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export default function DynamicMetadata({ page }: { page: SeoPageKey }) {
  const { locale } = useLocale();

  useEffect(() => {
    const { title, description } = getSeoMeta(page, locale);
    document.title = title;
    setMetaTag("description", description);
    setOgTag("og:title", title);
    setOgTag("og:description", description);
    setOgTag("og:locale", locale);
    document.documentElement.setAttribute("lang", locale);
  }, [page, locale]);

  return null;
}
