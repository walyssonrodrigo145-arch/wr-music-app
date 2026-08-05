import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Plus, Trash2, Edit3, Loader2, DoorOpen, Sparkles, 
  X, Check, Radio, Layers, Palette, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PRESET_COLORS = [
  { name: "Índigo", value: "#6366f1" },
  { name: "Esmeralda", value: "#10b981" },
  { name: "Púrpura", value: "#8b5cf6" },
  { name: "Rosa", value: "#ec4899" },
  { name: "Âmbar", value: "#f59e0b" },
  { name: "Azul Céu", value: "#06b6d4" },
  { name: "Carmesim", value: "#ef4444" },
  { name: "Grafite", value: "#64748b" },
];

export function SalasEstudioTab() {
  const utils = trpc.useUtils();
  const { data: rooms = [], isLoading } = trpc.studioRooms.list.useQuery();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<{ id: number; name: string; description: string; color: string } | null>(null);
  const [form, setForm] = useState({ name: "", description: "", color: "#6366f1" });

  const createMutation = trpc.studioRooms.create.useMutation({
    onSuccess: () => {
      toast.success("Sala cadastrada com sucesso!");
      utils.studioRooms.list.invalidate();
      closeModal();
    },
    onError: (err) => toast.error("Erro ao cadastrar sala: " + err.message),
  });

  const updateMutation = trpc.studioRooms.update.useMutation({
    onSuccess: () => {
      toast.success("Sala atualizada com sucesso!");
      utils.studioRooms.list.invalidate();
      closeModal();
    },
    onError: (err) => toast.error("Erro ao atualizar sala: " + err.message),
  });

  const deleteMutation = trpc.studioRooms.delete.useMutation({
    onSuccess: () => {
      toast.success("Sala removida com sucesso!");
      utils.studioRooms.list.invalidate();
    },
    onError: (err) => toast.error("Erro ao remover sala: " + err.message),
  });

  const openCreateModal = () => {
    setEditingRoom(null);
    setForm({ name: "", description: "", color: "#6366f1" });
    setIsModalOpen(true);
  };

  const openEditModal = (room: any) => {
    setEditingRoom(room);
    setForm({ name: room.name, description: room.description || "", color: room.color || "#6366f1" });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    setForm({ name: "", description: "", color: "#6366f1" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome da sala");
      return;
    }

    if (editingRoom) {
      updateMutation.mutate({
        id: editingRoom.id,
        name: form.name,
        description: form.description,
        color: form.color,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        description: form.description,
        color: form.color,
      });
    }
  };

  const handleToggleActive = (room: any) => {
    updateMutation.mutate({
      id: room.id,
      active: !room.active,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Carregando salas...</p>
      </div>
    );
  }

  const activeRoomsCount = rooms.filter((r) => r.active).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Topo Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-background border border-indigo-500/20 p-6 md:p-8 backdrop-blur-xl shadow-2xl shadow-indigo-500/5">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={14} />
              <span>Espaços Físicos & Estúdios</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-foreground font-outfit tracking-tight">
              Salas de Estúdio / Ensaio
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Organize os espaços da sua escola para vincular às aulas, otimizar horários e evitar conflitos de salas no agendamento.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end px-4 py-2 rounded-2xl bg-card/50 border border-white/5 backdrop-blur-md">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total de Salas</span>
              <span className="text-lg font-black text-foreground font-outfit">{rooms.length} ({activeRoomsCount} ativas)</span>
            </div>

            <Button
              onClick={openCreateModal}
              className="h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98] gap-2.5"
            >
              <Plus size={18} />
              <span>Nova Sala</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Grade de Salas ou State Vazio */}
      {rooms.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-border/60 rounded-3xl bg-card/20 backdrop-blur-sm space-y-4 max-w-lg mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20 shadow-inner">
            <DoorOpen size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground font-outfit">Nenhuma sala cadastrada ainda</h3>
            <p className="text-xs text-muted-foreground">
              Cadastre salas para atribuir às aulas, ensaios e práticas instrumentais da sua escola.
            </p>
          </div>
          <Button onClick={openCreateModal} className="rounded-2xl font-bold gap-2 px-6">
            <Plus size={16} /> Cadastrar Primeira Sala
          </Button>
        </div>
      ) : (
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.08 } }
          }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {rooms.map((room) => (
            <motion.div
              key={room.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              className={`group relative overflow-hidden rounded-3xl p-6 border backdrop-blur-xl transition-all duration-300 flex flex-col justify-between ${
                room.active 
                  ? "bg-card/40 border-border/80 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5" 
                  : "bg-muted/20 border-border/40 opacity-60"
              }`}
            >
              {/* Faixa decorativa superior com a cor da sala */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5 opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: room.color || "#6366f1" }}
              />

              <div className="space-y-4">
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="flex items-center gap-3.5">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-md shadow-black/20 shrink-0 border border-white/20"
                      style={{ backgroundColor: room.color || "#6366f1" }}
                    >
                      <DoorOpen size={22} />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-base group-hover:text-primary transition-colors font-outfit line-clamp-1">
                        {room.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          room.active 
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                            : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${room.active ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
                          {room.active ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-primary/10"
                      onClick={() => openEditModal(room)}
                      title="Editar Sala"
                    >
                      <Edit3 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja excluir a sala "${room.name}"?`)) {
                          deleteMutation.mutate({ id: room.id });
                        }
                      }}
                      title="Excluir Sala"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {/* Descrição */}
                <p className="text-xs text-muted-foreground min-h-[2.5rem] line-clamp-2 leading-relaxed">
                  {room.description || "Sem descrição cadastrada para esta sala."}
                </p>
              </div>

              {/* Rodapé do Card */}
              <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Palette size={12} style={{ color: room.color || "#6366f1" }} />
                  <span className="font-mono text-[10px]">{room.color || "#6366f1"}</span>
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    {room.active ? "Disponível" : "Desativada"}
                  </span>
                  <Switch
                    checked={room.active}
                    onCheckedChange={() => handleToggleActive(room)}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal de Criação / Edição Premium com Glassmorphism */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg rounded-3xl border border-white/10 bg-card/95 backdrop-blur-2xl shadow-2xl p-6 md:p-8 relative overflow-hidden space-y-6"
            >
              {/* Efeito luminoso de fundo do modal */}
              <div 
                className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -z-10 opacity-20 pointer-events-none transition-all"
                style={{ backgroundColor: form.color || "#6366f1" }}
              />

              {/* Header Modal */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg transition-all"
                    style={{ backgroundColor: form.color || "#6366f1" }}
                  >
                    <DoorOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground font-outfit">
                      {editingRoom ? "Editar Sala" : "Nova Sala de Estúdio"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {editingRoom ? "Altere os detalhes e a cor da sala" : "Cadastre uma nova sala de ensaio ou aula"}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeModal}
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X size={18} />
                </Button>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Nome da Sala <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Estúdio A - Piano Acústico / Sala 02"
                    className="h-12 text-sm font-semibold rounded-2xl bg-muted/30 border-border/60 focus:border-primary"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Descrição do Espaço (opcional)
                  </Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex: Equipada com bateria Roland, 2 amplificadores e ar-condicionado"
                    className="h-12 text-sm rounded-2xl bg-muted/30 border-border/60 focus:border-primary"
                  />
                </div>

                {/* Seletor de Cores da Sala */}
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Cor de Identificação</span>
                    <span className="font-mono text-xs text-muted-foreground font-normal">{form.color}</span>
                  </Label>
                  
                  {/* Preset Palette */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, color: c.value }))}
                        className={`h-9 rounded-xl flex items-center justify-center transition-all border ${
                          form.color.toLowerCase() === c.value.toLowerCase()
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 border-white/40"
                            : "border-transparent hover:scale-105 opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      >
                        {form.color.toLowerCase() === c.value.toLowerCase() && (
                          <Check size={14} className="text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom Color Input */}
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                      className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent shrink-0"
                    />
                    <span className="text-xs text-muted-foreground">Ou escolha uma cor personalizada para a grade da agenda</span>
                  </div>
                </div>

                {/* Botões do Rodapé */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    className="h-12 px-5 rounded-2xl font-bold"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="h-12 px-7 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 gap-2"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && (
                      <Loader2 size={18} className="animate-spin" />
                    )}
                    <span>{editingRoom ? "Salvar Alterações" : "Cadastrar Sala"}</span>
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
