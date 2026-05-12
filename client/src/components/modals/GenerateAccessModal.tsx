import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  X, User, Lock, CheckCircle2, Calendar, 
  Mail, Shield, Info, RefreshCw, AlertCircle,
  Circle, Copy, ChevronRight, Phone
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GenerateAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number | null;
}

export function GenerateAccessModal({ open, onOpenChange, studentId }: GenerateAccessModalProps) {
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();

  const { data: student, isLoading, error } = trpc.students.getDetails.useQuery(
    { id: studentId as number },
    { enabled: !!studentId && open, retry: false }
  );

  // Generate random password
  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    const namePart = student?.name ? student.name.split(" ")[0] : "Music";
    let pass = namePart.charAt(0).toUpperCase() + namePart.slice(1) + "@2025!";
    setPassword(pass);
  };

  useEffect(() => {
    if (open && student) {
      generatePassword();
    }
  }, [open, student]);

  const enableAccessMutation = trpc.students.enablePortalAccess.useMutation({
    onSuccess: () => {
      utils.students.getDetails.invalidate({ id: studentId as number });
      utils.students.list.invalidate();
      toast.success("Acesso liberado com sucesso!");
      onOpenChange(false);
    },
    onError: (e) => toast.error("Erro ao liberar acesso: " + e.message),
  });

  const handleSubmit = () => {
    if (!studentId || !student?.email) {
      toast.error("O aluno precisa ter um e-mail cadastrado.");
      return;
    }
    enableAccessMutation.mutate({
      studentId,
      email: student.email,
      password,
    });
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(password);
    toast.success("Senha copiada!");
  };

  if (!open) return null;

  const isDataLoading = isLoading || (!!studentId && !student && !error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] w-[95vw] p-0 overflow-hidden bg-white dark:bg-slate-950 rounded-[2.5rem] border-none shadow-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-8 pb-6 border-b border-border/40">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Gerar acesso do aluno</h2>
            <p className="text-sm text-muted-foreground mt-1">Crie o acesso de login para o aluno acessar sua área</p>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper Superior */}
        <div className="px-8 py-6 bg-muted/5">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-md shadow-primary/20">1</div>
              <span className="text-xs font-bold text-primary">Dados do aluno</span>
            </div>
            <div className="w-16 h-[2px] bg-border/40" />
            <div className="flex items-center gap-3 opacity-50">
              <div className="w-8 h-8 rounded-full border-2 border-border text-muted-foreground flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-xs font-bold text-muted-foreground">Acesso e permissões</span>
            </div>
            <div className="w-16 h-[2px] bg-border/40" />
            <div className="flex items-center gap-3 opacity-50">
              <div className="w-8 h-8 rounded-full border-2 border-border text-muted-foreground flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-xs font-bold text-muted-foreground">Resumo</span>
            </div>
          </div>
        </div>

        {isDataLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 min-h-[500px]">
            <RefreshCw className="animate-spin text-primary" size={32} />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Carregando...</p>
          </div>
        ) : error || !student ? (
          <div className="p-12 flex flex-col items-center justify-center gap-6 min-h-[500px]">
            <AlertCircle className="text-rose-500" size={40} />
            <p className="text-sm font-bold text-muted-foreground">Erro ao carregar dados do aluno.</p>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden min-h-0 bg-white dark:bg-slate-950">
            
            {/* Coluna Esquerda - Formulário */}
            <div className="flex-1 p-10 overflow-y-auto no-scrollbar">
              <div className="max-w-2xl mx-auto space-y-10">
                
                {/* DADOS PESSOAIS */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-primary rounded-full" />
                    <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Dados Pessoais</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1 tracking-wider">Nome completo <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                        <Input value={student.name} readOnly className="h-12 pl-10 rounded-xl bg-muted/10 border-border/40 text-sm font-medium focus:ring-primary/20" />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1 tracking-wider">E-mail <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                        <Input value={student.email || ""} readOnly className="h-12 pl-10 rounded-xl bg-muted/10 border-border/40 text-sm font-medium focus:ring-primary/20" />
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">Será o usuário para login do aluno</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Telefone (WhatsApp)</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                        <Input value={student.phone || ""} readOnly className="h-12 pl-10 rounded-xl bg-muted/10 border-border/40 text-sm font-medium focus:ring-primary/20" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Data de nascimento</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                        <Input value={student.birthDate ? format(new Date(student.birthDate), "dd/MM/yyyy") : ""} readOnly className="h-12 pl-10 rounded-xl bg-muted/10 border-border/40 text-sm font-medium focus:ring-primary/20" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Nome do responsável</label>
                      <Input value={student.guardianName || ""} readOnly className="h-12 rounded-xl bg-muted/10 border-border/40 text-sm font-medium focus:ring-primary/20" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Telefone do responsável</label>
                      <Input value={student.guardianPhone || ""} readOnly className="h-12 rounded-xl bg-muted/10 border-border/40 text-sm font-medium focus:ring-primary/20" />
                    </div>
                  </div>
                </div>

                {/* ACESSO DO ALUNO */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-primary rounded-full" />
                    <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Acesso do Aluno</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Login (e-mail)</label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                        <Input value={student.email || ""} readOnly className="h-12 pl-10 rounded-xl bg-muted/10 border-border/40 text-sm font-medium focus:ring-primary/20" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Senha temporária</label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={16} />
                          <Input value={password} readOnly className="h-12 pl-10 rounded-xl bg-muted/10 border-border/40 text-sm font-mono font-bold text-primary focus:ring-primary/20" />
                        </div>
                        <button 
                          onClick={handleCopyPassword} 
                          title="Copiar senha"
                          className="w-12 h-12 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary transition-all shadow-sm"
                        >
                          <Copy size={18} />
                        </button>
                        <button 
                          onClick={generatePassword} 
                          className="h-12 px-6 rounded-xl text-primary text-xs font-bold hover:bg-primary/5 transition-all flex items-center gap-2"
                        >
                          <RefreshCw size={14} />
                          Gerar nova
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">O aluno deverá alterar a senha no primeiro acesso</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita - Pré-visualização */}
            <div className="w-[400px] p-10 border-l border-border/40 bg-muted/5 flex flex-col items-center justify-center">
              <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-8">Pré-visualização do acesso</h3>
              
              <div className="w-full max-w-[320px] bg-white dark:bg-slate-900 rounded-[3rem] border border-border/40 p-10 flex flex-col items-center text-center shadow-xl relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-primary/5 to-transparent" />
                
                <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary mb-8 shadow-inner border-4 border-white dark:border-slate-800 z-10">
                  {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                
                <div className="z-10 w-full">
                  <h4 className="text-xl font-extrabold text-foreground mb-1 truncate">{student.name}</h4>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-10">Portal do Aluno</p>
                  
                  <div className="inline-flex px-5 py-2 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 mb-10 items-center gap-2">
                    Acesso Ativo <CheckCircle2 size={12} className="text-emerald-500" />
                  </div>
                  
                  <div className="w-full space-y-5 text-left bg-muted/20 p-5 rounded-2xl border border-border/20">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary shadow-sm border border-border/20">
                        <Mail size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.1em]">E-mail de acesso</p>
                        <p className="text-sm font-bold text-foreground truncate">{student.email || "---"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="mt-10 text-[11px] text-muted-foreground text-center px-10 leading-relaxed">
                Este é um exemplo de como o aluno visualizará seu perfil ao acessar o portal pela primeira vez.
              </p>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="p-8 border-t border-border/40 flex items-center justify-end gap-4 bg-muted/5">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            className="h-12 px-10 rounded-xl text-sm font-bold transition-all text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </Button>
          <Button 
            className="h-12 px-12 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-xl shadow-primary/20 transition-all flex items-center gap-3 transform hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleSubmit}
            disabled={enableAccessMutation.isPending || !student?.email}
          >
            {enableAccessMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : "Habilitar Acesso"}
            <ChevronRight size={18} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
