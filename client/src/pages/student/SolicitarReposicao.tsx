import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { 
  PlusCircle, 
  Calendar, 
  Clock, 
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function StudentRequestMakeUp() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    reason: "",
    preferredDates: "",
    notes: ""
  });

  const mutation = trpc.studentPortal.requestReschedule.useMutation({
    onSuccess: () => {
      toast.success("Solicitação enviada com sucesso! O professor entrará em contato.");
      setLocation("/aluno");
    },
    onError: (err) => {
      toast.error("Erro ao enviar solicitação: " + err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reason || !formData.preferredDates) {
      toast.error("Por favor, preencha o motivo e as datas preferidas.");
      return;
    }
    mutation.mutate({
      lessonId: 0, // General request not tied to a specific lesson
      reason: formData.reason,
      preferredDates: formData.preferredDates
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-10">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setLocation("/aluno")}
          className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted transition-all shadow-sm"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Solicitar Reposição</h1>
          <p className="text-sm text-muted-foreground font-medium">Use este formulário para solicitar uma aula de reposição.</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                <PlusCircle size={20} />
              </div>
              <CardTitle className="text-lg font-black">Nova Solicitação</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Motivo da Reposição</label>
                <div className="relative">
                   <AlertCircle className="absolute left-4 top-3.5 text-muted-foreground" size={16} />
                   <input 
                     type="text" 
                     placeholder="Ex: Falta justificada no dia 10/05" 
                     className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                     value={formData.reason}
                     onChange={e => setFormData({...formData, reason: e.target.value})}
                   />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Datas/Horários Preferidos</label>
                <div className="relative">
                   <Calendar className="absolute left-4 top-3.5 text-muted-foreground" size={16} />
                   <textarea 
                     placeholder="Ex: Próxima segunda às 15h ou terça às 10h" 
                     className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[100px] resize-none"
                     value={formData.preferredDates}
                     onChange={e => setFormData({...formData, preferredDates: e.target.value})}
                   />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Observações Adicionais (Opcional)</label>
                <div className="relative">
                   <FileText className="absolute left-4 top-3.5 text-muted-foreground" size={16} />
                   <textarea 
                     placeholder="Qualquer outra informação relevante..." 
                     className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[80px] resize-none"
                     value={formData.notes}
                     onChange={e => setFormData({...formData, notes: e.target.value})}
                   />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {mutation.isPending ? "Enviando..." : (
                    <>
                      <CheckCircle2 size={16} />
                      Enviar Solicitação
                    </>
                  )}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <div className="p-6 bg-orange-50 dark:bg-orange-500/5 rounded-2xl border border-orange-100 dark:border-orange-500/10 flex items-start gap-4">
         <AlertCircle className="text-orange-500 flex-shrink-0 mt-1" size={20} />
         <div className="space-y-1">
            <p className="text-sm font-bold text-orange-700 dark:text-orange-400">Atenção às regras de reposição</p>
            <p className="text-xs text-orange-600/80 dark:text-orange-400/60 leading-relaxed font-medium">
              As solicitações de reposição devem ser feitas com no mínimo 24h de antecedência à aula original. 
              Consulte o contrato da escola para mais detalhes sobre prazos e limites de reposição mensal.
            </p>
         </div>
      </div>
    </div>
  );
}
