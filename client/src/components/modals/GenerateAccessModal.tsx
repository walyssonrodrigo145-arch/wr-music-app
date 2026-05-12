import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  X, CheckCircle2,
  Mail, RefreshCw, AlertCircle,
  Copy, ChevronRight, CalendarIcon
} from "lucide-react";
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
    if (!student?.name) return;
    const namePart = student.name.split(" ")[0];
    const lastNamePart = student.name.split(" ").pop() || "";
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
      <DialogContent className="max-w-[1100px] w-[95vw] p-0 overflow-hidden bg-background rounded-[24px] border border-border shadow-xl max-h-[90vh] flex flex-col gap-0 focus:outline-none">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between p-8 pb-6 border-b border-border/40 relative">
          <div className="flex-1 pr-12">
            <h2 className="text-[32px] font-bold text-foreground leading-tight">Gerar acesso do aluno</h2>
            <p className="text-[16px] text-muted-foreground mt-1">Crie o acesso de login para o aluno acessar sua área</p>
          </div>
          
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-8 right-8 w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-8 py-6 border-b border-border/40 flex items-center justify-center gap-3 text-[14px] font-medium text-muted-foreground">
          <div className="flex items-center gap-2 text-primary">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
            <span className="font-semibold">Dados do aluno</span>
          </div>
          <div className="w-16 h-[1px] bg-border mx-2"></div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">2</div>
            <span>Acesso e permissões</span>
          </div>
          <div className="w-16 h-[1px] bg-border mx-2"></div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">3</div>
            <span>Resumo</span>
          </div>
        </div>

        {isDataLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-6 min-h-[400px]">
            <RefreshCw className="animate-spin text-primary" size={40} />
            <p className="text-sm font-medium text-muted-foreground">Carregando dados...</p>
          </div>
        ) : error || !student ? (
          <div className="p-20 flex flex-col items-center justify-center gap-6 min-h-[400px]">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="text-destructive" size={32} />
            </div>
            <p className="text-base font-medium text-muted-foreground">Não foi possível localizar os dados deste aluno.</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
            
            {/* Esquerda - Formulário (60%) */}
            <div className="w-full md:w-[60%] p-8 overflow-y-auto border-r border-border/40 space-y-8">
              
              {/* DADOS PESSOAIS */}
              <div>
                <h3 className="text-[13px] font-bold text-primary uppercase tracking-wider mb-5">Dados Pessoais</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[14px] font-medium text-foreground">Nome completo <span className="text-destructive">*</span></label>
                    <Input value={student.name} readOnly className="h-12 bg-background border-border text-foreground text-[15px]" />
                  </div>
                  
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[14px] font-medium text-foreground">E-mail <span className="text-destructive">*</span></label>
                    <Input value={student.email || ""} readOnly className="h-12 bg-background border-border text-foreground text-[15px]" />
                    <p className="text-[13px] text-muted-foreground mt-1">Será o usuário para login do aluno</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[14px] font-medium text-foreground">Telefone (WhatsApp)</label>
                    <Input value={student.phone || ""} readOnly className="h-12 bg-background border-border text-foreground text-[15px]" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[14px] font-medium text-foreground">Data de nascimento</label>
                    <div className="relative">
                      <Input value="--" readOnly className="h-12 bg-background border-border text-foreground text-[15px] pr-10" />
                      <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[14px] font-medium text-foreground">Nome do responsável</label>
                    <Input value="--" readOnly className="h-12 bg-background border-border text-foreground text-[15px]" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[14px] font-medium text-foreground">Telefone do responsável</label>
                    <Input value="--" readOnly className="h-12 bg-background border-border text-foreground text-[15px]" />
                  </div>
                </div>
              </div>

              {/* ACESSO DO ALUNO */}
              <div>
                <h3 className="text-[13px] font-bold text-primary uppercase tracking-wider mb-5">Acesso do Aluno</h3>
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[14px] font-medium text-foreground">Login (e-mail)</label>
                    <Input value={student.email || ""} readOnly className="h-12 bg-muted/30 border-border text-foreground text-[15px]" />
                    <p className="text-[13px] text-muted-foreground mt-1">Será utilizado para login no portal do aluno</p>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[14px] font-medium text-foreground">Senha temporária</label>
                    <div className="flex items-center gap-3">
                      <Input value={password} readOnly className="h-12 font-mono flex-1 bg-muted/30 border-border text-foreground text-[15px]" />
                      <button 
                        onClick={handleCopyPassword}
                        className="w-12 h-12 flex items-center justify-center border border-border rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
                        title="Copiar senha"
                      >
                        <Copy size={18} />
                      </button>
                      <button 
                        onClick={generatePassword}
                        className="text-[14px] font-medium text-primary hover:text-primary/80 transition-colors shrink-0 px-2"
                      >
                        Gerar nova
                      </button>
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-1">O aluno deverá alterar a senha no primeiro acesso</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Direita - Preview (40%) */}
            <div className="w-full md:w-[40%] bg-muted/10 p-8 flex flex-col items-center">
              <h3 className="text-[13px] font-bold text-primary uppercase tracking-wider mb-8 w-full text-center">Pré-visualização do Acesso</h3>
              
              <div className="w-full max-w-[320px] bg-background rounded-3xl border border-border shadow-sm p-8 flex flex-col items-center text-center mt-4">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary mb-5">
                  {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                
                <h4 className="text-[20px] font-bold text-foreground leading-tight mb-2">{student.name}</h4>
                <p className="text-[12px] font-bold text-primary uppercase tracking-widest mb-6">Portal do Aluno</p>
                
                <div className="px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[12px] font-bold uppercase tracking-wider flex items-center gap-2 mb-8 border border-emerald-500/20">
                  Acesso Ativo <CheckCircle2 size={14} strokeWidth={3} />
                </div>
                
                <div className="w-full bg-muted/30 rounded-2xl p-4 flex items-center gap-4 text-left border border-border/50">
                  <div className="w-10 h-10 rounded-xl bg-background border border-border/50 flex items-center justify-center text-muted-foreground shrink-0 shadow-sm">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">E-mail de acesso</p>
                    <p className="text-[14px] font-medium text-foreground truncate">{student.email || "---"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-5 border-t border-border/40 bg-background flex flex-col sm:flex-row items-center justify-between gap-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="h-12 px-8 rounded-xl font-medium text-[15px] border-border text-foreground hover:bg-muted w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button 
            className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-[15px] flex items-center gap-2 w-full sm:w-auto"
            onClick={handleSubmit}
            disabled={enableAccessMutation.isPending || !student?.email}
          >
            {enableAccessMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : null}
            Continuar <ChevronRight size={18} />
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
