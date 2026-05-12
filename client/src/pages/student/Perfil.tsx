import { trpc } from "@/lib/trpc";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Music, 
  Trophy,
  GraduationCap,
  Clock,
  Settings
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { EditProfileModal } from "@/components/EditProfileModal";

export default function StudentProfile() {
  const { data: profile, isLoading } = trpc.studentPortal.getProfile.useQuery();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (isLoading) return <div>Carregando perfil...</div>;

  const initials = profile?.name
    ? profile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "AL";

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Meu Perfil</h1>
          <p className="text-muted-foreground font-medium">Suas informações de aluno e do seu curso.</p>
        </div>
        <button 
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center gap-2 bg-muted bg-card border border-border border-border rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all shadow-sm"
        >
          <Settings size={16} /> Configurações
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <Card className="border-none shadow-xl bg-card/50 bg-muted/50 backdrop-blur-xl overflow-hidden">
          <div className="h-32 bg-gradient-to-br from-primary/20 to-violet-500/20" />
          <CardContent className="px-8 pb-8 -mt-16 text-center">
            <Avatar className="w-32 h-32 mx-auto border-4 border-white dark:border-slate-900 shadow-2xl mb-4">
              <AvatarImage src="" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-3xl font-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-black text-foreground">{profile?.name}</h2>
            <p className="text-sm font-bold text-primary uppercase tracking-widest mt-1">Aluno {profile?.level}</p>
            
            <div className="mt-8 pt-8 border-t border-border/50 border-border space-y-4">
               <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                  <Mail size={16} className="text-primary" />
                  <span>{profile?.email || 'Não informado'}</span>
               </div>
               <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                  <Phone size={16} className="text-primary" />
                  <span>{profile?.phone || 'Não informado'}</span>
               </div>
               <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                  <Calendar size={16} className="text-primary" />
                  <span>Início em {profile?.startDate ? format(new Date(profile.startDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'N/A'}</span>
               </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-none shadow-lg bg-card/50 bg-muted/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <Music size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Instrumento</p>
                      <p className="text-base font-black text-foreground">Violão Erudito</p> {/* Mock instrument */}
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-card/50 bg-muted/50 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                      <GraduationCap size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Professor Responsável</p>
                      <p className="text-base font-black text-foreground">{profile?.teacherName}</p>
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-lg bg-card/50 bg-muted/50 backdrop-blur-sm">
            <CardContent className="p-8">
               <h3 className="text-lg font-black mb-6">Conquistas e Habilidades</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Frequência Geral</span>
                        <span className="text-sm font-black text-green-600">95%</span>
                     </div>
                     <div className="h-2 w-full bg-muted dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 w-[95%]" />
                     </div>
                  </div>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Exercícios Concluídos</span>
                        <span className="text-sm font-black text-blue-600">18/20</span>
                     </div>
                     <div className="h-2 w-full bg-muted dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-[90%]" />
                     </div>
                  </div>
               </div>

               <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                     { icon: Trophy, label: "Habilidade", value: "Técnica" },
                     { icon: Clock, label: "Prática", value: "24h/Mês" },
                     { icon: Music, label: "Repertório", value: "12 Peças" },
                     { icon: Trophy, label: "Nível", value: profile?.level },
                  ].map((item, i) => (
                     <div key={i} className="text-center p-4 rounded-2xl bg-muted/50 bg-card/40 border border-border/50 border-border group hover:border-primary/30 transition-all">
                        <item.icon size={20} className="mx-auto text-primary mb-2 transition-transform group-hover:scale-110" />
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
                        <p className="text-xs font-black text-foreground uppercase">{item.value}</p>
                     </div>
                  ))}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {profile && (
        <EditProfileModal 
          open={isEditModalOpen} 
          onOpenChange={setIsEditModalOpen}
          initialData={{
            phone: profile.phone || "",
            email: profile.email || "",
          }}
        />
      )}
    </div>
  );
}
