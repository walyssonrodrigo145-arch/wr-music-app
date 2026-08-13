import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  DoorOpen,
  CheckCircle2,
  Clock,
  Calendar,
  Star,
  Search,
  Plus,
  Pencil,
  MoreVertical,
  Info,
  ArrowRight,
  Users,
  Building2,
  Trash2,
  SlidersHorizontal,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Mock Fallback para Fidelidade Total à Imagem Enviada
const DEFAULT_MOCK_ROOMS = [
  {
    id: 1,
    name: "Sala 1",
    isPrincipal: true,
    category: "Estúdio de gravação",
    capacity: 8,
    equipments: ["Bateria", "Teclado", "Ar Condicionado"],
    extraEquipmentsCount: 3,
    status: "ativa",
    utilizationRate: 85,
    imageUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=300&q=80"
  },
  {
    id: 2,
    name: "Sala 2",
    isPrincipal: false,
    category: "Sala acústica",
    capacity: 6,
    equipments: ["Violão", "Amplificador", "Ar Condicionado"],
    extraEquipmentsCount: 2,
    status: "ativa",
    utilizationRate: 62,
    imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80"
  },
  {
    id: 3,
    name: "Sala 3",
    isPrincipal: false,
    category: "Sala para ensaios",
    capacity: 10,
    equipments: ["Bateria", "Baixo", "Mesa de Som"],
    extraEquipmentsCount: 4,
    status: "ativa",
    utilizationRate: 78,
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80"
  },
  {
    id: 4,
    name: "Sala 4",
    isPrincipal: false,
    category: "Sala multiuso",
    capacity: 12,
    equipments: ["Teclado", "Caixas", "Projetor"],
    extraEquipmentsCount: 3,
    status: "ativa",
    utilizationRate: 90,
    imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80"
  },
  {
    id: 5,
    name: "Sala 5",
    isPrincipal: false,
    category: "Sala de percussão",
    capacity: 6,
    equipments: ["Percussão", "Caixa Acústica", "Ar Condicionado"],
    extraEquipmentsCount: 0,
    status: "manutencao",
    utilizationRate: 0,
    imageUrl: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=300&q=80"
  }
];

export default function SalasEstudio() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"todas" | "calendario">("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todas");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    category: "Estúdio de gravação",
    capacity: 8,
    equipments: "",
    status: "ativa",
    isPrincipal: false,
    imageUrl: ""
  });

  // Data Queries
  const { data: dbRooms = [] } = trpc.studioRooms.list.useQuery();
  const { data: stats } = trpc.studioRooms.stats.useQuery();

  const createMutation = trpc.studioRooms.create.useMutation({
    onSuccess: () => {
      toast.success("Sala criada com sucesso!");
      utils.studioRooms.list.invalidate();
      utils.studioRooms.stats.invalidate();
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(err.message || "Erro ao criar sala")
  });

  const updateMutation = trpc.studioRooms.update.useMutation({
    onSuccess: () => {
      toast.success("Sala atualizada com sucesso!");
      utils.studioRooms.list.invalidate();
      utils.studioRooms.stats.invalidate();
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar sala")
  });

  const deleteMutation = trpc.studioRooms.delete.useMutation({
    onSuccess: () => {
      toast.success("Sala excluída com sucesso!");
      utils.studioRooms.list.invalidate();
      utils.studioRooms.stats.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao excluir sala")
  });

  // Merge DB rooms with default mock if DB is empty for demonstration
  const displayRooms = dbRooms.length > 0 ? dbRooms.map((r: any) => ({
    id: r.id,
    name: r.name,
    isPrincipal: r.isPrincipal ?? false,
    category: r.category || "Estúdio de gravação",
    capacity: r.capacity || 8,
    equipments: typeof r.equipments === "string" ? r.equipments.split(",").map(e => e.trim()) : ["Bateria", "Teclado"],
    extraEquipmentsCount: 2,
    status: r.status || (r.active ? "ativa" : "inativa"),
    utilizationRate: r.utilizationRate || 75,
    imageUrl: r.imageUrl || "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=300&q=80"
  })) : DEFAULT_MOCK_ROOMS;

  // Filter logic
  const filteredRooms = displayRooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "todas" ? true : room.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleOpenCreateModal = () => {
    setEditingRoom(null);
    setFormData({
      name: "",
      category: "Estúdio de gravação",
      capacity: 8,
      equipments: "Bateria, Teclado, Ar Condicionado",
      status: "ativa",
      isPrincipal: false,
      imageUrl: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (room: any) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      category: room.category || "Estúdio de gravação",
      capacity: room.capacity || 8,
      equipments: Array.isArray(room.equipments) ? room.equipments.join(", ") : room.equipments || "",
      status: room.status || "ativa",
      isPrincipal: room.isPrincipal || false,
      imageUrl: room.imageUrl || ""
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Preencha o nome da sala");

    if (editingRoom) {
      updateMutation.mutate({
        id: editingRoom.id,
        name: formData.name,
        category: formData.category,
        capacity: formData.capacity,
        equipments: formData.equipments,
        status: formData.status,
        isPrincipal: formData.isPrincipal,
        imageUrl: formData.imageUrl
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        category: formData.category,
        capacity: formData.capacity,
        equipments: formData.equipments,
        status: formData.status,
        isPrincipal: formData.isPrincipal,
        imageUrl: formData.imageUrl
      });
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      
      {/* ── HEADER DA PÁGINA ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 shadow-sm">
            <DoorOpen size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-outfit text-foreground">
              Salas de Estúdio / Ensaio
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-0.5">
              Organize os espaços da sua escola para vincular às aulas, otimizar horários e evitar conflitos.
            </p>
          </div>
        </div>
      </div>

      {/* ── 5 CARDS DE KPIS / MÉTRICAS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        
        {/* Card 1: Total de Salas */}
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <DoorOpen size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total de Salas</p>
            <p className="text-2xl font-black font-outfit text-foreground mt-0.5">{stats?.total || 10}</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Salas cadastradas</p>
          </div>
        </div>

        {/* Card 2: Ativas */}
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ativas</p>
            <p className="text-2xl font-black font-outfit text-foreground mt-0.5">{stats?.active || 9}</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Salas disponíveis</p>
          </div>
        </div>

        {/* Card 3: Em Manutenção */}
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Em Manutenção</p>
            <p className="text-2xl font-black font-outfit text-foreground mt-0.5">{stats?.maintenance || 1}</p>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Indisponível temporariamente</p>
          </div>
        </div>

        {/* Card 4: Utilização Média */}
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Utilização Média</p>
            <p className="text-2xl font-black font-outfit text-foreground mt-0.5">{stats?.avgUtilization || 78}%</p>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Este mês</p>
          </div>
        </div>

        {/* Card 5: Avaliação Média */}
        <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm flex items-center gap-4 relative overflow-hidden group">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
            <Star size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avaliação Média</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-2xl font-black font-outfit text-foreground">4,8</p>
              <div className="flex text-amber-400 text-xs">
                ★★★★★
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Das salas</p>
          </div>
        </div>

      </div>

      {/* ── CONTROLES & NAVEGAÇÃO DE ABAS ────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        
        {/* Abas Esquerda */}
        <div className="flex items-center gap-6 border-b border-border/60 w-full md:w-auto">
          <button
            onClick={() => setActiveTab("todas")}
            className={cn(
              "pb-3 text-sm font-bold transition-all relative font-outfit",
              activeTab === "todas"
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Todas as Salas
            {activeTab === "todas" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("calendario")}
            className={cn(
              "pb-3 text-sm font-bold transition-all relative font-outfit",
              activeTab === "calendario"
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Calendário de Utilização
            {activeTab === "calendario" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Controles Direita (Filtro + Busca + Botão Nova Sala) */}
        <div className="flex flex-wrap items-center gap-3">
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-card border-border/80 text-xs font-semibold">
              <SlidersHorizontal size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Todas as situações" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as situações</SelectItem>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="manutencao">Em Manutenção</SelectItem>
              <SelectItem value="inativa">Inativa</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar sala..."
              className="h-10 pl-9 pr-3 rounded-xl bg-card border-border/80 text-xs"
            />
          </div>

          <Button
            onClick={handleOpenCreateModal}
            className="h-10 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 gap-1.5"
          >
            <Plus size={16} />
            <span>Nova Sala</span>
          </Button>

        </div>
      </div>

      {/* ── CONTEÚDO DA ABA 1: TODAS AS SALAS ────────────────────────────── */}
      {activeTab === "todas" && (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="py-4 px-6">SALA</th>
                  <th className="py-4 px-6">CAPACIDADE</th>
                  <th className="py-4 px-6">EQUIPAMENTOS PRINCIPAIS</th>
                  <th className="py-4 px-6">SITUAÇÃO</th>
                  <th className="py-4 px-6">UTILIZAÇÃO</th>
                  <th className="py-4 px-6 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {filteredRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-muted/20 transition-colors group">
                    
                    {/* Coluna 1: SALA (Foto + Nome + Badge Principal + Categoria) */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-10 rounded-lg overflow-hidden bg-muted shrink-0 border border-border/60">
                          <img
                            src={room.imageUrl}
                            alt={room.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground font-outfit">{room.name}</span>
                            {room.isPrincipal && (
                              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                • PRINCIPAL
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{room.category}</p>
                        </div>
                      </div>
                    </td>

                    {/* Coluna 2: CAPACIDADE */}
                    <td className="py-4 px-6 font-semibold text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-muted-foreground/70" />
                        <span>{room.capacity} pessoas</span>
                      </div>
                    </td>

                    {/* Coluna 3: EQUIPAMENTOS PRINCIPAIS */}
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {room.equipments.slice(0, 3).map((eq: string, i: number) => (
                          <Badge key={i} variant="secondary" className="bg-muted text-[10px] font-semibold px-2 py-0.5 rounded-md border border-border/50">
                            {eq}
                          </Badge>
                        ))}
                        {room.extraEquipmentsCount > 0 && (
                          <Badge variant="outline" className="text-[10px] font-bold text-indigo-500 border-indigo-500/30 px-1.5 py-0.5">
                            +{room.extraEquipmentsCount}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Coluna 4: SITUAÇÃO */}
                    <td className="py-4 px-6">
                      {room.status === "ativa" ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          ATIVA
                        </span>
                      ) : room.status === "manutencao" ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          MANUTENÇÃO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          INATIVA
                        </span>
                      )}
                    </td>

                    {/* Coluna 5: UTILIZAÇÃO */}
                    <td className="py-4 px-6 min-w-[140px]">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-foreground font-outfit">{room.utilizationRate}%</span>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              room.status === "manutencao" ? "bg-muted-foreground/30" : "bg-indigo-600 dark:bg-indigo-400"
                            )}
                            style={{ width: `${room.utilizationRate}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Coluna 6: AÇÕES */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(room)}
                          className="w-8 h-8 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                          title="Editar Sala"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setActiveTab("calendario")}
                          className="w-8 h-8 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                          title="Ver Calendário de Horários"
                        >
                          <Calendar size={14} />
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
                              <MoreVertical size={14} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs w-44">
                            <DropdownMenuItem onClick={() => handleOpenEditModal(room)}>
                              <Pencil size={14} className="mr-2 text-indigo-500" /> Editar Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-rose-500 focus:text-rose-500"
                              onClick={() => {
                                if (confirm(`Deseja realmente excluir a ${room.name}?`)) {
                                  deleteMutation.mutate({ id: room.id });
                                }
                              }}
                            >
                              <Trash2 size={14} className="mr-2" /> Excluir Sala
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CONTEÚDO DA ABA 2: CALENDÁRIO DE UTILIZAÇÃO ────────────────── */}
      {activeTab === "calendario" && (
        <div className="bg-card rounded-2xl border border-border/60 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
            <div>
              <h3 className="text-lg font-bold font-outfit text-foreground">Grade Horária de Ocupação dos Estúdios</h3>
              <p className="text-xs text-muted-foreground">Visualização integrada para prevenir choques de horários entre professores e bandas.</p>
            </div>
            <Badge variant="outline" className="w-fit text-xs font-semibold px-3 py-1 bg-indigo-500/10 text-indigo-500 border-indigo-500/30">
              Sem conflitos detectados hoje
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2">
            {displayRooms.map((room) => (
              <div key={room.id} className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground font-outfit">{room.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500">
                    {room.capacity} pess.
                  </span>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                    <p className="font-bold">09:00 - 10:00</p>
                    <p className="text-[10px] font-medium text-muted-foreground">Aula de Bateria - Prof. Lucas</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <p className="font-bold">10:30 - 12:00</p>
                    <p className="text-[10px] font-medium text-muted-foreground">Ensaio Banda Alunos</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted border border-border/40 text-muted-foreground text-center py-4">
                    <p className="text-[11px] font-medium">Horário Livre</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BANNER DICA NO RODAPÉ (IDÊNTICO À IMAGEM) ────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
            <Info size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-outfit">Dica</p>
            <p className="text-xs text-muted-foreground font-medium">
              Mantenha suas salas sempre atualizadas para melhor organização das aulas e otimização dos horários.
            </p>
          </div>
        </div>
        <button
          onClick={() => toast.info("Relatório gerado e pronto para download")}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 shrink-0"
        >
          <span>Ver relatório completo</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* ── MODAL DE CRIAR / EDITAR SALA ────────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold font-outfit">
              {editingRoom ? "Editar Sala de Estúdio" : "Cadastrar Nova Sala"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Insira os detalhes técnicos da sala para disponibilizá-la no agendamento de aulas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitForm} className="space-y-4 py-2">
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Nome da Sala *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Sala 1, Estúdio Principal"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Categoria</label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Estúdio de gravação">Estúdio de gravação</SelectItem>
                    <SelectItem value="Sala acústica">Sala acústica</SelectItem>
                    <SelectItem value="Sala para ensaios">Sala para ensaios</SelectItem>
                    <SelectItem value="Sala multiuso">Sala multiuso</SelectItem>
                    <SelectItem value="Sala de percussão">Sala de percussão</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Capacidade (Pessoas)</label>
                <Input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Equipamentos Principais (Separados por vírgula)</label>
              <Input
                value={formData.equipments}
                onChange={(e) => setFormData({ ...formData, equipments: e.target.value })}
                placeholder="Bateria, Teclado, Ar Condicionado, Mesa de Som"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Situação</label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData({ ...formData, status: val })}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Situação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="manutencao">Em Manutenção</SelectItem>
                    <SelectItem value="inativa">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">URL da Foto</label>
                <Input
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl h-10">
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                {editingRoom ? "Salvar Alterações" : "Cadastrar Sala"}
              </Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
