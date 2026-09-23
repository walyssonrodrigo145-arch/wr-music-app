// ─── SEO: aplica título, meta tags e JSON-LD por página (SPA) ────────────────
// No prerender o HTML já sai com tudo; este hook garante o mesmo em navegação
// client-side (e mantém a canônica autorreferente em cada rota).
import { useEffect } from "react";
import { buildJsonLd, SEO_BASE_URL, type SeoPage } from "@shared/seo";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.setAttribute("data-seo-managed", "1");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("data-seo-managed", "1");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

export function useSeo(page: SeoPage | undefined) {
  useEffect(() => {
    if (!page || typeof document === "undefined") return;
    const previousTitle = document.title;
    const url = `${SEO_BASE_URL}${page.path === "/" ? "/" : page.path}`;

    document.title = page.title;
    upsertMeta("name", "description", page.description);
    if (page.keywords?.length) upsertMeta("name", "keywords", page.keywords.join(", "));
    upsertMeta("name", "robots", page.noindex ? "noindex, follow" : "index, follow");
    upsertCanonical(url);
    upsertMeta("property", "og:title", page.title);
    upsertMeta("property", "og:description", page.description);
    upsertMeta("property", "og:url", url);
    upsertMeta("name", "twitter:title", page.title);
    upsertMeta("name", "twitter:description", page.description);

    // JSON-LD (substitui o bloco injetado no prerender, se houver)
    document.querySelectorAll('script[data-seo-jsonld="1"]').forEach((el) => el.remove());
    const blocks = buildJsonLd(page);
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-jsonld", "1");
    script.textContent = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks);
    document.head.appendChild(script);

    return () => {
      document.title = previousTitle;
    };
  }, [page?.path]);
}
