import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, CalendarDays } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import LessonCard from "@/components/LessonCard";
import { Button } from "@/components/ui/button";

interface Lesson {
  id: number;
  title: string;
  scheduledAt: string;
  duration: number;
  status: "agendada" | "concluida" | "cancelada" | "remarcada" | "falta";
  studentName?: string | null;
  instrumentName?: string | null;
  instrumentColor?: string | null;
  instrumentIcon?: string | null;
  description?: string | null;
  notes?: string | null;
}

interface DayLessonsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: Date;
  lessons: Lesson[];
  onStatusChange: (id: number, status: string) => void;
  onOpenDetail: (lesson: Lesson) => void;
  onAddLesson: (day: Date) => void;
}

export default function DayLessonsModal({
  open,
  onOpenChange,
  day,
  lessons,
  onStatusChange,
  onOpenDetail,
  onAddLesson
}: DayLessonsModalProps) {
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Aulas de ${format(day, "dd 'de' MMMM", { locale: ptBR })}`}
      description={`${lessons.length} aulas agendadas para este dia`}
    >
      <div className="space-y-6">
        {/* Quick Add Button */}
        <Button 
          onClick={() => {
            onOpenChange(false);
            onAddLesson(day);
          }}
          className="w-full h-12 rounded-2xl gap-2 font-bold uppercase tracking-wider text-[10px]"
          variant="outline"
        >
          <Plus size={16} />
          Agendar Aula para este dia
        </Button>

        {/* Lessons List */}
        <div className="space-y-3">
          {lessons.length > 0 ? (
            lessons.map((l) => (
              <LessonCard 
                key={l.id} 
                lesson={l} 
                onStatusChange={onStatusChange} 
                onClick={() => onOpenDetail(l)} 
              />
            ))
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-center bg-muted/5 rounded-[2rem] border border-dashed border-border/20">
              <CalendarDays size={40} className="mb-3 text-muted-foreground/10" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/20 italic">
                Nenhuma aula para este dia
              </p>
            </div>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
