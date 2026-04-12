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
  CheckCircle2, Music, Loader2, AlertTriangle,
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

function CleanupTestDataSection() {
  const [cleaning, setCleaning] = useState(false);
  const utils = trpc.useUtils();
  const cleanupMutation = trpc.system.cleanupTestData.useMutation({
    onSuccess: (data) => {
      toast.success(`Limpeza concluída! ${data.studentsRemoved} alunos e ${data.lessonsRemoved} aulas de teste removidos.`);
      utils.invalidate(); // Refresh all data
    },
    onError: (e) => toast.error("Erro ao limpar dados: " + e.message),
    onSettled: () => setCleaning(false),
  });

  const handleCleanup = () => {
    if (window.confirm("🚨 ATENÇÃO: Tem certeza que deseja excluir TODOS os dados de teste? Esta ação é permanente e não pode ser desfeita.")) {
      setCleaning(true);
      cleanupMutation.mutate();
    }
  };

  return (
    <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/30 space-y-3">
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
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
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
    <div className="space-y-5 max-w-[900px]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-500/10 flex items-center justify-center">
          <Shield size={20} className="text-slate-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Configurações</h2>
          <p className="text-xs text-muted-foreground">Gerencie seu perfil e preferências do sistema</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Sidebar de abas */}
        <div className="sm:w-48 flex-shrink-0">
          <div className="bg-card rounded-2xl border border-border p-2 flex sm:flex-col gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all w-full text-left",
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo da aba */}
        <div className="flex-1 bg-card rounded-2xl border border-border p-5 sm:p-6">

          {/* ── ABA: PERFIL ── */}
          {activeTab === "perfil" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">Meu Perfil</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Suas informações pessoais e profissionais</p>
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-lg flex-shrink-0">
                  <span className="text-xl font-bold text-white">{initials}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{user?.name ?? "Professor"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? ""}</p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary mt-1 inline-block">
                    Administrador
                  </span>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome completo">
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder="Seu nome"
                      className="pl-8 h-9 text-sm rounded-xl border-border bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                  </div>
                </Field>

                <Field label="E-mail">
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={profileEmail}
                      onChange={e => setProfileEmail(e.target.value)}
                      placeholder="seu@email.com"
                      type="email"
                      className="pl-8 h-9 text-sm rounded-xl border-border bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                  </div>
                </Field>

                <Field label="Telefone / WhatsApp">
                  <div className="relative">
                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={profilePhone}
                      onChange={e => setProfilePhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="pl-8 h-9 text-sm rounded-xl border-border bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Bio / Apresentação" hint="Aparece no seu perfil público">
                <div className="relative">
                  <FileText size={13} className="absolute left-3 top-3 text-muted-foreground" />
                  <textarea
                    value={profileBio}
                    onChange={e => setProfileBio(e.target.value)}
                    placeholder="Conte um pouco sobre você, sua experiência musical..."
                    rows={3}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </Field>

              <Button
                className="gap-2 rounded-xl"
                disabled={updateProfile.isPending}
                onClick={() => updateProfile.mutate({ name: profileName, email: profileEmail, phone: profilePhone, bio: profileBio })}
              >
                {updateProfile.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Perfil
              </Button>
            </div>
          )}

          {/* ── ABA: ESCOLA ── */}
          {activeTab === "escola" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">Dados da Escola</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Informações da sua escola ou estúdio de música</p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/20">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Music size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{schoolName || "Nome da sua escola"}</p>
                  <p className="text-[10px] text-muted-foreground">{schoolCity || "Cidade"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nome da escola / estúdio">
                  <div className="relative">
                    <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      placeholder="Ex: Escola de Música Harmonia"
                      className="pl-8 h-9 text-sm rounded-xl border-border bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                  </div>
                </Field>

                <Field label="Cidade">
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={schoolCity}
                      onChange={e => setSchoolCity(e.target.value)}
                      placeholder="São Paulo, SP"
                      className="pl-8 h-9 text-sm rounded-xl border-border bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                  </div>
                </Field>

                <Field label="Endereço completo">
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={schoolAddress}
                      onChange={e => setSchoolAddress(e.target.value)}
                      placeholder="Rua, número, bairro"
                      className="pl-8 h-9 text-sm rounded-xl border-border bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                  </div>
                </Field>

                <Field label="Telefone da escola">
                  <div className="relative">
                    <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={schoolPhone}
                      onChange={e => setSchoolPhone(e.target.value)}
                      placeholder="(11) 3333-4444"
                      className="pl-8 h-9 text-sm rounded-xl border-border bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                  </div>
                </Field>

                <Field label="Site / Redes sociais" hint="URL completa com https://">
                  <div className="relative">
                    <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={schoolWebsite}
                      onChange={e => setSchoolWebsite(e.target.value)}
                      placeholder="https://suaescola.com.br"
                      className="pl-8 h-9 text-sm rounded-xl border-border bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary/50"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Descrição da escola">
                <div className="relative">
                  <FileText size={13} className="absolute left-3 top-3 text-muted-foreground" />
                  <textarea
                    value={schoolDescription}
                    onChange={e => setSchoolDescription(e.target.value)}
                    placeholder="Descreva sua escola, metodologia de ensino, diferenciais..."
                    rows={3}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </Field>

              <Button
                className="gap-2 rounded-xl"
                disabled={updateSchool.isPending}
                onClick={() => updateSchool.mutate({ schoolName, schoolAddress, schoolCity, schoolPhone, schoolWebsite, schoolDescription })}
              >
                {updateSchool.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Dados da Escola
              </Button>
            </div>
          )}

          {/* ── ABA: NOTIFICAÇÕES ── */}
          {activeTab === "notificacoes" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">Notificações</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Escolha quais alertas deseja receber</p>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Lembrete de aulas", desc: "Aviso 1 hora antes de cada aula agendada", value: notifyLesson, onChange: setNotifyLesson },
                  { label: "Pagamento pendente", desc: "Alerta quando mensalidade estiver próxima do vencimento", value: notifyPayment, onChange: setNotifyPayment },
                  { label: "Falta de aluno", desc: "Notificação quando um aluno faltar à aula", value: notifyAbsence, onChange: setNotifyAbsence },
                  { label: "Novo aluno", desc: "Aviso ao cadastrar um novo aluno no sistema", value: notifyNewStudent, onChange: setNotifyNewStudent },
                  { label: "Relatório semanal", desc: "Resumo das aulas e receitas toda segunda-feira", value: notifyWeekly, onChange: setNotifyWeekly },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <Toggle checked={item.value} onChange={item.onChange} />
                  </div>
                ))}
              </div>

              <Button
                className="gap-2 rounded-xl"
                disabled={updateNotifications.isPending}
                onClick={() => updateNotifications.mutate({
                  notifyLessonReminder: notifyLesson,
                  notifyPaymentDue: notifyPayment,
                  notifyStudentAbsence: notifyAbsence,
                  notifyNewStudent: notifyNewStudent,
                  notifyWeeklyReport: notifyWeekly,
                })}
              >
                {updateNotifications.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Notificações
              </Button>
            </div>
          )}

          {/* ── ABA: APARÊNCIA ── */}
          {activeTab === "aparencia" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">Aparência</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Personalize o visual do sistema</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground mb-3">Tema do sistema</p>
                <div className="grid grid-cols-2 gap-3">
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
                      "relative p-4 rounded-2xl border-2 transition-all text-left",
                      theme === "light"
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border bg-muted/30 hover:border-primary/40"
                    )}
                  >
                    <div className="w-full h-16 rounded-xl bg-white border border-slate-200 mb-3 overflow-hidden shadow-sm">
                      <div className="h-3 bg-slate-100 border-b border-slate-200 flex items-center px-2 gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <div className="w-8 h-1 rounded bg-slate-200" />
                      </div>
                      <div className="flex h-full">
                        <div className="w-8 bg-slate-100 border-r border-slate-200" />
                        <div className="flex-1 p-1.5 space-y-1">
                          <div className="h-2 bg-indigo-100 rounded w-3/4" />
                          <div className="h-1.5 bg-slate-100 rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun size={14} className="text-amber-500" />
                      <span className="text-xs font-semibold text-foreground">Claro</span>
                      {theme === "light" && (
                        <CheckCircle2 size={14} className="text-primary ml-auto" />
                      )}
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
                      "relative p-4 rounded-2xl border-2 transition-all text-left",
                      theme === "dark"
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border bg-muted/30 hover:border-primary/40"
                    )}
                  >
                    <div className="w-full h-16 rounded-xl bg-slate-900 border border-slate-700 mb-3 overflow-hidden shadow-sm">
                      <div className="h-3 bg-slate-800 border-b border-slate-700 flex items-center px-2 gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        <div className="w-8 h-1 rounded bg-slate-700" />
                      </div>
                      <div className="flex h-full">
                        <div className="w-8 bg-slate-800 border-r border-slate-700" />
                        <div className="flex-1 p-1.5 space-y-1">
                          <div className="h-2 bg-indigo-900 rounded w-3/4" />
                          <div className="h-1.5 bg-slate-700 rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Moon size={14} className="text-indigo-400" />
                      <span className="text-xs font-semibold text-foreground">Escuro</span>
                      {theme === "dark" && (
                        <CheckCircle2 size={14} className="text-primary ml-auto" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs font-semibold text-foreground mb-1">Tema atual</p>
                <p className="text-xs text-muted-foreground">
                  O sistema está usando o tema <strong>{theme === "dark" ? "escuro" : "claro"}</strong>. A preferência é salva automaticamente ao clicar.
                </p>
              </div>
            </div>
          )}

          {/* ── ABA: SEGURANÇA ── */}
          {activeTab === "seguranca" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-foreground">Segurança</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Informações sobre sua conta e acesso</p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Conta autenticada via Manus OAuth</p>
                  </div>
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-500">
                    Sua conta está protegida pelo sistema de autenticação seguro do Manus. Não é necessário gerenciar senha manualmente.
                  </p>
                </div>

                <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Provedor de login</p>
                      <p className="text-[10px] text-muted-foreground">Manus OAuth</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Ativo</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Função no sistema</p>
                      <p className="text-[10px] text-muted-foreground">Acesso total ao painel</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">Admin</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-foreground">Último acesso</p>
                      <p className="text-[10px] text-muted-foreground">
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

                <ExportDataSection />
                <CleanupTestDataSection />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
