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
  FileBox
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function StudentMaterials() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  const { data: materials, isLoading } = trpc.studentPortal.getMaterials.useQuery();

  if (isLoading) return <div>Carregando materiais...</div>;

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
    { id: 'documento', label: 'Documentos', icon: FileText },
  ];

  const getIcon = (cat: string) => {
    switch (cat) {
      case 'video': return <Video size={20} className="text-pink-500" />;
      case 'audio': return <Music size={20} className="text-green-500" />;
      case 'pdf': return <FileText size={20} className="text-blue-500" />;
      default: return <FileText size={20} className="text-slate-500" />;
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
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">Meus Materiais</h1>
        <p className="text-muted-foreground font-medium">Acesse todos os materiais disponibilizados pelo seu professor.</p>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input 
            type="text" 
            placeholder="Buscar materiais..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card bg-card border border-border border-border rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all border",
                category === cat.id 
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10" 
                  : "bg-card bg-card text-muted-foreground border-border border-border hover:border-primary/50"
              )}
            >
              <cat.icon size={14} />
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-muted bg-card p-1 rounded-xl">
          <button className="p-2 rounded-lg bg-card dark:bg-slate-800 shadow-sm"><LayoutGrid size={16} /></button>
          <button className="p-2 rounded-lg text-muted-foreground hover:bg-card/50"><List size={16} /></button>
        </div>
      </div>

      {/* Materials List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredMaterials.map((item) => (
          <Card key={item.id} className="border-none shadow-lg bg-card/50 bg-muted/50 backdrop-blur-sm group hover:shadow-xl transition-all overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Icon Box */}
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                  item.category === 'video' ? "bg-pink-500/10" :
                  item.category === 'audio' ? "bg-green-500/10" :
                  "bg-blue-500/10"
                )}>
                  {getIcon(item.category)}
                </div>

                {/* Content */}
                <div className="flex-1 text-center sm:text-left space-y-1">
                  <h3 className="text-lg font-black text-foreground group-hover:text-primary transition-colors truncate">
                    {item.fileName}
                  </h3>
                  <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <span className="flex items-center gap-1">{item.category} • {(item.size ? (item.size / 1024 / 1024).toFixed(1) : 0)} MB</span>
                    <span className="hidden sm:inline">•</span>
                    <span>Enviado em {format(new Date(item.createdAt), "dd/MM/yyyy")}</span>
                  </div>
                </div>

                {/* Action */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-primary/5 border border-primary/20 text-primary px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                    {item.category === 'video' ? <Play size={14} /> : 
                     item.category === 'audio' ? <Music size={14} /> : 
                     <Download size={14} />}
                    {getActionLabel(item.category)}
                  </button>
                  <button className="p-3 rounded-2xl bg-muted dark:bg-slate-800 text-muted-foreground hover:text-foreground transition-colors">
                    <MoreVertical size={18} />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredMaterials.length === 0 && (
          <div className="text-center py-20 bg-muted/50 bg-card/20 rounded-3xl border-2 border-dashed border-border border-border">
            <FileBox className="mx-auto text-muted-foreground mb-4 opacity-20" size={60} />
            <p className="text-muted-foreground font-bold">Nenhum material encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
