import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Calendar } from "lucide-react";

interface RescheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: number;
  lessonTitle: string;
}

export function RescheduleModal({ open, onOpenChange, lessonId, lessonTitle }: RescheduleModalProps) {
  const [reason, setReason] = useState("");
  const [dates, setDates] = useState("");

  const requestMutation = trpc.studentPortal.requestReschedule.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao enviar solicitação");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !dates) {
       toast.error("Por favor, preencha todos os campos.");
       return;
    }
    requestMutation.mutate({
      lessonId,
      reason,
      preferredDates: dates
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none shadow-2xl bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
             <Calendar size={24} />
          </div>
          <DialogTitle className="text-2xl font-black">Solicitar Remarcação</DialogTitle>
          <DialogDescription className="font-medium">
            Aula: <span className="text-foreground font-black">{lessonTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Motivo da Solicitação</Label>
            <Textarea 
              placeholder="Ex: Motivos de saúde, viagem..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-xl border-border bg-background/50 min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sugestão de Datas/Horários</Label>
            <Input 
              placeholder="Ex: Próxima terça às 14h ou 15h"
              value={dates}
              onChange={(e) => setDates(e.target.value)}
              className="rounded-xl border-border bg-background/50"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="submit" 
              disabled={requestMutation.isPending}
              className="w-full bg-primary text-primary-foreground font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl shadow-primary/20"
            >
              {requestMutation.isPending ? <Loader2 className="animate-spin" /> : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
