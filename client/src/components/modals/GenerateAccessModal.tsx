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

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
    const namePart = student?.name ? student.name.split(" ")[0] : "Music";
    let pass = namePart.charAt(0).toUpperCase() + namePart.slice(1) + "@2025!" + student?.name.split(" ").pop();
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
      <DialogContent className="max-w-[850px] w-[95vw] p-0 overflow-hidden bg-white dark:bg-slate-950 rounded-[2rem] border-none shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-10 pb-6 relative">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-[#1e293b]">Gerar acesso do aluno</h2>
            <p className="text-sm text-slate-400 font-medium tracking-tight">Crie o acesso de login para o aluno acessar sua área</p>
          </div>
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Stepper */}
        <div className="px-10 pb-8">
          <div className="flex items-center justify-between max-w-[600px] mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#2563eb] text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-blue-500/20">1</div>
              <span className="text-xs font-bold text-[#2563eb]">Dados do aluno</span>
            </div>
            <div className="flex-1 h-[1px] bg-slate-100 mx-4" />
            <div className="flex items-center gap-3 opacity-40">
              <div className="w-8 h-8 rounded-full border border-slate-300 text-slate-500 flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-xs font-bold text-slate-500">Acesso e permissões</span>
            </div>
            <div className="flex-1 h-[1px] bg-slate-100 mx-4" />
            <div className="flex items-center gap-3 opacity-40">
              <div className="w-8 h-8 rounded-full border border-slate-300 text-slate-500 flex items-center justify-center text-xs font-bold">3</div>
              <span className="text-xs font-bold text-slate-500">Resumo</span>
            </div>
          </div>
        </div>

        {isDataLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 min-h-[400px]">
            <RefreshCw className="animate-spin text-primary" size={32} />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Carregando...</p>
          </div>
        ) : error || !student ? (
          <div className="p-12 flex flex-col items-center justify-center gap-6 min-h-[400px]">
            <AlertCircle className="text-rose-500" size={40} />
            <p className="text-sm font-bold text-muted-foreground">Erro ao carregar dados do aluno.</p>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden min-h-0 border-t border-slate-50">
            
            {/* Coluna Esquerda - Formulário */}
            <div className="w-[55%] p-10 pt-8 overflow-y-auto no-scrollbar space-y-10">
              
              {/* DADOS PESSOAIS */}
              <div className="space-y-6">
                <h3 className="text-[11px] font-black text-[#2563eb] uppercase tracking-[0.15em]">Dados Pessoais</h3>
                
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700">Nome completo <span className="text-rose-500">*</span></label>
                    <Input value={student.name} readOnly className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm font-medium focus:ring-0 focus:border-slate-300" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700">E-mail <span className="text-rose-500">*</span></label>
                    <Input value={student.email || ""} readOnly className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm font-medium focus:ring-0 focus:border-slate-300" />
                    <p className="text-[10px] text-slate-400 font-medium">Será o usuário para login do aluno</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-700">Telefone (WhatsApp)</label>
                      <Input value={student.phone || ""} readOnly className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-700">Data de nascimento</label>
                      <div className="relative">
                        <Input value={student.birthDate ? format(new Date(student.birthDate), "dd/MM/yyyy") : ""} readOnly className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm font-medium" />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-700">Nome do responsável</label>
                      <Input value={student.guardianName || ""} readOnly className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm font-medium" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-slate-700">Telefone do responsável</label>
                      <Input value={student.guardianPhone || ""} readOnly className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm font-medium" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ACESSO DO ALUNO */}
              <div className="space-y-6">
                <h3 className="text-[11px] font-black text-[#2563eb] uppercase tracking-[0.15em]">Acesso do Aluno</h3>
                
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700">Login (e-mail)</label>
                    <Input value={student.email || ""} readOnly className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm font-medium" />
                    <p className="text-[10px] text-slate-400 font-medium">Será utilizado para login no portal do aluno</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700">Senha temporária</label>
                    <div className="flex gap-2">
                      <Input value={password} readOnly className="h-11 rounded-xl bg-slate-50/50 border-slate-200 text-sm font-medium" />
                      <button onClick={handleCopyPassword} className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-all shrink-0">
                        <Copy size={18} />
                      </button>
                      <button onClick={generatePassword} className="h-11 px-4 text-[#2563eb] text-xs font-bold hover:underline shrink-0">
                        Gerar nova
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">O aluno deverá alterar a senha no primeiro acesso</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna Direita - Pré-visualização */}
            <div className="w-[45%] bg-[#f8fafc] p-10 pt-8 flex flex-col items-center">
              <h3 className="text-[11px] font-bold text-[#2563eb] uppercase tracking-[0.15em] mb-10">Pré-visualização do acesso</h3>
              
              <div className="w-full bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 p-10 flex flex-col items-center text-center shadow-xl shadow-slate-200/50">
                <div className="w-24 h-24 rounded-full bg-[#dbeafe] flex items-center justify-center text-3xl font-bold text-[#2563eb] mb-6 shadow-inner">
                  {student.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                
                <h4 className="text-2xl font-bold text-[#1e293b] mb-1">{student.name}</h4>
                <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-[0.25em] mb-10">Portal do Aluno</p>
                
                <div className="px-5 py-2 rounded-full bg-[#ecfdf5] text-[#059669] text-[10px] font-bold uppercase tracking-widest border border-[#d1fae5] mb-12 flex items-center gap-2">
                  Acesso Ativo <CheckCircle2 size={14} />
                </div>
                
                <div className="w-full space-y-4 text-left border-t border-slate-50 pt-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                      <Mail size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">E-mail de acesso</p>
                      <p className="text-[13px] font-bold text-[#1e293b] truncate">{student.email || "---"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="p-8 border-t border-slate-50 flex items-center justify-center gap-4 bg-white">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)} 
            className="h-12 px-12 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50"
          >
            Cancelar
          </Button>
          <Button 
            className="h-12 px-12 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            onClick={handleSubmit}
            disabled={enableAccessMutation.isPending || !student?.email}
          >
            {enableAccessMutation.isPending ? <RefreshCw className="animate-spin" size={18} /> : "Continuar →"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
