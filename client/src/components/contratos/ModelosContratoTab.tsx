// ─── Modelos de Contrato — editor em blocos (estilo Emusys) ───────────────────
// Cada modelo é uma lista de itens: Tipo / Título / Texto. O `content`
// (texto final usado na assinatura) é renderizado dos blocos ao salvar.
// Gerido na aba "Modelos de Contrato" da página Contratos (admin).

import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTRACT_BLOCK_LABELS,
  blocksFromContent,
  emptyContractBlock,
  parseContractBlocks,
  renderContractBlocks,
  serializeContractBlocks,
  type ContractBlock,
  type ContractBlockType,
} from "@shared/contractBlocks";
import {
  FileSignature, FileText, Plus, Pencil, Trash2, Loader2, Sparkles, CheckCircle2,
  ArrowUp, ArrowDown, Copy, Eye, EyeOff, Wand2, ListPlus,
} from "lucide-react";

const BLOCK_TYPES = Object.keys(CONTRACT_BLOCK_LABELS) as ContractBlockType[];

const AVAILABLE_VARIABLES = [
  { tag: "{{school_name}}", label: "Nome da Escola" },
  { tag: "{{school_cnpj}}", label: "CNPJ da Escola" },
  { tag: "{{school_address}}", label: "Endereço da Escola" },
  { tag: "{{school_email}}", label: "E-mail da Escola" },
  { tag: "{{school_phone}}", label: "Telefone da Escola" },
  { tag: "{{guardian_name}}", label: "Nome do Responsável" },
  { tag: "{{guardian_cpf}}", label: "CPF do Responsável" },
  { tag: "{{guardian_phone}}", label: "Telefone do Responsável" },
  { tag: "{{guardian_email}}", label: "E-mail do Responsável" },
  { tag: "{{guardian_address}}", label: "Endereço do Responsável" },
  { tag: "{{student_name}}", label: "Nome do Aluno" },
  { tag: "{{student_cpf}}", label: "CPF do Aluno" },
  { tag: "{{student_rg}}", label: "RG do Aluno" },
  { tag: "{{student_birth_date}}", label: "Nasc. do Aluno" },
  { tag: "{{student_address}}", label: "Endereço do Aluno" },
  { tag: "{{student_email}}", label: "E-mail do Aluno" },
  { tag: "{{student_phone}}", label: "Telefone do Aluno" },
  { tag: "{{instrument}}", label: "Instrumento/Curso" },
  { tag: "{{monthly_fee}}", label: "Valor da Mensalidade" },
  { tag: "{{due_date}}", label: "Dia do Vencimento" },
  { tag: "{{contract_start_date}}", label: "Início do Contrato" },
  { tag: "{{contract_end_date}}", label: "Término do Contrato" },
];

function newBlockId(): string {
  try {
    return (globalThis.crypto as any)?.randomUUID?.() ?? `b_${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return `b_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function withIds(blocks: ContractBlock[]): ContractBlock[] {
  return blocks.map((b) => ({ ...b, id: b.id || newBlockId() }));
}

function PreviewText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(\{\{[^}]+\}\})/g), [text]);
  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-foreground/90">
      {parts.map((p, i) =>
        p.startsWith("{{") && p.endsWith("}}") ? (
          <mark key={i} className="rounded bg-violet-500/15 px-1 py-0.5 text-violet-700 dark:text-violet-300 font-bold">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </pre>
  );
}

export function ModelosContratoTab() {
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.contractTemplates.list.useQuery();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [blocks, setBlocks] = useState<ContractBlock[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const autoMutation = trpc.contractTemplates.autoInsertVariables.useMutation({
    onSuccess: (res) => {
      if (res.content) {
        // Redistribui o texto corrigido em blocos (títulos detectados de novo)
        setBlocks(withIds(blocksFromContent(res.content)));
        toast.success("Variáveis identificadas e substituídas automaticamente!");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const createMutation = trpc.contractTemplates.create.useMutation({
    onSuccess: () => {
      toast.success("Modelo de contrato criado com sucesso!");
      resetForm();
      utils.contractTemplates.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.contractTemplates.update.useMutation({
    onSuccess: () => {
      toast.success("Modelo de contrato atualizado!");
      resetForm();
      utils.contractTemplates.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.contractTemplates.delete.useMutation({
    onSuccess: () => {
      toast.success("Modelo desativado com sucesso.");
      utils.contractTemplates.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isEditing = isCreating || editingId !== null;

  const resetForm = () => {
    setEditingId(null);
    setIsCreating(false);
    setName("");
    setDescription("");
    setBlocks([]);
    setFocusedId(null);
    textareaRefs.current.clear();
  };

  const handleEdit = (tpl: any) => {
    setEditingId(tpl.id);
    setIsCreating(false);
    setName(tpl.name || "");
    setDescription(tpl.description || "");
    setBlocks(withIds(parseContractBlocks(tpl.blocks, tpl.content)));
    setFocusedId(null);
  };

  const handleNew = () => {
    resetForm();
    setIsCreating(true);
    setName("Novo Modelo de Contrato");
    setDescription("");
    setBlocks(withIds([emptyContractBlock("titulo"), emptyContractBlock("clausula")]));
  };

  const handleSave = () => {
    if (!name.trim()) return toast.error("Preencha o nome do modelo");
    const content = renderContractBlocks(blocks);
    if (!content.trim() || content.trim().length < 10) return toast.error("Preencha o texto das cláusulas do contrato");
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      content,
      blocks: serializeContractBlocks(blocks),
    };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  };

  // ── Ações dos blocos ──
  const updateBlock = (id: string, patch: Partial<ContractBlock>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const addBlock = (type: ContractBlockType = "clausula", afterId?: string) => {
    const block = { ...emptyContractBlock(type), id: newBlockId() };
    setBlocks((prev) => {
      if (!afterId) return [...prev, block];
      const idx = prev.findIndex((b) => b.id === afterId);
      if (idx < 0) return [...prev, block];
      const next = [...prev];
      next.splice(idx + 1, 0, block);
      return next;
    });
    setFocusedId(block.id);
  };

  const moveBlock = (id: string, dir: -1 | 1) =>
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  const duplicateBlock = (id: string) =>
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      next.splice(idx + 1, 0, { ...prev[idx], id: newBlockId() });
      return next;
    });

  const removeBlock = (id: string) =>
    setBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== id)));

  const insertVariable = (tag: string) => {
    const target = blocks.find((b) => b.id === focusedId) ?? blocks[blocks.length - 1];
    if (!target?.id) return;
    const el = textareaRefs.current.get(target.id);
    const pos = typeof el?.selectionStart === "number" ? el.selectionStart : target.text.length;
    const before = target.text.slice(0, pos);
    const spacer = before && !before.endsWith(" ") && !before.endsWith("\n") ? " " : "";
    const newText = `${before}${spacer}${tag}${target.text.slice(pos)}`;
    updateBlock(target.id, { text: newText });
    requestAnimationFrame(() => {
      const node = textareaRefs.current.get(target.id!);
      node?.focus();
      const p = before.length + spacer.length + tag.length;
      try { node?.setSelectionRange(p, p); } catch { /* noop */ }
    });
  };

  const renderedContent = renderContractBlocks(blocks);

  // ── Lista de modelos (sem edição aberta) ──
  if (!isEditing) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 backdrop-blur-md p-5 sm:p-6 rounded-[2rem] border border-border shadow-sm">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-foreground flex items-center gap-2 tracking-tight">
              <FileSignature className="text-violet-600" size={22} /> Modelos de Contrato
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Monte o contrato em blocos (título, partes, cláusulas e parágrafos) com variáveis automáticas.
            </p>
          </div>
          <Button
            onClick={handleNew}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold h-11 px-5 flex items-center gap-2 shadow-lg shadow-violet-500/20"
          >
            <Plus size={18} /> Novo Modelo
          </Button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin text-violet-600" /> Carregando modelos de contrato...
          </div>
        ) : templates.length === 0 ? (
          <div className="p-12 text-center bg-card rounded-[2rem] border border-border">
            <FileText size={36} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-bold text-foreground">Nenhum modelo de contrato cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Crie seu primeiro modelo para enviar contratos para assinatura digital.
            </p>
            <Button onClick={handleNew} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold">
              <Plus size={16} className="mr-1.5" /> Criar Primeiro Modelo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((tpl: any) => {
              const count = parseContractBlocks(tpl.blocks, tpl.content).length;
              return (
                <div
                  key={tpl.id}
                  className="bg-card rounded-[2rem] border border-border/80 p-5 flex flex-col justify-between hover:border-violet-500/40 hover:-translate-y-0.5 transition-all shadow-xs group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
                        <FileText size={19} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-foreground leading-snug">{tpl.name}</h4>
                        {tpl.description && (
                          <p className="text-[11px] text-muted-foreground font-medium line-clamp-2 mt-0.5">{tpl.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded-lg border border-violet-500/20 bg-violet-500/5 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-300">
                        {count} {count === 1 ? "item" : "itens"}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-bold">
                        {tpl.updatedAt ? `Atualizado em ${new Date(tpl.updatedAt).toLocaleDateString("pt-BR")}` : ""}
                      </span>
                    </div>
                    <div className="bg-muted/30 p-3 rounded-xl border border-border/40 text-[10px] font-mono text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-wrap">
                      {renderContractBlocks(parseContractBlocks(tpl.blocks, tpl.content)).slice(0, 220)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(tpl)}
                      className="h-9 rounded-xl font-bold text-xs"
                    >
                      <Pencil size={13} className="mr-1.5" /> Editar
                    </Button>
                    {templates.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Deseja realmente desativar o modelo "${tpl.name}"?`)) {
                            deleteMutation.mutate({ id: tpl.id });
                          }
                        }}
                        className="h-9 w-9 p-0 rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Editor em blocos ──
  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card/60 backdrop-blur-md p-4 sm:p-5 rounded-[2rem] border border-border shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={resetForm}
            className="h-9 px-3 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
          >
            ← Voltar
          </button>
          <h2 className="text-base sm:text-lg font-black text-foreground truncate">
            {editingId ? "Editar Modelo" : "Novo Modelo"}
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
            className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest"
          >
            {showPreview ? <EyeOff size={14} className="mr-1.5" /> : <Eye size={14} className="mr-1.5" />}
            {showPreview ? "Ocultar prévia" : "Ver prévia"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!renderedContent.trim() || autoMutation.isPending}
            onClick={() => {
              if (!renderedContent.trim()) return toast.error("Preencha o texto do contrato primeiro");
              autoMutation.mutate({ content: renderedContent });
            }}
            className="h-10 rounded-xl border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 text-[10px] font-black uppercase tracking-widest"
          >
            {autoMutation.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Wand2 size={14} className="mr-1.5" />}
            Substituir variáveis (IA)
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-[10px] uppercase tracking-widest px-5 shadow-lg shadow-violet-500/20"
          >
            {isSaving ? <Loader2 size={15} className="mr-1.5 animate-spin" /> : <CheckCircle2 size={15} className="mr-1.5" />}
            {editingId ? "Salvar Alterações" : "Criar Modelo"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[18rem_minmax(0,1fr)] gap-5 items-start">
        {/* Painel lateral: dados + tipos de item + variáveis */}
        <div className="space-y-4 xl:sticky xl:top-4">
          <div className="bg-card rounded-[1.5rem] border border-border/70 p-4 space-y-3 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dados do modelo</p>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-0.5">Nome *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Contrato de Matrícula Padrão"
                className="h-11 rounded-xl border-border font-bold text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-0.5">Descrição</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Cursos presenciais"
                className="h-11 rounded-xl border-border font-medium text-sm"
              />
            </div>
          </div>

          <div className="bg-card rounded-[1.5rem] border border-border/70 p-4 space-y-3 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <ListPlus size={12} className="text-violet-500" /> Tipo de item
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {BLOCK_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addBlock(t)}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-border/80 bg-muted/30 px-2 py-2 text-[10px] font-black uppercase tracking-wider text-foreground/80 hover:border-violet-500/40 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
                >
                  <Plus size={11} /> {CONTRACT_BLOCK_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-[1.5rem] border border-border/70 p-4 space-y-3 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Sparkles size={12} className="text-violet-500" /> Variáveis
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  title={v.label}
                  className="px-2 py-1 rounded-lg border border-border/80 bg-muted/30 text-[10px] font-bold text-violet-600 dark:text-violet-300 hover:border-violet-500/40 hover:bg-violet-500/10 transition-colors"
                >
                  {v.tag}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Clique no campo de texto de um item e depois na variável para inseri-la na posição do cursor.
            </p>
          </div>
        </div>

        {/* Itens do contrato + prévia */}
        <div className="space-y-5 min-w-0">
          <div className="bg-card rounded-[1.5rem] border border-border/70 shadow-xs overflow-hidden">
            <div className="hidden md:grid grid-cols-[9.5rem_minmax(0,15rem)_minmax(0,1fr)_auto] gap-3 px-4 py-3 border-b border-border/60 bg-muted/30">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de item</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Texto</span>
              <span className="w-24" />
            </div>

            <div className="divide-y divide-border/50">
              {blocks.map((b, idx) => (
                <div key={b.id} className="p-3 sm:p-4 md:grid md:grid-cols-[9.5rem_minmax(0,15rem)_minmax(0,1fr)_auto] md:gap-3 md:items-start space-y-2.5 md:space-y-0">
                  <select
                    value={b.type}
                    onChange={(e) => updateBlock(b.id!, { type: e.target.value as ContractBlockType })}
                    className="w-full h-10 rounded-xl border border-border bg-background px-2 text-[11px] font-bold outline-none focus:ring-2 focus:ring-violet-500/20"
                  >
                    {BLOCK_TYPES.map((t) => (
                      <option key={t} value={t}>{CONTRACT_BLOCK_LABELS[t]}</option>
                    ))}
                  </select>

                  <Input
                    value={b.title}
                    onChange={(e) => updateBlock(b.id!, { title: e.target.value })}
                    placeholder={b.type === "clausula" ? "Ex: CLÁUSULA 1ª — DO OBJETO" : "Título do item"}
                    className="h-10 rounded-xl font-bold text-xs"
                  />

                  <Textarea
                    ref={(el) => {
                      if (b.id) {
                        if (el) textareaRefs.current.set(b.id, el);
                        else textareaRefs.current.delete(b.id);
                      }
                    }}
                    value={b.text}
                    onFocus={() => setFocusedId(b.id ?? null)}
                    onChange={(e) => updateBlock(b.id!, { text: e.target.value })}
                    rows={3}
                    placeholder="Texto do item (use as variáveis ao lado)"
                    className={cn(
                      "rounded-xl text-xs leading-relaxed min-h-[4.5rem]",
                      focusedId === b.id && "ring-2 ring-violet-500/25 border-violet-500/40"
                    )}
                  />

                  <div className="flex items-center gap-1 md:justify-end">
                    <button type="button" onClick={() => moveBlock(b.id!, -1)} disabled={idx === 0} title="Mover para cima"
                      className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors">
                      <ArrowUp size={13} className="mx-auto" />
                    </button>
                    <button type="button" onClick={() => moveBlock(b.id!, 1)} disabled={idx === blocks.length - 1} title="Mover para baixo"
                      className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 transition-colors">
                      <ArrowDown size={13} className="mx-auto" />
                    </button>
                    <button type="button" onClick={() => duplicateBlock(b.id!)} title="Duplicar item"
                      className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      <Copy size={13} className="mx-auto" />
                    </button>
                    <button type="button" onClick={() => removeBlock(b.id!)} disabled={blocks.length <= 1} title="Excluir item"
                      className="h-8 w-8 rounded-lg border border-border text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 transition-colors">
                      <Trash2 size={13} className="mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 sm:p-4 border-t border-border/60 bg-muted/20 flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => addBlock("clausula")} className="h-10 rounded-xl text-[10px] font-black uppercase tracking-widest">
                <Plus size={13} className="mr-1.5" /> Adicionar item
              </Button>
              <span className="text-[10px] text-muted-foreground font-bold">
                {blocks.length} item(ns) · {renderedContent.length} caracteres no texto final
              </span>
            </div>
          </div>

          {showPreview && (
            <div className="bg-card rounded-[1.5rem] border border-border/70 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex items-center gap-2">
                <Eye size={13} className="text-violet-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prévia do contrato</span>
              </div>
              <div className="p-4 sm:p-5 max-h-[26rem] overflow-y-auto">
                {renderedContent.trim() ? (
                  <PreviewText text={renderedContent} />
                ) : (
                  <p className="text-xs text-muted-foreground">Preencha os itens para ver a prévia do contrato.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
