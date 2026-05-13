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
      <DialogContent className="sm:max-w-[1150px] w-[95vw] h-[88vh] p-0 overflow-hidden bg-background rounded-[40px] border border-border shadow-2xl flex flex-col gap-0 focus:outline-none">
        
        {/* HEADER */}
        <div className="px-12 pt-12 pb-8 relative">
          <div className="flex items-start justify-between gap-10">
            <div className="space-y-3">
              <DialogTitle className="text-[32px] font-black tracking-tight text-foreground leading-none">
                Gerar acesso do aluno
              </DialogTitle>

              <DialogDescription className="text-[15px] text-muted-foreground/80 leading-relaxed max-w-[580px] font-medium">
                {step === 1 && "Verifique os dados básicos do aluno antes de prosseguir com a criação das credenciais."}
                {step === 2 && "Defina quais áreas o aluno poderá visualizar em seu portal exclusivo da plataforma."}
                {step === 3 && "Confira o resumo das configurações antes de finalizar a liberação do acesso."}
              </DialogDescription>
            </div>

            <button 
              onClick={() => onOpenChange(false)}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:scale-105 active:scale-95"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* STEPPER - Refined & More subtle */}
          <div className="mt-12 flex items-center gap-6">
            {/* STEP 1 */}
            <div className={`flex items-center gap-4 transition-all duration-300 ${step >= 1 ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black shadow-md transition-all ${step === 1 ? 'bg-primary text-primary-foreground scale-110 shadow-primary/20' : 'bg-emerald-500 text-white'}`}>
                {step > 1 ? <CheckCircle2 size={18} /> : "1"}
              </div>
              <div className="hidden sm:block">
                <p className="text-[13px] font-bold text-foreground leading-tight">Dados</p>
                <p className="text-[11px] text-muted-foreground/70 font-medium">Informações básicas</p>
              </div>
            </div>

            <div className={`h-[2px] w-12 rounded-full transition-colors duration-500 ${step > 1 ? 'bg-emerald-500' : 'bg-border/60'}`} />

            {/* STEP 2 */}
            <div className={`flex items-center gap-4 transition-all duration-300 ${step >= 2 ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black shadow-md transition-all ${step === 2 ? 'bg-primary text-primary-foreground scale-110 shadow-primary/20' : step > 2 ? 'bg-emerald-500 text-white' : 'border border-border/80 bg-muted/20 text-muted-foreground'}`}>
                {step > 2 ? <CheckCircle2 size={18} /> : "2"}
              </div>
              <div className="hidden sm:block">
                <p className="text-[13px] font-bold text-foreground leading-tight">Permissões</p>
                <p className="text-[11px] text-muted-foreground/70 font-medium">Nível de acesso</p>
              </div>
            </div>

            <div className={`h-[2px] w-12 rounded-full transition-colors duration-500 ${step > 2 ? 'bg-emerald-500' : 'bg-border/60'}`} />

            {/* STEP 3 */}
            <div className={`flex items-center gap-4 transition-all duration-300 ${step >= 3 ? 'opacity-100' : 'opacity-30'}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black shadow-md transition-all ${step === 3 ? 'bg-primary text-primary-foreground scale-110 shadow-primary/20' : 'border border-border/80 bg-muted/20 text-muted-foreground'}`}>
                3
              </div>
              <div className="hidden sm:block">
                <p className="text-[13px] font-bold text-foreground leading-tight">Resumo</p>
                <p className="text-[11px] text-muted-foreground/70 font-medium">Conclusão</p>
              </div>
            </div>
          </div>
        </div>

        {isDataLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-6 min-h-[400px]">
            <RefreshCw className="animate-spin text-primary" size={40} />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Carregando dados...</p>
          </div>
        ) : error || !student ? (
          <div className="p-20 flex flex-col items-center justify-center gap-6 min-h-[400px]">
            <div className="w-16 h-16 rounded-3xl bg-destructive/5 flex items-center justify-center">
              <AlertCircle className="text-destructive" size={32} />
            </div>
            <p className="text-base font-bold text-muted-foreground">Não foi possível localizar os dados deste aluno.</p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-0 overflow-hidden flex-1 min-h-0 px-12 pb-8">
            {/* FORM (7 columns) */}
            <div className="col-span-12 lg:col-span-7 pr-12 overflow-y-auto space-y-12 scrollbar-none">
              
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12 pb-10">
                  <div>
                    <div className="mb-8 flex items-center gap-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary shadow-sm border border-primary/10">
                        <User className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-[19px] font-black text-foreground tracking-tight leading-none">Dados pessoais</h3>
                        <p className="text-[13px] text-muted-foreground mt-1 font-medium">Informações básicas do cadastro</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Nome completo</label>
                        <Input value={student.name} readOnly className="h-14 w-full rounded-2xl bg-muted/30 border-none text-[15px] font-bold focus:ring-0 px-5" />
                      </div>
                      
                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">E-mail de acesso</label>
                        <div className="relative">
                          <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/40" />
                          <Input value={student.email || ""} readOnly className="h-14 w-full pl-14 rounded-2xl bg-muted/30 border-none text-[15px] font-bold" />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Telefone / WhatsApp</label>
                        <div className="relative">
                          <Phone className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/40" />
                          <Input value={student.phone || ""} readOnly className="h-14 w-full pl-14 rounded-2xl bg-muted/30 border-none text-[15px] font-bold" />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Nascimento</label>
                        <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/40" />
                          <Input 
                            value={student.birthDate ? format(new Date(student.birthDate), "dd/MM/yyyy") : "--"} 
                            readOnly 
                            className="h-14 w-full pl-14 rounded-2xl bg-muted/30 border-none text-[15px] font-bold" 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-8 flex items-center gap-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/5 text-emerald-600 shadow-sm border border-emerald-500/10">
                        <ShieldCheck className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-[19px] font-black text-foreground tracking-tight leading-none">Segurança e Acesso</h3>
                        <p className="text-[13px] text-muted-foreground mt-1 font-medium">Credenciais para o primeiro login</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-1 rounded-2xl bg-primary/5 border border-primary/10">
                        <div className="p-4 flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-primary/60 mb-1">Login (Usuário)</p>
                            <p className="text-[16px] font-black text-primary">{student.email}</p>
                          </div>
                          <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm border border-primary/10">
                            <User size={18} />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="mb-3 block text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground/70">Senha sugerida</label>
                        <div className="flex items-center gap-3">
                          <Input value={password} readOnly className="h-14 w-full rounded-2xl bg-muted/30 border-none font-mono text-[16px] tracking-tight font-bold px-5" />
                          <button 
                            onClick={handleCopyPassword}
                            className="w-14 h-14 flex items-center justify-center bg-background border border-border/60 rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all shrink-0 shadow-sm hover:scale-105 active:scale-95"
                            title="Copiar senha"
                          >
                            <Copy size={20} />
                          </button>
                          <button 
                            onClick={generatePassword}
                            className="text-[11px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-all shrink-0 px-6 h-14 rounded-2xl hover:bg-primary/5"
                          >
                            Recriar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10 pb-10">
                  <div className="mb-10 flex items-center gap-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary shadow-sm border border-primary/10">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-[19px] font-black text-foreground tracking-tight leading-none">Módulos do Portal</h3>
                      <p className="text-[13px] text-muted-foreground mt-1 font-medium">Controle granular do que o aluno pode visualizar</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    {permissionList.map((perm) => {
                      const Icon = perm.icon;
                      const isChecked = permissions[perm.id as keyof typeof permissions];
                      return (
                        <div key={perm.id} className={`flex items-center justify-between p-6 rounded-[28px] border transition-all duration-300 ${isChecked ? 'bg-primary/[0.02] border-primary/20 shadow-sm shadow-primary/5' : 'bg-muted/10 border-border/40 opacity-70'}`}>
                          <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl ${perm.bg} ${perm.color} flex items-center justify-center shadow-sm border border-current/10`}>
                              <Icon size={26} />
                            </div>
                            <div>
                              <p className={`text-[16px] font-black transition-colors ${isChecked ? 'text-foreground' : 'text-muted-foreground'}`}>{perm.label}</p>
                              <p className="text-[13px] text-muted-foreground/80 font-medium leading-tight mt-0.5">{perm.desc}</p>
                            </div>
                          </div>
                          <Switch 
                            checked={isChecked} 
                            onCheckedChange={(val) => setPermissions(prev => ({ ...prev, [perm.id]: val }))} 
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10 pb-10">
                  <div className="mb-10 flex items-center gap-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/5 text-emerald-600 shadow-sm border border-emerald-500/10">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-[19px] font-black text-foreground tracking-tight leading-none">Tudo pronto!</h3>
                      <p className="text-[13px] text-muted-foreground mt-1 font-medium">Confira o resumo das configurações finais</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="p-10 rounded-[40px] bg-muted/20 border border-border/40 space-y-10">
                      <div className="flex items-center gap-8">
                        <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-primary to-primary/80 text-white flex items-center justify-center text-3xl font-black shadow-xl shadow-primary/20">
                          {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-[26px] font-black text-foreground leading-none tracking-tight">{student.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500" />
                             <p className="text-[12px] font-black text-primary uppercase tracking-widest">{student.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-10">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-3">Usuário de Login</p>
                          <p className="text-[16px] font-bold text-foreground">{student.email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-3">Senha de Acesso</p>
                          <p className="text-[16px] font-bold text-foreground font-mono tracking-tight">{password}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60">Acessos Habilitados</p>
                        <div className="flex flex-wrap gap-3">
                          {permissionList.map(p => permissions[p.id as keyof typeof permissions] && (
                            <div key={p.id} className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl ${p.bg} ${p.color} text-[11px] font-black uppercase border border-current/10 shadow-sm`}>
                              <p.icon size={16} />
                              {p.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                         <AlertCircle size={22} />
                      </div>
                      <p className="text-[13px] text-amber-900/80 font-semibold leading-relaxed">
                        Ao finalizar, o portal será liberado imediatamente. Recomendamos que você envie a senha temporária ao aluno para seu primeiro acesso.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* PREVIEW (5 columns) */}
            <div className="col-span-12 lg:col-span-5 bg-muted/10 rounded-[48px] p-10 flex flex-col justify-center items-center relative overflow-hidden">
              {/* Background Decoration */}
              <div className="absolute top-[-20%] right-[-20%] w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
              <div className="absolute bottom-[-20%] left-[-20%] w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px]" />

              <div className="w-full max-w-[340px] animate-in zoom-in duration-700 relative z-10 scale-90 sm:scale-100">
                <div className="mb-12 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4 border border-primary/10">
                     <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                     Live Preview
                  </div>
                  <h3 className="text-[22px] font-black text-foreground tracking-tight">Portal do Aluno</h3>
                </div>

                {/* ID Card Styled Preview */}
                <div className="relative group perspective-1000">
                  <div className="absolute -inset-1.5 bg-gradient-to-b from-primary/30 via-primary/5 to-emerald-500/30 rounded-[50px] blur-xl opacity-30 group-hover:opacity-50 transition duration-1000"></div>
                  
                  <div className="relative flex flex-col items-center rounded-[48px] border border-white/40 bg-white/60 dark:bg-card/40 backdrop-blur-2xl px-10 py-12 text-center shadow-2xl transition-transform duration-500 group-hover:translate-y-[-10px]">
                    {/* Status Badge */}
                    <div className="absolute top-8 right-8">
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 border border-emerald-500/10">
                        Ativo
                      </div>
                    </div>

                    {/* Avatar */}
                    <div className="relative">
                      <div className="flex h-32 w-32 items-center justify-center rounded-[36px] bg-gradient-to-br from-primary to-primary/80 text-5xl font-black text-white shadow-2xl shadow-primary/40 transform -rotate-3 transition-transform group-hover:rotate-0 duration-700">
                        {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-white dark:bg-card border-8 border-white dark:border-card rounded-[20px] flex items-center justify-center text-emerald-500 shadow-xl">
                        <CheckCircle2 size={24} />
                      </div>
                    </div>

                    <div className="mt-10 space-y-2">
                      <h2 className="text-[28px] font-black tracking-tighter text-foreground leading-none">
                        {student.name}
                      </h2>
                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/60">
                        Membro MusicPro
                      </p>
                    </div>

                    <div className="mt-12 w-full space-y-5">
                      <div className="w-full rounded-3xl border border-white/50 bg-white/40 dark:bg-card/30 p-6 text-left transition-all group-hover:bg-white/80 dark:group-hover:bg-card/60 shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">Identidade Digital</p>
                        <p className="text-[14px] font-black text-foreground truncate">
                          {student.email || "---"}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-center gap-2.5 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                        <ShieldCheck size={16} />
                        Segurança Verificada
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/40 px-12 py-10 bg-background/50 backdrop-blur-sm gap-8 rounded-b-[40px]">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors ${step === 3 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/5 text-primary/60'}`}>
               {step === 3 ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            </div>
            <div>
              <p className="text-[13px] font-bold text-foreground">
                {step === 3 ? "Tudo pronto para liberar!" : "Revisão de credenciais"}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                {step === 3 ? "O acesso será liberado instantaneamente." : "O aluno deverá alterar a senha no primeiro login."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            {step > 1 ? (
              <Button
                variant="outline"
                onClick={handleBack}
                className="h-16 px-10 rounded-[22px] border-border/60 text-foreground font-black text-[15px] hover:bg-muted transition-all active:scale-95 w-full sm:w-auto flex items-center gap-3"
              >
                <ChevronLeft size={22} strokeWidth={2.5} /> Voltar
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-16 px-10 rounded-[22px] border-border/60 text-foreground font-black text-[15px] hover:bg-muted transition-all active:scale-95 w-full sm:w-auto"
              >
                Cancelar
              </Button>
            )}
            
            {step < 3 ? (
              <Button
                onClick={handleNext}
                className="h-16 px-12 rounded-[22px] bg-primary text-primary-foreground font-black text-[15px] shadow-2xl shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.03] active:scale-95 w-full sm:w-auto flex items-center gap-3"
              >
                Próximo Passo <ChevronRight size={22} strokeWidth={2.5} />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={enableAccessMutation.isPending || !student?.email}
                className="h-16 px-12 rounded-[22px] bg-emerald-600 text-white font-black text-[15px] shadow-2xl shadow-emerald-600/20 transition-all hover:bg-emerald-700 hover:scale-[1.03] active:scale-95 w-full sm:w-auto flex items-center gap-3"
              >
                {enableAccessMutation.isPending ? <RefreshCw className="animate-spin" size={22} /> : null}
                Liberar Acesso <ChevronRight size={22} strokeWidth={2.5} />
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
