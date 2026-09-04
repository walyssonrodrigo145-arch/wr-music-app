import { useState, useMemo, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatBRL } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Music, Calendar, Clock, CheckCircle2, User, Phone,
  Mail, Sparkles, Loader2, Copy, ExternalLink,
  ChevronRight, CreditCard, ArrowLeft, BadgeCheck, QrCode,
} from "lucide-react";

// Fluxo: Curso → Dados + Pagamento → Horário → Confirmação → Sucesso
type Step = "course" | "payment" | "schedule" | "success";

export default function PublicEnrollment() {
  const params = useParams<{ code: string }>();
  const code = params.code || "";

  // ─── State ───────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("course");
  const [selectedInstrument, setSelectedInstrument] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO">("PIX");

  const [form, setForm] = useState({ name: "", phone: "", email: "", cpf: "" });

  const [paymentData, setPaymentData] = useState<{
    chargeId?: string;
    invoiceUrl?: string;
    pixQrCode?: string | null;
    pixCopiaECola?: string | null;
    value: number;
    skipPayment?: boolean;
  } | null>(null);

  // ── Estado de verificação de pagamento MP ────────────────────────────────────
  const [mpVerifying, setMpVerifying] = useState(false);
  // URL do checkout (MP ou InfinitePay) aberto em nova aba
  const [mpCheckoutUrl, setMpCheckoutUrl] = useState<string | null>(null);
  const [mpPaymentValue, setMpPaymentValue] = useState<number>(0);
  // Provedor do checkout em aberto (para textos e verificação correta)
  const [checkoutProvider, setCheckoutProvider] = useState<"mercadopago" | "infinitepay">("mercadopago");
  // Slug do checkout InfinitePay (usado na verificação via payment_check)
  const [checkoutSlug, setCheckoutSlug] = useState<string | null>(null);

  // Verifica pagamento MP via API do backend (não confia apenas na URL)
  const verifyMPMutation = trpc.enrollment.verifyMPPayment.useQuery(
    { code, paymentId: new URLSearchParams(window.location.search).get("payment_id") || "" },
    { enabled: false } // só roda quando chamado manualmente via refetch
  );

  // Detecta retorno do Mercado Pago via ?payment_id=XXX&status=YYY na URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mpStatus = urlParams.get("status");
    const paymentId = urlParams.get("payment_id") || urlParams.get("collection_id");

    if (!mpStatus || !paymentId) return;

    // Remove os params da URL imediatamente
    window.history.replaceState({}, "", window.location.pathname);

    // Restaura dados salvos antes do redirect para o MP
    try {
      const saved = localStorage.getItem(`mp_enrollment_${window.location.pathname}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.instrumentId) setSelectedInstrument(parsed.instrumentId);
        if (parsed.form) setForm(parsed.form);
        localStorage.removeItem(`mp_enrollment_${window.location.pathname}`);
      }
    } catch (_) {}

    // Verifica pagamento real na API do Mercado Pago via backend
    setMpVerifying(true);
    fetch(`/api/trpc/enrollment.verifyMPPayment?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { code, paymentId } } }))}`)
      .then(r => r.json())
      .then((res: any) => {
        const result = res?.[0]?.result?.data?.json;
        if (result?.verified) {
          setStep("schedule");
          if (result.status === "approved") {
            toast.success("Pagamento aprovado! Agora escolha seu horário.");
          } else {
            toast.success("Pagamento recebido! Assim que confirmado, sua vaga estará garantida.");
          }
        } else {
          toast.error(`Pagamento não confirmado (status: ${result?.status ?? "desconhecido"}). Tente novamente.`);
        }
      })
      .catch(() => {
        // Fallback: confia no status da URL se a verificação falhar
        if (mpStatus === "approved" || mpStatus === "pending") {
          setStep("schedule");
          toast.success("Pagamento recebido! Agora escolha seu horário.");
        } else {
          toast.error("Não foi possível verificar o pagamento. Tente novamente.");
        }
      })
      .finally(() => setMpVerifying(false));
  }, []);

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const { data: details, isLoading: detailsLoading, error: detailsError } =
    trpc.enrollment.getPublicDetails.useQuery(
      { code },
      { enabled: Boolean(code), retry: 1, staleTime: 0, gcTime: 0, refetchOnMount: "always" }
    );

  // instrumentId resolvido: usa o selecionado, ou o pré-selecionado do link, ou o primeiro disponível
  const resolvedInstrumentId = selectedInstrument
    ?? details?.preselectedInstrumentId
    ?? (details?.instruments?.[0]?.id ?? null);

  const { data: slotsData, isLoading: slotsLoading } =
    trpc.enrollment.getAvailableSlots.useQuery(
      { code, instrumentId: resolvedInstrumentId!, dateStr: selectedDate },
      {
        enabled: Boolean(code && resolvedInstrumentId && selectedDate && step === "schedule"),
        staleTime: 0, gcTime: 0, refetchOnMount: "always",
        refetchOnWindowFocus: true, refetchInterval: 30_000,
      }
    );

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const createChargeMutation = trpc.enrollment.createPaymentCharge.useMutation({
    onSuccess: (data) => {
      if (data.skipPayment) {
        // Sem gateway: vai direto para seleção de horário
        setStep("schedule");
      } else if ((data as any).gateway === "infinitepay" && (data as any).invoiceUrl) {
        // Salva estado no localStorage ANTES de abrir o checkout InfinitePay
        try {
          localStorage.setItem(`mp_enrollment_${window.location.pathname}`, JSON.stringify({
            instrumentId: selectedInstrument,
            form,
          }));
        } catch (_) {}
        // InfinitePay: abre em nova aba e mostra tela de aguardo com botão de verificação
        window.open((data as any).invoiceUrl, "_blank");
        setCheckoutProvider("infinitepay");
        setCheckoutSlug((data as any).slug ?? null);
        setMpCheckoutUrl((data as any).invoiceUrl);
        setMpPaymentValue((data as any).value || 0);
      } else if ((data as any).gateway === "mercadopago" && (data as any).invoiceUrl) {
        // Salva estado no localStorage ANTES de abrir o checkout MP
        try {
          localStorage.setItem(`mp_enrollment_${window.location.pathname}`, JSON.stringify({
            instrumentId: selectedInstrument,
            form,
          }));
        } catch (_) {}
        // Mercado Pago: abre em nova aba e mostra tela de aguardo com botão de verificação
        window.open((data as any).invoiceUrl, "_blank");
        setCheckoutProvider("mercadopago");
        setMpCheckoutUrl((data as any).invoiceUrl);
        setMpPaymentValue((data as any).value || 0);
      } else {
        // Asaas: exibe QR Code PIX ou link de boleto na tela
        setPaymentData({
          chargeId: (data as any).chargeId,
          invoiceUrl: (data as any).invoiceUrl,
          pixQrCode: (data as any).pixQrCode,
          pixCopiaECola: (data as any).pixCopiaECola,
          value: (data as any).value,
        });
      }
    },
    onError: (e) => toast.error("Erro ao gerar cobrança: " + e.message),
  });

  const confirmMutation = trpc.enrollment.submitEnrollment.useMutation({
    onSuccess: () => setStep("success"),
    onError: (e) => toast.error("Erro ao confirmar matrícula: " + e.message),
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const nextDays = useMemo(() => {
    const days = [];
    // Obtém a data atual no fuso horário de Brasília (UTC-3)
    const nowBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    for (let i = 1; i <= 14; i++) {
      const d = new Date(nowBrasilia);
      d.setDate(nowBrasilia.getDate() + i);
      // dateStr no formato YYYY-MM-DD usando locale "sv" (sueco) que retorna o padrão ISO sem conversão UTC
      const dateStr = d.toLocaleDateString("sv", { timeZone: "America/Sao_Paulo" });
      const weekday = d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
      const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
      days.push({ dateStr, weekday, day });
    }
    return days;
  }, []);

  const copyPix = async () => {
    if (!paymentData?.pixCopiaECola) return;
    await navigator.clipboard.writeText(paymentData.pixCopiaECola);
    toast.success("Chave PIX copiada!");
  };

  const handleGoToSchedule = () => {
    setStep("schedule");
  };

  // Verifica manualmente o pagamento (MP via external_reference ou InfinitePay via payment_check)
  const handleVerifyMPPayment = async () => {
    setMpVerifying(true);
    try {
      if (checkoutProvider === "infinitepay") {
        // InfinitePay: revalidação server-to-server (payment_check) no backend
        const res = await fetch(
          `/api/trpc/enrollment.verifyInfinitePayPayment?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { code, slug: checkoutSlug ?? undefined } } }))}`
        );
        const resJson: any = await res.json();
        const result = resJson?.[0]?.result?.data?.json;
        const errMsg = resJson?.[0]?.error?.message;
        if (errMsg) throw new Error(errMsg);
        if (result?.verified) {
          setMpCheckoutUrl(null);
          setStep("schedule");
          toast.success("Pagamento confirmado! Agora escolha seu horário.");
        } else {
          toast.error("Pagamento ainda não confirmado. Conclua o pagamento (PIX ou cartão) e tente novamente em alguns segundos.");
        }
        return;
      }

      // Tenta buscar o payment_id mais recente via API do backend (external_reference = enrollment_${code})
      const res = await fetch(
        `/api/trpc/enrollment.verifyMPByReference?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: { code } } }))}`
      );
      const resJson: any = await res.json();
      const result = resJson?.[0]?.result?.data?.json;
      if (result?.verified) {
        setMpCheckoutUrl(null);
        setStep("schedule");
        toast.success("Pagamento confirmado! Agora escolha seu horário.");
      } else {
        toast.error(
          result?.status === "pending"
            ? "Pagamento PIX pendente — aguarde a confirmação do banco (pode levar alguns instantes)."
            : `Pagamento ainda não confirmado (status: ${result?.status ?? "aguardando"}). Tente novamente em alguns segundos.`
        );
      }
    } catch {
      toast.error("Não foi possível verificar. Certifique-se de que concluiu o pagamento e tente novamente.");
    } finally {
      setMpVerifying(false);
    }
  };

  // ─── Loading / Error ──────────────────────────────────────────────────────────
  if (detailsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto" />
          <p className="text-xs text-muted-foreground font-semibold">Carregando dados da escola...</p>
        </div>
      </div>
    );
  }

  if (mpVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto" />
          <p className="text-sm font-bold text-foreground">Verificando pagamento...</p>
          <p className="text-xs text-muted-foreground">Consultando o Mercado Pago. Aguarde um momento.</p>
        </div>
      </div>
    );
  }

  // Tela de aguardo quando o checkout MP foi aberto em nova aba
  if (mpCheckoutUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-indigo-950/10 p-4">
        <Card className="max-w-sm w-full p-8 space-y-6 rounded-3xl border-border bg-card shadow-2xl text-center">
          {/* Ícone animado */}
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center">
              <CreditCard size={36} className="text-blue-400" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-foreground">Conclua o pagamento</h2>
            <p className="text-xs text-muted-foreground">
              O checkout do {checkoutProvider === "infinitepay" ? "InfinitePay" : "Mercado Pago"} foi aberto em uma nova aba. Realize o pagamento e depois clique no botão abaixo para confirmar.
            </p>
            {mpPaymentValue > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-black">
                Valor: {formatBRL(mpPaymentValue)}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleVerifyMPPayment}
              disabled={mpVerifying}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20"
            >
              {mpVerifying ? <Loader2 size={18} className="mr-2 animate-spin" /> : <BadgeCheck size={18} className="mr-2" />}
              Já paguei — Verificar Pagamento
            </Button>

            <a
              href={mpCheckoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all"
            >
              <ExternalLink size={14} />
              Reabrir checkout do {checkoutProvider === "infinitepay" ? "InfinitePay" : "Mercado Pago"}
            </a>

            <button
              onClick={() => setMpCheckoutUrl(null)}
              className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground underline underline-offset-2 transition-colors"
            >
              Cancelar e voltar
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (detailsError || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <Card className="max-w-sm w-full p-8 space-y-4 rounded-3xl border-rose-500/20 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <Sparkles size={28} />
          </div>
          <h2 className="text-xl font-black text-foreground">Link Inválido</h2>
          <p className="text-xs text-muted-foreground">Este link de matrícula expirou ou já foi utilizado.</p>
        </Card>
      </div>
    );
  }

  // ─── Steps config ─────────────────────────────────────────────────────────────
  const STEPS = [
    { key: "course",   label: "Curso" },
    { key: "payment",  label: "Dados & Pagamento" },
    { key: "schedule", label: "Horário" },
  ];
  const currentIdx = STEPS.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-indigo-950/10 text-foreground">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border/40 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {details.schoolLogo ? (
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 p-0.5 border border-indigo-500/20 flex items-center justify-center overflow-hidden shrink-0">
                <img src={details.schoolLogo} alt={details.schoolName} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-500 flex items-center justify-center shrink-0">
                <Music size={16} />
              </div>
            )}
            <span className="text-sm font-black text-foreground truncate max-w-[180px]">{details.schoolName}</span>
          </div>
          {details.monthlyFee && (
            <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              R$ {Number(details.monthlyFee).toFixed(0)}/mês
            </span>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* ── Progress Bar ── */}
        {step !== "success" && (
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className={`flex items-center gap-1.5 ${i <= currentIdx ? "text-indigo-400" : "text-muted-foreground/40"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all
                    ${i < currentIdx ? "bg-indigo-600 border-indigo-600 text-white" :
                    i === currentIdx ? "border-indigo-500 text-indigo-400" :
                    "border-border/40 text-muted-foreground/40"}`}>
                    {i < currentIdx ? <CheckCircle2 size={12} /> : i + 1}
                  </div>
                  <span className="text-[10px] font-bold hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${i < currentIdx ? "bg-indigo-600" : "bg-border/40"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ═══════════════════════════════════════════════
              PASSO 1 — Selecione o Curso / Instrumento
          ═══════════════════════════════════════════════ */}
          {step === "course" && (
            <motion.div key="course" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-foreground">Qual curso você quer fazer?</h1>
                <p className="text-xs text-muted-foreground">Selecione o instrumento que você quer aprender</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {details.instruments.map((inst: any) => {
                  const isSelected = selectedInstrument === inst.id;
                  return (
                    <button
                      key={inst.id}
                      onClick={() => setSelectedInstrument(inst.id)}
                      className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between h-28 group
                        ${isSelected
                          ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                          : "border-border/50 bg-card/50 hover:border-indigo-400/40 hover:bg-muted/30"}`}
                    >
                      <Music size={22} className={isSelected ? "text-indigo-400" : "text-muted-foreground group-hover:text-indigo-400/60"} />
                      <span className={`text-sm font-bold truncate ${isSelected ? "text-indigo-300" : "text-foreground"}`}>
                        {inst.name}
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                          <CheckCircle2 size={12} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedInstrument && (
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 space-y-1 animate-in fade-in">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">💡 Como funciona</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Você vai preencher seus dados e pagar a <span className="font-bold text-foreground">primeira mensalidade (R$ {Number(details.monthlyFee).toFixed(0)})</span>. Depois de confirmar, você escolhe o melhor dia e horário para sua aula!
                  </p>
                </div>
              )}

              <Button
                disabled={!selectedInstrument}
                onClick={() => setStep("payment")}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-40"
              >
                Continuar <ChevronRight size={16} />
              </Button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════
              PASSO 2 — Dados Pessoais + Pagamento
          ═══════════════════════════════════════════════ */}
          {step === "payment" && (
            <motion.div key="payment" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">

              {/* Se o pagamento ainda não foi gerado, mostra o formulário */}
              {!paymentData && (
                <>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep("course")} className="w-8 h-8 rounded-xl border border-border/50 flex items-center justify-center hover:bg-muted/40">
                      <ArrowLeft size={14} />
                    </button>
                    <div>
                      <h2 className="text-xl font-black text-foreground">Seus dados e pagamento</h2>
                      <p className="text-xs text-muted-foreground">Preencha para garantir sua vaga</p>
                    </div>
                  </div>

                  {/* Resumo do curso selecionado */}
                  <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Curso selecionado</p>
                      <p className="text-sm font-black text-foreground">{details.instruments.find((i: any) => i.id === selectedInstrument)?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Mensalidade</p>
                      <p className="text-lg font-black text-emerald-400">{formatBRL(details.monthlyFee)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><User size={10} /> Nome Completo *</Label>
                      <Input id="enrollment-name" placeholder="Seu nome completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-11 rounded-xl bg-card/50 border-border/50 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Phone size={10} /> WhatsApp *</Label>
                      <Input id="enrollment-phone" placeholder="(00) 00000-0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-xl bg-card/50 border-border/50 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Mail size={10} /> E-mail</Label>
                      <Input id="enrollment-email" type="email" placeholder="seu@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-11 rounded-xl bg-card/50 border-border/50 focus:border-indigo-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CPF (para gerar PIX ou Boleto)</Label>
                      <Input id="enrollment-cpf" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} className="h-11 rounded-xl bg-card/50 border-border/50 focus:border-indigo-500" />
                    </div>

                    {/* Escolha do método de pagamento */}
                    {details.paymentGateway === "asaas" && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Método de Pagamento</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["PIX", "BOLETO"] as const).map(type => (
                            <button
                              key={type}
                              onClick={() => setBillingType(type)}
                              className={`py-3 rounded-xl border-2 text-xs font-bold transition-all
                                ${billingType === type
                                  ? "border-indigo-500 bg-indigo-500/10 text-indigo-400"
                                  : "border-border/40 text-muted-foreground"}`}
                            >
                              {type === "PIX" ? "🔑 PIX" : "📄 Boleto"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {details.paymentGateway === "mercadopago" && (
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-bold flex items-center gap-2">
                        <span>💳 Pagamento seguro via Mercado Pago (PIX / Cartão)</span>
                      </div>
                    )}

                    {details.paymentGateway === "infinitepay" && (
                      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400 font-bold flex items-center gap-2">
                        <span>💳 Pagamento seguro via InfinitePay (PIX taxa zero / Cartão 12x)</span>
                      </div>
                    )}
                  </div>

                  <Button
                    disabled={!form.name.trim() || !form.phone.trim() || createChargeMutation.isPending}
                    onClick={() => {
                      if (!form.name.trim() || !form.phone.trim()) {
                        toast.error("Preencha seu nome e telefone.");
                        return;
                      }
                      createChargeMutation.mutate({
                        code,
                        studentName: form.name.trim(),
                        studentPhone: form.phone.trim(),
                        studentEmail: form.email.trim() || undefined,
                        studentCpf: form.cpf.trim() || undefined,
                        instrumentId: selectedInstrument!,
                        teacherUserId: 0,
                        dateStr: "pending",
                        timeStr: "pending",
                        billingType,
                      });
                    }}
                    className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-40"
                  >
                    {createChargeMutation.isPending
                      ? <><Loader2 size={16} className="animate-spin" /> Gerando cobrança...</>
                      : <><CreditCard size={16} /> Gerar Cobrança e Pagar</>}
                  </Button>
                </>
              )}

              {/* Cobrança gerada — exibe QR Code PIX ou Boleto */}
              {paymentData && (
                <div className="space-y-5">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-black text-foreground">Realize o pagamento</h2>
                    <p className="text-xs text-muted-foreground">Após pagar, clique no botão abaixo para escolher seu horário</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-card border border-border/50 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Valor da mensalidade</span>
                      <span className="text-xl font-black text-emerald-400">{formatBRL(paymentData.value)}</span>
                    </div>

                    {paymentData.pixQrCode && (
                      <div className="space-y-3">
                        <div className="flex justify-center">
                          <img
                            src={`data:image/png;base64,${paymentData.pixQrCode}`}
                            alt="QR Code PIX"
                            className="w-52 h-52 rounded-2xl border-2 border-border/40 shadow-md"
                          />
                        </div>
                        {paymentData.pixCopiaECola && (
                          <button
                            onClick={copyPix}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all"
                          >
                            <Copy size={14} /> Copiar código PIX (Copia e Cola)
                          </button>
                        )}
                      </div>
                    )}

                    {paymentData.invoiceUrl && (
                      <a
                        href={paymentData.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all"
                      >
                        <ExternalLink size={14} />
                        Abrir link de pagamento
                      </a>
                    )}
                  </div>

                  {/* Após pagar → vai escolher o horário */}
                  <Button
                    onClick={handleGoToSchedule}
                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20"
                  >
                    <BadgeCheck size={18} /> Já paguei — Escolher meu Horário
                  </Button>
                  <p className="text-center text-[10px] text-muted-foreground">Clique somente após realizar o pagamento acima</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════
              PASSO 3 — Escolha o Dia e Horário (pós-pagamento)
          ═══════════════════════════════════════════════ */}
          {step === "schedule" && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Pagamento confirmado!</span>
                </div>
                <h2 className="text-2xl font-black text-foreground">Agora escolha seu horário</h2>
                <p className="text-xs text-muted-foreground">Selecione o dia e o horário disponível para suas aulas</p>
              </div>

              {/* Seleção de data */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={14} className="text-indigo-400" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Escolha o dia</span>
                </div>
                <div className="overflow-x-auto pb-2">
                  <div className="flex gap-2 min-w-max">
                    {nextDays.map((day) => {
                      const isSelected = selectedDate === day.dateStr;
                      // Verifica se a escola está fechada nesse dia da semana
                      const DAY_MAP: Record<number, string> = { 0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday" };
                      const weekdayIdx = new Date(`${day.dateStr}T12:00:00-03:00`).getDay();
                      const dayKey = DAY_MAP[weekdayIdx];
                      const schoolHours = (details as any).schoolHours || {};
                      const isClosed = !schoolHours[dayKey]?.active;
                      return (
                        <button
                          key={day.dateStr}
                          disabled={isClosed}
                          onClick={() => { if (!isClosed) { setSelectedDate(day.dateStr); setSelectedTime(""); } }}
                          className={`flex flex-col items-center px-4 py-3 rounded-2xl border-2 min-w-[72px] transition-all
                            ${isClosed
                              ? "opacity-30 border-border/20 bg-muted/10 cursor-not-allowed"
                              : isSelected
                              ? "border-indigo-500 bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                              : "border-border/40 bg-card/50 hover:border-indigo-400/40"}`}
                        >
                          <span className={`text-[10px] font-bold uppercase ${isSelected ? "text-indigo-100" : isClosed ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{day.weekday}</span>
                          <span className={`text-sm font-black ${isSelected ? "text-white" : isClosed ? "text-muted-foreground/40" : "text-foreground"}`}>{day.day}</span>
                          {isClosed && <span className="text-[8px] font-bold text-rose-400/60 uppercase mt-0.5">Fechado</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Seleção de horário */}
              {selectedDate && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-indigo-400" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Horários Disponíveis</span>
                  </div>

                  {slotsLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
                      <Loader2 size={16} className="animate-spin text-indigo-400" />
                      Verificando disponibilidade...
                    </div>
                  ) : slotsData?.closedDay ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                      <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400">
                        <Clock size={18} />
                      </div>
                      <p className="text-xs font-bold text-foreground">Escola fechada neste dia</p>
                      <p className="text-[10px] text-muted-foreground">Escolha outro dia disponível</p>
                    </div>
                  ) : slotsData?.slots.filter((s: any) => s.available).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                      <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
                        <Clock size={18} />
                      </div>
                      <p className="text-xs font-bold text-foreground">Sem horários disponíveis</p>
                      <p className="text-[10px] text-muted-foreground">Todos os horários deste dia estão ocupados. Escolha outra data.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {slotsData?.slots.map((slot: any) => {
                        const isSelected = selectedTime === slot.time;
                        return (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`py-3 rounded-xl border-2 text-xs font-bold transition-all
                              ${!slot.available
                                ? "opacity-25 border-border/20 bg-muted/10 line-through cursor-not-allowed text-muted-foreground"
                                : isSelected
                                ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                : "border-border/40 bg-card/50 hover:border-emerald-400/50 text-foreground"}`}
                          >
                            {slot.time}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {slotsData?.teacher && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/30">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <User size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Professor responsável</p>
                        <p className="text-xs font-bold text-foreground">{slotsData.teacher.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                disabled={!selectedDate || !selectedTime || confirmMutation.isPending}
                onClick={() => {
                  confirmMutation.mutate({
                    code,
                    studentName: form.name,
                    studentPhone: form.phone,
                    studentEmail: form.email || undefined,
                    instrumentId: resolvedInstrumentId!,
                    teacherUserId: slotsData?.teacher?.userId ?? 0,
                    studioRoomId: slotsData?.room?.id,
                    dateStr: selectedDate,
                    timeStr: selectedTime,
                    asaasChargeId: paymentData?.chargeId,
                    infinitepaySlug: checkoutSlug || undefined,
                  });
                }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-40"
              >
                {confirmMutation.isPending
                  ? <><Loader2 size={16} className="animate-spin" /> Confirmando...</>
                  : <><BadgeCheck size={16} /> Confirmar Matrícula</>}
              </Button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════
              SUCESSO!
          ═══════════════════════════════════════════════ */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center text-center space-y-6 py-8"
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 size={52} className="text-emerald-400" />
                </div>
                <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg">
                  <Music size={14} className="text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-foreground">Matrícula Confirmada! 🎉</h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Sua aula foi agendada com sucesso. Em breve você receberá a confirmação pelo WhatsApp!
                </p>
              </div>

              <Card className="w-full p-5 rounded-2xl bg-card/50 border-border/40 text-left space-y-3">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Resumo da Matrícula</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Escola</span>
                    <span className="font-bold text-foreground">{details.schoolName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Instrumento</span>
                    <span className="font-bold text-foreground">{details.instruments.find((i: any) => i.id === selectedInstrument)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-bold text-foreground">{new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horário</span>
                    <span className="font-bold text-foreground">{selectedTime}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Professor</span>
                    <span className="font-bold text-foreground">{slotsData?.teacher?.name || "—"}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
