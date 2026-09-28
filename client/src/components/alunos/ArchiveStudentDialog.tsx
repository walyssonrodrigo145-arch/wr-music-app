import { useEffect, useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STUDENT_EXIT_REASONS } from "@shared/studentExitReasons";

export interface ArchiveStudentPayload {
  exitReason: string;
  exitNotes: string;
  removePending: boolean;
}

export function ArchiveStudentDialog({
  open,
  studentName,
  onConfirm,
  onCancel,
  isPending,
}: {
  open: boolean;
  studentName: string;
  onConfirm: (payload: ArchiveStudentPayload) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [exitReason, setExitReason] = useState<string>("financeiro");
  const [exitNotes, setExitNotes] = useState("");
  const [removePending, setRemovePending] = useState(true);

  useEffect(() => {
    if (open) {
      setExitReason("financeiro");
      setExitNotes("");
      setRemovePending(true);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-background rounded-3xl border border-border shadow-2xl w-full max-w-md p-6 sm:p-7">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
          <Archive size={20} className="text-amber-600" />
        </div>
        <h3 className="font-outfit text-base font-extrabold text-foreground">Arquivar aluno?</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-5 leading-relaxed">
          <strong className="text-foreground">{studentName}</strong> vai para o <strong className="text-foreground">Histórico de alunos</strong> e
          pode ser reativado depois. Pagamentos, contratos e o histórico pedagógico são preservados.
        </p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Motivo da saída</label>
            <select
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
              className="w-full h-11 rounded-xl bg-muted/50 border border-border px-3 text-sm font-semibold outline-none"
            >
              {STUDENT_EXIT_REASONS.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Observações (opcional)</label>
            <textarea
              value={exitNotes}
              onChange={(e) => setExitNotes(e.target.value)}
              rows={3}
              placeholder="Ex.: pai informou que vai se mudar de cidade; pode voltar no próximo semestre."
              className="w-full rounded-xl bg-muted/50 border border-border px-3 py-2.5 text-sm resize-none outline-none"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-muted/30 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={removePending}
              onChange={(e) => setRemovePending(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              Cancelar <strong className="text-foreground">aulas futuras agendadas</strong> e{" "}
              <strong className="text-foreground">faturas pendentes</strong> deste aluno
            </span>
          </label>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="ghost" className="flex-1 h-11 text-xs font-bold" onClick={onCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            className="flex-1 h-11 text-xs font-bold gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => onConfirm({ exitReason, exitNotes, removePending })}
            disabled={isPending}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
            Arquivar
          </Button>
        </div>
      </div>
    </div>
  );
}
