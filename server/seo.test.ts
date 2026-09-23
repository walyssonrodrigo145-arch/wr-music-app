import { describe, it, expect } from "vitest";
import {
  SEO_PAGES,
  buildJsonLd,
  buildSitemapXml,
  childrenOf,
  getSeoPage,
  isSeoContentPath,
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

  it("páginas de funcionalidade têm imagem real do sistema (cover)", () => {
    const features = SEO_PAGES.filter((p) => p.kind === "feature");
    expect(features.length).toBeGreaterThanOrEqual(5);
    for (const p of features) {
      expect(p.cover?.src, `cover ausente: ${p.path}`).toMatch(/^\/images\//);
      expect((p.cover?.alt || "").length, `alt curto: ${p.path}`).toBeGreaterThan(15);
    }
    const html = renderSeoContentHtml(getSeoPage("/funcionalidades/financeiro", SEO_PAGES)!, SEO_PAGES);
    expect(html).toContain("<img");
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
