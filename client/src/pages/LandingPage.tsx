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
  Play
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fadeIn = {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.6 }
  };

  const navLinks = [
    { name: 'Recursos', href: '#features' },
    { name: 'Funcionalidades', href: '#functionalities' },
    { name: 'Preços', href: '#pricing' },
    { name: 'Depoimentos', href: '#testimonials' },
    { name: 'Contato', href: '#contact' },
  ];

  return (
    <div className="min-h-screen font-sans text-foreground bg-background selection:bg-blue-500/30 selection:text-blue-400">
      {/* NAVBAR */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          isScrolled 
          ? 'bg-background/80 backdrop-blur-xl border-border py-3' 
          : 'bg-transparent border-transparent py-5'
        }`}
      >
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Music size={24} />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">Music<span className="text-blue-600">Pro</span></span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-blue-600 transition-colors"
              >
                {link.name}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/login">
              <button className="px-5 py-2 text-sm font-black uppercase tracking-widest text-muted-foreground hover:text-blue-600 transition-colors">
                Área do Aluno
              </button>
            </Link>
            <Link href="/login">
              <button className="px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Área do Professor
              </button>
            </Link>
            <Link href="/login">
              <button className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-semibold shadow-lg shadow-blue-500/25 hover:bg-blue-700 hover:-translate-y-0.5 transition-all active:scale-95">
                Testar grátis
              </button>
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden text-foreground"
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
                    className="text-lg font-medium text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                ))}
                <hr className="border-border/50" />
                <div className="flex flex-col gap-3">
                  <Link href="/login">
                    <button className="w-full py-3 text-center font-medium text-muted-foreground">Entrar</button>
                  </Link>
                  <Link href="/login">
                    <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold">Testar grátis</button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-[#050816]">
        {/* Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full"></div>
        </div>

        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-6">
                <Star size={14} className="fill-current" />
                <span>Sistema completo para escolas de música</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
                Gestão completa para <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">escolas de música</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground/60 mb-10 max-w-lg leading-relaxed">
                Organize alunos, aulas, pagamentos e relatórios em um único sistema intuitivo. Mais tempo para o que realmente importa: a música.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
                <Link href="/login">
                  <button className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group">
                    Área do Professor
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
                <Link href="/login">
                  <button className="w-full sm:w-auto px-8 py-4 bg-background/10 text-white border border-white/20 rounded-2xl font-bold backdrop-blur-md hover:bg-background/20 transition-all flex items-center justify-center gap-2">
                    <Users size={18} />
                    Área do Aluno
                  </button>
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {[
                  { label: 'Sem cartão de crédito', icon: Check },
                  { label: 'Configuração rápida', icon: Check },
                  { label: 'Suporte especializado', icon: Check }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-muted-foreground/60 text-sm">
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                      <item.icon size={12} />
                    </div>
                    {item.label}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative"
            >
              {/* Glow effect under mockup */}
              <div className="absolute inset-0 bg-blue-600/30 blur-[80px] rounded-3xl -z-10 transform scale-90"></div>
              
              <div className="relative rounded-3xl border border-white/10 bg-background/5 backdrop-blur-2xl p-2 shadow-2xl overflow-hidden group">
                <img 
                  src="/mockup.png" 
                  alt="MusicPro Dashboard Mockup" 
                  className="rounded-2xl w-full h-auto shadow-inner"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050816]/40 to-transparent pointer-events-none"></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CLIENTS SECTION */}
      <section className="py-16 border-y border-border/50 bg-muted/30">
        <div className="container text-center">
          <p className="text-sm font-semibold text-muted-foreground/80 uppercase tracking-widest mb-10">
            Mais de 1.000 escolas confiam no MusicPro
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            {['Conservatório', 'Fábrica de Músicos', 'Harmonia', 'Nota Certa', 'Vivace'].map((name) => (
              <span key={name} className="text-2xl font-bold text-muted-foreground/60 tracking-tighter">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-24 bg-background relative overflow-hidden">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-4">Recursos completos</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Tudo que sua escola precisa</h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Ferramentas poderosas para simplificar a gestão e potencializar seus resultados, criadas especificamente para o universo musical.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { 
                title: 'Gestão de Alunos', 
                desc: 'Cadastre, organize e acompanhe o progresso dos seus alunos de forma simples e eficiente.', 
                icon: Users,
                color: 'blue'
              },
              { 
                title: 'Agenda de Aulas', 
                desc: 'Agende aulas, gerencie horários e salas disponíveis com um calendário intuitivo.', 
                icon: Calendar,
                color: 'green'
              },
              { 
                title: 'Financeiro Completo', 
                desc: 'Controle mensalidades, recebimentos, despesas e gere relatórios financeiros detalhados.', 
                icon: DollarSign,
                color: 'amber'
              },
              { 
                title: 'Relatórios Inteligentes', 
                desc: 'Visualize dados importantes da sua escola com relatórios completos e gráficos interativos.', 
                icon: BarChart3,
                color: 'purple'
              },
              { 
                title: 'Lembretes Automáticos', 
                desc: 'Envie lembretes de aulas e cobranças automaticamente via WhatsApp ou e-mail.', 
                icon: Bell,
                color: 'rose'
              },
              { 
                title: 'Controle de Instrumentos', 
                desc: 'Gerencie instrumentos, salas e recursos da sua escola de forma organizada.', 
                icon: Guitar,
                color: 'indigo'
              }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                {...fadeIn}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-[32px] bg-background border border-border/50 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-500/5 transition-all group cursor-default"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-${feature.color}-50 text-${feature.color}-600 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon size={28} />
                </div>
                <h4 className="text-xl font-bold text-foreground mb-3">{feature.title}</h4>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  {feature.desc}
                </p>
                <div className="flex items-center gap-2 text-sm font-bold text-blue-600 group-hover:gap-3 transition-all">
                  Saiba mais <ArrowRight size={16} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* STATISTICS SECTION */}
      <section className="py-24 bg-[#050816] relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-600/20 blur-[150px] rounded-full"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-600/10 blur-[150px] rounded-full"></div>
        </div>

        <div className="container relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { label: 'Escolas atendidas', value: '+1.000', icon: Music },
              { label: 'Alunos gerenciados', value: '+50.000', icon: Users },
              { label: 'Aulas realizadas', value: '+200.000', icon: Play }
            ].map((stat, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.2 }}
                className="p-10 rounded-[32px] bg-background/5 border border-white/10 backdrop-blur-xl text-center group hover:bg-background/10 transition-all"
              >
                <div className="w-16 h-16 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-6 text-blue-500 group-hover:scale-110 transition-transform">
                  <stat.icon size={32} />
                </div>
                <div className="text-5xl font-extrabold text-white mb-2">{stat.value}</div>
                <div className="text-muted-foreground/60 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section id="testimonials" className="py-24 bg-muted/50">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-bold mb-6">
                Depoimentos
              </div>
              <h3 className="text-4xl md:text-5xl font-bold text-foreground mb-8 leading-tight">
                "O MusicPro transformou a gestão da nossa escola. Hoje temos mais tempo para focar no que realmente importa."
              </h3>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-full bg-muted overflow-hidden border-2 border-white shadow-md">
                  <img src="https://i.pravatar.cc/150?u=1" alt="Carlos Alberto" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-bold text-foreground text-lg">Carlos Alberto</div>
                  <div className="text-muted-foreground/80">Diretor - Harmonia Escola de Música</div>
                </div>
              </div>

              <div className="flex gap-1 text-amber-500">
                {[1,2,3,4,5].map(i => <Star key={i} size={20} fill="currentColor" />)}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-200/50 blur-3xl rounded-full"></div>
              <div className="relative bg-background p-8 md:p-12 rounded-[40px] shadow-xl border border-border/50">
                <div className="grid grid-cols-2 gap-8 mb-12">
                  <div className="text-center p-6 bg-muted/50 rounded-3xl">
                    <div className="text-3xl font-bold text-blue-600 mb-1">98%</div>
                    <div className="text-sm text-muted-foreground/80">Satisfação</div>
                  </div>
                  <div className="text-center p-6 bg-muted/50 rounded-3xl">
                    <div className="text-3xl font-bold text-blue-600 mb-1">20h</div>
                    <div className="text-sm text-muted-foreground/80">Economia semanal</div>
                  </div>
                </div>
                <p className="text-muted-foreground italic leading-relaxed mb-8">
                  "Antes tudo era feito em planilhas ou cadernos. Agora temos controle total das mensalidades e a frequência dos alunos em poucos cliques."
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button className="w-12 h-12 rounded-full border border-border flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <ArrowRight size={20} className="rotate-180" />
                    </button>
                    <button className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors">
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PREÇOS */}
      <section id="pricing" className="py-24 bg-background">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-4">Planos simples e transparentes</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Escolha o plano ideal para sua escola</h3>
            <p className="text-lg text-muted-foreground">
              Todos os planos incluem 7 dias grátis para você testar sem compromisso.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Plano Básico */}
            <motion.div 
              {...fadeIn}
              className="p-8 rounded-[32px] border border-border/50 bg-background hover:border-blue-200 hover:shadow-xl transition-all"
            >
              <h4 className="text-xl font-bold text-foreground mb-2">Básico</h4>
              <p className="text-muted-foreground/80 text-sm mb-6">Ideal para pequenas escolas</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-sm font-bold text-muted-foreground/80">R$</span>
                <span className="text-4xl font-extrabold text-foreground">59,90</span>
                <span className="text-muted-foreground/80">/mês</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['Até 50 alunos', 'Agendamento de aulas', 'Controle financeiro básico', 'Relatórios essenciais'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-muted-foreground text-sm">
                    <Check size={16} className="text-blue-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <button className="w-full py-4 rounded-2xl border border-border text-foreground font-bold hover:bg-muted/50 transition-colors">
                  Testar grátis
                </button>
              </Link>
            </motion.div>

            {/* Plano Profissional */}
            <motion.div 
              {...fadeIn}
              transition={{ delay: 0.2 }}
              className="p-8 rounded-[32px] border-2 border-blue-600 bg-background shadow-2xl shadow-blue-500/10 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-bl-xl">
                Mais Escolhido
              </div>
              <h4 className="text-xl font-bold text-foreground mb-2">Profissional</h4>
              <p className="text-muted-foreground/80 text-sm mb-6">Ideal para escolas em crescimento</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-sm font-bold text-muted-foreground/80">R$</span>
                <span className="text-4xl font-extrabold text-foreground">99,90</span>
                <span className="text-muted-foreground/80">/mês</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['Até 200 alunos', 'Todos os recursos do Básico', 'Relatórios avançados', 'Lembretes automáticos', 'Suporte prioritário'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-muted-foreground text-sm font-medium">
                    <Check size={16} className="text-blue-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <button className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">
                  Testar grátis
                </button>
              </Link>
            </motion.div>

            {/* Plano Premium */}
            <motion.div 
              {...fadeIn}
              transition={{ delay: 0.4 }}
              className="p-8 rounded-[32px] border border-border/50 bg-background hover:border-blue-200 hover:shadow-xl transition-all"
            >
              <h4 className="text-xl font-bold text-foreground mb-2">Premium</h4>
              <p className="text-muted-foreground/80 text-sm mb-6">Para escolas que querem o melhor</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-sm font-bold text-muted-foreground/80">R$</span>
                <span className="text-4xl font-extrabold text-foreground">159,90</span>
                <span className="text-muted-foreground/80">/mês</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['Alunos ilimitados', 'Todos os recursos do Profissional', 'Personalização completa', 'Suporte dedicado', 'Integrações avançadas'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-muted-foreground text-sm">
                    <Check size={16} className="text-blue-600" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login">
                <button className="w-full py-4 rounded-2xl border border-border text-foreground font-bold hover:bg-muted/50 transition-colors">
                  Testar grátis
                </button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20">
        <div className="container">
          <div className="relative bg-[#050816] rounded-[48px] p-12 md:p-24 overflow-hidden">
            <div className="absolute inset-0 bg-blue-600/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/4"></div>
            
            <div className="relative z-10 text-center max-w-4xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-8 leading-tight">
                Pronto para levar sua escola para o próximo nível?
              </h2>
              <p className="text-xl text-muted-foreground/60 mb-12">
                Comece agora mesmo seu teste grátis de 7 dias. Sem cartão de crédito, sem burocracia.
              </p>
              <Link href="/login">
                <button className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-2xl shadow-blue-500/40 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 mx-auto">
                  Testar grátis por 7 dias <ArrowRight size={24} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 bg-muted/50 border-t border-border/50">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <Music size={20} />
                </div>
                <span className="text-xl font-bold text-foreground">MusicPro</span>
              </div>
              <p className="text-muted-foreground/80 mb-8 max-w-sm">
                A plataforma definitiva para gestão de escolas de música. Criada por músicos, para músicos.
              </p>
              <div className="flex gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full bg-muted hover:bg-blue-600 hover:text-white transition-all cursor-pointer flex items-center justify-center text-muted-foreground">
                    <Check size={18} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h5 className="font-bold text-foreground mb-6">Produto</h5>
              <ul className="space-y-4 text-muted-foreground/80 text-sm">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Recursos</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Funcionalidades</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Novidades</a></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-foreground mb-6">Escola</h5>
              <ul className="space-y-4 text-muted-foreground/80 text-sm">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Sobre nós</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Clientes</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Contato</a></li>
              </ul>
            </div>

            <div>
              <h5 className="font-bold text-foreground mb-6">Suporte</h5>
              <ul className="space-y-4 text-muted-foreground/80 text-sm">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Central de Ajuda</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Status</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-12 border-t border-border text-muted-foreground/60 text-sm gap-4">
            <p>© 2024 MusicPro - Sistema de Gestão para Escolas de Música.</p>
            <div className="flex gap-8">
              <span>Feito com ❤️ por músicos</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
