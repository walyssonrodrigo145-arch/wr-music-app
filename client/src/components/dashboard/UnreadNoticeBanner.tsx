// ─── Banner de avisos não lidos na tela inicial (Dashboard) ──────────────────
// Mostra até 3 notificações não lidas com ação; o usuário pode dispensar na
// sessão ou resolver (marca como lida e navega). Mesma fonte do sino (AppHeader).

import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Bell, X, ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function UnreadNoticeBanner() {
  const { data: notifications = [] } = trpc.system.getNotifications.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [, navigate] = useLocation();
  const markRead = trpc.system.markNotificationRead.useMutation();

  const items = (notifications as any[])
    .filter((n) => !n.read && !dismissed.has(n.id))
    .slice(0, 3);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {items.map((n) => {
        const isAlert = n.type === "warning" || n.type === "error";
        return (
          <div
            key={n.id}
            className={cn(
              "relative flex items-start gap-3 rounded-2xl border p-4 pr-10",
              isAlert
                ? "border-amber-500/30 bg-amber-500/10"
                : "border-primary/20 bg-primary/5"
            )}
          >
            <div className="w-9 h-9 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">
              {isAlert ? (
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
              ) : (
                <Bell size={16} className="text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider">{n.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
              {n.actionUrl && (
                <button
                  onClick={() => {
                    markRead.mutate({ id: n.id });
                    navigate(n.actionUrl);
                  }}
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                >
                  Resolver agora <ArrowRight size={12} />
                </button>
              )}
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(n.id))}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              title="Dispensar aviso"
              aria-label="Dispensar aviso"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
