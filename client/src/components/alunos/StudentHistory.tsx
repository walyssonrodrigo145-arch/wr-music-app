import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, MessageCircle, RotateCcw, Search, Trash2, UserX } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { safeFormat } from "@/lib/dates";
import { buildWinbackMessage, exitReasonLabel } from "@shared/studentExitReasons";

interface ArchivedStudent {
  id: number;
  name: string;
  phone?: string | null;
  guardianPhone?: string | null;
  email?: string | null;
  monthlyFee?: string | null;
  exitReason?: string | null;
  exitNotes?: string | null;
  deletedAt?: string | Date | null;
  instrumentName?: string | null;
}

function whatsappLink(student: ArchivedStudent): string | null {
  const digits = (student.phone || student.guardianPhone || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(buildWinbackMessage(student.name))}`;
}

export default function StudentHistory({ onBack }: { onBack: () => void }) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  const [reactivateTarget, setReactivateTarget] = useState<ArchivedStudent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedStudent | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const { data: archived = [], isLoading, isError, refetch, isFetching } = trpc.students.listArchived.useQuery(
    { search: searchTerm },
    { staleTime: 0 }
  );

  const reactivateMutation = trpc.students.reactivate.useMutation({
    onSuccess: () => {
      toast.success("Aluno reativado! Ele voltou para a lista de alunos ativos.");
      utils.students.invalidate();
      utils.students.listArchived.invalidate();
      utils.dashboard.invalidate();
      utils.reports.invalidate();
      setReactivateTarget(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.students.permanentlyDelete.useMutation({
    onSuccess: () => {
      toast.success("Aluno excluído definitivamente.");
      utils.students.listArchived.invalidate();
      setDeleteTarget(null);
      setConfirmName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const items = useMemo(() => archived as ArchivedStudent[], [archived]);
  const nameMatches = deleteTarget ? confirmName.trim().toLowerCase() === deleteTarget.name.trim().toLowerCase() : false;

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 scrollbar-thin no-scrollbar">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar para alunos"
              className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="font-outfit text-xl lg:text-2xl font-extrabold text-foreground tracking-tight leading-none flex items-center gap-2">
                Histórico de alunos <UserX size={18} className="text-amber-600" />
              </h2>
              <p className="text-[10px] lg:text-xs text-muted-foreground font-medium mt-1.5">
                Ex-alunos arquivados — reative ou fale no WhatsApp para trazê-los de volta
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearchTerm(search.trim() || undefined);
              }}
              placeholder="Buscar por nome ou telefone..."
              className="pl-10 h-12 sm:h-11 rounded-2xl border-border bg-card text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-3xl bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="py-16 text-center space-y-3">
            <AlertTriangle className="mx-auto text-muted-foreground" size={28} />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Não foi possível carregar o histórico agora.</p>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Tentar novamente
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center rounded-3xl border border-dashed border-border/70 bg-card/40">
            <UserX size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              {searchTerm ? "Nenhum ex-aluno encontrado para a busca" : "Nenhum aluno arquivado ainda"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Quando você arquivar um aluno, ele aparece aqui com o histórico preservado.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
              {items.length} {items.length === 1 ? "aluno arquivado" : "alunos arquivados"}
            </p>
            {items.map((student) => {
              const wa = whatsappLink(student);
              return (
                <div key={student.id} className="rounded-3xl border border-border/60 bg-card/50 backdrop-blur-sm p-4 sm:p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-outfit text-base font-extrabold text-foreground truncate">{student.name}</p>
                      <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                        {student.instrumentName || "Instrumento não informado"}
                        {student.phone ? ` · ${student.phone}` : student.guardianPhone ? ` · ${student.guardianPhone}` : ""}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[9px] font-black uppercase tracking-widest">
                          {exitReasonLabel(student.exitReason)}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          Arquivado em {safeFormat(student.deletedAt, "dd/MM/yyyy")}
                        </span>
                      </div>
                      {student.exitNotes && (
                        <p className="mt-2 text-xs text-muted-foreground italic leading-relaxed line-clamp-2">{student.exitNotes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {wa ? (
                        <a href={wa} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10">
                            <MessageCircle size={14} /> WhatsApp
                          </Button>
                        </a>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title="Sem telefone cadastrado"
                          className="h-10 rounded-xl font-bold text-xs gap-1.5"
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-10 rounded-xl font-bold text-xs gap-1.5"
                        onClick={() => setReactivateTarget(student)}
                      >
                        <RotateCcw size={14} /> Reativar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Excluir definitivamente ${student.name}`}
                        title="Excluir definitivamente"
                        className={cn("h-10 w-10 p-0 rounded-xl text-rose-500 hover:bg-rose-500/10")}
                        onClick={() => {
                          setDeleteTarget(student);
                          setConfirmName("");
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmar reativação */}
      {reactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setReactivateTarget(null)} />
          <div className="relative bg-background rounded-3xl border border-border shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <RotateCcw size={20} className="text-emerald-600" />
            </div>
            <h3 className="font-outfit text-base font-extrabold text-foreground">Reativar aluno?</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-6 leading-relaxed">
              <strong className="text-foreground">{reactivateTarget.name}</strong> voltará como aluno <strong className="text-foreground">ativo</strong>,
              com o histórico preservado.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1 h-11 text-xs font-bold" onClick={() => setReactivateTarget(null)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 h-11 text-xs font-bold gap-2"
                onClick={() => reactivateMutation.mutate({ id: reactivateTarget.id })}
                disabled={reactivateMutation.isPending}
              >
                {reactivateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                Reativar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Excluir definitivamente (LGPD) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-background rounded-3xl border border-rose-500/30 shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4">
              <Trash2 size={20} className="text-rose-500" />
            </div>
            <h3 className="font-outfit text-base font-extrabold text-foreground">Excluir definitivamente?</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">
              Esta ação é <strong className="text-rose-500">irreversível</strong> e apaga todo o histórico de{" "}
              <strong className="text-foreground">{deleteTarget.name}</strong>. Para liberar, digite o nome do aluno:
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={deleteTarget.name}
              className="h-11 rounded-xl border-border bg-muted/40 text-sm"
            />
            <div className="flex gap-2 mt-5">
              <Button variant="ghost" className="flex-1 h-11 text-xs font-bold" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-11 text-xs font-bold gap-2"
                disabled={!nameMatches || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: deleteTarget.id, confirmName })}
              >
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
