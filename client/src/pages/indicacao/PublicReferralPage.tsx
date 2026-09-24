// ─── Landing pública de indicação (/indicacao/:codigo) ───────────────────────
// Mostra a escola indicadora, o benefício (dias grátis) e leva ao cadastro com
// o código preservado. O código é revalidado no backend no momento do cadastro.

import { useEffect } from "react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Gift, Music2, CheckCircle2, Sparkles, Users, CalendarDays,
  Wallet, GraduationCap, ArrowRight, Loader2, AlertTriangle,
} from "lucide-react";

export const REFERRAL_STORAGE_KEY = "mp_referral_code";
export const REFERRAL_STORAGE_TTL_DAYS = 1;

export function saveReferralCode(code: string) {
  try {
    sessionStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() }));
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch { /* storage indisponível */ }
}

export function clearReferralCode() {
  try {
    sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch { /* storage indisponível */ }
}

export function readReferralCode(): string | null {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    const raw = sessionStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code || !parsed?.savedAt) return null;
    const ageMs = Date.now() - Number(parsed.savedAt);
    if (ageMs > REFERRAL_STORAGE_TTL_DAYS * 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return String(parsed.code);
  } catch {
    return null;
  }
}

const BENEFITS = [
  { icon: Users, label: "Gestão de alunos" },
  { icon: CalendarDays, label: "Agenda inteligente" },
  { icon: Wallet, label: "Financeiro completo" },
  { icon: GraduationCap, label: "Acompanhamento dos alunos" },
];

export default function PublicReferralPage({ params }: { params?: { codigo?: string } }) {
  const code = String(params?.codigo || "").trim().toUpperCase();
  const { data, isLoading } = trpc.referral.getPublicInfo.useQuery(
    { code },
    { enabled: code.length >= 2, retry: false }
  );

  // Guarda o código para sobreviver à navegação até o cadastro
  useEffect(() => {
    if (data?.valid && data.active && code) saveReferralCode(code);
  }, [data?.valid, data?.active, code]);

  // IMPORTANTE: esta página é renderizada fora do <Switch> do wouter (bloco
  // especial do Router). Usar `navigate()` (pushState) NÃO re-renderiza o bloco
  // e a tela ficava "presa" — por isso a navegação é completa (full reload).
  const go = (path: string) => {
    window.location.href = path;
  };
  const startSignup = () => go(`/cadastro?ref=${encodeURIComponent(code)}`);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col">
      <header className="w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center">
            <Music2 size={18} className="text-white" />
          </div>
          <span className="font-black tracking-tight text-lg">MusicPro</span>
        </div>
        <a href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
          Já sou cliente
        </a>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 flex flex-col items-center justify-center text-center py-12">
        {isLoading ? (
          <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
        ) : !data?.valid ? (
          <div className="space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
            <h1 className="text-2xl font-black">Link de indicação inválido</h1>
            <p className="text-slate-400 max-w-md">
              Este código não foi encontrado ou não está mais ativo. Você ainda pode conhecer o MusicPro
              e começar gratuitamente.
            </p>
            <Button
              onClick={() => go("/cadastro")}
              className="h-12 px-6 rounded-2xl bg-violet-600 hover:bg-violet-700 font-black"
            >
              Conhecer o MusicPro <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        ) : !data.active ? (
          <div className="space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
            <h1 className="text-2xl font-black">Programa temporariamente indisponível</h1>
            <p className="text-slate-400 max-w-md">
              As indicações estão pausadas no momento. Você ainda pode começar a usar o MusicPro.
            </p>
            <Button
              onClick={() => go("/cadastro")}
              className="h-12 px-6 rounded-2xl bg-violet-600 hover:bg-violet-700 font-black"
            >
              Começar grátis <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-black uppercase tracking-widest mb-8">
              <Gift size={14} /> {data.headline || "Sua escola foi indicada!"}
            </div>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Sua escola foi indicada por
              <span className="block mt-2 bg-gradient-to-r from-violet-400 to-indigo-300 bg-clip-text text-transparent">
                {data.schoolName || "uma escola MusicPro"}
              </span>
            </h1>

            <p className="mt-5 text-lg text-slate-300 max-w-xl">
              {data.subtitle || `Comece agora no MusicPro com ${data.trialDays} dias grátis e organize sua escola de música.`}
            </p>

            <div className="mt-8 flex items-center gap-3 flex-wrap justify-center">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-black text-sm">
                <CheckCircle2 size={16} /> {data.trialDays} dias grátis
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-bold text-sm">
                Sem cartão de crédito
              </span>
            </div>

            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl">
              {BENEFITS.map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center gap-2">
                  <Icon size={18} className="text-violet-300" />
                  <span className="text-xs font-bold text-slate-300 text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={startSignup}
              className="mt-10 h-14 px-10 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-violet-600/20"
            >
              Começar grátis <ArrowRight size={18} className="ml-2" />
            </Button>

            {data.rewardSummary && (
              <p className="mt-6 text-xs text-slate-400 flex items-center gap-2">
                <Sparkles size={12} /> Quem indicou ganha: {data.rewardSummary}
              </p>
            )}
          </>
        )}
      </main>

      <footer className="w-full max-w-5xl mx-auto px-6 py-6 text-center text-xs text-slate-500">
        <a href="/termos-de-uso" className="hover:text-slate-300 transition-colors">Termos de Uso</a>
        <span className="mx-2">·</span>
        <a href="/politica-privacidade" className="hover:text-slate-300 transition-colors">Política de Privacidade</a>
      </footer>
    </div>
  );
}
