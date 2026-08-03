import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Music, Calendar, Clock, CheckCircle2, User, Phone, Mail, Sparkles, Loader2, DollarSign, Building } from "lucide-react";

export default function PublicEnrollment() {
  const params = useParams<{ code: string }>();
  const code = params.code || "";

  const [selectedInstrument, setSelectedInstrument] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Busca os detalhes da escola e do link
  const { data: details, isLoading: detailsLoading, error: detailsError } = trpc.enrollment.getPublicDetails.useQuery(
    { code },
    { enabled: Boolean(code) }
  );

  // Busca os horários livres com base no instrumento e na data
  const { data: slotsData, isLoading: slotsLoading } = trpc.enrollment.getAvailableSlots.useQuery(
    {
      code,
      instrumentId: selectedInstrument!,
      dateStr: selectedDate,
    },
    { enabled: Boolean(code && selectedInstrument && selectedDate) }
  );

  const submitMutation = trpc.enrollment.submitEnrollment.useMutation({
    onSuccess: (data) => {
      toast.success("🎉 Matrícula realizada com sucesso!");
    },
    onError: (e) => toast.error("Erro na matrícula: " + e.message),
  });

  const handleNextDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
      days.push({ dateStr, label });
    }
    return days;
  }, []);

  if (detailsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (detailsError || !details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
        <Card className="max-w-md w-full p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <Sparkles size={32} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Link de Matrícula Inválido</h2>
          <p className="text-xs text-muted-foreground">Este link expirou ou já foi utilizado para realizar uma matrícula.</p>
        </Card>
      </div>
    );
  }

  const isCompleted = submitMutation.isSuccess;

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header da Escola */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center mx-auto shadow-md">
            <Music size={32} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{details.schoolName}</h1>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Escolha seu curso e o melhor horário para suas aulas</p>
        </div>

        {isCompleted ? (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="p-8 text-center space-y-6 bg-card border-emerald-500/30 shadow-2xl">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 size={48} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-foreground">Matrícula Concluída!</h2>
                <p className="text-xs text-muted-foreground">Sua aula foi agendada e seu cadastro foi registrado com sucesso na escola.</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/40 text-left text-xs space-y-2 font-medium">
                <p>📍 <strong>Escola:</strong> {details.schoolName}</p>
                <p>📅 <strong>Data & Hora:</strong> {selectedDate} às {selectedTime}</p>
              </div>
            </Card>
          </motion.div>
        ) : (
          <Card className="p-6 sm:p-8 space-y-8 bg-card border-border shadow-xl rounded-3xl">
            
            {/* Passo 1: Escolha do Instrumento / Curso */}
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Music size={16} className="text-indigo-500" /> 1. Selecione o Curso / Instrumento
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {details.instruments.map((inst: any) => {
                  const isSelected = selectedInstrument === inst.id;
                  return (
                    <button
                      key={inst.id}
                      onClick={() => {
                        setSelectedInstrument(inst.id);
                        setSelectedTime("");
                      }}
                      className={`p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between h-24 ${
                        isSelected
                          ? "border-indigo-600 bg-indigo-600/10 text-indigo-600 shadow-md font-bold"
                          : "border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground"
                      }`}
                    >
                      <Music size={20} className={isSelected ? "text-indigo-600" : "text-muted-foreground"} />
                      <span className="text-xs font-bold truncate">{inst.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Passo 2: Seleção da Data e Horário */}
            {selectedInstrument && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-500" /> 2. Escolha o Dia da Sua Aula
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {handleNextDays.map((day) => {
                    const isSelected = selectedDate === day.dateStr;
                    return (
                      <button
                        key={day.dateStr}
                        onClick={() => {
                          setSelectedDate(day.dateStr);
                          setSelectedTime("");
                        }}
                        className={`px-4 py-3 rounded-xl border text-center shrink-0 min-w-[90px] transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-600 text-white font-bold shadow-md"
                            : "border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground"
                        }`}
                      >
                        <span className="text-[10px] uppercase font-bold block opacity-80">{day.label.split(",")[0]}</span>
                        <span className="text-xs font-black">{day.label.split(",")[1]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Passo 3: Horários Disponíveis */}
            {selectedDate && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock size={16} className="text-indigo-500" /> 3. Escolha o Horário Disponível
                </label>

                {slotsLoading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-2">
                    <Loader2 size={16} className="animate-spin" /> Buscando horários das salas e professores...
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slotsData?.slots.map((slot: any) => {
                      const isSelected = selectedTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          disabled={!slot.available}
                          onClick={() => setSelectedTime(slot.time)}
                          className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                            !slot.available
                              ? "opacity-30 border-border bg-muted/10 line-through cursor-not-allowed"
                              : isSelected
                              ? "border-emerald-500 bg-emerald-500 text-white shadow-md"
                              : "border-border/60 bg-card hover:border-emerald-500/50"
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Passo 4: Dados Pessoais do Aluno */}
            {selectedTime && (
              <div className="space-y-4 pt-4 border-t border-border/60 animate-in fade-in duration-300">
                <label className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <User size={16} className="text-indigo-500" /> 4. Seus Dados Pessoais
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Nome Completo</Label>
                    <Input
                      placeholder="Seu nome"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">WhatsApp / Telefone</Label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (!form.name.trim() || !form.phone.trim()) {
                      return toast.error("Preencha seu Nome e Telefone.");
                    }
                    submitMutation.mutate({
                      code,
                      studentName: form.name.trim(),
                      studentPhone: form.phone.trim(),
                      studentEmail: form.email.trim() || undefined,
                      instrumentId: selectedInstrument!,
                      teacherUserId: slotsData?.teacher?.userId!,
                      studioRoomId: slotsData?.room?.id,
                      dateStr: selectedDate,
                      timeStr: selectedTime,
                    });
                  }}
                  disabled={submitMutation.isPending}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 text-white font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 text-xs mt-4"
                >
                  {submitMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : "Confirmar Matrícula & Reservar Horário"}
                </Button>
              </div>
            )}

          </Card>
        )}

      </div>
    </div>
  );
}
