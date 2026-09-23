// ─── Seções de mídia das páginas públicas (SEO) ──────────────────────────────
// MobileShowcase: moldura de celular com prints escolhidos no Super Admin
// (fallback: interface ilustrativa do app). MediaGallery: galeria de prints.
import { useState } from "react";
import { Link } from "wouter";
import { PhoneFrame, LaptopFrame } from "@/components/seo/PhoneFrame";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SeoMediaRow } from "@shared/seo";
import { CalendarDays, CheckCircle2, Monitor, Music, Smartphone, Sparkles, Wallet } from "lucide-react";

/** Interface ilustrativa do app (usada quando não há print configurado). */
function PhoneScreenMock() {
  return (
    <div className="h-full w-full bg-background">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 text-[9px] font-bold text-muted-foreground">
        <span>9:41</span>
        <span className="h-1.5 w-16 rounded-full bg-slate-900/80" />
        <span>100%</span>
      </div>
      <div className="px-4 pb-3 flex items-center gap-2 border-b border-border/50">
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
          <Music size={13} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black leading-tight">MusicPro</p>
          <p className="text-[8px] text-muted-foreground leading-tight">Escola Harmonia · Aluno</p>
        </div>
      </div>
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
  );
}

export function MobileShowcase({
  variant,
  prints,
  title,
}: {
  variant: "hub" | "feature";
  prints: SeoMediaRow[];
  title?: string;
}) {
  const [index, setIndex] = useState(0);
  const shots = (prints || []).filter((p) => p?.url);
  const current = shots[Math.min(index, Math.max(0, shots.length - 1))];

  const hubItems = [
    "Agenda e confirmação de presença na palma da mão",
    "Mensalidade com PIX ou boleto direto no celular",
    "Plano de estudo diário com cronômetro de prática",
    "Avisos, materiais e progresso do aluno",
    "Cobranças e lembretes automáticos no WhatsApp",
    "Painel do gestor acessível de qualquer aparelho",
  ];
  const featureItems = [
    "Funciona no navegador do celular, sem instalar nada",
    "Pode ser instalado como app (PWA) com notificações",
    "Aluno, responsável, professor e gestor no mesmo sistema",
    "Acesso seguro por perfil, com os dados sempre atualizados",
  ];
  const items = variant === "hub" ? hubItems : featureItems;

  return (
    <section className="mt-14 relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/40 backdrop-blur-xl p-6 sm:p-10 shadow-2xl shadow-primary/5">
      <div className="absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative grid lg:grid-cols-[minmax(0,1fr)_auto] gap-10 items-center">
        <div className="space-y-5 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            <Smartphone size={11} /> MusicPro no celular
          </span>
          <h2 className="font-outfit text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            {variant === "hub"
              ? "Sua escola no bolso do aluno e da equipe"
              : `${(title || "O sistema").split(":")[0]} também no celular`}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
            O MusicPro abre no navegador do celular e pode ser instalado como aplicativo (PWA), com notificações. Alunos, responsáveis e equipe acompanham tudo de qualquer lugar.
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

        <div className="space-y-4">
          <PhoneFrame src={current?.url} alt={current?.alt || undefined}>
            <PhoneScreenMock />
          </PhoneFrame>

          {/* Miniaturas para alternar entre os prints escolhidos no Super Admin */}
          {shots.length > 1 && (
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {shots.map((shot, i) => (
                <button
                  key={shot.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Ver print ${i + 1}`}
                  className={cn(
                    "h-14 w-9 rounded-lg overflow-hidden border-2 transition-all",
                    i === index ? "border-primary shadow-md" : "border-border/60 opacity-60 hover:opacity-100"
                  )}
                >
                  <img src={shot.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Notebook: prints da versão web na moldura (escolhidos no Super Admin). */
export function DesktopShowcase({ prints, title }: { prints: SeoMediaRow[]; title?: string }) {
  const [index, setIndex] = useState(0);
  const shots = (prints || []).filter((p) => p?.url);
  if (shots.length === 0) return null;
  const current = shots[Math.min(index, Math.max(0, shots.length - 1))];

  return (
    <section className="mt-14 relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/40 backdrop-blur-xl p-6 sm:p-10 shadow-2xl shadow-primary/5">
      <div className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="relative space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            <Monitor size={11} /> MusicPro no computador
          </span>
          <h2 className="font-outfit text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            {title ? `${title.split(":")[0]} na tela grande` : "O painel completo na tela grande"}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Gestão, financeiro e relatórios com a visão completa do computador — e tudo sincronizado com o celular.
          </p>
        </div>

        <LaptopFrame src={current?.url} alt={current?.alt || "MusicPro no computador"} />

        {shots.length > 1 && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {shots.map((shot, i) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver print ${i + 1}`}
                className={cn(
                  "h-12 w-20 rounded-lg overflow-hidden border-2 transition-all",
                  i === index ? "border-primary shadow-md" : "border-border/60 opacity-60 hover:opacity-100"
                )}
              >
                <img src={shot.url} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Galeria de prints do sistema (imagens adicionais por funcionalidade). */export function MediaGallery({ images }: { images: SeoMediaRow[] }) {
  const shots = (images || []).filter((i) => i?.url);
  if (shots.length === 0) return null;
  return (
    <section className="mt-14">
      <h2 className="font-outfit text-xl sm:text-2xl font-extrabold tracking-tight mb-5">
        Por dentro do sistema
      </h2>
      <div className={cn("grid gap-4", shots.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
        {shots.map((img) => (
          <figure key={img.id} className="rounded-2xl border border-border/60 bg-card/40 p-1.5 shadow-xl shadow-primary/5 backdrop-blur-xl">
            <img
              src={img.url}
              alt={img.alt || "Tela do MusicPro"}
              loading="lazy"
              decoding="async"
              className="w-full h-auto rounded-xl border border-border/40"
            />
            {img.alt && <figcaption className="px-2 py-1.5 text-[11px] text-muted-foreground">{img.alt}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}
