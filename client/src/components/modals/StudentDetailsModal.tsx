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
            {/* Header / Banner */}
            <div className="px-6 pt-8 pb-6 bg-gradient-to-b from-primary/5 to-transparent border-b border-border/10 relative">
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={onEdit}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-background/50 hover:bg-background/80 text-muted-foreground hover:text-primary transition-all border border-border/20 backdrop-blur-md"
                  title="Editar Aluno"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={onDelete}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-background/50 hover:bg-background/80 text-muted-foreground hover:text-destructive transition-all border border-border/20 backdrop-blur-md"
                  title="Excluir Aluno"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-[1.5rem] bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-lg shadow-primary/20 mb-4 text-white font-black text-2xl">
                   {student.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground">
                  {student.name}
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold text-muted-foreground mt-1 tracking-widest uppercase">
                  {student.instrumentName || "Sem instrumento vinculado"}
                </DialogDescription>
                
                <div className={cn("mt-4 px-3 py-1 rounded-xl border text-[10px] font-black uppercase tracking-widest", statusConfig.color)}>
                  Status: {statusConfig.label}
                </div>
              </div>
            </div>

            {/* Details Content */}
            <div className="p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                 {/* Cadastro */}
                 <div className="bg-muted/30 p-4 rounded-2xl border border-border/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                       <CalendarIcon size={12} />
                       <span className="text-[9px] font-black uppercase tracking-widest">Cadastro</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                       {student.createdAt ? format(new Date(student.createdAt), "dd 'de' MMM, yyyy", { locale: ptBR }) : "—"}
                    </p>
                 </div>
                 
                 {/* Mensalidade Base */}
                 <div className="bg-muted/30 p-4 rounded-2xl border border-border/20 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                       <DollarSign size={12} />
                       <span className="text-[9px] font-black uppercase tracking-widest">Valor Mensal</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">
                       {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(student.monthlyFee))}
                    </p>
                 </div>
              </div>

              {/* Pagamentos */}
              <div className="bg-card p-5 rounded-2xl border border-border/40 space-y-4 shadow-sm">
                 <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                       Próximo Vencimento
                    </h4>
                    {student.nextDueDate ? (
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-500">
                         {format(new Date(student.nextDueDate), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-muted-foreground">
                         Nenhuma cobrança pendente.
                      </p>
                    )}
                 </div>
                 
                 <div className="h-[1px] w-full bg-border/20" />

                 <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                       Último Pagamento
                    </h4>
                    {student.lastPaymentDate ? (
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-500">
                         {format(new Date(student.lastPaymentDate), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                    ) : (
                      <p className="text-sm font-semibold text-muted-foreground">
                         Ainda não há registros de pagamento.
                      </p>
                    )}
                 </div>
              </div>

              {/* Contato (Extra) */}
              <div className="px-2 pt-2 pb-1 space-y-2">
                 <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="text-foreground">{student.email}</span>
                 </div>
                 {student.phone && (
                   <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Telefone:</span>
                      <span className="text-foreground">{student.phone}</span>
                   </div>
                 )}
              </div>
            </div>

            <div className="p-6 pt-0">
               <Button
                 variant="outline"
                 className="w-full h-12 rounded-xl text-xs font-black uppercase tracking-wider"
                 onClick={() => onOpenChange(false)}
               >
                 Fechar
               </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
