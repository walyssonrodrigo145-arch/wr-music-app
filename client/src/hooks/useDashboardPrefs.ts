// Preferências do dashboard (por usuário): cards visíveis + botão "olhinho".
// Fonte única: dashboard.getVisibleWidgets (aplica a trava do admin no servidor — RN-016).
import { trpc } from "@/lib/trpc";
import { formatBRLMasked } from "@/lib/money";

export function useDashboardPrefs() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.dashboard.getVisibleWidgets.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const setHide = trpc.settings.setHideFinancialValues.useMutation({
    onSuccess: () => {
      utils.dashboard.getVisibleWidgets.invalidate();
    },
  });

  const hideFinancialValues = data?.hideFinancialValues ?? false;
  const visible = data?.visible ?? null;

  return {
    isLoading,
    isAdmin: data?.isAdmin ?? false,
    visible,
    widgets: data?.widgets ?? [],
    hideFinancialValues,
    togglingHide: setHide.isPending,
    toggleHideFinancialValues: () => setHide.mutate({ hidden: !hideFinancialValues }),
    /** true enquanto as prefs carregam (para não piscar conteúdo indevido). */
    isVisible: (id: string) => (visible ? visible.includes(id) : true),
    /** Formata moeda respeitando o olhinho. */
    maskBRL: (value: number | string | null | undefined) => formatBRLMasked(value, hideFinancialValues),
  };
}
