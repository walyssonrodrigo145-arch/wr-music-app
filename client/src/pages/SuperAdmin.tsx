import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  Loader2, Plus, Edit, Check, X, Tag, ListFilter, Users, Building,
  ShieldAlert, Save, Trash2, AlertTriangle, RefreshCw, BarChart2
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

// ─── REGRA DE ACESSO ──────────────────────────────────────────────────────────
// SOMENTE Super Admins autorizados podem acessar este painel.
const SUPER_ADMIN_EMAILS = ['walyssonrodrigo145@gmail.com', 'ddwvitor@gmail.com'];

export default function SuperAdmin() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // ─── Proteção de rota: apenas os emails de Super Admin ─────────────────────────
  if (!loading && (!user || !user.email || !SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()))) {
    if (!loading && !user) { setLocation('/login'); return null; }
    return (
      <div className="flex flex-col items-center justify-center h-full pt-20 gap-4">
        <ShieldAlert size={48} className="text-destructive" />
        <h1 className="text-2xl font-black">Acesso Negado</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          Esta área é restrita exclusivamente ao desenvolvedor do sistema.<br />
          Sua conta não possui esta permissão.
        </p>
        <Button variant="outline" onClick={() => setLocation('/dashboard')}>Voltar ao painel</Button>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }

  return <SuperAdminPanel />;
}

// ─── Painel principal (renderizado apenas para o Super Admin autenticado) ─────
function SuperAdminPanel() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"dashboard" | "escolas" | "plans" | "coupons">("dashboard");

  // ── Estado dos modais ──────────────────────────────────────────────────────
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  // Redefinir Senha
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState("");

  // FIX: estados controlados para os Switches dos planos
  const [planIsActive, setPlanIsActive] = useState(true);
  const [planShowOnLanding, setPlanShowOnLanding] = useState(true);
  const [planIsPopular, setPlanIsPopular] = useState(false);
  const [planAllowExtraStudents, setPlanAllowExtraStudents] = useState(true);

  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);

  // FIX: estado controlado para o Switch do cupom
  const [couponIsActive, setCouponIsActive] = useState(true);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: stats, isLoading: loadingStats, isError: errorStats, error: errorStatsData, refetch: refetchStats } =
    trpc.superAdmin.getDashboardStats.useQuery(undefined, { enabled: activeTab === "dashboard" });

  const { data: plans, isLoading: loadingPlans, isError: errorPlans, error: errorPlansData, refetch: refetchPlans } =
    trpc.superAdmin.getPlans.useQuery(undefined, { enabled: activeTab === "plans" });

  const { data: coupons, isLoading: loadingCoupons, isError: errorCoupons, error: errorCouponsData, refetch: refetchCoupons } =
    trpc.superAdmin.getCoupons.useQuery(undefined, { enabled: activeTab === "coupons" });

  const { data: orgs, isLoading: loadingOrgs, isError: errorOrgs, error: errorOrgsData, refetch: refetchOrgs } =
    trpc.superAdmin.getOrganizations.useQuery(undefined, { enabled: activeTab === "escolas" });

  // ── Mutations ──────────────────────────────────────────────────────────────
  // FIX: todas as mutations agora têm onError com toast
  const deleteSchool = trpc.superAdmin.deleteOrganization.useMutation({
    onSuccess: () => {
      toast.success("Escola excluída permanentemente!");
      utils.superAdmin.getOrganizations.invalidate();
      utils.superAdmin.getDashboardStats.invalidate();
      setIsDeleteConfirmOpen(false);
      setIsSchoolModalOpen(false);
    },
    onError: (err) => toast.error(`Erro ao excluir: ${err.message}`),
  });

  const savePlan = trpc.superAdmin.savePlan.useMutation({
    onSuccess: () => {
      toast.success("Plano salvo com sucesso!");
      utils.superAdmin.getPlans.invalidate();
      setIsPlanModalOpen(false);
    },
    onError: (err) => toast.error(`Erro ao salvar plano: ${err.message}`),
  });

  const saveCoupon = trpc.superAdmin.saveCoupon.useMutation({
    onSuccess: () => {
      toast.success("Cupom salvo com sucesso!");
      utils.superAdmin.getCoupons.invalidate();
      setIsCouponModalOpen(false);
    },
    onError: (err) => toast.error(`Erro ao salvar cupom: ${err.message}`),
  });

  const updateOrgSub = trpc.superAdmin.updateOrgSubscription.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Status da escola atualizado!");
      utils.superAdmin.getOrganizations.invalidate();
      utils.superAdmin.getDashboardStats.invalidate();
      // FIX: Atualiza estado local para refletir imediatamente no modal
      setSelectedSchool((prev: any) => prev ? { ...prev, subscriptionStatus: variables.subscriptionStatus } : prev);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const resetPasswordMutation = trpc.superAdmin.resetUserPassword.useMutation({
    onSuccess: () => {
      toast.success("Nova senha definida com sucesso!");
      setIsResetPasswordOpen(false);
      setNewPasswordInput("");
    },
    onError: (err) => toast.error(`Erro ao redefinir senha: ${err.message}`),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getFeaturesString = (plan: any) => {
    if (!plan?.features) return "";
    if (Array.isArray(plan.features)) return plan.features.join("; ");
    try {
      const parsed = JSON.parse(plan.features);
      if (Array.isArray(parsed)) return parsed.join("; ");
    } catch (e) {}
    return plan.features;
  };

  // FIX: handleSavePlan usa estados React controlados para os Switches
  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    savePlan.mutate({
      id: ((formData.get("id") as string) || "plano-" + Date.now()).toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
      name: formData.get("name") as string,
      priceMonthly: Number(formData.get("priceMonthly")),
      priceYearly: Number(formData.get("priceYearly")),
      maxStudents: Number(formData.get("maxStudents")),
      features: (formData.get("features") as string).split(";").map(f => f.trim()).filter(Boolean),
      isActive: planIsActive,
      showOnLanding: planShowOnLanding,
      isPopular: planIsPopular,
      order: Number(formData.get("order")) || 0,
      allowExtraStudents: planAllowExtraStudents,
      extraStudentPrice: Number(formData.get("extraStudentPrice")) || 1.49,
    });
  };

  // FIX: handleSaveCoupon usa estado React controlado para o Switch
  const handleSaveCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    saveCoupon.mutate({
      code: formData.get("code") as string,
      discountType: formData.get("discountType") as "PERCENTAGE" | "FIXED",
      discountValue: Number(formData.get("discountValue")),
      durationMonths: formData.get("durationMonths") && Number(formData.get("durationMonths")) > 0 ? Number(formData.get("durationMonths")) : null,
      maxUses: formData.get("maxUses") && Number(formData.get("maxUses")) > 0 ? Number(formData.get("maxUses")) : null,
      isActive: couponIsActive, // FIX: vem do estado React
    });
  };

  // ── Componente reutilizável de erro ────────────────────────────────────────
  const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertTriangle size={36} className="text-destructive" />
      <p className="text-muted-foreground font-medium">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="flex items-center gap-2">
        <RefreshCw size={14} /> Tentar novamente
      </Button>
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="py-12 text-center text-muted-foreground font-medium">{message}</div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Painel Super Admin</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Controle total sobre Planos, Cupons e Visão Geral do Sistema.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.open("/analytics", "_blank")}
          className="flex items-center gap-2 font-semibold text-sm bg-violet-600/10 text-violet-600 border-violet-500/30 hover:bg-violet-600 hover:text-white transition-all"
        >
          <BarChart2 size={16} />
          MusicPro Analytics ↗
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-4 flex-wrap">
        {[
          { id: "dashboard", label: "Visão Geral", icon: <ListFilter size={16} /> },
          { id: "escolas", label: "Escolas", icon: <Building size={16} /> },
          { id: "plans", label: "Planos", icon: <Tag size={16} /> },
          { id: "coupons", label: "Cupons", icon: <Tag size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Dashboard ─────────────────────────────────────────────── */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {loadingStats && <Loader2 className="animate-spin text-primary mx-auto my-10" />}
          {errorStats && <ErrorState message={`Erro ao carregar estatísticas: ${errorStatsData?.message || "Desconhecido"}`} onRetry={refetchStats} />}
          {stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center">
                  <Building size={32} className="text-primary mb-2" />
                  <span className="text-4xl font-black">{stats.totalOrganizations}</span>
                  <span className="text-sm font-medium text-muted-foreground">Escolas Cadastradas</span>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center">
                  <Users size={32} className="text-primary mb-2" />
                  <span className="text-4xl font-black">{stats.totalProfessors}</span>
                  <span className="text-sm font-medium text-muted-foreground">Professores</span>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-center items-center">
                  <Users size={32} className="text-green-500 mb-2" />
                  <span className="text-4xl font-black">{stats.totalStudents}</span>
                  <span className="text-sm font-medium text-muted-foreground">Alunos Ativos</span>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-black">Últimas Escolas Criadas</h2>
                  <button onClick={() => setActiveTab("escolas")} className="text-sm text-primary font-bold hover:underline">Ver todas</button>
                </div>
                <div className="space-y-3">
                  {stats.organizations.map((org: any) => (
                    <div key={org.id} className="flex justify-between items-center p-3 border border-border/50 rounded-xl bg-muted/20">
                      <span className="font-bold">{org.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        org.subscriptionStatus === 'active' ? 'bg-green-500/10 text-green-600' :
                        org.subscriptionStatus === 'trial' ? 'bg-blue-500/10 text-blue-600' :
                        org.subscriptionStatus === 'pending' ? 'bg-yellow-500/10 text-yellow-600' :
                        'bg-red-500/10 text-red-600'
                      }`}>{org.subscriptionStatus === 'pending' ? 'aguardando' : org.subscriptionStatus}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: Escolas ───────────────────────────────────────────────── */}
      {activeTab === "escolas" && (
        <div className="space-y-6">
          <h2 className="text-xl font-black">Gestão de Escolas</h2>

          {loadingOrgs && <Loader2 className="animate-spin text-primary mx-auto my-10" />}
          {errorOrgs && <ErrorState message={`Erro ao carregar escolas: ${errorOrgsData?.message || "Desconhecido"}`} onRetry={refetchOrgs} />}
          {orgs && orgs.length === 0 && <EmptyState message="Nenhuma escola cadastrada ainda." />}

          {orgs && orgs.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-bold">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Nome da Escola</th>
                    <th className="px-4 py-3">Professores</th>
                    <th className="px-4 py-3">Alunos</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orgs.map((org: any) => (
                    <tr key={org.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-muted-foreground">{org.id}</td>
                      <td className="px-4 py-3 font-bold">{org.name}</td>
                      <td className="px-4 py-3">{org.totalUsers}</td>
                      <td className="px-4 py-3">{org.totalStudents}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                          org.subscriptionStatus === 'active' ? 'bg-green-500/10 text-green-600' :
                          org.subscriptionStatus === 'trial' ? 'bg-blue-500/10 text-blue-600' :
                          org.subscriptionStatus === 'pending' ? 'bg-yellow-500/10 text-yellow-600' :
                          'bg-red-500/10 text-red-600'
                        }`}>{org.subscriptionStatus === 'pending' ? 'aguardando' : org.subscriptionStatus}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setSelectedSchool(org); setIsSchoolModalOpen(true); }}
                          className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors"
                        >
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal de Detalhes da Escola */}
          <Dialog open={isSchoolModalOpen} onOpenChange={setIsSchoolModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Detalhes da Escola</DialogTitle>
              </DialogHeader>
              {selectedSchool && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground font-medium">Nome</p>
                      <p className="font-bold text-lg">{selectedSchool.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground font-medium">Criada em</p>
                      <p className="font-bold">{new Date(selectedSchool.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="col-span-2 bg-muted/50 p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-muted-foreground font-medium text-xs mb-1">Dono / Administrador Principal</p>
                        <p className="font-bold">{selectedSchool.owner?.name || selectedSchool.name}</p>
                        <p className="text-muted-foreground text-sm">{selectedSchool.owner?.email || "Email não informado"}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 border-l border-border/60 pl-4">
                        {selectedSchool.lastSignedIn && (
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground/70">Último Acesso</p>
                            <p className="text-xs font-bold text-emerald-500">
                              {new Date(selectedSchool.lastSignedIn).toLocaleDateString('pt-BR')} às {new Date(selectedSchool.lastSignedIn).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        )}
                        {selectedSchool.owner?.id && (
                          <button
                            onClick={() => { setNewPasswordInput(""); setIsResetPasswordOpen(true); }}
                            className="text-[11px] font-bold text-indigo-500 hover:text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            🔑 Definir Nova Senha
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-3xl font-black text-primary">{selectedSchool.totalUsers}</p>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Professores</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <p className="text-3xl font-black text-primary">{selectedSchool.totalStudents}</p>
                      <p className="text-xs font-medium text-muted-foreground uppercase">Alunos</p>
                    </div>
                  </div>

                  {/* Ação: Alterar Status */}
                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-bold text-muted-foreground mb-2">ALTERAR STATUS DA ASSINATURA</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['active', 'trialing', 'pending', 'inactive', 'suspended'] as const).map(s => (
                        <button
                          key={s}
                          disabled={updateOrgSub.isPending || selectedSchool.subscriptionStatus === s}
                          onClick={() => updateOrgSub.mutate({ orgId: selectedSchool.id, subscriptionStatus: s })}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors
                            ${selectedSchool.subscriptionStatus === s
                              ? 'bg-primary text-white border-primary cursor-default'
                              : 'bg-muted hover:bg-muted/60 text-foreground border-border'}`}
                        >
                          {s === 'active' ? '✅ Ativo' : s === 'trialing' ? '🕒 Trial' : s === 'pending' ? '⏳ Pendente' : s === 'inactive' ? '❌ Inativo' : '🚫 Suspenso'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Zona de Perigo: Excluir */}
                  <div className="border-t border-red-200 pt-4">
                    <p className="text-xs text-red-500 font-bold text-center mb-3">ZONA DE PERIGO — Ação irreversível</p>
                    <button 
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Excluir Escola e Todos os Dados
                    </button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Modal de Alteração de Senha */}
          <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Definir Nova Senha de Acesso</DialogTitle>
                <DialogDescription>
                  Defina uma nova senha temporária para o usuário <strong>{selectedSchool?.owner?.name || selectedSchool?.name}</strong> ({selectedSchool?.owner?.email}).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Nova Senha</Label>
                  <Input 
                    type="text"
                    placeholder="Mínimo 6 caracteres"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsResetPasswordOpen(false)}>Cancelar</Button>
                <Button
                  disabled={resetPasswordMutation.isPending || newPasswordInput.length < 6}
                  onClick={() => {
                    if (selectedSchool?.owner?.id) {
                      resetPasswordMutation.mutate({
                        userId: selectedSchool.owner.id,
                        newPassword: newPasswordInput,
                      });
                    }
                  }}
                >
                  {resetPasswordMutation.isPending && <Loader2 className="animate-spin mr-2" size={16} />}
                  Salvar Nova Senha
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-500">
                  <AlertTriangle size={20} /> Confirmar Exclusão
                </DialogTitle>
                <DialogDescription className="pt-2">
                  Você está prestes a excluir permanentemente a escola <strong>{selectedSchool?.name}</strong> e{" "}
                  <strong>todos os {selectedSchool?.totalStudents} alunos</strong> e{" "}
                  <strong>{selectedSchool?.totalUsers} professores</strong> vinculados.{" "}
                  Esta ação <strong>não pode ser desfeita</strong>.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>Cancelar</Button>
                <Button
                  variant="destructive"
                  disabled={deleteSchool.isPending || !selectedSchool}
                  onClick={() => selectedSchool && deleteSchool.mutate({ id: selectedSchool.id })}
                >
                  {deleteSchool.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Trash2 size={16} className="mr-2" />}
                  Sim, excluir permanentemente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── TAB: Planos ────────────────────────────────────────────────── */}
      {activeTab === "plans" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black">Planos Ativos</h2>
            <Dialog open={isPlanModalOpen} onOpenChange={(open) => {
              setIsPlanModalOpen(open);
              if (!open) setEditingPlan(null);
            }}>
              <DialogTrigger asChild>
                <button
                  onClick={() => {
                    setEditingPlan(null);
                    // FIX: resetar estados controlados para novo plano
                    setPlanIsActive(true);
                    setPlanShowOnLanding(true);
                    setPlanIsPopular(false);
                    setPlanAllowExtraStudents(true);
                  }}
                  className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/90"
                >
                  <Plus size={16} /> Criar Novo Plano
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingPlan ? "Editar Plano" : "Criar Novo Plano"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSavePlan} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ID do Plano (ex: plano_basico)</Label>
                      <Input name="id" defaultValue={editingPlan?.id} required readOnly={!!editingPlan}
                        pattern="[a-z0-9_-]+" title="Apenas letras minúsculas, números, _ ou -" />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do Plano</Label>
                      <Input name="name" defaultValue={editingPlan?.name} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço Mensal (R$)</Label>
                      <Input name="priceMonthly" type="number" step="0.01" min="0" defaultValue={editingPlan?.priceMonthly} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço Anual (R$)</Label>
                      <Input name="priceYearly" type="number" step="0.01" min="0" defaultValue={editingPlan?.priceYearly} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Limite de Alunos</Label>
                      <Input name="maxStudents" type="number" min="1" defaultValue={editingPlan?.maxStudents} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Ordem de Exibição</Label>
                      <Input name="order" type="number" defaultValue={editingPlan?.order ?? 0} required />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Valor por Aluno Excedente (R$/mês)</Label>
                      <Input name="extraStudentPrice" type="number" step="0.01" min="0" defaultValue={editingPlan?.extraStudentPrice ?? 1.49} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Funcionalidades (separe por ; ponto e vírgula)</Label>
                    <Input name="features" defaultValue={getFeaturesString(editingPlan)} required
                      placeholder="App Alunos; Pagamento Asaas; IA Assistente" />
                  </div>

                  {/* FIX: Switches controlados por estado React — FormData não captura Switch */}
                  <div className="flex flex-col gap-3 p-3 bg-muted/40 rounded-xl">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sw-active" className="cursor-pointer">Plano Ativo</Label>
                      <Switch id="sw-active" checked={planIsActive} onCheckedChange={setPlanIsActive} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sw-landing" className="cursor-pointer">Mostrar na Landing Page</Label>
                      <Switch id="sw-landing" checked={planShowOnLanding} onCheckedChange={setPlanShowOnLanding} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sw-popular" className="cursor-pointer">Destaque "Mais Escolhido"</Label>
                      <Switch id="sw-popular" checked={planIsPopular} onCheckedChange={setPlanIsPopular} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sw-extra" className="cursor-pointer">Permitir Alunos Excedentes (+ R$ 1,49/aluno)</Label>
                      <Switch id="sw-extra" checked={planAllowExtraStudents} onCheckedChange={setPlanAllowExtraStudents} />
                    </div>
                  </div>

                  <button type="submit" disabled={savePlan.isPending}
                    className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                    {savePlan.isPending ? <Loader2 className="animate-spin" /> : <Save size={18} />} Salvar Plano
                  </button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingPlans && <Loader2 className="animate-spin text-primary mx-auto my-10" />}
          {errorPlans && <ErrorState message="Erro ao carregar planos." onRetry={refetchPlans} />}
          {plans && plans.length === 0 && <EmptyState message="Nenhum plano cadastrado. Crie o primeiro plano!" />}

          {plans && plans.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p: any) => (
                <div key={p.id} className={`bg-card border rounded-2xl p-5 ${p.isActive ? 'border-primary/30 shadow-sm' : 'border-border/50 opacity-60'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold">{p.name}</h3>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{p.id}</span>
                  </div>
                  <p className="text-2xl font-black">R$ {Number(p.priceMonthly).toFixed(2)}<span className="text-xs text-muted-foreground font-medium">/mês</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Anual: R$ {Number(p.priceYearly).toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground mt-1">Limite: {p.maxStudents} alunos</p>
                  <p className="text-xs text-primary font-semibold mt-1">
                    Excedente: {p.allowExtraStudents !== false ? `+ R$ ${Number(p.extraStudentPrice ?? 1.49).toFixed(2)}/aluno` : "Não permitido"}
                  </p>
                  <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                    <span className="text-xs flex flex-col gap-1 font-medium">
                      <div className="flex items-center gap-1">{p.isActive ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-red-500" />} Ativo</div>
                      <div className="flex items-center gap-1">{p.showOnLanding ? <Check size={14} className="text-green-500" /> : <X size={14} className="text-red-500" />} Landing</div>
                      {p.isPopular && <div className="flex items-center gap-1 text-primary"><Check size={14} /> Popular</div>}
                    </span>
                    <button
                      onClick={() => {
                        setEditingPlan(p);
                        // FIX: inicializar estados controlados com valores do plano sendo editado
                        setPlanIsActive(p.isActive);
                        setPlanShowOnLanding(p.showOnLanding);
                        setPlanIsPopular(p.isPopular);
                        setPlanAllowExtraStudents(p.allowExtraStudents !== false);
                        setIsPlanModalOpen(true);
                      }}
                      className="text-primary hover:underline text-xs font-bold flex items-center gap-1"
                    >
                      <Edit size={12} /> Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Cupons ────────────────────────────────────────────────── */}
      {activeTab === "coupons" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black">Cupons de Desconto</h2>
            <Dialog open={isCouponModalOpen} onOpenChange={(open) => {
              setIsCouponModalOpen(open);
              if (!open) setEditingCoupon(null);
            }}>
              <DialogTrigger asChild>
                <button
                  onClick={() => { setEditingCoupon(null); setCouponIsActive(true); }}
                  className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-primary/90"
                >
                  <Plus size={16} /> Criar Novo Cupom
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingCoupon ? "Editar Cupom" : "Criar Novo Cupom"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveCoupon} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Código do Cupom (ex: BLACKFRIDAY)</Label>
                      <Input name="code" defaultValue={editingCoupon?.code} required readOnly={!!editingCoupon}
                        style={{ textTransform: 'uppercase' }}
                        onChange={e => e.target.value = e.target.value.toUpperCase()} />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Desconto</Label>
                      <select name="discountType" defaultValue={editingCoupon?.discountType || "PERCENTAGE"}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="PERCENTAGE">Porcentagem (%)</option>
                        <option value="FIXED">Valor Fixo (R$)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor do Desconto</Label>
                      <Input name="discountValue" type="number" step="0.01" min="0.01"
                        defaultValue={editingCoupon?.discountValue} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Duração (meses — vazio = Vitalício)</Label>
                      <Input name="durationMonths" type="number" min="1"
                        defaultValue={editingCoupon?.durationMonths || ''} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>Limite de Usos (vazio = Ilimitado)</Label>
                      <Input name="maxUses" type="number" min="1"
                        defaultValue={editingCoupon?.maxUses || ''} />
                    </div>
                  </div>

                  {/* FIX: Switch controlado por estado React */}
                  <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
                    <Label htmlFor="sw-coupon-active" className="cursor-pointer">Cupom Ativo</Label>
                    <Switch id="sw-coupon-active" checked={couponIsActive} onCheckedChange={setCouponIsActive} />
                  </div>

                  <button type="submit" disabled={saveCoupon.isPending}
                    className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                    {saveCoupon.isPending ? <Loader2 className="animate-spin" /> : <Save size={18} />} Salvar Cupom
                  </button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {loadingCoupons && <Loader2 className="animate-spin text-primary mx-auto my-10" />}
          {errorCoupons && <ErrorState message="Erro ao carregar cupons." onRetry={refetchCoupons} />}

          {coupons && (
            <div className="bg-card border border-border rounded-2xl overflow-x-auto">
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
                  {coupons.map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-black text-primary">{c.code}</td>
                      <td className="px-4 py-3 font-medium">
                        {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `R$ ${Number(c.discountValue).toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3">
                        {c.durationMonths ? `${c.durationMonths} meses` : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">Vitalício</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-muted-foreground">{c.currentUses} / {c.maxUses || '∞'}</td>
                      <td className="px-4 py-3">
                        {c.isActive
                          ? <span className="text-green-500 font-bold flex items-center gap-1"><Check size={14} /> Ativo</span>
                          : <span className="text-red-500 font-bold flex items-center gap-1"><X size={14} /> Inativo</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setEditingCoupon(c);
                            setCouponIsActive(c.isActive); // FIX: inicializar estado do Switch
                            setIsCouponModalOpen(true);
                          }}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum cupom cadastrado ainda.</td>
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
