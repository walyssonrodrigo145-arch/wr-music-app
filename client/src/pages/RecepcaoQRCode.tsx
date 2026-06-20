import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode,
  RefreshCw,
  Shield,
  Clock,
  UserCheck,
  Music,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Constants ───────────────────────────────────────────────────────────────
const TOKEN_REFRESH_INTERVAL = 30; // seconds
const QR_SIZE = 380;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildQrUrl(token: string): string {
  const payload = encodeURIComponent(token);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${payload}&bgcolor=0f172a&color=ffffff&format=svg`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ─── Circular Timer ──────────────────────────────────────────────────────────
function CircularTimer({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = remaining / total;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center w-16 h-16">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 52 52">
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-white/10"
          strokeWidth="3"
        />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="url(#timer-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-linear"
        />
        <defs>
          <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-sm font-bold text-white tabular-nums">
        {remaining}s
      </span>
    </div>
  );
}

// ─── Scan Activity Item ──────────────────────────────────────────────────────
function ScanItem({
  name,
  time,
  type,
  index,
}: {
  name: string;
  time: string;
  type: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
        <UserCheck size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <p className="text-xs text-white/50">{type}</p>
      </div>
      <span className="text-xs font-mono text-white/40">{time}</span>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function RecepcaoQRCode() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(TOKEN_REFRESH_INTERVAL);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentTime, setCurrentTime] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // tRPC calls
  const generateToken = trpc.attendance.generateToken.useMutation({
    onSuccess: (data) => {
      setToken(data.token);
      setCountdown(TOKEN_REFRESH_INTERVAL);
    },
    onError: () => {
      // Will retry on next interval
    },
  });

  const { data: recentLogs } = trpc.attendance.getLogs.useQuery(
    { 
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd")
    },
    {
      refetchInterval: 10_000, // Refetch every 10s
    }
  );

  // Generate token on mount
  const refreshToken = useCallback(() => {
    generateToken.mutate({});
  }, [generateToken]);

  useEffect(() => {
    refreshToken();
  }, [refreshToken]);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Online status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const lastScans = (recentLogs ?? []).slice(0, 5);
  const schoolName = user?.organizationName || "MusicPro";

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col relative w-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-[2.5rem] overflow-hidden select-none shadow-2xl border border-white/5">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-3xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Music size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {schoolName}
              </h1>
              <p className="text-xs text-white/40 font-medium">
                Sistema de Presença Digital
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Connection status */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold",
                isOnline
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              )}
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isOnline ? "Online" : "Offline"}
            </div>

            {/* Clock */}
            <div className="text-right">
              <p className="text-2xl font-bold text-white tabular-nums">
                {format(currentTime, "HH:mm:ss")}
              </p>
              <p className="text-xs text-white/40 font-medium">
                {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>
        </header>

        {/* ── Main Content ───────────────────────────────────────── */}
        <main className="flex-1 flex flex-col xl:flex-row items-center justify-center px-8 gap-12 py-8">
          {/* QR Code Section */}
          <div className="flex flex-col items-center gap-6">
            {/* Instruction */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20"
            >
              <QrCode size={16} className="text-indigo-400" />
              <span className="text-sm font-semibold text-indigo-300">
                Aponte a câmera para registrar presença
              </span>
            </motion.div>

            {/* QR Code Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="relative"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl blur-2xl scale-110" />

              {/* QR Card */}
              <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                {/* Corner accents */}
                <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-indigo-400 rounded-tl-lg" />
                <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-indigo-400 rounded-tr-lg" />
                <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-indigo-400 rounded-bl-lg" />
                <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-indigo-400 rounded-br-lg" />

                <AnimatePresence mode="wait">
                  {token ? (
                    <motion.div
                      key={token}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      transition={{ duration: 0.3 }}
                    >
                      <img
                        src={buildQrUrl(token)}
                        alt="QR Code para presença"
                        width={QR_SIZE}
                        height={QR_SIZE}
                        className="rounded-2xl"
                        style={{ imageRendering: "pixelated" }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center gap-4"
                      style={{ width: QR_SIZE, height: QR_SIZE }}
                    >
                      <RefreshCw
                        size={48}
                        className="text-white/30 animate-spin"
                      />
                      <p className="text-white/40 text-sm font-medium">
                        Gerando código...
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Security Info */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-white/30">
                <Shield size={16} />
                <span className="text-xs font-medium">
                  QR Code da Recepção - Fixo
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className="w-80 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Clock size={16} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  Atividade Recente
                </h2>
                <p className="text-xs text-white/40">
                  Últimos registros de presença
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {lastScans.length > 0 ? (
                  lastScans.map((scan: any, index: number) => (
                    <ScanItem
                      key={scan.id ?? index}
                      name={scan.userName ?? scan.studentName ?? "Aluno"}
                      time={
                        scan.scannedAt
                          ? format(new Date(scan.scannedAt), "HH:mm")
                          : "--:--"
                      }
                      type={scan.type === "professor" ? "Professor" : "Aluno"}
                      index={index}
                    />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-12 gap-3"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                      <UserCheck size={28} className="text-white/20" />
                    </div>
                    <p className="text-sm text-white/30 font-medium text-center">
                      Nenhum registro hoje ainda
                    </p>
                    <p className="text-xs text-white/20 text-center">
                      Os registros aparecerão aqui automaticamente
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Total count */}
            {(recentLogs ?? []).length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/10"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/50 font-medium">
                    Total hoje
                  </span>
                  <span className="text-lg font-bold text-white">
                    {(recentLogs ?? []).length}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </main>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="flex items-center justify-center px-8 py-4">
          <div className="flex items-center gap-2 text-white/20 text-xs">
            <Shield size={12} />
            <span>
              MusicPro — Sistema de Presença Seguro •{" "}
              {format(new Date(), "yyyy")}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
