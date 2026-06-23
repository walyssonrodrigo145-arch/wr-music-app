import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Edit, Check, X, Tag, ListFilter, Users, Building, ShieldAlert } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

export default function SuperAdmin() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"dashboard" | "plans" | "coupons">("dashboard");

  const { data: stats, isLoading: loadingStats } = trpc.superAdmin.getDashboardStats.useQuery(undefined, {
    enabled: activeTab === "dashboard"
  });

  const { data: plans, isLoading: loadingPlans } = trpc.superAdmin.getPlans.useQuery(undefined, {
    enabled: activeTab === "plans"
  });

  const { data: coupons, isLoading: loadingCoupons } = trpc.superAdmin.getCoupons.useQuery(undefined, {
    enabled: activeTab === "coupons"
  });

  const savePlan = trpc.superAdmin.savePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano salvo com sucesso!");
      utils.superAdmin.getPlans.invalidate();
    }
  });

  const saveCoupon = trpc.superAdmin.saveCoupon.useMutation({
    onSuccess: () => {
      toast.success("Cupom salvo com sucesso!");
      utils.superAdmin.getCoupons.invalidate();
    }
  });

  if (user?.role !== 'admin' && user?.email !== 'walyssonrodrigo145@gmail.com') {
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20">
        <ShieldAlert size={48} className="text-destructive mb-4" />
        <h1 className="text-2xl font-black">Acesso Negado</h1>
        <p className="text-muted-foreground">Esta área é restrita aos desenvolvedores do sistema.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">Painel Super Admin</h1>
        <p className="text-muted-foreground mt-1 text-sm font-medium">Controle total sobre Planos, Cupons e Visão Geral do Sistema.</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-4">
        <button 
          onClick={() => setActiveTab("dashboard")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "dashboard" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <ListFilter size={16} /> Visão Geral
        </button>
        <button 
          onClick={() => setActiveTab("plans")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "plans" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Tag size={16} /> Planos
        </button>
        <button 
          onClick={() => setActiveTab("coupons")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === "coupons" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          <Tag size={16} /> Cupons de Desconto
        </button>
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {loadingStats ? <Loader2 className="animate-spin text-primary mx-auto my-10" /> : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center">
                  <Building size={32} className="text-primary mb-2" />
                  <span className="text-4xl font-black">{stats?.totalOrganizations || 0}</span>
                  <span className="text-sm font-medium text-muted-foreground">Escolas Cadastradas</span>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center">
                  <Users size={32} className="text-primary mb-2" />
                  <span className="text-4xl font-black">{stats?.totalProfessors || 0}</span>
                  <span className="text-sm font-medium text-muted-foreground">Professores</span>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center">
                  <Users size={32} className="text-green-500 mb-2" />
                  <span className="text-4xl font-black">{stats?.totalStudents || 0}</span>
                  <span className="text-sm font-medium text-muted-foreground">Alunos Ativos</span>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-lg font-black mb-4">Últimas Escolas Criadas</h2>
                <div className="space-y-3">
                  {stats?.organizations.map((org: any) => (
                    <div key={org.id} className="flex justify-between items-center p-3 border border-border/50 rounded-xl bg-muted/20">
                      <span className="font-bold">{org.name}</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">{org.subscriptionStatus}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "plans" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black">Planos Ativos</h2>
            <button className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/90">
              <Plus size={16} /> Criar Novo Plano
            </button>
          </div>
          
          {loadingPlans ? <Loader2 className="animate-spin text-primary mx-auto my-10" /> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans?.map((p: any) => (
                <div key={p.id} className={`bg-card border rounded-2xl p-5 ${p.isActive ? 'border-primary/30 shadow-sm' : 'border-border/50 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold">{p.name}</h3>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.id}</span>
                  </div>
                  <p className="text-2xl font-black">R$ {Number(p.priceMonthly).toFixed(2)}<span className="text-xs text-muted-foreground font-medium">/mês</span></p>
                  <p className="text-sm text-muted-foreground mt-1">Limite: {p.maxStudents} alunos</p>
                  <div className="mt-4 pt-4 border-t border-border flex justify-between">
                    <span className="text-xs flex items-center gap-1 font-medium">
                      {p.showOnLanding ? <Check size={14} className="text-green-500"/> : <X size={14} className="text-red-500"/>} Landing Page
                    </span>
                    <button className="text-primary hover:underline text-xs font-bold">Editar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "coupons" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black">Cupons Ativos</h2>
            <button className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/90">
              <Plus size={16} /> Criar Novo Cupom
            </button>
          </div>
          
          {loadingCoupons ? <Loader2 className="animate-spin text-primary mx-auto my-10" /> : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-bold">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Desconto</th>
                    <th className="px-4 py-3">Duração</th>
                    <th className="px-4 py-3">Usos</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coupons?.map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-black text-primary">{c.code}</td>
                      <td className="px-4 py-3 font-medium">
                        {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `R$ ${c.discountValue}`}
                      </td>
                      <td className="px-4 py-3">
                        {c.durationMonths ? `${c.durationMonths} meses` : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">Vitalício</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-muted-foreground">
                        {c.currentUses} / {c.maxUses || '∞'}
                      </td>
                      <td className="px-4 py-3">
                        {c.isActive ? <span className="text-green-500 font-bold flex items-center gap-1"><Check size={14}/> Ativo</span> : <span className="text-red-500 font-bold flex items-center gap-1"><X size={14}/> Inativo</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-muted-foreground hover:text-primary transition-colors p-1"><Edit size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {coupons?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum cupom cadastrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
