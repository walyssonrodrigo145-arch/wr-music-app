import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

export function ProfessoresTab() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telefone, setTelefone] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [permissions, setPermissions] = useState<string[]>(["aulas", "progresso"]);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest">Equipe de Professores</h3>
          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Gerencie os acessos dos professores</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={(val) => { setIsOpen(val); if (!val) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
              <Plus size={16} />
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
                <label className="text-xs font-semibold mb-2 block">Permissões de Acesso</label>
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

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-3 font-semibold">Nome</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Especialidade</th>
                <th className="px-6 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {professores?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    Nenhum professor cadastrado ainda.
                  </td>
                </tr>
              ) : (
                professores?.map((prof) => (
                  <tr key={prof.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{prof.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{prof.email}</td>
                    <td className="px-6 py-4 text-muted-foreground">{prof.especialidade || "-"}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleOpenEdit(prof)}>
                          <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => {
                          if (confirm("Tem certeza que deseja remover este professor? O acesso dele será bloqueado.")) {
                            deleteMutation.mutate({ id: prof.id });
                          }
                        }}>
                          {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
