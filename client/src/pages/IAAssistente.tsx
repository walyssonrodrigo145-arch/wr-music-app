import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, MessageSquare, Plus, Trash2, Loader2, BrainCircuit, FileText, Users, DollarSign, Calendar, ArrowLeft, AlertTriangle, Clock, CheckCircle2, Upload } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Formata o tempo restante até uma data futura (ex: "2h 34min") */
function formatTimeLeft(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return "em breve";
  const totalMinutes = Math.ceil(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes > 0 ? `${minutes}min` : ""}`.trim();
  return `${minutes}min`;
}

export default function IAAssistente() {
  const utils = trpc.useUtils();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [timeLeftStr, setTimeLeftStr] = useState("");

  // Queries e Mutations
  const { data: conversations = [], isLoading: isLoadingConversations } = trpc.ai.listConversations.useQuery();
  const { data: dbMessages, isLoading: isLoadingMessages } = trpc.ai.getMessages.useQuery(
    { conversationId: activeConversationId! },
    { enabled: !!activeConversationId }
  );
  const { data: usageStats, refetch: refetchUsage } = trpc.ai.getUsageStats.useQuery(undefined, {
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  // Countdown de cooldown em tempo real
  useEffect(() => {
    if (!usageStats?.cooldownUntil) {
      setCooldownSeconds(0);
      return;
    }
    const update = () => {
      const diff = Math.ceil((new Date(usageStats.cooldownUntil!).getTime() - Date.now()) / 1000);
      setCooldownSeconds(Math.max(0, diff));
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [usageStats?.cooldownUntil]);

  // Countdown de bloqueio diário em tempo real
  useEffect(() => {
    if (!usageStats?.resetsAt) {
      setTimeLeftStr("");
      return;
    }
    const update = () => setTimeLeftStr(formatTimeLeft(usageStats.resetsAt!));
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [usageStats?.resetsAt]);

  const newConvMutation = trpc.ai.newConversation.useMutation({
    onSuccess: (data) => {
      utils.ai.listConversations.invalidate();
      setActiveConversationId(data.id);
      setMessages([]);
    },
    onError: (e) => toast.error(`Erro ao criar conversa: ${e.message}`),
  });

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      utils.ai.listConversations.invalidate();
      refetchUsage();
    },
    onError: (e) => {
      // Remove o optimistic update do usuário
      setMessages((prev) => prev.slice(0, -1));
      // Mostra erro detalhado no toast
      toast.error(e.message, { duration: 6000 });
      refetchUsage();
    },
  });

  const deleteConvMutation = trpc.ai.deleteConversation.useMutation({
    onSuccess: () => {
      toast.success("Conversa excluída");
      utils.ai.listConversations.invalidate();
      if (activeConversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    onError: (e) => toast.error(`Erro ao excluir: ${e.message}`),
  });

  // Atualizar mensagens locais quando mudar de conversa
  useEffect(() => {
    if (dbMessages) {
      setMessages(dbMessages.map((m: any) => ({ role: m.role, content: m.content })));
    }
  }, [dbMessages]);

  const isBlocked = false;
  const isInCooldown = cooldownSeconds > 0;

  const { data: documents = [], isLoading: isLoadingDocs } = trpc.ai.listDocuments.useQuery();
  const uploadDocMutation = trpc.ai.uploadDocument.useMutation({
    onSuccess: () => {
      toast.success("Documento adicionado!");
      utils.ai.listDocuments.invalidate();
    },
    onError: (e) => toast.error(`Erro ao adicionar: ${e.message}`)
  });
  const deleteDocMutation = trpc.ai.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Documento removido!");
      utils.ai.listDocuments.invalidate();
    }
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      uploadDocMutation.mutate({
        fileName: file.name,
        fileType: file.type || "text/plain",
        extractedText: text
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSendMessage = (content: string) => {
    if (!activeConversationId) return;
    if (isBlocked) {
      toast.error(`Limite diário atingido. Libera em ${timeLeftStr}.`, { duration: 5000 });
      return;
    }
    if (isInCooldown) {
      toast.error(`Aguarde ${cooldownSeconds}s antes de enviar outra consulta.`, { duration: 3000 });
      return;
    }

    // Optimistic update
    setMessages((prev) => [...prev, { role: "user", content }]);

    chatMutation.mutate({
      conversationId: activeConversationId,
      message: content,
    });
  };

  const handleCreateConversation = (initialPrompt?: string) => {
    if (newConvMutation.isPending) return;

    if (initialPrompt) {
      newConvMutation.mutate(
        { title: "Nova Conversa" },
        {
          onSuccess: (data) => {
            setActiveConversationId(data.id);
            setMessages([{ role: "user", content: initialPrompt }]);
            chatMutation.mutate({ conversationId: data.id, message: initialPrompt });
          }
        }
      );
    } else {
      newConvMutation.mutate({ title: "Nova Conversa" });
    }
  };

  const suggestions = [
    { icon: Plus, text: "Cadastrar novo aluno" },
    { icon: DollarSign, text: "Gerar relatório financeiro do mês" },
    { icon: Users, text: "Resumo dos meus alunos ativos" },
    { icon: Calendar, text: "Analisar minha agenda desta semana" },
    { icon: MessageSquare, text: "Criar mensagem para cobrar alunos" },
  ];

  // Badge de uso diário
  const UsageBadge = () => {
    if (!usageStats) return null;
    const { usedToday, limit } = usageStats;
    const remaining = limit - usedToday;
    const pct = (usedToday / limit) * 100;

    return (
      <div className={cn(
        "rounded-xl border p-3 mt-1 transition-all",
        isBlocked
          ? "border-rose-500/30 bg-rose-500/5"
          : remaining <= 3
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-border bg-muted/30"
      )}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Consultas hoje
          </span>
          <span className={cn(
            "text-[11px] font-bold",
            isBlocked ? "text-rose-500" : remaining <= 3 ? "text-amber-600" : "text-foreground"
          )}>
            {usedToday}/{limit}
          </span>
        </div>

        {/* Barra de progresso */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isBlocked ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-500"
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        {isBlocked && timeLeftStr && (
          <div className="flex items-center gap-1.5 mt-2">
            <Clock size={11} className="text-rose-500 shrink-0" />
            <span className="text-[10px] text-rose-600 font-semibold">
              Libera em {timeLeftStr}
            </span>
          </div>
        )}
        {!isBlocked && remaining <= 3 && remaining > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <AlertTriangle size={11} className="text-amber-500 shrink-0" />
            <span className="text-[10px] text-amber-600 font-semibold">
              Restam {remaining} consulta{remaining !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        {!isBlocked && remaining > 3 && (
          <div className="flex items-center gap-1.5 mt-2">
            <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
            <span className="text-[10px] text-emerald-600 font-semibold">
              {remaining} consultas disponíveis
            </span>
          </div>
        )}
      </div>
    );
  };

  // Banner de bloqueio (exibido no chat quando bloqueado)
  const BlockedBanner = () => {
    if (!isBlocked || !usageStats) return null;
    return (
      <div className="mx-3 sm:mx-6 lg:mx-8 mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-rose-500 shrink-0" />
          <p className="text-sm font-bold text-rose-600">Limite diário atingido</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Você atingiu o limite de <strong>10 consultas por dia</strong> à IA.
          Suas consultas serão liberadas automaticamente após 24h.
        </p>
        {timeLeftStr && (
          <div className="flex items-center gap-2 mt-1 bg-rose-500/10 rounded-xl px-3 py-2">
            <Clock size={14} className="text-rose-500" />
            <span className="text-sm font-bold text-rose-600">Libera em: {timeLeftStr}</span>
          </div>
        )}
      </div>
    );
  };

  // Banner de cooldown (aguarde X segundos)
  const CooldownBanner = () => {
    if (!isInCooldown || isBlocked) return null;
    return (
      <div className="mx-3 sm:mx-6 lg:mx-8 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 flex items-center gap-2 shrink-0">
        <Clock size={14} className="text-amber-500 shrink-0" />
        <span className="text-xs font-semibold text-amber-600">
          Aguarde {cooldownSeconds}s antes de enviar outra consulta.
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-background">

      {/* Sidebar de Conversas / Documentos */}
      <div className={cn(
        "w-full md:w-72 lg:w-80 border-r border-border bg-card/50 flex flex-col shrink-0 transition-all h-full md:h-auto",
        activeConversationId ? "hidden md:flex" : "flex"
      )}>
        <div className="flex flex-col h-full overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-border flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <BrainCircuit className="text-indigo-600" size={20} />
              </div>
              <div>
                <h2 className="font-bold text-foreground leading-tight">IA Assistente</h2>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden m-0 flex flex-col">
            <div className="px-4 pt-4 shrink-0">
              <Button
                onClick={() => handleCreateConversation()}
                disabled={newConvMutation.isPending}
                className="w-full gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 text-xs font-bold disabled:opacity-50"
              >
                {newConvMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Nova Conversa
              </Button>
            </div>
            <ScrollArea className="flex-1 p-3 mt-2 h-full">
          {/* Sugestões Rápidas no Mobile */}
          <div className="block md:hidden mb-6 p-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">Sugestões Rápidas</p>
            <div className="grid grid-cols-1 gap-2.5">
              {suggestions.map((sug, i) => {
                const Icon = sug.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleCreateConversation(sug.text)}
                    disabled={isBlocked}
                    className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-card active:bg-indigo-500/10 transition-all text-left group shadow-sm disabled:opacity-40"
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <Icon className="text-indigo-600 dark:text-indigo-400" size={16} />
                    </div>
                    <span className="text-xs font-bold text-foreground leading-tight">{sug.text}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 px-3 block md:hidden">Suas Conversas</p>

          {isLoadingConversations ? (
            <div className="flex justify-center p-8 text-muted-foreground">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center p-6 text-sm text-muted-foreground">
              Nenhuma conversa ainda.
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv: any) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all",
                    activeConversationId === conv.id
                      ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                  onClick={() => setActiveConversationId(conv.id)}
                >
                  <div className="flex items-center gap-3 truncate">
                    <MessageSquare size={16} className="shrink-0 opacity-70" />
                    <span className="text-sm font-medium truncate">{conv.title}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Excluir esta conversa?")) {
                        deleteConvMutation.mutate({ id: conv.id });
                      }
                    }}
                    className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-600 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
          </div>
        </div>
      </div>

      {/* Área Principal — Chat */}
      <div className={cn(
        "flex-1 flex flex-col bg-background min-w-0 h-full relative",
        !activeConversationId && "hidden md:flex"
      )}>
        {activeConversationId ? (
          <div className="absolute inset-0 flex flex-col bg-background overflow-hidden">
            {/* Mobile Header Bar */}
            <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
              <button
                onClick={() => setActiveConversationId(null)}
                className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 py-1.5 px-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl active:scale-95 transition-all shadow-sm"
              >
                <ArrowLeft size={16} />
                <span>Conversas</span>
              </button>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                <BrainCircuit size={16} className="text-indigo-500 shrink-0" />
                <span className="truncate max-w-[140px]">{conversations.find((c: any) => c.id === activeConversationId)?.title || "Chat"}</span>
              </div>
            </div>

            {/* Banners de bloqueio/cooldown */}
            <BlockedBanner />
            <CooldownBanner />

            {/* Chat Box */}
            <div className="flex-1 overflow-hidden p-2 sm:p-6 lg:p-8">
              <AIChatBox
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={chatMutation.isPending || isLoadingMessages}
                isBlocked={isBlocked}
                isCooldown={isInCooldown}
                cooldownSeconds={cooldownSeconds}
                placeholder={
                  isBlocked
                    ? "Limite diário atingido. Aguarde 24h..."
                    : isInCooldown
                      ? `Aguarde ${cooldownSeconds}s...`
                      : "Pergunte algo ao Assistente..."
                }
                className="h-full shadow-2xl shadow-indigo-500/5 border-indigo-500/10"
                height="100%"
                emptyStateMessage="Como posso ajudar com sua escola de música hoje?"
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-inner relative">
              <Sparkles className="text-indigo-500 w-10 h-10 animate-pulse" />
              <div className="absolute -inset-4 bg-indigo-500/20 blur-xl rounded-full -z-10" />
            </div>

            <h2 className="text-2xl font-black text-foreground text-center mb-2">Assistente Musical Inteligente</h2>
            <p className="text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
              Sua IA tem acesso em tempo real aos seus alunos, aulas e finanças. Comece uma nova conversa ou escolha uma sugestão abaixo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
              {suggestions.map((sug, i) => {
                const Icon = sug.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleCreateConversation(sug.text)}
                    disabled={isBlocked}
                    className="flex flex-col gap-3 p-5 rounded-2xl border border-border bg-card hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all text-left group disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-indigo-500/10 flex items-center justify-center transition-colors">
                      <Icon className="text-muted-foreground group-hover:text-indigo-600" size={18} />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{sug.text}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
