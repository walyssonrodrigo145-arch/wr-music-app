import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Zap, Plus, Settings, ChevronRight, History,
  Clock, Send, CheckCircle2, XCircle, AlertCircle, Eye,
  MessageSquare, Bell, Star, TrendingUp, Users,
  Edit3, X, Search,
  Calendar, DollarSign, Gift, UserX, Loader2, Sparkles,
  Info, Save, Trash2, ToggleLeft, ToggleRight, BellRing
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// ─── Types ───────────────────────────────────────────────────────────────────
type AutomationRule = {
  id: number;
  organizationId?: number | null;
  userId?: number;
  name: string;
  description: string | null;
  isSystem: number;
  isActive: number;
  trigger: string;
  offsetDays: number;
  offsetHours: number;
  conditions: string | null;
  actions: string | null;
  messageTemplate: string;
  channel: string;
  totalSent: number;
  lastExecutedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

// ─── Trigger config ───────────────────────────────────────────────────────────
const TRIGGERS: { value: string; label: string; icon: React.ElementType; color: string; unit: "days" | "hours" }[] = [
  { value: "new_student",       label: "Novo aluno matriculado",           icon: Users,        color: "text-emerald-500", unit: "days"  },
  { value: "lesson_scheduled",  label: "Aula agendada",                    icon: Calendar,     color: "text-blue-500",    unit: "hours" },
  { value: "payment_due",       label: "Mensalidade próxima do vencimento",icon: DollarSign,   color: "text-amber-500",   unit: "days"  },
  { value: "payment_overdue",   label: "Mensalidade vencida",              icon: AlertCircle,  color: "text-red-500",     unit: "days"  },
  { value: "payment_confirmed", label: "Pagamento confirmado",             icon: CheckCircle2, color: "text-teal-500",    unit: "days"  },
  { value: "birthday",          label: "Aniversário do aluno",             icon: Gift,         color: "text-pink-500",    unit: "days"  },
  { value: "student_inactive",  label: "Aluno inativo (sem aulas)",        icon: UserX,        color: "text-violet-500",  unit: "days"  },
];

const VARIABLES = [
  { label: "{nome_aluno}",        desc: "Nome do aluno"          },
  { label: "{nome_professor}",    desc: "Nome do professor"       },
  { label: "{nome_escola}",       desc: "Nome da escola"          },
  { label: "{curso}",             desc: "Instrumento/curso"       },
  { label: "{data_aula}",         desc: "Data da aula"            },
  { label: "{hora_aula}",         desc: "Horário da aula"         },
  { label: "{valor_mensalidade}", desc: "Valor da mensalidade"    },
  { label: "{data_vencimento}",   desc: "Data de vencimento"      },
  { label: "{dias_sem_estudo}",   desc: "Dias sem estudo"         },
];

function getTriggerInfo(trigger: string) {
  return TRIGGERS.find(t => t.value === trigger) ?? { label: trigger, icon: Zap, color: "text-indigo-500", unit: "days" as const };
}

function getTimingLabel(rule: AutomationRule): string {
  const info = getTriggerInfo(rule.trigger);
  if (info.unit === "hours") {
    const h = rule.offsetHours ?? 0;
    if (h === 0) return "No momento da aula";
    if (h < 0)  return `${Math.abs(h)}h antes da aula`;
    return `${h}h após a aula`;
  }
  const d = rule.offsetDays ?? 0;
  if (d === 0) return "No dia do evento";
  if (d < 0)   return `${Math.abs(d)} dias antes`;
  return `${d} dias depois`;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-all focus-visible:outline-none disabled:opacity-50",
        checked ? "bg-emerald-500 shadow-lg shadow-emerald-500/25" : "bg-muted-foreground/30"
      )}
    >
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0", color)}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-foreground leading-none">{value}</p>
        <p className="text-xs font-semibold text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────
function RuleCard({
  rule, onToggle, onEdit, onDelete, onHistory, loading
}: {
  rule: AutomationRule;
  onToggle: (id: number, active: boolean) => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete?: (id: number) => void;
  onHistory: (rule: AutomationRule) => void;
  loading?: boolean;
}) {
  const info = getTriggerInfo(rule.trigger);
  const Icon = info.icon;
  const isActive = rule.isActive === 1;
  const isSystem = rule.isSystem === 1;

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
      className={cn("bg-card border rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all duration-200",
        isActive ? "border-border/50" : "border-border/30 opacity-70"
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", isActive ? "bg-indigo-500/10" : "bg-muted")}>
          <Icon size={18} className={isActive ? info.color : "text-muted-foreground"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black text-foreground leading-tight">{rule.name}</p>
            {isSystem && <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider rounded-full">Sistema</span>}
            <span className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full", isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
              {isActive ? "Ativa" : "Inativa"}
            </span>
          </div>
          {rule.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rule.description}</p>}
        </div>
        <Toggle checked={isActive} onChange={(v) => onToggle(rule.id, v)} disabled={loading} />
      </div>

      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-lg">
          <Clock size={11} /><span className="font-semibold">{getTimingLabel(rule)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2.5 py-1.5 rounded-lg">
          <MessageSquare size={11} /><span className="font-semibold capitalize">{rule.channel}</span>
        </div>
        {rule.totalSent > 0 && (
          <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg">
            <Send size={11} /><span className="font-semibold">{rule.totalSent} enviados</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-border/30">
        <button onClick={() => onEdit(rule)} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-muted">
          <Edit3 size={13} /> Editar
        </button>
        <button onClick={() => onHistory(rule)} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-muted">
          <History size={13} /> Histórico
        </button>
        {!isSystem && onDelete && (
          <button onClick={() => onDelete(rule.id)} className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-500/10 ml-auto">
            <Trash2 size={13} /> Excluir
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Rule Editor Modal ────────────────────────────────────────────────────────
function RuleEditorModal({ rule, onClose, onSave }: {
  rule: Partial<AutomationRule> | null;
  onClose: () => void;
  onSave: (data: Partial<AutomationRule>) => void;
}) {
  const isNew = !rule?.id;
  const [activeTab, setActiveTab] = useState<"geral" | "disparador" | "mensagem">("geral");
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [trigger, setTrigger] = useState(rule?.trigger ?? "payment_due");
  const [offsetDays, setOffsetDays] = useState(rule?.offsetDays ?? -3);
  const [offsetHours, setOffsetHours] = useState(rule?.offsetHours ?? 0);
  const [messageTemplate, setMessageTemplate] = useState(rule?.messageTemplate ?? "");
  const [isActive, setIsActive] = useState((rule?.isActive ?? 1) === 1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const info = getTriggerInfo(trigger);
  const unit = info.unit;

  const timingPreview = (() => {
    if (unit === "hours") {
      if (offsetHours === 0) return "será enviada no momento da aula";
      if (offsetHours < 0) return `será enviada ${Math.abs(offsetHours)} hora(s) antes da aula`;
      return `será enviada ${offsetHours} hora(s) após a aula`;
    }
    if (offsetDays === 0) return "será enviada no dia do evento";
    if (offsetDays < 0) return `será enviada ${Math.abs(offsetDays)} dia(s) antes do evento`;
    return `será enviada ${offsetDays} dia(s) após o evento`;
  })();

  const insertVariable = (variable: string) => {
    const ta = textareaRef.current;
    if (!ta) { setMessageTemplate(prev => prev + variable); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newValue = messageTemplate.slice(0, start) + variable + messageTemplate.slice(end);
    setMessageTemplate(newValue);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + variable.length; ta.focus(); }, 0);
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("Digite um nome para a regra"); return; }
    if (!messageTemplate.trim()) { toast.error("Digite o texto da mensagem"); return; }
    onSave({
      ...(rule?.id ? { id: rule.id } : {}),
      name: name.trim(),
      description: description.trim() || undefined,
      trigger,
      offsetDays: unit === "days" ? offsetDays : 0,
      offsetHours: unit === "hours" ? offsetHours : 0,
      messageTemplate: messageTemplate.trim(),
      channel: "whatsapp",
      isActive: isActive ? 1 : 0,
    });
  };

  const TABS = [
    { id: "geral" as const, label: "Geral", icon: Settings },
    { id: "disparador" as const, label: "Disparador & Timing", icon: Clock },
    { id: "mensagem" as const, label: "Mensagem", icon: MessageSquare },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Zap size={18} className="text-indigo-500" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">{isNew ? "Nova Automação" : "Editar Automação"}</h2>
              <p className="text-[10px] text-muted-foreground font-medium">Configure quando e o que enviar</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 overflow-x-auto no-scrollbar">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                  activeTab === tab.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon size={13} />{tab.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Geral Tab */}
          {activeTab === "geral" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Nome da Regra *</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lembrete de Mensalidade 5 dias antes" className="h-11 rounded-xl border-border bg-muted/50 text-sm font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Descrição</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Breve descrição do objetivo desta automação" className="h-11 rounded-xl border-border bg-muted/50 text-sm font-medium" />
              </div>
              <div className="flex items-center justify-between p-4 bg-muted/40 rounded-2xl border border-border/50">
                <div>
                  <p className="text-sm font-bold text-foreground">Ativar imediatamente</p>
                  <p className="text-xs text-muted-foreground mt-0.5">A regra começará a processar assim que salva</p>
                </div>
                <Toggle checked={isActive} onChange={setIsActive} />
              </div>
            </div>
          )}

          {/* Disparador Tab */}
          {activeTab === "disparador" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Evento que dispara a automação</label>
                <div className="grid grid-cols-1 gap-2">
                  {TRIGGERS.map(t => {
                    const TIcon = t.icon;
                    const selected = trigger === t.value;
                    return (
                      <button key={t.value} onClick={() => setTrigger(t.value)}
                        className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-semibold border transition-all",
                          selected ? "bg-indigo-500/10 border-indigo-500/30 text-foreground" : "border-border/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <TIcon size={16} className={selected ? t.color : "text-muted-foreground"} />
                        <span>{t.label}</span>
                        {selected && <ChevronRight size={14} className="ml-auto text-indigo-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Timing */}
              <div className="p-5 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 rounded-2xl border border-indigo-500/20 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-indigo-500" />
                  <p className="text-sm font-black text-foreground">Quando enviar?</p>
                </div>

                {unit === "hours" ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quantas horas</label>
                      <Input type="number" value={Math.abs(offsetHours)}
                        onChange={e => { const v = parseInt(e.target.value) || 0; setOffsetHours(offsetHours >= 0 ? v : -v); }}
                        min={0} className="w-24 h-11 rounded-xl text-center font-black text-lg border-border bg-card"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Direção</label>
                      <div className="flex gap-2">
                        {[
                          { label: "Antes", action: () => setOffsetHours(h => -Math.abs(h || 1)), active: offsetHours < 0 },
                          { label: "Na hora", action: () => setOffsetHours(0), active: offsetHours === 0 },
                          { label: "Depois", action: () => setOffsetHours(h => Math.abs(h || 1)), active: offsetHours > 0 },
                        ].map(btn => (
                          <button key={btn.label} onClick={btn.action}
                            className={cn("px-3 py-2 rounded-xl text-xs font-black border transition-all",
                              btn.active ? "bg-indigo-500 text-white border-transparent" : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >{btn.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quantos dias</label>
                      <Input type="number" value={Math.abs(offsetDays)}
                        onChange={e => { const v = parseInt(e.target.value) || 0; setOffsetDays(offsetDays >= 0 ? v : -v); }}
                        min={0} className="w-24 h-11 rounded-xl text-center font-black text-lg border-border bg-card"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Direção</label>
                      <div className="flex gap-2">
                        {[
                          { label: "Antes", action: () => setOffsetDays(d => -Math.abs(d || 1)), active: offsetDays < 0 },
                          { label: "No dia", action: () => setOffsetDays(0), active: offsetDays === 0 },
                          { label: "Depois", action: () => setOffsetDays(d => Math.abs(d || 1)), active: offsetDays > 0 },
                        ].map(btn => (
                          <button key={btn.label} onClick={btn.action}
                            className={cn("px-3 py-2 rounded-xl text-xs font-black border transition-all",
                              btn.active ? "bg-indigo-500 text-white border-transparent" : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >{btn.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 bg-indigo-500/10 rounded-xl">
                  <Info size={14} className="text-indigo-500 flex-shrink-0" />
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    A mensagem <strong>{timingPreview}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mensagem Tab */}
          {activeTab === "mensagem" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Variáveis disponíveis</label>
                <div className="flex flex-wrap gap-2">
                  {VARIABLES.map(v => (
                    <button key={v.label} onClick={() => insertVariable(v.label)} title={v.desc}
                      className="px-2.5 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-black rounded-lg hover:bg-indigo-500/20 transition-colors border border-indigo-500/20"
                    >{v.label}</button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Clique em uma variável para inserir no texto</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Texto da mensagem *</label>
                <textarea ref={textareaRef} value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)}
                  placeholder="Olá {nome_aluno}, passando para lembrar que sua mensalidade de {valor_mensalidade} vence em {data_vencimento}..."
                  className="w-full min-h-[140px] px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 leading-relaxed"
                />
              </div>

              {messageTemplate && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Eye size={13} /> Preview com dados de exemplo
                  </label>
                  <div className="p-4 bg-[#e1ffc7] dark:bg-emerald-900/30 rounded-2xl rounded-tl-none border border-emerald-200 dark:border-emerald-800 text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {messageTemplate
                      .replace(/\{nome_aluno\}/g, "João Silva")
                      .replace(/\{nome_professor\}/g, "Prof. Carlos")
                      .replace(/\{nome_escola\}/g, "WR Music")
                      .replace(/\{curso\}/g, "Violão")
                      .replace(/\{data_aula\}/g, "segunda-feira, 23 de junho")
                      .replace(/\{hora_aula\}/g, "14:00")
                      .replace(/\{valor_mensalidade\}/g, "R$ 250,00")
                      .replace(/\{data_vencimento\}/g, "23 de junho de 2026")
                      .replace(/\{dias_sem_estudo\}/g, "12")}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div className="flex gap-1">
            {activeTab !== "geral" && (
              <button onClick={() => setActiveTab(activeTab === "mensagem" ? "disparador" : "geral")}
                className="px-4 py-2 text-xs font-black text-muted-foreground hover:bg-muted rounded-xl transition-colors"
              >← Anterior</button>
            )}
            {activeTab !== "mensagem" && (
              <button onClick={() => setActiveTab(activeTab === "geral" ? "disparador" : "mensagem")}
                className="px-4 py-2 text-xs font-black text-indigo-600 hover:bg-indigo-500/10 rounded-xl transition-colors"
              >Próximo →</button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-xs font-black text-muted-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
            <Button onClick={handleSave} className="px-6 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg shadow-indigo-500/20">
              <Save size={13} className="mr-2" />{isNew ? "Criar Automação" : "Salvar"}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── History Modal ────────────────────────────────────────────────────────────
function HistoryModal({ rule, onClose }: { rule: AutomationRule; onClose: () => void }) {
  const { data: history = [], isLoading } = trpc.automations.history.useQuery({ ruleId: rule.id });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              <History size={16} className="text-indigo-500" /> Histórico de Execuções
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{rule.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <History size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-foreground">Nenhum envio ainda</p>
              <p className="text-xs text-muted-foreground mt-1">O histórico aparece aqui quando a regra for executada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(history as any[]).map((h) => (
                <div key={h.id} className="flex items-start gap-3 p-4 bg-muted/30 rounded-xl border border-border/30">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                    h.status === "enviado" ? "bg-emerald-500/10" : h.status === "cancelado" ? "bg-muted" : "bg-amber-500/10"
                  )}>
                    {h.status === "enviado" ? <CheckCircle2 size={14} className="text-emerald-500" />
                     : h.status === "cancelado" ? <XCircle size={14} className="text-muted-foreground" />
                     : <Clock size={14} className="text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-foreground">{h.studentName || "—"}</p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {h.sentAt
                          ? new Date(h.sentAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                          : h.scheduledAt
                          ? new Date(h.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                          : "—"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{h.message}</p>
                    {h.errorMessage && <p className="text-[10px] text-red-500 mt-1">⚠ {h.errorMessage}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Automacoes() {
  const utils = trpc.useUtils();
  const [editorRule, setEditorRule] = useState<Partial<AutomationRule> | null>(null);
  const [historyRule, setHistoryRule] = useState<AutomationRule | null>(null);
  const [search, setSearch] = useState("");

  const { data: rules = [], isLoading } = trpc.automations.list.useQuery();
  const { data: stats } = trpc.automations.stats.useQuery();

  const seedMutation = trpc.automations.seedDefaults.useMutation({
    onSuccess: (res) => {
      if (res.seeded) {
        toast.success(`${res.count} regras padrão criadas com sucesso!`);
        utils.automations.list.invalidate();
      }
    },
  });

  const toggleMutation = trpc.automations.toggle.useMutation({
    onSuccess: () => { utils.automations.list.invalidate(); utils.automations.stats.invalidate(); },
    onError: (e) => toast.error("Erro ao atualizar regra: " + e.message),
  });

  const createMutation = trpc.automations.create.useMutation({
    onSuccess: () => { toast.success("Automação criada! ✅"); setEditorRule(null); utils.automations.list.invalidate(); utils.automations.stats.invalidate(); },
    onError: (e) => toast.error("Erro ao criar: " + e.message),
  });

  const updateMutation = trpc.automations.update.useMutation({
    onSuccess: () => { toast.success("Automação atualizada!"); setEditorRule(null); utils.automations.list.invalidate(); },
    onError: (e) => toast.error("Erro ao atualizar: " + e.message),
  });

  const deleteMutation = trpc.automations.delete.useMutation({
    onSuccess: () => { toast.success("Automação removida."); utils.automations.list.invalidate(); utils.automations.stats.invalidate(); },
    onError: (e) => toast.error("Erro ao excluir: " + e.message),
  });

  useEffect(() => {
    if (!isLoading && rules.length === 0) {
      seedMutation.mutate();
    }
  }, [isLoading, rules.length]);

  const [autoEnabled, setAutoEnabled] = useState(false);
  const { permission, isSupported, requestPermission } = usePushNotifications();
  
  const { data: automationData } = trpc.settings.getAutomation.useQuery(
    undefined,
    { refetchInterval: 60_000, staleTime: 30_000 }
  );

  const toggleAutomation = trpc.settings.toggleAutomation.useMutation({
    onSuccess: (r) => {
      setAutoEnabled(r.enabled);
      utils.settings.getAutomation.invalidate();
      toast.success(r.enabled ? "Automação ativada!" : "Automação desativada.");
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const testPush = trpc.fcm.testNotification.useMutation({
    onSuccess: (r) => toast.success(`Notificação enviada para ${r.sentCount} dispositivo(s)!`),
    onError: (e) => toast.error("Erro: " + e.message),
  });

  useEffect(() => {
    if (automationData !== undefined) setAutoEnabled(automationData.enabled);
  }, [automationData]);

  const handleSaveRule = (data: Partial<AutomationRule>) => {
    if (data.id) {
      updateMutation.mutate({ id: data.id, name: data.name, description: data.description ?? undefined, offsetDays: data.offsetDays, offsetHours: data.offsetHours, messageTemplate: data.messageTemplate, channel: data.channel });
    } else {
      createMutation.mutate({ name: data.name!, description: data.description ?? undefined, trigger: data.trigger!, offsetDays: data.offsetDays ?? 0, offsetHours: data.offsetHours ?? 0, messageTemplate: data.messageTemplate!, channel: data.channel ?? "whatsapp", isActive: data.isActive ?? 1 });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Deseja excluir esta automação? Ação irreversível.")) deleteMutation.mutate({ id });
  };

  const systemRules = rules.filter(r => r.isSystem === 1);
  const customRules = rules.filter(r => r.isSystem === 0);
  const filteredSystem = search ? systemRules.filter(r => r.name.toLowerCase().includes(search.toLowerCase())) : systemRules;
  const filteredCustom = search ? customRules.filter(r => r.name.toLowerCase().includes(search.toLowerCase())) : customRules;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Zap size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-foreground tracking-tight">Automações de Mensagens</h1>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">Configure quando e como seus alunos recebem mensagens automáticas</p>
          </div>
        </div>
        <Button
          onClick={() => setEditorRule({ trigger: "payment_due", offsetDays: -3, isActive: 1 })}
          className="h-11 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-500/20 gap-2"
        >
          <Plus size={16} /> Criar Nova Regra
        </Button>
      </div>

      <div className={cn(
        "relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-300",
        autoEnabled
          ? "bg-gradient-to-br from-indigo-600 to-indigo-800 border-indigo-700 shadow-xl shadow-indigo-500/20 text-white"
          : "bg-card border-border shadow-sm text-muted-foreground"
      )}>
        {autoEnabled && (
          <>
            <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-card/10 blur-2xl" />
            <div className="absolute -left-10 -bottom-10 w-24 h-24 rounded-full bg-indigo-400/20 blur-xl" />
          </>
        )}
        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg", autoEnabled ? "bg-card/20 text-white" : "bg-muted text-muted-foreground")}>
            <Zap size={28} />
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
              <h3 className={cn("text-base font-black uppercase tracking-widest", autoEnabled ? "text-white" : "text-foreground")}>Automação do Robô</h3>
              <span className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full", autoEnabled ? "bg-card/20 text-white" : "bg-muted text-muted-foreground")}>
                {autoEnabled ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className={cn("text-xs font-medium leading-relaxed", autoEnabled ? "text-white/80" : "text-muted-foreground")}>
              {autoEnabled ? "Varredura automática de regras e notificações em execução." : "A automação está desligada. Apenas ações manuais serão processadas."}
            </p>
          </div>
          <button onClick={() => toggleAutomation.mutate({ enabled: !autoEnabled })} disabled={toggleAutomation.isPending} className="transition-transform hover:scale-110 active:scale-90 disabled:opacity-50">
            {toggleAutomation.isPending
              ? <Loader2 size={48} className="animate-spin opacity-50" />
              : autoEnabled
                ? <ToggleRight size={64} className="text-white drop-shadow-lg" />
                : <ToggleLeft size={64} className="text-muted-foreground/30" />
            }
          </button>
        </div>
      </div>

      {isSupported && permission === "default" && (
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl bg-amber-500/10 border border-amber-100 shadow-sm shrink-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0"><BellRing size={20} /></div>
          <p className="text-[11px] lg:text-xs text-amber-800 font-bold uppercase tracking-widest flex-1 leading-snug text-center sm:text-left">Ative os alertas para ser avisado sobre novos lembretes.</p>
          <Button size="sm" className="w-full sm:w-auto h-9 rounded-xl bg-amber-600 text-white font-black uppercase tracking-widest text-[9px] px-4 shadow-lg shadow-amber-500/20" onClick={async () => {
            const result = await requestPermission();
            if (result === "granted") toast.success("Notificações ativadas!");
          }}>Ativar</Button>
        </div>
      )}

      {isSupported && permission === "granted" && (
        <div className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-100 shadow-sm shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0"><BellRing size={20} /></div>
          <p className="text-[11px] lg:text-xs text-emerald-800 font-bold uppercase tracking-widest flex-1 leading-snug text-center sm:text-left">Notificações Ativadas! Você pode fechar a aba que continuará sendo avisado.</p>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none h-9 rounded-xl border-emerald-500/30 text-emerald-700 font-black uppercase tracking-widest text-[9px] px-4 hover:bg-emerald-500/20" onClick={() => requestPermission()}>Sincronizar</Button>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none h-9 rounded-xl border-emerald-500/30 text-emerald-700 font-black uppercase tracking-widest text-[9px] px-4 hover:bg-emerald-500/20" onClick={() => testPush.mutate()} disabled={testPush.isPending}>
              {testPush.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}Disparar Teste
            </Button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Mensagens Enviadas" value={stats?.totalSent ?? 0} icon={Send} color="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <StatCard label="Automações Ativas" value={stats?.activeRules ?? 0} icon={Zap} color="bg-gradient-to-br from-indigo-500 to-violet-600" />
        <StatCard label="Taxa de Entrega" value={`${stats?.deliveryRate ?? 0}%`} icon={TrendingUp} color="bg-gradient-to-br from-blue-500 to-indigo-600" sub="Mensagens confirmadas" />
        <StatCard label="Top Automação" value={stats?.topRule?.totalSent ?? 0} icon={Star} color="bg-gradient-to-br from-amber-500 to-orange-600" sub={stats?.topRule?.name ?? "—"} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar automações..."
          className="w-full pl-11 pr-4 h-11 bg-card border border-border rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>

      {/* System Rules */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Sparkles size={16} className="text-indigo-500" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Regras Padrão do Sistema</h2>
            <p className="text-[10px] text-muted-foreground font-medium">Nativas da plataforma — edite o timing e o texto a qualquer momento</p>
          </div>
        </div>
        {filteredSystem.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">{search ? "Nenhuma regra encontrada" : "Carregando regras padrão..."}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredSystem.map(rule => (
                <RuleCard key={rule.id} rule={rule} onToggle={(id, v) => toggleMutation.mutate({ id, isActive: v ? 1 : 0 })}
                  onEdit={setEditorRule} onHistory={setHistoryRule} loading={toggleMutation.isPending} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Custom Rules */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Settings size={16} className="text-violet-500" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest">Minhas Automações</h2>
              <p className="text-[10px] text-muted-foreground font-medium">Regras personalizadas criadas por você</p>
            </div>
          </div>
          {customRules.length > 0 && (
            <span className="text-xs font-black text-muted-foreground bg-muted px-3 py-1.5 rounded-xl">
              {customRules.length} {customRules.length === 1 ? "regra" : "regras"}
            </span>
          )}
        </div>

        {filteredCustom.length === 0 && !search ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-3xl bg-muted/20">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center mb-4">
              <Plus size={24} className="text-indigo-500" />
            </div>
            <p className="text-sm font-black text-foreground">Nenhuma automação personalizada</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">Crie suas próprias regras para complementar as regras padrão do sistema.</p>
            <Button onClick={() => setEditorRule({ trigger: "payment_due", offsetDays: -3, isActive: 1 })}
              className="mt-5 h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-lg gap-2"
            >
              <Plus size={14} /> Criar Primeira Automação
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredCustom.map(rule => (
                <RuleCard key={rule.id} rule={rule} onToggle={(id, v) => toggleMutation.mutate({ id, isActive: v ? 1 : 0 })}
                  onEdit={setEditorRule} onDelete={handleDelete} onHistory={setHistoryRule} loading={toggleMutation.isPending} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Info */}
      <div className="flex items-start gap-4 p-5 bg-blue-500/5 rounded-2xl border border-blue-500/15">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Info size={16} className="text-blue-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Como funciona o timing?</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            O servidor verifica as regras ativas a cada minuto. Ex: regra "Mensalidade — 3 dias antes" e vencimento em 22/06 → lembrete gerado em 19/06.
            Mude de 3 para 5 dias antes, ou 2 dias depois — a regra atualiza automaticamente.
          </p>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {editorRule !== null && (
          <RuleEditorModal rule={editorRule} onClose={() => setEditorRule(null)} onSave={handleSaveRule} />
        )}
        {historyRule && (
          <HistoryModal rule={historyRule} onClose={() => setHistoryRule(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
