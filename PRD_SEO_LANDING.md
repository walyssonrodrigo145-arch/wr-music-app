# PRD — Reestruturação SEO da Landing Page MusicPro

## 1. Visão Geral

### Problema
A landing (`https://wrmusicpro.com.br/`) foi construída como SPA React (Vite) sem renderização no servidor: o HTML entregue ao crawler é só `<div id="root"></div>` + JS. Hoje ela **depende 100% do Googlebot executar JavaScript** para ver o conteúdo; Bing, DuckDuckGo, IAs e previews sociais recebem uma página vazia. Além disso, todas as rotas compartilham o mesmo `<title>`, `<meta description>` e um `canonical` fixo no domínio, e não há dados estruturados, imagens otimizadas nem arquitetura de conteúdo para disputar as buscas do nicho.

### Objetivo
Reestruturar a landing e o site público para **ranquear nas buscas** por termos de gestão de escolas de música (ex.: "sistema para escola de música", "software para professor de música", "controle de mensalidade de alunos de música"), com indexação confiável, Core Web Vitals saudáveis e páginas de conteúdo que gerem tráfego orgânico qualificado → cadastros.

### Contexto (diagnóstico real do código em produção)

| # | Item | Situação atual | Impacto SEO |
|---|---|---|---|
| 1 | Renderização | SPA pura; `server/_core/vite.ts:64` serve o mesmo `index.html` para todas as rotas; sem SSR/prerender | **P0** — conteúdo não confiável para crawlers não-Google; indexação lenta |
| 2 | Meta tags | `client/index.html` tem 1 title/description; `canonical` fixo em `https://wrmusicpro.com.br` para qualquer rota | **P0** — canibalização/duplicidade; CTR baixo |
| 3 | OG image | `og-image.png` **não existe** em `client/public` (referenciado no HTML) | **P0** — compartilhamento no WhatsApp/LinkedIn sem imagem |
| 4 | Dados estruturados | Nenhum JSON-LD (Organization, SoftwareApplication, FAQPage, BreadcrumbList) | **P1** — perda de rich results |
| 5 | Imagens | `drum-trans.png` 751 KB, JPGs de 450–727 KB, `favicon.png` 322 KB; sem WebP/AVIF/srcset | **P0** — LCP ruim em mobile |
| 6 | JS/CSS | chunk principal 867 KB (267 KB gzip), CSS 442 KB (53 KB gzip); `manus-runtime` inline grande no HTML | **P1** — INP/TBT ruins |
| 7 | Cache | `express.static` sem `maxAge`; assets com hash sem cache imutável | **P1** — visitas repetidas lentas |
| 8 | sitemap/robots | Existem (5 URLs, `lastmod` fixo), sem páginas de conteúdo | **P1** — descoberta limitada |
| 9 | Arquitetura de conteúdo | Só a home; nenhum hub de funcionalidades, comparativos, blog ou glossário | **P0** — sem superfície para ranquear |
| 10 | Semântica on-page | H1 existe na home; âncoras de seção; FAQ presente (ótimo para schema) | **P2** — aproveitar melhor |
| 11 | Medição | GA4 instalado; sem verificação de Search Console no HTML nem monitoramento de CWV | **P1** — sem feedback de ranking |

> Resumo: existem boas fundações (title/OG básicos, robots, sitemap, PWA, conteúdo rico em seções), mas a **renderização SPA + falta de páginas** limita o teto de ranqueamento.

---

## 2. Usuários Envolvidos

- **Donos de escola de música / professores particulares** (buscam no Google/Bing): público-alvo do tráfego orgânico.
- **Marketing/owner MusicPro** (publica conteúdo, mede resultados).
- **Time técnico/IA** (prerender, performance, schemas).
- **Crawlers** (Googlebot, Bingbot, GPTBot/PerplexityBot, previews sociais).

---

## 3. Escopo

### Incluído
- Prerender/SSR do site público (home, cadastro, login, institucionais e páginas de conteúdo).
- Meta tags dinâmicas por rota + canônica autorreferente + OG/Twitter completos.
- Dados estruturados (Organization, WebSite+SearchAction, SoftwareApplication/Offer, FAQPage, BreadcrumbList, Article).
- Performance: imagens WebP/AVIF + srcset + preload do LCP; code-splitting; cache de assets.
- Arquitetura de conteúdo: hubs/landings por intenção de busca + blog + glossário + comparativos.
- sitemap dinâmico + robots + Search Console/Bing + monitoramento CWV.
- On-page: títulos, headings, internal linking, CTAs, breadcrumbs.

### Fora do escopo
- SEO internacional (site só pt-BR) e hreflang.
- Link building pago / assessoria de mídia.
- Migração para outro framework (Next/Astro) — avaliamos como opção futura, não nesta fase.
- SEO do app autenticado (área logada permanece `noindex` via robots).
- Landing de outros produtos (dancepro, analytics).

---

## 4. Requisitos Funcionais

### RF-001 — Prerender das rotas públicas
**Descrição:** gerar HTML estático no build (ou renderizar on-demand para bots) das rotas públicas com conteúdo completo.
**Rotas:** `/`, `/cadastro`, `/login`, `/termos-de-uso`, `/politica-de-privacidade`, `/planos`, `/funcionalidades/*`, `/blog/*`, `/glossario/*`.
**Fluxo:** build → prerender (Puppeteer/react-snap ou `vite-plugin-prerender`) → `dist/public` com `index.html` real por rota → Express serve o HTML pré-renderizado; SPA assume depois (hydrate).
**Exceções:** rotas autenticadas continuam CSR e `noindex`.
**Dados:** HTML estático + `sitemap.xml`.

### RF-002 — Meta tags por rota
**Descrição:** componente `<Seo>` (ou react-helmet) define `title`, `description`, `canonical`, `robots`, OG/Twitter por página, com valores padrão no HTML.
**Regras:** title ≤ 60 caracteres; description 140–160; canonical sempre a URL da própria página; `og:image` 1200×630.

### RF-003 — Dados estruturados
- Home: `Organization` (logo, redes, contactPoint) + `WebSite` com `SearchAction`.
- `/planos`: `SoftwareApplication` + `Offer` por plano.
- Home (seção FAQ) e artigos com FAQ: `FAQPage`.
- Blog: `Article` + `BreadcrumbList`.
- Depoimentos: `Review`/`AggregateRating` **somente** com avaliações reais e políticas do Google.

### RF-004 — Performance/Core Web Vitals
- Converter imagens para WebP/AVIF, `srcset`, dimensões explícitas, `loading="lazy"` (exceto LCP), `fetchpriority="high"` + `<link rel="preload">` na imagem do hero.
- Meta: LCP ≤ 2,5 s (mobile), CLS ≤ 0,1, INP ≤ 200 ms.
- Self-host de fontes com `font-display: swap` (ou `display=swap` no Google Fonts) e preconnect.
- Code-split das seções da landing; avaliar remoção/minimização do script inline `manus-runtime`.

### RF-005 — Cache e entrega
`/assets/*` com `Cache-Control: public, max-age=31536000, immutable`; `index.html` com `no-cache`; compressão zstd/gzip (Caddy já suporta, habilitar explicitamente).

### RF-006 — Sitemap e robots
Sitemap gerado dinamicamente (rotas públicas + posts), `lastmod` real, enviado ao Google Search Console e Bing Webmaster; robots liberando as páginas de conteúdo e bloqueando o app.

### RF-007 — Arquitetura de conteúdo
Criar as páginas do mapa (seção 5) com 800–1.500 palavras nos pilares, H1 único, H2/H3 com variações de palavra-chave, internal linking hub→spoke e CTA.

### RF-008 — Medição
GA4 (já ativo) + eventos de conversão orgânica; Search Console/Bing; monitoramento mensal de CWV e ranking das keywords-alvo.

---

## 5. Regras de Negócio / Mapa de Conteúdo

### RN-001 — Intenção primeiro
Cada página ataca **uma intenção** e um cluster de palavras. Exemplos:
- Transacional: "sistema para escola de música", "software de gestão para professor de música", "app para conservatório musical".
- Comparativa: "planilha vs sistema para escola de música", "melhores sistemas para escola de música", "como migrar de sistema".
- Informacional: "como precificar mensalidade de escola de música", "como reduzir inadimplência de alunos", "como organizar agenda de aulas", "LGPD para escolas de música", "como fidelizar alunos".

### RN-002 — Página pilar obrigatória
Nenhum cluster sem página pilar com H1 forte, prova social, preço/CTA e links para os satélites.

### RN-003 — Área logada nunca indexada
Todas as rotas do app (`/dashboard`, `/alunos`, ...) com `noindex` + `Disallow` (já no robots).

### RN-004 — Conteúdo sem IA rasa
Artigos revisados, com exemplos reais, dados da escola e prints; proibido conteúdo duplicado de concorrentes.

### Arquitetura de URLs proposta
```
/                          → Home (conversão + institucional)
/planos                    → Planos (Offer schema)
/funcionalidades           → Hub
/funcionalidades/financeiro
/funcionalidades/agenda-aulas
/funcionalidades/whatsapp-automatico
/funcionalidades/portal-do-aluno
/funcionalidades/contratos-digitais
/para/escola-de-musica
/para/conservatorio
/para/professor-particular
/para/estudio-de-musica
/comparativos/planilha-vs-sistema
/comparativos/como-migrar-de-sistema
/blog                      → Hub de artigos
/blog/<slug>
/glossario/<termo>
/cadastro                  → conversão
/login, /termos-de-uso, /politica-de-privacidade
```

---

## 6. Fluxos

### Fluxo do crawler (depois)
```text
Crawler acessa /funcionalidades/financeiro
↓
Servidor entrega HTML pré-renderizado (conteúdo + meta + JSON-LD)
↓
Google indexa, avalia CWV e exibe rich result
↓
Usuário clica → posso cadastrar no /cadastro (CTA)
```

### Fluxo de build/deploy
```text
vite build → prerender das rotas públicas → gera sitemap → publica dist/public
↓
Express serve HTML estático + assets com cache longo
↓
Search Console valida e sitemap é reenviado
```

### Fluxos de erro
- Prerender falha → build não publica (ou publica CSR e alerta no CI).
- Rota nova sem meta → fallback padrão + alerta de auditoria.

---

## 7. Casos Extremos

- PWA/Service Worker servindo HTML antigo → versionar e limpar cache (`sw.js`).
- Prerender capturando conteúdo atrás de login → paginas públicas apenas.
- SPA fallback sobrescrevendo HTML pré-renderizado → ajustar `serveStatic` para respeitar arquivos por rota.
- `canonical` com/sem barra final/`www` → padronizar 301 (Caddy: redirecionar `www`→raiz).
- Conteúdo duplicado entre `/para/escola-de-musica` e home → textos únicos.
- Imagens base64 (logos) na vitrine → limitar peso na home.
- Muitos parâmetros/UTMs indexados → canonical + robots.
- Blog sem CMS → conteúdo em MDX/repo ou tabela simples + prerender.

---

## 8. Dados Envolvidos

Sem alteração de banco nesta fase (conteúdo estático/MDX). Se o blog virar dinâmico: tabela `content_posts` (slug único, title, description, body MDX, publishedAt, author, keywords, cover, status) + cache.

---

## 9. Permissões e Segurança

- Prerender apenas de páginas públicas; nenhum dado de escola/aluno no HTML.
- JSON-LD sem dados sensíveis; depoimentos com consentimento.
- Helmet/CSP mantidos (ajustar apenas se o prerender precisar de inline).

---

## 10. Tratamento de Erros

- **Esperado:** rota sem conteúdo pré-renderizado → fallback CSR (não quebra).
- **Interno:** falha de prerender logada no build; nunca expor stack ao usuário.

---

## 11. Requisitos Não Funcionais

- RNF-001: PageSpeed mobile ≥ 90 na home/planos.
- RNF-002: HTML pré-renderizado ≤ 200 KB (sem imagens).
- RNF-003: imagens ≤ 150 KB cada (hero ≤ 250 KB) em WebP/AVIF.
- RNF-004: build de prerender ≤ 3 min extra no CI.
- RNF-005: acessibilidade (Lighthouse A11y ≥ 95) — alt, contraste, headings.

---

## 12. Critérios de Aceite

- CA-001: `curl https://wrmusicpro.com.br/` retorna HTML com H1 e texto do hero (sem executar JS).
- CA-002: cada rota pública tem title/description/canonical próprios (auditoria automatizada).
- CA-003: Rich Results Test valida Organization, SoftwareApplication, FAQPage e BreadcrumbList sem erros.
- CA-004: `/og-image.png` responde 200 e o card do WhatsApp mostra imagem.
- CA-005: PageSpeed mobile ≥ 90 e LCP ≤ 2,5 s na home.
- CA-006: sitemap contém todas as páginas públicas com `lastmod` atualizado; Search Console indexa > 90% delas.
- CA-007: `www` redireciona 301 para o domínio canônico.
- CA-008: ao menos 6 páginas novas publicadas (2 hubs, 2 comparativos, 2 artigos) com links internos.

---

## 13. Riscos e Dependências

- **Risco:** prerender conflitar com PWA/service worker → versionar o SW e testar instalação.
- **Risco:** conteúdo raso gerado em massa → penalização; revisão humana obrigatória.
- **Risco:** SPA fallback continuar servindo o shell → ajuste no `serveStatic`.
- **Dependência:** acesso ao DNS (301 `www`), Search Console/Bing e GA4.

---

## 14. Métricas de Sucesso

- Sessões orgânicas/mês (baseline hoje ~0 de busca) e cadastros atribuídos a orgânico.
- Impressões/cliques/CTR/posição média por cluster (Search Console).
- Páginas indexadas / enviadas.
- CWV: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 (CrUX/PSI).

---

## 15. Plano de Implementação Sugerido

### Fase 1 — Fundação técnica (P0, 1ª semana)
1. Prerender das rotas públicas (Puppeteer no build + fallback CSR).
2. Componente `<Seo>` por rota + canonical autorreferente + OG/Twitter.
3. Criar `og-image.png` (1200×630) e `twitter:image`.
4. JSON-LD na home (Organization/WebSite) e FAQPage na seção de FAQ.
5. `serveStatic` com cache (assets imutáveis, HTML no-cache) + `www`→raiz 301.
6. Sitemap dinâmico + reenvio ao Search Console/Bing.

### Fase 2 — Performance (P0/P1, 1ª–2ª semana)
7. Pipeline de imagens (WebP/AVIF + srcset) e troca dos PNG/JPG (751 KB → ~100 KB).
8. Preload da imagem do hero + `fetchpriority`.
9. Fontes self-hosted/`swap`; code-split das seções; reduzir `manus-runtime`.
10. Medição de CWV (PSI/CrUX) antes/depois.

### Fase 3 — Conteúdo e páginas (P0, 2ª–6ª semana)
11. Publicar hub `/funcionalidades` + 5 subpáginas; `/planos` com Offer.
12. Publicar `/para/*` (4 segmentos) e `/comparativos/*` (2).
13. Blog (`/blog`) + 4 artigos iniciais e glossário (10 termos).
14. Internal linking hub-spoke + breadcrumbs.

### Fase 4 — Medição e otimização contínua
15. Dashboard GA4+Search Console por cluster; ajuste de titles/metas com base em CTR.
16. Ciclo mensal: 2–4 conteúdos novos, auditoria técnica (Lighthouse/rich results) e backlinks naturais.

---

## Checklist final do analista

- [x] Problema definido (SPA sem SSR + sem arquitetura de conteúdo).
- [x] Objetivo claro (ranquear em buscas do nicho).
- [x] Usuários/atores identificados.
- [x] Escopo e fora do escopo definidos.
- [x] Requisitos funcionais identificados.
- [x] Regras de negócio/conteúdo explícitas.
- [x] Fluxos (crawler, build, erro) documentados.
- [x] Casos extremos analisados.
- [x] Dados envolvidos mapeados.
- [x] Permissões/segurança consideradas.
- [x] Erros esperados × internos definidos.
- [x] RNFs mensuráveis.
- [x] Critérios de aceite testáveis.
- [x] Riscos e dependências mapeados.
- [x] Métricas de sucesso definidas.
- [x] Plano em fases pronto para execução.
