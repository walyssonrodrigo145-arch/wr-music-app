import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  X, CheckCircle2,
  Mail, RefreshCw, AlertCircle,
  Copy, ChevronRight, Calendar,
  User, ShieldCheck, Phone
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
      <DialogContent className="max-w-[1100px] w-[95vw] p-0 overflow-hidden bg-background rounded-[32px] border border-border shadow-2xl max-h-[90vh] flex flex-col gap-0 focus:outline-none">
        
        {/* HEADER */}
        <div className="border-b border-border/40 px-8 py-7 relative">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-2">
              <DialogTitle className="text-[38px] font-black tracking-[-1px] text-foreground leading-tight">
                Gerar acesso do aluno
              </DialogTitle>

              <DialogDescription className="text-[16px] text-muted-foreground leading-relaxed max-w-[620px]">
                Configure as credenciais de acesso do aluno ao portal exclusivo da plataforma.
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
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30">
                1
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Dados do aluno</p>
                <p className="text-xs text-muted-foreground">Informações básicas</p>
              </div>
            </div>

            <div className="h-px flex-1 bg-border" />

            {/* STEP 2 */}
            <div className="flex items-center gap-3 opacity-60">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-sm font-bold text-muted-foreground">
                2
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Permissões</p>
                <p className="text-xs text-muted-foreground">Controle de acesso</p>
              </div>
            </div>

            <div className="h-px flex-1 bg-border" />

            {/* STEP 3 */}
            <div className="flex items-center gap-3 opacity-60">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-sm font-bold text-muted-foreground">
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
            <div className="col-span-12 lg:col-span-7 p-8 overflow-y-auto border-r border-border/40 space-y-8">
              
              {/* SEÇÃO: DADOS PESSOAIS */}
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Dados pessoais</h3>
                    <p className="text-sm text-muted-foreground">Informações do aluno</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-foreground">Nome completo</label>
                    <Input value={student.name} readOnly className="h-12 w-full rounded-2xl bg-muted/30 border-border" />
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-foreground">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={student.email || ""} readOnly className="h-12 w-full pl-11 rounded-2xl bg-muted/30 border-border" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={student.phone || ""} readOnly className="h-12 w-full pl-11 rounded-2xl bg-muted/30 border-border" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">Nascimento</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value="--" readOnly className="h-12 w-full pl-11 rounded-2xl bg-muted/30 border-border" />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO: ACESSO */}
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Acesso do aluno</h3>
                    <p className="text-sm text-muted-foreground">Credenciais de login</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">Login (e-mail)</label>
                    <Input value={student.email || ""} readOnly className="h-12 w-full rounded-2xl bg-muted/30 border-border" />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground">Senha temporária</label>
                    <div className="flex items-center gap-3">
                      <Input value={password} readOnly className="h-12 w-full rounded-2xl bg-muted/30 border-border font-mono" />
                      <button 
                        onClick={handleCopyPassword}
                        className="w-12 h-12 flex items-center justify-center border border-border rounded-2xl text-muted-foreground hover:bg-muted transition-colors shrink-0"
                        title="Copiar senha"
                      >
                        <Copy size={18} />
                      </button>
                      <button 
                        onClick={generatePassword}
                        className="text-[14px] font-bold text-primary hover:text-primary/80 transition-colors shrink-0 px-2"
                      >
                        Gerar nova
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PREVIEW (5 columns) */}
            <div className="col-span-12 lg:col-span-5 bg-muted/10 p-8 flex flex-col">
              <div className="sticky top-0 space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Pré-visualização</p>
                  <h3 className="mt-2 text-xl font-bold text-foreground">Como o aluno verá o acesso</h3>
                </div>

                <div className="flex flex-col items-center rounded-[28px] border border-border bg-background px-8 py-10 text-center shadow-sm">
                  {/* Avatar */}
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 text-4xl font-black text-primary shadow-inner">
                    {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>

                  <h2 className="mt-6 text-3xl font-black tracking-[-1px] text-foreground leading-tight">
                    {student.name}
                  </h2>

                  <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                    Portal do aluno
                  </p>

                  <div className="mt-6 flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-700 border border-emerald-500/20">
                    <CheckCircle2 className="h-4 w-4" />
                    Acesso ativo
                  </div>

                  <div className="mt-8 w-full rounded-2xl border border-border bg-muted/30 p-4 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      E-mail de acesso
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground truncate">
                      {student.email || "---"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/40 px-8 py-6 bg-background gap-4">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            O aluno poderá alterar a senha no primeiro acesso.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 px-6 rounded-2xl border-border text-foreground font-semibold hover:bg-muted w-full sm:w-auto"
            >
              Cancelar
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={enableAccessMutation.isPending || !student?.email}
              className="h-12 px-7 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 w-full sm:w-auto flex items-center gap-2"
            >
              {enableAccessMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : null}
              Continuar <ChevronRight size={18} />
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
