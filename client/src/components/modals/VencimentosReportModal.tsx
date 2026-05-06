import { trpc } from "@/lib/trpc";
import {
  DollarSign, X, Loader2, Calendar, TrendingUp, BarChart3, PieChart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface VencimentosReportModalProps {
  open: boolean;
  onClose: () => void;
  month: number;
  year: number;
}

export function VencimentosReportModal({ open, onClose, month, year }: VencimentosReportModalProps) {
  const { data: stats, isLoading } = trpc.paymentDues.getRevenueByDueDay.useQuery({ month, year }, { enabled: open });

  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(year, month - 1));
  const standardDays = [5, 10, 15, 20];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-md" 
            onClick={onClose} 
          />

          {/* Modal Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-card rounded-[2.5rem] border border-border/40 shadow-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-primary/5"
          >
            
            {/* Header */}
            <div className="p-7 pb-4 bg-gradient-to-b from-primary/10 to-transparent relative border-b border-border/10">
              <button 
                onClick={onClose} 
                className="absolute right-7 top-7 w-9 h-9 rounded-2xl hover:bg-muted flex items-center justify-center text-muted-foreground transition-all active:scale-90"
              >
                <X size={18} />
              </button>
              
              <div className="flex items-center gap-4 mb-2">
                <motion.div 
                  initial={{ rotate: -20, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-12 h-12 rounded-2xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center text-primary-foreground"
                >
                  <TrendingUp size={24} strokeWidth={2.5} />
                </motion.div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tighter text-foreground leading-tight">
                    Receita Prevista
                  </h3>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase italic tracking-[0.1em]">
                    {monthName} {year}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-7 space-y-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="relative">
                    <Loader2 className="animate-spin text-primary opacity-20" size={40} strokeWidth={3} />
                    <Loader2 className="animate-spin text-primary absolute inset-0 mask-half" size={40} strokeWidth={3} />
                  </div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] animate-pulse">Analizando dados...</p>
                </div>
              ) : stats ? (
                <>
                  {/* Resumo Total */}
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="p-5 rounded-3xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground relative overflow-hidden group"
                  >
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Total para o Mês</p>
                    <p className="text-3xl font-black italic tracking-tighter">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.total)}
                    </p>
                  </motion.div>

                  {/* Grid de Dias Padrão */}
                  <div className="grid grid-cols-2 gap-4">
                    {standardDays.map((day, idx) => (
                      <motion.div 
                        key={day} 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.4 + (idx * 0.1) }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className="p-4 rounded-3xl border border-border/40 bg-muted/30 flex flex-col gap-2 relative group overflow-hidden"
                      >
                        <div className="absolute -right-2 -top-2 w-12 h-12 bg-primary/5 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="flex items-center justify-between relative z-10">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Dia {day.toString().padStart(2, '0')}</span>
                          <div className="w-6 h-6 rounded-lg bg-background/50 flex items-center justify-center">
                            <Calendar size={12} className="text-primary/60" />
                          </div>
                        </div>
                        <p className="text-base font-black text-foreground tracking-tight relative z-10">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats[day as 5|10|15|20] || 0)}
                        </p>
                        
                        {/* Indicador visual de progresso relativo (opcional) */}
                        <div className="h-1 w-full bg-border/20 rounded-full mt-1 overflow-hidden relative z-10">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${(stats[day as 5|10|15|20] / stats.total) * 100}%` }}
                             className="h-full bg-primary/40 rounded-full"
                           />
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Outros Vencimentos */}
                  {stats.others > 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                      className="p-4 rounded-2xl border-2 border-dashed border-border/40 bg-muted/10 flex items-center justify-between"
                    >
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground/40">
                           <Info size={14} />
                         </div>
                         <span className="text-[10px] font-black text-muted-foreground uppercase italic tracking-wider leading-tight">Outros dias de contrato</span>
                       </div>
                       <p className="text-[11px] font-black text-muted-foreground">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.others)}
                       </p>
                    </motion.div>
                  )}
                </>
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm font-medium text-muted-foreground">Não foi possível carregar os dados.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-7 pt-0 mt-auto bg-gradient-to-t from-background to-transparent relative z-10">
              <Button 
                variant="outline" 
                className="w-full h-12 rounded-[1.25rem] text-[11px] font-black uppercase tracking-[0.2em] border-border/60 hover:bg-muted/80 transition-all active:scale-95 shadow-sm" 
                onClick={onClose}
              >
                Voltar
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Info({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
