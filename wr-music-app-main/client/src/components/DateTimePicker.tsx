import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTHS_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
];
const DAYS_PT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const HOUR_SLOTS = Array.from({ length: 14 }, (_, i) => i + 7); // 07h–20h
const MINUTE_SLOTS = [0, 15, 30, 45];

interface DateTimePickerProps {
  value?: string; // ISO string
  onChange: (iso: string) => void;
  label?: string;
  minDate?: Date;
}

export function DateTimePicker({ value, onChange, label = "Data e Hora", minDate }: DateTimePickerProps) {
  const parsed = value ? new Date(value) : null;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());
  const [selDate, setSelDate] = useState<Date | null>(parsed);
  const [selHour, setSelHour] = useState<number>(parsed?.getHours() ?? 9);
  const [selMinute, setSelMinute] = useState<number>(parsed?.getMinutes() ?? 0);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Emit whenever selection changes
  useEffect(() => {
    if (!selDate) return;
    const d = new Date(selDate);
    d.setHours(selHour, selMinute, 0, 0);
    onChange(d.toISOString());
  }, [selDate, selHour, selMinute]);

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    setSelDate(d);
  }

  function isDayDisabled(day: number) {
    if (!minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0, 0, 0, 0);
    const min = new Date(minDate);
    min.setHours(0, 0, 0, 0);
    return d < min;
  }

  const displayValue = selDate
    ? `${selDate.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} às ${String(selHour).padStart(2, "0")}:${String(selMinute).padStart(2, "0")}`
    : null;

  return (
    <div className="relative" ref={ref}>
      {label && <label className="text-xs font-semibold text-foreground block mb-1.5">{label} *</label>}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-2.5 h-10 px-3 rounded-xl border text-sm transition-all",
          "bg-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30",
          open ? "border-primary ring-2 ring-primary/20" : "border-border",
          !displayValue && "text-muted-foreground"
        )}
      >
        <Calendar size={15} className="text-primary flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {displayValue ?? "Selecionar data e hora"}
        </span>
        <Clock size={13} className="text-muted-foreground flex-shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-2 left-0 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          style={{ minWidth: 340 }}>
          <div className="flex">
            {/* ── Calendar ── */}
            <div className="flex-1 p-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={prevMonth}
                  className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-bold text-foreground">
                  {MONTHS_PT[viewMonth]} {viewYear}
                </span>
                <button onClick={nextMonth}
                  className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_PT.map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const isToday = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
                  const isSel = selDate?.getDate() === day && selDate?.getMonth() === viewMonth && selDate?.getFullYear() === viewYear;
                  const disabled = isDayDisabled(day);
                  return (
                    <button
                      key={day}
                      disabled={disabled}
                      onClick={() => selectDay(day)}
                      className={cn(
                        "w-full aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all",
                        disabled && "opacity-30 cursor-not-allowed",
                        !disabled && !isSel && "hover:bg-primary/10 hover:text-primary",
                        isToday && !isSel && "text-primary font-bold ring-1 ring-primary/40",
                        isSel && "bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/30"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Quick shortcuts */}
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-border">
                <button onClick={() => { const t = new Date(); setSelDate(t); setViewMonth(t.getMonth()); setViewYear(t.getFullYear()); }}
                  className="flex-1 text-[10px] font-semibold text-primary hover:bg-primary/10 rounded-lg py-1.5 transition-colors">
                  Hoje
                </button>
                <button onClick={() => { const t = new Date(); t.setDate(t.getDate() + 1); setSelDate(t); setViewMonth(t.getMonth()); setViewYear(t.getFullYear()); }}
                  className="flex-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted rounded-lg py-1.5 transition-colors">
                  Amanhã
                </button>
                <button onClick={() => { const t = new Date(); t.setDate(t.getDate() + 7); setSelDate(t); setViewMonth(t.getMonth()); setViewYear(t.getFullYear()); }}
                  className="flex-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted rounded-lg py-1.5 transition-colors">
                  +1 semana
                </button>
              </div>
            </div>

            {/* ── Time Picker ── */}
            <div className="w-28 border-l border-border flex flex-col">
              <div className="px-3 py-3 border-b border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horário</p>
                <p className="text-lg font-bold text-primary mt-0.5 tabular-nums">
                  {String(selHour).padStart(2, "0")}:{String(selMinute).padStart(2, "0")}
                </p>
              </div>

              {/* Hours */}
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5 max-h-[220px]">
                {HOUR_SLOTS.map(h => (
                  <div key={h} className="space-y-0.5">
                    {MINUTE_SLOTS.map(m => {
                      const isSel = selHour === h && selMinute === m;
                      return (
                        <button
                          key={`${h}:${m}`}
                          onClick={() => { setSelHour(h); setSelMinute(m); }}
                          className={cn(
                            "w-full text-center text-xs font-medium rounded-lg py-1 transition-all",
                            isSel
                              ? "bg-primary text-primary-foreground font-bold shadow-sm"
                              : "text-foreground hover:bg-primary/10 hover:text-primary"
                          )}
                        >
                          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          {selDate && (
            <div className="px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                Confirmar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
