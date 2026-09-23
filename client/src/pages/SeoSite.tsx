// ─── Site público de conteúdo (SEO) ──────────────────────────────────────────
// Páginas institucionais/comparativas/blog/glossário com HTML semântico,
// links internos e mesma identidade visual da landing.
import { Link, Route, Switch } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  SEO_PAGES,
  childrenOf,
  groupSeoMedia,
  resolveSeoPage,
  type SeoPage,
  type SeoPageKind,
} from "@shared/seo";
import { useSeo } from "@/hooks/useSeo";
import { Button } from "@/components/ui/button";
import { MobileShowcase, DesktopShowcase, MediaGallery } from "@/components/seo/MobileShowcase";
import { ArrowRight, CheckCircle2, FileSignature, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/funcionalidades", label: "Funcionalidades" },
  { href: "/planos", label: "Planos" },
  { href: "/blog", label: "Blog" },
  { href: "/glossario", label: "Glossário" },
];

function SeoHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.svg" alt="MusicPro" className="h-8 w-8" />
          <span className="font-outfit text-lg font-extrabold tracking-tight">MusicPro</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" className="rounded-xl font-bold text-xs uppercase tracking-widest">Entrar</Button>
          </Link>
          <Link href="/cadastro">
            <Button className="rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20">
              Teste grátis
            </Button>
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
          className="md:hidden h-10 w-10 rounded-xl border border-border flex items-center justify-center"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/60 bg-background px-4 py-3 space-y-1">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-bold">
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            <Link href="/login" className="flex-1"><Button variant="outline" className="w-full rounded-xl font-bold">Entrar</Button></Link>
            <Link href="/cadastro" className="flex-1"><Button className="w-full rounded-xl font-black">Teste grátis</Button></Link>
          </div>
        </div>
      )}
    </header>
  );
}

function SeoFooter() {
  const columns: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
    {
      title: "Funcionalidades",
      links: childrenOf("/funcionalidades").map((p) => ({ href: p.path, label: p.h1 })),
    },
    {
      title: "Para quem é",
      links: SEO_PAGES.filter((p) => p.kind === "segment" && !p.noindex).map((p) => ({ href: p.path, label: p.h1 })),
    },
    {
      title: "Conteúdo",
      links: [
        { href: "/blog", label: "Blog" },
        { href: "/glossario", label: "Glossário" },
        ...SEO_PAGES.filter((p) => p.kind === "comparison").map((p) => ({ href: p.path, label: p.h1 })),
      ],
    },
    {
      title: "MusicPro",
      links: [
        { href: "/planos", label: "Planos e preços" },
        { href: "/cadastro", label: "Criar conta grátis" },
        { href: "/login", label: "Entrar" },
        { href: "/termos-de-uso", label: "Termos de Uso" },
        { href: "/politica-de-privacidade", label: "Política de Privacidade" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border/60 bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">{col.title}</p>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} MusicPro — Sistema de gestão para escolas de música.</span>
          <span>Feito para escolas, conservatórios e professores de música.</span>
        </div>
      </div>
    </footer>
  );
}

function KindBadge({ kind }: { kind: SeoPageKind }) {
  const label =
    kind === "feature" ? "Funcionalidade"
      : kind === "segment" ? "Para quem é"
      : kind === "comparison" ? "Comparativo"
      : kind === "blog" ? "Blog"
      : kind === "glossary" ? "Glossário"
      : kind === "hub" ? "Guia"
      : kind === "plans" ? "Planos"
      : "MusicPro";
  return (
    <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
      {label}
    </span>
  );
}

function SeoPageView({ page }: { page: SeoPage }) {
  useSeo(page);
  const { data: seoMedia } = trpc.publicData.getSeoMedia.useQuery();
  const pageMedia = groupSeoMedia(seoMedia as any)[page.path];
  const cover = pageMedia?.cover?.[0];
  const coverSrc = cover?.url || page.cover?.src;
  const coverAlt = cover?.alt || page.cover?.alt || page.h1;
  const gallery = pageMedia?.gallery || [];
  const mobilePrints = pageMedia?.mobile || [];
  const desktopPrints = pageMedia?.desktop || [];
  const related = SEO_PAGES.filter((p) => p.path !== page.path && !p.noindex && p.kind === page.kind).slice(0, 6);
  const children = childrenOf(page.path);

  return (
    <div className="min-h-screen bg-background">
      <SeoHeader />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
        {/* Breadcrumb */}
        <nav aria-label="Trilha de navegação" className="mb-6 text-xs font-semibold text-muted-foreground">
          <Link href="/" className="hover:text-foreground">MusicPro</Link>
          {page.kind !== "home" && (
            <>
              {" › "}
              {page.kind === "feature" && <><Link href="/funcionalidades" className="hover:text-foreground">Funcionalidades</Link>{" › "}</>}
              {page.kind === "blog" && page.path !== "/blog" && <><Link href="/blog" className="hover:text-foreground">Blog</Link>{" › "}</>}
              {page.kind === "glossary" && page.path !== "/glossario" && <><Link href="/glossario" className="hover:text-foreground">Glossário</Link>{" › "}</>}
              <span className="text-foreground">{page.h1}</span>
            </>
          )}
        </nav>

        <header className="max-w-3xl space-y-4">
          <KindBadge kind={page.kind} />
          <h1 className="font-outfit text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.12]">{page.h1}</h1>
          {page.intro && <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">{page.intro}</p>}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href={(page.cta?.href || "/cadastro")}>
              <Button className="h-12 rounded-2xl px-6 font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20">
                {page.cta?.label || "Teste grátis por 7 dias"} <ArrowRight size={15} className="ml-2" />
              </Button>
            </Link>
            <Link href="/funcionalidades" className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
              Ver recursos
            </Link>
          </div>
        </header>

        {/* Imagem real do sistema (capa configurável no Super Admin) */}
        {coverSrc && (
          <div className="mt-10 rounded-3xl border border-border/60 bg-card/40 p-1.5 sm:p-2 shadow-2xl shadow-primary/10 backdrop-blur-xl">
            <img
              src={coverSrc}
              alt={coverAlt}
              width={1024}
              height={494}
              loading="lazy"
              decoding="async"
              className="w-full h-auto rounded-[1.25rem] border border-border/40"
            />
          </div>
        )}

        {/* Filhos (hubs) */}
        {children.length > 0 && (
          <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((child) => (
              <Link
                key={child.path}
                href={child.path}
                className="group rounded-2xl border border-border/70 bg-card/60 overflow-hidden transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 flex flex-col"
              >
                {child.cover && (
                  <div className="aspect-video overflow-hidden border-b border-border/50 bg-muted/30">
                    <img
                      src={child.cover.src}
                      alt={child.cover.alt}
                      width={1024}
                      height={494}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <p className="font-outfit text-base font-extrabold leading-snug group-hover:text-primary transition-colors">{child.h1}</p>
                  {child.intro && <p className="mt-2 text-xs text-muted-foreground line-clamp-3 leading-relaxed flex-1">{child.intro}</p>}
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary">
                    Ler mais <ArrowRight size={11} />
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* Sistema no celular: hub e cada funcionalidade (prints do Super Admin) */}
        {page.path === "/funcionalidades" && <MobileShowcase variant="hub" prints={mobilePrints} />}
        {page.kind === "feature" && <MobileShowcase variant="feature" prints={mobilePrints} title={page.h1} />}

        {/* Sistema no notebook (moldura) — quando houver prints configurados */}
        {(page.path === "/funcionalidades" || page.kind === "feature") && desktopPrints.length > 0 && (
          <DesktopShowcase prints={desktopPrints} title={page.h1} />
        )}

        {/* Galeria de imagens adicionais por funcionalidade */}
        {gallery.length > 0 && <MediaGallery images={gallery} />}

        {/* Conteúdo */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-10 items-start">
          <article className="space-y-8 min-w-0">
            {(page.sections || []).map((section, i) => (
              <section key={i} className="space-y-3">
                {section.heading && (
                  <h2 className="font-outfit text-xl sm:text-2xl font-extrabold tracking-tight">{section.heading}</h2>
                )}
                {(section.paragraphs || []).map((p, j) => (
                  <p key={j} className="text-sm sm:text-base text-muted-foreground leading-relaxed">{p}</p>
                ))}
                {section.bullets?.length ? (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {section.bullets.map((b, k) => (
                      <li key={k} className="flex items-start gap-2 rounded-xl border border-border/60 bg-card/50 p-3">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" />
                        <span className="text-xs sm:text-sm text-foreground/90 leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            {page.faq?.length ? (
              <section className="space-y-3">
                <h2 className="font-outfit text-xl sm:text-2xl font-extrabold tracking-tight">Perguntas frequentes</h2>
                <div className="space-y-2">
                  {page.faq.map((f, i) => (
                    <details key={i} className="group rounded-2xl border border-border/60 bg-card/50 p-4 open:shadow-sm">
                      <summary className="cursor-pointer list-none text-sm font-bold text-foreground marker:hidden">
                        {f.question}
                      </summary>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          {/* Aside: CTA + relacionados */}
          <aside className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileSignature size={16} className="text-primary" />
                <p className="text-sm font-black">Comece grátis</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Crie sua conta e teste todos os recursos por 7 dias. Sem cartão de crédito.
              </p>
              <Link href="/cadastro" className="block">
                <Button className="w-full h-11 rounded-xl font-black text-[11px] uppercase tracking-widest">
                  Criar conta grátis
                </Button>
              </Link>
            </div>

            {related.length > 0 && (
              <nav aria-label="Conteúdo relacionado" className="rounded-2xl border border-border/60 bg-card/50 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Veja também</p>
                <ul className="space-y-2.5">
                  {related.map((r) => (
                    <li key={r.path}>
                      <Link href={r.path} className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                        {r.h1}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </aside>
        </div>
      </main>
      <SeoFooter />
    </div>
  );
}

function SeoNotFound() {
  useSeo({
    path: "/blog",
    kind: "hub",
    title: "Conteúdo não encontrado — MusicPro",
    description: "A página que você procura não existe. Veja os conteúdos do MusicPro para escolas de música.",
    h1: "Conteúdo não encontrado",
    noindex: true,
  });
  return (
    <div className="min-h-screen bg-background">
      <SeoHeader />
      <main className="mx-auto max-w-3xl px-4 py-20 text-center space-y-4">
        <h1 className="font-outfit text-3xl font-extrabold">Conteúdo não encontrado</h1>
        <p className="text-sm text-muted-foreground">A página que você procura não existe ou mudou de endereço.</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              <Button variant="outline" className="rounded-xl font-bold text-xs">{l.label}</Button>
            </Link>
          ))}
        </div>
      </main>
      <SeoFooter />
    </div>
  );
}

/** Roteador do site público de conteúdo (rotas geradas a partir do SEO_PAGES). */
export default function SeoSite() {
  return (
    <Switch>
      {SEO_PAGES.filter((p) => !["home", "signup", "login", "legal"].includes(p.kind)).map((p) => (
        <Route key={p.path} path={p.path}>
          {() => <SeoPageView page={resolveSeoPage(p.path) || p} />}
        </Route>
      ))}
      <Route>
        <SeoNotFound />
      </Route>
    </Switch>
  );
}
