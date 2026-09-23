// ─── Prerender SEO (pós-build) ───────────────────────────────────────────────
// Gera, para cada rota pública, um HTML com <head> completo (title, description,
// canonical, OG/Twitter, JSON-LD) e conteúdo semântico dentro de #root — para
// crawlers que não executam JavaScript. O React substitui ao montar.
// Também gera o sitemap.xml dinâmico.
//
// Uso: tsx scripts/prerender.ts   (chamado pelo `pnpm build`)

import fs from "node:fs";
import path from "node:path";
import {
  SEO_BASE_URL,
  SEO_PAGES,
  buildJsonLd,
  buildSitemapXml,
  escapeHtml,
  renderSeoContentHtml,
  type SeoPage,
} from "../shared/seo";

const distDir = path.resolve(process.cwd(), "dist", "public");
const templatePath = path.join(distDir, "index.html");

if (!fs.existsSync(templatePath)) {
  console.error(`[prerender] index.html não encontrado em ${templatePath}. Rode o vite build antes.`);
  process.exit(1);
}

const template = fs.readFileSync(templatePath, "utf8");
const CONTENT_KINDS = new Set(["home", "plans", "hub", "feature", "segment", "comparison", "blog", "glossary"]);

function replaceMetaName(html: string, name: string, content: string): string {
  const re = new RegExp(`<meta\\s+name="${name}"[^>]*>`, "i");
  const tag = `<meta name="${name}" content="${escapeHtml(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `  ${tag}\n  </head>`);
}

function replaceMetaProperty(html: string, property: string, content: string): string {
  const re = new RegExp(`<meta\\s+property="${property}"[^>]*>`, "i");
  const tag = `<meta property="${property}" content="${escapeHtml(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `  ${tag}\n  </head>`);
}

function renderPageHtml(page: SeoPage): string {
  const url = `${SEO_BASE_URL}${page.path === "/" ? "/" : page.path}`;
  let html = template;

  // Título e canonical
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`);
  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${url}" />`
  );

  // Meta primárias
  html = replaceMetaName(html, "description", page.description);
  if (page.keywords?.length) html = replaceMetaName(html, "keywords", page.keywords.join(", "));
  html = replaceMetaName(html, "robots", page.noindex ? "noindex, follow" : "index, follow");

  // Open Graph / Twitter
  html = replaceMetaProperty(html, "og:title", page.title);
  html = replaceMetaProperty(html, "og:description", page.description);
  html = replaceMetaProperty(html, "og:url", url);
  html = replaceMetaName(html, "twitter:title", page.title);
  html = replaceMetaName(html, "twitter:description", page.description);

  // JSON-LD (dados estruturados por página)
  const jsonLd = buildJsonLd(page)
    .map((block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`)
    .join("\n    ");
  html = html.replace("</head>", `  ${jsonLd}\n  </head>`);

  // Conteúdo semântico no #root (crawlers sem JS); o React hidrata por cima.
  if (CONTENT_KINDS.has(page.kind)) {
    const content = renderSeoContentHtml(page, SEO_PAGES);
    if (/<div id="root">\s*<\/div>/i.test(html)) {
      html = html.replace(/<div id="root">\s*<\/div>/i, `<div id="root">${content}</div>`);
    } else if (html.includes('id="root"')) {
      html = html.replace(/(<div id="root"[^>]*>)/i, `$1${content}`);
    }
  }

  return html;
}

let written = 0;
for (const page of SEO_PAGES) {
  const html = renderPageHtml(page);
  const outFile = page.path === "/"
    ? path.join(distDir, "index.html")
    : path.join(distDir, page.path.replace(/^\//, ""), "index.html");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, "utf8");
  written++;
  console.log(`[prerender] ${page.path} → ${path.relative(distDir, outFile)}`);
}

// Sitemap dinâmico (sem páginas noindex)
const sitemap = buildSitemapXml(SEO_PAGES);
fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemap, "utf8");
console.log(`[prerender] sitemap.xml com ${SEO_PAGES.filter((p) => !p.noindex).length} URLs`);

console.log(`[prerender] concluído: ${written} páginas pré-renderizadas.`);
