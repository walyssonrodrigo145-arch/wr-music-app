// ─── SuperAdmin: Programa Indique & Ganhe (/programa-indicacao) ───────────────
// Configuração exclusiva do SUPERADMIN + listas, métricas, antifraude e auditoria.
// O backend valida o papel (isSuperAdmin) em todas as procedures.

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Gift, Settings, ListChecks, Ticket, ShieldAlert, ScrollText,
  Loader2, Save, Trophy, TrendingUp, Ban, Activity,
} from "lucide-react";

type TabId = "dashboard" | "config" | "referrals" | "rewards" | "fraud" | "audit";

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "Visão geral", icon: <Activity size={15} /> },
  { id: "config", label: "Configurações", icon: <Settings size={15} /> },
  { id: "referrals", label: "Indicações", icon: <ListChecks size={15} /> },
  { id: "rewards", label: "Recompensas", icon: <Ticket size={15} /> },
  { id: "fraud", label: "Antifraude", icon: <ShieldAlert size={15} /> },
  { id: "audit", label: "Auditoria", icon: <ScrollText size={15} /> },
];

const STATUS_CLS: Record<string, string> = {
  PENDENTE: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  TESTE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  CONVERTIDA: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  RECOMPENSA_LIBERADA: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  RECOMPENSA_UTILIZADA: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  CANCELADA: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  EXPIRADA: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  FRAUDE: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  DISPONIVEL: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  UTILIZADA: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
};

function Badge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", STATUS_CLS[status] ?? STATUS_CLS.PENDENTE)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(iso: string | Date | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DashboardTab() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = trpc.referral.adminDashboard.useQuery({ days });
  if (isLoading || !data) return <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto my-12" />;
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[7, 30, 90, 365].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-colors",
              days === d ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {d === 365 ? "Ano" : `${d} dias`}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Indicações totais", value: data.totals.total, cls: "" },
          { label: "Em teste", value: data.totals.inTrial, cls: "text-amber-600 dark:text-amber-400" },
          { label: "Convertidas", value: data.totals.converted, cls: "text-emerald-600 dark:text-emerald-400" },
          { label: "Canceladas", value: data.totals.canceled, cls: "text-rose-600 dark:text-rose-400" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className={cn("text-2xl font-black mt-1 tabular-nums", cls)}>{value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Taxa de conversão</p>
          <p className="text-2xl font-black mt-1">{data.totals.conversionRate}%</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recompensas geradas</p>
          <p className="text-2xl font-black mt-1">{data.rewards.generated}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recompensas disponíveis</p>
          <p className="text-2xl font-black mt-1 text-violet-600 dark:text-violet-400">{data.rewards.available}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor utilizado</p>
          <p className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">{fmtBRL(data.rewards.usedValueCents)}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={16} className="text-amber-500" />
          <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Escolas que mais indicaram (interno)</span>
        </div>
        {data.ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conversão ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.ranking.map((r, i) => (
              <div key={r.orgId} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                  {r.name}
                </span>
                <span className="font-black tabular-nums">{r.count} indicação(ões)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.referral.adminGetConfig.useQuery();
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (data && !form) setForm({ ...data });
  }, [data, form]);

  const saveMutation = trpc.referral.adminUpdateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração do programa salva!");
      utils.referral.adminGetConfig.invalidate();
      utils.referral.getMyProgram.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  if (isLoading || !form) return <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto my-12" />;

  const numberField = (key: string, label: string, min: number, max: number, suffix?: string) => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={form[key] ?? 0}
          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
          className="w-28 h-10 rounded-xl border border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );

  const toggleField = (key: string, label: string, description: string) => (
    <button
      type="button"
      onClick={() => setForm({ ...form, [key]: !form[key] })}
      className={cn(
        "flex items-center justify-between gap-4 w-full rounded-2xl border p-4 text-left transition-colors",
        form[key] ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"
      )}
    >
      <div>
        <p className="text-sm font-black">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <span className={cn(
        "shrink-0 w-12 h-7 rounded-full p-1 transition-colors",
        form[key] ? "bg-emerald-500" : "bg-muted"
      )}>
        <span className={cn("block w-5 h-5 rounded-full bg-white transition-transform", form[key] && "translate-x-5")} />
      </span>
    </button>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      {toggleField("active", "Programa ativo", "Quando desativado, novas indicações não são criadas; recompensas já conquistadas continuam válidas.")}
      <div className="grid sm:grid-cols-2 gap-4">
        {numberField("trialDays", "Dias grátis para nova escola", 0, 90, "dias")}
        {numberField("cycleSize", "Tamanho do ciclo (indicações)", 1, 12, "conversões")}
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {numberField("rewardPercent1", "1ª do ciclo", 0, 100, "% OFF")}
        {numberField("rewardPercent2", "2ª do ciclo", 0, 100, "% OFF")}
        {numberField("rewardPercent3", "3ª do ciclo", 0, 100, "% OFF")}
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {numberField("maxDiscountPercent", "Desconto máximo por mensalidade", 0, 100, "%")}
        {numberField("rewardValidityDays", "Validade da recompensa", 0, 3650, "dias (0 = sem validade)")}
        {numberField("minActiveDays", "Permanência mínima do indicado", 0, 365, "dias de assinatura ativa")}
      </div>
      <div className="grid sm:grid-cols-1 gap-4">
        {toggleField("allowAccumulation", "Permitir acumular recompensas", "Se desligado, apenas o desconto mais antigo é aplicado por cobrança.")}
        {toggleField("blockSelfReferral", "Bloquear autoindicação", "Impede que a própria escola (ou seu e-mail) use o próprio código.")}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título da página pública</label>
          <input
            value={form.pageHeadline ?? ""}
            onChange={(e) => setForm({ ...form, pageHeadline: e.target.value })}
            className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtítulo da página pública</label>
          <input
            value={form.pageSubtitle ?? ""}
            onChange={(e) => setForm({ ...form, pageSubtitle: e.target.value })}
            className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      <Button
        onClick={() => saveMutation.mutate({
          active: form.active,
          trialDays: form.trialDays,
          cycleSize: form.cycleSize,
          rewardPercent1: form.rewardPercent1,
          rewardPercent2: form.rewardPercent2,
          rewardPercent3: form.rewardPercent3,
          maxDiscountPercent: form.maxDiscountPercent,
          rewardValidityDays: form.rewardValidityDays,
          minActiveDays: form.minActiveDays,
          allowAccumulation: form.allowAccumulation,
          blockSelfReferral: form.blockSelfReferral,
          pageHeadline: form.pageHeadline,
          pageSubtitle: form.pageSubtitle || null,
        })}
        disabled={saveMutation.isPending}
        className="h-11 rounded-2xl font-black text-[11px] uppercase tracking-widest"
      >
        {saveMutation.isPending ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Save size={15} className="mr-2" />}
        Salvar configurações
      </Button>
    </div>
  );
}

function ReferralsTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.referral.adminListReferrals.useQuery();
  const fraudMutation = trpc.referral.adminMarkFraud.useMutation({
    onSuccess: () => {
      toast.success("Indicação marcada como fraude. Recompensas canceladas.");
      utils.referral.adminListReferrals.invalidate();
      utils.referral.adminDashboard.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  if (isLoading || !data) return <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto my-12" />;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Indicadora", "Indicada", "Código", "Status", "Ciclo", "Criada em", "Convertida em", "Ações"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Nenhuma indicação registrada.</td></tr>
            ) : data.map((r: any) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-4 py-3">{r.referrerName}</td>
                <td className="px-4 py-3">{r.referredName}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-3"><Badge status={r.status} /></td>
                <td className="px-4 py-3 tabular-nums">{r.cyclePosition > 0 ? `${r.cyclePosition}ª (${r.rewardPercent}%)` : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.convertedAt)}</td>
                <td className="px-4 py-3">
                  {!["FRAUDE", "CANCELADA"].includes(r.status) && (
                    <button
                      onClick={() => {
                        const reason = window.prompt("Motivo da marcação como fraude:", "Conta duplicada");
                        if (reason === null) return;
                        fraudMutation.mutate({ referralId: r.id, reason });
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      <Ban size={12} /> Marcar fraude
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RewardsTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.referral.adminListRewards.useQuery();
  const cancelMutation = trpc.referral.adminCancelReward.useMutation({
    onSuccess: () => {
      toast.success("Recompensa cancelada.");
      utils.referral.adminListRewards.invalidate();
      utils.referral.adminDashboard.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  if (isLoading || !data) return <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto my-12" />;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Escola", "Benefício", "Aplicado", "Status", "Liberada", "Validade", "Ações"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhuma recompensa gerada.</td></tr>
            ) : data.map((r: any) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="px-4 py-3">{r.organizationName}</td>
                <td className="px-4 py-3 font-black">{r.percent}% OFF</td>
                <td className="px-4 py-3 tabular-nums">{r.appliedValueCents > 0 ? fmtBRL(r.appliedValueCents) : "—"}</td>
                <td className="px-4 py-3"><Badge status={r.status} /></td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(r.releasedAt)}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.expiresAt ? fmtDate(r.expiresAt) : "Sem validade"}</td>
                <td className="px-4 py-3">
                  {["DISPONIVEL", "PARCIALMENTE_UTILIZADA"].includes(r.status) && (
                    <button
                      onClick={() => {
                        const reason = window.prompt("Motivo do cancelamento:", "Cancelada pelo SuperAdmin");
                        if (reason === null) return;
                        cancelMutation.mutate({ rewardId: r.id, reason });
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      <Ban size={12} /> Cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FraudTab() {
  const { data, isLoading } = trpc.referral.adminFraudSignals.useQuery();
  if (isLoading || !data) return <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto my-12" />;
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3">
          Mesmo IP em indicações diferentes ({data.sameIp.length})
        </p>
        {data.sameIp.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum sinal de IP duplicado.</p>
        ) : (
          <div className="space-y-2">
            {data.sameIp.map((s) => (
              <div key={s.ip} className="flex items-center justify-between gap-3 text-sm rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <span className="font-mono text-xs">{s.ip}</span>
                <span className="text-xs font-bold">{s.referralIds.length} indicações</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            Indicações marcadas como fraude/canceladas ({data.flagged.length})
          </p>
        </div>
        {data.flagged.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Nenhuma indicação sinalizada.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {data.flagged.map((f: any) => (
              <div key={f.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-mono text-xs text-muted-foreground">{f.code}</span>
                  <p className="text-xs mt-0.5">{f.fraudReason || "—"}</p>
                </div>
                <Badge status={f.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AuditTab() {
  const { data, isLoading } = trpc.referral.adminEvents.useQuery({ limit: 200 });
  if (isLoading || !data) return <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto my-12" />;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Evento", "Mensagem", "Quando"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">Nenhum evento registrado.</td></tr>
            ) : data.map((e: any) => (
              <tr key={e.id} className="border-b border-border/50">
                <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">{e.type}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{e.message || "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(e.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReferralAdmin() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<TabId>("dashboard");

  if (!loading && !user?.isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center p-8">
        <ShieldAlert className="w-12 h-12 text-rose-500" />
        <h1 className="text-xl font-black">Acesso Negado</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          O Programa de Indicação é configurável exclusivamente pelo Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
          <Gift className="text-primary" /> Programa de Indicação
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuração, acompanhamento e antifraude do Indique & Ganhe. Exclusivo do Super Admin.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-colors",
              tab === t.id
                ? "bg-primary text-white border-primary shadow"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab />}
      {tab === "config" && <ConfigTab />}
      {tab === "referrals" && <ReferralsTab />}
      {tab === "rewards" && <RewardsTab />}
      {tab === "fraud" && <FraudTab />}
      {tab === "audit" && <AuditTab />}

      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 pt-4">
        <TrendingUp size={11} /> Regra vigente: 1ª convertida = 30% OFF · 2ª = 60% OFF · 3ª = mensalidade grátis (ciclo reinicia).
      </p>
    </div>
  );
}
