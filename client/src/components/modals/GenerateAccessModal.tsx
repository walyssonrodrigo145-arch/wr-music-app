import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  X, CheckCircle2,
  Mail, RefreshCw, AlertCircle,
  Copy, ChevronRight, Calendar,
  User, ShieldCheck, Phone, ChevronLeft,
  DollarSign, FileText, BarChart3, Clock
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GenerateAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number | null;
}

export function GenerateAccessModal({ open, onOpenChange, studentId }: GenerateAccessModalProps) {
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState({
    canSeeFinanceiro: true,
    canSeeProgress: true,
    canSeeFiles: true,
    canSeeSchedule: true,
  });

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
      setStep(1); // Reset step when opening
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
      permissions,
    });
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(password);
    toast.success("Senha copiada!");
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  if (!open) return null;

  const isDataLoading = isLoading || (!!studentId && !student && !error);

  const permissionList = [
    { id: "canSeeFinanceiro", label: "Financeiro", desc: "Acesso a faturas e histórico de pagamentos", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-50" },
    { id: "canSeeProgress", label: "Progresso", desc: "Acesso ao diário de classe e avaliações", icon: BarChart3, color: "text-blue-500", bg: "bg-blue-50" },
    { id: "canSeeFiles", label: "Arquivos", desc: "Acesso a partituras, PDFs e materiais extras", icon: FileText, color: "text-amber-500", bg: "bg-amber-50" },
    { id: "canSeeSchedule", label: "Agenda", desc: "Acesso ao calendário de aulas e remarcações", icon: Clock, color: "text-purple-500", bg: "bg-purple-50" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px] w-[95vw] h-[85vh] p-0 overflow-hidden bg-background rounded-[32px] border border-border shadow-2xl flex flex-col gap-0 focus:outline-none">
        
        {/* HEADER */}
        <div className="border-b border-border/40 px-8 py-7 relative">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2">
              <DialogTitle className="text-[38px] font-black tracking-[-1px] text-foreground leading-tight">
                Gerar acesso do aluno
              </DialogTitle>

              <DialogDescription className="text-[16px] text-muted-foreground leading-relaxed max-w-[620px]">
                {step === 1 && "Verifique os dados básicos do aluno antes de prosseguir."}
                {step === 2 && "Defina quais áreas o aluno poderá visualizar em seu portal exclusivo."}
                {step === 3 && "Confira o resumo das configurações antes de finalizar o acesso."}
              </DialogDescription>
            </div>

            <button 
              onClick={() => onOpenChange(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* STEPPER */}
          <div className="mt-8 flex items-center gap-4">
            {/* STEP 1 */}
            <div className={`flex items-center gap-3 transition-opacity ${step >= 1 ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-lg transition-colors ${step === 1 ? 'bg-primary text-primary-foreground shadow-primary/30' : 'bg-emerald-500 text-white'}`}>
                {step > 1 ? <CheckCircle2 size={20} /> : "1"}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Dados do aluno</p>
                <p className="text-xs text-muted-foreground">Informações básicas</p>
              </div>
            </div>

            <div className={`h-px flex-1 transition-colors ${step > 1 ? 'bg-emerald-500' : 'bg-border'}`} />

            {/* STEP 2 */}
            <div className={`flex items-center gap-3 transition-opacity ${step >= 2 ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-lg transition-colors ${step === 2 ? 'bg-primary text-primary-foreground shadow-primary/30' : step > 2 ? 'bg-emerald-500 text-white' : 'border border-border bg-background text-muted-foreground'}`}>
                {step > 2 ? <CheckCircle2 size={20} /> : "2"}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Permissões</p>
                <p className="text-xs text-muted-foreground">Controle de acesso</p>
              </div>
            </div>

            <div className={`h-px flex-1 transition-colors ${step > 2 ? 'bg-emerald-500' : 'bg-border'}`} />

            {/* STEP 3 */}
            <div className={`flex items-center gap-3 transition-opacity ${step >= 3 ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shadow-lg transition-colors ${step === 3 ? 'bg-primary text-primary-foreground shadow-primary/30' : 'border border-border bg-background text-muted-foreground'}`}>
                3
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Resumo</p>
                <p className="text-xs text-muted-foreground">Finalização</p>
              </div>
            </div>
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
          <div className="grid grid-cols-12 gap-0 overflow-hidden flex-1 min-h-0">
            {/* FORM (7 columns) */}
            <div className="col-span-12 lg:col-span-7 p-10 overflow-y-auto border-r border-border/40 space-y-12 scrollbar-none">
              
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-left duration-500">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground tracking-tight">Dados pessoais</h3>
                      <p className="text-sm text-muted-foreground">Informações básicas do cadastro do aluno</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80">Nome completo</label>
                      <Input value={student.name} readOnly className="h-14 w-full rounded-2xl bg-muted/20 border-border/60 text-base font-medium focus:ring-0" />
                    </div>
                    
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80">E-mail para login</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/60" />
                        <Input value={student.email || ""} readOnly className="h-14 w-full pl-12 rounded-2xl bg-muted/20 border-border/60 text-base font-medium" />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80">Telefone / WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/60" />
                        <Input value={student.phone || ""} readOnly className="h-14 w-full pl-12 rounded-2xl bg-muted/20 border-border/60 text-base font-medium" />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80">Nascimento</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/60" />
                        <Input 
                          value={student.birthDate ? format(new Date(student.birthDate), "dd/MM/yyyy") : "--"} 
                          readOnly 
                          className="h-14 w-full pl-12 rounded-2xl bg-muted/20 border-border/60 text-base font-medium" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-12">
                    <div className="mb-6 flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-sm">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground tracking-tight">Segurança e Acesso</h3>
                        <p className="text-sm text-muted-foreground">Configure as credenciais de login</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80">Usuário (Login)</label>
                        <Input value={student.email || ""} readOnly className="h-14 w-full rounded-2xl bg-primary/5 border-primary/20 text-base font-semibold text-primary" />
                      </div>

                      <div>
                        <label className="mb-2 block text-[13px] font-bold uppercase tracking-wider text-muted-foreground/80">Senha temporária sugerida</label>
                        <div className="flex items-center gap-3">
                          <Input value={password} readOnly className="h-14 w-full rounded-2xl bg-muted/20 border-border/60 font-mono text-lg tracking-tight" />
                          <button 
                            onClick={handleCopyPassword}
                            className="w-14 h-14 flex items-center justify-center border border-border rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all shrink-0 shadow-sm"
                            title="Copiar senha"
                          >
                            <Copy size={20} />
                          </button>
                          <button 
                            onClick={generatePassword}
                            className="text-sm font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-all shrink-0 px-4"
                          >
                            Gerar nova
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right duration-500">
                  <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground tracking-tight">Permissões do Portal</h3>
                      <p className="text-sm text-muted-foreground">Selecione o que este aluno poderá acessar</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {permissionList.map((perm) => {
                      const Icon = perm.icon;
                      return (
                        <div key={perm.id} className="flex items-center justify-between p-6 rounded-3xl border border-border/60 bg-muted/5 hover:bg-muted/10 transition-colors">
                          <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-2xl ${perm.bg} ${perm.color} flex items-center justify-center shadow-sm`}>
                              <Icon size={24} />
                            </div>
                            <div>
                              <p className="text-base font-bold text-foreground">{perm.label}</p>
                              <p className="text-sm text-muted-foreground">{perm.desc}</p>
                            </div>
                          </div>
                          <Switch 
                            checked={permissions[perm.id as keyof typeof permissions]} 
                            onCheckedChange={(val) => setPermissions(prev => ({ ...prev, [perm.id]: val }))} 
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right duration-500">
                  <div className="mb-8 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-sm">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground tracking-tight">Resumo da Configuração</h3>
                      <p className="text-sm text-muted-foreground">Confira os detalhes antes de liberar o acesso</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-8 rounded-[32px] bg-muted/20 border border-border/40 space-y-6">
                      <div className="flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-black">
                          {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-2xl font-black text-foreground leading-tight">{student.name}</p>
                          <p className="text-sm font-bold text-primary uppercase tracking-widest">{student.email}</p>
                        </div>
                      </div>

                      <div className="h-px bg-border/40 w-full" />

                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2">Login de Acesso</p>
                          <p className="text-base font-bold text-foreground">{student.email}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2">Senha Temporária</p>
                          <p className="text-base font-bold text-foreground font-mono tracking-tight">{password}</p>
                        </div>
                      </div>

                      <div className="h-px bg-border/40 w-full" />

                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">Módulos Liberados</p>
                        <div className="flex flex-wrap gap-2">
                          {permissionList.map(p => permissions[p.id as keyof typeof permissions] && (
                            <div key={p.id} className={`flex items-center gap-2 px-4 py-2 rounded-full ${p.bg} ${p.color} text-xs font-black uppercase border border-current/10`}>
                              <p.icon size={14} />
                              {p.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-4">
                      <AlertCircle className="text-amber-600 mt-0.5" size={20} />
                      <p className="text-sm text-amber-900 font-medium leading-relaxed">
                        Ao clicar em confirmar, o aluno receberá uma notificação (se configurado) e poderá acessar o portal imediatamente. Lembre-se de fornecer a senha temporária a ele.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PREVIEW (5 columns) */}
            <div className="col-span-12 lg:col-span-5 bg-muted/5 p-10 flex flex-col justify-center items-center relative overflow-hidden">
              {/* Background Decoration */}
              <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />

              <div className="w-full max-w-[360px] animate-in zoom-in duration-500">
                <div className="mb-10 text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60 mb-2">Live Preview</p>
                  <h3 className="text-2xl font-black text-foreground tracking-tight">Experiência do Aluno</h3>
                </div>

                {/* ID Card Styled Preview */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-b from-primary/20 to-emerald-500/20 rounded-[40px] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                  
                  <div className="relative flex flex-col items-center rounded-[38px] border border-border/60 bg-background/80 backdrop-blur-xl px-10 py-12 text-center shadow-2xl">
                    {/* Status Badge */}
                    <div className="absolute top-6 right-6">
                      <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ativo
                      </div>
                    </div>

                    {/* Avatar */}
                    <div className="relative">
                      <div className="flex h-32 w-32 items-center justify-center rounded-[32px] bg-gradient-to-br from-primary to-primary/80 text-5xl font-black text-white shadow-xl shadow-primary/20 transform -rotate-3 transition-transform group-hover:rotate-0 duration-500">
                        {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-background border-4 border-background rounded-full flex items-center justify-center text-emerald-500 shadow-lg">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="mt-8 space-y-1">
                      <h2 className="text-3xl font-black tracking-[-1px] text-foreground leading-tight">
                        {student.name}
                      </h2>
                      <p className="text-sm font-bold uppercase tracking-[0.25em] text-primary/70">
                        Portal MusicPro
                      </p>
                    </div>

                    <div className="mt-10 w-full space-y-4">
                      <div className="w-full rounded-2xl border border-border/40 bg-muted/30 p-5 text-left transition-colors group-hover:bg-muted/50">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">Login de acesso</p>
                        <p className="text-sm font-bold text-foreground truncate">
                          {student.email || "---"}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-muted-foreground/60 italic">
                        <ShieldCheck size={14} />
                        Criptografia de ponta a ponta
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/40 px-10 py-8 bg-background gap-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            {step === 3 ? (
              <CheckCircle2 size={18} className="text-emerald-500" />
            ) : (
              <AlertCircle size={18} className="text-primary/60" />
            )}
            <p className="text-sm font-medium">
              {step === 3 ? "Tudo pronto! Revise as informações acima." : "O aluno deverá alterar a senha no primeiro acesso."}
            </p>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="h-14 px-8 rounded-2xl border-border/60 text-foreground font-bold hover:bg-muted transition-all active:scale-95 w-full sm:w-auto flex items-center gap-2"
              >
                <ChevronLeft size={20} /> Voltar
              </Button>
            )}
            
            {step < 3 ? (
              <Button
                onClick={handleNext}
                className="h-14 px-10 rounded-2xl bg-primary text-primary-foreground font-black shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-95 w-full sm:w-auto flex items-center gap-3"
              >
                Próximo Passo <ChevronRight size={20} />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={enableAccessMutation.isPending || !student?.email}
                className="h-14 px-10 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-600/20 transition-all hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 w-full sm:w-auto flex items-center gap-3"
              >
                {enableAccessMutation.isPending ? <RefreshCw className="animate-spin" size={20} /> : null}
                Finalizar e Liberar <ChevronRight size={20} />
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
