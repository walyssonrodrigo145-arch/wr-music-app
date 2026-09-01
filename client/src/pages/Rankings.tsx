import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Users,
  X,
  Loader2,
  History as HistoryIcon,
  ShieldCheck,
  Crown,
  CalendarDays,
  Lock,
  Globe,
} from "lucide-react";

// ─── Config de status (§11) ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  agendado: { label: "Agendado", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  ativo: { label: "Ativo", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  encerrado: { label: "Encerrado", cls: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  cancelado: { label: "Cancelado", cls: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
};

const PERIOD_PRESETS = [
  { id: "semanal", label: "1 Semana", days: 7 },
  { id: "mensal", label: "1 Mês", days: 30 },
  { id: "bimestral", label: "2 Meses", days: 60 },
  { id: "trimestral", label: "3 Meses", days: 90 },
  { id: "semestral", label: "6 Meses", days: 180 },
  { id: "anual", label: "1 Ano", days: 365 },
];

const LEVELS = [
  { id: "iniciante", label: "Iniciante" },
  { id: "intermediario", label: "Intermediário" },
  { id: "avancado", label: "Avançado" },
];

const WEIGHT_FIELDS = [
  { key: "presenca", label: "Presença" },
  { key: "atividades", label: "Atividades" },
  { key: "pratica", label: "Prática" },
  { key: "evolucao", label: "Evolução" },
  { key: "desafios", label: "Desafios" },
] as const;

interface EditorState {
  id?: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  participantRule: "todos" | "instrumento" | "nivel" | "manual";
  instrumentId: string;
  level: string;
  participantStudentIds: number[];
  visibility: "publico" | "privado";
  showFullName: boolean;
  showAvatar: boolean;
  showScores: boolean;
  showEvolution: boolean;
  showParticipants: boolean;
  privateTopRange: number;
  weights: Record<string, number>;
}

const emptyEditor = (): EditorState => ({
  name: "",
  description: "",
  startDate: format(new Date(), "yyyy-MM-dd"),
  endDate: format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd"),
  participantRule: "todos",
  instrumentId: "",
  level: "",
  participantStudentIds: [],
  visibility: "publico",
  showFullName: false,
  showAvatar: true,
  showScores: true,
  showEvolution: true,
  showParticipants: true,
  privateTopRange: 10,
  weights: { presenca: 20, atividades: 30, pratica: 25, evolucao: 15, desafios: 10 },
});

export default function Rankings() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("todos");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(emptyEditor());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [auditStudentId, setAuditStudentId] = useState<number | null>(null);
  const [ajustePoints, setAjustePoints] = useState("");
  const [ajusteReason, setAjusteReason] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [encerrarId, setEncerrarId] = useState<number | null>(null);

  const { data: rankings = [], isLoading } = trpc.rankings.list.useQuery({ status: statusFilter as any });
  const { data: instrumentsList = [] } = trpc.instruments.list.useQuery();
  const { data: studentsList = [] } = trpc.rankings.listStudents.useQuery();
  const { data: detail } = trpc.rankings.standings.useQuery(
    { id: detailId! },
    { enabled: !!detailId }
  );
  const { data: historic = [] } = trpc.rankings.historic.useQuery();
  const { data: audit } = trpc.rankings.auditoria.useQuery(
    { rankingId: detailId!, studentId: auditStudentId! },
    { enabled: !!detailId && !!auditStudentId }
  );

  const createMutation = trpc.rankings.create.useMutation({
    onSuccess: () => {
      toast.success("Ranking criado com sucesso!");
      utils.rankings.list.invalidate();
      setEditorOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.rankings.update.useMutation({
    onSuccess: () => {
      toast.success("Ranking atualizado!");
      utils.rankings.list.invalidate();
      utils.rankings.standings.invalidate();
      setEditorOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.rankings.delete.useMutation({
    onSuccess: () => {
      toast.success("Ranking removido!");
      utils.rankings.list.invalidate();
      setDeleteId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const encerrarMutation = trpc.rankings.encerrar.useMutation({
    onSuccess: () => {
      toast.success("Ranking encerrado! Resultado calculado e congelado.");
      utils.rankings.list.invalidate();
      utils.rankings.standings.invalidate();
      utils.rankings.historic.invalidate();
      setEncerrarId(null);
    },
    onError: (e) => toast.error(e.message),
  });
  const ajusteMutation = trpc.rankings.ajuste.useMutation({
    onSuccess: () => {
      toast.success("Ajuste registrado com trilha de auditoria!");
      utils.rankings.standings.invalidate();
      utils.rankings.auditoria.invalidate();
      setAjustePoints("");
      setAjusteReason("");
    },
    onError: (e) => toast.error(e.message),
  });

  const weightTotal = useMemo(
    () => Object.values(editor.weights).reduce((a, b) => a + (Number(b) || 0), 0),
    [editor.weights]
  );

  const openCreate = () => {
    setEditor(emptyEditor());
    setEditorOpen(true);
  };

  const openEdit = (r: any) => {
    setEditor({
      id: r.id,
      name: r.name,
      description: r.description || "",
      startDate: format(new Date(r.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(r.endDate), "yyyy-MM-dd"),
      participantRule: r.participantRule,
      instrumentId: r.instrumentId ? String(r.instrumentId) : "",
      level: r.level || "",
      participantStudentIds: [],
      visibility: r.visibility,
      showFullName: false,
      showAvatar: true,
      showScores: true,
      showEvolution: true,
      showParticipants: true,
      privateTopRange: 10,
      weights: { presenca: 20, atividades: 30, pratica: 25, evolucao: 15, desafios: 10 },
    });
    setEditorOpen(true);
  };

  const applyPreset = (days: number) => {
    setEditor((prev) => ({
      ...prev,
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(Date.now() + days * 86400000), "yyyy-MM-dd"),
    }));
  };

  const handleSave = () => {
    if (editor.participantRule === 'manual' && editor.participantStudentIds.length === 0) {
      toast.error("Selecione ao menos um aluno na participação manual.");
      return;
    }
    const payload = {
      name: editor.name,
      description: editor.description || undefined,
      visibility: editor.visibility,
      privacySettings: {
        showFullName: editor.showFullName,
        showAvatar: editor.showAvatar,
        showScores: editor.showScores,
        showEvolution: editor.showEvolution,
        showParticipants: editor.showParticipants,
        privateTopRange: editor.privateTopRange,
      },
      criteriaWeights: editor.weights as any,
      participantRule: editor.participantRule,
      instrumentId: editor.participantRule === "instrumento" && editor.instrumentId ? Number(editor.instrumentId) : null,
      level: editor.participantRule === "nivel" ? editor.level : null,
      participantStudentIds: editor.participantRule === "manual" ? editor.participantStudentIds : [],
      startDate: new Date(`${editor.startDate}T00:00:00`).toISOString(),
      endDate: new Date(`${editor.endDate}T23:59:59`).toISOString(),
    };
    if (editor.id) {
      updateMutation.mutate({ id: editor.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const medalStyle = (position: number) => {
    if (position === 1) return { icon: "🥇", cls: "from-amber-400/20 to-amber-500/5 border-amber-400/40" };
    if (position === 2) return { icon: "🥈", cls: "from-slate-300/20 to-slate-400/5 border-slate-300/40" };
    if (position === 3) return { icon: "🥉", cls: "from-orange-400/20 to-orange-500/5 border-orange-400/40" };
    return { icon: "🏅", cls: "from-muted/40 to-transparent border-border/40" };
  };

  const detailRanking = detail?.ranking as any;
  const standings = (detail?.standings as any[]) || [];

  return (
    <div className="space-y-8 pb-10 max-w-[1400px] mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 p-8 md:p-10 rounded-[2.5rem] bg-card text-card-foreground shadow-sm border border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase tracking-widest border border-amber-500/20 mb-3">
            <Trophy size={12} /> Gamificação
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter">Rankings &amp; Desafios</h1>
          <p className="text-muted-foreground font-medium mt-2 max-w-xl">
            Crie competições saudáveis por período, turma ou instrumento e acompanhe o engajamento dos alunos.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
            className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest border-border/60"
          >
            <HistoryIcon size={14} className="mr-2" /> Histórico
          </Button>
          <Button
            onClick={openCreate}
            className="h-12 px-6 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={14} className="mr-2" /> Novo Ranking
          </Button>
        </div>
      </div>

      {showHistory ? (
        /* ── HISTÓRICO (§26) ── */
        <div className="space-y-4">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
            <HistoryIcon size={20} className="text-primary" /> Histórico de Vencedores
          </h2>
          {historic.length === 0 ? (
            <div className="py-20 text-center bg-card rounded-[2.5rem] border border-dashed border-border">
              <Trophy className="mx-auto text-muted-foreground/20 mb-4" size={48} />
              <p className="text-sm font-bold text-muted-foreground">Nenhum ranking encerrado ainda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(historic as any[]).map((h) => (
                <Card key={h.id} className="rounded-[2rem] border-border/50 shadow-sm overflow-hidden">
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-lg tracking-tight">🏆 {h.name}</h3>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {format(new Date(h.startDate), "dd/MM/yy")} → {format(new Date(h.endDate), "dd/MM/yy")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(h.history?.podium || []).map((p: any) => (
                        <span key={p.position} className="px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50 text-xs font-bold">
                          {p.position === 1 ? "🥇" : p.position === 2 ? "🥈" : "🥉"} {p.name} · {p.score} pts
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      <Users size={10} className="inline mr-1" /> {h.history?.totalParticipants ?? h.participantCount} participantes
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── LISTA ── */
        <>
          <div className="flex flex-wrap items-center gap-2">
            {["todos", "ativo", "agendado", "rascunho", "encerrado"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                  statusFilter === s ? "bg-primary text-white border-primary shadow-lg" : "bg-card text-muted-foreground border-border hover:border-primary/30"
                )}
              >
                {s === "todos" ? "Todos" : STATUS_CONFIG[s]?.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary" /></div>
          ) : rankings.length === 0 ? (
            <div className="py-24 text-center bg-card rounded-[2.5rem] border border-dashed border-border">
              <Trophy className="mx-auto text-muted-foreground/20 mb-4" size={56} />
              <h3 className="text-lg font-black">Nenhum ranking por aqui</h3>
              <p className="text-sm text-muted-foreground mt-1">Crie sua primeira competição para engajar seus alunos.</p>
              <Button onClick={openCreate} className="mt-6 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest">
                <Plus size={14} className="mr-2" /> Criar Ranking
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {(rankings as any[]).map((r) => {
                const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.rascunho;
                return (
                  <Card key={r.id} className="rounded-[2rem] border-border/50 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all overflow-hidden">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-black text-lg tracking-tight leading-tight">{r.name}</h3>
                        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border shrink-0", cfg.cls)}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs font-bold text-muted-foreground">
                        <p className="flex items-center gap-2">
                          <CalendarDays size={13} className="text-primary" />
                          {format(new Date(r.startDate), "dd MMM", { locale: ptBR })} → {format(new Date(r.endDate), "dd MMM yyyy", { locale: ptBR })}
                        </p>
                        <p className="flex items-center gap-2">
                          <Users size={13} className="text-primary" /> {r.participantCount} participantes
                          {r.visibility === "privado" ? (
                            <span className="flex items-center gap-1 ml-2"><Lock size={11} /> Privado</span>
                          ) : (
                            <span className="flex items-center gap-1 ml-2"><Globe size={11} /> Público</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => setDetailId(r.id)}
                          className="flex-1 h-10 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border-none text-[10px] font-black uppercase tracking-widest"
                        >
                          <Eye size={13} className="mr-1.5" /> Classificação
                        </Button>
                        {r.status !== "encerrado" && r.status !== "cancelado" && (
                          <Button size="icon" variant="outline" onClick={() => openEdit(r)} title="Editar" className="h-10 w-10 rounded-xl">
                            <Pencil size={14} />
                          </Button>
                        )}
                        <Button size="icon" variant="outline" onClick={() => setDeleteId(r.id)} title="Excluir" className="h-10 w-10 rounded-xl text-rose-600 hover:bg-rose-500/10">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── DIALOG: EDITOR (§9/§10/§12/§17/§31) ── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              {editor.id ? "Editar Ranking" : "Novo Ranking"}
            </DialogTitle>
            <DialogDescription>Configure período, participantes, visibilidade e critérios de pontuação.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome do Ranking</Label>
              <Input value={editor.name} onChange={(e) => setEditor((p) => ({ ...p, name: e.target.value }))} placeholder="Ex.: Aluno Destaque de Setembro" className="h-12 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descrição (opcional)</Label>
              <Input value={editor.description} onChange={(e) => setEditor((p) => ({ ...p, description: e.target.value }))} placeholder="Objetivo da competição" className="h-12 rounded-2xl" />
            </div>

            {/* Período (§10) */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período</Label>
              <div className="flex flex-wrap gap-2">
                {PERIOD_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.days)}
                    className="px-3 py-1.5 rounded-xl bg-muted/50 border border-border text-[10px] font-black uppercase tracking-widest hover:border-primary/40 hover:text-primary transition-all"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-[9px] font-black uppercase text-muted-foreground/60">Início</Label>
                  <Input type="date" value={editor.startDate} onChange={(e) => setEditor((p) => ({ ...p, startDate: e.target.value }))} className="h-11 rounded-xl" />
                </div>
                <div>
                  <Label className="text-[9px] font-black uppercase text-muted-foreground/60">Fim</Label>
                  <Input type="date" value={editor.endDate} onChange={(e) => setEditor((p) => ({ ...p, endDate: e.target.value }))} className="h-11 rounded-xl" />
                </div>
              </div>
            </div>

            {/* Participantes (§12) */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Participantes</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "todos", label: "Todos os alunos ativos" },
                  { id: "instrumento", label: "Por instrumento" },
                  { id: "nivel", label: "Por nível" },
                  { id: "manual", label: "Seleção manual" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setEditor((p) => ({ ...p, participantRule: opt.id as any }))}
                    className={cn(
                      "py-3 px-4 rounded-xl border text-xs font-black transition-all text-left",
                      editor.participantRule === opt.id ? "bg-primary text-white border-primary shadow-lg" : "bg-card border-border hover:border-primary/40"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {editor.participantRule === "instrumento" && (
                <select value={editor.instrumentId} onChange={(e) => setEditor((p) => ({ ...p, instrumentId: e.target.value }))} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm font-bold">
                  <option value="">Selecione o instrumento…</option>
                  {(instrumentsList as any[]).map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              )}
              {editor.participantRule === "nivel" && (
                <select value={editor.level} onChange={(e) => setEditor((p) => ({ ...p, level: e.target.value }))} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm font-bold">
                  <option value="">Selecione o nível…</option>
                  {LEVELS.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              )}
              {editor.participantRule === "manual" && (
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border p-3 space-y-1.5">
                  {(studentsList as any[]).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editor.participantStudentIds.includes(s.id)}
                        onChange={(e) => setEditor((p) => ({
                          ...p,
                          participantStudentIds: e.target.checked
                            ? [...p.participantStudentIds, s.id]
                            : p.participantStudentIds.filter((id) => id !== s.id),
                        }))}
                        className="accent-[hsl(var(--primary))]"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Visibilidade (§31) */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Visibilidade</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "publico", label: "Público", desc: "Participantes veem o ranking" },
                  { id: "privado", label: "Privado", desc: "Aluno vê apenas seus dados" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setEditor((p) => ({ ...p, visibility: opt.id as any }))}
                    className={cn(
                      "py-3 px-4 rounded-xl border text-xs font-black transition-all text-left",
                      editor.visibility === opt.id ? "bg-primary text-white border-primary shadow-lg" : "bg-card border-border hover:border-primary/40"
                    )}
                  >
                    {opt.label}
                    <span className={cn("block text-[9px] font-bold mt-0.5", editor.visibility === opt.id ? "text-white/70" : "text-muted-foreground")}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pesos (§17) — configuração administrativa */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pesos dos Critérios (%)</Label>
                <span className={cn("text-[10px] font-black", weightTotal === 100 ? "text-emerald-600" : "text-amber-600")}>
                  Total: {weightTotal}%
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {WEIGHT_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[8px] font-black uppercase text-muted-foreground/60 text-center block">{f.label}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editor.weights[f.key]}
                      onChange={(e) => setEditor((p) => ({ ...p, weights: { ...p.weights, [f.key]: Number(e.target.value) || 0 } }))}
                      className="h-11 rounded-xl text-center"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground font-medium">Regra interna — os pesos e a fórmula nunca são exibidos ao aluno.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditorOpen(false)} className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest">
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 h-12 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-primary/20"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={14} className="mr-2 animate-spin" />}
                {editor.id ? "Salvar" : "Criar Ranking"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: CLASSIFICAÇÃO (staff — §7/§46) ── */}
      <Dialog open={!!detailId} onOpenChange={(v) => { if (!v) { setDetailId(null); setAuditStudentId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2rem] p-6 md:p-8">
          {detailRanking && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <Trophy size={22} className="text-amber-500" /> {detailRanking.name}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-3 text-xs font-bold">
                  <span>{format(new Date(detailRanking.startDate), "dd/MM/yy")} → {format(new Date(detailRanking.endDate), "dd/MM/yy")}</span>
                  <span className={cn("px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest", STATUS_CONFIG[detailRanking.status]?.cls)}>
                    {STATUS_CONFIG[detailRanking.status]?.label}
                  </span>
                  <span className="flex items-center gap-1"><Users size={11} /> {standings.length} participantes</span>
                </DialogDescription>
              </DialogHeader>

              {detailRanking.status !== "encerrado" && detailRanking.status !== "cancelado" && (
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setEncerrarId(detailRanking.id)}
                    className="h-10 rounded-xl text-purple-600 border-purple-500/30 hover:bg-purple-500/10 text-[10px] font-black uppercase tracking-widest"
                  >
                    <Crown size={13} className="mr-1.5" /> Encerrar Ranking
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {standings.map((row: any) => {
                  const m = medalStyle(row.position);
                  return (
                    <div key={row.studentId} className={cn("rounded-2xl border bg-gradient-to-r p-4 flex items-center justify-between gap-3", m.cls)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0">{m.icon}</span>
                        <div className="min-w-0">
                          <p className="font-black text-sm truncate">{row.position}º · {row.name}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">
                            Aulas: {row.breakdown.presenca.raw} · Metas: {row.breakdown.atividades.raw} · Prática: {row.breakdown.pratica.raw}min
                            {row.shared ? " · empate técnico" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-lg">{row.total}</span>
                        <Button size="icon" variant="ghost" title="Auditar pontuação" onClick={() => setAuditStudentId(row.studentId)} className="h-8 w-8 rounded-lg">
                          <ShieldCheck size={14} className="text-primary" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {standings.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-10">Nenhum participante ainda.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: AUDITORIA + AJUSTE (§46/§47) ── */}
      <Dialog open={!!auditStudentId} onOpenChange={(v) => { if (!v) { setAuditStudentId(null); setAjustePoints(""); setAjusteReason(""); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-[2rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              <ShieldCheck size={20} className="text-primary" /> Auditoria da Pontuação
            </DialogTitle>
            <DialogDescription>Detalhamento interno por critério — visível apenas para staff.</DialogDescription>
          </DialogHeader>
          {audit ? (
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                {(Object.entries((audit as any).breakdown) as any[]).map(([key, b]) => (
                  <div key={key} className="flex items-center justify-between rounded-xl bg-muted/40 border border-border/50 px-4 py-2.5">
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{key}</span>
                    <span className="text-xs font-bold">
                      raw: {b.raw} · pts: {b.points} · ponderado: <strong>{Number(b.weighted.toFixed(1))}</strong>
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5">
                  <span className="text-xs font-black uppercase tracking-widest text-primary">Ajustes manuais</span>
                  <span className="text-xs font-bold">{(audit as any).adjustments}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5">
                  <span className="text-xs font-black uppercase tracking-widest text-emerald-600">TOTAL</span>
                  <span className="text-lg font-black">{(audit as any).total} pts · {(audit as any).position}º</span>
                </div>
              </div>

              {((audit as any).ajustes || []).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trilha de ajustes</p>
                  {((audit as any).ajustes as any[]).map((a) => (
                    <div key={a.id} className="text-xs font-bold flex items-center justify-between border-b border-border/40 pb-1.5">
                      <span>{a.source} · {a.reason}</span>
                      <span className={a.points >= 0 ? "text-emerald-600" : "text-rose-600"}>{a.points > 0 ? "+" : ""}{a.points}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Novo ajuste / bônus</Label>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <Input type="number" placeholder="±pts" value={ajustePoints} onChange={(e) => setAjustePoints(e.target.value)} className="h-11 rounded-xl" />
                  <Input placeholder="Motivo (auditoria)" value={ajusteReason} onChange={(e) => setAjusteReason(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <Button
                  onClick={() => {
                    const pts = Number(ajustePoints);
                    if (!Number.isFinite(pts) || pts === 0) { toast.error("Informe os pontos do ajuste."); return; }
                    if (ajusteReason.trim().length < 3) { toast.error("Descreva o motivo do ajuste."); return; }
                    ajusteMutation.mutate({ rankingId: detailId!, studentId: auditStudentId!, points: pts, reason: ajusteReason.trim(), source: pts > 0 ? "bonus" : "ajuste" });
                  }}
                  disabled={ajusteMutation.isPending}
                  className="w-full h-11 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest"
                >
                  Registrar Ajuste
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-primary" /></div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirmar exclusão ── */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm rounded-[2rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">Excluir ranking?</DialogTitle>
            <DialogDescription>Participantes, ajustes e conquistas vinculadas também serão removidos. Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancelar</Button>
            <Button onClick={() => deleteMutation.mutate({ id: deleteId! })} disabled={deleteMutation.isPending} className="flex-1 h-11 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest">Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar encerramento (§48) ── */}
      <Dialog open={!!encerrarId} onOpenChange={(v) => !v && setEncerrarId(null)}>
        <DialogContent className="max-w-sm rounded-[2rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">Encerrar ranking?</DialogTitle>
            <DialogDescription>A pontuação será congelada, posições finais calculadas, medalhas concedidas e os alunos notificados.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setEncerrarId(null)} className="flex-1 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancelar</Button>
            <Button onClick={() => encerrarMutation.mutate({ id: encerrarId! })} disabled={encerrarMutation.isPending} className="flex-1 h-11 rounded-xl bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest">Encerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
