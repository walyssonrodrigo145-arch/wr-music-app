// ─── Anúncio do Programa Indique & Ganhe (2x ao dia: manhã e tarde) ──────────
// Exibido para admin (e professor com acesso à página /indicacoes). O controle
// de frequência é local (localStorage): uma exibição por período por dia.
// Períodos: manhã (00:00–11:59) e tarde (12:00–23:59).

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isPageAllowed } from "@shared/permissions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gift, Copy, ArrowRight, MessageCircle, Sparkles, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "mp_referral_promo_v1";

type Period = "morning" | "afternoon";
interface ShownRecord {
  morning?: string;
  afternoon?: string;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentPeriod(): Period {
  return new Date().getHours() < 12 ? "morning" : "afternoon";
}

function readShown(): ShownRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ShownRecord) : {};
  } catch {
    return {};
  }
}

function markShown(period: Period): void {
  try {
    const record = readShown();
    record[period] = todayKey();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* storage indisponível */
  }
}

export function ReferralPromoModal() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const canSee =
    user?.role === "admin" ||
    (user?.role === "professor" && isPageAllowed(((user as any)?.permissions as string[]) || [], "/indicacoes"));

  const { data: program } = trpc.referral.getMyProgram.useQuery(undefined, {
    enabled: canSee && open,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Decide abrir: uma vez por período (manhã/tarde) a cada dia
  useEffect(() => {
    if (!canSee || !user) return;
    const period = currentPeriod();
    if (readShown()[period] === todayKey()) return;

    const timer = setTimeout(() => {
      markShown(period);
      setOpen(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [canSee, user]);

  if (!canSee) return null;

  const copyLink = async () => {
    if (!program?.link) return;
    try {
      await navigator.clipboard.writeText(program.link);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar. Link: " + program.link);
    }
  };

  const shareWhatsApp = () => {
    if (!program?.link) return;
    const message = (program.summary.whatsappMessage || `Conheça o MusicPro: ${program.link}`).replace(/\n/g, "%0A");
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const goToProgram = () => {
    setOpen(false);
    navigate("/indicacoes");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md rounded-3xl border-0 shadow-2xl p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-violet-600 to-indigo-600 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-10">
            <Gift size={130} className="translate-x-6 -translate-y-6" />
          </div>
          <DialogHeader>
            <div className="flex items-start gap-3 relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm">
                <Gift size={22} className="text-white" />
              </div>
              <div>
                <p className="text-violet-200 text-xs font-bold uppercase tracking-wider mb-1">Programa de indicação</p>
                <DialogTitle className="text-white font-black text-xl leading-tight">
                  Indique & Ganhe
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Indique escolas para o MusicPro e ganhe desconto na sua mensalidade:
          </p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "1ª indicação", value: "30% OFF" },
              { label: "2ª indicação", value: "60% OFF" },
              { label: "3ª indicação", value: "GRÁTIS" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border bg-muted/30 p-3 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
                <p className="text-sm font-black text-violet-600 dark:text-violet-400 mt-1">{item.value}</p>
              </div>
            ))}
          </div>

          {program?.link ? (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Seu link exclusivo</p>
              <div className="rounded-xl bg-muted/40 border border-border/60 px-3 py-2 text-xs font-mono text-muted-foreground break-all">
                {program.link}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={copyLink}
                  variant="outline"
                  className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  {copied ? <CheckCircle2 size={14} className="mr-2 text-emerald-500" /> : <Copy size={14} className="mr-2" />}
                  {copied ? "Copiado!" : "Copiar link"}
                </Button>
                <Button
                  onClick={shareWhatsApp}
                  variant="outline"
                  className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                >
                  <MessageCircle size={14} className="mr-2" /> WhatsApp
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles size={12} /> Seu link exclusivo está sendo preparado…
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={goToProgram}
              className="w-full h-12 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-[11px] uppercase tracking-widest"
            >
              Ver meu link e indicações <ArrowRight size={15} className="ml-2" />
            </Button>
            <Button
              onClick={() => setOpen(false)}
              variant="ghost"
              className="w-full h-10 rounded-2xl font-black text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              Agora não
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
