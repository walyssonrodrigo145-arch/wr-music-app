import { X, Calendar as CalendarIcon, User as UserIcon, DollarSign, Activity, Loader2, Edit3, Trash2, CheckCircle2, Clock, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { StudentContractsSection } from "./StudentContractsSection";

interface StudentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number | null;
  onEdit: () => void;
  onDelete: () => void;
}

export function StudentDetailsModal({ open, onOpenChange, studentId, onEdit, onDelete }: StudentDetailsModalProps) {
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);
  const utils = trpc.useUtils();
  
  const { data: student, isLoading } = trpc.students.getDetails.useQuery(
    { id: studentId as number },
    { enabled: !!studentId && open }
  );

  const enableAccessMutation = trpc.students.enablePortalAccess.useMutation({
    onSuccess: (data) => {
      setCredentials(data);
      utils.students.getDetails.invalidate({ id: studentId as number });
      utils.students.list.invalidate();
      toast.success("Acesso liberado com sucesso!");
    },
    onError: (e) => toast.error("Erro ao liberar acesso: " + e.message),
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "ativo": return { label: "Ativo", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" };
      case "pausado": return { label: "Pausado", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" };
      case "inativo": return { label: "Inativo", color: "text-rose-600 bg-rose-500/10 border-rose-500/20" };
      default: return { label: status, color: "text-muted-foreground bg-muted" };
    }
  };

  const statusConfig = student ? getStatusConfig(student.status) : { label: "...", color: "" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[90vh] flex flex-col rounded-[2.5rem] border-border/40 p-0 overflow-hidden bg-card shadow-2xl">
        {isLoading && !student ? (
          <div className="flex flex-col items-center justify-center p-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Sincronizando dados...</p>
          </div>
        ) : !student ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Aluno não encontrado</p>
            <p className="text-[10px] text-muted-foreground/60 mt-2">Não foi possível carregar os dados ou você não tem permissão.</p>
          </div>
        ) : (
          <>
            {/* Profile Header */}
            <div className="px-8 pt-10 pb-8 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent flex flex-col items-center text-center relative border-b border-border/10 flex-shrink-0">
              {/* Profile Avatar with status indicator */}
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary via-indigo-600 to-violet-600 flex items-center justify-center shadow-2xl shadow-primary/30 text-white font-black text-3xl border-4 border-background transition-all hover:scale-105 hover:rotate-2 duration-500">
                   {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-4 border-background shadow-lg flex items-center justify-center",
                  student.status === 'ativo' ? 'bg-emerald-500' : student.status === 'pausado' ? 'bg-amber-500' : 'bg-rose-500'
                )}>
                  {student.status === 'ativo' ? <CheckCircle2 size={12} className="text-white" /> : <Activity size={12} className="text-white" />}
                </div>
              </div>
              
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-foreground leading-tight px-4 flex flex-col items-center gap-1.5">
                {student.name}
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                   <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.25em]">
                     {student.instrumentName || "Estudante"}
                   </span>
                   <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                </div>
              </DialogTitle>
              
              {/* Action row - Premium Glassmorphism */}
              <div className="flex items-center gap-3 mt-8">
                <div className={cn("px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-[0.2em] shadow-sm backdrop-blur-md transition-all hover:scale-105", statusConfig.color)}>
                  {statusConfig.label}
                </div>
                
                <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-2xl border border-border/20 shadow-inner">
                  <button
                    onClick={onEdit}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-background hover:bg-primary hover:text-white text-muted-foreground transition-all shadow-sm active:scale-90 border border-border/40 group"
                    title="Editar Aluno"
                  >
                    <Edit3 size={15} className="group-hover:rotate-12 transition-transform" />
                  </button>
                  <button
                    onClick={onDelete}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-background hover:bg-destructive hover:text-white text-muted-foreground transition-all shadow-sm active:scale-90 border border-border/40 group"
                    title="Excluir Aluno"
                  >
                    <Trash2 size={15} className="group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* Details Content - Scrollable */}
            <div className="overflow-y-auto flex-1 p-8 pt-6 space-y-6">
              
              {/* Info Grid - Matrícula, Mensalidade e Sala */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-muted/30 p-4 rounded-3xl border border-border/30 flex flex-col justify-center relative overflow-hidden group hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-2 text-muted-foreground/50 mb-2">
                       <CalendarIcon size={13} strokeWidth={2.5} />
                       <span className="text-[9px] font-black uppercase tracking-[0.2em]">Início</span>
                    </div>
                    <p className="text-sm font-black text-foreground tracking-tight">
                       {student.createdAt ? format(new Date(student.createdAt), "dd MMM, yyyy", { locale: ptBR }) : "—"}
                    </p>
                 </div>
                 
                 <div className="bg-muted/30 p-4 rounded-3xl border border-border/30 flex flex-col justify-center relative overflow-hidden group hover:border-emerald-500/20 transition-colors">
                    <div className="flex items-center gap-2 text-muted-foreground/50 mb-2">
                       <DollarSign size={13} strokeWidth={2.5} />
                       <span className="text-[9px] font-black uppercase tracking-[0.2em]">Valor</span>
                    </div>
                    <p className="text-sm font-black text-foreground tracking-tight">
                       {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                    </p>
                 </div>

                 {student.studioRoomName && (
                   <div className="col-span-2 bg-blue-500/5 p-4 rounded-3xl border border-blue-500/20 flex items-center justify-between relative overflow-hidden">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold">
                            🏫
                         </div>
                         <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-500">Sala de Aula Padrão</span>
                            <p className="text-sm font-black text-foreground">{student.studioRoomName}</p>
                         </div>
                      </div>
                   </div>
                 )}
              </div>

              {/* Financeiro - Distinct Section */}
              <div className="bg-card p-6 rounded-[2rem] border border-border/40 space-y-5 shadow-sm relative overflow-hidden">
                 <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16" />
                 
                 <div className="grid grid-cols-1 gap-5">
                    <div className="flex items-center justify-between group">
                       <div className="space-y-1">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                             Vencimento
                          </h4>
                          <p className="text-base font-black text-foreground group-hover:text-amber-600 transition-colors">
                             {student.nextDueDate ? format(new Date(student.nextDueDate), "dd 'de' MMMM", { locale: ptBR }) : "Sem pendências"}
                          </p>
                       </div>
                       <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                          <Clock size={18} />
                       </div>
                    </div>

                    <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-border/20 to-transparent" />

                    <div className="flex items-center justify-between group">
                       <div className="space-y-1">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                             Último Pago
                          </h4>
                          <p className="text-base font-black text-foreground group-hover:text-emerald-600 transition-colors">
                             {student.lastPaymentDate ? format(new Date(student.lastPaymentDate), "dd 'de' MMMM", { locale: ptBR }) : "Sem registros"}
                          </p>
                       </div>
                       <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                          <CheckCircle2 size={18} />
                       </div>
                    </div>
                 </div>
              </div>

               {/* Contratos Digitais */}
               <StudentContractsSection studentId={student.id} student={student} />

               {/* Contact Pills */}
              <div className="flex flex-col gap-3">
                 <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-2xl border border-border/10 hover:bg-muted/30 transition-colors group">
                    <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center text-muted-foreground/60 shadow-sm">
                       <UserIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest leading-none mb-1">E-mail</p>
                       <p className="text-xs font-black text-foreground truncate">{student.email}</p>
                    </div>
                 </div>
                 
                 {student.phone && (
                    <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-2xl border border-border/10 hover:bg-muted/30 transition-colors group">
                       <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center text-muted-foreground/60 shadow-sm">
                          <Activity size={14} />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest leading-none mb-1">WhatsApp</p>
                          <p className="text-xs font-black text-foreground truncate">{student.phone}</p>
                       </div>
                    </div>
                 )}

                 <div className="flex items-center gap-3 bg-muted/20 p-3 rounded-2xl border border-border/10 hover:bg-muted/30 transition-colors group">
                    <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center text-muted-foreground/60 shadow-sm">
                       <Users size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest leading-none mb-1">Modalidade</p>
                       <p className="text-xs font-black text-foreground truncate capitalize">Aula {student.lessonType || "Individual"}</p>
                    </div>
                 </div>
              </div>
            </div>

            {/* Bottom Actions - Fixed footer, outside scroll */}
            <div className="p-8 pt-4 space-y-3 border-t border-border/10 flex-shrink-0 bg-card">
               <Button
                 className={cn(
                   "w-full h-14 rounded-3xl text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl transition-all active:scale-95 border-none relative overflow-hidden group",
                   student.hasPortalAccess 
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-500/20" 
                    : "bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white shadow-indigo-500/30"
                 )}
                 onClick={() => {
                   enableAccessMutation.mutate({ studentId: student.id });
                 }}
                 disabled={enableAccessMutation.isPending}
               >
                 {enableAccessMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin mr-3" />
                 ) : (
                    <Activity size={16} className="mr-3 group-hover:scale-110 transition-transform" />
                 )}
                 {student.hasPortalAccess ? "Gerar Novo Acesso" : "Liberar Acesso Portal"}
               </Button>

               <Button
                 variant="ghost"
                 className="w-full h-12 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                 onClick={() => onOpenChange(false)}
               >
                 Fechar Detalhes
               </Button>
            </div>
          </>
        )}

        {/* Credentials Modal - Moved outside the loading/student check to stay visible during refetch */}
        {credentials && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-card border border-border shadow-2xl rounded-[2rem] p-8 max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black">Acesso Liberado!</h3>
                <p className="text-xs text-muted-foreground font-medium mt-2">Compartilhe as credenciais com o aluno:</p>
              </div>
              
              <div className="bg-muted/30 p-6 rounded-2xl border border-border/40 space-y-4">
                <div className="text-left">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">E-mail de Acesso</p>
                  <p className="text-sm font-black text-foreground break-all">{credentials.email}</p>
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Senha Temporária</p>
                  <p className="text-lg font-black text-primary tracking-widest">{credentials.password}</p>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground font-medium italic">O aluno poderá alterar a senha após o primeiro acesso.</p>

              <Button 
                className="w-full h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest"
                onClick={() => setCredentials(null)}
              >
                Entendido
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

