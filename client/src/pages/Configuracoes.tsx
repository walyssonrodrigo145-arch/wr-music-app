import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User, Building2, Bell, Palette, Shield, Save, Users,
  Sun, Moon, Phone, Mail, Globe, MapPin,
  CheckCircle2, Music, Loader2, AlertTriangle, Download, Smartphone, Wallet, Sparkles, HelpCircle,
  FileSpreadsheet, FileText, DollarSign, Percent, Receipt, Calculator, Calendar, Clock, DoorOpen, Upload, Trash2, Image,
  FileSignature
} from "lucide-react";
import { useTour } from "@/components/tour/TourProvider";
import { ProfessoresTab } from "./ProfessoresTab";
import { SalasEstudioTab } from "./SalasEstudioTab";
import { downloadBase64File } from "@/utils/downloadReport";
import { LogoUploadZone } from "@/components/logo/LogoUploadZone";
import { LogoEditorModal, type LogoEditParams } from "@/components/logo/LogoEditorModal";
import { DueDaysSelector } from "@/components/financeiro/DueDaysSelector";
import { AssinafyIntegrationCard } from "@/components/integrations/AssinafyIntegrationCard";
import { ModelosContratoTab } from "@/components/integrations/ModelosContratoTab";

// ─── Tab types ───────────────────────────────────────────────────────────────
type Tab = "perfil" | "escola" | "salas" | "financeiro" | "professores" | "modelos_contrato" | "notificacoes" | "aparencia" | "whatsapp" | "integracoes" | "ia" | "seguranca" | "ajuda";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "escola", label: "Escola", icon: Building2 },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "professores", label: "Professores", icon: Users },
  { id: "modelos_contrato", label: "Modelos de Contrato", icon: FileSignature },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "whatsapp", label: "Meu WhatsApp", icon: Smartphone },
  { id: "integracoes", label: "Integrações", icon: Wallet },
  { id: "ia", label: "IA Assistente", icon: Sparkles },
  { id: "seguranca", label: "Segurança", icon: Shield },
  { id: "ajuda", label: "Ajuda", icon: HelpCircle },
];

// ─── Export CSV helper ──────────────────────────────────────────────────────

function ExportDataSection() {
  const [exporting, setExporting] = useState<string | null>(null);
  const { refetch } = trpc.settings.exportData.useQuery(undefined, { enabled: false });
  const generateReport = trpc.reportEngine.generate.useMutation();

  const handleExport = async (type: 'alunos' | 'aulas' | 'completo') => {
    setExporting(type);
    try {
      const { data } = await refetch();
      if (!data) { toast.error('Erro ao carregar os dados'); return; }

      const date = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      const buildStudentRows = () => {
        if ((data as any).studentsData && Array.isArray((data as any).studentsData)) {
          return (data as any).studentsData;
        }
        const lines = (data.studentsCsv || '').split('\n').slice(1);
        return lines
          .filter(l => l.trim())
          .map(line => {
            const p = line.split(',');
            return [
              p[0] ?? '',
              (p[1] ?? '').replace(/"/g, ''),
              (p[2] ?? '').replace(/"/g, ''),
              (p[3] ?? '').replace(/"/g, ''),
              p[4] ?? '',
              p[5] ?? '',
              Number(p[6] ?? 0),
              p[7] ?? '',
            ] as (string | number)[];
          });
      };

      const buildAulaRows = () => {
        if ((data as any).lessonsData && Array.isArray((data as any).lessonsData)) {
          return (data as any).lessonsData;
        }
        const lines = (data.lessonsCsv || '').split('\n').slice(1);
        return lines
          .filter(l => l.trim())
          .map(line => {
            const p = line.split(',');
            return [
              p[0] ?? '',
              (p[1] ?? '').replace(/"/g, ''),
              (p[2] ?? '').replace(/"/g, ''),
              p[3] ?? '',
              p[4] ?? '',
              Number(p[5] ?? 0),
              p[6] ?? '',
            ] as (string | number)[];
          });
      };

      toast.loading('Gerando relatório Excel...', { id: 'export-report' });

      if (type === 'alunos') {
        generateReport.mutate(
          { format: 'excel', title: `Relatório de Alunos — ${date}`, columns: ['ID', 'Nome', 'Email', 'Telefone', 'Nível', 'Status', 'Mensalidade (R$)', 'Início'], rows: buildStudentRows(), period: date },
          {
            onSuccess: r => { toast.dismiss('export-report'); downloadBase64File(r.data, 'excel', `alunos_${date}`); toast.success('Relatório de alunos exportado!'); },
            onError: () => { toast.dismiss('export-report'); toast.error('Erro ao gerar relatório.'); },
            onSettled: () => setExporting(null),
          }
        );
      } else if (type === 'aulas') {
        generateReport.mutate(
          { format: 'excel', title: `Relatório de Aulas — ${date}`, columns: ['ID', 'Título', 'Aluno', 'Status', 'Data', 'Duração (min)', 'Avaliação'], rows: buildAulaRows(), period: date },
          {
            onSuccess: r => { toast.dismiss('export-report'); downloadBase64File(r.data, 'excel', `aulas_${date}`); toast.success('Relatório de aulas exportado!'); },
            onError: () => { toast.dismiss('export-report'); toast.error('Erro ao gerar relatório.'); },
            onSettled: () => setExporting(null),
          }
        );
      } else {
        // Exportar tudo: dispara alunos e aulas em sequência
        generateReport.mutate(
          { format: 'excel', title: `Relatório de Alunos — ${date}`, columns: ['ID', 'Nome', 'Email', 'Telefone', 'Nível', 'Status', 'Mensalidade (R$)', 'Início'], rows: buildStudentRows(), period: date },
          {
            onSuccess: r => {
              downloadBase64File(r.data, 'excel', `alunos_${date}`);
              // depois dispara aulas
              generateReport.mutate(
                { format: 'excel', title: `Relatório de Aulas — ${date}`, columns: ['ID', 'Título', 'Aluno', 'Status', 'Data', 'Duração (min)', 'Avaliação'], rows: buildAulaRows(), period: date },
                {
                  onSuccess: r2 => { toast.dismiss('export-report'); downloadBase64File(r2.data, 'excel', `aulas_${date}`); toast.success('Todos os relatórios exportados!'); },
                  onError: () => { toast.dismiss('export-report'); toast.error('Erro ao gerar relatório de aulas.'); },
                  onSettled: () => setExporting(null),
                }
              );
            },
            onError: () => { toast.dismiss('export-report'); toast.error('Erro ao gerar relatório.'); setExporting(null); },
          }
        );
      }
    } catch {
      toast.dismiss('export-report');
      toast.error('Erro ao exportar dados');
      setExporting(null);
    }
  };

  const isLoading = !!exporting;

  return (
    <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
      <div>
        <p className="text-xs font-semibold text-foreground mb-1">Exportar dados</p>
        <p className="text-[10px] text-muted-foreground">Baixe relatórios organizados em Excel (compatível com Excel/Google Sheets).</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="text-xs rounded-xl gap-2" disabled={isLoading}
          onClick={() => handleExport('alunos')}>
          {exporting === 'alunos' ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
          Exportar Alunos
        </Button>
        <Button variant="outline" size="sm" className="text-xs rounded-xl gap-2" disabled={isLoading}
          onClick={() => handleExport('aulas')}>
          {exporting === 'aulas' ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
          Exportar Aulas
        </Button>
        <Button size="sm" className="text-xs rounded-xl gap-2" disabled={isLoading}
          onClick={() => handleExport('completo')}>
          {exporting === 'completo' ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
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
    <div className="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 space-y-4">
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

// ─── GESTÃO DE SESSÕES BAILEYS ────────────────────────────────────────────────
function WhatsAppSessionManager() {
  const [step, setStep] = useState<"DISCONNECTED" | "PAIRING" | "CONNECTED">("DISCONNECTED");
  const [modeTab, setModeTab] = useState<"QR_CODE" | "PAIRING_CODE">("QR_CODE");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [qrString, setQrString] = useState("");
  const [connectedPhone, setConnectedPhone] = useState("");
  const [timeLeft, setTimeLeft] = useState(120);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const startSession = trpc.whatsapp.startSession.useMutation();
  const logoutSession = trpc.whatsapp.logout.useMutation();
  const testConnection = trpc.whatsapp.testConnection.useMutation();
  const getStatusQuery = trpc.whatsapp.getStatus.useQuery(undefined, {
    refetchInterval: step === "PAIRING" ? 3000 : false, // Polling a cada 3s se PAIRING
  });

  const [testingConnection, setTestingConnection] = useState(false);

  // Atualizar estado baseado na query - SÓ age quando conectado com sucesso
  // Nunca derruba o passo PAIRING enquanto o usuário está escaneando
  useEffect(() => {
    if (!getStatusQuery.data) return;
    const data = getStatusQuery.data as any;
    const s = data.status;
    if (s === "CONNECTED") {
      setStep("CONNECTED");
      setConnectedPhone(data.phone || phoneNumber || "Conectado");
    } else if (s === "PAIRING") {
      if (data.qr && !qrString) setQrString(data.qr);
      if (data.pairingCode && !pairingCode) setPairingCode(data.pairingCode);
    }
    // INTENCIONALMENTE não reseta para DISCONNECTED durante PAIRING
    // O timer de 120s cuida disso.
  }, [getStatusQuery.data, qrString, pairingCode]);

  // Timer de 120 segundos no modo PAIRING (tempo suficiente para abrir o celular e escanear)
  useEffect(() => {
    if (step !== "PAIRING") return;
    setTimeLeft(120);
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setStep("DISCONNECTED");
          toast.error("O tempo de pareamento expirou. Tente novamente.");
          return 120;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const handleStart = async () => {
    if (modeTab === "PAIRING_CODE" && !phoneNumber) {
      toast.error("Por favor, digite o número do WhatsApp com DDD.");
      return;
    }
    setLoading(true);
    // Limpar estado anterior
    setPairingCode("");
    setQrString("");
    try {
      const res = await startSession.mutateAsync({ 
        phoneNumber: modeTab === "PAIRING_CODE" ? phoneNumber : undefined,
        mode: modeTab,
      });
      if (res.success) {
        if (res.qr) setQrString(res.qr);
        if (res.pairingCode) setPairingCode(res.pairingCode);
        setStep("PAIRING");
        toast.success(modeTab === "QR_CODE" ? "QR Code gerado! Escaneie com seu celular." : "Código gerado! Digite no WhatsApp.");
        getStatusQuery.refetch();
      } else {
        toast.error((res as any).error || "Falha ao iniciar pareamento.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm("Tem certeza que deseja desconectar o seu WhatsApp? O sistema passará a usar o número padrão da escola.")) return;
    setLoading(true);
    try {
      await logoutSession.mutateAsync();
      setStep("DISCONNECTED");
      setPairingCode("");
      setQrString("");
      setConnectedPhone("");
      toast.success("WhatsApp desconectado com sucesso.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao desconectar.");
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      await testConnection.mutateAsync();
      toast.success("Sessão ativa! Mensagem de teste enviada com sucesso para o seu celular.");
    } catch (err: any) {
      toast.error("Conexão inativa ou falhou: " + (err.message || "Erro desconhecido"));
    } finally {
      setTestingConnection(false);
    }
  };

  // Garante a formatação exata de 4 em 4 (Ex: YVOA - 252N)
  const formattedPairingCode = (() => {
    if (!pairingCode) return "";
    const cleanCode = pairingCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (cleanCode.length >= 8) {
      return `${cleanCode.slice(0, 4)} - ${cleanCode.slice(4)}`;
    }
    return pairingCode;
  })();

  const handleCopy = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    toast.success("Código copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (getStatusQuery.isLoading) {
    return (
      <div className="bg-card/80 backdrop-blur-xl rounded-[2.5rem] border border-border shadow-2xl p-6 lg:p-10 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 size={36} className="animate-spin text-indigo-500 mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Verificando status de conexão...</p>
      </div>
    );
  }

  return (
    <div className="bg-card/80 backdrop-blur-xl rounded-[2.5rem] border border-border shadow-2xl p-6 lg:p-10 transition-all duration-500 overflow-hidden relative mb-8">
      {/* Decoração de fundo */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {step === "DISCONNECTED" && (
        <div className="space-y-8 animate-in fade-in-50 duration-500">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xl shadow-indigo-500/30">
              <Smartphone size={28} />
            </div>
            <div>
              <h4 className="text-xl font-black text-foreground uppercase tracking-wider">Conexão Multi-Sessão WhatsApp</h4>
              <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed max-w-xl">
                Escolha o método de pareamento de sua preferência para vincular seu celular ao sistema e realizar disparos automáticos de lembretes.
              </p>
            </div>
          </div>

          {/* Abas de Seleção (Tabs) */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted/60 backdrop-blur-md rounded-2xl border border-border/80 shadow-inner">
            <button
              type="button"
              onClick={() => setModeTab("QR_CODE")}
              className={cn(
                "py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                modeTab === "QR_CODE"
                  ? "bg-background text-foreground shadow-lg shadow-black/5 border border-border/50 scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <span>📱 Conectar com QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => setModeTab("PAIRING_CODE")}
              className={cn(
                "py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                modeTab === "PAIRING_CODE"
                  ? "bg-background text-foreground shadow-lg shadow-black/5 border border-border/50 scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <span>☎️ Conectar com Telefone</span>
            </button>
          </div>

          <div className="bg-muted/30 backdrop-blur-md p-6 rounded-3xl border border-border/80 space-y-6 shadow-sm">
            {modeTab === "QR_CODE" ? (
              <div className="text-center space-y-4 py-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                  <Smartphone size={32} />
                </div>
                <h5 className="text-sm font-black uppercase tracking-widest text-foreground">Escaneamento Instantâneo</h5>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  O sistema gerará um QR Code seguro na tela. Basta abrir o WhatsApp no seu celular e apontar a câmera para conectar instantaneamente.
                </p>
                <Button
                  onClick={handleStart}
                  disabled={loading}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Smartphone size={20} className="mr-2" />}
                  Gerar QR Code
                </Button>
              </div>
            ) : (
              <div className="space-y-6 py-2">
                <div>
                  <label className="text-xs font-black uppercase tracking-widest text-foreground block mb-2.5">DDD + Número do Celular</label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <DebouncedInput
                      value={phoneNumber}
                      onChange={e => {
                        let clean = e.target.value.replace(/\D/g, "");
                        if (!clean) {
                          setPhoneNumber("");
                          return;
                        }
                        
                        let prefix = "";
                        if (clean.startsWith("55") && clean.length > 11) {
                          prefix = "+55 ";
                          clean = clean.substring(2);
                        }
                        
                        let formatted = prefix + clean;
                        if (clean.length > 2 && clean.length <= 6) {
                          formatted = prefix + `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
                        } else if (clean.length > 6 && clean.length <= 10) {
                          formatted = prefix + `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
                        } else if (clean.length > 10) {
                          formatted = prefix + `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
                        }
                        
                        setPhoneNumber(formatted);
                      }}
                      placeholder="(33) 99999-9999"
                      className="pl-12 h-14 text-base font-bold rounded-2xl border-border bg-background focus:bg-card transition-all shadow-sm"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                    Digite o número exato que está no seu WhatsApp. 
                    <strong className="text-orange-500 block mt-1">⚠️ Se o código for gerado mas não conectar no celular, tente solicitar novamente tirando ou colocando o "9" após o DDD.</strong>
                  </p>
                </div>

                <Button
                  onClick={handleStart}
                  disabled={loading || phoneNumber.replace(/\D/g, "").length < 10}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Smartphone size={20} className="mr-2" />}
                  Gerar Código de Conexão
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "PAIRING" && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto animate-pulse">
              <Smartphone size={32} />
            </div>
            <h4 className="text-xl font-black text-foreground uppercase tracking-wider">Pareamento Ativo</h4>
            <p className="text-xs text-muted-foreground font-medium max-w-md mx-auto">
              {modeTab === "QR_CODE" 
                ? "Abra o WhatsApp no celular e escaneie o QR Code abaixo." 
                : "Digite o código abaixo no seu WhatsApp para conectar sua conta ao sistema."}
            </p>
          </div>

          <div className="bg-muted/50 backdrop-blur-md p-8 rounded-3xl border border-border text-center relative overflow-hidden group shadow-inner">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />
            
            {modeTab === "QR_CODE" ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-6">
                {qrString ? (
                  <div className="p-4 bg-white rounded-3xl border-4 border-indigo-500/20 shadow-2xl animate-in zoom-in duration-500">
                    <img 
                      src={qrString.startsWith('data:image') ? qrString : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrString)}`} 
                      alt="WhatsApp QR Code"
                      className="w-60 h-60 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-60 h-60 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl bg-background/50 space-y-3">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Gerando QR Code...</span>
                  </div>
                )}
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Aponte a câmera do WhatsApp</p>
              </div>
            ) : (
              <div className="space-y-6 py-2">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Código de Pareamento</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <div
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase"
                    }}
                    className="text-3xl lg:text-4xl text-indigo-600 dark:text-indigo-400 select-all bg-background py-5 px-8 rounded-2xl border border-border inline-block shadow-inner"
                  >
                    {formattedPairingCode || "GERANDO..."}
                  </div>
                  <Button
                    onClick={handleCopy}
                    disabled={!pairingCode}
                    className="h-16 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all active:scale-95"
                  >
                    {copied ? <CheckCircle2 size={20} className="text-green-400" /> : <Smartphone size={20} />}
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
              <Loader2 size={16} className="animate-spin text-indigo-500" />
              Aguardando confirmação do celular ({timeLeft}s restantes)...
            </div>
          </div>

          <div className="bg-card/90 backdrop-blur-md p-6 rounded-2xl border border-border space-y-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-foreground">Passo a passo no seu celular:</p>
            <ol className="text-xs text-muted-foreground space-y-2 font-medium list-decimal list-inside">
              <li>Abra o WhatsApp no seu celular.</li>
              <li>Toque no menu de <span className="text-foreground font-bold">Opções/Configurações</span> (três pontinhos).</li>
              <li>Selecione <span className="text-foreground font-bold">Aparelhos Conectados</span>.</li>
              <li>Toque em <span className="text-foreground font-bold">Conectar um aparelho</span>.</li>
              {modeTab === "QR_CODE" ? (
                <li>Aponte a câmera para o QR Code exibido na tela.</li>
              ) : (
                <li>Escolha <span className="text-foreground font-bold">Conectar com número de telefone</span> e digite o código acima.</li>
              )}
            </ol>
          </div>

          <Button
            onClick={() => setStep("DISCONNECTED")}
            variant="outline"
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all shadow-sm"
          >
            Cancelar Pareamento
          </Button>
        </div>
      )}

      {step === "CONNECTED" && (
        <div className="space-y-8 text-center animate-in zoom-in-95 duration-500 py-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-green-600 to-emerald-500 text-white flex items-center justify-center mx-auto shadow-2xl shadow-green-500/30 border-4 border-green-400/20">
            <CheckCircle2 size={48} className="animate-bounce" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-xs font-black uppercase tracking-widest mb-2 shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
              ✅ WhatsApp Conectado com Sucesso!
            </div>
            <h4 className="text-3xl font-black text-foreground">{connectedPhone}</h4>
            <p className="text-xs text-muted-foreground font-medium max-w-md mx-auto mt-3 leading-relaxed">
              Seu WhatsApp está perfeitamente vinculado e operando 24/7 em segundo plano para disparar lembretes automáticos aos alunos.
            </p>
          </div>

          <div className="pt-6 flex flex-wrap justify-center gap-4">
            <Button
              onClick={handleTestConnection}
              disabled={testingConnection || loading}
              className="h-14 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {testingConnection ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
              Testar Conexão
            </Button>
            <Button
              onClick={handleLogout}
              disabled={loading || testingConnection}
              variant="outline"
              className="h-14 px-8 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive hover:text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-destructive/25 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
              Desconectar Conta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}



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

// ─── DebouncedInput ─────────────────────────────────────────────────────────
function DebouncedInput({ value, onChange, ...props }: any) {
  const [localValue, setLocalValue] = useState(value ?? "");

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== (value ?? "") && onChange) {
        onChange({ target: { value: localValue } });
      }
    }, 400);
    return () => clearTimeout(handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue]);

  return (
    <Input
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
    />
  );
}

// ─── DebouncedTextarea ────────────────────────────────────────────────────────
function DebouncedTextarea({ value, onChange, ...props }: any) {
  const [localValue, setLocalValue] = useState(value ?? "");

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== (value ?? "") && onChange) {
        onChange({ target: { value: localValue } });
      }
    }, 400);
    return () => clearTimeout(handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue]);

  return (
    <textarea
      {...props}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Configuracoes() {
  const { user } = useAuth();
  const { theme, setTheme, toggleTheme } = useTheme();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<Tab>("perfil");
  const { startTour } = useTour();

  const { data: settings, isLoading } = trpc.settings.get.useQuery();

  // ── Perfil state ──
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profilePixKey, setProfilePixKey] = useState("");

  // ── Escola state ──
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolCity, setSchoolCity] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolWebsite, setSchoolWebsite] = useState("");
  const [schoolDescription, setSchoolDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoEditorOpen, setLogoEditorOpen] = useState(false);
  const [logoDraftSrc, setLogoDraftSrc] = useState("");
  const [logoOriginalName, setLogoOriginalName] = useState("");
  const [logoEditParams, setLogoEditParams] = useState<LogoEditParams | null>(null);
  const [dueDaysForecast, setDueDaysForecast] = useState("5,10,15,20");
  const defaultHours = {
    monday: { active: true, start: "08:00", end: "18:00" },
    tuesday: { active: true, start: "08:00", end: "18:00" },
    wednesday: { active: true, start: "08:00", end: "18:00" },
    thursday: { active: true, start: "08:00", end: "18:00" },
    friday: { active: true, start: "08:00", end: "18:00" },
    saturday: { active: false, start: "08:00", end: "12:00" },
    sunday: { active: false, start: "08:00", end: "12:00" }
  };
  const [schoolHours, setSchoolHours] = useState<any>(defaultHours);
  const [lessonDuration, setLessonDuration] = useState<number>(60);

  // ── Logo handler: imagem selecionada abre o editor ──
  const handleLogoImageSelected = (dataUrl: string, file: File) => {
    setLogoDraftSrc(dataUrl);
    setLogoOriginalName(file.name);
    setLogoEditParams(null);
    setLogoEditorOpen(true);
  };

  // ── Logo handler: editor salvo ──
  const handleLogoEditorSave = (params: LogoEditParams) => {
    setLogoUrl(params.dataUrl);
    setLogoEditParams(params);
    setLogoEditorOpen(false);
    toast.success("Logo ajustada! Clique em Salvar Alterações para aplicar.");
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    setLogoEditParams(null);
    setLogoDraftSrc("");
  };


  // ── Notificações state ──
  const [notifyLesson, setNotifyLesson] = useState(true);
  const [notifyPayment, setNotifyPayment] = useState(true);
  const [notifyAbsence, setNotifyAbsence] = useState(true);
  const [notifyNewStudent, setNotifyNewStudent] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(false);

  // ── WhatsApp Bot state ──
  const [whatsappBotUrl, setWhatsappBotUrl] = useState("");
  const [whatsappBotToken, setWhatsappBotToken] = useState("");
  const [whatsappAutoSend, setWhatsappAutoSend] = useState(false);
  const [chatbotEnabled, setChatbotEnabled] = useState(false);
  const [autoAdvanceSlotsEnabled, setAutoAdvanceSlotsEnabled] = useState(true);

  // 💱 Pagamentos state 💱
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [asaasEnabled, setAsaasEnabled] = useState(false);
  const [paymentGateway, setPaymentGateway] = useState<"asaas" | "mercadopago">("asaas");
  const [mpAccessToken, setMpAccessToken] = useState("");

  // ── Financeiro (Juros, Multas e Descontos - Billing Engine) state ──
  const [lateFeeEnabled, setLateFeeEnabled] = useState(true);
  const [lateFeeType, setLateFeeType] = useState<"fixed" | "percentage">("percentage");
  const [lateFeeValue, setLateFeeValue] = useState(2.0);
  const [interestEnabled, setInterestEnabled] = useState(true);
  const [interestType, setInterestType] = useState<"daily" | "monthly">("daily");
  const [interestRate, setInterestRate] = useState(0.33);
  const [graceDays, setGraceDays] = useState(3);
  const [autoUpdateInvoice, setAutoUpdateInvoice] = useState(true);
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(true);
  const [earlyDiscountEnabled, setEarlyDiscountEnabled] = useState(false);
  const [earlyDiscountType, setEarlyDiscountType] = useState<"fixed" | "percentage">("percentage");
  const [earlyDiscountValue, setEarlyDiscountValue] = useState(5.0);
  const [earlyDiscountDays, setEarlyDiscountDays] = useState(0);

  // ── IA state ──
  const [aiProvider, setAiProvider] = useState("gemini");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-3.1-pro-preview");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile");

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
      setProfilePixKey(settings.pixKey ?? "");
      setSchoolName(settings.schoolName ?? "");
      setSchoolAddress(settings.schoolAddress ?? "");
      setSchoolCity(settings.schoolCity ?? "");
      setSchoolPhone(settings.schoolPhone ?? "");
      setSchoolWebsite(settings.schoolWebsite ?? "");
      setSchoolDescription(settings.schoolDescription ?? "");
      setLogoUrl((settings as any).logoUrl ?? (user as any)?.schoolLogo ?? "");
      setDueDaysForecast(settings.dueDaysForecast ?? "5,10,15,20");

      setLateFeeEnabled(Number((settings as any).lateFeeEnabled ?? 1) === 1);
      setLateFeeType(((settings as any).lateFeeType === "fixed" ? "fixed" : "percentage"));
      setLateFeeValue(Number((settings as any).lateFeeValue ?? 2.0));
      setInterestEnabled(Number((settings as any).interestEnabled ?? 1) === 1);
      setInterestType(((settings as any).interestType === "monthly" ? "monthly" : "daily"));
      setInterestRate(Number((settings as any).interestRate ?? 0.33));
      setGraceDays(Number((settings as any).graceDays ?? 3));
      setAutoUpdateInvoice(Number((settings as any).autoUpdateInvoice ?? 1) === 1);
      setShowFeeBreakdown(Number((settings as any).showFeeBreakdown ?? 1) === 1);
      setEarlyDiscountEnabled(Number((settings as any).earlyDiscountEnabled ?? 0) === 1);
      setEarlyDiscountType(((settings as any).earlyDiscountType === "fixed" ? "fixed" : "percentage"));
      setEarlyDiscountValue(Number((settings as any).earlyDiscountValue ?? 5.0));
      setEarlyDiscountDays(Number((settings as any).earlyDiscountDays ?? 0));
      if ((settings as any).lessonDuration) {
        setLessonDuration(Number((settings as any).lessonDuration));
      }
      if (settings.schoolHours) {
        try {
          setSchoolHours(JSON.parse(settings.schoolHours));
        } catch (e) {
          setSchoolHours(defaultHours);
        }
      }
      setNotifyLesson(settings.notifyLessonReminder === 1);
      setNotifyPayment(settings.notifyPaymentDue === 1);
      setNotifyAbsence(settings.notifyStudentAbsence === 1);
      setNotifyNewStudent(settings.notifyNewStudent === 1);
      setNotifyWeekly(settings.notifyWeeklyReport === 1);
      setHiddenTabs(settings.hiddenTabs ? settings.hiddenTabs.split(",") : []);
      setWhatsappBotUrl(settings.whatsappBotUrl ?? "");
      setWhatsappBotToken(settings.whatsappBotToken ?? "");
      setWhatsappAutoSend(settings.whatsappAutoSend === 1);
      setChatbotEnabled((settings as any).chatbotEnabled === 1);
      setAutoAdvanceSlotsEnabled((settings as any).autoAdvanceSlotsEnabled !== 0);
      setAsaasApiKey(settings.asaasApiKey ?? "");
      setAsaasEnabled(settings.asaasEnabled === 1);
      setPaymentGateway((settings.paymentGateway as "asaas" | "mercadopago") || "asaas");
      setMpAccessToken(settings.mpAccessToken ?? "");
      setAiProvider(settings.aiProvider ?? "gemini");
      setGeminiApiKey(settings.geminiApiKey ?? "");
      setGeminiModel(settings.geminiModel ?? "gemini-3.1-pro-preview");
      setGroqApiKey(settings.groqApiKey ?? "");
      setGroqModel(settings.groqModel ?? "llama-3.3-70b-versatile");
    }
  }, [settings]);

  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  
  const availableSidebarTabs = [
    { label: "Dashboard", href: "/dashboard", desc: "Visão geral" },
    { label: "Alunos", href: "/alunos", desc: "Gestão de estudantes" },
    { label: "Aulas", href: "/aulas", desc: "Calendário e agenda" },
    { label: "Instrumentos", href: "/instrumentos", desc: "Gestão de cursos/instrumentos" },
    { label: "Relatórios", href: "/relatorios", desc: "Métricas e gráficos" },
    { label: "Lembretes", href: "/lembretes", desc: "Alertas manuais e histórico" },
    { label: "Automações", href: "/automacoes", desc: "Regras do Robô" },
    { label: "Comunicados", href: "/comunicados", desc: "Mural de avisos" },
    { label: "Solicitações", href: "/solicitacoes", desc: "Reposições e faltas" },
    { label: "IA Assistente", href: "/ia", desc: "Chat inteligente (Gemini)" },
    { label: "Progresso", href: "/progresso", desc: "Evolução dos alunos" },
    { label: "Financeiro", href: "/financeiro", desc: "Gestão Financeira" },
    { label: "Folha de Pagto", href: "/folha", desc: "Extrato de Professores" },
    { label: "Recepção QR", href: "/recepcao-qr", desc: "Check-in de alunos" },
  ];

  // ── Mutations ──
  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado com sucesso!", { icon: <CheckCircle2 size={16} className="text-emerald-500" /> });
      utils.auth.me.invalidate();
      utils.settings.get.invalidate();
    },
    onError: (e) => {
      let msg = e.message;
      try { const p = JSON.parse(msg); if (Array.isArray(p) && p[0]?.message) msg = p.map((x: any) => x.message).join(", "); } catch {}
      toast.error("Erro ao salvar perfil: " + msg);
    },
  });

  const updateSchool = trpc.settings.updateSchool.useMutation({
    onSuccess: () => {
      toast.success("Dados da escola atualizados!", { icon: <CheckCircle2 size={16} className="text-emerald-500" /> });
      utils.settings.get.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (e) => {
      let msg = e.message;
      try { const p = JSON.parse(msg); if (Array.isArray(p) && p[0]?.message) msg = p.map((x: any) => x.message).join(", "); } catch {}
      toast.error("Erro ao salvar escola: " + msg);
    },
  });

  const updateNotifications = trpc.settings.updateNotifications.useMutation({
    onSuccess: () => {
      toast.success("Preferências de notificação salvas!", { icon: <CheckCircle2 size={16} className="text-emerald-500" /> });
      utils.settings.get.invalidate();
    },
    onError: (e) => {
      let msg = e.message;
      try { const p = JSON.parse(msg); if (Array.isArray(p) && p[0]?.message) msg = p.map((x: any) => x.message).join(", "); } catch {}
      toast.error("Erro ao salvar notificações: " + msg);
    },
  });

  const updateWhatsAppMutation = trpc.settings.updateWhatsAppBot.useMutation({
    onSuccess: () => {
      toast.success("Configurações do WhatsApp atualizadas");
      utils.settings.get.invalidate();
    },
    onError: (e) => toast.error("Erro ao atualizar WhatsApp: " + e.message),
  });

  const toggleChatbotMutation = trpc.settings.toggleChatbot.useMutation({
    onSuccess: (data) => {
      toast.success(data.enabled ? "🤖 Robô de autoatendimento ATIVADO!" : "Robô de autoatendimento desativado.");
      utils.settings.get.invalidate();
    },
    onError: (e) => toast.error("Erro ao alterar o robô: " + e.message),
  });

  const handleToggleChatbot = (val: boolean) => {
    setChatbotEnabled(val);
    toggleChatbotMutation.mutate({ enabled: val });
  };

  const toggleAutoAdvanceMutation = trpc.settings.toggleAutoAdvanceSlots.useMutation({
    onSuccess: (data) => {
      toast.success(data.enabled ? "⚡ Robô de Antecipação por Falta ATIVADO!" : "Robô de Antecipação por Falta desativado.");
      utils.settings.get.invalidate();
    },
    onError: (e) => toast.error("Erro ao alterar o robô: " + e.message),
  });

  const handleToggleAutoAdvance = (val: boolean) => {
    setAutoAdvanceSlotsEnabled(val);
    toggleAutoAdvanceMutation.mutate({ enabled: val });
  };

  const updateAsaasMutation = trpc.settings.updateAsaasIntegration.useMutation({
    onSuccess: () => {
      toast.success("Integração Asaas atualizada");
      utils.settings.get.invalidate();
    },
    onError: (e) => toast.error("Erro ao atualizar Asaas: " + e.message),
  });

  const updateIAMutation = trpc.settings.updateIA.useMutation({
    onSuccess: () => {
      toast.success("Chave da IA salva com sucesso!", { icon: <Sparkles size={16} className="text-emerald-500" /> });
      utils.settings.get.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar chave da IA: " + e.message),
  });

  const updateTheme = trpc.settings.updateTheme.useMutation({
    onError: (e) => {
      let msg = e.message;
      try { const p = JSON.parse(msg); if (Array.isArray(p) && p[0]?.message) msg = p.map((x: any) => x.message).join(", "); } catch {}
      toast.error("Erro ao salvar tema: " + msg);
    },
  });

  const updateHiddenTabs = trpc.settings.updateHiddenTabs.useMutation({
    onSuccess: () => {
      toast.success("Menu atualizado!", { icon: <CheckCircle2 size={16} className="text-emerald-500" /> });
      utils.settings.get.invalidate();
    },
    onError: (e) => {
      let msg = e.message;
      try { const p = JSON.parse(msg); if (Array.isArray(p) && p[0]?.message) msg = p.map((x: any) => x.message).join(", "); } catch {}
      toast.error("Erro ao atualizar menu: " + msg);
    },
  });

  const updateFinancialMutation = trpc.settings.updateFinancialSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações financeiras do BillingEngine salvas com sucesso!", {
        icon: <DollarSign size={16} className="text-emerald-500" />,
      });
      utils.settings.get.invalidate();
      utils.paymentDues.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar configurações financeiras: " + e.message),
  });

  const handleSaveWhatsApp = () => {
    // BUG-013: Validar URL se preenchida
    if (whatsappBotUrl.trim()) {
      try {
        new URL(whatsappBotUrl.trim());
      } catch (e) {
        toast.error("URL do WhatsApp inválida. Certifique-se de incluir http:// ou https://");
        return;
      }
    }
    
    updateWhatsAppMutation.mutate({
      whatsappBotUrl: whatsappBotUrl.trim(),
      whatsappBotToken: whatsappBotToken.trim(),
      whatsappAutoSend,
    });
  };

  const handleSaveAsaas = () => {
    updateAsaasMutation.mutate({
      asaasApiKey,
      asaasEnabled,
      paymentGateway,
      mpAccessToken,
    });
  };

  const handleSaveIA = () => {
    updateIAMutation.mutate({
      aiProvider,
      geminiApiKey,
      geminiModel,
      groqApiKey,
      groqModel,
    });
  };

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
              {TABS.filter(tab => {
                // Se o usuário for professor, exibe APENAS as abas permitidas
                if (user?.role === 'professor') {
                  return ['perfil', 'aparencia', 'seguranca', 'ajuda'].includes(tab.id);
                }
                return true;
              }).map(tab => {
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
                    onClick={() => updateProfile.mutate({ name: profileName, email: profileEmail, phone: profilePhone, bio: profileBio, pixKey: profilePixKey })}
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
                      <DebouncedInput
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
                      <DebouncedInput
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
                      <DebouncedInput
                        value={profilePhone}
                        onChange={e => setProfilePhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="pl-11 h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                      />
                    </div>
                  </Field>

                  <Field label="Chave PIX para Recebimento" hint="Aparecerá para o aluno ao realizar pagamentos">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10H7z"/><path d="M16 16h2v2h-2z"/><path d="M16 6h2v2h-2z"/><path d="M6 16h2v2H6z"/><path d="M6 6h2v2H6z"/></svg>
                      </div>
                      <DebouncedInput
                        value={profilePixKey}
                        onChange={e => setProfilePixKey(e.target.value)}
                        placeholder="CPF, E-mail ou Telefone"
                        className="pl-11 h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                      />
                    </div>
                  </Field>
                </div>

                <Field label="Bio / Apresentação" hint="Aparece no seu perfil público">
                  <div className="relative">
                    <FileText size={14} className="absolute left-4 top-4 text-muted-foreground" />
                    <DebouncedTextarea
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
                    onClick={() => {
                      for (const [day, conf] of Object.entries(schoolHours)) {
                         const c = conf as any;
                         if (c.active && c.start > c.end) {
                            toast.error(`O horário inicial não pode ser maior que o final.`);
                            return;
                         }
                      }
                      updateSchool.mutate({ schoolName, schoolAddress, schoolCity, schoolPhone, schoolWebsite, schoolDescription, logoUrl, schoolHours: JSON.stringify(schoolHours), lessonDuration, dueDaysForecast });
                    }}
                  >
                    {updateSchool.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span className="text-xs font-black uppercase tracking-widest">Salvar</span>
                  </Button>
                </div>

                {/* 🎨 SEÇÃO LOGO DA ESCOLA (WHITE-LABEL BRANDING) */}
                <div className="p-5 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Upload size={16} className="text-indigo-500" />
                        Logo da Escola (Branding Personalizado)
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                        Sua logo será exibida no menu do sistema, portal do aluno e na página de matrícula pública.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-start gap-6 pt-2">
                    {/* Preview da Logo */}
                    <div className="relative w-28 h-28 rounded-full border-2 border-dashed border-indigo-500/30 bg-background/50 flex flex-col items-center justify-center overflow-hidden shadow-inner group shrink-0">
                      {logoUrl ? (
                        <>
                          <img src={logoUrl} alt="Logo da Escola" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold"
                            aria-label="Remover logo"
                          >
                            <Trash2 size={16} className="mr-1" /> Remover
                          </button>
                        </>
                      ) : (
                        <div className="text-center p-2">
                          <Image size={24} className="mx-auto text-indigo-400 mb-1" />
                          <span className="text-[10px] text-muted-foreground font-bold">Sem Logo</span>
                        </div>
                      )}
                    </div>

                    {/* Upload Drag & Drop + Editor */}
                    <div className="space-y-3 flex-1 w-full">
                      <LogoUploadZone
                        value={logoUrl ? logoUrl : null}
                        onImageSelected={handleLogoImageSelected}
                        onRemove={handleRemoveLogo}
                        maxSizeMB={5}
                      />

                      {logoUrl && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => { setLogoDraftSrc(logoUrl); setLogoEditorOpen(true); }}
                            className="text-xs font-bold text-indigo-500 hover:bg-indigo-500/10 rounded-xl"
                          >
                            <Upload size={14} className="mr-1" /> Reabrir Editor
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveLogo}
                            className="text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl"
                          >
                            <Trash2 size={14} className="mr-1" /> Usar Logo Padrão
                          </Button>
                        </div>
                      )}

                      <div>
                        <span className="text-[11px] font-bold text-muted-foreground block mb-1">Ou cole a URL direta da logo:</span>
                        <DebouncedInput
                          value={logoUrl.startsWith("data:") ? "" : logoUrl}
                          onChange={e => setLogoUrl(e.target.value)}
                          placeholder="https://suaescola.com.br/logo.png"
                          className="h-10 text-xs font-bold rounded-xl border-border bg-background focus:bg-card transition-all shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Editor de Logo */}
                  <LogoEditorModal
                    open={logoEditorOpen}
                    onOpenChange={setLogoEditorOpen}
                    src={logoDraftSrc}
                    onSave={handleLogoEditorSave}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  <Field label="Nome da escola">
                    <DebouncedInput
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      placeholder="Ex: Escola Harmonia"
                      className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                    />
                  </Field>

                  <Field label="Telefone comercial">
                    <DebouncedInput
                      value={schoolPhone}
                      onChange={e => setSchoolPhone(e.target.value)}
                      placeholder="(11) 3333-4444"
                      className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                    />
                  </Field>

                  <Field label="Cidade / UF">
                    <DebouncedInput
                      value={schoolCity}
                      onChange={e => setSchoolCity(e.target.value)}
                      placeholder="Ex: São Paulo, SP"
                      className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                    />
                  </Field>

                  <Field label="Endereço">
                    <DebouncedInput
                      value={schoolAddress}
                      onChange={e => setSchoolAddress(e.target.value)}
                      placeholder="Rua, número, bairro"
                      className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                    />
                  </Field>
                </div>

                <Field label="Site ou Instagram">
                  <DebouncedInput
                    value={schoolWebsite}
                    onChange={e => setSchoolWebsite(e.target.value)}
                    placeholder="https://suaescola.com.br"
                    className="h-12 text-sm font-bold rounded-xl border-border bg-muted focus:bg-card transition-all shadow-sm"
                  />
                </Field>

                <Field label="Sobre a escola">
                  <DebouncedTextarea
                    value={schoolDescription}
                    onChange={e => setSchoolDescription(e.target.value)}
                    placeholder="Breve descrição da metodologia..."
                    rows={4}
                    className="w-full px-4 py-4 text-sm font-bold rounded-xl border border-border bg-muted focus:bg-card transition-all shadow-sm resize-none text-foreground outline-none"
                  />
                </Field>

                <Field label="Dias de Previsão por Vencimento">
                  <DueDaysSelector
                    value={dueDaysForecast}
                    onChange={setDueDaysForecast}
                  />
                </Field>

                <div className="pt-6 border-t border-border">
                  <h4 className="text-sm font-black text-foreground uppercase tracking-widest mb-2">Horário de Atendimento</h4>
                  <p className="text-xs text-muted-foreground mb-4">Defina a grade de funcionamento. O robô inteligente de reagendamentos usará essa grade como base.</p>
                  
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                    {Object.entries({
                      monday: 'Segunda-feira',
                      tuesday: 'Terça-feira',
                      wednesday: 'Quarta-feira',
                      thursday: 'Quinta-feira',
                      friday: 'Sexta-feira',
                      saturday: 'Sábado',
                      sunday: 'Domingo'
                    }).map(([day, label]) => (
                      <div key={day} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 bg-muted/60 p-3 rounded-2xl border border-border/80 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Switch 
                            checked={schoolHours[day]?.active} 
                            onCheckedChange={(c) => setSchoolHours({...schoolHours, [day]: {...schoolHours[day], active: c}})}
                          />
                          <span className="text-xs font-bold truncate max-w-[120px]">{label}</span>
                        </div>
                        {schoolHours[day]?.active ? (
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <DebouncedInput 
                              type="time" 
                              className="h-8 text-xs px-1.5 py-0.5 rounded-lg border border-border bg-background w-[90px] min-w-[90px]"
                              value={schoolHours[day]?.start || "08:00"}
                              onChange={(e) => setSchoolHours({...schoolHours, [day]: {...schoolHours[day], start: e.target.value}})}
                            />
                            <span className="text-[10px] font-medium text-muted-foreground">às</span>
                            <DebouncedInput 
                              type="time" 
                              className="h-8 text-xs px-1.5 py-0.5 rounded-lg border border-border bg-background w-[90px] min-w-[90px]"
                              value={schoolHours[day]?.end || "18:00"}
                              onChange={(e) => setSchoolHours({...schoolHours, [day]: {...schoolHours[day], end: e.target.value}})}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic shrink-0">Fechado</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border space-y-2">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Clock size={14} className="text-indigo-500" />
                    Duração Padrão das Aulas
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Define o tempo (em minutos) de cada aula no agendamento da agenda e nos links de matrícula pública.
                  </p>
                  <Select value={String(lessonDuration)} onValueChange={(val) => setLessonDuration(Number(val))}>
                    <SelectTrigger className="w-full sm:w-64 h-10 rounded-xl bg-muted/50 border-border font-bold">
                      <SelectValue placeholder="Selecione a duração" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Minutos</SelectItem>
                      <SelectItem value="45">45 Minutos</SelectItem>
                      <SelectItem value="50">50 Minutos</SelectItem>
                      <SelectItem value="60">60 Minutos (1 Hora)</SelectItem>
                      <SelectItem value="90">90 Minutos (1h 30m)</SelectItem>
                      <SelectItem value="120">120 Minutos (2 Horas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* ── ABA: FINANCEIRO (JUROS E MULTAS) ── */}
            {activeTab === "financeiro" && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                      <DollarSign size={20} className="text-emerald-500" />
                      Motor de Cobranças (Juros e Multas)
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                      Defina as regras financeiras aplicadas automaticamente em tempo real
                    </p>
                  </div>
                  <Button
                    className="gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white h-11 px-6 shadow-lg shadow-emerald-500/20"
                    disabled={updateFinancialMutation.isPending}
                    onClick={() => {
                      updateFinancialMutation.mutate({
                        lateFeeEnabled,
                        lateFeeType,
                        lateFeeValue: Number(lateFeeValue),
                        interestEnabled,
                        interestType,
                        interestRate: Number(interestRate),
                        graceDays: Number(graceDays),
                        autoUpdateInvoice,
                        showFeeBreakdown,
                        earlyDiscountEnabled,
                        earlyDiscountType,
                        earlyDiscountValue: Number(earlyDiscountValue),
                        earlyDiscountDays: Number(earlyDiscountDays),
                      });
                    }}
                  >
                    {updateFinancialMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span className="text-xs font-black uppercase tracking-widest">Salvar Alterações</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                  {/* Coluna 1 & 2: Formulário de Configuração */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Card Desconto por Pagamento Antecipado */}
                    <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
                            <Sparkles size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground">Desconto por Pagamento Antecipado (Pontualidade)</h4>
                            <p className="text-xs text-muted-foreground">Concede desconto se o aluno pagar no vencimento ou com antecedência</p>
                          </div>
                        </div>
                        <Toggle checked={earlyDiscountEnabled} onChange={setEarlyDiscountEnabled} />
                      </div>

                      {earlyDiscountEnabled && (
                        <div className="pt-4 border-t border-border space-y-4 animate-in fade-in">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-foreground uppercase tracking-wider">Tipo do Desconto</label>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setEarlyDiscountType("percentage")}
                                className={cn(
                                  "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all",
                                  earlyDiscountType === "percentage"
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <Percent size={14} /> Percentual (%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setEarlyDiscountType("fixed")}
                                className={cn(
                                  "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all",
                                  earlyDiscountType === "fixed"
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <DollarSign size={14} /> Valor Fixo (R$)
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label={earlyDiscountType === "percentage" ? "Valor do Desconto (%)" : "Valor do Desconto (R$)"}>
                              <Input
                                type="number"
                                step="0.01"
                                value={earlyDiscountValue}
                                onChange={(e) => setEarlyDiscountValue(Number(e.target.value))}
                                className="h-11 font-bold bg-muted/50 rounded-xl"
                              />
                            </Field>

                            <Field label="Dias de Antecedência Exigidos" hint="0 = Válido até a data de vencimento. Ex: 5 = Exige pagamento 5 dias antes">
                              <Input
                                type="number"
                                value={earlyDiscountDays}
                                onChange={(e) => setEarlyDiscountDays(Number(e.target.value))}
                                className="h-11 font-bold bg-muted/50 rounded-xl"
                              />
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Multa */}
                    <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold">
                            %
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground">Cobrar Multa por Atraso</h4>
                            <p className="text-xs text-muted-foreground">Aplica valor ou percentual fixo após o vencimento</p>
                          </div>
                        </div>
                        <Toggle checked={lateFeeEnabled} onChange={setLateFeeEnabled} />
                      </div>

                      {lateFeeEnabled && (
                        <div className="pt-4 border-t border-border space-y-4 animate-in fade-in">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-foreground uppercase tracking-wider">Tipo de Multa</label>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setLateFeeType("percentage")}
                                className={cn(
                                  "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all",
                                  lateFeeType === "percentage"
                                    ? "border-amber-500 bg-amber-500/10 text-amber-500"
                                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <Percent size={14} /> Percentual (%)
                              </button>
                              <button
                                type="button"
                                onClick={() => setLateFeeType("fixed")}
                                className={cn(
                                  "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all",
                                  lateFeeType === "fixed"
                                    ? "border-amber-500 bg-amber-500/10 text-amber-500"
                                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <DollarSign size={14} /> Valor Fixo (R$)
                              </button>
                            </div>
                          </div>

                          <Field label={lateFeeType === "percentage" ? "Valor da Multa (%)" : "Valor da Multa (R$)"}>
                            <Input
                              type="number"
                              step="0.01"
                              value={lateFeeValue}
                              onChange={(e) => setLateFeeValue(parseFloat(String(e.target.value).replace(',', '.')) || 0)}
                              className="h-11 font-bold bg-muted/50 rounded-xl"
                            />
                          </Field>
                        </div>
                      )}
                    </div>

                    {/* Card Juros */}
                    <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold">
                            <Calculator size={18} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground">Cobrar Juros de Mora</h4>
                            <p className="text-xs text-muted-foreground">Calcula juros acumulados por dia ou por mês em atraso</p>
                          </div>
                        </div>
                        <Toggle checked={interestEnabled} onChange={setInterestEnabled} />
                      </div>

                      {interestEnabled && (
                        <div className="pt-4 border-t border-border space-y-4 animate-in fade-in">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-foreground uppercase tracking-wider">Frequência dos Juros</label>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setInterestType("daily")}
                                className={cn(
                                  "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all",
                                  interestType === "daily"
                                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-500"
                                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <Calendar size={14} /> Ao Dia (% ao dia)
                              </button>
                              <button
                                type="button"
                                onClick={() => setInterestType("monthly")}
                                className={cn(
                                  "flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all",
                                  interestType === "monthly"
                                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-500"
                                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                                )}
                              >
                                <Receipt size={14} /> Ao Mês (% ao mês)
                              </button>
                            </div>
                          </div>

                          <Field label={interestType === "daily" ? "Taxa de Juros ao Dia (%)" : "Taxa de Juros ao Mês (%)"}>
                            <Input
                              type="number"
                              step="0.0001"
                              value={interestRate}
                              onChange={(e) => setInterestRate(parseFloat(String(e.target.value).replace(',', '.')) || 0)}
                              className="h-11 font-bold bg-muted/50 rounded-xl"
                            />
                          </Field>
                        </div>
                      )}
                    </div>

                    {/* Card Carência e Exibição */}
                    <div className="p-6 rounded-2xl bg-card border border-border space-y-6 shadow-sm">
                      <h4 className="text-xs font-black text-foreground uppercase tracking-widest">Carência e Exibição</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Field label="Dias de Carência (Tolerância)" hint="Período sem cobrança de juros ou multa após a data de vencimento">
                          <Input
                            type="number"
                            value={graceDays}
                            onChange={(e) => setGraceDays(Number(e.target.value))}
                            className="h-11 font-bold bg-muted/50 rounded-xl"
                          />
                        </Field>

                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-foreground">Atualizar Cobrança Automático</span>
                              <p className="text-[10px] text-muted-foreground">Recalcular valores dinamicamente no sistema</p>
                            </div>
                            <Toggle checked={autoUpdateInvoice} onChange={setAutoUpdateInvoice} />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-foreground">Mostrar Detalhamento ao Aluno</span>
                              <p className="text-[10px] text-muted-foreground">Exibir discriminação de juros e multa no portal do aluno</p>
                            </div>
                            <Toggle checked={showFeeBreakdown} onChange={setShowFeeBreakdown} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coluna 3: Live Preview / Simulador */}
                  <div className="space-y-6">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-card border border-indigo-500/20 space-y-5 shadow-xl relative overflow-hidden">
                      {/* Header do simulador */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-widest text-indigo-400 shrink-0">Simulador ao Vivo</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase shrink-0">
                          Tempo Real
                        </span>
                      </div>

                      <div className="space-y-4">
                        {/* Card 1: Antecipado */}
                        <div className="p-3 rounded-xl bg-card/60 border border-border space-y-2.5">
                          <p className="text-[10px] font-bold text-foreground leading-tight">Pagamento Antecipado (R$ 200,00):</p>

                          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                            <span className="text-[10px] text-muted-foreground self-center">Valor Original:</span>
                            <span className="text-xs font-bold text-foreground text-right">R$ 200,00</span>

                            <span className="text-[10px] text-muted-foreground self-center leading-tight">
                              Desconto ({earlyDiscountEnabled ? (earlyDiscountType === 'percentage' ? `${earlyDiscountValue}%` : `R$${earlyDiscountValue}`) : 'Off'}):
                            </span>
                            <span className="text-xs font-bold text-emerald-400 text-right">
                              -{earlyDiscountEnabled ? (earlyDiscountType === 'percentage' ? (200 * earlyDiscountValue / 100).toFixed(2) : earlyDiscountValue.toFixed(2)) : '0.00'}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-border flex items-center justify-between">
                            <span className="text-[10px] font-bold text-foreground">Com Desconto:</span>
                            <span className="text-sm font-black text-emerald-400">
                              R$ {(200 - (earlyDiscountEnabled ? (earlyDiscountType === 'percentage' ? (200 * earlyDiscountValue / 100) : earlyDiscountValue) : 0)).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>

                        {/* Card 2: Atraso */}
                        <div className="p-3 rounded-xl bg-card/60 border border-border space-y-2.5">
                          <p className="text-[10px] font-bold text-foreground leading-tight">Pagamento em Atraso (5 Dias):</p>

                          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                            <span className="text-[10px] text-muted-foreground self-center leading-tight">
                              Multa ({lateFeeEnabled ? (lateFeeType === 'percentage' ? `${lateFeeValue}%` : `R$${lateFeeValue}`) : 'Off'}):
                            </span>
                            <span className="text-xs font-bold text-amber-400 text-right">
                              +{lateFeeEnabled ? (lateFeeType === 'percentage' ? (200 * lateFeeValue / 100).toFixed(2) : lateFeeValue.toFixed(2)) : '0.00'}
                            </span>

                            <span className="text-[10px] text-muted-foreground self-center leading-tight">
                              Juros ({interestEnabled ? (interestType === 'daily' ? `${interestRate}%/d` : `${interestRate}%/m`) : 'Off'}):
                            </span>
                            <span className="text-xs font-bold text-indigo-400 text-right">
                              +{interestEnabled ? (interestType === 'daily' ? (200 * (interestRate / 100) * 5).toFixed(2) : (200 * (interestRate / 100) * (5/30)).toFixed(2)) : '0.00'}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-border flex items-center justify-between">
                            <span className="text-[10px] font-bold text-foreground">Com Atraso:</span>
                            <span className="text-sm font-black text-rose-400">
                              R$ {(
                                200 +
                                (lateFeeEnabled ? (lateFeeType === 'percentage' ? (200 * lateFeeValue / 100) : lateFeeValue) : 0) +
                                (interestEnabled ? (interestType === 'daily' ? (200 * (interestRate / 100) * 5) : (200 * (interestRate / 100) * (5/30))) : 0)
                              ).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                    { label: "Novo aluno", desc: "Notificação ao cadastrar novo estudante", value: notifyNewStudent, onChange: setNotifyNewStudent },
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Light */}
                  <button
                    onClick={() => {
                      if (theme !== "light") {
                        setTheme("light");
                        updateTheme.mutate({ theme: "light" });
                        toast.success("Tema Claro ativado!");
                      }
                    }}
                    className={cn(
                      "relative p-5 rounded-[2rem] border-4 transition-all text-left group",
                      theme === "light"
                        ? "border-indigo-600 bg-indigo-500/10 shadow-xl shadow-indigo-500/20"
                        : "border-border bg-card hover:border-indigo-200"
                    )}
                  >
                    <div className="w-full h-20 rounded-[1.25rem] bg-card border border-border mb-4 overflow-hidden shadow-sm flex flex-col">
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
                       <div className="flex items-center gap-2.5">
                         <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                            <Sun size={16} />
                         </div>
                         <span className="text-xs font-black uppercase tracking-widest text-foreground">Modo Claro</span>
                       </div>
                       {theme === "light" && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
                    </div>
                  </button>

                  {/* Dark */}
                  <button
                    onClick={() => {
                      if (theme !== "dark") {
                        setTheme("dark");
                        updateTheme.mutate({ theme: "dark" });
                        toast.success("Tema Escuro ativado!");
                      }
                    }}
                    className={cn(
                      "relative p-5 rounded-[2rem] border-4 transition-all text-left group",
                      theme === "dark"
                        ? "border-indigo-600 bg-indigo-500/10 shadow-xl shadow-indigo-500/20"
                        : "border-border bg-card hover:border-indigo-200"
                    )}
                  >
                    <div className="w-full h-20 rounded-[1.25rem] bg-slate-900 border border-slate-800 mb-4 overflow-hidden shadow-sm flex flex-col">
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
                       <div className="flex items-center gap-2.5">
                         <div className="w-7 h-7 rounded-xl bg-indigo-900 text-indigo-400 flex items-center justify-center shrink-0">
                            <Moon size={16} />
                         </div>
                         <span className="text-xs font-black uppercase tracking-widest text-foreground">Modo Escuro</span>
                       </div>
                       {theme === "dark" && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
                    </div>
                  </button>

                  {/* Midnight Cyber */}
                  <button
                    onClick={() => {
                      if (theme !== "midnight") {
                        setTheme("midnight");
                        updateTheme.mutate({ theme: "midnight" });
                        toast.success("Tema Midnight Cyber ativado!");
                      }
                    }}
                    className={cn(
                      "relative p-5 rounded-[2rem] border-4 transition-all text-left group",
                      theme === "midnight"
                        ? "border-cyan-500 bg-cyan-500/10 shadow-xl shadow-cyan-500/20"
                        : "border-border bg-card hover:border-cyan-200"
                    )}
                  >
                    <div className="w-full h-20 rounded-[1.25rem] bg-[#0c1222] border border-[#1e293b] mb-4 overflow-hidden shadow-sm flex flex-col">
                       <div className="h-4 bg-[#1e293b] border-b border-[#334155] flex items-center px-2 gap-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                         <div className="w-6 h-1 rounded bg-cyan-900/50" />
                       </div>
                       <div className="flex-1 p-3 space-y-2">
                         <div className="h-3 bg-cyan-500/30 rounded-full w-3/4" />
                         <div className="h-2 bg-[#1e293b] rounded-full w-1/2" />
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                         <div className="w-7 h-7 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center shrink-0">
                            <Sparkles size={16} />
                         </div>
                         <span className="text-xs font-black uppercase tracking-widest text-foreground">Midnight</span>
                       </div>
                       {theme === "midnight" && <CheckCircle2 size={18} className="text-cyan-400 shrink-0" />}
                    </div>
                  </button>

                  {/* Purple Emerald */}
                  <button
                    onClick={() => {
                      if (theme !== "purple") {
                        setTheme("purple");
                        updateTheme.mutate({ theme: "purple" });
                        toast.success("Tema Purple Emerald ativado!");
                      }
                    }}
                    className={cn(
                      "relative p-5 rounded-[2rem] border-4 transition-all text-left group",
                      theme === "purple"
                        ? "border-purple-500 bg-purple-500/10 shadow-xl shadow-purple-500/20"
                        : "border-border bg-card hover:border-purple-200"
                    )}
                  >
                    <div className="w-full h-20 rounded-[1.25rem] bg-[#170b24] border border-[#2d1245] mb-4 overflow-hidden shadow-sm flex flex-col">
                       <div className="h-4 bg-[#2d1245] border-b border-[#431866] flex items-center px-2 gap-1">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                         <div className="w-6 h-1 rounded bg-purple-900/50" />
                       </div>
                       <div className="flex-1 p-3 space-y-2">
                         <div className="h-3 bg-purple-500/40 rounded-full w-3/4" />
                         <div className="h-2 bg-emerald-500/20 rounded-full w-1/2" />
                       </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                         <div className="w-7 h-7 rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center shrink-0">
                            <Palette size={16} />
                         </div>
                         <span className="text-xs font-black uppercase tracking-widest text-foreground">Purple</span>
                       </div>
                       {theme === "purple" && <CheckCircle2 size={18} className="text-purple-400 shrink-0" />}
                    </div>
                  </button>
                </div>

                <div className="pt-6 border-t border-border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest">Menu Lateral</h3>
                      <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Escolha quais abas aparecem no menu</p>
                    </div>
                    <Button
                      className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-lg shadow-indigo-500/20"
                      disabled={updateHiddenTabs.isPending}
                      onClick={() => updateHiddenTabs.mutate({ hiddenTabs: hiddenTabs.join(",") })}
                    >
                      {updateHiddenTabs.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      <span className="text-xs font-black uppercase tracking-widest">Salvar</span>
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableSidebarTabs.map(tab => {
                      const isVisible = !hiddenTabs.includes(tab.href);
                      return (
                        <div key={tab.href} className="flex items-center justify-between p-4 bg-muted rounded-2xl border border-border group hover:border-indigo-100 transition-colors">
                          <div className="pr-4">
                            <p className="text-xs font-black text-foreground uppercase tracking-widest mb-1">{tab.label}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate max-w-[120px]">{tab.desc}</p>
                          </div>
                          <Toggle 
                            checked={isVisible} 
                            onChange={(show) => {
                              if (show) {
                                setHiddenTabs(hiddenTabs.filter(h => h !== tab.href));
                              } else {
                                setHiddenTabs([...hiddenTabs, tab.href]);
                              }
                            }} 
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* ── ABA: MEU WHATSAPP ── */}
            {activeTab === "whatsapp" && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base lg:text-lg font-black text-foreground uppercase tracking-widest">Meu WhatsApp (Multi-Sessão)</h3>
                    <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Conecte seu celular para envio de lembretes</p>
                  </div>
                  <Button
                    className="gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11 px-6 shadow-lg shadow-indigo-500/20"
                    disabled={updateWhatsAppMutation.isPending}
                    onClick={handleSaveWhatsApp}
                  >
                    {updateWhatsAppMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span className="text-xs font-black uppercase tracking-widest">Salvar Automação</span>
                  </Button>
                </div>

                <WhatsAppSessionManager />

                <div className="p-6 bg-indigo-500/10 rounded-[1.5rem] border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-1">Conexão Segura e Criptografada</p>
                    <p className="text-[11px] text-indigo-800/70 dark:text-indigo-300/70 font-medium leading-relaxed">
                      Sua instância de WhatsApp está operando de forma isolada e segura em nossos servidores dedicados. As credenciais de comunicação e chaves de API são gerenciadas e protegidas automaticamente em nível de código (backend).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">

                  {/* ── Toggle: Robô de Autoatendimento ── */}
                  <div className={cn(
                    "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300",
                    chatbotEnabled
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-muted border-border"
                  )}>
                    <div className="flex items-center gap-4 pr-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 text-lg",
                        chatbotEnabled
                          ? "bg-green-500 shadow-lg shadow-green-500/30"
                          : "bg-muted-foreground/20"
                      )}>
                        🤖
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-black text-foreground uppercase tracking-widest">Robô de Autoatendimento</p>
                          {chatbotEnabled && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 text-[9px] font-black uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                              ATIVO
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                          Responde automaticamente mensagens recebidas no WhatsApp com um menu interativo: aulas, financeiro, matrículas e muito mais.
                        </p>
                      </div>
                    </div>
                    <Toggle
                      checked={chatbotEnabled}
                      onChange={handleToggleChatbot}
                    />
                  </div>

                  {/* ── Toggle: Robô de Antecipação Inteligente por Falta ── */}
                  <div className={cn(
                    "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300",
                    autoAdvanceSlotsEnabled
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-muted border-border"
                  )}>
                    <div className="flex items-center gap-4 pr-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 text-lg",
                        autoAdvanceSlotsEnabled
                          ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30 font-black"
                          : "bg-muted-foreground/20 text-muted-foreground"
                      )}>
                        ⚡
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-black text-foreground uppercase tracking-widest">Robô de Antecipação por Falta</p>
                          {autoAdvanceSlotsEnabled && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-black uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                              ATIVO
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                          Ao marcar falta em uma aula (ex: 19h), envia WhatsApp automático para alunos com aula mais tarde (20h/21h) oferecendo o adiantamento de horário via Portal do Aluno.
                        </p>
                      </div>
                    </div>
                    <Toggle
                      checked={autoAdvanceSlotsEnabled}
                      onChange={handleToggleAutoAdvance}
                    />
                  </div>

                  {/* ── Toggle: Disparo Automático ── */}
                  <div className="flex items-center justify-between p-5 bg-muted rounded-2xl border border-border group hover:border-indigo-100 transition-colors">
                    <div className="pr-4">
                      <p className="text-xs font-black text-foreground uppercase tracking-widest mb-1">Disparo Automático em Segundo Plano</p>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                        Se ativado, o sistema enviará automaticamente as mensagens pendentes nos horários agendados.
                      </p>
                    </div>
                    <Toggle checked={whatsappAutoSend} onChange={setWhatsappAutoSend} />
                  </div>
                </div>
              </div>
            )}
            {/* ── ABA: INTEGRAÇÕES / PAGAMENTOS ── */}
            {activeTab === "integracoes" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Wallet size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Pagamentos dos Alunos</h3>
                    <p className="text-xs text-muted-foreground font-medium">Habilite o checkout de mensalidades via Asaas ou Mercado Pago na área do aluno.</p>
                  </div>
                </div>

                <div className="bg-card p-6 rounded-3xl border border-border/50 shadow-sm space-y-6">
                  <Field label="Provedor de Pagamento" hint="Escolha qual gateway processará os pagamentos dos seus alunos.">
                    <select
                      value={paymentGateway}
                      onChange={(e) => setPaymentGateway(e.target.value as "asaas" | "mercadopago")}
                      className="h-12 bg-muted/50 border-border/50 rounded-xl px-4 text-sm font-medium focus:ring-primary w-full"
                    >
                      <option value="asaas">Asaas (Boleto/Pix)</option>
                      <option value="mercadopago">Mercado Pago (Cartão/Pix)</option>
                    </select>
                  </Field>

                  {paymentGateway === "asaas" ? (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-muted/30">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Ativar Integração Asaas</h4>
                          <p className="text-xs text-muted-foreground font-medium max-w-sm leading-relaxed">
                            Quando ativado, os alunos poderão visualizar o QR Code do PIX e pagar faturas diretamente pelo portal usando o Asaas.
                          </p>
                        </div>
                        <Toggle checked={asaasEnabled} onChange={setAsaasEnabled} />
                      </div>

                      <Field 
                        label="Chave da API Asaas (API Key)"
                        hint="A chave secreta gerada no painel do Asaas (Configurações > Integrações > Gerar API Key)."
                      >
                        <DebouncedInput
                          type="password"
                          value={asaasApiKey}
                          onChange={(e) => setAsaasApiKey(e.target.value)}
                          placeholder="$aact_..."
                          className="h-12 bg-muted/50 border-border/50 rounded-xl px-4 font-mono text-sm"
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400">Ativar Integração Mercado Pago</h4>
                          <p className="text-xs text-blue-600/70 dark:text-blue-400/70 font-medium max-w-sm leading-relaxed">
                            Ao salvar esta opção, seus alunos terão uma nova tela de checkout onde poderão usar Pix ou Cartão de Crédito com a segurança do Mercado Pago. O dinheiro cai direto na sua conta.
                          </p>
                        </div>
                      </div>

                      <Field 
                        label="Access Token Mercado Pago"
                        hint="A chave secreta gerada no painel de desenvolvedor do Mercado Pago."
                      >
                        <DebouncedInput
                          type="password"
                          value={mpAccessToken}
                          onChange={(e) => setMpAccessToken(e.target.value)}
                          placeholder="APP_USR-..."
                          className="h-12 bg-muted/50 border-border/50 rounded-xl px-4 font-mono text-sm"
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSaveAsaas}
                  disabled={updateAsaasMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg px-6 h-10 text-xs font-bold"
                >
                  {updateAsaasMutation.isPending ? "Salvando..." : "Salvar Integração"}
                </Button>

                {/* ── Assinatura Digital (Assinafy — BYOK) ─────────────────── */}
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  <div className="w-10 h-10 rounded-2xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
                    <FileSignature size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Contratos Digitais</h3>
                    <p className="text-xs text-muted-foreground font-medium">Assinatura eletrônica de contratos dos alunos.</p>
                  </div>
                </div>
                <AssinafyIntegrationCard />
              </div>
            )}
          {activeTab === "ia" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">IA Assistente (Gemini)</h3>
                  <p className="text-xs text-muted-foreground font-medium">Configure a sua chave secreta da API do Google Gemini.</p>
                </div>
              </div>

              <div className="bg-card p-6 rounded-3xl border border-border/50 shadow-sm space-y-6">
                <Field 
                  label="Provedor de Inteligência Artificial"
                  hint="Escolha qual motor de IA você deseja utilizar para geração de textos e planos."
                >
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="w-full h-12 bg-muted/50 border border-border/50 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="groq">Groq (Llama 3)</option>
                  </select>
                </Field>
              </div>

              {aiProvider === "gemini" && (
                <>
                  <div className="bg-card p-6 rounded-3xl border border-border/50 shadow-sm space-y-6">
                    <Field 
                      label="Chave da API Gemini"
                      hint="Esta chave é individual e será usada para gerar as respostas da inteligência artificial no seu painel."
                    >
                      <DebouncedInput
                        type="password"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="h-12 bg-muted/50 border-border/50 rounded-xl px-4 font-mono text-sm"
                      />
                    </Field>
                  </div>

                  <div className="bg-card p-6 rounded-3xl border border-border/50 shadow-sm space-y-6">
                    <Field 
                      label="Modelo da IA (Gemini)"
                      hint="Escolha qual versão da inteligência artificial você deseja utilizar."
                    >
                      <select
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        className="w-full h-12 bg-muted/50 border border-border/50 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview (Sua Escolha)</option>
                        <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      </select>
                    </Field>
                  </div>
                </>
              )}

              {aiProvider === "groq" && (
                <>
                  <div className="bg-card p-6 rounded-3xl border border-border/50 shadow-sm space-y-6">
                    <Field 
                      label="Chave da API Groq"
                      hint="Crie sua chave em https://console.groq.com/keys para usar modelos ultrarrápidos como Llama 3."
                    >
                      <DebouncedInput
                        type="password"
                        value={groqApiKey}
                        onChange={(e) => setGroqApiKey(e.target.value)}
                        placeholder="gsk_..."
                        className="h-12 bg-muted/50 border-border/50 rounded-xl px-4 font-mono text-sm"
                      />
                    </Field>
                  </div>

                  <div className="bg-card p-6 rounded-3xl border border-border/50 shadow-sm space-y-6">
                    <Field 
                      label="Modelo da IA (Groq)"
                      hint="Llama 3 70B é recomendado para maior inteligência."
                    >
                      <select
                        value={groqModel}
                        onChange={(e) => setGroqModel(e.target.value)}
                        className="w-full h-12 bg-muted/50 border border-border/50 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Recomendado)</option>
                        <option value="llama-3.1-8b-instant">Llama 3.1 8B (Mais rápido)</option>
                        <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                      </select>
                    </Field>
                  </div>
                </>
              )}

              <Button
                onClick={handleSaveIA}
                disabled={updateIAMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg px-6 h-10 text-xs font-bold"
              >
                {updateIAMutation.isPending ? "Salvando..." : "Salvar Chave da IA"}
              </Button>
            </div>
          )}

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
                      Sua conta está protegida. A autenticação é gerenciada de forma centralizada para máxima segurança.
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
                {user?.email?.toLowerCase() && ['walyssonrodrigo145@gmail.com', 'ddwvitor@gmail.com'].includes(user.email.toLowerCase()) && (
                  <CleanupTestDataSection />
                )}
              </div>
            )}

            {/* ── ABA: PROFESSORES ── */}
            {activeTab === "professores" && (
              <ProfessoresTab />
            )}

            {/* ── ABA: SALAS DE ESTÚDIO ── */}
            {activeTab === "salas" && (
              <SalasEstudioTab />
            )}

            {/* ── ABA: MODELOS DE CONTRATO ── */}
            {activeTab === "modelos_contrato" && (
              <ModelosContratoTab />
            )}

            {/* ── ABA: AJUDA ── */}
            {activeTab === "ajuda" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center">
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Ajuda e Tutoriais</h3>
                    <p className="text-xs text-muted-foreground font-medium">Reveja tutoriais e aprenda a usar o sistema.</p>
                  </div>
                </div>

                <div className="bg-card p-6 rounded-3xl border border-border/50 shadow-sm space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Tour Guiado da Plataforma</h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-md">
                        Relembre como as principais áreas do sistema funcionam. O tour mostrará passo a passo os menus, gráficos e controles.
                      </p>
                    </div>
                    <Button onClick={() => startTour()} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 px-6 h-10 text-xs font-bold gap-2">
                      <HelpCircle size={16} />
                      Iniciar Tour
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



