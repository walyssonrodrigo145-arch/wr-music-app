import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  X, User, Lock, CheckCircle2, Calendar, 
  Mail, Shield, Info, RefreshCw, AlertCircle
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

  const { data: student, isLoading } = trpc.students.getDetails.useQuery(
    { id: studentId as number },
    { enabled: !!studentId && open }
  );

  const { data: me } = trpc.auth.me.useQuery(undefined, { enabled: open });

  // Generate random password
  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  useEffect(() => {
    if (open) {
      generatePassword();
    }
  }, [open]);

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

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-background rounded-3xl border-border/40 shadow-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border/20">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Gerar acesso do aluno</h2>
            <p className="text-sm text-muted-foreground mt-1">Crie o acesso de login para o aluno acessar sua área</p>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-12 py-4 bg-muted/10 border-b border-border/20">
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <User size={12} />
            </div>
            Dados do aluno
          </div>
          <div className="h-[1px] w-12 bg-border/40" />
          <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <Lock size={12} />
            </div>
            Acesso e permissões
          </div>
          <div className="h-[1px] w-12 bg-border/40" />
          <div className="flex items-center gap-2 text-muted-foreground font-medium text-sm">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <CheckCircle2 size={12} />
            </div>
            Resumo
          </div>
        </div>

        {isLoading || !student ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 min-h-[400px]">
            <RefreshCw className="animate-spin text-primary w-10 h-10" />
            <p className="text-muted-foreground animate-pulse">Carregando dados do aluno...</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
            
            {/* Left Column - Form */}
            <div className="flex-1 p-6 md:p-10 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              
              <div className="space-y-6">
                {/* DADOS PESSOAIS */}
                <div>
                  <h3 className="text-[11px] font-bold text-primary uppercase tracking-widest mb-4">Dados Pessoais</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1.5 block">
                        Nome completo <span className="text-rose-500">*</span>
                      </label>
                      <Input value={student.name} readOnly className="bg-muted/30 border-border/40 text-muted-foreground" />
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1.5 block">
                        E-mail <span className="text-rose-500">*</span>
                      </label>
                      <Input value={student.email || ""} readOnly className="bg-muted/30 border-border/40 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground mt-1">Será o usuário para login do aluno</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1.5 block">Telefone (WhatsApp)</label>
                        <Input value={student.phone || ""} readOnly className="bg-muted/30 border-border/40 text-muted-foreground" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1.5 block">Data de nascimento</label>
                        <Input value={student.birthDate ? format(new Date(student.birthDate), "dd/MM/yyyy") : ""} readOnly className="bg-muted/30 border-border/40 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1.5 block">Nome do responsável</label>
                        <Input value={student.guardianName || ""} readOnly className="bg-muted/30 border-border/40 text-muted-foreground" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-foreground mb-1.5 block">Telefone do responsável</label>
                        <Input value={student.guardianPhone || ""} readOnly className="bg-muted/30 border-border/40 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-[1px] w-full bg-border/20" />

                {/* ACESSO DO ALUNO */}
                <div>
                  <h3 className="text-[11px] font-bold text-primary uppercase tracking-widest mb-4">Acesso do Aluno</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1.5 block">
                        Senha inicial <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <Input value={password} readOnly className="font-mono bg-background border-border flex-1" />
                        <Button variant="outline" onClick={generatePassword} type="button" className="shrink-0 gap-2 font-medium">
                          <RefreshCw size={14} />
                          Gerar nova
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">O aluno poderá alterar a senha após o primeiro login.</p>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex gap-3 items-center">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Mail size={14} />
                      </div>
                      <p className="text-xs text-primary font-medium">
                        Enviaremos um e-mail com os dados de acesso para o aluno.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="flex-1 bg-muted/30 p-6 md:p-10 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent border-l border-border/20">
              <h3 className="text-[11px] font-bold text-primary uppercase tracking-widest mb-4">Pré-visualização do acesso</h3>
              
              <div className="bg-card rounded-[32px] border border-border/60 shadow-xl overflow-hidden max-w-md mx-auto">
                {/* Preview Header */}
                <div className="p-8 pb-6 border-b border-border/40 flex flex-col items-center text-center bg-gradient-to-b from-primary/5 to-transparent">
                  <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-black uppercase tracking-tighter mb-5 border-4 border-background shadow-lg">
                    {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                  </div>
                  <h4 className="text-xl font-bold text-foreground mb-1 tracking-tight">{student.name}</h4>
                  <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-4">Portal do Aluno</p>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-xs font-bold uppercase tracking-wide">
                    Acesso Ativo <CheckCircle2 size={14} className="fill-emerald-500/20" />
                  </div>
                </div>

                {/* Preview Body */}
                <div className="p-0">
                  <div className="flex items-start gap-4 p-4 border-b border-border/40">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">
                      <Mail size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">E-mail</p>
                      <p className="text-sm font-medium text-foreground">{student.email || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border-b border-border/40">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">
                      <User size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Usuário</p>
                      <p className="text-sm font-medium text-foreground">{student.email || "Não informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border-b border-border/40">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">
                      <Lock size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Senha inicial</p>
                      <p className="text-sm font-medium text-foreground tracking-widest">{password}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border-b border-border/40">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">
                      <Shield size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Professor responsável</p>
                      <p className="text-sm font-medium text-foreground">{me?.name || "Professor"}</p>
                      <p className="text-xs text-muted-foreground">{me?.email || ""}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border-b border-border/40">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground shrink-0">
                      <Calendar size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground mb-0.5">Data de criação</p>
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex gap-3">
                      <Info size={16} className="text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-primary font-medium leading-relaxed">
                        O aluno terá acesso apenas ao seu conteúdo e informações. Vinculado exclusivamente a este professor.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Footer */}
        <div className="p-4 md:px-6 border-t border-border/20 flex items-center justify-end gap-3 bg-card">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-medium">
            Cancelar
          </Button>
          <Button 
            className="rounded-xl font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            onClick={handleSubmit}
            disabled={enableAccessMutation.isPending || !student?.email}
          >
            {enableAccessMutation.isPending ? <RefreshCw className="animate-spin" size={16} /> : null}
            Continuar &rarr;
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
