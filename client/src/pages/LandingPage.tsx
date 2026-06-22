import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, 
  Users, 
  Calendar, 
  DollarSign, 
  BarChart3, 
  Bell, 
  Guitar, 
  Check, 
  ArrowRight, 
  Menu, 
  X,
  Star,
  Play,
  Shield,
  CreditCard,
  MapPin,
  User,
  Mail,
  Lock,
  Phone,
  ChevronRight,
  MessageCircle,
  Sparkles,
  Building2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { BenefitsCarousel } from '@/components/BenefitsCarousel';
import { HeroSlider } from '@/components/HeroSlider';

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
export const TRIAL_DAYS = 30;

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type PlanType = '10alunos' | '20alunos' | '30alunos' | 'basico' | 'profissional' | 'premium';
type ModalStep = 'conta' | 'endereco' | 'pagamento' | 'sucesso';

interface SignupForm {
  nome: string;
  email: string;
  senha: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cardNumber: string;
  cardName: string;
  cardExpiry: string;
  cardCvv: string;
}

// ─── MODAL DE CADASTRO ────────────────────────────────────────────────────────
const SignupModal = ({ plan, onClose }: { plan: PlanType; onClose: () => void }) => {
  const [step, setStep] = useState<ModalStep>('conta');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SignupForm>({
    nome: '', email: '', senha: '', telefone: '',
    cep: '', rua: '', numero: '', bairro: '', cidade: '', estado: '',
    cardNumber: '', cardName: '', cardExpiry: '', cardCvv: '',
  });

  const planLabels = { 
    basico: 'Básico', 
    profissional: 'Profissional', 
    premium: 'Premium',
    '10alunos': '10 Alunos',
    '20alunos': '20 Alunos',
    '30alunos': '30 Alunos'
  };
  const planPrices = { 
    basico: 'R$ 29,99/mês', 
    profissional: 'R$ 59,90/mês', 
    premium: 'R$ 99,90/mês',
    '10alunos': 'R$ 10,00/mês',
    '20alunos': 'R$ 15,00/mês',
    '30alunos': 'R$ 20,00/mês'
  };

  const steps: ModalStep[] = ['conta', 'endereco', 'pagamento'];
  const stepLabels = { conta: 'Sua Conta', endereco: 'Endereço', pagamento: 'Pagamento' };
  const currentStepIdx = steps.indexOf(step);

  const set = (key: keyof SignupForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    return digits.length >= 3 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits;
  };

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        set('rua', data.logradouro || '');
        set('bairro', data.bairro || '');
        set('cidade', data.localidade || '');
        set('estado', data.uf || '');
      }
    } catch {}
  };

  const handleNext = async () => {
    setError(null);
    if (step === 'conta') {
      if (!form.nome || !form.email || !form.senha || !form.telefone) return setError('Preencha todos os campos da conta.');
      if (!form.email.includes('@')) return setError('E-mail inválido.');
      if (form.senha.length < 8) return setError('A senha deve ter no mínimo 8 caracteres.');
      setStep('endereco');
    }
    else if (step === 'endereco') {
      if (!form.cep || !form.rua || !form.numero || !form.bairro || !form.cidade || !form.estado) return setError('Preencha todos os campos do endereço.');
      setStep('pagamento');
    }
    else if (step === 'pagamento') {
      if (!form.cardNumber || !form.cardName || !form.cardExpiry || !form.cardCvv) return setError('Preencha todos os campos do pagamento.');
      setLoading(true);
      await new Promise(r => setTimeout(r, 1500));
      setLoading(false);
      setStep('sucesso');
    }
  };

  // Overlay click handler
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && step !== 'sucesso') onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header azul */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 pt-8 pb-6 text-white">
          {step !== 'sucesso' && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          )}

          {step === 'sucesso' ? (
            <div className="text-center py-4">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={36} className="text-white" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-black mb-1">Cadastro realizado!</h2>
              <p className="text-blue-100 text-sm">{TRIAL_DAYS} dias grátis começam agora</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Music size={16} />
                </div>
                <span className="font-bold text-sm opacity-90">MusicPro</span>
              </div>
              <h2 className="text-xl font-black mb-1">
                Plano {planLabels[plan]} — <span className="text-blue-200">{planPrices[plan]}</span>
              </h2>
              <p className="text-blue-100 text-xs">{TRIAL_DAYS} dias grátis • Cancele quando quiser</p>

              {/* Steps indicator */}
              <div className="flex items-center gap-2 mt-5">
                {steps.map((s, i) => (
                  <React.Fragment key={s}>
                    <div className={`flex items-center gap-1.5 ${i <= currentStepIdx ? 'text-white' : 'text-blue-300'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                        i < currentStepIdx ? 'bg-white text-blue-600 border-white' :
                        i === currentStepIdx ? 'border-white text-white' :
                        'border-blue-400 text-blue-400'
                      }`}>
                        {i < currentStepIdx ? <Check size={12} strokeWidth={3} /> : i + 1}
                      </div>
                      <span className="text-xs font-semibold hidden sm:block">{stepLabels[s]}</span>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 rounded-full transition-all ${i < currentStepIdx ? 'bg-white' : 'bg-blue-400/40'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Conteúdo */}
        <div className="px-8 py-6">
          <AnimatePresence mode="wait">

            {/* ── ETAPA 1: CONTA ── */}
            {step === 'conta' && (
              <motion.div key="conta" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Nome completo</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text" placeholder="Seu nome completo"
                      value={form.nome} onChange={e => set('nome', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">E-mail</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email" placeholder="seu@email.com"
                      value={form.email} onChange={e => set('email', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Senha</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'} placeholder="Mínimo 8 caracteres"
                      value={form.senha} onChange={e => set('senha', e.target.value)}
                      className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel" placeholder="(00) 00000-0000"
                      value={form.telefone} onChange={e => set('telefone', e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── ETAPA 2: ENDEREÇO ── */}
            {step === 'endereco' && (
              <motion.div key="endereco" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">CEP</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text" placeholder="00000-000" maxLength={9}
                        value={form.cep}
                        onChange={e => { set('cep', e.target.value); lookupCep(e.target.value); }}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                      />
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Estado</label>
                    <input
                      type="text" placeholder="UF" maxLength={2}
                      value={form.estado} onChange={e => set('estado', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Rua / Logradouro</label>
                  <input
                    type="text" placeholder="Rua, Avenida..."
                    value={form.rua} onChange={e => set('rua', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Número</label>
                    <input
                      type="text" placeholder="Nº"
                      value={form.numero} onChange={e => set('numero', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Bairro</label>
                    <input
                      type="text" placeholder="Bairro"
                      value={form.bairro} onChange={e => set('bairro', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Cidade</label>
                  <input
                    type="text" placeholder="Sua cidade"
                    value={form.cidade} onChange={e => set('cidade', e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white"
                  />
                </div>
              </motion.div>
            )}

            {/* ── ETAPA 3: PAGAMENTO ── */}
            {step === 'pagamento' && (
              <motion.div key="pagamento" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {/* Info Trial */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                  <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-800 text-xs font-bold">{TRIAL_DAYS} dias totalmente grátis</p>
                    <p className="text-blue-600 text-xs mt-0.5">Seu cartão só será cobrado após o período de trial. Cancele antes e não paga nada.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Número do Cartão</label>
                  <div className="relative">
                    <CreditCard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text" placeholder="0000 0000 0000 0000" maxLength={19}
                      value={form.cardNumber}
                      onChange={e => set('cardNumber', formatCard(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white font-mono tracking-wider"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Nome no Cartão</label>
                  <input
                    type="text" placeholder="Nome igual ao cartão"
                    value={form.cardName} onChange={e => set('cardName', e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white uppercase tracking-wider"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">Validade</label>
                    <input
                      type="text" placeholder="MM/AA" maxLength={5}
                      value={form.cardExpiry}
                      onChange={e => set('cardExpiry', formatExpiry(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wider">CVV</label>
                    <div className="relative">
                      <input
                        type="text" placeholder="000" maxLength={4}
                        value={form.cardCvv}
                        onChange={e => set('cardCvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 focus:bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Flags */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-gray-400">Aceitamos:</span>
                  {['VISA', 'MC', 'ELO', 'AMEX'].map(b => (
                    <span key={b} className="px-2 py-0.5 bg-gray-100 rounded text-xs font-bold text-gray-500">{b}</span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── SUCESSO ── */}
            {step === 'sucesso' && (
              <motion.div key="sucesso" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4 space-y-5">
                <div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">
                    Bem-vindo ao MusicPro{plan === 'premium' && ', Premium'}! 🎉
                  </h3>
                  <p className="text-gray-500 text-sm">
                    Sua conta foi criada com sucesso. Você tem {TRIAL_DAYS} dias grátis para explorar tudo.
                  </p>
                </div>

                {plan === 'premium' && (
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-yellow-300" />
                      <span className="font-black text-sm">Benefício exclusivo Premium</span>
                    </div>
                    <p className="text-blue-100 text-xs leading-relaxed mb-4">
                      Como assinante Premium, você tem acesso direto ao desenvolvedor para solicitar melhorias personalizadas no sistema. Fale agora mesmo!
                    </p>
                    <a
                      href="https://wa.me/5533984055949?text=Ol%C3%A1!%20Acabei%20de%20criar%20minha%20conta%20no%20plano%20Premium%20do%20MusicPro%20e%20gostaria%20de%20tirar%20algumas%20d%C3%BAvidas%20e%20conhecer%20as%20possibilidades%20de%20personaliza%C3%A7%C3%A3o%20do%20sistema."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-white text-blue-700 font-black py-3 rounded-xl text-sm hover:bg-blue-50 transition-colors shadow-lg"
                    >
                      <MessageCircle size={18} className="fill-current" />
                      Conversar no WhatsApp agora
                    </a>
                  </div>
                )}

                <div className="space-y-2">
                  <Link href="/login?type=professor">
                    <button className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
                      Acessar minha conta <ArrowRight size={16} />
                    </button>
                  </Link>
                  <button onClick={onClose} className="w-full py-2.5 text-gray-400 text-xs hover:text-gray-600 transition-colors">
                    Fechar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botão de avançar */}
          {step !== 'sucesso' && (
            <>
              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold text-center border border-red-100">
                  {error}
                </div>
              )}
              <motion.button
                key={step}
                onClick={handleNext}
                disabled={loading}
                className="mt-6 w-full py-4 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : step === 'pagamento' ? (
                  <>
                    <Shield size={16} />
                    Ativar {TRIAL_DAYS} dias grátis — {planPrices[plan]}
                  </>
                ) : (
                  <>
                    Continuar <ChevronRight size={16} />
                  </>
                )}
              </motion.button>
            </>
          )}

          {step !== 'sucesso' && (
            <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
              <Shield size={11} /> Dados protegidos com criptografia SSL
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── LANDING PAGE PRINCIPAL ───────────────────────────────────────────────────
const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signupPlan, setSignupPlan] = useState<PlanType | null>(null);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading, user } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (user.role === 'aluno') {
        setLocation("/aluno");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [isAuthenticated, loading, user, setLocation]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Bloquear scroll quando modal aberto
  useEffect(() => {
    if (signupPlan) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [signupPlan]);

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  };

  const navLinks = [
    { name: 'Recursos', href: '#features' },
    { name: 'Depoimentos', href: '#testimonials' },
    { name: 'Preços', href: '#pricing' },
    { name: 'Contato', href: 'https://wa.me/5533984055949?text=ola%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20sistema%20musicpro', target: '_blank' },
  ];

  const plans = [
    {
      id: 'profissional' as PlanType,
      name: 'Profissional',
      subtitle: 'Para escolas em crescimento',
      price: '59',
      cents: '90',
      highlight: true,
      badge: 'Mais Escolhido',
      features: [
        'Até 200 alunos cadastrados',
        'Todos os recursos liberados',
        'Sistema completo funcionando',
      ],
      cta: 'Assinar Agora',
      ctaStyle: 'solid',
    },
    {
      id: 'premium' as PlanType,
      name: 'Premium',
      subtitle: 'Para escolas exigentes',
      price: '99',
      cents: '90',
      highlight: false,
      badge: null,
      features: [
        'Alunos ilimitados',
        'Todos os recursos liberados',
        'Opção de solicitar melhorias',
      ],
      cta: 'Assinar Agora',
      ctaStyle: 'border',
    },
    {
      id: 'basico' as PlanType,
      name: 'Básico',
      subtitle: 'Para pequenas escolas',
      price: '29',
      cents: '99',
      highlight: false,
      badge: null,
      features: [
        'Até 50 alunos cadastrados',
        'Todos os recursos liberados',
        'Sistema completo funcionando',
      ],
      cta: 'Assinar Agora',
      ctaStyle: 'border',
    },
    {
      id: '30alunos' as PlanType,
      name: '30 Alunos',
      subtitle: 'Professor independente',
      price: '20',
      cents: '00',
      highlight: false,
      badge: null,
      features: [
        'Até 30 alunos cadastrados',
        'Todos os recursos liberados',
        'Sistema completo funcionando',
      ],
      cta: 'Assinar Agora',
      ctaStyle: 'border',
    },
    {
      id: '20alunos' as PlanType,
      name: '20 Alunos',
      subtitle: 'Professor independente',
      price: '15',
      cents: '00',
      highlight: false,
      badge: null,
      features: [
        'Até 20 alunos cadastrados',
        'Todos os recursos liberados',
        'Sistema completo funcionando',
      ],
      cta: 'Assinar Agora',
      ctaStyle: 'border',
    },
    {
      id: '10alunos' as PlanType,
      name: '10 Alunos',
      subtitle: 'Professor independente',
      price: '10',
      cents: '00',
      highlight: false,
      badge: null,
      features: [
        'Até 10 alunos cadastrados',
        'Todos os recursos liberados',
        'Sistema completo funcionando',
      ],
      cta: 'Assinar Agora',
      ctaStyle: 'border',
    },
  ];

  return (
    <div className="min-h-screen font-sans text-foreground bg-background selection:bg-primary/30 selection:text-primary">
      {/* MODAL */}
      <AnimatePresence>
        {signupPlan && (
          <SignupModal plan={signupPlan} onClose={() => setSignupPlan(null)} />
        )}
      </AnimatePresence>

      {/* NAVBAR */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          isScrolled 
          ? 'bg-background/90 backdrop-blur-xl border-border py-3' 
          : 'bg-transparent border-transparent py-5'
        }`}
      >
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
              <Music size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">Music<span className="text-primary">Pro</span></span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href}
                target={link.target || "_self"}
                className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login?type=aluno">
              <button className="px-5 py-2 text-xs font-black uppercase tracking-[0.2em] text-primary hover:opacity-80 transition-all border border-primary/20 bg-primary/5 rounded-xl">
                Área do Aluno
              </button>
            </Link>
            <Link href="/login?type=professor">
              <button className="px-5 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Área da Escola / Professor
              </button>
            </Link>
            <button
              onClick={() => setSignupPlan('profissional')}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 transition-all active:scale-95"
            >
              Testar grátis
            </button>
          </div>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden text-foreground hover:text-primary transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-background border-b border-border/50 overflow-hidden"
            >
              <div className="container py-6 flex flex-col gap-4">
                {navLinks.map((link) => (
                  <a 
                    key={link.name} 
                    href={link.href}
                    target={link.target || "_self"}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                ))}
                <hr className="border-border/50 my-2" />
                <div className="flex flex-col gap-3">
                  <Link href="/login?type=aluno" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full py-3 bg-muted text-foreground rounded-xl font-bold border border-border">Área do Aluno</button>
                  </Link>
                  <Link href="/login?type=professor" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full py-3 bg-muted text-foreground rounded-xl font-bold border border-border">Área da Escola / Professor</button>
                  </Link>
                  <button
                    onClick={() => { setMobileMenuOpen(false); setSignupPlan('profissional'); }}
                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-md hover:bg-primary/90 transition-all"
                  >
                    Testar grátis
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-background">
        {/* Semantic Background Effects */}


        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-6 hover:bg-primary/15 transition-colors cursor-default">
                <Star size={14} className="fill-current" />
                <span>Sistema completo para escolas de música</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-extrabold text-foreground leading-tight mb-6 tracking-tight">
                Gestão total para <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500">escolas de música</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-lg leading-relaxed font-medium">
                Organize alunos, aulas, pagamentos e relatórios em um único sistema intuitivo. Mais tempo para o que realmente importa: a música.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
                <Link href="/login?type=professor">
                  <button
                    className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-xl shadow-primary/30 hover:bg-primary/90 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group"
                  >
                    Área da Escola / Professor
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <Link href="/login?type=aluno">
                  <button className="w-full sm:w-auto px-8 py-4 bg-background border-2 border-primary/20 text-foreground rounded-2xl font-black text-sm uppercase tracking-widest hover:border-primary/50 hover:bg-muted/50 active:scale-95 transition-all flex items-center justify-center gap-3">
                    <Users size={18} className="text-primary" />
                    Área do Aluno
                  </button>
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {[
                  { value: '500+', label: 'Escolas ativas' },
                  { value: '10mil+', label: 'Alunos gerenciados' },
                  { value: '99%', label: 'Satisfação' },
                ].map(stat => (
                  <div key={stat.label} className="text-center sm:text-left">
                    <div className="text-2xl font-black text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative hidden lg:flex items-center justify-center w-full max-w-2xl"
            >
              <div className="relative w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-indigo-500/20 rounded-[48px] blur-2xl"></div>
                <img src="/images/dashboard-preview.png" alt="Dashboard do Sistema MusicPro" className="relative rounded-[24px] shadow-2xl border border-border w-full h-auto object-cover" />
              </div>
            </motion.div>
          </div>

          <div className="mt-20 w-full">
            <HeroSlider />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative py-24 bg-muted/30 border-y border-border/50 overflow-hidden">
        {/* Instrument Decorations */}
        <div className="hidden xl:block absolute top-[20px] right-[-200px] transform rotate-[20deg] z-0 pointer-events-none">
          <img src="/img/guitar-trans.png" alt="" className="w-[500px] object-contain select-none opacity-90 drop-shadow-2xl" draggable={false} />
        </div>

        <div className="container relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-primary font-black tracking-widest uppercase text-sm mb-4">Tudo que você precisa</h2>
            <h3 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6">Funcionalidades pensadas para músicos</h3>
            <p className="text-lg text-muted-foreground font-medium">
              Desenvolvido por quem entende a rotina de uma escola de música. Simples de usar, poderoso nos resultados.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Users, title: 'Gestão de Alunos', desc: 'Cadastro completo, histórico de evolução, presença e notas em um só lugar.' },
              { icon: Calendar, title: 'Agendamento Inteligente', desc: 'Organize horários, aulas e eventos com um calendário visual e intuitivo.' },
              { icon: DollarSign, title: 'Controle Financeiro', desc: 'Mensalidades, comprovantes e relatórios financeiros automáticos.' },
              { icon: Bell, title: 'Lembretes Automáticos', desc: 'Notificações por WhatsApp para alunos sobre aulas e pagamentos pendentes.' },
              { icon: BarChart3, title: 'Relatórios Avançados', desc: 'Dashboards detalhados para tomar decisões baseadas em dados reais.' },
              { icon: Guitar, title: 'IA para Professores', desc: 'Gere planos de aula, análises de progresso e sugestões com inteligência artificial.' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                {...fadeIn}
                transition={{ delay: i * 0.1 }}
                className="group p-8 bg-card border border-border/50 rounded-[32px] hover:border-primary/30 hover:shadow-xl transition-all duration-300"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                  <feature.icon size={22} />
                </div>
                <h4 className="text-lg font-extrabold text-foreground mb-3">{feature.title}</h4>
                <p className="text-muted-foreground font-medium leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <BenefitsCarousel />

      {/* TESTIMONIALS */}
      <section id="testimonials" className="relative py-24 bg-background overflow-hidden">
        {/* Instrument Decorations */}
        <div className="hidden xl:block absolute top-[20px] left-[-150px] transform -rotate-[15deg] z-0 pointer-events-none">
          <img src="/img/sax-trans.png" alt="" className="w-[450px] object-contain select-none opacity-80 drop-shadow-2xl" draggable={false} />
        </div>

        <div className="container relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-primary font-black tracking-widest uppercase text-sm mb-4">Depoimentos</h2>
            <h3 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6">Quem já usa, aprova</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Ana Lima', role: 'Diretora - Escola Harmonia', text: 'O MusicPro transformou completamente a forma como gerencio minha escola. Economizo horas por semana!' },
              { name: 'Carlos Mendes', role: 'Professor - Studio Ritmo', text: 'Os lembretes automáticos reduziram em 80% as faltas dos alunos. Resultado incrível!' },
              { name: 'Patricia Souza', role: 'Fundadora - Acorde Music', text: 'O controle financeiro é fantástico. Antes era tudo planilha, agora tenho tudo automatizado.' },
            ].map((t, i) => (
              <motion.div key={t.name} {...fadeIn} transition={{ delay: i * 0.15 }} className="p-8 bg-card border border-border/50 rounded-[32px]">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} size={14} className="text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-muted-foreground font-medium mb-6 leading-relaxed">"{t.text}"</p>
                <div>
                  <div className="font-extrabold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PREÇOS ─────────────────────────────────────────────────────────────── */}
      <section id="pricing" className="relative py-24 bg-muted/30 border-y border-border/50 overflow-hidden">
        {/* Instrument Decorations */}
        <div className="hidden xl:block absolute top-[40px] left-[-250px] transform -rotate-[15deg] z-0 pointer-events-none">
          <img src="/img/synth-trans.png" alt="" className="w-[600px] object-contain select-none opacity-80 drop-shadow-2xl" draggable={false} />
        </div>
        <div className="hidden xl:block absolute top-[40px] right-[-180px] transform rotate-[15deg] z-0 pointer-events-none">
          <img src="/img/violin-trans.png" alt="" className="w-[450px] object-contain select-none opacity-80 drop-shadow-2xl" draggable={false} />
        </div>

        <div className="container relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-primary font-black tracking-widest uppercase text-sm mb-4">Planos simples e transparentes</h2>
            <h3 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6">Escolha o plano ideal para sua escola</h3>
            <p className="text-lg text-muted-foreground font-medium">
              Todos os planos incluem <strong className="text-foreground">{TRIAL_DAYS} dias grátis</strong> para você testar sem compromisso.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-center">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                {...fadeIn}
                transition={{ delay: i * 0.15 }}
                className={`relative flex flex-col rounded-[40px] transition-all duration-300 ${
                  plan.highlight
                    ? 'bg-white border-2 border-blue-500 shadow-2xl shadow-blue-500/20 md:-translate-y-4 p-10'
                    : 'bg-card border border-border/50 hover:border-primary/30 hover:shadow-xl p-10'
                }`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-5 py-2 rounded-full shadow-lg whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}

                {/* Plan Info */}
                <div className="mb-6">
                  <h4 className={`text-2xl font-extrabold mb-1 ${plan.highlight ? 'text-gray-900' : 'text-foreground'}`}>
                    {plan.name}
                  </h4>
                  <p className={`text-sm font-medium ${plan.highlight ? 'text-gray-500' : 'text-muted-foreground'}`}>
                    {plan.subtitle}
                  </p>
                </div>

                {/* Price */}
                <div className={`flex items-baseline gap-1 mb-8 ${plan.highlight ? 'text-gray-900' : 'text-foreground'}`}>
                  <span className="text-base font-bold text-gray-500">R$</span>
                  <span className="text-5xl font-black tracking-tight">{plan.price}</span>
                  <span className="text-2xl font-black">,{plan.cents}</span>
                  <span className="text-gray-400 font-medium text-sm">/mês</span>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map(feat => (
                    <li key={feat} className={`flex items-center gap-3 text-sm font-medium ${plan.highlight ? 'text-gray-700' : 'text-muted-foreground'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        plan.highlight ? 'bg-blue-600 text-white' : 'bg-primary/10 text-primary'
                      }`}>
                        <Check size={13} strokeWidth={3} />
                      </div>
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => setSignupPlan(plan.id)}
                  className={`w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] ${
                    plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                      : plan.id === 'premium'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 shadow-lg'
                      : 'border-2 border-border text-foreground hover:bg-muted hover:border-primary/50'
                  }`}
                >
                  {plan.cta}
                </button>

                {/* Trial note */}
                <p className={`text-center text-xs mt-3 ${plan.highlight ? 'text-gray-400' : 'text-muted-foreground'}`}>
                  30 dias grátis • Cancele quando quiser
                </p>
              </motion.div>
            ))}
          </div>

          {/* Garantia */}
          <motion.div {...fadeIn} className="mt-16 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-4 bg-card border border-border/50 rounded-2xl">
              <Shield size={20} className="text-primary" />
              <span className="text-sm font-semibold text-muted-foreground">
                Garantia de {TRIAL_DAYS} dias: se não gostar, cancele sem custo algum.
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-background">
        <div className="container">
          <div className="relative bg-card border border-border rounded-[48px] p-12 md:p-24 overflow-hidden shadow-2xl">
            
            <div className="relative z-10 text-center max-w-4xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-black text-foreground mb-8 leading-tight tracking-tight">
                Pronto para levar sua escola para o <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500">próximo nível?</span>
              </h2>
              <p className="text-xl text-muted-foreground font-medium mb-12 max-w-2xl mx-auto">
                Comece agora mesmo seu teste grátis de {TRIAL_DAYS} dias. Sem burocracia. Cancele quando quiser.
              </p>
              <button
                onClick={() => setSignupPlan('profissional')}
                className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-wider shadow-2xl hover:scale-105 hover:shadow-primary/50 transition-all flex items-center gap-2 mx-auto"
              >
                Criar conta grátis agora <ArrowRight size={24} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="py-20 bg-muted/30 border-t border-border/50">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6 cursor-default">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-md">
                  <Music size={22} />
                </div>
                <span className="text-2xl font-black text-foreground tracking-tight">Music<span className="text-primary">Pro</span></span>
              </div>
              <p className="text-muted-foreground font-medium mb-8 max-w-sm leading-relaxed">
                A plataforma definitiva para gestão de escolas de música. Criada por músicos, para músicos.
              </p>
            </div>

            <div>
              <h5 className="font-extrabold text-foreground mb-6 uppercase tracking-widest text-sm">Produto</h5>
              <ul className="space-y-4 text-muted-foreground font-medium">
                <li><a href="#features" className="hover:text-primary transition-colors">Recursos</a></li>
                <li><a href="#testimonials" className="hover:text-primary transition-colors">Depoimentos</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">Preços</a></li>
                <li><Link href="/login" className="hover:text-primary transition-colors">Área do Aluno</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-extrabold text-foreground mb-6 uppercase tracking-widest text-sm">Escola</h5>
              <ul className="space-y-4 text-muted-foreground font-medium">
                <li><a href="#" className="hover:text-primary transition-colors">Sobre nós</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Parceiros</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="https://wa.me/5533984055949?text=ola%20gostaria%20de%20mais%20informa%C3%A7%C3%B5es%20sobre%20o%20sistema%20musicpro" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Contato</a></li>
              </ul>
            </div>

            <div>
              <h5 className="font-extrabold text-foreground mb-6 uppercase tracking-widest text-sm">Suporte</h5>
              <ul className="space-y-4 text-muted-foreground font-medium">
                <li><a href="#" className="hover:text-primary transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Política de Privacidade</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Status do Sistema</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-10 border-t border-border/50 text-muted-foreground font-medium text-sm gap-4">
            <p>© {new Date().getFullYear()} MusicPro. Todos os direitos reservados.</p>
            <div className="flex gap-2 items-center">
              <span>Feito com</span>
              <span className="text-red-500 animate-pulse">❤️</span>
              <span>por músicos para músicos</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
