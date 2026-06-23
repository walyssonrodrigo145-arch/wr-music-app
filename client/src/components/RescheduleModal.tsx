import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Calendar, Clock, MessageCircle, Bot } from "lucide-react";
import { format, addDays, isSameDay, parseISO, startOfDay, addMinutes, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Label } from "@/components/ui/label";

interface RescheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: number;
  lessonTitle: string;
}

export function RescheduleModal({ open, onOpenChange, lessonId, lessonTitle }: RescheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const utils = trpc.useContext();

  const { data: scheduleData, isLoading: isLoadingSchedule } = trpc.studentPortal.getTeacherSchedule.useQuery(
    { lessonId },
    { enabled: open }
  );

  const rescheduleMutation = trpc.studentPortal.autoReschedule.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      onOpenChange(false);
      utils.studentPortal.getDashboard.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao reagendar aula");
    }
  });

  // Calculate available days (next 14 days)
  const availableDays = useMemo(() => {
    if (!scheduleData?.schoolHours) return [];
    const days = [];
    const today = startOfDay(new Date());
    
    // Check next 14 days
    for (let i = 1; i <= 14; i++) {
      const d = addDays(today, i);
      const dayOfWeekMap: Record<number, string> = {
        0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday'
      };
      const dayName = dayOfWeekMap[d.getDay()];
      const hoursConfig = scheduleData.schoolHours[dayName];
      
      if (hoursConfig?.active) {
        days.push(d);
      }
    }
    return days;
  }, [scheduleData]);

  // Calculate available times for the selected date
  const availableTimes = useMemo(() => {
    if (!selectedDate || !scheduleData?.schoolHours) return [];
    
    const dayOfWeekMap: Record<number, string> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday'
    };
    const dayName = dayOfWeekMap[selectedDate.getDay()];
    const hoursConfig = scheduleData.schoolHours[dayName];
    
    if (!hoursConfig?.active) return [];
    
    const times = [];
    let current = new Date(selectedDate);
    const [startH, startM] = hoursConfig.start.split(':').map(Number);
    current.setHours(startH, startM, 0, 0);
    
    const end = new Date(selectedDate);
    const [endH, endM] = hoursConfig.end.split(':').map(Number);
    end.setHours(endH, endM, 0, 0);
    
    // Generate 1 hour slots
    while (isBefore(current, end)) {
      const timeStr = format(current, "HH:mm");
      // Check if slot is booked
      const isBooked = scheduleData.bookedSlots.some((isoDate: string) => {
        const booked = parseISO(isoDate);
        return isSameDay(booked, current) && format(booked, "HH:mm") === timeStr;
      });
      
      if (!isBooked) {
        times.push(timeStr);
      }
      current = addMinutes(current, 60);
    }
    
    return times;
  }, [selectedDate, scheduleData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
       toast.error("Por favor, selecione uma data e horário.");
       return;
    }
    
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const newDateObj = new Date(selectedDate);
    newDateObj.setHours(hours, minutes, 0, 0);
    
    rescheduleMutation.mutate({
      lessonId,
      newDateIso: newDateObj.toISOString(),
    });
  };

  const handleWhatsApp = () => {
    if (scheduleData?.teacherPhone) {
      const phone = scheduleData.teacherPhone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}?text=Olá, preciso de ajuda com o reagendamento da aula de ${lessonTitle}.`, '_blank');
    } else {
      toast.error("O professor não possui um número de telefone cadastrado.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] rounded-[32px] border-none shadow-2xl bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 relative">
               <Bot size={24} />
               <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse border-2 border-card"></div>
            </div>
            {scheduleData?.teacherPhone && (
              <Button variant="outline" size="sm" onClick={handleWhatsApp} className="text-xs font-bold text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 gap-2 rounded-xl">
                <MessageCircle size={14} /> Falar com Professor
              </Button>
            )}
          </div>
          <DialogTitle className="text-2xl font-black">Reagendamento Inteligente</DialogTitle>
          <DialogDescription className="font-medium text-muted-foreground/80">
            Eu sou o robô assistente. Escolha um dos horários livres na agenda para reagendar automaticamente a aula de <span className="text-foreground font-black">{lessonTitle}</span>.
          </DialogDescription>
        </DialogHeader>

        {isLoadingSchedule ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 className="animate-spin text-primary w-8 h-8" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Analisando agenda...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-primary" />
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Escolha a Nova Data</Label>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x scrollbar-hide">
                {availableDays.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic p-2">Nenhum dia disponível configurado.</p>
                ) : (
                  availableDays.map(day => (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => { setSelectedDate(day); setSelectedTime(null); }}
                      className={`shrink-0 snap-start flex flex-col items-center justify-center w-16 h-20 rounded-2xl border transition-all ${selectedDate && isSameDay(selectedDate, day) ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105' : 'bg-card border-border hover:border-primary/50 text-foreground'}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{format(day, 'EEE', { locale: ptBR })}</span>
                      <span className="text-xl font-black mt-1">{format(day, 'dd')}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {selectedDate && (
              <div className="space-y-3 animate-in slide-in-from-top-4 fade-in duration-300">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-primary" />
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Horários Disponíveis</Label>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {availableTimes.length === 0 ? (
                    <div className="col-span-4 p-4 text-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                      <p className="text-xs font-bold text-rose-600">Nenhum horário livre neste dia.</p>
                    </div>
                  ) : (
                    availableTimes.map(time => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setSelectedTime(time)}
                        className={`py-3 rounded-xl border text-sm font-black transition-all ${selectedTime === time ? 'bg-primary border-primary text-white shadow-md shadow-primary/20 scale-105' : 'bg-muted/50 border-border hover:border-primary/50 text-foreground'}`}
                      >
                        {time}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button 
                type="submit" 
                disabled={rescheduleMutation.isPending || !selectedDate || !selectedTime}
                className="w-full bg-primary text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl shadow-primary/20 disabled:opacity-50"
              >
                {rescheduleMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : null}
                {selectedTime ? `Confirmar para ${selectedTime}` : "Selecione data e hora"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
