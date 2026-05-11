import { 
  Send, 
  MoreHorizontal, 
  Search,
  Music
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StudentMessages() {
  const mockMessages = [
    { id: 1, sender: 'Prof. Eduardo Silva', text: 'Olá Kezia! Enviei um novo exercício de harmonia para você. Dê uma olhada na aba de materiais.', time: '10:30', isMe: false },
    { id: 2, sender: 'Você', text: 'Certo professor! Vou verificar agora mesmo. Obrigado!', time: '10:45', isMe: true },
    { id: 3, sender: 'Prof. Eduardo Silva', text: 'Qualquer dúvida pode me chamar por aqui.', time: '10:50', isMe: false },
  ];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-6 pb-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">Mensagens</h1>
        <p className="text-muted-foreground font-medium">Comunicação direta com seu professor.</p>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Chat List */}
        <div className="hidden md:flex w-80 flex-col gap-4">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <input type="text" placeholder="Buscar conversa..." className="w-full bg-card bg-card border border-border border-border rounded-2xl py-3 pl-12 pr-4 text-xs font-bold outline-none" />
           </div>
           <Card className="flex-1 border-none shadow-lg bg-card/50 bg-muted/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-2">
                 <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3 cursor-pointer transition-all">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xs font-black border border-primary/30">ES</div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-black text-foreground truncate">Prof. Eduardo Silva</p>
                       <p className="text-[10px] font-bold text-primary truncate uppercase tracking-widest">Digitando...</p>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Chat Area */}
        <Card className="flex-1 border-none shadow-2xl bg-card bg-card/80 backdrop-blur-2xl flex flex-col overflow-hidden">
           {/* Chat Header */}
           <div className="p-4 border-b border-border/50 border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-xs font-black shadow-lg">ES</div>
                 <div>
                    <h3 className="text-sm font-black">Prof. Eduardo Silva</h3>
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Online agora</p>
                 </div>
              </div>
              <button className="p-2 hover:bg-muted dark:hover:bg-slate-800 rounded-xl transition-all text-muted-foreground"><MoreHorizontal size={20} /></button>
           </div>

           {/* Messages Scroll Area */}
           <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {mockMessages.map(msg => (
                <div key={msg.id} className={cn(
                  "flex flex-col max-w-[80%]",
                  msg.isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}>
                   <div className={cn(
                     "p-4 rounded-3xl text-sm font-medium shadow-sm",
                     msg.isMe 
                      ? "bg-primary text-white rounded-br-none" 
                      : "bg-muted dark:bg-slate-800 text-foreground rounded-bl-none"
                   )}>
                      {msg.text}
                   </div>
                   <span className="text-[9px] font-black uppercase text-muted-foreground mt-2 tracking-widest">{msg.time}</span>
                </div>
              ))}
           </div>

           {/* Input Area */}
           <div className="p-4 border-t border-border/50 border-border">
              <div className="flex items-center gap-3 bg-muted/50 dark:bg-slate-800 p-2 rounded-2xl">
                 <button className="p-3 text-muted-foreground hover:text-primary transition-colors"><Music size={18} /></button>
                 <input 
                   type="text" 
                   placeholder="Escreva sua mensagem..." 
                   className="flex-1 bg-transparent border-none outline-none text-sm font-medium px-2"
                 />
                 <button className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/10 hover:scale-105 transition-all">
                    <Send size={18} />
                 </button>
              </div>
           </div>
        </Card>
      </div>
    </div>
  );
}
