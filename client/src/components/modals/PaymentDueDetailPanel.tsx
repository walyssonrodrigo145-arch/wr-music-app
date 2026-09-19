import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  X, Loader2, Copy, Download,
  ExternalLink, FileText, Pencil, QrCode, Receipt, Send, History, Ban, Link2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn, formatFriendlyError } from "@/lib/utils";
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";
import { downloadUrl } from "@/lib/nativeDownload";

const MONTHS_PT_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function DueStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pago: { label: "Pago", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" },
    atrasado: { label: "Atrasado", cls: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400" },
    pendente: { label: "Pendente", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" },
  };
  const c = map[status] || map.pendente;
  return (
    <span className={cn("inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border", c.cls)}>
      {c.label}
    </span>
  );
}

interface PaymentDueDetailPanelProps {
  paymentId: number | null;
  onClose: () => void;
  gateway: "asaas" | "mercadopago" | "infinitepay";
  onEdit: (payment: any) => void;
  onCharge: (payment: any) => void;
}

export default function PaymentDueDetailPanel({ paymentId, onClose, gateway, onEdit, onCharge }: PaymentDueDetailPanelProps) {
  const utils = trpc.useUtils();
  const { maskBRL } = useDashboardPrefs();
  const [activeId, setActiveId] = useState<number | null>(paymentId);

  useEffect(() => {
    setActiveId(paymentId);
  }, [paymentId]);

  // Fechar com ESC (o painel não é um Dialog do Radix)
  useEffect(() => {
    if (paymentId === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paymentId, onClose]);

  const { data, isLoading } = trpc.paymentDues.getById.useQuery(
    { id: activeId as number },
    { enabled: activeId !== null }
  );

  const generateReceipt = trpc.paymentDues.generateReceipt.useMutation();
  const cancelAsaas = trpc.paymentDues.cancelAsaasCharge.useMutation();
  const cancelMP = trpc.paymentDues.cancelMPCharge.useMutation();
  const cancelIP = trpc.paymentDues.cancelInfinitePayCharge.useMutation();

  if (paymentId === null) return null;

  const due = (data as any)?.due;
  const history: any[] = (data as any)?.history ?? [];
  const totals = (data as any)?.totals as { pago: number; pendente: number; atrasado: number; total: number } | undefined;
  const identificationField = (data as any)?.identificationField as string | null;

  const calc = due?.calculation;
  const hasBreakdown = !!calc && (calc.lateFeeAmount > 0 || calc.interestAmount > 0 || calc.earlyDiscountAmount > 0);
  const hasActiveCharge = !!(due?.asaasId || due?.mpPaymentId || due?.mpPaymentLink || due?.infinitepayPaymentLink || due?.infinitepayPaymentId);

  const copy = (text: string, label = "Copiado!") => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(label))
      .catch(() => toast.error("Não foi possível copiar."));
  };

  const refresh = () => {
    utils.paymentDues.invalidate();
    utils.dashboard.invalidate();
  };

  const handleReceipt = async (sendWhatsapp: boolean) => {
    if (!due) return;
    try {
      const existing = await utils.paymentDues.getReceiptUrl.fetch({ paymentDueId: due.id });
      if (existing?.url && !sendWhatsapp) {
        await downloadUrl(existing.url, existing.fileName || `recibo-${due.id}.pdf`);
        toast.success("Recibo baixado!");
        return;
      }
      const gen: any = await generateReceipt.mutateAsync({ paymentDueId: due.id, sendWhatsapp });
      if (sendWhatsapp) {
        toast.success(gen?.whatsappSent ? "Recibo enviado por WhatsApp!" : "Recibo gerado, mas o envio por WhatsApp falhou.");
      } else {
        toast.success("Recibo gerado!");
      }
      const url = gen?.publicUrl || gen?.url;
      if (url && !sendWhatsapp) await downloadUrl(url, gen?.fileName || `recibo-${due.id}.pdf`);
      refresh();
    } catch (e: any) {
      toast.error(formatFriendlyError(e, "Erro ao gerar recibo"));
    }
  };

  const handleCancelCharge = async () => {
    if (!due) return;
    if (!window.confirm("Cancelar a cobrança ativa? O link de pagamento deixará de funcionar.")) return;
    try {
      if (due.asaasId) await cancelAsaas.mutateAsync({ paymentDueId: due.id });
      else if (due.mpPaymentId || due.mpPaymentLink) await cancelMP.mutateAsync({ paymentDueId: due.id });
      else if (due.infinitepayPaymentLink || due.infinitepayPaymentId) await cancelIP.mutateAsync({ paymentDueId: due.id });
      toast.success("Cobrança cancelada. Gere uma nova quando quiser.");
      refresh();
    } catch (e: any) {
      toast.error(formatFriendlyError(e, "Erro ao cancelar cobrança"));
    }
  };

  const gatewayLabel = gateway === "mercadopago" ? "Mercado Pago" : gateway === "infinitepay" ? "InfinitePay" : "Asaas";

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-card/95 backdrop-blur-xl border border-border shadow-2xl shadow-primary/10 w-full sm:max-w-3xl max-h-[94dvh] sm:max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-sm font-black shrink-0">
              {(due?.studentName || "?").substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-foreground font-outfit truncate">
                {due?.studentName || "Mensalidade"}
              </h3>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5 truncate">
                Mensalidade {due ? `${String(due.month).padStart(2, "0")}/${due.year}` : ""}
                {due?.dueDate ? ` • Vence ${format(new Date(String(due.dueDate) + "T12:00:00"), "dd/MM/yyyy")}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {due && <DueStatusBadge status={due.status} />}
            <button onClick={onClose} aria-label="Fechar" className="w-10 h-10 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors active:scale-95">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isLoading || !due ? (
            <div className="py-24 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 size={28} className="animate-spin text-primary" />
              <span className="text-xs font-medium">Carregando detalhes...</span>
            </div>
          ) : (
            <>
              {/* Valores */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-border bg-muted/30 p-3.5">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Valor atualizado</p>
                  <p className="text-lg font-black text-foreground mt-1">{maskBRL(Number(due.amount))}</p>
                  {hasBreakdown && (
                    <p className="text-[9px] text-muted-foreground line-through mt-0.5">{maskBRL(calc.originalAmount)}</p>
                  )}
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-3.5">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Vencimento</p>
                  <p className="text-sm font-black text-foreground mt-1.5">{format(new Date(String(due.dueDate) + "T12:00:00"), "dd/MM/yyyy")}</p>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase mt-0.5">{due.billingPeriodicity || "Mensal"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-3.5">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{due.paidAt ? "Pago em" : "Situação"}</p>
                  {due.paidAt ? (
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{format(new Date(due.paidAt), "dd/MM/yyyy")}</p>
                  ) : (
                    <p className="text-sm font-black text-foreground mt-1.5">
                      {calc?.daysOverdue > 0 ? `${calc.daysOverdue} dia(s) em atraso` : "Em dia"}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-border bg-muted/30 p-3.5">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Cobrança</p>
                  <p className={cn("text-sm font-black mt-1.5", hasActiveCharge ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground")}>
                    {due.asaasId ? `Asaas ${due.asaasBillingType || ""}`.trim() : due.mpPaymentId || due.mpPaymentLink ? "Mercado Pago" : due.infinitepayPaymentLink ? "InfinitePay" : "Nenhuma"}
                  </p>
                </div>
              </div>

              {/* Composição */}
              {hasBreakdown && (
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold p-3 rounded-2xl bg-muted/30 border border-border">
                  <span className="text-muted-foreground uppercase tracking-wider">Composição:</span>
                  <span className="text-muted-foreground">Original {maskBRL(calc.originalAmount)}</span>
                  {calc.lateFeeAmount > 0 && <span className="text-rose-500">+Multa {maskBRL(calc.lateFeeAmount)}</span>}
                  {calc.interestAmount > 0 && <span className="text-orange-500">+Juros {maskBRL(calc.interestAmount)}</span>}
                  {calc.earlyDiscountAmount > 0 && <span className="text-emerald-600 dark:text-emerald-400">-Desconto {maskBRL(calc.earlyDiscountAmount)}</span>}
                </div>
              )}

              {/* Cobrança ativa */}
              {hasActiveCharge && (
                <div className="rounded-2xl border-2 border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                      <QrCode size={13} /> Cobrança ativa — {gatewayLabel}
                    </p>
                    <button onClick={handleCancelCharge} className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-colors">
                      <Ban size={12} /> Cancelar cobrança
                    </button>
                  </div>

                  {/* Pix copia e cola (Asaas) */}
                  {due.asaasId && due.asaasBillingType === "PIX" && due.asaasPaymentLink && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Pix copia e cola</p>
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-background border border-border">
                        <p className="text-[10px] font-mono text-muted-foreground truncate flex-1">{due.asaasPaymentLink}</p>
                        <button onClick={() => copy(due.asaasPaymentLink, "Código Pix copiado!")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0">
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Boleto (Asaas) */}
                  {due.asaasId && due.asaasBillingType === "BOLETO" && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Linha digitável do boleto</p>
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-background border border-border">
                        <p className="text-[10px] font-mono text-muted-foreground truncate flex-1">{identificationField || "Não foi possível carregar a linha digitável."}</p>
                        {identificationField && (
                          <button onClick={() => copy(identificationField, "Linha digitável copiada!")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0">
                            <Copy size={13} />
                          </button>
                        )}
                      </div>
                      {due.asaasPaymentLink && (
                        <button onClick={() => window.open(due.asaasPaymentLink, "_blank", "noopener")} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-violet-600 hover:underline">
                          <ExternalLink size={12} /> Abrir boleto
                        </button>
                      )}
                    </div>
                  )}

                  {/* Link (cartão/cartão, MP, InfinitePay) */}
                  {((due.asaasId && due.asaasBillingType !== "PIX" && due.asaasBillingType !== "BOLETO") || due.mpPaymentLink || due.infinitepayPaymentLink) && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Link de pagamento</p>
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-background border border-border">
                        <Link2 size={13} className="text-violet-500 shrink-0" />
                        <p className="text-[10px] text-muted-foreground truncate flex-1">
                          {due.mpPaymentLink || due.infinitepayPaymentLink || due.asaasPaymentLink}
                        </p>
                        <button
                          onClick={() => copy(due.mpPaymentLink || due.infinitepayPaymentLink || due.asaasPaymentLink, "Link copiado!")}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => window.open(due.mpPaymentLink || due.infinitepayPaymentLink || due.asaasPaymentLink, "_blank", "noopener")}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ações */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => onEdit(due)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border bg-background hover:bg-muted/50 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <Pencil size={16} className="text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Editar</span>
                </button>
                <button
                  onClick={() => onCharge(due)}
                  disabled={due.status === "pago"}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border bg-background hover:bg-muted/50 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <QrCode size={16} className="text-violet-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-foreground">
                    {gateway === "asaas" ? "Gerar Pix/Boleto" : "Gerar Link"}
                  </span>
                </button>
                <button
                  onClick={() => handleReceipt(false)}
                  disabled={generateReceipt.isPending}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border bg-background hover:bg-muted/50 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  {generateReceipt.isPending ? <Loader2 size={16} className="animate-spin text-emerald-500" /> : <Download size={16} className="text-emerald-500" />}
                  <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Recibo PDF</span>
                </button>
                <button
                  onClick={() => handleReceipt(true)}
                  disabled={generateReceipt.isPending}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-border bg-background hover:bg-muted/50 hover:-translate-y-0.5 hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  <Send size={16} className="text-emerald-600" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-foreground">Recibo WhatsApp</span>
                </button>
              </div>

              {due.notes && (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  <FileText size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-muted-foreground font-medium">{due.notes}</p>
                </div>
              )}

              {/* Histórico do aluno */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <History size={13} /> Histórico financeiro do aluno
                  </p>
                  {totals && (
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-wider">
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Pago {maskBRL(totals.pago)}</span>
                      <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">Pendente {maskBRL(totals.pendente)}</span>
                      <span className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">Atrasado {maskBRL(totals.atrasado)}</span>
                    </div>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="py-10 text-center text-xs text-muted-foreground font-medium italic border border-dashed border-border rounded-2xl">
                    Sem histórico financeiro para este aluno.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
                    {history.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => setActiveId(h.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40 transition-colors",
                          h.id === due.id && "bg-primary/5"
                        )}
                      >
                        <div className="w-16 shrink-0">
                          <p className="text-[10px] font-black text-foreground uppercase">{MONTHS_PT_SHORT[Math.max(0, Math.min(11, h.month - 1))]}/{String(h.year).slice(2)}</p>
                          <p className="text-[9px] text-muted-foreground font-medium">{format(new Date(String(h.dueDate) + "T12:00:00"), "dd/MM")}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-foreground">{maskBRL(Number(h.amount))}</p>
                          {h.receiptUrl && <p className="text-[9px] text-muted-foreground font-medium inline-flex items-center gap-1"><Receipt size={9} /> Recibo disponível</p>}
                        </div>
                        <DueStatusBadge status={h.status} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
