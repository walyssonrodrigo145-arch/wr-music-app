import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Users, Plus, MessageCircle, Calendar, CheckCircle2, XCircle, 
  ArrowRight, Trash2, UserPlus, DollarSign, Music, Search, TrendingUp, Sparkles, Filter 
} from "lucide-react";
import { toast } from "sonner";

type StageKey = "novo" | "contato" | "aula_agendada" | "aula_realizada" | "matriculado" | "perdido";

interface StageConfig {
  key: StageKey;
  label: string;
  badgeBg: string;
  icon: any;
  color: string;
}

const STAGES: StageConfig[] = [
  { key: "novo", label: "Novos Leads", badgeBg: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Users, color: "text-blue-500" },
  { key: "contato", label: "Em Contato", badgeBg: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20", icon: MessageCircle, color: "text-indigo-500" },
  { key: "aula_agendada", label: "Aula Agendada", badgeBg: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Calendar, color: "text-amber-500" },
  { key: "aula_realizada", label: "Aula Realizada", badgeBg: "bg-purple-500/10 text-purple-600 border-purple-500/20", icon: Music, color: "text-purple-500" },
  { key: "matriculado", label: "Matriculado 🎉", badgeBg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2, color: "text-emerald-500" },
  { key: "perdido", label: "Perdido", badgeBg: "bg-rose-500/10 text-rose-600 border-rose-500/20", icon: XCircle, color: "text-rose-500" },
];

export default function CrmKanban() {
  const utils = trpc.useUtils();

  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    instrument: "",
    value: "150",
    notes: "",
    source: "WhatsApp",
  });

  const { data: leads = [], isLoading } = trpc.crm.listLeads.useQuery();

  const createLeadMutation = trpc.crm.createLead.useMutation({
    onSuccess: () => {
      toast.success("Novo lead cadastrado no Funil!");
      utils.crm.listLeads.invalidate();
      setNewLeadOpen(false);
      setForm({ name: "", phone: "", email: "", instrument: "", value: "150", notes: "", source: "WhatsApp" });
    },
    onError: (e) => toast.error("Erro ao criar lead: " + e.message),
  });

  const updateStageMutation = trpc.crm.updateStage.useMutation({
    onSuccess: () => {
      toast.success("Estágio atualizado!");
      utils.crm.listLeads.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const deleteLeadMutation = trpc.crm.deleteLead.useMutation({
    onSuccess: () => {
      toast.success("Lead removido");
      utils.crm.listLeads.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const convertToStudentMutation = trpc.crm.convertToStudent.useMutation({
    onSuccess: (data) => {
      toast.success(`🎉 ${data.student.name} matriculado com sucesso! Criado na lista de alunos.`);
      utils.crm.listLeads.invalidate();
      utils.students.list.invalidate();
    },
    onError: (e) => toast.error("Erro ao matricular: " + e.message),
  });

  const handleCreateLead = () => {
    if (!form.name.trim()) return toast.error("Preencha o nome do interessado");
    createLeadMutation.mutate({
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      instrument: form.instrument.trim() || undefined,
      value: Number(form.value) || 0,
      notes: form.notes.trim() || undefined,
      source: form.source,
      stage: "novo",
    });
  };

  const filteredLeads = leads.filter((l: any) => 
    l.name.toLowerCase().includes(search.toLowerCase()) || 
    (l.instrument || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.phone || "").includes(search)
  );

  const totalValue = leads.reduce((acc: number, l: any) => acc + (Number(l.value) || 0), 0);
  const totalAgendados = leads.filter((l: any) => l.stage === "aula_agendada" || l.stage === "aula_realizada").length;
  const totalMatriculados = leads.filter((l: any) => l.stage === "matriculado").length;
  const conversionRate = leads.length > 0 ? Math.round((totalMatriculados / leads.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Metrics */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-outfit tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Funil Comercial (CRM)
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Acompanhe a jornada de novos interessados desde o WhatsApp até a matrícula.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Buscar lead ou instrumento..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 text-xs rounded-xl"
            />
          </div>
          <Button onClick={() => setNewLeadOpen(true)} className="h-10 rounded-xl px-4 gap-2 font-bold shadow-lg shadow-primary/20 shrink-0">
            <Plus size={16} /> Novo Lead
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl border border-border/60 bg-gradient-to-br from-blue-500/5 to-background">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total no Funil</p>
          <p className="text-2xl font-black text-foreground mt-1">{leads.length} <span className="text-xs font-normal text-muted-foreground">leads</span></p>
        </Card>
        <Card className="p-4 rounded-2xl border border-border/60 bg-gradient-to-br from-amber-500/5 to-background">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aulas Experimentais</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{totalAgendados}</p>
        </Card>
        <Card className="p-4 rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/5 to-background">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Matriculados</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{totalMatriculados} <span className="text-xs text-muted-foreground font-semibold">({conversionRate}%)</span></p>
        </Card>
        <Card className="p-4 rounded-2xl border border-border/60 bg-gradient-to-br from-purple-500/5 to-background">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valor em Potencial</p>
          <p className="text-2xl font-black text-foreground mt-1">R$ {totalValue.toFixed(2)}</p>
        </Card>
      </div>

      {/* KANBAN BOARD */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {STAGES.map((stg) => {
          const stageLeads = filteredLeads.filter((l: any) => l.stage === stg.key);
          return (
            <div key={stg.key} className="flex flex-col bg-card/60 backdrop-blur-md rounded-2xl border border-border/60 p-3 min-h-[500px]">
              {/* Header da Coluna */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <stg.icon className={`w-4 h-4 ${stg.color}`} />
                  <h3 className="text-xs font-bold font-outfit uppercase tracking-wider text-foreground">{stg.label}</h3>
                </div>
                <Badge variant="secondary" className="text-[10px] font-black">{stageLeads.length}</Badge>
              </div>

              {/* Lista de Cards */}
              <div className="space-y-3 flex-1">
                {stageLeads.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-center p-3 text-[11px] text-muted-foreground italic border border-dashed border-border/40 rounded-xl">
                    Nenhum lead nesta etapa
                  </div>
                ) : (
                  stageLeads.map((lead: any) => (
                    <Card key={lead.id} className="p-3 rounded-xl border border-border/80 hover:border-primary/50 transition-all shadow-sm group bg-background/80">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-foreground truncate">{lead.name}</h4>
                          {lead.instrument && (
                            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mt-0.5">
                              <Music size={10} className="text-primary" /> {lead.instrument}
                            </span>
                          )}
                        </div>
                        <button onClick={() => deleteLeadMutation.mutate({ leadId: lead.id })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {lead.notes && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-2 bg-muted/30 p-1.5 rounded-lg border border-border/30">
                          {lead.notes}
                        </p>
                      )}

                      <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary">R$ {Number(lead.value).toFixed(0)}/mês</span>
                        <div className="flex items-center gap-1">
                          {lead.phone && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => window.open(`https://wa.me/55${lead.phone.replace(/\D/g, '')}?text=Olá ${lead.name}! Tudo bem? Gostaria de saber se podemos agendar sua aula experimental no MusicPro.`, '_blank')}
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </Button>
                          )}

                          {stg.key !== "matriculado" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-blue-600 hover:bg-blue-500/10"
                              onClick={() => {
                                const nextIndex = STAGES.findIndex(s => s.key === stg.key) + 1;
                                if (nextIndex < STAGES.length) {
                                  updateStageMutation.mutate({ leadId: lead.id, stage: STAGES[nextIndex].key });
                                }
                              }}
                              title="Avançar Estágio"
                            >
                              <ArrowRight size={14} />
                            </Button>
                          )}

                          {stg.key !== "matriculado" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-purple-600 hover:bg-purple-500/10"
                              onClick={() => {
                                if (confirm(`Deseja matricular ${lead.name} oficialmente como aluno?`)) {
                                  convertToStudentMutation.mutate({ leadId: lead.id, monthlyFee: Number(lead.value) });
                                }
                              }}
                              title="Matricular como Aluno Oficial"
                            >
                              <UserPlus size={14} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Novo Lead */}
      <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold font-outfit flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Novo Lead (Interessado)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome Completo</Label>
              <Input placeholder="Ex: João da Silva" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
                <Input placeholder="11999998888" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Instrumento</Label>
                <Input placeholder="Ex: Violão, Canto" value={form.instrument} onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Valor Estimado (R$/mês)</Label>
                <Input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Origem</Label>
                <select 
                  className="w-full h-9 text-xs rounded-lg border border-border px-3 bg-background"
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                >
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Google / Site">Google / Site</option>
                  <option value="Indicação">Indicação</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Observações / Notas</Label>
              <Textarea placeholder="Interesse em aulas de violão para iniciante..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLeadOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCreateLead} disabled={createLeadMutation.isPending} className="rounded-xl gap-2 font-bold">
              {createLeadMutation.isPending ? "Cadastrando..." : "Adicionar ao Funil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
