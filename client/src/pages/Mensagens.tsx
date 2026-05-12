import { 
  Send, 
  Search,
  Music,
  Paperclip,
  Smile,
  Circle,
  Phone,
  Video,
  Info,
  Loader2,
  ChevronLeft
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Mensagens() {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  
  const { data: students, isLoading: loadingStudents } = trpc.students.list.useQuery();
  
  const { data: messages, refetch } = trpc.chat.getMessages.useQuery(
    { withUserId: selectedStudent?.studentUserId as number },
    { enabled: !!selectedStudent?.studentUserId }
  );

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      setMessage("");
      refetch();
    }
  });

  const handleSend = () => {
    if (!message.trim() || !selectedStudent?.studentUserId) return;
    sendMutation.mutate({ receiverId: selectedStudent.studentUserId, content: message });
  };

  const filteredStudents = students?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) && s.studentUserId
  ) || [];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Mensagens</h1>
          <p className="text-muted-foreground font-medium">Comunique-se diretamente com seus alunos.</p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Student List */}
        <div className={cn(
          "flex flex-col gap-4 transition-all duration-300",
          selectedStudent ? "hidden lg:flex lg:w-80" : "flex-1 lg:w-80"
        )}>
           <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Buscar aluno..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-2xl py-3.5 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" 
              />
           </div>
           <Card className="flex-1 border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-3 overflow-y-auto h-full space-y-2">
                 {loadingStudents ? (
                   <div className="flex justify-center p-8">
                     <Loader2 className="animate-spin text-primary" />
                   </div>
                 ) : filteredStudents.length === 0 ? (
                   <div className="text-center p-8 text-muted-foreground text-xs font-bold uppercase tracking-widest opacity-40">
                     Nenhum aluno encontrado
                   </div>
                 ) : filteredStudents.map(student => (
                   <div 
                     key={student.id}
                     onClick={() => setSelectedStudent(student)}
                     className={cn(
                       "p-4 rounded-3xl border transition-all cursor-pointer group",
                       selectedStudent?.id === student.id 
                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                        : "bg-muted/30 border-border/10 hover:bg-muted/50 text-foreground"
                     )}
                   >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black shadow-lg",
                          selectedStudent?.id === student.id ? "bg-white/20" : "bg-primary text-white"
                        )}>
                          {student.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-black truncate">{student.name}</p>
                           <p className={cn(
                             "text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5",
                             selectedStudent?.id === student.id ? "text-white/60" : "text-muted-foreground"
                           )}>
                              {student.instrumentName || "Estudante"}
                           </p>
                        </div>
                      </div>
                   </div>
                 ))}
              </CardContent>
           </Card>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          !selectedStudent ? "hidden lg:flex" : "flex"
        )}>
          {selectedStudent ? (
            <Card className="flex-1 border-none shadow-2xl bg-card/80 backdrop-blur-3xl flex flex-col overflow-hidden relative">
               {/* Chat Header */}
               <div className="p-5 border-b border-border/50 bg-card/50 backdrop-blur-md flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                     <button 
                       onClick={() => setSelectedStudent(null)}
                       className="lg:hidden p-2 hover:bg-muted rounded-xl transition-all"
                     >
                        <ChevronLeft size={20} />
                     </button>
                     <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-sm font-black shadow-xl">
                       {selectedStudent.name.slice(0, 2).toUpperCase()}
                     </div>
                     <div>
                        <h3 className="text-base font-black tracking-tight">{selectedStudent.name}</h3>
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Online agora</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <button className="p-2.5 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-primary"><Phone size={20} /></button>
                     <button className="p-2.5 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-primary"><Video size={20} /></button>
                  </div>
               </div>

               {/* Messages */}
               <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin relative z-10">
                  <AnimatePresence initial={false}>
                    {messages?.map((msg: any, idx: number) => (
                      <motion.div 
                        initial={{ opacity: 0, x: msg.isMe ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
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

               {/* Input */}
               <div className="p-6 border-t border-border/50 bg-card/50 backdrop-blur-md relative z-10">
                  <div className="flex items-center gap-3 bg-muted/40 dark:bg-slate-800/40 p-2.5 pl-4 rounded-[1.5rem] border border-border shadow-inner focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                     <button className="p-2 text-muted-foreground hover:text-primary transition-all active:scale-90"><Paperclip size={20} /></button>
                     <input 
                       type="text" 
                       value={message}
                       onChange={(e) => setMessage(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                       placeholder="Escreva sua mensagem..." 
                       className="flex-1 bg-transparent border-none outline-none text-sm font-medium px-2 py-2"
                     />
                     <button 
                       onClick={handleSend}
                       disabled={sendMutation.isPending}
                       className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                     >
                        <Send size={20} fill="currentColor" className="ml-1" />
                     </button>
                  </div>
               </div>
            </Card>
          ) : (
            <Card className="flex-1 border-none shadow-2xl bg-card/40 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center">
               <div className="w-24 h-24 rounded-[2rem] bg-muted flex items-center justify-center mb-8 opacity-20">
                  <Music size={48} />
               </div>
               <h3 className="text-2xl font-black tracking-tight text-foreground/40">Selecione um aluno</h3>
               <p className="text-sm text-muted-foreground/60 font-medium mt-2 max-w-xs">
                 Escolha um aluno na lista ao lado para iniciar uma conversa direta.
               </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
