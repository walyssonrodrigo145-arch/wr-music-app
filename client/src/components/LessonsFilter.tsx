import { Search, Music, Filter, X, ChevronDown, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";

interface LessonsFilterProps {
  onSearch: (q: string) => void;
  onFilterChange: (filters: { instrumentId?: number; status?: string }) => void;
  onBulkDelete?: () => void;
}

export default function LessonsFilter({ onSearch, onFilterChange, onBulkDelete }: LessonsFilterProps) {
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
    <div className="space-y-6 mb-10 w-full">
      <div className="flex flex-row gap-2 items-center w-full px-1">
        {/* ── Search Bar ── */}
        <div className="relative flex-1 group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground/30 group-focus-within:text-primary transition-colors">
            <Search size={20} strokeWidth={2.5} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="BUSCAR..."
            className="w-full h-14 pl-14 pr-4 bg-card border border-border/40 rounded-2xl text-xs font-bold tracking-tight placeholder:text-muted-foreground/20 placeholder:font-black focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-lg shadow-primary/[0.01]"
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-full text-muted-foreground transition-all"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Mobile Filter Trigger ── */}
        {!isDesktop && (
          <div className="flex items-center gap-2">
            <Drawer>
              <DrawerTrigger asChild>
                <button 
                  className={cn(
                    "h-14 w-14 rounded-2xl border border-border/40 flex items-center justify-center transition-all relative shrink-0 shadow-lg shadow-primary/[0.01]",
                    activeFiltersCount > 0 ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground/40"
                  )}
                  title="Filtros"
                >
                  <Filter size={20} />
                  {activeFiltersCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-rose-500 text-[10px] font-black text-white rounded-full border-2 border-background">
                      {activeFiltersCount}
                    </div>
                  )}
                </button>
              </DrawerTrigger>
              <DrawerContent className="p-8 pb-12 rounded-t-[2.5rem]">
                <DrawerHeader className="px-0">
                  <DrawerTitle className="text-3xl font-black uppercase tracking-tighter text-foreground">Ajustar Filtros</DrawerTitle>
                </DrawerHeader>
                <div className="mt-8">
                  <FilterLayout />
                </div>
                <div className="mt-12">
                   <button 
                     onClick={() => { setSelectedInstrument(undefined); setSelectedStatus(undefined); }}
                     className="w-full h-14 rounded-[1.5rem] bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-500/20"
                   >
                     Limpar Filtros
                   </button>
                </div>
              </DrawerContent>
            </Drawer>

            {onBulkDelete && (
              <button 
                onClick={onBulkDelete}
                className="h-14 w-14 rounded-2xl border border-destructive/20 text-destructive flex items-center justify-center transition-all bg-card hover:bg-destructive/5 active:scale-95 shadow-lg shadow-destructive/[0.01]"
                title="Limpar agendamentos"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
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
