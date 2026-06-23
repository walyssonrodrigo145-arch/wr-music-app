import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CreditCard, AlertTriangle, CheckCircle2, ArrowRight, Loader2, Calendar, Zap, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const PLANOS = [
  { id: "10alunos", name: "10 Alunos", price: 10.00 },
  { id: "20alunos", name: "20 Alunos", price: 15.00 },
  { id: "30alunos", name: "30 Alunos", price: 20.00 },
  { id: "basico", name: "Básico", price: 29.99 },
  { id: "profissional", name: "Profissional", price: 59.90 },
  { id: "premium", name: "Premium (Ilimitado)", price: 99.90 },
];

export default function Assinatura() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: mySub, isLoading } = trpc.organizations.mySubscription.useQuery();
  const { data: pendingInvoice, isLoading: loadingInvoice } = trpc.organizations.getPendingInvoice.useQuery();
  
  const changePlanMutation = trpc.organizations.changePlan.useMutation();
  const cancelMutation = trpc.organizations.cancelSubscription.useMutation();

  const [selectedPlanType, setSelectedPlanType] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const trialEndsAt = mySub?.trialEndsAt ? new Date(mySub.trialEndsAt) : null;
  const isTrial = mySub?.subscriptionStatus === "trialing";
  const isCanceled = mySub?.subscriptionStatus === "canceled";

  const handleChangePlan = async (planId: string) => {
    try {
      await changePlanMutation.mutateAsync({ planId, planType: selectedPlanType });
      toast.success("Plano atualizado com sucesso! O novo valor virá na próxima fatura.");
      utils.organizations.mySubscription.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar o plano");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      toast.success("Assinatura cancelada com sucesso.");
      setShowCancelConfirm(false);
      utils.organizations.mySubscription.invalidate();
      // Forçar refresh para derrubar o acesso
      setTimeout(() => window.location.href = "/checkout", 1500);
    } catch (error: any) {
      toast.error(error.message || "Erro ao cancelar assinatura");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Carregando sua assinatura...</p>
      </div>
    );
  }

  const currentPlan = PLANOS.find(p => p.id === mySub?.planId) || PLANOS[4];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">Gerenciar Assinatura</h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">Acompanhe seu plano, faturas e opções da conta.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan Card */}
        <div className="md:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Zap size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-foreground">Plano Atual</h2>
                <p className="text-muted-foreground text-sm font-medium">{currentPlan.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-border">
                <span className="text-muted-foreground font-medium text-sm">Status</span>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  isTrial ? 'bg-blue-100 text-blue-700' :
                  isCanceled ? 'bg-red-100 text-red-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {isTrial ? "Período de Teste" : isCanceled ? "Cancelado" : "Ativo"}
                </span>
              </div>
              
              {isTrial && trialEndsAt && (
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-muted-foreground font-medium text-sm">Fim do Teste</span>
                  <span className="text-foreground font-bold text-sm">
                    {trialEndsAt.toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Card */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <CreditCard size={20} />
            </div>
            <h2 className="text-lg font-black text-foreground">Fatura</h2>
          </div>
          
          {loadingInvoice ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm mt-4">
              <Loader2 size={16} className="animate-spin" /> Buscando faturas...
            </div>
          ) : pendingInvoice ? (
            <div className="mt-4">
              <p className="text-sm font-bold text-amber-600 mb-1">Aguardando Pagamento</p>
              <p className="text-2xl font-black text-foreground mb-4">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingInvoice.value)}
              </p>
              <a 
                href={pendingInvoice.invoiceUrl} 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors"
              >
                Pagar Agora <ArrowRight size={16} />
              </a>
            </div>
          ) : (
            <div className="mt-4 text-center py-6">
              <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm font-medium">Tudo certo por aqui!</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Nenhuma fatura em aberto no momento.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade Section */}
      <div className="pt-6">
        <h2 className="text-xl font-black text-foreground mb-4">Mudar de Plano</h2>
        
        <div className="flex gap-2 mb-6 bg-muted/50 p-1.5 rounded-2xl w-fit">
          <button 
            onClick={() => setSelectedPlanType("MONTHLY")}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${selectedPlanType === "MONTHLY" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Mensal
          </button>
          <button 
            onClick={() => setSelectedPlanType("YEARLY")}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${selectedPlanType === "YEARLY" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground"}`}
          >
            Anual <span className="text-[10px] px-2 py-0.5 bg-white/20 rounded-full">-16% OFF</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLANOS.map(p => {
            const isActive = mySub?.planId === p.id;
            const price = selectedPlanType === "YEARLY" ? p.price * 10 : p.price;
            
            return (
              <div key={p.id} className={`border rounded-3xl p-5 transition-all ${isActive ? 'border-primary shadow-md bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-foreground">{p.name}</h3>
                  {isActive && <span className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded-full uppercase">Seu Plano</span>}
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-black text-foreground">R$ {price.toFixed(2).replace('.',',')}</span>
                  <span className="text-muted-foreground text-xs font-medium">/{selectedPlanType === "YEARLY" ? 'ano' : 'mês'}</span>
                </div>
                <button
                  onClick={() => handleChangePlan(p.id)}
                  disabled={isActive || changePlanMutation.isPending || isCanceled}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
                    isActive ? 'bg-muted text-muted-foreground cursor-not-allowed' :
                    'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                  }`}
                >
                  {isActive ? 'Ativo' : changePlanMutation.isPending ? 'Aguarde...' : 'Escolher este'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-8 mt-8 border-t border-border">
        <h2 className="text-xl font-black text-destructive flex items-center gap-2 mb-4">
          <ShieldAlert size={20} />
          Zona de Perigo
        </h2>
        
        {!showCancelConfirm ? (
          <div className="bg-destructive/5 border border-destructive/20 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-foreground mb-1">Cancelar Assinatura</h3>
              <p className="text-muted-foreground text-sm">Ao cancelar, você perderá acesso ao sistema imediatamente e seus dados poderão ser excluídos.</p>
            </div>
            <button 
              onClick={() => setShowCancelConfirm(true)}
              disabled={isCanceled}
              className="shrink-0 px-6 py-2.5 bg-destructive text-white font-bold rounded-xl text-sm hover:bg-red-600 transition-colors shadow-lg shadow-destructive/20 disabled:opacity-50"
            >
              {isCanceled ? 'Já Cancelado' : 'Cancelar Assinatura'}
            </button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-destructive border border-destructive rounded-3xl p-6 text-white shadow-xl shadow-destructive/20">
            <div className="flex items-start gap-4">
              <div className="bg-white/20 p-3 rounded-full shrink-0">
                <AlertTriangle size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black mb-2">Você tem certeza absoluta?</h3>
                <p className="text-white/80 text-sm mb-6 max-w-2xl">
                  Esta ação é irreversível. Sua assinatura será cancelada imediatamente no Asaas e seu acesso ao MusicPro será bloqueado. <strong>Todos os seus alunos, aulas, faturas e arquivos serão excluídos de nossos servidores permanentemente.</strong>
                </p>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                    className="px-6 py-2.5 bg-white text-destructive hover:bg-gray-100 font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
                  >
                    {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Sim, quero cancelar e excluir tudo"}
                  </button>
                  <button 
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-6 py-2.5 bg-transparent border border-white/30 hover:bg-white/10 font-bold rounded-xl text-sm transition-colors"
                  >
                    Não, mudar de ideia
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
