import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, AlertCircle, ArrowRight, Loader2, Mail, CheckCircle2, Phone, Gift, X } from "lucide-react";
import { clearReferralCode, readReferralCode, saveReferralCode } from "./indicacao/PublicReferralPage";

export default function Cadastro() {
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [planType, setPlanType] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  // Todos os planos ativos pagos (inclusive os que não estão na vitrine da landing)
  const { data: plans, isError: plansError } = trpc.publicData.getSignupPlans.useQuery();
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const search = useSearch();
  const planFromUrl = (() => {
    try {
      return (new URLSearchParams(search).get("plan") || "").trim();
    } catch {
      return "";
    }
  })();
  useEffect(() => {
    if (selectedPlanId || !plans || plans.length === 0) return;
    const fromUrl = planFromUrl ? plans.find((p) => p.id === planFromUrl) : undefined;
    const popular = plans.find((p) => p.isPopular);
    setSelectedPlanId((fromUrl || popular || plans[0]).id);
  }, [plans, selectedPlanId, planFromUrl]);
  const selectedPlan = plans?.find(p => p.id === selectedPlanId) || plans?.[0];
  // No ciclo anual só aparecem planos com preço anual definido
  const visiblePlans = (plans ?? []).filter((p) => planType === "MONTHLY" || Number(p.priceYearly) > 0);

  // Ao trocar para Anual, se o plano selecionado não tiver preço anual,
  // move a seleção para o primeiro plano válido do ciclo (evita enviar um
  // plano que sumiu da lista).
  useEffect(() => {
    if (planType !== "YEARLY") return;
    if (!selectedPlan || Number(selectedPlan.priceYearly) > 0) return;
    if (visiblePlans.length > 0) setSelectedPlanId(visiblePlans[0].id);
  }, [planType, selectedPlan, visiblePlans]);

  // ── Programa Indique & Ganhe: preserva o código vindo do link (?ref=) ──────
  const refFromUrl = (() => {
    try {
      return (new URLSearchParams(search).get("ref") || "").trim().toUpperCase();
    } catch {
      return "";
    }
  })();
  const [referralCode, setReferralCode] = useState<string>(() => refFromUrl || readReferralCode() || "");

  useEffect(() => {
    if (refFromUrl) {
      setReferralCode(refFromUrl);
      saveReferralCode(refFromUrl);
    }
  }, [refFromUrl]);

  const { data: referralInfo } = trpc.referral.getPublicInfo.useQuery(
    { code: referralCode },
    { enabled: referralCode.length >= 2, retry: false }
  );
  const referralValid = Boolean(referralInfo?.valid && referralInfo?.active);

  const registerMutation = trpc.auth.registerWithPlan.useMutation({
    onSuccess: () => {
      clearReferralCode();
      setSuccessMsg("Conta criada com sucesso! Redirecionando...");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    },
    onError: (err) => setErrorMsg(err.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanPhone = phone.replace(/\D/g, '');

    if (!name.trim()) return setErrorMsg("Por favor, informe seu nome completo.");
    if (!email.trim()) return setErrorMsg("O e-mail é obrigatório.");
    if (!emailRegex.test(email)) return setErrorMsg("Por favor, insira um e-mail válido.");
    if (!cleanPhone || cleanPhone.length < 10) return setErrorMsg("Por favor, informe seu número de WhatsApp com DDD.");
    if (!cpfCnpj.trim() || cpfCnpj.replace(/\D/g, '').length < 11) return setErrorMsg("Por favor, insira um CPF/CNPJ válido com pelo menos 11 dígitos.");
    if (!password) return setErrorMsg("Crie uma senha.");
    if (password.length < 6) return setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
    if (!selectedPlan) return setErrorMsg("Selecione um plano para continuar.");
    
    registerMutation.mutate({ 
      name: name.trim(), 
      email: email.trim(),
      phone: cleanPhone,
      cpfCnpj: cpfCnpj.replace(/\D/g, ''),
      password,
      planType,
      planId: selectedPlan.id,
      referralCode: referralCode || undefined,
    });
  };

  const isLoading = registerMutation.isPending;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#050816] relative overflow-hidden py-12">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px]" />
      
      <div className="z-10 w-full max-w-[500px] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-violet-600 rounded-2xl flex items-center justify-center mb-6 shadow-2xl shadow-primary/20 group hover:scale-110 transition-transform duration-500">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
            Music<span className="text-primary">Pro</span>
          </h1>
          <p className="text-muted-foreground font-medium">
            Crie sua conta de professor e escolha seu plano
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle inner glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            {referralValid && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl flex items-start gap-3"
              >
                <Gift className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-violet-200 font-bold">
                    Você foi indicado por {referralInfo?.schoolName || "uma escola MusicPro"}!
                  </p>
                  <p className="text-xs text-violet-300/80 mt-0.5">
                    Comece com {referralInfo?.trialDays} dias grátis · Código {referralCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    clearReferralCode();
                    setReferralCode("");
                  }}
                  aria-label="Remover indicação"
                  title="Não fui indicado — remover"
                  className="ml-auto shrink-0 text-violet-300/70 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200 font-medium leading-relaxed">{errorMsg}</p>
              </motion.div>
            )}

            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-200 font-medium leading-relaxed">{successMsg}</p>
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/70 font-semibold uppercase tracking-wider text-xs ml-1">Seu Nome</Label>
                <Input 
                  type="text" 
                  placeholder="Nome Completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-14 bg-black/40 border-white/10 text-white rounded-2xl px-4 focus:ring-2 focus:ring-primary/50 transition-all hover:border-white/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 font-semibold uppercase tracking-wider text-xs ml-1">Seu E-mail</Label>
                <div className="relative group">
                  <Input 
                    type="email" 
                    placeholder="exemplo@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 bg-black/40 border-white/10 text-white rounded-2xl pl-12 focus:ring-2 focus:ring-primary/50 transition-all group-hover:border-white/20"
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 font-semibold uppercase tracking-wider text-xs ml-1">
                  WhatsApp com DDD <span className="text-primary font-bold">*</span>
                </Label>
                <div className="relative group">
                  <Input 
                    type="tel" 
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, '');
                      if (v.length > 11) v = v.slice(0, 11);
                      if (v.length > 10) {
                        v = v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                      } else if (v.length > 6) {
                        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
                      } else if (v.length > 2) {
                        v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
                      }
                      setPhone(v);
                    }}
                    className="h-14 bg-black/40 border-white/10 text-white rounded-2xl pl-12 focus:ring-2 focus:ring-primary/50 transition-all group-hover:border-white/20"
                  />
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 group-focus-within:text-primary transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 font-semibold uppercase tracking-wider text-xs ml-1">CPF ou CNPJ</Label>
                <Input 
                  type="text" 
                  placeholder="000.000.000-00"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  className="h-14 bg-black/40 border-white/10 text-white rounded-2xl px-4 focus:ring-2 focus:ring-primary/50 transition-all hover:border-white/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70 font-semibold uppercase tracking-wider text-xs ml-1">Sua Senha</Label>
                <Input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 bg-black/40 border-white/10 text-white rounded-2xl px-4 focus:ring-2 focus:ring-primary/50 transition-all hover:border-white/20"
                />
              </div>
            </div>

            <div className="pt-4 pb-2 space-y-4">
              <Label className="text-white/70 font-semibold uppercase tracking-wider text-xs ml-1 block">Escolha seu plano</Label>

              {/* Ciclo de cobrança */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10">
                {(["MONTHLY", "YEARLY"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPlanType(t)}
                    className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                      planType === t ? "bg-primary text-primary-foreground shadow" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {t === "MONTHLY" ? "Mensal" : "Anual (economize)"}
                  </button>
                ))}
              </div>

              {/* Todos os planos disponíveis */}
              {plansError ? (
                <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-center text-sm text-red-200">
                  Não foi possível carregar os planos. Recarregue a página e tente novamente.
                </div>
              ) : !plans ? (
                <div className="p-4 rounded-2xl border border-white/10 bg-black/40 text-center text-sm text-white/60">
                  Carregando planos…
                </div>
              ) : visiblePlans.length === 0 ? (
                <div className="p-4 rounded-2xl border border-white/10 bg-black/40 text-center text-sm text-white/60">
                  Nenhum plano disponível para contratação no momento.
                </div>
              ) : (
                <div className="space-y-3" role="radiogroup" aria-label="Planos disponíveis">
                  {visiblePlans.map((p) => {
                    const selected = selectedPlan?.id === p.id;
                    const monthly = Number(p.priceMonthly);
                    const yearly = Number(p.priceYearly);
                    const price = planType === "MONTHLY" ? monthly : yearly;
                    const features = (() => {
                      try {
                        const arr = JSON.parse(p.features || "[]");
                        return Array.isArray(arr)
                          ? arr.slice(0, 3).filter((x: unknown) => typeof x === "string" || typeof x === "number").map(String)
                          : [];
                      } catch {
                        return [];
                      }
                    })();
                    const studentsLabel = Number(p.maxStudents) >= 999999
                      ? "Alunos ilimitados"
                      : `Até ${p.maxStudents} alunos`;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-pressed={selected}
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`w-full text-left flex flex-col p-4 rounded-2xl border-2 transition-all ${
                          selected ? "border-primary bg-primary/10" : "border-white/10 bg-black/40 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-primary" : "border-white/40"}`}>
                              {selected && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                            </span>
                            <span className="text-white font-bold text-base truncate">{p.name}</span>
                            {p.isPopular && (
                              <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-[9px] font-black uppercase tracking-widest border border-amber-400/30">
                                Mais popular
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            {planType === "YEARLY" && (
                              <span className="text-white/55 line-through text-xs block">
                                R$ {(monthly * 12).toFixed(2).replace(".", ",")}
                              </span>
                            )}
                            <span className={planType === "YEARLY" ? "text-emerald-400 font-black text-lg" : "text-primary font-black text-lg"}>
                              R$ {price.toFixed(2).replace(".", ",")}
                              <span className="text-xs text-white/50 font-normal">/{planType === "MONTHLY" ? "mês" : "ano"}</span>
                            </span>
                          </div>
                        </div>
                        <p className="text-white/60 text-xs mt-2 pl-8">
                          {studentsLabel}
                          {features.length > 0 ? ` • ${features.join(" • ")}` : ""}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group mt-4"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Iniciar teste grátis
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
            
            <div className="mt-8 text-center">
              <p className="text-white/60 text-sm">
                Já possui conta?{' '}
                <button 
                  type="button" 
                  onClick={() => window.location.href = "/login?type=professor"} 
                  className="text-primary font-bold hover:underline transition-all"
                >
                  Faça login
                </button>
              </p>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
