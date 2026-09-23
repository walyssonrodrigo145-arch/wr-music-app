// ─── SEO: agregação das páginas públicas + helpers ───────────────────────────
import { corePages } from "./core";
import { featurePages } from "./features";
import { segmentPages } from "./segments";
import { comparisonPages } from "./comparisons";
import { blogPages } from "./blog";
import { glossaryPages } from "./glossary";
import type { SeoPage } from "./types";

export * from "./types";

export const SEO_PAGES: SeoPage[] = [
  ...corePages,
  ...featurePages,
  ...segmentPages,
  ...comparisonPages,
  ...blogPages,
  ...glossaryPages,
];

/** Prefixos de rotas públicas de conteúdo (para o roteador do client). */
export const SEO_ROUTE_PREFIXES = [
  "/planos",
  "/funcionalidades",
  "/para",
  "/comparativos",
  "/blog",
  "/glossario",
];

/** True quando o caminho pertence ao site público de conteúdo. */
export function isSeoContentPath(path: string): boolean {
  const clean = "/" + String(path || "").replace(/^\/+|\/+$/g, "");
  return SEO_ROUTE_PREFIXES.some((prefix) => clean === prefix || clean.startsWith(prefix + "/"));
}

/** Resolve a página SEO por rota (match exato). */
export function resolveSeoPage(path: string): SeoPage | undefined {
  const clean = "/" + String(path || "").replace(/^\/+|\/+$/g, "");
  return SEO_PAGES.find((p) => p.path === clean);
}

/** Filhos diretos de um hub (para listagens internas). */
export function childrenOf(path: string, pages: SeoPage[] = SEO_PAGES): SeoPage[] {
  const base = path === "/" ? "/" : path;
  return pages.filter((p) => p.path !== base && p.path.startsWith(base + "/") && !p.noindex);
}
