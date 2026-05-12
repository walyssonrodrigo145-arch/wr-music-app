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
  Info
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function StudentMessages() {
  const { data: dashboard } = trpc.studentPortal.getDashboard.useQuery();
  const [message, setMessage] = useState("");

  const { data: messages, refetch } = trpc.studentPortal.getMessages.useQuery(
    { withUserId: dashboard?.teacherId as number },
    { enabled: !!dashboard?.teacherId }
  );

  const sendMutation = trpc.studentPortal.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
    }
  });

  const handleSend = () => {
    if (!message.trim() || !dashboard?.teacherId) return;
    sendMutation.mutate({ receiverId: dashboard.teacherId, content: message });
  };

  const displayMessages = messages || [];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Mensagens</h1>
          <p className="text-muted-foreground font-medium">Canal direto com seu professor para dúvidas e orientações.</p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Chat List - Desktop */}
        <div className="hidden lg:flex w-80 flex-col gap-4">
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Buscar conversa..." 
                className="w-full bg-card border border-border rounded-2xl py-3.5 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" 
              />
           </div>
           <Card className="flex-1 border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-3">
                 <div className="p-4 rounded-3xl bg-primary/5 border border-primary/20 flex items-center gap-4 cursor-pointer transition-all hover:bg-primary/10 group">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-lg">
                        {dashboard?.teacherName?.slice(0, 2).toUpperCase() || "PR"}
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-card flex items-center justify-center">
                         <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">Prof. {dashboard?.teacherName || "Carregando..."}</p>
                       <p className="text-[10px] font-bold text-primary truncate uppercase tracking-widest flex items-center gap-1.5">
                          <Circle size={8} fill="currentColor" className="animate-pulse" />
                          Online
                       </p>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Chat Area */}
        <Card className="flex-1 border-none shadow-2xl bg-card/80 backdrop-blur-3xl flex flex-col overflow-hidden relative">
           {/* Decorative Background */}
           <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none flex items-center justify-center rotate-12 scale-150">
              <Music size={400} strokeWidth={1} />
           </div>

           {/* Chat Header */}
           <div className="p-5 border-b border-border/50 bg-card/50 backdrop-blur-md flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                 <button className="lg:hidden p-2 hover:bg-muted rounded-xl transition-all">
                    <ChevronLeft size={20} />
                 </button>
                 <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-sm font-black shadow-xl">
                      {dashboard?.teacherName?.slice(0, 2).toUpperCase() || "PR"}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-card" />
                 </div>
                 <div>
                    <h3 className="text-base font-black tracking-tight">Prof. {dashboard?.teacherName || "Professor"}</h3>
                    <div className="flex items-center gap-1.5">
                       <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Online agora</p>
                    </div>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <button className="p-2.5 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-primary"><Phone size={20} /></button>
                 <button className="p-2.5 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-primary"><Video size={20} /></button>
                 <div className="w-px h-6 bg-border mx-2" />
                 <button className="p-2.5 hover:bg-muted rounded-xl transition-all text-muted-foreground"><MoreHorizontal size={20} /></button>
              </div>
           </div>

           {/* Messages Scroll Area */}
           <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin relative z-10">
               <AnimatePresence initial={false}>
                {displayMessages.map((msg: any, idx: number) => (
                  <motion.div 
                    initial={{ opacity: 0, x: msg.isMe ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={msg.id} 
                    className={cn(
                      "flex flex-col max-w-[75%]",
                      msg.isMe ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                     <div className={cn(
                       "p-4 px-6 rounded-[2rem] text-sm font-medium shadow-sm transition-all hover:shadow-md",
                       msg.isMe 
                        ? "bg-primary text-white rounded-br-none" 
                        : "bg-muted dark:bg-slate-800 text-foreground rounded-bl-none"
                     )}>
                        {msg.content}
                     </div>
                     <span className="text-[9px] font-black uppercase text-muted-foreground mt-3 tracking-widest flex items-center gap-2">
                        {format(new Date(msg.createdAt), "HH:mm")}
                        {msg.isMe && <Circle size={4} fill="currentColor" className="text-primary" />}
                     </span>
                  </motion.div>
                ))}
              </AnimatePresence>
           </div>

           {/* Input Area */}
           <div className="p-6 border-t border-border/50 bg-card/50 backdrop-blur-md relative z-10">
              <div className="flex items-center gap-3 bg-muted/40 dark:bg-slate-800/40 p-2.5 pl-4 rounded-[1.5rem] border border-border shadow-inner focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                 <button className="p-2 text-muted-foreground hover:text-primary transition-all active:scale-90"><Paperclip size={20} /></button>
                 <input 
                   type="text" 
                   value={message}
                   onChange={(e) => setMessage(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                   placeholder="Escreva sua mensagem aqui..." 
                   className="flex-1 bg-transparent border-none outline-none text-sm font-medium px-2 py-2"
                 />
                 <button className="p-2 text-muted-foreground hover:text-primary transition-all active:scale-90"><Smile size={20} /></button>
                 <button 
                   onClick={handleSend}
                   disabled={sendMutation.isPending}
                   className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                 >
                    <Send size={20} fill="currentColor" className="ml-1" />
                 </button>
              </div>
              <div className="flex items-center justify-center gap-4 mt-4">
                 <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                   <Info size={10} className="text-primary" />
                   As mensagens são criptografadas de ponta a ponta
                 </p>
              </div>
           </div>
        </Card>
      </div>
    </div>
  );
}
