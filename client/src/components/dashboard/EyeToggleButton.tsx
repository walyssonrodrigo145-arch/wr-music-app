import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardPrefs } from "@/hooks/useDashboardPrefs";
import { cn } from "@/lib/utils";

/** Botão "olhinho" — mascara/desmascara valores financeiros (Dashboard + Financeiro). */
export function EyeToggleButton({ className }: { className?: string }) {
  const { hideFinancialValues, toggleHideFinancialValues, togglingHide } = useDashboardPrefs();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={hideFinancialValues ? "Mostrar valores financeiros" : "Ocultar valores financeiros"}
      title={hideFinancialValues ? "Mostrar valores" : "Ocultar valores"}
      disabled={togglingHide}
      onClick={toggleHideFinancialValues}
      className={cn("rounded-xl border border-border/60 text-muted-foreground hover:text-foreground", className)}
    >
      {hideFinancialValues ? <EyeOff size={18} /> : <Eye size={18} />}
    </Button>
  );
}
