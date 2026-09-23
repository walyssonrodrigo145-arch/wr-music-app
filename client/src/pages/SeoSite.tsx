// ─── Site público de conteúdo (SEO) ──────────────────────────────────────────
// Páginas institucionais/comparativas/blog/glossário com HTML semântico,
// links internos e mesma identidade visual da landing.
import { Link, Route, Switch } from "wouter";
import {
  SEO_PAGES,
  childrenOf,
  resolveSeoPage,
  type SeoPage,
  type SeoPageKind,
} from "@shared/seo";
import { useSeo } from "@/hooks/useSeo";
import { Button } from "@/components/ui/button";
import { ArrowRight, CalendarDays, CheckCircle2, FileSignature, Menu, Music, Smartphone, Sparkles, Wallet, X } from "lucide-react";
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

/** Mockup de celular com a interface real do MusicPro (portal do aluno). */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[250px] sm:w-[280px] shrink-0">
      <div className="absolute -inset-6 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative rounded-[2.75rem] border-[10px] border-slate-900 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="rounded-[2.1rem] bg-background overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 text-[9px] font-bold text-muted-foreground">
            <span>9:41</span>
            <span className="h-1.5 w-16 rounded-full bg-slate-900/80" />
            <span>100%</span>
          </div>
          {/* Header do app */}
          <div className="px-4 pb-3 flex items-center gap-2 border-b border-border/50">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Music size={13} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black leading-tight">MusicPro</p>
              <p className="text-[8px] text-muted-foreground leading-tight">Escola Harmonia · Aluno</p>
            </div>
          </div>
          {/* Conteúdo do app */}
          <div className="px-3 py-3 space-y-2">
            <div className="rounded-2xl border border-border/60 bg-card p-3">
              <p className="text-[8px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
                <CalendarDays size={9} /> Próxima aula
              </p>
              <p className="text-[11px] font-bold mt-1">Hoje às 19:00 · Violão</p>
              <p className="text-[8px] text-muted-foreground">Sala 2 · Prof. Bruno</p>
              <div className="mt-2 h-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[8px] font-black flex items-center justify-center">
                CONFIRMAR PRESENÇA
              </div>
            </div>
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3">
              <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-1">
                <Wallet size={9} /> Mensalidade
              </p>
              <p className="text-[11px] font-bold mt-1">Setembro · R$ 180,00</p>
              <div className="mt-2 h-6 rounded-lg bg-amber-500 text-white text-[8px] font-black flex items-center justify-center">
                PAGAR COM PIX
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-3">
              <p className="text-[8px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                <Sparkles size={9} /> Plano de estudo
              </p>
              <p className="text-[11px] font-bold mt-1">Dia 3 de 5 · 18 min</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full w-[60%] rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Selo flutuante */}
      <div className="absolute -bottom-3 -left-4 rounded-2xl border border-border/60 bg-card/95 backdrop-blur px-3 py-2 shadow-xl">
        <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1">
          <Smartphone size={10} /> Instalável como app
        </p>
      </div>
    </div>
  );
}

/** Seção "no celular" exibida no hub de funcionalidades. */
function MobileShowcase() {
  const items = [
    "Agenda e confirmação de presença na palma da mão",
    "Mensalidade com PIX ou boleto direto no celular",
    "Plano de estudo diário com cronômetro de prática",
    "Avisos, materiais e progresso do aluno",
    "Cobranças e lembretes automáticos no WhatsApp",
    "Painel do gestor acessível de qualquer aparelho",
  ];
  return (
    <section className="mt-14 relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/40 backdrop-blur-xl p-6 sm:p-10 shadow-2xl shadow-primary/5">
      <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative grid lg:grid-cols-[minmax(0,1fr)_auto] gap-10 items-center">
        <div className="space-y-5 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            <Smartphone size={11} /> MusicPro no celular
          </span>
          <h2 className="font-outfit text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            Sua escola no bolso do aluno e da equipe
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            O portal do aluno abre no navegador do celular e pode ser instalado como aplicativo (PWA), com notificações. A equipe acompanha agenda, cobranças e indicadores de qualquer lugar.
          </p>
          <ul className="grid sm:grid-cols-2 gap-2.5">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/60 p-3">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-xs sm:text-sm text-foreground/90 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href="/cadastro">
              <Button className="h-11 rounded-2xl px-5 font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20">
                Testar no celular grátis
              </Button>
            </Link>
            <span className="text-[11px] text-muted-foreground font-semibold">
              Sem instalar nada · funciona em Android e iPhone
            </span>
          </div>
        </div>
        <PhoneMockup />
      </div>
    </section>
  );
}

function SeoPageView({ page }: { page: SeoPage }) {  useSeo(page);
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

        {/* Imagem real do sistema (páginas de funcionalidade) */}
        {page.cover && (
          <div className="mt-10 rounded-3xl border border-border/60 bg-card/40 p-1.5 sm:p-2 shadow-2xl shadow-primary/10 backdrop-blur-xl">
            <img
              src={page.cover.src}
              alt={page.cover.alt}
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

        {/* Sistema no celular (hub de funcionalidades) */}
        {page.path === "/funcionalidades" && <MobileShowcase />}

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
