import { trpc } from "@/lib/trpc";
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
  const [previewFile, setPreviewFile] = useState<any>(null);
  const { data: materials, isLoading } = trpc.studentPortal.getMaterials.useQuery();

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const filteredMaterials = materials?.filter(m => {
    const matchesSearch = m.fileName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "todos" || m.category === category;
    return matchesSearch && matchesCategory;
  }) || [];

  const categories = [
    { id: 'todos', label: 'Todos', icon: FileBox },
    { id: 'pdf', label: 'Apostilas', icon: FileText },
    { id: 'video', label: 'Vídeos', icon: Video },
    { id: 'audio', label: 'Áudios', icon: Music },
    { id: 'documento', label: 'Docs', icon: FileText },
  ];

  const getIcon = (cat: string) => {
    switch (cat) {
      case 'video': return <Video size={24} className="text-pink-500" />;
      case 'audio': return <Music size={24} className="text-green-500" />;
      case 'pdf': return <FileText size={24} className="text-blue-500" />;
      default: return <FileText size={24} className="text-slate-500" />;
    }
  };

  const getActionLabel = (cat: string) => {
    switch (cat) {
      case 'video': return 'Assistir';
      case 'audio': return 'Ouvir';
      case 'pdf': return 'Baixar';
      default: return 'Baixar';
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Meus Materiais</h1>
          <p className="text-muted-foreground font-medium">Acesse partituras, vídeos e áudios compartilhados pelo seu professor.</p>
        </div>
        <div className="flex items-center gap-2 bg-card p-1 rounded-2xl border border-border shadow-sm">
          <button className="p-2.5 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-all"><LayoutGrid size={18} /></button>
          <button className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-all"><List size={18} /></button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch lg:items-center justify-between bg-card/30 p-4 rounded-3xl border border-border/50 backdrop-blur-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input 
            type="text" 
            placeholder="Buscar nos materiais..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-2xl py-3.5 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                category === cat.id 
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/10 scale-105" 
                  : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:bg-muted"
              )}
            >
              <cat.icon size={14} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Materials List */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4"
      >
        <AnimatePresence mode='popLayout'>
          {filteredMaterials.map((item: any) => (
            <motion.div 
              layout
              variants={item}
              key={item.id}
            >
              <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm group hover:shadow-2xl transition-all overflow-hidden relative">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* Icon Box */}
                    <div className={cn(
                      "w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all group-hover:rotate-6 group-hover:scale-110 shadow-inner",
                      item.category === 'video' ? "bg-pink-100 dark:bg-pink-500/10" :
                      item.category === 'audio' ? "bg-green-100 dark:bg-green-500/10" :
                      "bg-blue-100 dark:bg-blue-500/10"
                    )}>
                      {getIcon(item.category)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <span className={cn(
                          "text-[9px] font-black uppercase px-2 py-0.5 rounded-full",
                          item.category === 'video' ? "bg-pink-100 text-pink-600" :
                          item.category === 'audio' ? "bg-green-100 text-green-600" :
                          "bg-blue-100 text-blue-600"
                        )}>
                          {item.category}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {format(new Date(item.createdAt), "dd MMM yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors truncate">
                        {item.fileName}
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground flex items-center justify-center sm:justify-start gap-2">
                        <Info size={12} className="text-primary" />
                        Tamanho: {(item.size ? (item.size / 1024 / 1024).toFixed(1) : 0)} MB • Partitura e exercícios inclusos
                      </p>
                    </div>

                    {/* Action */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Button 
                        onClick={() => setPreviewFile(item)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary text-white px-8 py-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all border-none"
                      >
                        {item.category === 'video' ? <Play size={16} fill="currentColor" /> : 
                         item.category === 'audio' ? <Music size={16} /> : 
                         <Eye size={16} />}
                        {getActionLabel(item.category)}
                      </Button>
                      
                      <Button 
                        asChild
                        variant="ghost"
                        className="w-12 h-12 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all shadow-sm flex items-center justify-center"
                      >
                        <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" download={item.fileName}>
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
          <div className="text-center py-24 bg-card/30 rounded-[2rem] border-2 border-dashed border-border col-span-full">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <FileBox className="text-muted-foreground opacity-30" size={40} />
            </div>
            <h3 className="text-xl font-black text-foreground">Nenhum material</h3>
            <p className="text-muted-foreground font-medium mt-2">Tente ajustar seus filtros ou busca.</p>
          </div>
        )}
      </motion.div>

      {/* Footer Info */}
      <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/50">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Mostrando {filteredMaterials.length} de {materials?.length || 0} materiais disponíveis
        </p>
        <button className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
          Solicitar material específico <ExternalLink size={12} />
        </button>
      </div>

      {/* MODAL DE PREVIEW DE ARQUIVOS */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
         <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/90 border-none rounded-[2.5rem]">
            <DialogHeader className="p-6 bg-card border-b border-border">
               <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                     <DialogTitle className="text-lg font-black text-foreground uppercase tracking-tight truncate">
                        {previewFile?.fileName}
                     </DialogTitle>
                     <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                        Visualização de Material • {previewFile?.category}
                     </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      asChild
                      className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest px-5 shadow-lg shadow-primary/20 border-none"
                    >
                       <a href={previewFile?.fileUrl} target="_blank" rel="noopener noreferrer" download={previewFile?.fileName}>
                          <Download size={14} className="mr-2" /> Baixar
                       </a>
                    </Button>
                  </div>
               </div>
            </DialogHeader>

            <div className="aspect-video w-full flex items-center justify-center bg-black/40 relative overflow-hidden">
               {previewFile?.category === 'video' && (
                  <video 
                    src={previewFile.fileUrl} 
                    controls 
                    className="max-h-full max-w-full z-10"
                    autoPlay
                  />
               )}
               {previewFile?.category === 'audio' && (
                  <div className="flex flex-col items-center gap-6 z-10 w-full px-12">
                     <div className="w-32 h-32 rounded-[2.5rem] bg-primary flex items-center justify-center text-white shadow-2xl shadow-primary/40">
                        <Music size={48} />
                     </div>
                     <audio 
                       src={previewFile.fileUrl} 
                       controls 
                       className="w-full h-14"
                       autoPlay
                     />
                  </div>
               )}
               {previewFile?.category === 'pdf' && (
                  <iframe 
                    src={`${previewFile.fileUrl}#toolbar=0`} 
                    className="w-full h-full border-none z-10"
                    title={previewFile.fileName}
                  />
               )}
               {previewFile?.category === 'imagem' && (
                  <img 
                    src={previewFile.fileUrl} 
                    alt={previewFile.fileName}
                    className="max-h-full max-w-full object-contain z-10 shadow-2xl"
                  />
               )}
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}
