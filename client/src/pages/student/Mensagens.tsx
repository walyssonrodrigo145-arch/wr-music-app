import { 
  Send, 
  MoreHorizontal, 
  Search,
  Music,
  Paperclip,
  Smile,
  ChevronLeft,
  Circle,
  Phone,
  Video,
  Info,
  MessageSquare,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function StudentMessages() {
  const { data: profile, isLoading: isProfileLoading } = trpc.studentPortal.getProfile.useQuery();
  const [message, setMessage] = useState("");

  const { data: messages, refetch, isLoading: isMessagesLoading } = trpc.studentPortal.getMessages.useQuery(
    { withUserId: profile?.teacherId as number },
    { enabled: !!profile?.teacherId }
  );

  const sendMutation = trpc.studentPortal.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
    },
    onError: (err: any) => {
      console.error("Chat error:", err);
      toast.error("Erro ao enviar mensagem: " + err.message);
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    if (!profile?.teacherId) {
       toast.error("Professor não encontrado para envio.");
       return;
    }
    sendMutation.mutate({ receiverId: profile.teacherId, content: message });
  };

  const displayMessages = messages || [];

  if (isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Iniciando Chat Seguro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col max-w-[1600px] mx-auto">
      <div className="flex-1 flex gap-8 overflow-hidden">
        
        {/* Sidebar - Contacts (Refined) */}
        <div className="hidden md:flex w-80 lg:w-96 flex-col gap-6">
           <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Procurar conversas..." 
                className="w-full bg-card/40 backdrop-blur-md border border-border/40 rounded-3xl py-5 pl-14 pr-6 text-[10px] font-black uppercase tracking-[0.15em] outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-sm" 
              />
           </div>

           <Card className="flex-1 border border-border/40 shadow-2xl bg-card/40 backdrop-blur-md overflow-hidden rounded-[2.5rem]">
              <CardContent className="p-4 space-y-2">
                 <div className="px-4 py-3">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Conversas Ativas</p>
                    
                    <div className="p-5 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center gap-5 cursor-pointer transition-all hover:bg-primary/15 group relative overflow-hidden">
                       {/* Active Indicator Background */}
                       <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-r-full" />
                       
                       <div className="relative">
                         <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-base font-black shadow-lg shadow-primary/20">
                           {profile?.teacherName?.slice(0, 2).toUpperCase() || "PR"}
                         </div>
                         <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-4 border-card flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                         </div>
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">Prof. {profile?.teacherName || "Carregando..."}</p>
                          <p className="text-[10px] font-bold text-primary truncate uppercase tracking-widest mt-0.5">Professor Titular</p>
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Chat Area - Main Content */}
        <Card className="flex-1 border border-border/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] bg-card/60 backdrop-blur-3xl flex flex-col overflow-hidden relative rounded-[3rem]">
           {/* Decorative Watermark */}
           <div className="absolute inset-0 opacity-[0.02] pointer-events-none select-none flex items-center justify-center rotate-[-15deg] scale-150">
              <Music size={500} strokeWidth={1} />
           </div>

           {/* Chat Header - Premium Glassmorphism */}
           <div className="p-6 px-10 border-b border-border/30 bg-card/40 backdrop-blur-xl flex items-center justify-between relative z-10">
              <div className="flex items-center gap-5">
                 <button className="md:hidden p-3 hover:bg-muted rounded-2xl transition-all">
                    <ChevronLeft size={24} />
                 </button>
                 <div className="relative">
                    <div className="w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-base font-black shadow-xl shadow-primary/10">
                      {profile?.teacherName?.slice(0, 2).toUpperCase() || "PR"}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-4 border-card" />
                 </div>
                 <div>
                    <h3 className="text-lg font-black tracking-tight text-foreground">Prof. {profile?.teacherName || "Professor"}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                       <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.15em]">Disponível Agora</p>
                    </div>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 <button className="p-3.5 hover:bg-primary/10 rounded-2xl transition-all text-muted-foreground hover:text-primary border border-transparent hover:border-primary/20"><Phone size={20} /></button>
                 <button className="p-3.5 hover:bg-primary/10 rounded-2xl transition-all text-muted-foreground hover:text-primary border border-transparent hover:border-primary/20"><Video size={20} /></button>
                 <div className="w-px h-8 bg-border/40 mx-2" />
                 <button className="p-3.5 hover:bg-muted rounded-2xl transition-all text-muted-foreground"><MoreHorizontal size={20} /></button>
              </div>
           </div>

           {/* Messages List Area */}
           <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-none relative z-10 bg-gradient-to-b from-transparent to-background/5">
               <AnimatePresence initial={false}>
                {displayMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center">
                       <MessageSquare size={32} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Nenhuma mensagem enviada ainda</p>
                  </div>
                ) : displayMessages.map((msg: any, idx: number) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    key={msg.id} 
                    className={cn(
                      "flex flex-col max-w-[70%]",
                      msg.isMe ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                     <div className={cn(
                       "p-5 px-7 rounded-[2.5rem] text-sm font-medium shadow-lg transition-all hover:scale-[1.02]",
                       msg.isMe 
                        ? "bg-primary text-white rounded-br-none shadow-primary/20" 
                        : "bg-white dark:bg-slate-800 text-foreground rounded-bl-none border border-border/30 shadow-black/5"
                     )}>
                        {msg.content}
                     </div>
                     <span className={cn(
                       "text-[9px] font-black uppercase mt-3 tracking-[0.1em] flex items-center gap-2 opacity-60",
                       msg.isMe ? "text-primary" : "text-muted-foreground"
                     )}>
                        {format(new Date(msg.createdAt), "HH:mm")}
                        {msg.isMe && (
                          <div className="flex items-center">
                            <Circle size={4} fill="currentColor" className="text-primary" />
                            <Circle size={4} fill="currentColor" className="text-primary -ml-1" />
                          </div>
                        )}
                     </span>
                  </motion.div>
                ))}
                   <div ref={messagesEndRef} />
              </AnimatePresence>
           </div>

           {/* Input Box - Floating Style */}
           <div className="p-8 border-t border-border/30 bg-card/60 backdrop-blur-2xl relative z-10">
              <div className="flex items-center gap-4 bg-background/50 backdrop-blur-md p-3 pl-6 rounded-[2.5rem] border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.05)] focus-within:ring-4 focus-within:ring-primary/5 focus-within:border-primary/30 transition-all">
                 <button className="p-3 text-muted-foreground hover:text-primary transition-all hover:bg-primary/5 rounded-full active:scale-90"><Paperclip size={20} /></button>
                 <input 
                   type="text" 
                   value={message}
                   onChange={(e) => setMessage(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                   placeholder="Digite sua mensagem para o professor..." 
                   className="flex-1 bg-transparent border-none outline-none text-sm font-semibold px-2 py-3 placeholder:text-muted-foreground/50"
                 />
                 <button className="p-3 text-muted-foreground hover:text-primary transition-all hover:bg-primary/5 rounded-full active:scale-90"><Smile size={20} /></button>
                 <button 
                   type="button"
                   onClick={handleSend}
                   disabled={sendMutation.isPending || !message.trim()}
                   className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-2xl shadow-primary/30 hover:scale-110 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 disabled:shadow-none"
                 >
                    <Send size={24} fill="currentColor" className="ml-1" />
                 </button>
              </div>
              
              <div className="flex items-center justify-center gap-4 mt-6">
                 <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                   <ShieldCheck size={14} className="text-emerald-600" />
                   <p className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.1em]">
                     Criptografia de ponta a ponta ativa
                   </p>
                 </div>
              </div>
           </div>
        </Card>
      </div>
    </div>
  );
}
