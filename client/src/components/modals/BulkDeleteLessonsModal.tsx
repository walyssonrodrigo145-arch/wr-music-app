import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface BulkDeleteLessonsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BulkDeleteLessonsModal({
  open,
  onOpenChange,
}: BulkDeleteLessonsModalProps) {
  const utils = trpc.useUtils();
  const { data: students = [] } = trpc.students.list.useQuery();

  const [type, setType] = useState<"all" | "student">("all");
  const [studentId, setStudentId] = useState<string>("");

  const deleteBulkMutation = trpc.lessons.deleteBulk.useMutation({
    onSuccess: () => {
      utils.lessons.listRange.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Agendamentos excluídos com sucesso!");
      onOpenChange(false);
      
      // Reset state for next time
      setType("all");
      setStudentId("");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir agendamentos: ${error.message}`);
    },
  });

  const handleDelete = () => {
    if (type === "student" && !studentId) {
      toast.error("Por favor, selecione um aluno.");
      return;
    }

    const confirmMsg = type === "all" 
      ? "Tem certeza que deseja apagar TODOS os agendamentos futuros não concluídos?" 
      : "Tem certeza que deseja apagar todos os agendamentos futuros deste aluno?";

    if (!window.confirm(confirmMsg)) return;

    deleteBulkMutation.mutate({
      type,
      studentId: type === "student" ? Number(studentId) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-[1.5rem] border-border/40 p-0 overflow-hidden bg-card shadow-2xl">
        <div className="px-6 pt-10 pb-8 bg-gradient-to-br from-destructive/10 via-background to-background relative border-b border-border/10">
          <div className="absolute top-0 right-0 p-4 opacity-[0.05] pointer-events-none">
            <Trash2 size={140} />
          </div>
          <DialogHeader className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-4 shadow-inner">
              <AlertCircle size={28} />
            </div>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground">
              Limpar Agenda
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground/60 leading-relaxed max-w-[90%]">
              Esta ação removerá permanentemente as aulas agendadas que ainda não ocorreram.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 ml-1">ESCOPO DA EXCLUSÃO</Label>
            <Select value={type} onValueChange={(val) => setType(val as "all" | "student")}>
              <SelectTrigger className="w-full bg-muted/20 border-none font-bold h-14 rounded-2xl focus:ring-2 focus:ring-destructive/20 transition-all">
                <SelectValue placeholder="Selecione o filtro" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/40 shadow-2xl">
                <SelectItem value="all" className="font-bold py-3">Todos os agendamentos futuros</SelectItem>
                <SelectItem value="student" className="font-bold py-3">Apenas de um Aluno Específico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "student" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Selecione o Aluno</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="w-full bg-muted/5 font-bold h-12 rounded-xl">
                  <SelectValue placeholder="Escolha um aluno" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()} className="font-bold">
                      {s.name}
                    </SelectItem>
                  ))}
                  {students.length === 0 && (
                    <div className="p-2 text-xs font-bold text-muted-foreground text-center">Nenhum aluno encontrado</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="pt-6 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-14 flex-1 rounded-2xl text-[10px] font-black uppercase tracking-widest border-border/40 hover:bg-muted/50 transition-all"
              disabled={deleteBulkMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteBulkMutation.isPending || (type === "student" && !studentId)}
              className="h-14 flex-[2] rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-destructive/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              {deleteBulkMutation.isPending ? "Processando..." : "Confirmar Exclusão"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
