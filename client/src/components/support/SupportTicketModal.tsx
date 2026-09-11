import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, LifeBuoy, Bug, Lightbulb, HelpCircle, MessageSquarePlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Category = "bug" | "melhoria" | "duvida" | "outro";
type Priority = "baixa" | "media" | "alta";

const CATEGORIES = [
  { id: "bug", label: "Bug", icon: Bug, desc: "Algo não funciona" },
  { id: "melhoria", label: "Melhoria", icon: Lightbulb, desc: "Sugerir algo" },
  { id: "duvida", label: "Dúvida", icon: HelpCircle, desc: "Preciso de ajuda" },
  { id: "outro", label: "Outro", icon: MessageSquarePlus, desc: "Outro assunto" },
] as const;

export function SupportTicketModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const utils = trpc.useUtils();
  const [category, setCategory] = useState<Category>("melhoria");
  const [priority, setPriority] = useState<Priority>("media");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const createMutation = trpc.support.create.useMutation({
    onSuccess: () => {
      toast.success("Chamado enviado! Nossa equipe vai analisar. 🎫");
      utils.support.listMine.invalidate();
      utils.support.openCount.invalidate();
      setTitle("");
      setDescription("");
      setCategory("melhoria");
      setPriority("media");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message || "Erro ao enviar o chamado."),
  });

  const submit = () => {
    if (title.trim().length < 3) { toast.error("Informe um título (mín. 3 caracteres)."); return; }
    if (description.trim().length < 5) { toast.error("Descreva melhor o chamado."); return; }
    createMutation.mutate({
      category,
      priority,
      title: title.trim(),
      description: description.trim(),
      pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[calc(100dvh-8rem)] md:max-h-[92vh] flex flex-col rounded-3xl border-border/40 p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-lg font-black">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><LifeBuoy size={18} /></div>
              Abrir chamado
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Relate um bug ou sugira uma melhoria. Nossa equipe responde por aqui.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0 no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-2xl border-2 text-center transition-all",
                    active ? "border-emerald-500 bg-emerald-500/10" : "border-border/50 hover:border-emerald-400/40"
                  )}
                >
                  <Icon size={18} className={active ? "text-emerald-500" : "text-muted-foreground"} />
                  <span className="text-[11px] font-black">{c.label}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight">{c.desc}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Prioridade</label>
            <div className="flex gap-2">
              {(["baixa", "media", "alta"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex-1 h-9 rounded-xl text-[11px] font-black uppercase border-2 transition-all",
                    priority === p ? "border-emerald-500 bg-emerald-500/10 text-emerald-600" : "border-border/50 text-muted-foreground"
                  )}
                >
                  {p === "media" ? "média" : p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Título *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Ex: Erro ao salvar aluno" className="h-11 rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Descrição *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={5}
              placeholder="Descreva o que aconteceu, o que você esperava e, se possível, os passos para reproduzir."
              className="w-full px-4 py-3 text-sm rounded-xl border border-border/50 bg-muted/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/40 flex justify-end gap-2 shrink-0 bg-muted/10">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">Cancelar</Button>
          <Button onClick={submit} disabled={createMutation.isPending} className="rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white">
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <LifeBuoy size={14} />} Enviar chamado
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
