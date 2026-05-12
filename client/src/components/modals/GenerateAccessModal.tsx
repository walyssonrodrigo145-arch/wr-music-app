import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  X, User, Lock, CheckCircle2, Calendar, 
  Mail, Shield, Info, RefreshCw, AlertCircle,
  Copy, Phone, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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

  const generatePassword = () => {
    const namePart = student?.name ? student.name.split(" ")[0] : "Music";
    const lastNamePart = student?.name.split(" ").pop() || "";
    let pass = namePart.charAt(0).toUpperCase() + namePart.slice(1) + "@2025!" + lastNamePart;
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
      <DialogContent className="max-w-[1100px] w-[95vw] p-0 overflow-hidden bg-background rounded-[2.5rem] border-none shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header - Mais alto e limpo */}
        <div className="flex items-center justify-between p-12 pb-8 relative border-b border-border/10">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-foreground font-outfit tracking-tight">Gerar acesso do aluno</h2>
            <p className="text-base text-muted-foreground font-medium opacity-70">Configure as credenciais de entrada para o portal exclusivo</p>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-12 right-12 w-12 h-12 rounded-2xl bg-muted/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {isDataLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-6 min-h-[500px]">
            <RefreshCw className="animate-spin text-primary" size={48} />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.3em]">Preparando ambiente...</p>
          </div>
        ) : error || !student ? (
          <div className="p-20 flex flex-col items-center justify-center gap-8 min-h-[500px]">
            <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center">
              <AlertCircle className="text-rose-500" size={40} />
            </div>
            <p className="text-lg font-bold text-muted-foreground">Não foi possível localizar os dados deste aluno.</p>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden min-h-0">
            
            {/* Coluna Esquerda - Formulário Amplo */}
            <div className="flex-1 p-12 overflow-y-auto no-scrollbar space-y-12 border-r border-border/10">
              
              {/* Seção 01: Identificação */}
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                   <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em]">01. Identificação do Aluno</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Nome completo do aluno</label>
                    <Input value={student.name} readOnly className="h-14 rounded-2xl bg-muted/30 border-border/40 text-base font-bold focus:ring-0 px-6" />
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">E-mail de Cadastro</label>
                    <Input value={student.email || "Não informado"} readOnly className="h-14 rounded-2xl bg-muted/30 border-border/40 text-base font-bold px-6" />
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                    <Input value={student.phone || "---"} readOnly className="h-14 rounded-2xl bg-muted/30 border-border/40 text-base font-bold px-6" />
                  </div>
                </div>
              </div>

              {/* Seção 02: Configuração de Acesso */}
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                   <h3 className="text-sm font-black text-primary uppercase tracking-[0.2em]">02. Configuração de Acesso</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Usuário de Login</label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-primary opacity-50" size={20} />
                      <Input value={student.email || ""} readOnly className="h-14 pl-14 rounded-2xl bg-primary/5 border-primary/20 text-base font-bold text-primary" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Senha Temporária</label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-primary opacity-50" size={20} />
                        <Input value={password} readOnly className="h-14 pl-14 rounded-2xl bg-primary/5 border-primary/20 text-lg font-black text-primary font-mono tracking-wider" />
                      </div>
                      <button 
                        onClick={handleCopyPassword} 
                        className="w-14 h-14 rounded-2xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-primary transition-all shrink-0 shadow-sm"
                      >
                        <Copy size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita - Preview Amplo e Elegante */}
            <div className="w-[480px] bg-muted/5 p-12 flex flex-col items-center justify-center space-y-12">
              <div className="text-center space-y-2">
                <h3 className="text-xs font-black text-primary uppercase tracking-[0.4em]">Visualização Premium</h3>
                <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">Como o aluno verá seu acesso</p>
              </div>
              
              <div className="w-full bg-card rounded-[3.5rem] border border-border/40 p-12 flex flex-col items-center text-center shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-primary to-transparent opacity-30" />
                
                {/* Avatar Grande */}
                <div className="w-32 h-32 rounded-[3rem] bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-5xl font-black text-primary mb-10 shadow-inner border-4 border-card transition-transform group-hover:scale-105 duration-500">
                  {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                
                <div className="space-y-2 mb-10">
                  <h4 className="text-3xl font-black text-foreground font-outfit truncate w-full px-4 tracking-tight">{student.name}</h4>
                  <p className="text-xs font-black text-primary uppercase tracking-[0.5em] opacity-60">Portal do Aluno</p>
                </div>
                
                <div className="px-8 py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-black uppercase tracking-[0.2em] border border-emerald-500/20 mb-12 flex items-center gap-3">
                  Status: Ativo <CheckCircle2 size={16} strokeWidth={3} />
                </div>
                
                <div className="w-full space-y-6 text-left bg-muted/10 p-8 rounded-[2.5rem] border border-border/10">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-card flex items-center justify-center text-primary shadow-md border border-border/10">
                      <Mail size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">E-mail do Portal</p>
                      <p className="text-sm font-black text-foreground truncate">{student.email || "---"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer - Sólido e Espaçado */}
        <div className="p-12 border-t border-border/10 flex items-center justify-between bg-muted/5">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Info size={18} className="text-primary opacity-50" />
            <p className="text-[11px] font-bold uppercase tracking-widest">O aluno receberá estas credenciais no primeiro login</p>
          </div>
          
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)} 
              className="h-14 px-10 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button 
              className="h-14 px-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(var(--primary),0.3)] transition-all flex items-center gap-4 transform hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleSubmit}
              disabled={enableAccessMutation.isPending || !student?.email}
            >
              {enableAccessMutation.isPending ? <RefreshCw className="animate-spin" size={20} /> : "Finalizar Acesso"}
              <ChevronRight size={20} strokeWidth={3} />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
