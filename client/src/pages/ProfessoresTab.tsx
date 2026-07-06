import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Edit2, Mail, GraduationCap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const AVAILABLE_PERMISSIONS = [
  { id: "/dashboard", label: "Dashboard" },
  { id: "/alunos", label: "Alunos" },
  { id: "/aulas", label: "Aulas" },
  { id: "/instrumentos", label: "Instrumentos" },
  { id: "/relatorios", label: "Relatórios" },
  { id: "/lembretes", label: "Lembretes" },
  { id: "/comunicados", label: "Comunicados" },
  { id: "/solicitacoes", label: "Solicitações" },
  { id: "/automacoes", label: "Automações" },
  { id: "/ia", label: "IA Assistente" },
  { id: "/progresso", label: "Progresso" },
  { id: "/financeiro", label: "Financeiro" },
  { id: "/folha", label: "Folha de Pagto" },
  { id: "/recepcao-qr", label: "Recepção QR" },
  { id: "/configuracoes", label: "Configurações" },
];

// Permissões granulares de dados (não são rotas, controlam o que o professor pode VER/FAZER)
const DATA_PERMISSIONS = [
  { id: "alunos_editar", label: "Editar dados dos alunos", desc: "Permite editar, excluir e alterar status dos alunos" },
  { id: "alunos_mensalidade", label: "Ver valor da mensalidade", desc: "Exibe a coluna de mensalidade na lista de alunos" },
];

export function ProfessoresTab() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefone, setTelefone] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [permissions, setPermissions] = useState<string[]>(["/dashboard", "/alunos", "/aulas"]);
  const [paymentType, setPaymentType] = useState<"fixo" | "porcentagem">("fixo");
  const [hourlyRate, setHourlyRate] = useState("");
  const [paymentPercentage, setPaymentPercentage] = useState("");

  const utils = trpc.useUtils();
  const { data: professores, isLoading } = trpc.professores.list.useQuery();

  const createMutation = trpc.professores.create.useMutation({
    onSuccess: () => {
      toast.success("Professor cadastrado com sucesso!");
      utils.professores.list.invalidate();
      setIsOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.professores.update.useMutation({
    onSuccess: () => {
      toast.success("Professor atualizado com sucesso!");
      utils.professores.list.invalidate();
      setIsOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.professores.delete.useMutation({
    onSuccess: () => {
      toast.success("Professor removido com sucesso!");
      utils.professores.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setTelefone("");
    setEspecialidade("");
    setPermissions(["aulas", "progresso"]);
    setPaymentType("fixo");
    setHourlyRate("");
    setPaymentPercentage("");
    setEditingId(null);
  };

  const handleOpenEdit = (prof: any) => {
    setEditingId(prof.id);
    setName(prof.name || "");
    setEmail(prof.email || "");
    setPassword("");
    setTelefone(prof.telefone || "");
    setEspecialidade(prof.especialidade || "");
    setPermissions(prof.permissions || []);
    setPaymentType(prof.paymentType || "fixo");
    setHourlyRate(prof.hourlyRate || "");
    setPaymentPercentage(prof.paymentPercentage || "");
    setIsOpen(true);
  };

  const handleSave = () => {
    if (!name || !email) {
      toast.error("Nome e E-mail são obrigatórios");
      return;
    }
    if (!editingId && !password) {
      toast.error("Senha é obrigatória para novos professores");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name,
        telefone,
        especialidade,
        password: password || undefined,
        permissions,
        paymentType,
        hourlyRate,
        paymentPercentage,
      });
    } else {
      createMutation.mutate({
        name,
        email,
        password,
        telefone,
        especialidade,
        permissions,
        paymentType,
        hourlyRate,
        paymentPercentage,
      });
    }
  };

  const togglePermission = (id: string) => {
    setPermissions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  if (isLoading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-6 rounded-2xl border border-border/50">
        <div>
          <h3 className="text-xl lg:text-2xl font-outfit font-black text-foreground uppercase tracking-widest flex items-center gap-3">
            <span className="w-2 h-8 bg-primary rounded-full"></span>
            Equipe de Professores
          </h3>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mt-1 ml-5">Gerencie os acessos e permissões dos membros</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={(val) => { setIsOpen(val); if (!val) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all">
              <Plus size={18} className="mr-2" />
              Novo Professor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Professor" : "Novo Professor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Nome Completo</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="João da Silva" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">E-mail (Login)</label>
                <Input value={email} onChange={e => setEmail(e.target.value)} disabled={!!editingId} placeholder="joao@escola.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">{editingId ? "Nova Senha (opcional)" : "Senha de Acesso"}</label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="******" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">WhatsApp</label>
                  <Input value={telefone} onChange={e => {
                    let clean = e.target.value.replace(/\D/g, "");
                    if (!clean) {
                      setTelefone("");
                      return;
                    }
                    let prefix = "";
                    if (clean.startsWith("55") && clean.length > 11) {
                      prefix = "+55 ";
                      clean = clean.substring(2);
                    }
                    let formatted = prefix + clean;
                    if (clean.length > 2 && clean.length <= 6) {
                      formatted = prefix + `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
                    } else if (clean.length > 6 && clean.length <= 10) {
                      formatted = prefix + `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
                    } else if (clean.length > 10) {
                      formatted = prefix + `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
                    }
                    setTelefone(formatted);
                  }} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Especialidade</label>
                  <Input value={especialidade} onChange={e => setEspecialidade(e.target.value)} placeholder="Piano, Canto..." />
                </div>
              </div>
              
              <div className="pt-4 border-t border-border">
                <label className="text-xs font-semibold mb-2 block">Permissões de Acesso às Páginas</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Permissões Granulares de Dados */}
              <div className="pt-4 border-t border-border">
                <label className="text-xs font-semibold mb-1 block">Permissões de Dados</label>
                <p className="text-[11px] text-muted-foreground mb-3">Controla o que o professor pode ver e fazer dentro das páginas</p>
                <div className="space-y-2">
                  {DATA_PERMISSIONS.map(perm => (
                    <label key={perm.id} className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors">
                      <input
                        type="checkbox"
                        checked={permissions.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium block">{perm.label}</span>
                        <span className="text-[11px] text-muted-foreground">{perm.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <label className="text-xs font-semibold mb-2 block">Acordo Financeiro</label>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input 
                        type="radio" 
                        checked={paymentType === "fixo"} 
                        onChange={() => setPaymentType("fixo")}
                        className="text-primary focus:ring-primary"
                      />
                      Valor Fixo por Aula/Hora
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input 
                        type="radio" 
                        checked={paymentType === "porcentagem"} 
                        onChange={() => setPaymentType("porcentagem")}
                        className="text-primary focus:ring-primary"
                      />
                      Porcentagem (%)
                    </label>
                  </div>
                  
                  {paymentType === "fixo" ? (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">Valor da Hora (R$)</label>
                      <Input 
                        type="number" 
                        step="0.01"
                        value={hourlyRate} 
                        onChange={e => setHourlyRate(e.target.value)} 
                        placeholder="Ex: 40.00" 
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">Porcentagem de Comissão (%)</label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={paymentPercentage} 
                        onChange={e => setPaymentPercentage(e.target.value)} 
                        placeholder="Ex: 50" 
                      />
                    </div>
                  )}
                </div>
              </div>

              <Button 
                onClick={handleSave} 
                className="w-full mt-4" 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="animate-spin" /> : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {professores?.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8 text-muted-foreground" />
            </div>
            <h4 className="font-outfit text-lg font-bold">Nenhum professor cadastrado</h4>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Professor" para adicionar membros à equipe.</p>
          </div>
        ) : (
          professores?.map((prof) => {
            const initials = prof.name?.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() || "P";
            const especialidades = prof.especialidade ? prof.especialidade.split(",").map((s: string) => s.trim()) : [];
            
            return (
              <div key={prof.id} className="bg-card hover:bg-muted/30 border border-border rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all duration-300 hover:shadow-md">
                <div className="flex items-center gap-5">
                  <Avatar className="h-14 w-14 ring-2 ring-primary/20 shadow-md">
                    <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-white font-outfit font-black text-xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-outfit text-xl font-black text-foreground">{prof.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium mt-1">
                      <Mail className="w-3.5 h-3.5" />
                      {prof.email}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col md:items-end gap-3">
                  <div className="flex flex-wrap gap-2">
                    {especialidades.length > 0 ? (
                      especialidades.map((esp: string, i: number) => (
                        <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold px-3 py-1 rounded-lg">
                          {esp}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic bg-muted px-3 py-1 rounded-lg">Sem especialidade</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors" onClick={() => handleOpenEdit(prof)}>
                      <Edit2 size={14} className="mr-2" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 rounded-lg font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={() => {
                      if (confirm("Tem certeza que deseja remover este professor? O acesso dele será bloqueado.")) {
                        deleteMutation.mutate({ id: prof.id });
                      }
                    }}>
                      {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} className="mr-2" />} Excluir
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
