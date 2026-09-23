// ─── SEO: tipos e helpers das páginas públicas ────────────────────────────────
// Fonte única usada por: páginas React, prerender (build) e sitemap.
// Conteúdo em módulos separados (features/segments/comparisons/blog/glossary).

export type SeoPageKind =
  | "home"
  | "plans"
  | "signup"
  | "login"
  | "legal"
  | "hub"
  | "feature"
  | "segment"
  | "comparison"
  | "blog"
  | "glossary";

export interface SeoSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface SeoFaqItem {
  question: string;
  answer: string;
}

export interface SeoCover {
  src: string;
  alt: string;
}

export interface SeoPage {
  /** Rota canônica, sem barra final. Ex.: "/funcionalidades/financeiro" */
  path: string;
  kind: SeoPageKind;
  /** <title> — ideal até 60 caracteres */
  title: string;
  /** <meta name="description"> — ideal 140–160 caracteres */
  description: string;
  h1: string;
  keywords?: string[];
  intro?: string;
  sections?: SeoSection[];
  faq?: SeoFaqItem[];
  /** Imagem real do sistema exibida no card (hub) e no topo da página. */
  cover?: SeoCover;
  cta?: { label: string; href: string };
  /** AAAA-MM-DD usado no sitemap */
  updatedAt?: string;
  /** Páginas legais/login: não entram no sitemap e levam noindex */
  noindex?: boolean;
}

export const SEO_BASE_URL = "https://wrmusicpro.com.br";

// ─── Mídias das páginas (gerenciadas no Super Admin) ─────────────────────────
export type SeoMediaKind = "cover" | "gallery" | "mobile" | "desktop";

export const SEO_MEDIA_KINDS: SeoMediaKind[] = ["cover", "gallery", "mobile", "desktop"];

export const SEO_MEDIA_KIND_LABELS: Record<SeoMediaKind, string> = {
  cover: "Capa",
  gallery: "Galeria",
  mobile: "Print de celular (moldura)",
  desktop: "Print de notebook (moldura)",
};

export interface SeoMediaRow {
  id: number;
  pagePath: string;
  kind: string;
  url: string;
  alt?: string | null;
  order?: number | null;
  isActive?: boolean | null;
}

export interface SeoMediaGroup {
  cover: SeoMediaRow[];
  gallery: SeoMediaRow[];
  mobile: SeoMediaRow[];
  desktop: SeoMediaRow[];
}

export function isSeoMediaKind(value: unknown): value is SeoMediaKind {
  return SEO_MEDIA_KINDS.includes(String(value) as SeoMediaKind);
}

/**
 * Agrupa as mídias ativas por página e tipo (capa/galeria/celular), mantendo a
 * ordenação. Usado pelo client, pelo server e pelos testes.
 */
export function groupSeoMedia(rows: SeoMediaRow[] | null | undefined): Record<string, SeoMediaGroup> {
  const grouped: Record<string, SeoMediaGroup> = {};
  // Defensivo: nunca iterar algo que não seja lista (evita crash na página)
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    if (!row || row.isActive === false) continue;
    if (!isSeoMediaKind(row.kind)) continue;
    const path = String(row.pagePath || "");
    if (!path) continue;
    if (!grouped[path]) grouped[path] = { cover: [], gallery: [], mobile: [], desktop: [] };
    grouped[path][row.kind].push(row);
  }
  for (const page of Object.values(grouped)) {
    for (const kind of SEO_MEDIA_KINDS) {
      page[kind].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || a.id - b.id);
    }
  }
  return grouped;
}

/** Página pelo caminho (aceita com/sem barra final). */
export function getSeoPage(path: string, pages: SeoPage[]): SeoPage | undefined {
  const normalized = "/" + String(path || "").replace(/^\/+|\/+$/g, "");
  return pages.find((p) => p.path === normalized);
}

/** Sitemap XML a partir das páginas indexáveis. */
export function buildSitemapXml(pages: SeoPage[], baseUrl = SEO_BASE_URL): string {
  const urls = pages
    .filter((p) => !p.noindex)
    .map((p) => {
      const loc = `${baseUrl}${p.path === "/" ? "/" : p.path}`;
      const lastmod = p.updatedAt || "2026-09-22";
      const priority = p.path === "/" ? "1.0" : p.kind === "hub" || p.kind === "plans" ? "0.9" : p.kind === "legal" ? "0.3" : "0.8";
      const changefreq = p.kind === "blog" ? "weekly" : p.kind === "legal" ? "yearly" : "monthly";
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Escapa texto para inserir em HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Bloco de conteúdo semântico (HTML) injetado em #root no prerender para
 * crawlers que não executam JavaScript. O React substitui ao montar.
 */
export function renderSeoContentHtml(page: SeoPage, allPages: SeoPage[]): string {
  const parts: string[] = [];
  parts.push(`<main data-seo-prerender="1" style="max-width:1120px;margin:0 auto;padding:24px 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">`);

  if (page.kind !== "home") {
    const parent = page.kind === "glossary" ? "/glossario" : page.kind === "blog" ? "/blog" : page.kind === "feature" ? "/funcionalidades" : undefined;
    parts.push(`<nav aria-label="Trilha de navegação" style="font-size:13px;margin-bottom:16px"><a href="/" style="color:#4f46e5;text-decoration:none">MusicPro</a>${parent ? ` › <a href="${parent}" style="color:#4f46e5;text-decoration:none">${escapeHtml(hubLabel(page.kind))}</a>` : ""} › <span>${escapeHtml(page.h1)}</span></nav>`);
  }

  parts.push(`<h1 style="font-size:32px;line-height:1.2;margin:0 0 12px">${escapeHtml(page.h1)}</h1>`);
  if (page.intro) parts.push(`<p style="font-size:16px;line-height:1.6;margin:0 0 20px">${escapeHtml(page.intro)}</p>`);
  if (page.cover) {
    parts.push(
      `<img src="${escapeHtml(page.cover.src)}" alt="${escapeHtml(page.cover.alt)}" width="1024" height="494" loading="lazy" style="max-width:100%;height:auto;border-radius:12px;margin:0 0 20px" />`
    );
  }

  for (const section of page.sections || []) {
    parts.push(`<section style="margin:0 0 20px">`);
    if (section.heading) parts.push(`<h2 style="font-size:22px;line-height:1.3;margin:0 0 8px">${escapeHtml(section.heading)}</h2>`);
    for (const p of section.paragraphs || []) parts.push(`<p style="font-size:15px;line-height:1.65;margin:0 0 10px">${escapeHtml(p)}</p>`);
    if (section.bullets?.length) parts.push(`<ul style="padding-left:20px;margin:0 0 10px">${section.bullets.map((b) => `<li style="font-size:15px;line-height:1.6;margin-bottom:4px">${escapeHtml(b)}</li>`).join("")}</ul>`);
    parts.push(`</section>`);
  }

  if (page.faq?.length) {
    parts.push(`<section style="margin:0 0 20px"><h2 style="font-size:22px;margin:0 0 8px">Perguntas frequentes</h2>`);
    for (const item of page.faq) {
      parts.push(`<div style="margin-bottom:12px"><h3 style="font-size:16px;margin:0 0 4px">${escapeHtml(item.question)}</h3><p style="font-size:15px;line-height:1.6;margin:0">${escapeHtml(item.answer)}</p></div>`);
    }
    parts.push(`</section>`);
  }

  const cta = page.cta || { label: "Testar o MusicPro grátis", href: "/cadastro" };
  parts.push(`<p style="margin:24px 0"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none">${escapeHtml(cta.label)}</a></p>`);

  // Links internos (hub-spoke) para rastreamento e distribuição de autoridade
  const links = allPages
    .filter((p) => p.path !== page.path && !p.noindex && (page.kind === "home" || p.kind === page.kind || p.kind === "feature" || p.kind === "blog" || p.kind === "glossary"))
    .slice(0, 12);
  if (links.length) {
    parts.push(`<nav aria-label="Links relacionados" style="margin-top:24px"><h2 style="font-size:18px;margin:0 0 8px">Veja também</h2><ul style="padding-left:20px">${links.map((l) => `<li style="margin-bottom:4px"><a href="${l.path}" style="color:#4f46e5">${escapeHtml(l.h1)}</a></li>`).join("")}</ul></nav>`);
  }

  parts.push(`</main>`);
  return parts.join("");
}

function hubLabel(kind: SeoPageKind): string {
  if (kind === "blog") return "Blog";
  if (kind === "glossary") return "Glossário";
  if (kind === "feature") return "Funcionalidades";
  return "Conteúdo";
}

/** JSON-LD por tipo de página (Organization, FAQPage, Article, BreadcrumbList...). */
export function buildJsonLd(page: SeoPage, baseUrl = SEO_BASE_URL): any[] {
  const url = `${baseUrl}${page.path === "/" ? "/" : page.path}`;
  const blocks: any[] = [];

  if (page.kind === "home") {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "MusicPro",
      url: baseUrl,
      logo: `${baseUrl}/icon-512.png`,
      description: page.description,
      sameAs: [],
      contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", availableLanguage: ["Portuguese"] }],
    });
    blocks.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "MusicPro",
      url: baseUrl,
      inLanguage: "pt-BR",
      potentialAction: { "@type": "SearchAction", target: `${baseUrl}/blog?q={search_term_string}`, "query-input": "required name=search_term_string" },
    });
  }

  if (page.kind === "plans") {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "MusicPro",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: page.description,
      offers: { "@type": "Offer", priceCurrency: "BRL", price: "49.99", url },
    });
  }

  if (page.kind === "blog" && page.path !== "/blog") {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.h1,
      description: page.description,
      inLanguage: "pt-BR",
      dateModified: page.updatedAt || "2026-09-22",
      author: { "@type": "Organization", name: "MusicPro" },
      publisher: { "@type": "Organization", name: "MusicPro", logo: { "@type": "ImageObject", url: `${baseUrl}/icon-512.png` } },
      mainEntityOfPage: url,
    });
  }

  if (page.kind !== "home") {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "MusicPro", item: baseUrl },
        ...(page.kind === "feature" ? [{ "@type": "ListItem", position: 2, name: "Funcionalidades", item: `${baseUrl}/funcionalidades` }] : []),
        ...(page.kind === "blog" && page.path !== "/blog" ? [{ "@type": "ListItem", position: 2, name: "Blog", item: `${baseUrl}/blog` }] : []),
        ...(page.kind === "glossary" && page.path !== "/glossario" ? [{ "@type": "ListItem", position: 2, name: "Glossário", item: `${baseUrl}/glossario` }] : []),
        { "@type": "ListItem", position: page.kind === "hub" ? 2 : 3, name: page.h1, item: url },
      ],
    });
  }

  if (page.faq?.length) {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  return blocks;
}
