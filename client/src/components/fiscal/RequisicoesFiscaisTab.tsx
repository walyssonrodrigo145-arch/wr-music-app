import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/money";

type LogKind = "todos" | "sucesso" | "erro";

const KIND_FILTERS: { value: LogKind; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "sucesso", label: "Sucesso" },
  { value: "erro", label: "Erro" },
];

const EVENT_LABELS: Record<string, string> = {
  "NFS-E_CREATED": "Nota criada",
  "NFS-E_SENT": "Envio à prefeitura",
  "NFS-E_AUTHORIZED": "Nota autorizada",
  "NFS-E_ISSUED": "Nota autorizada",
  "NFS-E_ERROR": "Erro na emissão",
  "NFS-E_CANCELLED": "Nota cancelada",
  "NFS-E_RETRY": "Reprocessamento solicitado",
};

function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event.replace(/[_-]+/g, " ").trim();
}

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return "---";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "---";
  return dateTimeFormatter.format(date).replace(",", "");
}

function countFor(
  kind: LogKind,
  stats?: { total: number; sucesso: number; erro: number }
): number {
  if (!stats) return 0;
  if (kind === "sucesso") return stats.sucesso;
  if (kind === "erro") return stats.erro;
  return stats.total;
}

function EmptyState({ kind }: { kind: LogKind }) {
  const title =
    kind === "todos"
      ? "Nenhuma requisição registrada ainda"
      : kind === "erro"
      ? "Nenhuma requisição de erro"
      : "Nenhuma requisição de sucesso";
  const description =
    kind === "todos"
      ? "As operações de emissão, envio e cancelamento aparecerão aqui."
      : "Tente selecionar outro filtro para visualizar os registros.";

  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 py-14 text-center">
      <Activity className="mx-auto mb-3 text-muted-foreground/40" size={32} />
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function RequisicoesFiscaisTab() {
  const [kind, setKind] = useState<LogKind>("todos");

  const { data, isLoading, isFetching, refetch } = trpc.fiscal.logs.list.useQuery(
    { kind },
    { placeholderData: (prev) => prev }
  );

  const items = data?.items ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-4">
      {/* Filtros + Atualizar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {KIND_FILTERS.map((filter) => {
            const active = kind === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setKind(filter.value)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
                  active
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-black tabular-nums",
                    filter.value === "sucesso" && "bg-emerald-500/10 text-emerald-600",
                    filter.value === "erro" && "bg-rose-500/10 text-rose-600",
                    filter.value === "todos" && "bg-muted text-muted-foreground"
                  )}
                >
                  {countFor(filter.value, stats)}
                </span>
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-10 shrink-0 gap-2 rounded-xl text-xs font-bold"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Atualizar
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mb-3 animate-spin text-emerald-500" size={28} />
          <p className="text-xs font-bold">Carregando requisições...</p>
        </div>
      ) : items.length === 0 ? (
        <EmptyState kind={kind} />
      ) : (
        <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const isError = item.kind === "erro";
            const hasValue =
              item.invoiceValue !== null &&
              item.invoiceValue !== undefined &&
              item.invoiceValue !== "";

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border/50 bg-card p-3.5"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                      isError
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-emerald-500/10 text-emerald-600"
                    )}
                  >
                    {isError ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-bold text-foreground">
                        {eventLabel(item.event)}
                      </span>

                      {item.invoiceNumber ? (
                        <span className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                          #{item.invoiceNumber}
                        </span>
                      ) : null}

                      <span className="w-full text-[10px] font-medium tabular-nums text-muted-foreground sm:ml-auto sm:w-auto">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
                      {item.reference ? (
                        <span className="font-mono text-muted-foreground">
                          {item.reference}
                        </span>
                      ) : null}

                      {item.customerName ? (
                        <span className="max-w-full truncate font-medium text-foreground/80">
                          {item.customerName}
                        </span>
                      ) : null}

                      {hasValue ? (
                        <span className="font-bold text-foreground">
                          {formatBRL(item.invoiceValue)}
                        </span>
                      ) : null}
                    </div>

                    {item.errorMessage ? (
                      <div className="mt-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-2">
                        <p className="break-words text-[11px] font-medium text-rose-600 dark:text-rose-400">
                          {item.errorMessage}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RequisicoesFiscaisTab;
