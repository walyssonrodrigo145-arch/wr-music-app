import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { AIChatBox, Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, MessageSquare, Plus, Trash2, Loader2, BrainCircuit, FileText, Users, DollarSign, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function IAAssistente() {
  const utils = trpc.useUtils();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Queries e Mutations
  const { data: conversations = [], isLoading: isLoadingConversations } = trpc.ai.listConversations.useQuery();
  const { data: dbMessages, isLoading: isLoadingMessages } = trpc.ai.getMessages.useQuery(
    { conversationId: activeConversationId! },
    { enabled: !!activeConversationId }
  );

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
      // Atualiza a lista para refletir o novo título se foi a primeira mensagem
      utils.ai.listConversations.invalidate();
    },
    onError: (e) => {
      toast.error(`Erro na IA: ${e.message}`);
      // Remove a mensagem temporária do usuário se falhar (opcional, mas bom UX)
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

  const handleSendMessage = (content: string) => {
    if (!activeConversationId) return;
    
    // Optimistic update
    setMessages((prev) => [...prev, { role: "user", content }]);
    
    chatMutation.mutate({
      conversationId: activeConversationId,
      message: content,
    });
  };

  const handleCreateConversation = (initialPrompt?: string) => {
    if (newConvMutation.isPending) return;
    
    // Se passamos um prompt inicial, criamos a conversa e já enviamos
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
    { icon: DollarSign, text: "Gerar relatório financeiro do mês" },
    { icon: Users, text: "Resumo dos meus alunos ativos" },
    { icon: Calendar, text: "Analisar minha agenda desta semana" },
    { icon: MessageSquare, text: "Criar mensagem para cobrar alunos" },
  ];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-background">
      
      {/* Sidebar de Conversas */}
      <div className="w-full md:w-72 lg:w-80 border-r border-border bg-card/50 flex flex-col shrink-0 transition-all">
        <div className="p-4 sm:p-6 border-b border-border flex flex-col gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <BrainCircuit className="text-indigo-600" size={20} />
            </div>
            <div>
              <h2 className="font-bold text-foreground leading-tight">IA Assistente</h2>
              <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Gemini 2.0</p>
            </div>
          </div>
          
          <Button 
            onClick={() => handleCreateConversation()} 
            disabled={newConvMutation.isPending}
            className="w-full gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 text-xs font-bold"
          >
            {newConvMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Nova Conversa
          </Button>
        </div>

        <ScrollArea className="flex-1 p-3">
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
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-500/20 hover:text-rose-600 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Área Principal - Chat */}
      <div className="flex-1 flex flex-col bg-background min-w-0 h-full relative">
        {activeConversationId ? (
          <>
            <div className="absolute inset-0 p-4 sm:p-6 lg:p-8 overflow-hidden flex flex-col">
              <AIChatBox
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={chatMutation.isPending || isLoadingMessages}
                placeholder="Pergunte algo ao Assistente..."
                className="flex-1 h-full shadow-2xl shadow-indigo-500/5 border-indigo-500/10"
                height="100%"
                emptyStateMessage="Como posso ajudar com sua escola de música hoje?"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-inner relative">
              <Sparkles className="text-indigo-500 w-10 h-10 animate-pulse" />
              <div className="absolute -inset-4 bg-indigo-500/20 blur-xl rounded-full -z-10" />
            </div>
            
            <h2 className="text-2xl font-black text-foreground text-center mb-2">Assistente Musical Inteligente</h2>
            <p className="text-muted-foreground text-center max-w-md mb-12 leading-relaxed">
              Sua IA tem acesso em tempo real aos seus alunos, aulas e finanças. Comece uma nova conversa ou escolha uma sugestão abaixo.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
              {suggestions.map((sug, i) => {
                const Icon = sug.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleCreateConversation(sug.text)}
                    className="flex flex-col gap-3 p-5 rounded-2xl border border-border bg-card hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all text-left group"
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
