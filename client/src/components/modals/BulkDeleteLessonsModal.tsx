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
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-destructive/10 via-background to-background relative border-b border-border/10">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Trash2 size={120} />
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-destructive">
              <AlertCircle size={20} />
              Excluir Agendamentos
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground/60">
              Escolha quais aulas agendadas (que ainda não aconteceram) você deseja remover do sistema.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">O que você deseja excluir?</Label>
            <Select value={type} onValueChange={(val) => setType(val as "all" | "student")}>
              <SelectTrigger className="w-full bg-muted/5 font-bold h-12 rounded-xl">
                <SelectValue placeholder="Selecione o filtro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-bold">Todos os agendamentos futuros</SelectItem>
                <SelectItem value="student" className="font-bold">Agendamentos de um Aluno Específico</SelectItem>
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

          <div className="pt-4 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-xl text-xs font-bold uppercase tracking-wider"
              disabled={deleteBulkMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteBulkMutation.isPending || (type === "student" && !studentId)}
              className="h-11 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-destructive/20"
            >
              {deleteBulkMutation.isPending ? "Excluindo..." : "Excluir Definitivamente"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
