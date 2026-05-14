import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { 
  Clock, 
  Calendar, 
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function StudentRequestReschedule() {
  const [, setLocation] = useLocation();
  const { data: lessons, isLoading } = trpc.studentPortal.getLessons.useQuery();
  const [formData, setFormData] = useState({
    lessonId: "",
    reason: "",
    preferredDates: ""
  });

  const mutation = trpc.studentPortal.requestReschedule.useMutation({
    onSuccess: () => {
      toast.success("Solicitação de remarcação enviada! O professor analisará os novos horários.");
      setLocation("/aluno");
    },
    onError: (err) => {
      toast.error("Erro ao enviar solicitação: " + err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lessonId || !formData.reason || !formData.preferredDates) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    mutation.mutate({
      lessonId: parseInt(formData.lessonId),
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
          <h1 className="text-2xl font-black tracking-tight text-foreground">Solicitar Remarcação</h1>
          <p className="text-sm text-muted-foreground font-medium">Altere o horário de uma aula já agendada.</p>
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
                <Clock size={20} />
              </div>
              <CardTitle className="text-lg font-black">Nova Solicitação</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Selecione a Aula</label>
                <div className="relative">
                   <Calendar className="absolute left-4 top-3.5 text-muted-foreground" size={16} />
                   <select 
                     className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                     value={formData.lessonId}
                     onChange={e => setFormData({...formData, lessonId: e.target.value})}
                   >
                     <option value="">Selecione uma aula agendada...</option>
                     {lessons?.filter(l => new Date(l.scheduledAt) >= new Date() && l.status === 'agendada').map(l => (
                       <option key={l.id} value={l.id}>
                         {l.title} - {new Date(l.scheduledAt).toLocaleDateString()} às {new Date(l.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </option>
                     ))}
                   </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Motivo da Alteração</label>
                <div className="relative">
                   <AlertCircle className="absolute left-4 top-3.5 text-muted-foreground" size={16} />
                   <input 
                     type="text" 
                     placeholder="Ex: Compromisso profissional inesperado" 
                     className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                     value={formData.reason}
                     onChange={e => setFormData({...formData, reason: e.target.value})}
                   />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Novas Sugestões de Horário</label>
                <div className="relative">
                   <ArrowRight className="absolute left-4 top-3.5 text-muted-foreground" size={16} />
                   <textarea 
                     placeholder="Ex: Gostaria de mudar para terça às 14h ou quarta às 09h" 
                     className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[100px] resize-none"
                     value={formData.preferredDates}
                     onChange={e => setFormData({...formData, preferredDates: e.target.value})}
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
                      Solicitar Alteração
                    </>
                  )}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <div className="p-6 bg-blue-50 dark:bg-blue-500/5 rounded-2xl border border-blue-100 dark:border-blue-500/10 flex items-start gap-4">
         <AlertCircle className="text-blue-500 flex-shrink-0 mt-1" size={20} />
         <div className="space-y-1">
            <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Sobre a Remarcação</p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/60 leading-relaxed font-medium">
              Ao solicitar uma remarcação, sua aula original permanece agendada até que o professor confirme a disponibilidade do novo horário sugerido. 
              Você receberá uma notificação assim que a alteração for processada.
            </p>
         </div>
      </div>
    </div>
  );
}
