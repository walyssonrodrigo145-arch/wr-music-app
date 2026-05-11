import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  User, Building2, Bell, Palette, Shield, Save,
  Sun, Moon, Phone, Mail, Globe, MapPin, FileText,
  CheckCircle2, Music, Loader2, AlertTriangle, Download, Smartphone,
} from "lucide-react";

// ─── Export CSV helper ──────────────────────────────────────────────────────
function downloadCsv(content: string, filename: string) {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportDataSection() {
  const [exporting, setExporting] = useState(false);
  const { refetch } = trpc.settings.exportData.useQuery(undefined, { enabled: false });

  const handleExport = async (type: 'alunos' | 'aulas' | 'completo') => {
    setExporting(true);
    try {
      const { data } = await refetch();
      if (!data) { toast.error('Erro ao exportar dados'); return; }
      const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      if (type === 'alunos' || type === 'completo') {
        downloadCsv(data.studentsCsv, `alunos_${date}.csv`);
      }
      if (type === 'aulas' || type === 'completo') {
        downloadCsv(data.lessonsCsv, `aulas_${date}.csv`);
      }
      toast.success('Arquivo(s) CSV baixado(s) com sucesso!');
    } catch (e) {
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
      <div>
        <p className="text-xs font-semibold text-foreground mb-1">Exportar dados</p>
        <p className="text-[10px] text-muted-foreground">Baixe uma cópia dos seus dados em formato CSV (compatível com Excel).</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="text-xs rounded-xl gap-2" disabled={exporting}
          onClick={() => handleExport('alunos')}>
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          Exportar Alunos
        </Button>
        <Button variant="outline" size="sm" className="text-xs rounded-xl gap-2" disabled={exporting}
          onClick={() => handleExport('aulas')}>
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          Exportar Aulas
        </Button>
        <Button size="sm" className="text-xs rounded-xl gap-2" disabled={exporting}
          onClick={() => handleExport('completo')}>
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
          Exportar Tudo
        </Button>
      </div>
    </div>
  );
}

function PwaInstallSection() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verificar se já está rodando como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Checagem imediata: o evento pode já ter disparado antes do componente carregar
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    // Listener para o evento global capturado no index.html
    const handlePromptReady = () => {
      setDeferredPrompt((window as any).deferredPrompt);
    };

    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
    };
  }, []);

  const handleInstall = async () => {
    const promptEvent = deferredPrompt || (window as any).deferredPrompt;
    if (!promptEvent) {
      toast.info("O navegador ainda não liberou a instalação. Aguarde alguns segundos ou use o menu do Chrome.");
      return;
    }

    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    console.log(`[PWA] Usuário escolheu: ${outcome}`);
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
    }
  };

  if (isInstalled) return null;

  const isFirefox = (typeof navigator !== 'undefined') && navigator.userAgent.toLowerCase().includes('firefox');

  if (isFirefox) {
    return (
      <div className="p-4 bg-orange-500/10 rounded-xl border border-orange-500/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-600">
            <Smartphone size={16} />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Instalar no Firefox (Android)</p>
            <p className="text-[10px] text-muted-foreground">O Firefox requer instalação manual.</p>
          </div>
        </div>
        <div className="space-y-2 p-2 bg-orange-500/5 rounded-lg border border-orange-500/10">
          <p className="text-[10px] text-foreground font-medium">Siga os passos:</p>
          <ol className="text-[10px] text-muted-foreground space-y-1 list-decimal pl-4">
            <li>Toque nos <strong>três pontinhos</strong> (menu) no canto do Firefox.</li>
            <li>Selecione a opção <strong>"Instalar"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</li>
            <li>Confirme a instalação e pronto!</li>
          </ol>
        </div>
      </div>
    );
  }

  if (!deferredPrompt) {
    // Se não há prompt, mas também não está instalado, mostramos um aviso de como fazer manual
    return (
      <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Smartphone size={16} />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Instalar no Celular</p>
            <p className="text-[10px] text-muted-foreground">O sistema funciona melhor se for instalado como aplicativo.</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed italic">
          * Dica: Se o botão não aparecer, use a opção "Instalar Aplicativo" ou "Adicionar à tela inicial" no menu do seu navegador Chrome.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-indigo-500/100/10 rounded-xl border border-indigo-500/20 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/100 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
          <Download size={20} />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Instalar WR Music App</p>
          <p className="text-xs text-muted-foreground">Acesse como um aplicativo real na sua tela inicial.</p>
        </div>
      </div>
      <Button 
        onClick={handleInstall}
        className="w-full h-10 rounded-xl bg-indigo-500/100 hover:bg-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-95"
      >
        INSTALAR AGORA
      </Button>
    </div>
  );
}

function CleanupTestDataSection() {
  const [cleaning, setCleaning] = useState(false);
  const utils = trpc.useUtils();
  const cleanupMutation = trpc.system.cleanupTestData.useMutation({
    onSuccess: (data: { studentsRemoved: number; lessonsRemoved: number }) => {
      toast.success(`Limpeza concluída! ${data.studentsRemoved} alunos e ${data.lessonsRemoved} aulas de teste removidos.`);
      utils.invalidate(); // Refresh all data
    },
    onError: (e: any) => toast.error("Erro ao limpar dados: " + e.message),
    onSettled: () => setCleaning(false),
  });

  const handleCleanup = () => {
    if (window.confirm("🚨 ATENÇÃO: Tem certeza que deseja excluir TODOS os dados de teste? Esta ação é permanente e não pode ser desfeita.")) {
      setCleaning(true);
      cleanupMutation.mutate();
    }
  };

  return (
    <div className="p-4 bg-red-500/10 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/30 space-y-3">
      <div>
        <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1 flex items-center gap-2">
          <AlertTriangle size={14} /> Zona de Perigo
        </p>
        <p className="text-[10px] text-red-600/80 dark:text-red-500">
          Remover todos os registros que contenham a palavra "teste" no nome, e-mail ou título.
        </p>
      </div>
      <Button 
        variant="destructive" 
        size="sm" 
        className="text-xs rounded-xl gap-2 font-bold bg-red-600 hover:bg-red-700" 
        disabled={cleaning}
        onClick={handleCleanup}
      >
        {cleaning ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
        Limpar Dados de Teste
      </Button>
    </div>
  );
}

// ─── Tab types ───────────────────────────────────────────────────────────────
type Tab = "perfil" | "escola" | "notificacoes" | "aparencia" | "seguranca";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "escola", label: "Escola", icon: Building2 },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "seguranca", label: "Segurança", icon: Shield },
];

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Configuracoes() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<Tab>("perfil");

  const { data: settings, isLoading } = trpc.settings.get.useQuery();

  // ── Perfil state ──
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileBio, setProfileBio] = useState("");

  // ── Escola state ──
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolCity, setSchoolCity] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolWebsite, setSchoolWebsite] = useState("");
  const [schoolDescription, setSchoolDescription] = useState("");

  // ── Notificações state ──
  const [notifyLesson, setNotifyLesson] = useState(true);
  const [notifyPayment, setNotifyPayment] = useState(true);
  const [notifyAbsence, setNotifyAbsence] = useState(true);
  const [notifyNewStudent, setNotifyNewStudent] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(false);

  // Populate from DB
  useEffect(() => {
    if (user) {
      setProfileName(user.name ?? "");
      setProfileEmail(user.email ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (settings) {
      setProfilePhone(settings.phone ?? "");
      setProfileBio(settings.bio ?? "");
      setSchoolName(settings.schoolName ?? "");
      setSchoolAddress(settings.schoolAddress ?? "");
      setSchoolCity(settings.schoolCity ?? "");
      setSchoolPhone(settings.schoolPhone ?? "");
      setSchoolWebsite(settings.schoolWebsite ?? "");
      setSchoolDescription(settings.schoolDescription ?? "");
      setNotifyLesson(settings.notifyLessonReminder === 1);
      setNotifyPayment(settings.notifyPaymentDue === 1);
      setNotifyAbsence(settings.notifyStudentAbsence === 1);
      setNotifyNewStudent(settings.notifyNewStudent === 1);
      setNotifyWeekly(settings.notifyWeeklyReport === 1);
    }
  }, [settings]);

  // ── Mutations ──
  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!", { icon: <CheckCircle2 size={16} className="text-emerald-500" /> });
      utils.auth.me.invalidate();
      utils.settings.get.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar perfil: " + e.message),
  });

  const updateSchool = trpc.settings.updateSchool.useMutation({
    onSuccess: () => {
      toast.success("Dados da escola atualizados!", { icon: <CheckCircle2 size={16} className="text-emerald-500" /> });
    utils.settings.get.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar escola: " + e.message),
  });

  const updateNotifications = trpc.settings.updateNotifications.useMutation({
    onSuccess: () => {
      toast.success("Preferências de notificação salvas!", { icon: <CheckCircle2 size={16} className="text-emerald-500" /> });
      utils.settings.get.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const updateTheme = trpc.settings.updateTheme.useMutation({
    onError: (e) => toast.error("Erro ao salvar tema: " + e.message),
  });

  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) ?? "P";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-background">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 scrollbar-thin no-scrollbar">
        {/* Header */}
        <div className="flex items-center gap-3 lg:gap-4">
          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-muted/40 flex items-center justify-center shadow-sm">
            <Shield size={22} className="text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight leading-none">Configurações</h2>
            <p className="text-[10px] lg:text-xs text-muted-foreground font-medium mt-1 lg:mt-2">Gerencie seu perfil e preferências do sistema</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          {/* Sidebar de abas - Horizontal scroll on mobile */}
          <div className="w-full lg:w-64 shrink-0 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
            <div className="flex lg:flex-col gap-2 bg-card p-2 rounded-2xl border border-border shadow-sm min-w-max lg:min-w-0">
              {TABS.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all lg:w-full text-left uppercase tracking-widest",
                      activeTab === tab.id
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                        : "text-muted-foreground hover:bg-muted hover:text-muted-foreground"
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conteúdo da aba */}
          <div className="flex-1 w-full bg-card rounded-[2rem] border border-border shadow-sm p-6 lg:p-10">

            {/* ── ABA: PERFIL ── */}
            {activeTab === "perfil" && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest">Meu Perfil</h3>
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Suas informações pessoais</p>
                  </div>
                  <Button
                    className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-lg shadow-indigo-500/20"
                    disabled={updateProfile.isPending}
                    onClick={() => updateProfile.mutate({ name: profileName, email: profileEmail, phone: profilePhone, bio: profileBio })}
                  >
                    {updateProfile.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span className="text-xs font-black uppercase tracking-widest">Salvar</span>
                  </Button>
                </div>

                <div className="flex items-center gap-6 p-6 bg-muted rounded-[1.5rem] border border-border">
                  <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-[1.5rem] bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-xl shadow-indigo-500/20 shrink-0">
                    <span className="text-2xl font-black text-white">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-base lg:text-xl font-black text-foreground truncate">{user?.name || "Professor"}</p>
                    <p className="text-xs lg:text-sm font-bold text-muted-foreground truncate mt-1">{user?.email}</p>
                    <div className="mt-3">
                      <span className="px-3 py-1 rounded-lg bg-indigo-500/20 text-[10px] font-black text-indigo-700 uppercase tracking-widest">Administrador</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  <Field label="Nome completo">
                    <div className="relative">
                      <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={profileName}
                        onChange={e => setProfileName(e.target.value)}
                        placeholder="Seu nome"
                        className="pl-11 h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                      />
                    </div>
                  </Field>

                  <Field label="E-mail profissional">
                    <div className="relative">
                      <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={profileEmail}
                        onChange={e => setProfileEmail(e.target.value)}
                        placeholder="seu@email.com"
                        type="email"
                        className="pl-11 h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                      />
                    </div>
                  </Field>

                  <Field label="Telefone / WhatsApp">
                    <div className="relative">
                      <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={profilePhone}
                        onChange={e => setProfilePhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="pl-11 h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                      />
                    </div>
                  </Field>
                </div>

                <Field label="Bio / Apresentação" hint="Aparece no seu perfil público">
                  <div className="relative">
                    <FileText size={14} className="absolute left-4 top-4 text-muted-foreground" />
                    <textarea
                      value={profileBio}
                      onChange={e => setProfileBio(e.target.value)}
                      placeholder="Conte um pouco sobre você..."
                      rows={4}
                      className="w-full pl-11 pr-4 py-4 text-sm font-bold rounded-xl border border-border bg-muted focus:bg-card transition-all shadow-sm resize-none text-foreground outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </Field>
              </div>
            )}

            {/* ── ABA: ESCOLA ── */}
            {activeTab === "escola" && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest">Dados da Escola</h3>
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Identidade da sua escola</p>
                  </div>
                  <Button
                    className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-lg shadow-indigo-500/20"
                    disabled={updateSchool.isPending}
                    onClick={() => updateSchool.mutate({ schoolName, schoolAddress, schoolCity, schoolPhone, schoolWebsite, schoolDescription })}
                  >
                    {updateSchool.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span className="text-xs font-black uppercase tracking-widest">Salvar</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  <Field label="Nome da escola">
                    <Input
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      placeholder="Ex: Escola Harmonia"
                      className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                    />
                  </Field>

                  <Field label="Telefone comercial">
                    <Input
                      value={schoolPhone}
                      onChange={e => setSchoolPhone(e.target.value)}
                      placeholder="(11) 3333-4444"
                      className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                    />
                  </Field>

                  <Field label="Cidade / UF">
                    <Input
                      value={schoolCity}
                      onChange={e => setSchoolCity(e.target.value)}
                      placeholder="Ex: São Paulo, SP"
                      className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                    />
                  </Field>

                  <Field label="Endereço">
                    <Input
                      value={schoolAddress}
                      onChange={e => setSchoolAddress(e.target.value)}
                      placeholder="Rua, número, bairro"
                      className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                    />
                  </Field>
                </div>

                <Field label="Site ou Instagram">
                  <Input
                    value={schoolWebsite}
                    onChange={e => setSchoolWebsite(e.target.value)}
                    placeholder="https://suaescola.com.br"
                    className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                  />
                </Field>

                <Field label="Sobre a escola">
                  <textarea
                    value={schoolDescription}
                    onChange={e => setSchoolDescription(e.target.value)}
                    placeholder="Breve descrição da metodologia..."
                    rows={4}
                    className="w-full px-4 py-4 text-sm font-bold rounded-xl border border-border bg-muted focus:bg-card transition-all shadow-sm resize-none text-foreground outline-none"
                  />
                </Field>
              </div>
            )}

            {/* ── ABA: NOTIFICAÇÕES ── */}
            {activeTab === "notificacoes" && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest">Notificações</h3>
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Controle de alertas</p>
                  </div>
                  <Button
                    className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-lg shadow-indigo-500/20"
                    disabled={updateNotifications.isPending}
                    onClick={() => updateNotifications.mutate({
                      notifyLessonReminder: notifyLesson,
                      notifyPaymentDue: notifyPayment,
                      notifyStudentAbsence: notifyAbsence,
                      notifyNewStudent: notifyNewStudent,
                      notifyWeeklyReport: notifyWeekly,
                    })}
                  >
                    {updateNotifications.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span className="text-xs font-black uppercase tracking-widest">Salvar</span>
                  </Button>
                </div>

                <div className="space-y-4">
                  {[
                    { label: "Lembrete de aulas", desc: "Aviso 1h antes de cada aula", value: notifyLesson, onChange: setNotifyLesson },
                    { label: "Pagamento pendente", desc: "Alerta de mensalidade próxima do vencimento", value: notifyPayment, onChange: setNotifyPayment },
                    { label: "Falta de aluno", desc: "Notificação quando um aluno não comparecer", value: notifyAbsence, onChange: setNotifyAbsence },
                    { label: "Relatório semanal", desc: "Resumo de desempenho toda segunda-feira", value: notifyWeekly, onChange: setNotifyWeekly },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-5 bg-muted rounded-2xl border border-border group hover:border-indigo-100 transition-colors">
                      <div className="pr-4">
                        <p className="text-xs font-black text-foreground uppercase tracking-widest mb-1">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{item.desc}</p>
                      </div>
                      <Toggle checked={item.value} onChange={item.onChange} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ABA: APARÊNCIA ── */}
            {activeTab === "aparencia" && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest">Personalização</h3>
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Aparência do sistema</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Light */}
                  <button
                    onClick={() => {
                      if (theme !== "light") {
                        toggleTheme?.();
                        updateTheme.mutate({ theme: "light" });
                        toast.success("Tema claro ativado!");
                      }
                    }}
                    className={cn(
                      "relative p-6 rounded-[2rem] border-4 transition-all text-left group",
                      theme === "light"
                        ? "border-indigo-600 bg-indigo-500/100/10 shadow-xl shadow-indigo-500/20"
                        : "border-border bg-card hover:border-indigo-200"
                    )}
                  >
                    <div className="w-full h-24 rounded-[1.25rem] bg-card border border-border mb-6 overflow-hidden shadow-sm flex flex-col">
                       <div className="h-4 bg-muted border-b border-border flex items-center px-2 gap-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                         <div className="w-6 h-1 rounded bg-muted" />
                       </div>
                       <div className="flex-1 p-3 space-y-2">
                         <div className="h-3 bg-indigo-500/20 rounded-full w-3/4" />
                         <div className="h-2 bg-muted rounded-full w-1/2" />
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                            <Sun size={18} />
                         </div>
                         <span className="text-xs font-black uppercase tracking-widest text-foreground">Modo Claro</span>
                       </div>
                       {theme === "light" && <CheckCircle2 size={18} className="text-indigo-600" />}
                    </div>
                  </button>

                  {/* Dark */}
                  <button
                    onClick={() => {
                      if (theme !== "dark") {
                        toggleTheme?.();
                        updateTheme.mutate({ theme: "dark" });
                        toast.success("Tema escuro ativado!");
                      }
                    }}
                    className={cn(
                      "relative p-6 rounded-[2rem] border-4 transition-all text-left group",
                      theme === "dark"
                        ? "border-indigo-600 bg-indigo-500/100/10 shadow-xl shadow-indigo-500/20"
                        : "border-border bg-card hover:border-indigo-200"
                    )}
                  >
                    <div className="w-full h-24 rounded-[1.25rem] bg-slate-900 border border-slate-800 mb-6 overflow-hidden shadow-sm flex flex-col">
                       <div className="h-4 bg-slate-800 border-b border-slate-700 flex items-center px-2 gap-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                         <div className="w-6 h-1 rounded bg-slate-800" />
                       </div>
                       <div className="flex-1 p-3 space-y-2">
                         <div className="h-3 bg-indigo-900 rounded-full w-3/4" />
                         <div className="h-2 bg-slate-800 rounded-full w-1/2" />
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-xl bg-indigo-900 text-indigo-400 flex items-center justify-center">
                            <Moon size={18} />
                         </div>
                         <span className="text-xs font-black uppercase tracking-widest text-foreground">Modo Escuro</span>
                       </div>
                       {theme === "dark" && <CheckCircle2 size={18} className="text-indigo-600" />}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── ABA: SEGURANÇA ── */}
            {activeTab === "seguranca" && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest">Segurança e Acesso</h3>
                  <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Dados da conta</p>
                </div>

                <div className="p-6 bg-indigo-500/10 rounded-[1.5rem] border border-indigo-100 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-1">Conta Verificada</p>
                    <p className="text-[11px] text-indigo-800/70 font-medium leading-relaxed">
                      Sua conta está vinculada ao Manus OAuth. A autenticação é gerenciada de forma centralizada para máxima segurança.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-5 bg-muted rounded-2xl border border-border">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Último Acesso</p>
                      <p className="text-xs font-bold text-foreground">
                        {user?.lastSignedIn
                          ? new Date(user.lastSignedIn).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Conta criada em</p>
                      <p className="text-[10px] text-muted-foreground">
                        {user?.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("pt-BR", { dateStyle: "long" })
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>
                
                <PwaInstallSection />
                <ExportDataSection />
                <CleanupTestDataSection />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



