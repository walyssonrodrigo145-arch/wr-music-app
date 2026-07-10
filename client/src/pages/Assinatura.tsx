import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CreditCard, CheckCircle2, ArrowRight, Loader2, Zap, ShieldAlert, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function Assinatura() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: mySub, isLoading } = trpc.platform.mySubscription.useQuery();
  const { data: pendingInvoice, isLoading: loadingInvoice } = trpc.platform.getPendingInvoice.useQuery();
  // ─── Busca planos DINÂMICOS do banco de dados ─────────────────────────────
  const { data: PLANOS = [], isLoading: loadingPlans } = trpc.platform.getPublicPlans.useQuery();
  
  const changePlanMutation = trpc.platform.changePlan.useMutation();
  const cancelMutation = trpc.platform.cancelSubscription.useMutation();

  const [selectedPlanType, setSelectedPlanType] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const trialEndsAt = mySub?.trialEndsAt ? new Date(mySub.trialEndsAt) : null;
  const isTrial = mySub?.subscriptionStatus === "trialing";
  const isCanceled = mySub?.subscriptionStatus === "canceled";

  const handleChangePlan = async (planId: string) => {
    try {
      await changePlanMutation.mutateAsync({ planId, planType: selectedPlanType });
      toast.success("Plano atualizado com sucesso! O novo valor virá na próxima fatura.");
      utils.platform.mySubscription.invalidate();
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar o plano");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync();
      toast.success("Assinatura cancelada com sucesso.");
      setShowCancelConfirm(false);
      utils.platform.mySubscription.invalidate();
      setTimeout(() => window.location.href = "/checkout", 1500);
    } catch (error: any) {
      toast.error(error.message || "Erro ao cancelar assinatura");
    }
  };

  if (isLoading || loadingPlans) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Carregando sua assinatura...</p>
      </div>
    );
  }

  const currentPlan = PLANOS.find(p => p.id === mySub?.planId) || PLANOS[0];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Gerenciar Assinatura</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Acompanhe seu plano, faturas e opções da conta.</p>
        </div>
        <button
          onClick={() => setShowRulesModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl font-bold text-sm transition-colors border border-indigo-100 dark:border-indigo-500/20 shadow-sm"
        >
          <ShieldAlert size={18} />
          Regras da Assinatura
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Plan Card */}
        <div className="md:col-span-2 relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-800 border-none rounded-[2rem] p-6 sm:p-8 shadow-xl shadow-indigo-500/20 flex flex-col justify-between text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 blur-2xl rounded-full translate-y-1/3 -translate-x-1/4"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/10 shadow-inner">
                  <Zap size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white/90">Plano Atual</h2>
                  <p className="text-white text-2xl font-black">{currentPlan.name}</p>
                </div>
              </div>
              
              <div className={`px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-full backdrop-blur-md border ${
                  isTrial ? 'bg-blue-500/20 border-blue-400/30 text-blue-100' :
                  isCanceled ? 'bg-red-500/20 border-red-400/30 text-red-100' :
                  'bg-emerald-500/20 border-emerald-400/30 text-emerald-100'
                }`}>
                  {isTrial ? "Período de Teste" : isCanceled ? "Cancelado" : "Ativo"}
              </div>
            </div>

            <div className="space-y-4">
              {isTrial && trialEndsAt && (
                <div className="bg-black/10 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className="text-white/70 font-bold text-xs uppercase tracking-widest">Fim do Teste</span>
                      <p className="text-white font-black text-lg mt-0.5">{trialEndsAt.toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className="text-white/90 font-black text-sm">
                      {Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} dias restantes
                    </span>
                  </div>
                  <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, 100 - (Math.max(0, trialEndsAt.getTime() - Date.now()) / (33 * 24 * 60 * 60 * 1000)) * 100))}%` }}
                      className="h-full bg-white rounded-full" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Card */}
        <div className="bg-card border border-border rounded-[2rem] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${pendingInvoice ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              <CreditCard size={24} />
            </div>
            <h2 className="text-lg font-black text-foreground tracking-tight">Sua Fatura</h2>
          </div>
          
          {loadingInvoice ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3 text-muted-foreground">
              <Loader2 size={24} className="animate-spin text-primary" /> 
              <span className="text-sm font-bold">Buscando faturas...</span>
            </div>
          ) : pendingInvoice ? (
            <div className="mt-2 bg-amber-50 dark:bg-amber-500/5 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/20">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Aguardando Pagamento</p>
              <p className="text-3xl font-black text-amber-700 dark:text-amber-500 mb-4 tracking-tighter">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingInvoice.value)}
              </p>
              <a 
                href={pendingInvoice.invoiceUrl} 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 h-12 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-widest rounded-xl text-[11px] transition-all shadow-lg shadow-amber-500/20"
              >
                Pagar Agora <ArrowRight size={16} />
              </a>
            </div>
          ) : (
            <div className="mt-2 flex flex-col items-center justify-center py-6 bg-emerald-50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-500/10">
              <CheckCircle2 size={40} className="text-emerald-500 mb-3" />
              <p className="text-emerald-700 dark:text-emerald-400 text-sm font-black uppercase tracking-widest">Tudo em dia!</p>
              <p className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-500/70 mt-1">Nenhuma pendência.</p>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade Section */}
      <div className="pt-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-foreground tracking-tight mb-4">Escolha seu novo nível</h2>
          <p className="text-muted-foreground text-sm font-medium mb-8 max-w-lg mx-auto">Potencialize sua escola com nossos planos e libere mais alunos, ferramentas exclusivas e automações ilimitadas.</p>
          
          <div className="inline-flex bg-muted/50 p-1.5 rounded-2xl relative">
            <motion.div 
              className="absolute top-1.5 bottom-1.5 w-[50%] bg-indigo-600 rounded-xl shadow-md"
              initial={false}
              animate={{ left: selectedPlanType === "MONTHLY" ? "6px" : "calc(50% - 6px)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
            <button 
              onClick={() => setSelectedPlanType("MONTHLY")}
              className={`relative z-10 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors ${selectedPlanType === "MONTHLY" ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              Mensal
            </button>
            <button 
              onClick={() => setSelectedPlanType("YEARLY")}
              className={`relative z-10 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors flex items-center gap-2 ${selectedPlanType === "YEARLY" ? "text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              Anual
              <span className={`text-[9px] px-2 py-0.5 rounded-full ${selectedPlanType === "YEARLY" ? "bg-white/20" : "bg-indigo-100 text-indigo-600"}`}>-16%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLANOS.map((p, index) => {
            const isActive = mySub?.planId === p.id;
            const price = selectedPlanType === "YEARLY" ? p.priceYearly : p.priceMonthly;
            const isPopular = p.isPopular;
            
            return (
              <motion.div 
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative flex flex-col bg-card border rounded-[2rem] p-8 transition-all duration-300 hover:-translate-y-1 ${
                  isActive ? 'border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500' : 
                  isPopular ? 'border-indigo-300 dark:border-indigo-700 shadow-lg' :
                  'border-border hover:border-indigo-500/50 hover:shadow-lg'
                }`}
              >
                {isPopular && !isActive && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg">Mais Popular</span>
                  </div>
                )}
                {isActive && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg border border-slate-700">Seu Plano</span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-black text-foreground mb-2">{p.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-foreground tracking-tighter">R$ {price.toFixed(2).replace('.',',')}</span>
                    <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">/{selectedPlanType === "YEARLY" ? 'ano' : 'mês'}</span>
                  </div>
                </div>
                
                <div className="flex-1 space-y-4 mb-8">
                  {p.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isPopular || isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-muted text-muted-foreground'}`}>
                        <CheckCircle2 size={12} strokeWidth={3} />
                      </div>
                      <span className="text-sm font-medium text-foreground/80 leading-tight">{f}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleChangePlan(p.id)}
                  disabled={isActive || changePlanMutation.isPending || isCanceled}
                  className={`w-full h-12 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all ${
                    isActive ? 'bg-muted text-muted-foreground cursor-not-allowed' :
                    isPopular ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20' :
                    'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20'
                  }`}
                >
                  {isActive ? 'Plano Ativo' : changePlanMutation.isPending ? 'Processando...' : 'Fazer Upgrade'}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-12 mt-12 border-t border-border">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
            <ShieldAlert size={20} />
          </div>
          <h2 className="text-xl font-black text-destructive tracking-tight">
            Área de Risco
          </h2>
        </div>
        
        {!showCancelConfirm ? (
          <div className="bg-card border border-destructive/20 rounded-[2rem] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
            <div>
              <h3 className="text-lg font-black text-foreground mb-1">Encerrar Assinatura</h3>
              <p className="text-muted-foreground text-sm font-medium max-w-xl">Ao cancelar, você perderá acesso ao sistema e todas as suas configurações, alunos e arquivos entrarão na fila de exclusão permanente.</p>
            </div>
            <button 
              onClick={() => setShowCancelConfirm(true)}
              disabled={isCanceled}
              className="shrink-0 px-8 h-12 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white font-black uppercase tracking-widest rounded-xl text-[11px] transition-all disabled:opacity-50"
            >
              {isCanceled ? 'Já Cancelado' : 'Cancelar Assinatura'}
            </button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-destructive rounded-[2rem] p-8 text-white shadow-2xl shadow-destructive/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-black/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="bg-white/20 p-4 rounded-2xl shrink-0 backdrop-blur-sm">
                <AlertTriangle size={32} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-black tracking-tight mb-2">Tem certeza absoluta?</h3>
                <p className="text-white/80 text-sm mb-6 max-w-2xl font-medium leading-relaxed">
                  Esta ação é irreversível. Sua assinatura será cancelada imediatamente no Asaas e seu acesso ao MusicPro será bloqueado. <strong className="text-white">Todos os seus alunos, aulas, faturas e arquivos serão excluídos de nossos servidores permanentemente.</strong>
                </p>
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                    className="h-12 px-8 bg-white text-destructive hover:bg-gray-100 font-black uppercase tracking-widest rounded-xl text-[11px] transition-all flex items-center gap-2 shadow-lg"
                  >
                    {cancelMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Sim, excluir tudo agora"}
                  </button>
                  <button 
                    onClick={() => setShowCancelConfirm(false)}
                    className="h-12 px-8 bg-black/20 hover:bg-black/30 text-white font-black uppercase tracking-widest rounded-xl text-[11px] transition-all backdrop-blur-sm"
                  >
                    Mudei de ideia, manter
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRulesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowRulesModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="shrink-0 p-6 sm:p-8 bg-gradient-to-br from-indigo-600 to-violet-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/3"></div>
                <div className="relative z-10 flex items-start justify-between text-white">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10">
                        <ShieldAlert size={20} />
                      </div>
                      <h2 className="text-2xl font-black tracking-tight">Regras da Assinatura</h2>
                    </div>
                    <p className="text-indigo-100 text-sm font-medium">Informações importantes sobre a gestão do seu plano no MusicPro e integração com o Asaas.</p>
                  </div>
                  <button 
                    onClick={() => setShowRulesModal(false)}
                    className="p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors backdrop-blur-sm text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-black text-lg">
                    <Calendar className="text-blue-500" size={20} />
                    <h3>Período de Teste e Prazos</h3>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 p-4 rounded-2xl text-sm text-muted-foreground leading-relaxed">
                    Você tem <strong className="text-foreground">30 dias gratuitos</strong> de teste ao se cadastrar. O Asaas, nossa operadora de pagamentos, exige <strong className="text-foreground">3 dias de antecedência</strong> para processar pagamentos via cartão/boleto. Portanto, o prazo total que aparece no seu sistema pode chegar a 33 dias na primeira assinatura.
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-black text-lg">
                    <TrendingDown className="text-amber-500" size={20} />
                    <h3>Downgrade (Redução de Plano)</h3>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 p-4 rounded-2xl text-sm text-muted-foreground leading-relaxed">
                    Para reduzir seu plano, seu número atual de alunos ativos não pode ser maior do que o limite do novo plano desejado. Caso isso aconteça, o sistema <strong className="text-foreground">bloqueará a alteração</strong>. Você deverá ir na aba <strong className="text-foreground">Alunos</strong> e excluir ou arquivar a quantidade excedente antes de realizar o downgrade.
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-black text-lg">
                    <TrendingUp className="text-emerald-500" size={20} />
                    <h3>Upgrade (Aumento de Plano)</h3>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 p-4 rounded-2xl text-sm text-muted-foreground leading-relaxed">
                    Ao aumentar seu plano, os novos limites entram em vigor <strong className="text-foreground">imediatamente</strong>. O valor só será atualizado e cobrado na <strong className="text-foreground">próxima fatura</strong> do seu ciclo atual.
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-black text-lg">
                    <CreditCard className="text-violet-500" size={20} />
                    <h3>Troca de Plano e Recusa de Cartão</h3>
                  </div>
                  <div className="bg-violet-50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/10 p-4 rounded-2xl text-sm text-muted-foreground leading-relaxed">
                    <p className="mb-2">Por questões de segurança contra fraudes no Asaas, se você alterar seu plano (valor) e a operadora do seu cartão recusar a atualização automática da fatura já gerada, nosso sistema utilizará um <strong>Mecanismo de Proteção</strong>:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Sua assinatura atual é cancelada preventivamente;</li>
                      <li>Você <strong>não perde seu dinheiro!</strong> Os dias que restavam do ciclo pago viram <strong className="text-foreground">Dias Restantes de Teste</strong>;</li>
                      <li>Você precisará assinar novamente passando o cartão no novo plano desejado para regularizar os próximos meses.</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-black text-lg">
                    <AlertTriangle className="text-destructive" size={20} />
                    <h3>Cancelamento</h3>
                  </div>
                  <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl text-sm text-muted-foreground leading-relaxed">
                    O cancelamento via sistema exibe a opção de <strong>exclusão total</strong> (apaga todos os seus dados da escola, contratos e faturas imediatamente). Se a intenção for apenas parar a cobrança sem perder os dados, solicite a pausa diretamente ao nosso suporte.
                  </div>
                </div>

              </div>
              
              {/* Modal Footer */}
              <div className="shrink-0 p-4 sm:p-6 border-t border-border bg-muted/30 flex justify-end">
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="px-6 py-2.5 bg-foreground text-background hover:bg-foreground/90 rounded-xl font-black text-sm uppercase tracking-widest transition-colors shadow-md"
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
