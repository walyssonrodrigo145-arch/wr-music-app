import { trpc } from "@/lib/trpc";
import { getFixedUrl } from "@/lib/utils";
import { 
  Search, 
  Filter, 
  LayoutGrid, 
  List,
  FileText,
  Video,
  Music,
  Download,
  Play,
  Eye,
  MoreVertical,
  FileBox,
  ExternalLink,
  Info,
  Loader2,
  X
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export default function StudentMaterials() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [previewFile, setPreviewFile] = useState<any>(null);
  const { data: materials, isLoading } = trpc.studentPortal.getMaterials.useQuery();

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const filteredMaterials = materials?.filter(m => {
    const matchesSearch = m.fileName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "todos" || 
                          (category === "pdf" && (m.category === "pdf" || m.category === "documento")) ||
                          m.category === category;
    return matchesSearch && matchesCategory;
  }) || [];

  const categories = [
    { id: 'todos', label: 'Todos', icon: FileBox },
    { id: 'pdf', label: 'Apostilas', icon: FileText },
    { id: 'video', label: 'Vídeos', icon: Video },
    { id: 'audio', label: 'Áudios', icon: Music },
  ];

  const getIcon = (cat: string) => {
    switch (cat) {
      case 'video': return <Video size={32} className="text-pink-500" />;
      case 'audio': return <Music size={32} className="text-emerald-500" />;
      case 'pdf': return <FileText size={32} className="text-blue-500" />;
      default: return <FileText size={32} className="text-slate-500" />;
    }
  };

  const getActionLabel = (cat: string) => {
    switch (cat) {
      case 'video': return 'Assistir';
      case 'audio': return 'Ouvir';
      case 'pdf': return 'Visualizar';
      default: return 'Visualizar';
    }
  };

  return (
    <div className="space-y-10 pb-10 max-w-[1400px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">
            <FileBox size={12} />
            Biblioteca de Estudos
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">Meus Materiais</h1>
          <p className="text-muted-foreground text-sm max-w-xl font-medium">
            Sua central de estudos com todas as partituras, vídeos e áudios compartilhados para acelerar sua evolução.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-2xl border border-border/50 shadow-sm backdrop-blur-md">
          <button 
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-xs font-bold",
              viewMode === "grid" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <LayoutGrid size={16} /> Grade
          </button>
          <button 
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-xs font-bold",
              viewMode === "list" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <List size={16} /> Lista
          </button>
        </div>
      </div>

      {/* Filters and Search - Premium Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-card/40 p-4 rounded-[2rem] border border-border/50 backdrop-blur-sm shadow-xl shadow-black/5">
        <div className="md:col-span-5 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="O que você está procurando?" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background/50 border border-border/50 rounded-2xl py-4 pl-14 pr-6 text-sm font-semibold focus:ring-4 focus:ring-primary/10 focus:border-primary/50 outline-none transition-all shadow-inner"
          />
        </div>

        <div className="md:col-span-7 flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
          <div className="w-px h-10 bg-border/50 mx-2 hidden md:block" />
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border shrink-0",
                category === cat.id 
                  ? "bg-primary text-white border-primary shadow-xl shadow-primary/20 -translate-y-0.5" 
                  : "bg-background/40 text-muted-foreground border-border/50 hover:border-primary/30 hover:bg-background/80"
              )}
            >
              <cat.icon size={16} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Display */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className={cn(
          "grid gap-8",
          viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}
      >
        <AnimatePresence mode='popLayout'>
          {filteredMaterials.map((item: any) => (
            <motion.div 
              layout
              variants={item}
              key={item.id}
              className="group"
            >
              <Card className={cn(
                "h-full border border-border/50 shadow-xl bg-card/60 backdrop-blur-md hover:shadow-2xl hover:border-primary/30 transition-all duration-500 rounded-[2.5rem] overflow-hidden flex flex-col",
                viewMode === "list" && "flex-row h-32 items-center"
              )}>
                <CardContent className="p-0 flex flex-col h-full flex-1">
                  {/* Media Section */}
                  <div className={cn(
                    "relative overflow-hidden shrink-0",
                    viewMode === "grid" ? "aspect-[16/10] w-full" : "w-40 h-full border-r border-border/30"
                  )}>
                    {/* Background Pattern/Color */}
                    <div className={cn(
                      "absolute inset-0 transition-transform duration-700 group-hover:scale-110",
                      item.category === 'video' ? "bg-pink-500/5" :
                      item.category === 'audio' ? "bg-emerald-500/5" :
                      "bg-blue-500/5"
                    )} />
                    
                    {/* Floating Badge */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className={cn(
                        "text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5 backdrop-blur-md border",
                        item.category === 'video' ? "bg-pink-500/10 text-pink-600 border-pink-500/20" :
                        item.category === 'audio' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                        "bg-blue-500/10 text-blue-600 border-blue-500/20"
                      )}>
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          item.category === 'video' ? "bg-pink-500" :
                          item.category === 'audio' ? "bg-emerald-500" :
                          "bg-blue-500"
                        )} />
                        {item.category}
                      </span>
                    </div>

                    {/* Icon Centered */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-40 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110">
                      <div className={cn(
                        "p-6 rounded-[2rem] bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl transition-all group-hover:bg-white/20",
                        item.category === 'video' ? "text-pink-500" :
                        item.category === 'audio' ? "text-emerald-500" :
                        "text-blue-500"
                      )}>
                        {getIcon(item.category)}
                      </div>
                    </div>
                  </div>

                  {/* Info Section */}
                  <div className={cn(
                    "p-8 flex flex-col flex-1 gap-6",
                    viewMode === "list" && "flex-row items-center justify-between p-6 gap-4"
                  )}>
                    <div className="space-y-3 min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                         <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded-md">
                          {format(new Date(item.createdAt), "dd MMM yyyy", { locale: ptBR })}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                          {(item.size ? (item.size / 1024 / 1024).toFixed(1) : 0)} MB
                        </span>
                      </div>
                      
                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors truncate tracking-tight leading-snug">
                        {item.fileName}
                      </h3>
                      
                      {viewMode === "grid" && (
                        <div className="flex items-center gap-3 py-1">
                          <div className="flex -space-x-2">
                             {[1,2].map(i => (
                               <div key={i} className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[8px] font-bold text-muted-foreground overflow-hidden">
                                 {i === 1 ? <Info size={10} /> : <FileText size={10} />}
                               </div>
                             ))}
                          </div>
                          <p className="text-[11px] font-semibold text-muted-foreground">
                            Inclui exercícios e partituras
                          </p>
                        </div>
                      )}
                    </div>

                    <div className={cn(
                      "flex items-center gap-3",
                      viewMode === "grid" ? "w-full" : "shrink-0"
                    )}>
                      <Button 
                        onClick={() => setPreviewFile(item)}
                        className="flex-1 h-14 rounded-2xl bg-primary text-white font-bold text-xs shadow-xl shadow-primary/20 hover:scale-[1.03] active:scale-95 transition-all border-none gap-3"
                      >
                        {item.category === 'video' ? <Play size={18} fill="currentColor" /> : 
                         item.category === 'audio' ? <Music size={18} /> : 
                         <Eye size={18} />}
                        {getActionLabel(item.category)}
                      </Button>
                      
                      <Button 
                        asChild
                        variant="outline"
                        className="w-14 h-14 rounded-2xl bg-background border-border/50 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center shrink-0 shadow-sm"
                      >
                        <a href={getFixedUrl(item.fileUrl)} target="_blank" rel="noopener noreferrer" download={item.fileName}>
                          <Download size={20} />
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredMaterials.length === 0 && (
          <div className="text-center py-32 bg-card/20 rounded-[3rem] border-2 border-dashed border-border/50 col-span-full">
            <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <FileBox className="text-muted-foreground/30" size={48} />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Nada por aqui ainda</h3>
            <p className="text-muted-foreground font-medium mt-3 max-w-xs mx-auto">Não encontramos materiais com esses filtros. Tente buscar por outros termos.</p>
            <Button 
              variant="outline" 
              onClick={() => { setSearch(""); setCategory("todos"); }}
              className="mt-8 rounded-xl px-8 border-primary/30 text-primary hover:bg-primary/5 font-bold"
            >
              Limpar Filtros
            </Button>
          </div>
        )}
      </motion.div>

      {/* Footer / CTA Section */}
      <div className="pt-12 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-border/30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground/50">
            <Info size={20} />
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.1em]">
            Exibindo <span className="text-primary font-bold">{filteredMaterials.length}</span> de <span className="font-bold">{materials?.length || 0}</span> arquivos
          </p>
        </div>
        
        <button 
          onClick={() => window.location.href = '/aluno/mensagens'}
          className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-primary/5 text-xs font-bold text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all shadow-sm"
        >
          Precisa de algo específico? <span className="opacity-60 group-hover:opacity-100 transition-opacity">Contatar Professor</span>
          <ExternalLink size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* PREVIEW DIALOG - Premium Redesign */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
         <DialogContent className="max-w-5xl p-0 overflow-hidden bg-background border-none rounded-[3rem] shadow-2xl">
            <DialogHeader className="p-8 bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-20">
               <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-widest border border-primary/20">
                           {previewFile?.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                           Visualização em Alta Definição
                        </span>
                     </div>
                     <DialogTitle className="text-2xl font-black text-foreground tracking-tight truncate leading-none">
                        {previewFile?.fileName}
                     </DialogTitle>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      asChild
                      className="h-12 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold px-6 shadow-xl shadow-primary/20 border-none transition-all hover:scale-105 active:scale-95"
                    >
                       <a href={getFixedUrl(previewFile?.fileUrl)} target="_blank" rel="noopener noreferrer" download={previewFile?.fileName}>
                          <Download size={18} className="mr-2" /> Baixar Arquivo
                       </a>
                    </Button>
                    <button 
                      onClick={() => setPreviewFile(null)}
                      className="w-12 h-12 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground flex items-center justify-center transition-all"
                    >
                      <X size={20} />
                    </button>
                  </div>
               </div>
            </DialogHeader>

            <div className="aspect-video w-full flex items-center justify-center bg-muted/30 relative overflow-hidden">
               {/* Content Rendering (kept original logic but with container polish) */}
               <div className="w-full h-full flex items-center justify-center relative z-10">
                 {previewFile?.category === 'video' && (
                    <video 
                      src={getFixedUrl(previewFile.fileUrl)} 
                      controls 
                      className="max-h-[90%] max-w-[95%] rounded-2xl shadow-2xl bg-black"
                      autoPlay
                    />
                 )}
                 {previewFile?.category === 'audio' && (
                    <div className="flex flex-col items-center gap-10 w-full max-w-2xl px-12 py-20 bg-card rounded-[3rem] shadow-2xl border border-border/50">
                       <div className="w-40 h-40 rounded-[3rem] bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-primary/30 relative">
                          <Music size={64} className="relative z-10" />
                          <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-20" />
                       </div>
                       <div className="text-center space-y-2">
                          <p className="text-sm font-bold text-primary uppercase tracking-[0.2em]">Reproduzindo Áudio</p>
                          <p className="text-xl font-bold text-foreground">{previewFile.fileName}</p>
                       </div>
                       <audio 
                         src={getFixedUrl(previewFile.fileUrl)} 
                         controls 
                         className="w-full h-14 custom-audio-player"
                         autoPlay
                       />
                    </div>
                 )}
                 {previewFile?.category === 'pdf' && (
                    <iframe 
                      src={`${getFixedUrl(previewFile.fileUrl)}#toolbar=0`} 
                      className="w-full h-full border-none"
                      title={previewFile.fileName}
                    />
                 )}
                 {previewFile?.category === 'imagem' && (
                    <img 
                      src={getFixedUrl(previewFile.fileUrl)} 
                      alt={previewFile.fileName}
                      className="max-h-[90%] max-w-[95%] object-contain rounded-2xl shadow-2xl border border-border/50"
                    />
                 )}
               </div>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
