import { describe, it, expect } from "vitest";
import {
  SEO_PAGES,
  buildJsonLd,
  buildSitemapXml,
  childrenOf,
  getSeoPage,
  groupSeoMedia,
  isSeoContentPath,
  isSeoMediaKind,
  renderSeoContentHtml,
  resolveSeoPage,
  type SeoPage,
} from "@shared/seo";

const CONTENT_KINDS = ["home", "plans", "hub", "feature", "segment", "comparison", "blog", "glossary"];

describe("SEO — páginas públicas", () => {
  it("paths únicos e canônicos (sem barra final)", () => {
    const paths = SEO_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of SEO_PAGES) {
      expect(p.path.startsWith("/")).toBe(true);
      if (p.path !== "/") expect(p.path.endsWith("/")).toBe(false);
    }
  });

  it("title e description dentro dos limites recomendados", () => {
    for (const p of SEO_PAGES) {
      expect(p.title.length, `title curto: ${p.path}`).toBeGreaterThan(12);
      expect(p.title.length, `title longo: ${p.path} (${p.title.length})`).toBeLessThanOrEqual(70);
      expect(p.description.length, `description curta: ${p.path}`).toBeGreaterThanOrEqual(100);
      expect(p.description.length, `description longa: ${p.path} (${p.description.length})`).toBeLessThanOrEqual(170);
    }
  });

  it("páginas de conteúdo têm H1 e texto mínimo", () => {
    const pages = SEO_PAGES.filter((p) => CONTENT_KINDS.includes(p.kind));
    expect(pages.length).toBeGreaterThanOrEqual(25);
    for (const p of pages) {
      expect(p.h1.length, `h1 curto: ${p.path}`).toBeGreaterThan(8);
      const chars =
        (p.intro || "").length +
        (p.sections || []).reduce(
          (acc, s) =>
            acc +
            (s.heading || "").length +
            (s.paragraphs || []).join(" ").length +
            (s.bullets || []).join(" ").length,
          0
        );
      const minimum = p.kind === "glossary" ? 150 : 400;
      expect(chars, `conteúdo curto: ${p.path} (${chars})`).toBeGreaterThan(minimum);
    }
  });

  it("hubs têm filhos e páginas internas resolvem pelos pais", () => {
    expect(childrenOf("/funcionalidades").length).toBeGreaterThanOrEqual(4);
    expect(childrenOf("/blog").length).toBeGreaterThanOrEqual(3);
    expect(childrenOf("/glossario").length).toBeGreaterThanOrEqual(6);
    expect(getSeoPage("/funcionalidades/financeiro", SEO_PAGES)).toBeTruthy();
    expect(getSeoPage("/blog/lgpd-para-escolas-de-musica", SEO_PAGES)).toBeTruthy();
  });

  it("sitemap inclui indexáveis e exclui noindex", () => {
    const xml = buildSitemapXml(SEO_PAGES);
    expect(xml).toContain("https://wrmusicpro.com.br/funcionalidades/financeiro");
    expect(xml).toContain("https://wrmusicpro.com.br/blog/como-organizar-agenda-de-aulas");
    expect(xml).not.toContain("https://wrmusicpro.com.br/login");
    const count = (xml.match(/<url>/g) || []).length;
    expect(count).toBe(SEO_PAGES.filter((p) => !p.noindex).length);
    expect(xml.startsWith("<?xml")).toBe(true);
  });

  it("JSON-LD: home com Organization/WebSite/FAQ, artigo com Article, feature com BreadcrumbList", () => {
    const home = buildJsonLd(getSeoPage("/", SEO_PAGES)!);
    expect(home.map((b) => b["@type"])).toEqual(expect.arrayContaining(["Organization", "WebSite", "FAQPage"]));

    const article = buildJsonLd(getSeoPage("/blog/como-organizar-agenda-de-aulas", SEO_PAGES)!);
    expect(article.map((b) => b["@type"])).toContain("Article");

    const feature = buildJsonLd(getSeoPage("/funcionalidades/financeiro", SEO_PAGES)!);
    expect(feature.map((b) => b["@type"])).toContain("BreadcrumbList");

    const plans = buildJsonLd(getSeoPage("/planos", SEO_PAGES)!);
    expect(plans.map((b) => b["@type"])).toContain("SoftwareApplication");
  });

  it("conteúdo pré-renderizado traz H1, FAQ e CTA", () => {
    const html = renderSeoContentHtml(getSeoPage("/funcionalidades/financeiro", SEO_PAGES)!, SEO_PAGES);
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("/cadastro");
    expect(html).not.toContain("<script");
  });

  it("imagens das páginas públicas vêm do Super Admin (sem capas estáticas no código)", () => {
    const features = SEO_PAGES.filter((p) => p.kind === "feature");
    expect(features.length).toBeGreaterThanOrEqual(5);
    for (const page of SEO_PAGES) {
      expect(page.cover, `capa estática reintroduzida em ${page.path}`).toBeUndefined();
    }
    const html = renderSeoContentHtml(getSeoPage("/funcionalidades/financeiro", SEO_PAGES)!, SEO_PAGES);
    expect(html).not.toContain("<img");
  });

  it("isSeoContentPath reconhece o site público e ignora o app", () => {
    expect(isSeoContentPath("/funcionalidades/financeiro")).toBe(true);
    expect(isSeoContentPath("/blog")).toBe(true);
    expect(isSeoContentPath("/planos/")).toBe(true);
    expect(isSeoContentPath("/glossario/lgpd")).toBe(true);
    expect(isSeoContentPath("/dashboard")).toBe(false);
    expect(isSeoContentPath("/")).toBe(false);
    expect(isSeoContentPath("/alunos")).toBe(false);
  });

  it("resolveSeoPage normaliza barra final e sem barra inicial", () => {
    expect(resolveSeoPage("/blog/")?.path).toBe("/blog");
    expect(resolveSeoPage("glossario/lgpd")?.path).toBe("/glossario/lgpd");
    expect(resolveSeoPage("/inexistente")).toBeUndefined();
  });

  it("noindex apenas em login", () => {
    const noindex = SEO_PAGES.filter((p: SeoPage) => p.noindex).map((p) => p.path);
    expect(noindex).toEqual(["/login"]);
  });
});

describe("SEO — mídias das páginas (Super Admin)", () => {
  it("isSeoMediaKind aceita capa/galeria/celular/notebook e rejeita o resto", () => {
    expect(isSeoMediaKind("cover")).toBe(true);
    expect(isSeoMediaKind("gallery")).toBe(true);
    expect(isSeoMediaKind("mobile")).toBe(true);
    expect(isSeoMediaKind("desktop")).toBe(true);
    expect(isSeoMediaKind("video")).toBe(false);
    expect(isSeoMediaKind(null)).toBe(false);
  });

  it("agrupa por página e tipo respeitando a ordem", () => {
    const groups = groupSeoMedia([
      { id: 1, pagePath: "/funcionalidades/financeiro", kind: "cover", url: "c1", order: 1 },
      { id: 3, pagePath: "/funcionalidades/financeiro", kind: "gallery", url: "g2", order: 2 },
      { id: 2, pagePath: "/funcionalidades/financeiro", kind: "gallery", url: "g1", order: 1 },
      { id: 4, pagePath: "/funcionalidades/financeiro", kind: "mobile", url: "m1", order: 1 },
      { id: 6, pagePath: "/funcionalidades/financeiro", kind: "desktop", url: "d1", order: 2 },
      { id: 7, pagePath: "/funcionalidades/financeiro", kind: "desktop", url: "d0", order: 1 },
      { id: 5, pagePath: "/blog", kind: "cover", url: "b1", order: 1 },
    ]);
    expect(groups["/funcionalidades/financeiro"].cover.map((i) => i.url)).toEqual(["c1"]);
    expect(groups["/funcionalidades/financeiro"].gallery.map((i) => i.url)).toEqual(["g1", "g2"]);
    expect(groups["/funcionalidades/financeiro"].mobile.map((i) => i.url)).toEqual(["m1"]);
    expect(groups["/funcionalidades/financeiro"].desktop.map((i) => i.url)).toEqual(["d0", "d1"]);
    expect(groups["/blog"].cover.map((i) => i.url)).toEqual(["b1"]);
  });

  it("ignora imagens inativas, tipos inválidos e páginas vazias", () => {
    const groups = groupSeoMedia([
      { id: 1, pagePath: "/funcionalidades/financeiro", kind: "cover", url: "off", isActive: false },
      { id: 2, pagePath: "/funcionalidades/financeiro", kind: "video", url: "x" },
      { id: 3, pagePath: "", kind: "cover", url: "y" },
      { id: 4, pagePath: "/funcionalidades/financeiro", kind: "mobile", url: "on", isActive: true },
    ]);
    expect(groups["/funcionalidades/financeiro"].cover).toHaveLength(0);
    expect(groups["/funcionalidades/financeiro"].mobile.map((i) => i.url)).toEqual(["on"]);
    expect(Object.keys(groups)).toEqual(["/funcionalidades/financeiro"]);
  });

  it("lista vazia/nula devolve objeto vazio", () => {
    expect(groupSeoMedia([])).toEqual({});
    expect(groupSeoMedia(null)).toEqual({});
    expect(groupSeoMedia(undefined)).toEqual({});
  });

  it("REGRESSÃO: entrada não-iterável (ex.: resposta já agrupada) NÃO quebra a página", () => {
    // A API pública já devolve agrupado; se o client chamar groupSeoMedia de novo,
    // antes isso lançava "rows is not iterable" e derrubava a página (ErrorBoundary).
    expect(() => groupSeoMedia({} as any)).not.toThrow();
    expect(groupSeoMedia({} as any)).toEqual({});
    expect(groupSeoMedia({ "/funcionalidades": { cover: [] } } as any)).toEqual({});
  });
});
