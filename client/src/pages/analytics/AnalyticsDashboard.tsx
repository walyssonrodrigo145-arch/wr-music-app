/**
 * AnalyticsDashboard.tsx — Dashboard principal do MusicPro Analytics
 * 
 * 14+ abas com métricas completas: visitantes, receita, conversão,
 * heatmap, funil, campanhas, mapa, dispositivos, IA insights e mais.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, Activity, TrendingUp, TrendingDown, DollarSign,
  Globe, Monitor, Smartphone, Tablet, Chrome, Zap,
  Target, MousePointer, Eye, Clock, ArrowRight, Layers,
  BarChart2, Map, Cpu, Brain, FileText, Download, Search,
  AlertCircle, CheckCircle, Info, ArrowUp, ArrowDown,
  RefreshCw, Filter, Calendar,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ── Paleta de cores ───────────────────────────────────────────────────────────
const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];
const GRADIENT_PURPLE = "from-violet-600 to-indigo-600";
const GRADIENT_TEAL = "from-teal-500 to-cyan-500";
const GRADIENT_ROSE = "from-rose-500 to-pink-600";
const GRADIENT_AMBER = "from-amber-500 to-orange-500";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type TabId =
  | "overview" | "realtime" | "visitors" | "sources" | "pages"
  | "heatmap" | "funnel" | "journey" | "checkout" | "revenue"
  | "subscriptions" | "campaigns" | "map" | "devices" | "performance" | "ai";

type Preset = "today" | "yesterday" | "7d" | "30d" | "90d" | "month" | "year" | "custom";

// ── Componentes auxiliares ────────────────────────────────────────────────────

const presetLabels: Record<Preset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  month: "Este mês",
  year: "Este ano",
  custom: "Personalizado",
};

function MetricFilters({ value, onChange }: { value: Preset; onChange: (v: Preset) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(presetLabels) as Preset[]).filter(p => p !== "custom").map((preset) => (
        <button
          key={preset}
          onClick={() => onChange(preset)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
            value === preset
              ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-violet-400/40"
          }`}
        >
          {presetLabels[preset]}
        </button>
      ))}
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  trend?: number; // percentual de variação
  delay?: number;
}

function KPICard({ title, value, subtitle, icon, gradient, trend, delay = 0 }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 backdrop-blur-md p-5 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-10 rounded-full translate-x-8 -translate-y-8`} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest truncate">{title}</p>
          <p className="font-outfit text-3xl font-bold text-foreground mt-1 leading-none">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {trend >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              {Math.abs(trend).toFixed(1)}% vs período anterior
            </div>
          )}
        </div>
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-outfit text-xl font-bold text-foreground flex items-center gap-2">
      {children}
    </h2>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
      <BarChart2 size={40} className="opacity-20" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Aba: Visão Geral ──────────────────────────────────────────────────────────
function OverviewTab({ preset }: { preset: Preset }) {
  const cards = trpc.analytics.query.getDashboardCards.useQuery({ preset });
  const visitors = trpc.analytics.query.getVisitorStats.useQuery({ preset });

  const cardData = cards.data;
  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KPICard
          title="Visitantes Hoje"
          value={cardData?.visitorsToday ?? "—"}
          icon={<Users size={20} className="text-white" />}
          gradient={GRADIENT_PURPLE}
          delay={0}
        />
        <KPICard
          title="Online Agora"
          value={cardData?.onlineNow ?? "—"}
          subtitle="em tempo real"
          icon={<Activity size={20} className="text-white" />}
          gradient={GRADIENT_TEAL}
          delay={0.05}
        />
        <KPICard
          title="Novos Cadastros"
          value={cardData?.signupsToday ?? "—"}
          icon={<Users size={20} className="text-white" />}
          gradient={GRADIENT_PURPLE}
          delay={0.1}
        />
        <KPICard
          title="Assinaturas"
          value={cardData?.subscriptionsToday ?? "—"}
          icon={<CheckCircle size={20} className="text-white" />}
          gradient={GRADIENT_TEAL}
          delay={0.15}
        />
        <KPICard
          title="Conversão"
          value={`${cardData?.conversionRate ?? 0}%`}
          icon={<Target size={20} className="text-white" />}
          gradient={GRADIENT_AMBER}
          delay={0.2}
        />
        <KPICard
          title="Receita Hoje"
          value={formatCurrency(cardData?.revenueToday ?? 0)}
          icon={<DollarSign size={20} className="text-white" />}
          gradient={GRADIENT_ROSE}
          delay={0.25}
        />
        <KPICard
          title="Receita do Mês"
          value={formatCurrency(cardData?.revenueMonth ?? 0)}
          icon={<TrendingUp size={20} className="text-white" />}
          gradient={GRADIENT_ROSE}
          delay={0.3}
        />
        <KPICard
          title="Receita Total"
          value={formatCurrency(cardData?.revenueTotal ?? 0)}
          icon={<DollarSign size={20} className="text-white" />}
          gradient={GRADIENT_AMBER}
          delay={0.35}
        />
        <KPICard
          title="Testes Gratuitos"
          value={cardData?.trialsToday ?? "—"}
          icon={<Zap size={20} className="text-white" />}
          gradient={GRADIENT_PURPLE}
          delay={0.4}
        />
        <KPICard
          title="Visitantes Únicos"
          value={cardData?.uniqueVisitorsToday ?? "—"}
          icon={<Eye size={20} className="text-white" />}
          gradient={GRADIENT_TEAL}
          delay={0.45}
        />
      </div>

      {/* Gráfico de Visitantes */}
      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
        <SectionTitle><TrendingUp size={20} className="text-violet-500" /> Visitantes por Dia</SectionTitle>
        <div className="mt-6 h-64">
          {visitors.data?.byDay && visitors.data.byDay.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visitors.data.byDay}>
                <defs>
                  <linearGradient id="gradSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradUnique" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
                <Area type="monotone" dataKey="sessions" name="Sessões" stroke="#8b5cf6" fill="url(#gradSessions)" strokeWidth={2} />
                <Area type="monotone" dataKey="unique" name="Únicos" stroke="#06b6d4" fill="url(#gradUnique)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Nenhum dado de visitantes ainda. Os dados aparecerão conforme os visitantes acessam o site." />
          )}
        </div>
      </div>

      {/* Visitantes por Hora */}
      {visitors.data?.byHour && visitors.data.byHour.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Clock size={20} className="text-cyan-500" /> Visitantes por Hora</SectionTitle>
          <div className="mt-6 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={visitors.data.byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                  formatter={(v) => [v, "Sessões"]}
                  labelFormatter={(h) => `${h}:00`}
                />
                <Bar dataKey="sessions" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba: Tempo Real ───────────────────────────────────────────────────────────
function RealtimeTab() {
  const { data, refetch } = trpc.analytics.query.getOnlineUsers.useQuery(undefined, { refetchInterval: 10_000 });

  const deviceIcon = (device: string | null) => {
    if (device === "mobile") return <Smartphone size={14} />;
    if (device === "tablet") return <Tablet size={14} />;
    return <Monitor size={14} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
          <span className="font-outfit text-2xl font-bold">{data?.length ?? 0}</span>
          <span className="text-muted-foreground">usuários online agora</span>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Usuário", "Página Atual", "Localização", "Dispositivo", "Browser", "Origem", "Desde"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data || data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Activity size={32} className="opacity-20" />
                      <p>Nenhum usuário online no momento.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((user, i) => (
                  <motion.tr
                    key={user.sessionId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                        <span className="font-medium truncate max-w-[120px]">
                          {user.userName ?? `Anônimo #${user.visitorId.substring(0, 6)}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="text-xs text-muted-foreground truncate block">{user.pageTitle ?? user.pageUrl ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs">{[user.city, user.state, user.country].filter(Boolean).join(", ") || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {deviceIcon(user.deviceType)}
                        <span className="text-xs capitalize">{user.deviceType ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{user.browser ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{user.utmSource ?? "Direto"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(user.enteredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Aba: Origem do Tráfego ────────────────────────────────────────────────────
function SourcesTab({ preset }: { preset: Preset }) {
  const { data } = trpc.analytics.query.getTrafficSources.useQuery({ preset });

  const sourceIcon = (source: string) => {
    const icons: Record<string, string> = {
      google: "🔍", instagram: "📸", facebook: "👥", whatsapp: "💬",
      tiktok: "🎵", youtube: "▶️", linkedin: "💼", direto: "🔗", referencia: "↗️",
    };
    return icons[source.toLowerCase()] ?? "🌐";
  };

  const total = data?.reduce((sum, s) => sum + s.sessions, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Gráfico de Pizza */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Globe size={18} className="text-violet-500" /> Canais de Tráfego</SectionTitle>
          <div className="mt-4 h-56">
            {data && data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="sessions" nameKey="source" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} sessões`]} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState message="Sem dados de tráfego ainda." />}
          </div>
        </div>

        {/* Tabela de fontes */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Origem", "Sessões", "%", "Conversões", "Receita"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!data || data.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">Sem dados ainda.</td></tr>
              ) : (
                data.map((s, i) => (
                  <motion.tr
                    key={s.source}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{sourceIcon(s.source)}</span>
                        <span className="font-medium capitalize">{s.source}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{s.sessions.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{ width: `${total > 0 ? (s.sessions / total * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{s.percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{s.conversions}</td>
                    <td className="px-4 py-3 font-medium text-emerald-600">
                      {s.revenue > 0 ? `R$ ${s.revenue.toFixed(2)}` : "—"}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Aba: Landing Pages ────────────────────────────────────────────────────────
function PagesTab({ preset }: { preset: Preset }) {
  const { data } = trpc.analytics.query.getLandingPages.useQuery({ preset });

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Página", "Visualizações", "Usuários Únicos", "Tempo Médio", "Status"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data || data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                  <EmptyState message="Nenhuma página rastreada ainda." />
                </td>
              </tr>
            ) : (
              data.map((page, i) => (
                <motion.tr
                  key={`${page.pageUrl}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 max-w-[300px]">
                    <div>
                      <p className="font-medium truncate">{page.pageTitle ?? "Sem título"}</p>
                      <p className="text-xs text-muted-foreground truncate">{page.pageUrl ?? ""}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{page.totalViews?.toLocaleString("pt-BR") ?? 0}</td>
                  <td className="px-4 py-3">{page.uniqueVisitors?.toLocaleString("pt-BR") ?? 0}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {page.avgTimeSec ? `${Math.floor(page.avgTimeSec / 60)}m ${page.avgTimeSec % 60}s` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      (page.totalViews ?? 0) > 100 ? "bg-emerald-500/20 text-emerald-600" : "bg-amber-500/20 text-amber-600"
                    }`}>
                      {(page.totalViews ?? 0) > 100 ? "Popular" : "Normal"}
                    </span>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Aba: Funil de Conversão ───────────────────────────────────────────────────
function FunnelTab({ preset }: { preset: Preset }) {
  const { data } = trpc.analytics.query.getConversionFunnel.useQuery({ preset });

  const maxCount = data?.[0]?.count ?? 1;

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-8">
      <SectionTitle><Target size={18} className="text-violet-500" /> Funil de Conversão</SectionTitle>
      <div className="mt-8 space-y-3 max-w-2xl mx-auto">
        {!data || data.length === 0 ? (
          <EmptyState message="Sem dados de funil ainda. Aguarde que os visitantes comecem a navegar." />
        ) : (
          data.map((step, i) => {
            const width = maxCount > 0 ? Math.max((step.count / maxCount) * 100, 4) : 4;
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="origin-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{step.label}</span>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">{step.count.toLocaleString("pt-BR")}</span>
                    <span className="text-emerald-600 font-medium">{step.conversionRate}% conv.</span>
                    {step.loss > 0 && <span className="text-rose-500">-{step.loss.toLocaleString("pt-BR")}</span>}
                  </div>
                </div>
                <div className="h-10 bg-muted rounded-xl overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ delay: i * 0.08, duration: 0.6 }}
                    className="h-full rounded-xl flex items-center justify-end pr-3"
                    style={{ background: `hsl(${260 - i * 15}, 70%, ${55 + i * 3}%)` }}
                  >
                    {step.count > 0 && (
                      <span className="text-white text-xs font-bold">{width.toFixed(0)}%</span>
                    )}
                  </motion.div>
                </div>
                {i < data.length - 1 && (
                  <div className="flex justify-center mt-1">
                    <ArrowRight size={16} className="text-muted-foreground rotate-90" />
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Aba: Checkout ─────────────────────────────────────────────────────────────
function CheckoutTab({ preset }: { preset: Preset }) {
  const { data } = trpc.analytics.query.getCheckoutAnalytics.useQuery({ preset });

  const steps = data ? [
    { label: "Checkout Iniciado", count: data.checkoutStarted, color: "bg-violet-500" },
    { label: "PIX Gerado", count: data.pixGenerated, color: "bg-indigo-500" },
    { label: "Pagamento Confirmado", count: data.paymentSuccess, color: "bg-emerald-500" },
    { label: "Primeiro Login", count: data.firstLogin, color: "bg-teal-500" },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6 space-y-4">
          <SectionTitle><Target size={18} className="text-violet-500" /> Funil de Checkout</SectionTitle>
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-4">
              <div className={`w-10 h-10 ${step.color} rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>{i + 1}</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{step.label}</p>
                <p className="font-outfit text-2xl font-bold">{step.count}</p>
              </div>
              {i < steps.length - 1 && <ArrowRight size={16} className="text-muted-foreground rotate-90" />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><TrendingDown size={18} className="text-rose-500" /> Taxa de Abandono</SectionTitle>
          <div className="mt-6 flex flex-col items-center justify-center gap-4">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#ef4444" strokeWidth="3"
                  strokeDasharray={`${parseFloat(data?.abandonRate ?? "0")} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-outfit text-3xl font-bold text-rose-500">{data?.abandonRate ?? 0}%</span>
                <span className="text-xs text-muted-foreground">abandono</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {data?.checkoutStarted} iniciaram o checkout.<br />
              {data?.paymentFailed ?? 0} pagamentos falharam.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Aba: Receita ──────────────────────────────────────────────────────────────
function RevenueTab({ preset }: { preset: Preset }) {
  const { data } = trpc.analytics.query.getRevenueStats.useQuery({ preset });
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="MRR" value={fmt(data?.mrr ?? 0)} icon={<DollarSign size={20} className="text-white" />} gradient={GRADIENT_TEAL} />
        <KPICard title="ARR" value={fmt(data?.arr ?? 0)} icon={<TrendingUp size={20} className="text-white" />} gradient={GRADIENT_TEAL} delay={0.05} />
        <KPICard title="Ticket Médio" value={fmt(data?.avgTicket ?? 0)} icon={<Target size={20} className="text-white" />} gradient={GRADIENT_AMBER} delay={0.1} />
        <KPICard title="Receita Período" value={fmt(data?.periodRevenue ?? 0)} icon={<DollarSign size={20} className="text-white" />} gradient={GRADIENT_ROSE} delay={0.15} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Receita por Plano */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Layers size={18} className="text-violet-500" /> Receita por Plano</SectionTitle>
          <div className="mt-4 h-48">
            {data?.byPlan && data.byPlan.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byPlan} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <YAxis dataKey="planName" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, "Receita"]} />
                  <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState message="Sem dados de receita por plano." />}
          </div>
        </div>

        {/* Receita por Campanha */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Target size={18} className="text-emerald-500" /> Receita por Campanha</SectionTitle>
          <div className="mt-4 space-y-2">
            {data?.byCampaign && data.byCampaign.length > 0 ? (
              data.byCampaign.map((c, i) => (
                <div key={c.campaign} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium truncate max-w-[180px]">{c.campaign}</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">{fmt(c.revenue)}</span>
                </div>
              ))
            ) : <EmptyState message="Sem dados de campanhas." />}
          </div>
        </div>
      </div>

      {/* Receita por Estado */}
      {data?.byState && data.byState.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Map size={18} className="text-cyan-500" /> Receita por Estado</SectionTitle>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byState.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="state" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, "Receita"]} />
                <Bar dataKey="revenue" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba: Campanhas ────────────────────────────────────────────────────────────
function CampaignsTab({ preset }: { preset: Preset }) {
  const { data } = trpc.analytics.query.getCampaignStats.useQuery({ preset });

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Campanha", "Origem", "Sessões", "Conversões", "Receita", "ROI", "CAC"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data || data.length === 0 ? (
              <tr><td colSpan={7} className="py-16"><EmptyState message="Sem dados de campanhas UTM ainda." /></td></tr>
            ) : (
              data.map((c, i) => (
                <motion.tr
                  key={`${c.campaign}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium max-w-[150px] truncate">{c.campaign}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{c.source}</td>
                  <td className="px-4 py-3">{c.sessions.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">{c.conversions}</td>
                  <td className="px-4 py-3 font-medium text-emerald-600">
                    {c.revenue > 0 ? `R$ ${c.revenue.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {c.roi !== null ? (
                      <span className={`font-medium ${parseFloat(c.roi) >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {parseFloat(c.roi) >= 0 ? "+" : ""}{c.roi}%
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.cac ? `R$ ${c.cac}` : "—"}
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Aba: Dispositivos ─────────────────────────────────────────────────────────
function DevicesTab({ preset }: { preset: Preset }) {
  const { data } = trpc.analytics.query.getDeviceStats.useQuery({ preset });

  const deviceLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    desktop: { label: "Desktop", icon: <Monitor size={18} />, color: "#8b5cf6" },
    mobile: { label: "Mobile", icon: <Smartphone size={18} />, color: "#06b6d4" },
    tablet: { label: "Tablet", icon: <Tablet size={18} />, color: "#f59e0b" },
    tv: { label: "Smart TV", icon: <Monitor size={18} />, color: "#10b981" },
    unknown: { label: "Outros", icon: <Globe size={18} />, color: "#6b7280" },
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        {/* Dispositivos */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Monitor size={18} className="text-violet-500" /> Dispositivos</SectionTitle>
          <div className="mt-4 space-y-3">
            {data?.devices && data.devices.length > 0 ? (
              data.devices.map((d) => {
                const info = deviceLabels[d.device] ?? deviceLabels.unknown;
                const total = data.devices.reduce((sum, x) => sum + x.count, 0);
                const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : "0";
                return (
                  <div key={d.device} className="flex items-center gap-3">
                    <div className="text-muted-foreground">{info.icon}</div>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{info.label}</span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: info.color }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold min-w-[40px] text-right">{d.count}</span>
                  </div>
                );
              })
            ) : <EmptyState message="Sem dados." />}
          </div>
        </div>

        {/* Browsers */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Chrome size={18} className="text-blue-500" /> Navegadores</SectionTitle>
          <div className="mt-4 h-48">
            {data?.browsers && data.browsers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.browsers} dataKey="count" nameKey="browser" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {data.browsers.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState message="Sem dados." />}
          </div>
        </div>

        {/* SO */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Cpu size={18} className="text-emerald-500" /> Sistemas Operacionais</SectionTitle>
          <div className="mt-4 h-48">
            {data?.oses && data.oses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.oses} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="os" type="category" tick={{ fontSize: 10 }} width={60} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState message="Sem dados." />}
          </div>
        </div>
      </div>

      {/* Resoluções */}
      {data?.resolutions && data.resolutions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Monitor size={18} className="text-amber-500" /> Resoluções de Tela</SectionTitle>
          <div className="mt-4 flex flex-wrap gap-3">
            {data.resolutions.map((r, i) => (
              <div key={r.res} className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-sm">
                <span className="font-mono font-medium">{r.res}</span>
                <span className="ml-2 text-muted-foreground text-xs">({r.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aba: Heatmap ──────────────────────────────────────────────────────────────
function HeatmapTab() {
  const [pageUrl, setPageUrl] = useState("/");
  const [eventType, setEventType] = useState<"click" | "move" | "scroll">("click");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data } = trpc.analytics.query.getHeatmapData.useQuery({ pageUrl, eventType, limit: 2000 });

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const maxCount = Math.max(...data.map((d) => d.count), 1);

    data.forEach((point) => {
      const x = (parseFloat(String(point.xPercent)) / 100) * canvas.width;
      const y = (parseFloat(String(point.yPercent)) / 100) * canvas.height;
      const intensity = point.count / maxCount;
      const radius = 20 + intensity * 20;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(139, 92, 246, ${intensity * 0.8})`);
      gradient.addColorStop(0.5, `rgba(99, 102, 241, ${intensity * 0.3})`);
      gradient.addColorStop(1, "rgba(99, 102, 241, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="px-3 py-2 rounded-xl border border-border bg-card text-sm min-w-[200px]"
          placeholder="URL da página (ex: /)"
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
        />
        {(["click", "move", "scroll"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setEventType(t)}
            className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
              eventType === t ? "bg-violet-600 text-white" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {t === "click" ? "🖱️ Cliques" : t === "move" ? "↗️ Movimento" : "📜 Scroll"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
        <SectionTitle><MousePointer size={18} className="text-violet-500" /> Mapa de Calor</SectionTitle>
        <div className="mt-4 relative">
          <div className="w-full bg-muted/30 rounded-xl" style={{ paddingBottom: "56.25%" }}>
            <canvas
              ref={canvasRef}
              width={1200}
              height={675}
              className="absolute inset-0 w-full h-full rounded-xl"
            />
            {(!data || data.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <EmptyState message={`Nenhum dado de ${eventType} para esta página ainda.`} />
              </div>
            )}
          </div>
        </div>
        {data && data.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {data.length} pontos de interação registrados na página "{pageUrl}"
          </p>
        )}
      </div>
    </div>
  );
}

// ── Aba: IA Insights ──────────────────────────────────────────────────────────
function AIInsightsTab() {
  const { data, refetch } = trpc.analytics.query.getAIInsights.useQuery();
  const markRead = trpc.analytics.query.markInsightRead.useMutation({ onSuccess: () => refetch() });

  const severityConfig = {
    critical: { color: "border-rose-500/50 bg-rose-500/10", icon: <AlertCircle size={18} className="text-rose-500" />, label: "Crítico" },
    warning: { color: "border-amber-500/50 bg-amber-500/10", icon: <AlertCircle size={18} className="text-amber-500" />, label: "Atenção" },
    success: { color: "border-emerald-500/50 bg-emerald-500/10", icon: <CheckCircle size={18} className="text-emerald-500" />, label: "Positivo" },
    info: { color: "border-blue-500/50 bg-blue-500/10", icon: <Info size={18} className="text-blue-500" />, label: "Info" },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle><Brain size={18} className="text-violet-500" /> Insights da IA</SectionTitle>
        <button onClick={() => refetch()} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {!data || data.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-12">
          <EmptyState message="Nenhum insight gerado ainda. A IA analisa os dados diariamente e gerará recomendações conforme os dados chegam." />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.map((insight, i) => {
            const cfg = severityConfig[insight.severity as keyof typeof severityConfig] ?? severityConfig.info;
            return (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`rounded-2xl border p-5 ${cfg.color} ${insight.isRead ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {cfg.icon}
                    <span className="text-xs font-semibold uppercase tracking-wider">{cfg.label}</span>
                  </div>
                  {!insight.isRead && (
                    <button
                      onClick={() => markRead.mutate({ id: insight.id })}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Marcar lido
                    </button>
                  )}
                </div>
                <h3 className="font-semibold mt-3 text-foreground">{insight.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                {insight.recommendation && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Recomendação</p>
                    <p className="text-sm">{insight.recommendation}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-3">
                  {new Date(insight.generatedAt).toLocaleString("pt-BR")}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Aba: Mapa Geográfico ──────────────────────────────────────────────────────
function GeoTab({ preset }: { preset: Preset }) {
  const { data } = trpc.analytics.query.getGeoStats.useQuery({ preset });
  const totalByState = data?.byState.reduce((sum, s) => sum + s.count, 0) ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Por Estado */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Map size={18} className="text-violet-500" /> Por Estado</SectionTitle>
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
            {!data?.byState || data.byState.length === 0 ? (
              <EmptyState message="Sem dados geográficos ainda." />
            ) : (
              data.byState.map((s, i) => (
                <div key={s.state} className="flex items-center gap-3">
                  <span className="w-6 text-xs text-muted-foreground text-right flex-shrink-0">{i + 1}.</span>
                  <span className="text-sm font-medium w-32 truncate flex-shrink-0">{s.state}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                      style={{ width: `${(s.count / totalByState) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold min-w-[40px] text-right">{s.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Por País */}
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Globe size={18} className="text-teal-500" /> Por País</SectionTitle>
          <div className="mt-4 h-56">
            {data?.byCountry && data.byCountry.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.byCountry} dataKey="count" nameKey="country" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {data.byCountry.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState message="Sem dados por país." />}
          </div>
        </div>
      </div>

      {/* Top Cidades */}
      {data?.byCity && data.byCity.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md p-6">
          <SectionTitle><Map size={18} className="text-cyan-500" /> Top Cidades</SectionTitle>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.byCity.slice(0, 15).map((c, i) => (
              <div key={`${c.city}-${i}`} className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center">
                <p className="font-semibold text-sm truncate">{c.city}</p>
                <p className="text-xs text-muted-foreground">{c.state}</p>
                <p className="font-outfit text-xl font-bold mt-1">{c.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TABS config ───────────────────────────────────────────────────────────────
const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Visão Geral", icon: <BarChart2 size={16} /> },
  { id: "realtime", label: "Tempo Real", icon: <Activity size={16} /> },
  { id: "visitors", label: "Visitantes", icon: <Users size={16} /> },
  { id: "sources", label: "Origens", icon: <Globe size={16} /> },
  { id: "pages", label: "Páginas", icon: <FileText size={16} /> },
  { id: "heatmap", label: "Heatmap", icon: <MousePointer size={16} /> },
  { id: "funnel", label: "Funil", icon: <Target size={16} /> },
  { id: "checkout", label: "Checkout", icon: <CheckCircle size={16} /> },
  { id: "revenue", label: "Receita", icon: <DollarSign size={16} /> },
  { id: "campaigns", label: "Campanhas", icon: <Zap size={16} /> },
  { id: "map", label: "Mapa", icon: <Map size={16} /> },
  { id: "devices", label: "Dispositivos", icon: <Monitor size={16} /> },
  { id: "ai", label: "IA Insights", icon: <Brain size={16} /> },
];

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [preset, setPreset] = useState<Preset>("30d");
  const { user } = useAuth();

  const tabsWithFilter: TabId[] = ["overview", "visitors", "sources", "pages", "funnel", "checkout", "revenue", "campaigns", "map", "devices"];
  const showFilter = tabsWithFilter.includes(activeTab);

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab preset={preset} />;
      case "realtime": return <RealtimeTab />;
      case "visitors": return <OverviewTab preset={preset} />;  // shares visitor graphs
      case "sources": return <SourcesTab preset={preset} />;
      case "pages": return <PagesTab preset={preset} />;
      case "heatmap": return <HeatmapTab />;
      case "funnel": return <FunnelTab preset={preset} />;
      case "checkout": return <CheckoutTab preset={preset} />;
      case "revenue": return <RevenueTab preset={preset} />;
      case "campaigns": return <CampaignsTab preset={preset} />;
      case "map": return <GeoTab preset={preset} />;
      case "devices": return <DevicesTab preset={preset} />;
      case "ai": return <AIInsightsTab />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden border-b border-border bg-card/60 backdrop-blur-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-transparent" />
        <div className="relative px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-emerald-600 uppercase tracking-widest">Live</span>
              </div>
              <h1 className="font-outfit text-2xl md:text-3xl font-bold text-foreground">
                MusicPro <span className="text-violet-600">Analytics</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Monitoramento completo da plataforma · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            {showFilter && (
              <div className="hidden md:block">
                <MetricFilters value={preset} onChange={setPreset} />
              </div>
            )}
          </div>
          {showFilter && (
            <div className="md:hidden mt-3">
              <MetricFilters value={preset} onChange={setPreset} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex overflow-x-auto scrollbar-none px-4 gap-1 py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                activeTab === tab.id
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "realtime" && (
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
