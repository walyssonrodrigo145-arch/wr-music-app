import { Search, Music, Filter, X, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";

interface LessonsFilterProps {
  onSearch: (q: string) => void;
  onFilterChange: (filters: { instrumentId?: number; status?: string }) => void;
}

export default function LessonsFilter({ onSearch, onFilterChange }: LessonsFilterProps) {
  const { data: instruments = [] } = trpc.instruments.list.useQuery();
  const [search, setSearch] = useState("");
  const [selectedInstrument, setSelectedInstrument] = useState<number | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    onSearch(search);
  }, [search]);

  useEffect(() => {
    onFilterChange({ instrumentId: selectedInstrument, status: selectedStatus });
  }, [selectedInstrument, selectedStatus]);

  const statusOptions = [
    { value: 'agendada', label: 'Agendada', color: 'bg-blue-500' },
    { value: 'concluida', label: 'Concluída', color: 'bg-emerald-500' },
    { value: 'cancelada', label: 'Cancelada', color: 'bg-rose-500' },
    { value: 'remarcada', label: 'Remarcada', color: 'bg-violet-500' },
    { value: 'falta', label: 'Falta', color: 'bg-amber-500' },
  ];

  const { isDesktop } = useBreakpoint();
  const activeFiltersCount = (selectedInstrument ? 1 : 0) + (selectedStatus ? 1 : 0);

  const FilterLayout = () => (
    <div className="flex flex-wrap gap-6">
       {/* Instruments */}
       <div className="flex-1 min-w-[200px]">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-4 ml-2 italic">Instrumento</h4>
          <div className="flex flex-wrap gap-2">
             <button
               onClick={() => setSelectedInstrument(undefined)}
               className={cn(
                 "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                 selectedInstrument === undefined ? "bg-foreground text-background border-foreground" : "bg-background border-border/40 hover:border-primary/40"
               )}
             >
               Todos
             </button>
             {instruments.map((inst: any) => (
               <button
                 key={inst.id}
                 onClick={() => setSelectedInstrument(inst.id)}
                 className={cn(
                   "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                   selectedInstrument === inst.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/40 hover:border-primary/20"
                 )}
               >
                 <div className="w-1.5 h-1.5 rounded-full" style={{ background: inst.color || '#3b82f6' }} />
                 {inst.name}
               </button>
             ))}
          </div>
       </div>

       {/* Status */}
       <div className="flex-1 min-w-[200px]">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-4 ml-2 italic">Status</h4>
          <div className="flex flex-wrap gap-2">
             <button
               onClick={() => setSelectedStatus(undefined)}
               className={cn(
                 "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                 selectedStatus === undefined ? "bg-foreground text-background border-foreground" : "bg-background border-border/40"
               )}
             >
               Geral
             </button>
             {statusOptions.map((opt) => (
               <button
                 key={opt.value}
                 onClick={() => setSelectedStatus(opt.value)}
                 className={cn(
                   "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2",
                   selectedStatus === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/40"
                 )}
               >
                 <div className={cn("w-1.5 h-1.5 rounded-full", opt.color)} />
                 {opt.label}
               </button>
             ))}
          </div>
       </div>
    </div>
  );

  return (
    <div className="space-y-6 mb-10">
      <div className="flex flex-col md:flex-row gap-4 items-center">
        {/* ── Search Bar ── */}
        <div className="relative flex-1 w-full group">
          <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within:text-primary transition-colors">
            <Search size={22} strokeWidth={2.5} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="BUSCAR ALUNO..."
            className="w-full h-16 pl-16 pr-6 bg-card border border-border/40 rounded-3xl text-sm font-bold tracking-tight placeholder:text-muted-foreground/20 placeholder:font-black focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-xl shadow-primary/[0.02]"
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-2 hover:bg-muted rounded-full text-muted-foreground transition-all"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* ── Mobile Filter Trigger ── */}
        {!isDesktop && (
          <Drawer>
            <DrawerTrigger asChild>
              <button 
                className={cn(
                  "h-16 px-8 rounded-3xl border border-border/40 font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-3 transition-all relative shrink-0",
                  activeFiltersCount > 0 ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground/60"
                )}
              >
                <Filter size={18} />
                <span>Filtros</span>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="absolute -top-2 -right-2 px-2 py-0.5 rounded-lg border-2 border-background">
                    {activeFiltersCount}
                  </Badge>
                )}
              </button>
            </DrawerTrigger>
            <DrawerContent className="p-8">
              <DrawerHeader>
                <DrawerTitle className="text-2xl font-black uppercase tracking-tighter">Filtrar Aulas</DrawerTitle>
              </DrawerHeader>
              <div className="mt-6">
                <FilterLayout />
              </div>
              <div className="mt-10 mb-4">
                 <button 
                   onClick={() => { setSelectedInstrument(undefined); setSelectedStatus(undefined); }}
                   className="w-full h-14 rounded-2xl border border-dashed border-border/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 hover:text-rose-500 hover:border-rose-500/40 transition-all"
                 >
                   Limpar Todos os Filtros
                 </button>
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>

      {/* ── Desktop Exposed Filters ── */}
      {isDesktop && (
        <div className="p-6 bg-muted/10 border border-border/20 rounded-3xl backdrop-blur-xl">
           <FilterLayout />
        </div>
      )}
    </div>
  );
}
