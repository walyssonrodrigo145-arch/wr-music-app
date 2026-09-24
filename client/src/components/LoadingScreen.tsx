import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  label?: string;
}

export default function LoadingScreen({ label = "Carregando MusicPro..." }: LoadingScreenProps) {
  return (
    <div
      className="flex-1 h-full min-h-[50vh] flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px] shadow-xl overflow-hidden">
        <div className="w-full h-full bg-gradient-to-b from-blue-500 to-indigo-700 rounded-2xl flex items-center justify-center relative z-10">
          <div className="flex items-center gap-[4px] h-6">
            <div className="w-1.5 bg-white/90 rounded-full h-3" />
            <div className="w-1.5 bg-white/90 rounded-full h-6" />
            <div className="w-1.5 bg-white rounded-full h-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
            <div className="w-1.5 bg-white/90 rounded-full h-4" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Loader2 size={16} className="animate-spin text-primary" />
        <span className="text-xs font-bold uppercase tracking-widest text-primary/60">{label}</span>
      </div>
    </div>
  );
}
