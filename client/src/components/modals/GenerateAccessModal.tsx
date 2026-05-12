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

  const { data: student, isLoading, error } = trpc.students.getDetails.useQuery(
    { id: studentId as number },
    { enabled: !!studentId && open, retry: false }
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

  const isDataLoading = isLoading || (!!studentId && !student && !error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw] p-0 overflow-hidden bg-background rounded-[2.5rem] border-border/40 shadow-2xl max-h-[90vh] flex flex-col transition-all duration-500 ease-in-out">
        {/* Header */}
        <div className="flex items-start justify-between p-8 pb-6 border-b border-border/20 bg-card/50">
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tight">Gerar acesso do aluno</h2>
            <p className="text-sm font-medium text-muted-foreground mt-1">Crie as credenciais para o portal do aluno com segurança e rapidez.</p>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-all shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper Superior Modernizado */}
        <div className="px-8 py-6 border-b border-border/10 bg-muted/5">
          <div className="max-w-3xl mx-auto flex items-center justify-between relative">
            {/* Connecting Lines */}
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-border/40 -translate-y-1/2 z-0" />
            
            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 border-4 border-background transition-all scale-110">
                <User size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Dados do aluno</span>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-background border-4 border-border/40 text-muted-foreground flex items-center justify-center transition-all">
                <Lock size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Permissões</span>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-background border-4 border-border/40 text-muted-foreground flex items-center justify-center transition-all">
                <CheckCircle2 size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumo</span>
            </div>
          </div>
        </div>

        {isDataLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 min-h-[500px]">
            <div className="w-16 h-16 rounded-[2rem] bg-primary/10 flex items-center justify-center text-primary">
              <RefreshCw className="animate-spin" size={32} />
            </div>
            <p className="text-sm font-black text-muted-foreground uppercase tracking-widest animate-pulse">Sincronizando dados...</p>
          </div>
        ) : error || !student ? (
          <div className="p-12 flex flex-col items-center justify-center gap-6 min-h-[500px]">
            <div className="w-20 h-20 rounded-[2rem] bg-rose-500/10 text-rose-500 flex items-center justify-center shadow-inner">
              <AlertCircle size={40} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-foreground">Ops! Algo deu errado</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">
                Não conseguimos localizar as informações deste aluno no momento.
              </p>
            </div>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl px-8 h-12 font-bold transition-all hover:bg-muted">
              Voltar para lista
            </Button>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 bg-background">
            
            {/* Coluna Esquerda - Formulário (65%) */}
            <div className="flex-[0.65] p-10 overflow-y-auto no-scrollbar border-r border-border/10 bg-card/20">
              <div className="max-w-2xl mx-auto space-y-10">
                
                {/* DADOS PESSOAIS */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <User size={16} />
                    </div>
                    <h3 className="text-[12px] font-black text-foreground uppercase tracking-[0.2em]">Dados Pessoais</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                        Nome completo
                      </label>
                      <Input 
                        value={student.name} 
                        readOnly 
                        className="h-14 rounded-2xl bg-muted/30 border-border/40 text-foreground font-bold text-base px-6 shadow-sm cursor-default" 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                        E-mail de Acesso
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                        <Input 
                          value={student.email || ""} 
                          readOnly 
                          className="h-14 pl-14 rounded-2xl bg-muted/30 border-border/40 text-foreground font-bold text-base shadow-sm cursor-default" 
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium mt-1 ml-1 flex items-center gap-2">
                        <Info size={12} className="text-primary" />
                        Este e-mail será utilizado como login oficial no portal.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Telefone (WhatsApp)</label>
                        <Input 
                          value={student.phone || ""} 
                          readOnly 
                          className="h-14 rounded-2xl bg-muted/30 border-border/40 text-foreground font-bold px-6 shadow-sm cursor-default" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Data de Nascimento</label>
                        <Input 
                          value={student.birthDate ? format(new Date(student.birthDate), "dd/MM/yyyy") : ""} 
                          readOnly 
                          className="h-14 rounded-2xl bg-muted/30 border-border/40 text-foreground font-bold px-6 shadow-sm cursor-default" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nome do Responsável</label>
                        <Input 
                          value={student.guardianName || ""} 
                          readOnly 
                          className="h-14 rounded-2xl bg-muted/30 border-border/40 text-foreground font-bold px-6 shadow-sm cursor-default" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Telefone do Responsável</label>
                        <Input 
                          value={student.guardianPhone || ""} 
                          readOnly 
                          className="h-14 rounded-2xl bg-muted/30 border-border/40 text-foreground font-bold px-6 shadow-sm cursor-default" 
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-border/40 to-transparent" />

                {/* ACESSO DO ALUNO */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                      <Lock size={16} />
                    </div>
                    <h3 className="text-[12px] font-black text-foreground uppercase tracking-[0.2em]">Credenciais de Acesso</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                        Senha Temporária
                      </label>
                      <div className="flex gap-3">
                        <div className="relative flex-1">
                          <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={18} />
                          <Input 
                            value={password} 
                            readOnly 
                            className="h-14 pl-14 rounded-2xl bg-background border-indigo-500/20 text-indigo-600 font-black text-base shadow-lg shadow-indigo-500/5 cursor-default tracking-widest" 
                          />
                        </div>
                        <Button 
                          onClick={generatePassword} 
                          type="button" 
                          variant="outline"
                          className="h-14 px-6 rounded-2xl border-indigo-500/20 text-indigo-600 font-bold hover:bg-indigo-500/5 transition-all gap-2"
                        >
                          <RefreshCw size={18} />
                          <span className="hidden sm:inline">Nova Senha</span>
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-medium mt-2 ml-1 italic">
                        O aluno será obrigado a redefinir esta senha no primeiro acesso por segurança.
                      </p>
                    </div>

                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] p-6 flex gap-4 items-center mt-6">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                        <Mail size={20} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-emerald-700">Notificação Automática</p>
                        <p className="text-xs text-emerald-600/80 font-medium">
                          Um e-mail de boas-vindas com estas instruções será enviado instantaneamente.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Coluna Direita - Pré-visualização (35%) */}
            <div className="flex-[0.35] bg-muted/10 p-10 flex flex-col items-center justify-center relative overflow-hidden">
              {/* Decorative Circle Backgrounds */}
              <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="w-full max-w-[340px] relative z-10">
                <div className="text-center mb-8">
                  <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em]">Pré-visualização</h3>
                </div>

                <div className="bg-card rounded-[3rem] border border-border/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden transition-all hover:scale-[1.02] duration-500">
                  {/* Card Profile Area */}
                  <div className="p-10 pt-12 pb-8 flex flex-col items-center text-center bg-gradient-to-b from-primary/10 via-transparent to-transparent">
                    <div className="relative mb-6">
                      <div className="w-28 h-28 rounded-[2.5rem] bg-background border-4 border-card flex items-center justify-center text-4xl font-black text-primary shadow-2xl relative z-10 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50" />
                        {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center border-4 border-card shadow-xl z-20">
                        <Shield size={18} />
                      </div>
                    </div>
                    
                    <h4 className="text-2xl font-black text-foreground tracking-tight mb-1">{student.name}</h4>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">Portal do Aluno</p>
                    
                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                      <Circle size={8} fill="currentColor" className="animate-pulse" />
                      Status Ativo
                    </div>
                  </div>

                  {/* Info List */}
                  <div className="p-8 space-y-5">
                    <div className="flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground transition-all group-hover:bg-primary group-hover:text-white group-hover:scale-110">
                        <Mail size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Usuário</p>
                        <p className="text-sm font-bold text-foreground truncate">{student.email || "---"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground transition-all group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110">
                        <Lock size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Senha Inicial</p>
                        <p className="text-sm font-black text-foreground tracking-widest">{password}</p>
                      </div>
                    </div>

                    <div className="pt-4">
                      <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10 flex gap-3 group hover:bg-primary/10 transition-colors">
                        <Info size={16} className="text-primary shrink-0 mt-0.5 group-hover:rotate-12 transition-transform" />
                        <p className="text-[11px] text-primary/80 font-bold leading-relaxed">
                          Acesso restrito ao perfil, aulas e materiais do aluno.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col items-center gap-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Calendar size={12} className="text-primary" />
                    Criação: {format(new Date(), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Rodapé Padronizado */}
        <div className="p-8 border-t border-border/10 flex items-center justify-end gap-4 bg-card">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-muted-foreground hover:bg-muted transition-all"
          >
            Cancelar
          </Button>
          <Button 
            className="h-14 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all gap-3"
            onClick={handleSubmit}
            disabled={enableAccessMutation.isPending || !student?.email}
          >
            {enableAccessMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : null}
            Liberar Acesso &rarr;
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
