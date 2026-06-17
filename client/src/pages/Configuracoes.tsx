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
  CheckCircle2, Music, Loader2, AlertTriangle, Download, Smartphone, Wallet, Sparkles,
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

// ─── GESTÃO DE SESSÕES BAILEYS ────────────────────────────────────────────────
function WhatsAppSessionManager() {
  const [step, setStep] = useState<"DISCONNECTED" | "PAIRING" | "CONNECTED">("DISCONNECTED");
  const [modeTab, setModeTab] = useState<"QR_CODE" | "PAIRING_CODE">("QR_CODE");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [qrString, setQrString] = useState("");
  const [connectedPhone, setConnectedPhone] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const startSession = trpc.whatsapp.startSession.useMutation();
  const logoutSession = trpc.whatsapp.logout.useMutation();
  const testConnection = trpc.whatsapp.testConnection.useMutation();
  const getStatusQuery = trpc.whatsapp.getStatus.useQuery(undefined, {
    refetchInterval: step === "PAIRING" ? 3000 : false, // Polling a cada 3s se PAIRING
  });

  const [testingConnection, setTestingConnection] = useState(false);

  // Atualizar estado baseado na query
  useEffect(() => {
    if (getStatusQuery.data) {
      if (getStatusQuery.data.status === "CONNECTED") {
        setStep("CONNECTED");
        setConnectedPhone(getStatusQuery.data.phone || phoneNumber || "Conectado");
      } else if (getStatusQuery.data.status === "DISCONNECTED") {
        // Se o status da query for DISCONNECTED, só voltamos para o passo DISCONNECTED
        // se não estivermos no meio de um pareamento ativo (evita race condition ao gerar QR Code).
        if (step !== "DISCONNECTED" && step !== "PAIRING") {
          setStep("DISCONNECTED");
        }
      } else if (getStatusQuery.data.status === "PAIRING") {
        const pairingData = getStatusQuery.data as any;
        if (pairingData.qr && !qrString) {
          // O Baileys v7 agora retorna uma URL (https://wa.me/settings/linked_devices#...)
          // Precisamos limpar isso para o gerador de QR Code não quebrar e o WhatsApp conseguir ler.
          let rawQr = pairingData.qr;
          if (rawQr.includes("#")) {
            rawQr = rawQr.split("#")[1];
          }
          setQrString(rawQr);
        }
        if (pairingData.pairingCode && !pairingCode) setPairingCode(pairingData.pairingCode);
        if (step !== "PAIRING") {
          setStep("PAIRING");
        }
      }
    }
  }, [getStatusQuery.data, step]);

  // Timer de 60 segundos no modo PAIRING
  useEffect(() => {
    if (step !== "PAIRING") return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setStep("DISCONNECTED");
          toast.error("O tempo de pareamento expirou. Tente novamente.");
          return 60;
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
    try {
      const res = await startSession.mutateAsync({ 
        phoneNumber: modeTab === "PAIRING_CODE" ? phoneNumber : undefined,
        mode: modeTab,
      });
      if (res.success) {
        if (res.qr) setQrString(res.qr);
        if (res.pairingCode) setPairingCode(res.pairingCode);
        setStep("PAIRING");
        setTimeLeft(60);
        toast.success(modeTab === "QR_CODE" ? "QR Code gerado com sucesso!" : "Código gerado com sucesso!");
        getStatusQuery.refetch();
      } else {
        toast.error("Falha ao iniciar pareamento.");
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
                    <Input
                      value={phoneNumber}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, "");
                        if (val.length > 11) val = val.slice(0, 11);
                        if (val.length > 2) val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                        if (val.length > 10) val = `${val.slice(0, 10)}-${val.slice(10)}`;
                        setPhoneNumber(val);
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
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrString)}`} 
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
              Aguardando confirmação do celular ({timeLeft}s)...
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

// ─── Tab types ───────────────────────────────────────────────────────────────
type Tab = "perfil" | "escola" | "notificacoes" | "aparencia" | "whatsapp" | "integracoes" | "ia" | "seguranca";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil", label: "Perfil", icon: User },
  { id: "escola", label: "Escola", icon: Building2 },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "whatsapp", label: "Meu WhatsApp", icon: Smartphone },
  { id: "integracoes", label: "Integrações", icon: Wallet },
  { id: "ia", label: "IA Assistente", icon: Sparkles },
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
  const [profilePixKey, setProfilePixKey] = useState("");

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

  // ── WhatsApp Bot state ──
  const [whatsappBotUrl, setWhatsappBotUrl] = useState("");
  const [whatsappBotToken, setWhatsappBotToken] = useState("");
  const [whatsappAutoSend, setWhatsappAutoSend] = useState(false);

  // ── Asaas state ──
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [asaasEnabled, setAsaasEnabled] = useState(false);

  // ── IA state ──
  const [geminiApiKey, setGeminiApiKey] = useState("");

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
      setNotifyLesson(settings.notifyLessonReminder === 1);
      setNotifyPayment(settings.notifyPaymentDue === 1);
      setNotifyAbsence(settings.notifyStudentAbsence === 1);
      setNotifyNewStudent(settings.notifyNewStudent === 1);
      setNotifyWeekly(settings.notifyWeeklyReport === 1);
      setHiddenTabs(settings.hiddenTabs ? settings.hiddenTabs.split(",") : []);
      setWhatsappBotUrl(settings.whatsappBotUrl ?? "");
      setWhatsappBotToken(settings.whatsappBotToken ?? "");
      setWhatsappAutoSend(settings.whatsappAutoSend === 1);
      setAsaasApiKey(settings.asaasApiKey ?? "");
      setAsaasEnabled(settings.asaasEnabled === 1);
      setGeminiApiKey(settings.geminiApiKey ?? "");
    }
  }, [settings]);

  const [hiddenTabs, setHiddenTabs] = useState<string[]>([]);
  
  const availableSidebarTabs = [
    { label: "Dashboard", href: "/dashboard", desc: "Visão geral" },
    { label: "Alunos", href: "/alunos", desc: "Gestão de estudantes" },
    { label: "Aulas", href: "/aulas", desc: "Calendário e agenda" },
    { label: "Instrumentos", href: "/instrumentos", desc: "Gestão de cursos/instrumentos" },
    { label: "Relatórios", href: "/relatorios", desc: "Métricas e gráficos" },
    { label: "Lembretes", href: "/lembretes", desc: "Alertas automáticos" },
    { label: "Comunicados", href: "/comunicados", desc: "Mural de avisos" },
    { label: "Mensagens", href: "/mensagens", desc: "Chat com alunos" },
    { label: "Solicitações", href: "/solicitacoes", desc: "Reposições e faltas" },
    { label: "IA Assistente", href: "/ia", desc: "Chat inteligente (Gemini)" },
    { label: "Progresso", href: "/progresso", desc: "Evolução dos alunos" },
    { label: "Mensalidades", href: "/mensalidades", desc: "Financeiro" },
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

  const handleSaveWhatsApp = () => {
    updateWhatsAppMutation.mutate({
      whatsappBotUrl,
      whatsappBotToken,
      whatsappAutoSend,
    });
  };

  const handleSaveAsaas = () => {
    updateAsaasMutation.mutate({
      asaasApiKey,
      asaasEnabled,
    });
  };

  const handleSaveIA = () => {
    updateIAMutation.mutate({
      geminiApiKey,
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

                  <Field label="Chave PIX para Recebimento" hint="Aparecerá para o aluno ao realizar pagamentos">
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h10v10H7z"/><path d="M16 16h2v2h-2z"/><path d="M16 6h2v2h-2z"/><path d="M6 16h2v2H6z"/><path d="M6 6h2v2H6z"/></svg>
                      </div>
                      <Input
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

            {/* ── ABA: SEGURANÇA ── */}
          {activeTab === "integracoes" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Asaas Pagamentos</h3>
                  <p className="text-xs text-muted-foreground font-medium">Habilite o checkout de mensalidades via Asaas na área do aluno.</p>
                </div>
              </div>

              <div className="bg-card p-6 rounded-3xl border border-border/50 shadow-sm space-y-6">
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
                  <Input
                    type="password"
                    value={asaasApiKey}
                    onChange={(e) => setAsaasApiKey(e.target.value)}
                    placeholder="$aact_..."
                    className="h-12 bg-muted/50 border-border/50 rounded-xl px-4 font-mono text-sm"
                  />
                </Field>
              </div>

              <Button
                onClick={handleSaveAsaas}
                disabled={updateAsaasMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg px-6 h-10 text-xs font-bold"
              >
                {updateAsaasMutation.isPending ? "Salvando..." : "Salvar Integração"}
              </Button>
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
                  label="Chave da API Gemini"
                  hint="Esta chave é individual e será usada para gerar as respostas da inteligência artificial no seu painel."
                >
                  <Input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="h-12 bg-muted/50 border-border/50 rounded-xl px-4 font-mono text-sm"
                  />
                </Field>
              </div>

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



