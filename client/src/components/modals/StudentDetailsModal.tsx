import { X, Calendar as CalendarIcon, User as UserIcon, DollarSign, Activity, Loader2, Edit3, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface StudentDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number | null;
  onEdit: () => void;
  onDelete: () => void;
}

export function StudentDetailsModal({ open, onOpenChange, studentId, onEdit, onDelete }: StudentDetailsModalProps) {
  const { data: student, isLoading } = trpc.students.getDetails.useQuery(
    { id: studentId as number },
    { enabled: !!studentId && open }
  );

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
      <DialogContent className="sm:max-w-[425px] rounded-[1.5rem] border-border/40 p-0 overflow-hidden bg-card shadow-2xl">
        {isLoading || !student ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm font-bold text-muted-foreground">Carregando detalhes...</p>
          </div>
        ) : (
          <>
            {/* Top Navigation / Actions */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/5">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Perfil do Aluno</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onEdit}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/5 hover:bg-primary hover:text-white text-primary transition-all border border-primary/10 active:scale-95 shadow-sm"
                  title="Editar Aluno"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  onClick={onDelete}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/5 hover:bg-red-500 hover:text-white text-red-500 transition-all border border-red-500/10 active:scale-95 shadow-sm"
                  title="Excluir Aluno"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Profile Section */}
            <div className="px-6 pt-10 pb-8 bg-gradient-to-b from-muted/20 to-transparent relative overflow-hidden">
              {/* Abstract background blur */}
              <div className="absolute -left-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-2xl shadow-primary/20 mb-6 text-white font-black text-3xl border-4 border-background rotate-3 hover:rotate-0 transition-transform duration-300">
                   {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                
                <DialogTitle className="text-2xl lg:text-3xl font-black uppercase tracking-tighter text-foreground leading-tight px-4 mb-2">
                  {student.name}
                </DialogTitle>
                
                <div className="flex items-center gap-2 mb-6">
                  <span className="px-3 py-1 rounded-full bg-muted text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 border border-border/20">
                    {student.instrumentName || "Música"}
                  </span>
                  <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm", statusConfig.color)}>
                    {statusConfig.label}
                  </div>
                </div>
              </div>
            </div>

            {/* Details Content */}
            <div className="p-6 space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                 {/* Cadastro */}
                 <div className="bg-card p-4 rounded-[1.5rem] border border-border/40 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-2 text-muted-foreground/40 mb-2 relative z-10">
                       <CalendarIcon size={12} strokeWidth={2.5} />
                       <span className="text-[9px] font-black uppercase tracking-[0.2em]">Cadastro</span>
                    </div>
                    <p className="text-sm font-black text-foreground relative z-10 tracking-tight">
                       {student.createdAt ? format(new Date(student.createdAt), "dd 'de' MMM, yyyy", { locale: ptBR }) : "—"}
                    </p>
                 </div>
                 
                 {/* Mensalidade Base */}
                 <div className="bg-card p-4 rounded-[1.5rem] border border-border/40 flex flex-col justify-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-center gap-2 text-muted-foreground/40 mb-2 relative z-10">
                       <DollarSign size={12} strokeWidth={2.5} />
                       <span className="text-[9px] font-black uppercase tracking-[0.2em]">Mensal</span>
                    </div>
                    <p className="text-sm font-black text-foreground relative z-10 tracking-tight">
                       {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                    </p>
                 </div>
              </div>

              {/* Pagamentos */}
              <div className="bg-card/50 p-6 rounded-[2rem] border border-border/40 space-y-5 shadow-inner relative overflow-hidden">
                 <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
                 
                 <div className="relative z-10">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-2 flex items-center gap-2">
                       <div className="w-1 h-1 rounded-full bg-amber-500" />
                       Próximo Vencimento
                    </h4>
                    {student.nextDueDate ? (
                      <p className="text-base font-black text-amber-600 dark:text-amber-500 tracking-tight">
                         {format(new Date(student.nextDueDate), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-muted-foreground/30 uppercase italic">
                         Nenhuma pendência.
                      </p>
                    )}
                 </div>
                 
                 <div className="h-[1px] w-full bg-border/20" />

                 <div className="relative z-10">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-2 flex items-center gap-2">
                       <div className="w-1 h-1 rounded-full bg-emerald-500" />
                       Último Pagamento
                    </h4>
                    {student.lastPaymentDate ? (
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-500 tracking-tight">
                         {format(new Date(student.lastPaymentDate), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-muted-foreground/30 uppercase italic">
                         Sem registros.
                      </p>
                    )}
                 </div>
              </div>

              {/* Contato (Extra) */}
              <div className="px-4 py-4 rounded-[1.5rem] bg-muted/20 border border-border/10 space-y-3">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Email</span>
                    <span className="text-xs font-black text-foreground tracking-tight">{student.email}</span>
                 </div>
                 {student.phone && (
                   <>
                    <div className="h-[1px] w-full bg-border/10" />
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">WhatsApp</span>
                       <span className="text-xs font-black text-foreground tracking-tight">{student.phone}</span>
                    </div>
                   </>
                 )}
              </div>
            </div>

            <div className="p-6 pt-0">
               <Button
                 variant="outline"
                 className="w-full h-14 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] border-border/40 hover:bg-muted/50 transition-all active:scale-95 shadow-sm"
                 onClick={() => onOpenChange(false)}
               >
                 Fechar Detalhes
               </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
