import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Music, Calendar, Clock, CheckCircle2, User, Phone,
  Mail, Sparkles, Loader2, Copy, ExternalLink, ChevronRight,
  QrCode, CreditCard, ArrowLeft, BadgeCheck,
} from "lucide-react";

type Step = "instrument" | "datetime" | "personal" | "payment" | "success";

export default function PublicEnrollment() {
  const params = useParams<{ code: string }>();
  const code = params.code || "";

  const [step, setStep] = useState<Step>("instrument");
  const [selectedInstrument, setSelectedInstrument] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [billingType, setBillingType] = useState<"PIX" | "BOLETO">("PIX");
  const [paymentData, setPaymentData] = useState<{
    chargeId: string;
    invoiceUrl: string;
    pixQrCode: string | null;
    pixCopiaECola: string | null;
    value: number;
    billingType: string;
    enrollmentData: any;
    skipPayment?: boolean;
  } | null>(null);

  const [form, setForm] = useState({ name: "", phone: "", email: "", cpf: "" });

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const { data: details, isLoading: detailsLoading, error: detailsError } =
    trpc.enrollment.getPublicDetails.useQuery(
      { code },
      { enabled: Boolean(code), retry: 1 }
    );

  const { data: slotsData, isLoading: slotsLoading } =
    trpc.enrollment.getAvailableSlots.useQuery(
      { code, instrumentId: selectedInstrument!, dateStr: selectedDate },
      { enabled: Boolean(code && selectedInstrument && selectedDate) }
    );

  // ─── Mutations ───────────────────────────────────────────────────────────────
  const createChargeMutation = trpc.enrollment.createPaymentCharge.useMutation({
    onSuccess: (data) => {
      if (data.skipPayment) {
        // Sem gateway configurado — cadastra direto
        confirmMutation.mutate({
          code,
          studentName: form.name,
          studentPhone: form.phone,
          studentEmail: form.email || undefined,
          instrumentId: selectedInstrument!,
          teacherUserId: slotsData?.teacher?.userId!,
          studioRoomId: slotsData?.room?.id,
          dateStr: selectedDate,
          timeStr: selectedTime,
        });
      } else {
        setPaymentData(data as any);
        setStep("payment");
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
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
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

  // ─── Loading / Error states ───────────────────────────────────────────────────
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

  // ─── Step indicator ───────────────────────────────────────────────────────────
  const STEPS: { key: Step; label: string }[] = [
    { key: "instrument", label: "Curso" },
    { key: "datetime", label: "Horário" },
    { key: "personal", label: "Dados" },
    { key: "payment", label: "Pagamento" },
  ];
  const currentStepIdx = STEPS.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-indigo-950/10 text-foreground">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border/40 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-500 flex items-center justify-center">
              <Music size={16} />
            </div>
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

        {/* ── Step Progress Bar ── */}
        {step !== "success" && (
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className={`flex items-center gap-1.5 ${i <= currentStepIdx ? "text-indigo-400" : "text-muted-foreground/40"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all
                    ${i < currentStepIdx ? "bg-indigo-600 border-indigo-600 text-white" :
                    i === currentStepIdx ? "border-indigo-500 text-indigo-400" :
                    "border-border/40 text-muted-foreground/40"}`}>
                    {i < currentStepIdx ? <CheckCircle2 size={12} /> : i + 1}
                  </div>
                  <span className="text-[10px] font-bold hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${i < currentStepIdx ? "bg-indigo-600" : "bg-border/40"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">

          {/* ═══════════════════════════════════════════════
              PASSO 1 — Selecione o Instrumento / Curso
          ═══════════════════════════════════════════════ */}
          {step === "instrument" && (
            <motion.div key="instrument" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <div className="space-y-1">
                <h1 className="text-xl font-black text-foreground">Qual instrumento você quer aprender?</h1>
                <p className="text-xs text-muted-foreground">Escolha o curso que mais combina com você</p>
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

              <Button
                disabled={!selectedInstrument}
                onClick={() => setStep("datetime")}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-40"
              >
                Continuar <ChevronRight size={16} />
              </Button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════
              PASSO 2 — Escolha o Dia e Horário
          ═══════════════════════════════════════════════ */}
          {step === "datetime" && (
            <motion.div key="datetime" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep("instrument")} className="w-8 h-8 rounded-xl border border-border/50 flex items-center justify-center hover:bg-muted/40">
                  <ArrowLeft size={14} />
                </button>
                <div>
                  <h2 className="text-xl font-black text-foreground">Escolha o dia da aula</h2>
                  <p className="text-xs text-muted-foreground">Próximos 14 dias disponíveis</p>
                </div>
              </div>

              {/* Seleção de data */}
              <div className="overflow-x-auto pb-2">
                <div className="flex gap-2 min-w-max">
                  {nextDays.map((day) => {
                    const isSelected = selectedDate === day.dateStr;
                    return (
                      <button
                        key={day.dateStr}
                        onClick={() => { setSelectedDate(day.dateStr); setSelectedTime(""); }}
                        className={`flex flex-col items-center px-4 py-3 rounded-2xl border-2 min-w-[72px] transition-all
                          ${isSelected
                            ? "border-indigo-500 bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                            : "border-border/40 bg-card/50 hover:border-indigo-400/40"}`}
                      >
                        <span className={`text-[10px] font-bold uppercase ${isSelected ? "text-indigo-100" : "text-muted-foreground"}`}>{day.weekday}</span>
                        <span className={`text-sm font-black ${isSelected ? "text-white" : "text-foreground"}`}>{day.day}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seleção de horário */}
              {selectedDate && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-indigo-400" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Horários Disponíveis</span>
                  </div>

                  {slotsLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
                      <Loader2 size={16} className="animate-spin text-indigo-400" />
                      Verificando disponibilidade...
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
                disabled={!selectedDate || !selectedTime}
                onClick={() => setStep("personal")}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-40"
              >
                Continuar <ChevronRight size={16} />
              </Button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════
              PASSO 3 — Dados Pessoais
          ═══════════════════════════════════════════════ */}
          {step === "personal" && (
            <motion.div key="personal" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep("datetime")} className="w-8 h-8 rounded-xl border border-border/50 flex items-center justify-center hover:bg-muted/40">
                  <ArrowLeft size={14} />
                </button>
                <div>
                  <h2 className="text-xl font-black text-foreground">Seus dados</h2>
                  <p className="text-xs text-muted-foreground">Para finalizar sua matrícula</p>
                </div>
              </div>

              {/* Resumo da aula escolhida */}
              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Resumo da sua aula</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Instrumento</p>
                    <p className="font-bold text-foreground">{details.instruments.find((i: any) => i.id === selectedInstrument)?.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data</p>
                    <p className="font-bold text-foreground">{new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Horário</p>
                    <p className="font-bold text-foreground">{selectedTime}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mensalidade</p>
                    <p className="font-bold text-emerald-400">R$ {Number(details.monthlyFee).toFixed(2)}</p>
                  </div>
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
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CPF (para gerar PIX/Boleto)</Label>
                  <Input id="enrollment-cpf" placeholder="000.000.000-00" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} className="h-11 rounded-xl bg-card/50 border-border/50 focus:border-indigo-500" />
                </div>
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
                    teacherUserId: slotsData?.teacher?.userId!,
                    studioRoomId: slotsData?.room?.id,
                    dateStr: selectedDate,
                    timeStr: selectedTime,
                    billingType,
                  });
                }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-40"
              >
                {createChargeMutation.isPending
                  ? <><Loader2 size={16} className="animate-spin" /> Gerando cobrança...</>
                  : <><CreditCard size={16} /> Ir para o Pagamento</>}
              </Button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════
              PASSO 4 — Pagamento (PIX / Boleto)
          ═══════════════════════════════════════════════ */}
          {step === "payment" && paymentData && (
            <motion.div key="payment" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-black text-foreground">Realize o pagamento</h2>
                <p className="text-xs text-muted-foreground">Sua matrícula será confirmada após o pagamento</p>
              </div>

              <div className="p-4 rounded-2xl bg-card border border-border/50 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Valor da mensalidade</span>
                  <span className="text-lg font-black text-emerald-400">R$ {paymentData.value.toFixed(2)}</span>
                </div>

                {/* Escolha o tipo de pagamento */}
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

                {/* QR Code PIX */}
                {paymentData.billingType === "PIX" && paymentData.pixQrCode && (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${paymentData.pixQrCode}`}
                        alt="QR Code PIX"
                        className="w-48 h-48 rounded-xl border border-border/40"
                      />
                    </div>
                    {paymentData.pixCopiaECola && (
                      <button
                        onClick={copyPix}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all"
                      >
                        <Copy size={14} /> Copiar código PIX
                      </button>
                    )}
                  </div>
                )}

                {/* Link do Boleto */}
                {paymentData.invoiceUrl && (
                  <a
                    href={paymentData.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all"
                  >
                    <ExternalLink size={14} />
                    {paymentData.billingType === "PIX" ? "Abrir link de pagamento" : "Abrir Boleto"}
                  </a>
                )}
              </div>

              {/* Botão confirmar (para casos onde pagamento pode ser confirmado manualmente ou sem gateway) */}
              <div className="space-y-2">
                <Button
                  onClick={() => {
                    confirmMutation.mutate({
                      code,
                      studentName: form.name,
                      studentPhone: form.phone,
                      studentEmail: form.email || undefined,
                      instrumentId: selectedInstrument!,
                      teacherUserId: slotsData?.teacher?.userId!,
                      studioRoomId: slotsData?.room?.id,
                      dateStr: selectedDate,
                      timeStr: selectedTime,
                      asaasChargeId: paymentData.chargeId,
                    });
                  }}
                  disabled={confirmMutation.isPending}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20"
                >
                  {confirmMutation.isPending
                    ? <><Loader2 size={16} className="animate-spin" /> Confirmando matrícula...</>
                    : <><BadgeCheck size={16} /> Já paguei — Confirmar Matrícula</>}
                </Button>
                <p className="text-center text-[10px] text-muted-foreground">
                  Clique somente após realizar o pagamento acima
                </p>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════
              PASSO 5 — Sucesso!
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
