import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CameraOff,
  Keyboard,
  CheckCircle2,
  XCircle,
  QrCode,
  Shield,
  ArrowLeft,
  Send,
  Loader2,
  Sparkles,
  ScanLine,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLocation } from "wouter";
import jsQR from "jsqr";

// ─── Types ───────────────────────────────────────────────────────────────────
type ScanState = "idle" | "scanning" | "success" | "error";

// ─── Camera Viewfinder Component ─────────────────────────────────────────────
function Viewfinder() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Darkened overlay with transparent center */}
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64">
        {/* Clear area */}
        <div className="absolute inset-0 bg-transparent" style={{
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)"
        }} />

        {/* Scan line animation */}
        <motion.div
          className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
          animate={{ top: ["8px", "248px", "8px"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-indigo-400 rounded-tl-xl" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-indigo-400 rounded-tr-xl" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-indigo-400 rounded-bl-xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-indigo-400 rounded-br-xl" />

        {/* Pulsing glow */}
        <motion.div
          className="absolute inset-0 rounded-xl border-2 border-indigo-400/30"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
    </div>
  );
}

// ─── Success Overlay ─────────────────────────────────────────────────────────
function SuccessOverlay({ name }: { name?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
        >
          <CheckCircle2 size={48} className="text-white" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white"
        >
          Presença Registrada!
        </motion.h2>
        {name && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-white/60 text-lg"
          >
            Bem-vindo(a), {name}!
          </motion.p>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 mt-4 text-emerald-300 text-sm"
        >
          <Sparkles size={16} />
          <span>Bons estudos!</span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Error Overlay ───────────────────────────────────────────────────────────
function ErrorOverlay({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="flex flex-col items-center gap-4 px-8"
      >
        <motion.div
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-2xl shadow-red-500/30"
        >
          <XCircle size={48} className="text-white" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold text-white"
        >
          Erro no Registro
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-white/60 text-center max-w-xs"
        >
          {message}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function QRScanner() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"camera" | "manual">("manual");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [manualToken, setManualToken] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successName, setSuccessName] = useState<string | undefined>();
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<number>();

  // tRPC mutation
  const scanMutation = trpc.attendance.scan.useMutation({
    onSuccess: (data: any) => {
      setScanState("success");
      setSuccessName(data?.userName ?? user?.name);
      setManualToken("");
      setTimeout(() => {
        setScanState("idle");
        setSuccessName(undefined);
      }, 3000);
    },
    onError: (err) => {
      setScanState("error");
      setErrorMessage(
        err.message || "Token inválido ou expirado. Tente novamente."
      );
      setTimeout(() => {
        setScanState("idle");
        setErrorMessage("");
      }, 3000);
    },
  });

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play().catch((e) => console.error("Video play err:", e));
      }
    } catch (err) {
      setCameraError(
        "Não foi possível acessar a câmera. Verifique as permissões do navegador."
      );
      setMode("manual");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  // Focus manual input on mode change
  useEffect(() => {
    if (mode === "manual") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [mode]);

  // Handle scan submission
  const handleScan = useCallback(
    (tokenValue: string) => {
      const cleaned = tokenValue.trim();
      if (!cleaned || scanState !== "idle") return;

      setScanState("scanning");
      scanMutation.mutate({ token: cleaned });
    },
    [scanMutation, scanState]
  );

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));

  const scanQRCode = useCallback(() => {
    if (
      videoRef.current && 
      videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
      videoRef.current.videoWidth > 0
    ) {
      const canvasElement = canvasRef.current;
      const canvas = canvasElement.getContext("2d", { willReadFrequently: true });
      canvasElement.width = videoRef.current.videoWidth;
      canvasElement.height = videoRef.current.videoHeight;
      if (canvas) {
        try {
          canvas.drawImage(videoRef.current, 0, 0, canvasElement.width, canvasElement.height);
          const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            handleScan(code.data);
            return;
          }
        } catch (e) {
          // ignora erro silenciosamente
        }
      }
    }
    if (mode === "camera" && scanState === "idle") {
      requestRef.current = requestAnimationFrame(scanQRCode);
    }
  }, [handleScan, scanState, mode]);

  useEffect(() => {
    if (mode === "camera" && scanState === "idle") {
      requestRef.current = requestAnimationFrame(scanQRCode);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mode, scanState, scanQRCode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScan(manualToken);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 py-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl"
          onClick={() => navigate(-1 as any)}
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Registrar Presença</h1>
          <p className="text-xs text-white/40">
            Escaneie o QR Code ou digite o código
          </p>
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
          <Shield size={14} className="text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300">Seguro</span>
        </div>
      </header>

      {/* Mode Tabs */}
      <div className="relative z-10 px-4 mb-4">
        <div className="flex gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
          <button
            onClick={() => setMode("camera")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300",
              mode === "camera"
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-white/50 hover:text-white/70"
            )}
          >
            <Camera size={18} />
            Câmera
          </button>
          <button
            onClick={() => setMode("manual")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-300",
              mode === "manual"
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-white/50 hover:text-white/70"
            )}
          >
            <Keyboard size={18} />
            Digitar Código
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 px-4 pb-4">
        <AnimatePresence mode="wait">
          {mode === "camera" ? (
            <motion.div
              key="camera"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="relative h-full"
            >
              {/* Camera view */}
              <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4] max-h-[60vh] mx-auto">
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                      <CameraOff size={36} className="text-red-400" />
                    </div>
                    <p className="text-white/60 text-center text-sm">
                      {cameraError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startCamera}
                      className="border-white/20 text-white hover:bg-white/10 rounded-xl"
                    >
                      <RefreshCw size={14} className="mr-2" />
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={() => {
                        videoRef.current?.play().catch(console.error);
                      }}
                      onPlay={() => {
                        if (mode === "camera" && scanState === "idle") {
                          requestRef.current = requestAnimationFrame(scanQRCode);
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                    <Viewfinder />
                  </>
                )}

                {/* Overlays */}
                <AnimatePresence>
                  {scanState === "success" && (
                    <SuccessOverlay name={successName} />
                  )}
                  {scanState === "error" && (
                    <ErrorOverlay message={errorMessage} />
                  )}
                </AnimatePresence>
              </div>

              {/* Camera instructions */}
              <div className="mt-6 text-center">
                <p className="text-white/50 text-sm">
                  Posicione o QR Code dentro da área marcada
                </p>
                <p className="text-white/30 text-xs mt-1">
                  Ou use a aba "Digitar Código" para inserir manualmente
                </p>
              </div>

              {/* Manual input fallback under camera */}
              <form
                onSubmit={handleManualSubmit}
                className="mt-4 flex gap-2"
              >
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Cole o token aqui..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                />
                <Button
                  type="submit"
                  disabled={!manualToken.trim() || scanState !== "idle"}
                  className="px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
                >
                  {scanState === "scanning" ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </Button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="manual"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              {/* Visual */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring" }}
                className="relative mb-8 mt-8"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl scale-150" />
                <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <QrCode size={56} className="text-indigo-400" />
                  </motion.div>
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-bold text-white mb-2"
              >
                Digite o Código de Presença
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-white/40 text-center mb-8 max-w-xs"
              >
                Insira o código exibido na tela da recepção para registrar sua
                presença
              </motion.p>

              {/* Token Input */}
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onSubmit={handleManualSubmit}
                className="w-full max-w-sm space-y-4"
              >
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={manualToken}
                    onChange={(e) =>
                      setManualToken(e.target.value.toUpperCase())
                    }
                    placeholder="DIGITE O CÓDIGO"
                    maxLength={20}
                    className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-center text-2xl font-mono font-bold tracking-[0.3em] placeholder:text-white/15 placeholder:text-lg placeholder:tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {manualToken && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <button
                        type="button"
                        onClick={() => setManualToken("")}
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/40 hover:text-white/60 transition-colors"
                      >
                        ✕
                      </button>
                    </motion.div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={!manualToken.trim() || scanState !== "idle"}
                  className="w-full py-4 h-auto rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-base shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-40 disabled:shadow-none"
                >
                  {scanState === "scanning" ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={20} className="animate-spin" />
                      <span>Verificando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap size={20} />
                      <span>Registrar Presença</span>
                    </div>
                  )}
                </Button>
              </motion.form>

              {/* Status feedback */}
              <AnimatePresence>
                {scanState === "success" && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    className="mt-8 w-full max-w-sm px-6 py-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3"
                  >
                    <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-300">
                        Presença registrada com sucesso!
                      </p>
                      {successName && (
                        <p className="text-xs text-emerald-300/60 mt-0.5">
                          Bem-vindo(a), {successName}!
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
                {scanState === "error" && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.9 }}
                    className="mt-8 w-full max-w-sm px-6 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
                  >
                    <XCircle size={24} className="text-red-400 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-red-300">
                        {errorMessage || "Código inválido ou expirado"}
                      </p>
                      <p className="text-xs text-red-300/60 mt-0.5">
                        Verifique o código e tente novamente
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tips */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-8 w-full max-w-sm space-y-3"
              >
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <ScanLine size={18} className="text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-white/50">Dica</p>
                    <p className="text-xs text-white/30">
                      O código na recepção muda a cada 30 segundos. Digite-o rapidamente
                      para garantir a validação.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
