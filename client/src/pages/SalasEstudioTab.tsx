import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Loader2, DoorOpen, CheckCircle2, X } from "lucide-react";

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
      toast.success("Sala removida!");
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest flex items-center gap-2">
            <DoorOpen className="text-indigo-500" size={20} />
            Salas de Estúdio / Ensaio
          </h3>
          <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
            Cadastre e gerencie as salas físicas disponíveis da sua escola
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11 px-5 shadow-lg shadow-indigo-500/20 text-white font-bold"
        >
          <Plus size={16} />
          <span>Nova Sala</span>
        </Button>
      </div>

      {rooms.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-border rounded-2xl">
          <DoorOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-foreground">Nenhuma sala cadastrada</h4>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Cadastre as salas de aula ou estúdios da sua escola para organizar os agendamentos.
          </p>
          <Button onClick={openCreateModal} variant="outline" className="gap-2 rounded-xl font-bold">
            <Plus size={14} /> Cadastrar Primeira Sala
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <Card
              key={room.id}
              className={`p-5 rounded-2xl border transition-all ${
                room.active ? "border-border bg-card" : "border-border/40 bg-muted/40 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-10 rounded-full"
                    style={{ backgroundColor: room.color || "#6366f1" }}
                  />
                  <div>
                    <h4 className="font-bold text-foreground text-sm">{room.name}</h4>
                    {room.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{room.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => openEditModal(room)}
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-rose-500/70 hover:text-rose-500"
                    onClick={() => {
                      if (confirm(`Deseja remover a sala "${room.name}"?`)) {
                        deleteMutation.mutate({ id: room.id });
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  {room.active ? "Ativa" : "Inativa"}
                </span>
                <Switch
                  checked={room.active}
                  onCheckedChange={() => handleToggleActive(room)}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Modal/Form de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 rounded-3xl border-border bg-card shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95">
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>

            <div>
              <h3 className="text-base font-black text-foreground">
                {editingRoom ? "Editar Sala" : "Nova Sala de Estúdio"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {editingRoom ? "Altere as informações da sala" : "Preencha o nome e detalhes da sala"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Nome da Sala *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Sala 01 - Piano / Estúdio A"
                  className="h-11 text-sm font-semibold rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Descrição (opcional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Ex: Equipado com piano acústico e amplificador"
                  className="h-11 text-sm rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Cor de Identificação</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                  />
                  <Input
                    value={form.color}
                    onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="h-11 text-sm font-mono rounded-xl max-w-[120px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={closeModal} className="rounded-xl h-11 px-4 font-bold">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-xl h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  <span>{editingRoom ? "Salvar Alterações" : "Cadastrar Sala"}</span>
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
