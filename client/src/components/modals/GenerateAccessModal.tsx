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
        <div className="flex items-center justify-between p-8 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Gerar acesso do aluno</h2>
            <p className="text-xs text-muted-foreground mt-1">Crie o acesso de login para o aluno acessar sua área</p>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stepper Superior */}
        <div className="px-8 pb-8">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">1</div>
              <span className="text-[11px] font-bold text-primary">Dados do aluno</span>
            </div>
            <div className="w-12 h-[1px] bg-border/40" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full border border-border text-muted-foreground flex items-center justify-center text-[10px] font-bold">2</div>
              <span className="text-[11px] font-bold text-muted-foreground">Acesso e permissões</span>
            </div>
            <div className="w-12 h-[1px] bg-border/40" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full border border-border text-muted-foreground flex items-center justify-center text-[10px] font-bold">3</div>
              <span className="text-[11px] font-bold text-muted-foreground">Resumo</span>
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
          <div className="flex flex-1 overflow-hidden min-h-0">
            
            {/* Coluna Esquerda - Formulário */}
            <div className="flex-1 p-8 pt-0 overflow-y-auto no-scrollbar">
              <div className="space-y-8">
                
                {/* DADOS PESSOAIS */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Dados Pessoais</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">Nome completo <span className="text-rose-500">*</span></label>
                      <Input value={student.name} readOnly className="h-11 rounded-xl bg-muted/10 border-border/40 text-xs font-bold" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">E-mail <span className="text-rose-500">*</span></label>
                      <Input value={student.email || ""} readOnly className="h-11 rounded-xl bg-muted/10 border-border/40 text-xs font-bold" />
                      <p className="text-[9px] text-muted-foreground">Será o usuário para login do aluno</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Telefone (WhatsApp)</label>
                        <Input value={student.phone || ""} readOnly className="h-11 rounded-xl bg-muted/10 border-border/40 text-xs font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Data de nascimento</label>
                        <div className="relative">
                          <Input value={student.birthDate ? format(new Date(student.birthDate), "dd/MM/yyyy") : ""} readOnly className="h-11 rounded-xl bg-muted/10 border-border/40 text-xs font-bold pr-10" />
                          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Nome do responsável</label>
                        <Input value={student.guardianName || ""} readOnly className="h-11 rounded-xl bg-muted/10 border-border/40 text-xs font-bold" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Telefone do responsável</label>
                        <Input value={student.guardianPhone || ""} readOnly className="h-11 rounded-xl bg-muted/10 border-border/40 text-xs font-bold" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACESSO DO ALUNO */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Acesso do Aluno</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Login (e-mail)</label>
                      <Input value={student.email || ""} readOnly className="h-11 rounded-xl bg-muted/10 border-border/40 text-xs font-bold" />
                      <p className="text-[9px] text-muted-foreground">Será utilizado para login no portal do aluno</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Senha temporária</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input value={password} readOnly className="h-11 rounded-xl bg-muted/10 border-border/40 text-xs font-bold" />
                        </div>
                        <button onClick={handleCopyPassword} className="w-11 h-11 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all">
                          <Copy size={16} />
                        </button>
                        <button onClick={generatePassword} className="h-11 px-4 rounded-xl text-primary text-[10px] font-bold hover:underline">
                          Gerar nova
                        </button>
                      </div>
                      <p className="text-[9px] text-muted-foreground">O aluno deverá alterar a senha no primeiro acesso</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita - Pré-visualização */}
            <div className="w-[380px] p-8 pt-0 border-l border-border/40 bg-muted/5 flex flex-col items-center">
              <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-6">Pré-visualização do acesso</h3>
              
              <div className="w-full bg-white dark:bg-slate-900 rounded-[2.5rem] border border-border/40 p-10 flex flex-col items-center text-center shadow-sm">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary mb-6 shadow-inner">
                  {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                
                <h4 className="text-xl font-bold text-foreground mb-1">{student.name}</h4>
                <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-8">Portal do Aluno</p>
                
                <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-bold uppercase tracking-widest border border-emerald-500/20 mb-10 flex items-center gap-1.5">
                  Acesso Ativo <CheckCircle2 size={10} />
                </div>
                
                <div className="w-full space-y-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
                      <Mail size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">E-mail de acesso</p>
                      <p className="text-xs font-bold text-foreground truncate">{student.email || "---"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="p-8 pt-4 flex items-center justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="h-10 px-8 rounded-xl text-xs font-bold transition-all border-border/40"
          >
            Cancelar
          </Button>
          <Button 
            className="h-10 px-8 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
            onClick={handleSubmit}
            disabled={enableAccessMutation.isPending || !student?.email}
          >
            Continuar &rarr;
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
