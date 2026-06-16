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

  return (
    <div className="min-h-screen font-sans text-foreground bg-background selection:bg-primary/30 selection:text-primary">
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
                Área do Professor
              </button>
            </Link>
            <Link href="/login?type=professor&register=true">
              <button className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 transition-all active:scale-95">
                Testar grátis
              </button>
            </Link>
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
                    <button className="w-full py-3 bg-muted text-foreground rounded-xl font-bold border border-border">Área do Professor</button>
                  </Link>
                  <Link href="/login?type=professor&register=true" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-md hover:bg-primary/90 transition-all">Testar grátis</button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-background">
        {/* Semantic Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-500/10 blur-[100px] rounded-full"></div>
        </div>

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
                <Link href="/login?type=professor&register=true">
                  <button className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-xl shadow-primary/30 hover:bg-primary/90 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group">
                    Área do Professor
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
                  { label: 'Sem cartão de crédito', icon: Check },
                  { label: 'Configuração rápida', icon: Check },
                  { label: 'Suporte especializado', icon: Check }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                      <item.icon size={12} strokeWidth={3} />
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
              <div className="absolute inset-0 bg-primary/30 blur-[80px] rounded-3xl -z-10 transform scale-90"></div>
              
              <div className="relative rounded-3xl border border-border/50 bg-card/40 backdrop-blur-3xl p-2 shadow-2xl overflow-hidden group">
                <img 
                  src="/mockup.png" 
                  alt="MusicPro Dashboard Mockup" 
                  className="rounded-2xl w-full h-auto shadow-inner group-hover:scale-[1.01] transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent pointer-events-none"></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CLIENTS SECTION */}
      <section className="py-16 border-y border-border/50 bg-muted/30">
        <div className="container text-center">
          <p className="text-sm font-bold text-muted-foreground/80 uppercase tracking-widest mb-10">
            Mais de 1.000 escolas confiam no MusicPro
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
            {['Conservatório', 'Fábrica de Músicos', 'Harmonia', 'Nota Certa', 'Vivace'].map((name) => (
              <span key={name} className="text-2xl font-black text-muted-foreground tracking-tighter hover:text-primary transition-colors cursor-default">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-24 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
        <div className="container relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-primary font-black tracking-widest uppercase text-sm mb-4">Recursos completos</h2>
            <h3 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6">Tudo que sua escola precisa</h3>
            <p className="text-lg text-muted-foreground leading-relaxed font-medium">
              Ferramentas poderosas para simplificar a gestão e potencializar seus resultados, criadas especificamente para o universo musical.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { 
                title: 'Gestão de Alunos', 
                desc: 'Cadastre, organize e acompanhe o progresso dos seus alunos de forma simples e eficiente.', 
                icon: Users
              },
              { 
                title: 'Agenda de Aulas', 
                desc: 'Agende aulas, gerencie horários e salas disponíveis com um calendário intuitivo.', 
                icon: Calendar
              },
              { 
                title: 'Financeiro Completo', 
                desc: 'Controle mensalidades, recebimentos, despesas e gere relatórios financeiros detalhados.', 
                icon: DollarSign
              },
              { 
                title: 'Relatórios Inteligentes', 
                desc: 'Visualize dados importantes da sua escola com relatórios completos e gráficos interativos.', 
                icon: BarChart3
              },
              { 
                title: 'Lembretes Automáticos', 
                desc: 'Envie lembretes de aulas e cobranças automaticamente via WhatsApp ou e-mail.', 
                icon: Bell
              },
              { 
                title: 'Controle de Instrumentos', 
                desc: 'Gerencie instrumentos, salas e recursos da sua escola de forma organizada.', 
                icon: Guitar
              }
            ].map((feature, idx) => (
              <motion.div 
                key={idx}
                {...fadeIn}
                transition={{ delay: idx * 0.1 }}
                className="p-8 rounded-[32px] bg-card border border-border/50 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 group cursor-default"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-inner">
                  <feature.icon size={28} />
                </div>
                <h4 className="text-xl font-bold text-foreground mb-3">{feature.title}</h4>
                <p className="text-muted-foreground leading-relaxed mb-6 font-medium">
                  {feature.desc}
                </p>
                <div className="flex items-center gap-2 text-sm font-bold text-primary group-hover:gap-3 transition-all">
                  Saiba mais <ArrowRight size={16} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* STATISTICS SECTION */}
      <section className="py-24 bg-muted/30 border-y border-border/50 relative">
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
                className="p-10 rounded-[32px] bg-background border border-border/50 shadow-xl shadow-black/5 text-center group hover:border-primary/30 hover:-translate-y-2 transition-all duration-300"
              >
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6 text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-inner">
                  <stat.icon size={36} strokeWidth={2.5} />
                </div>
                <div className="text-5xl font-black text-foreground mb-3">{stat.value}</div>
                <div className="text-muted-foreground font-bold uppercase tracking-widest text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      <section id="testimonials" className="py-24 bg-background">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-xs font-bold mb-6">
                Depoimentos
              </div>
              <h3 className="text-4xl md:text-5xl font-extrabold text-foreground mb-8 leading-tight">
                "O MusicPro transformou a gestão da nossa escola. Hoje temos mais tempo para focar no que realmente importa."
              </h3>
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-muted overflow-hidden border-4 border-background shadow-xl">
                  <img src="https://i.pravatar.cc/150?img=11" alt="Carlos Alberto" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-extrabold text-foreground text-lg">Carlos Alberto</div>
                  <div className="text-muted-foreground font-medium">Diretor - Harmonia Escola de Música</div>
                </div>
              </div>

              <div className="flex gap-1 text-amber-500">
                {[1,2,3,4,5].map(i => <Star key={i} size={24} fill="currentColor" />)}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 blur-3xl rounded-full"></div>
              <div className="relative bg-card p-8 md:p-12 rounded-[40px] shadow-2xl border border-border/50 hover:border-primary/20 transition-colors">
                <div className="grid grid-cols-2 gap-8 mb-12">
                  <div className="text-center p-6 bg-muted/50 rounded-3xl border border-border/30">
                    <div className="text-4xl font-black text-primary mb-2">98%</div>
                    <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Satisfação</div>
                  </div>
                  <div className="text-center p-6 bg-muted/50 rounded-3xl border border-border/30">
                    <div className="text-4xl font-black text-primary mb-2">20h</div>
                    <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Economia semanal</div>
                  </div>
                </div>
                <p className="text-muted-foreground italic leading-relaxed mb-8 font-medium text-lg">
                  "Antes tudo era feito em planilhas ou cadernos. Agora temos controle total das mensalidades e a frequência dos alunos em poucos cliques."
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-3">
                    <button className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center hover:bg-muted hover:border-primary/50 text-foreground transition-all">
                      <ArrowRight size={20} className="rotate-180" />
                    </button>
                    <button className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 hover:scale-105 transition-all">
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
      <section id="pricing" className="py-24 bg-muted/30 border-y border-border/50">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-primary font-black tracking-widest uppercase text-sm mb-4">Planos simples e transparentes</h2>
            <h3 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6">Escolha o plano ideal para sua escola</h3>
            <p className="text-lg text-muted-foreground font-medium">
              Todos os planos incluem 7 dias grátis para você testar sem compromisso.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Plano Básico */}
            <motion.div 
              {...fadeIn}
              className="p-10 rounded-[40px] border border-border/50 bg-card hover:border-primary/30 hover:shadow-2xl transition-all duration-300 flex flex-col"
            >
              <h4 className="text-2xl font-extrabold text-foreground mb-2">Básico</h4>
              <p className="text-muted-foreground font-medium mb-8">Ideal para pequenas escolas</p>
              <div className="flex items-baseline gap-1 mb-10">
                <span className="text-lg font-bold text-muted-foreground">R$</span>
                <span className="text-5xl font-black text-foreground tracking-tight">59<span className="text-2xl">,90</span></span>
                <span className="text-muted-foreground font-medium">/mês</span>
              </div>
              <ul className="space-y-5 mb-10 flex-1">
                {['Até 50 alunos', 'Agendamento de aulas', 'Controle financeiro básico', 'Relatórios essenciais'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-muted-foreground font-medium">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login?type=professor&register=true" className="w-full">
                <button className="w-full py-4 rounded-2xl border-2 border-border text-foreground font-bold hover:bg-muted hover:border-primary/50 transition-colors">
                  Testar grátis
                </button>
              </Link>
            </motion.div>

            {/* Plano Profissional */}
            <motion.div 
              {...fadeIn}
              transition={{ delay: 0.2 }}
              className="p-10 rounded-[40px] border-2 border-primary bg-card shadow-2xl shadow-primary/20 relative overflow-hidden flex flex-col transform md:-translate-y-4"
            >
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-indigo-500"></div>
              <div className="absolute top-6 right-6 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg">
                Mais Escolhido
              </div>
              <h4 className="text-2xl font-extrabold text-foreground mb-2 mt-2">Profissional</h4>
              <p className="text-muted-foreground font-medium mb-8">Ideal para escolas em crescimento</p>
              <div className="flex items-baseline gap-1 mb-10">
                <span className="text-lg font-bold text-muted-foreground">R$</span>
                <span className="text-5xl font-black text-foreground tracking-tight">99<span className="text-2xl">,90</span></span>
                <span className="text-muted-foreground font-medium">/mês</span>
              </div>
              <ul className="space-y-5 mb-10 flex-1">
                {['Até 200 alunos', 'Todos os recursos do Básico', 'Relatórios avançados', 'Lembretes automáticos', 'Suporte prioritário'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-foreground font-bold">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-md">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login?type=professor&register=true" className="w-full">
                <button className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-wider hover:bg-white/90 transition-colors">
                  Testar grátis agora
                </button>
              </Link>
            </motion.div>

            {/* Plano Premium */}
            <motion.div 
              {...fadeIn}
              transition={{ delay: 0.4 }}
              className="p-10 rounded-[40px] border border-border/50 bg-card hover:border-primary/30 hover:shadow-2xl transition-all duration-300 flex flex-col"
            >
              <h4 className="text-2xl font-extrabold text-foreground mb-2">Premium</h4>
              <p className="text-muted-foreground font-medium mb-8">Para escolas que querem o melhor</p>
              <div className="flex items-baseline gap-1 mb-10">
                <span className="text-lg font-bold text-muted-foreground">R$</span>
                <span className="text-5xl font-black text-foreground tracking-tight">159<span className="text-2xl">,90</span></span>
                <span className="text-muted-foreground font-medium">/mês</span>
              </div>
              <ul className="space-y-5 mb-10 flex-1">
                {['Alunos ilimitados', 'Todos os recursos do Profissional', 'Personalização completa', 'Suporte dedicado', 'Integrações avançadas'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-muted-foreground font-medium">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login?type=professor&register=true" className="w-full">
                <button className="w-full py-4 rounded-2xl border-2 border-border text-foreground font-bold hover:bg-muted hover:border-primary/50 transition-colors">
                  Falar com consultor
                </button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 bg-background">
        <div className="container">
          <div className="relative bg-card border border-border rounded-[48px] p-12 md:p-24 overflow-hidden shadow-2xl">
            {/* Soft glows instead of harsh hardcoded background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-indigo-500/10 pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
            
            <div className="relative z-10 text-center max-w-4xl mx-auto">
              <h2 className="text-4xl md:text-6xl font-black text-foreground mb-8 leading-tight tracking-tight">
                Pronto para levar sua escola para o <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500">próximo nível?</span>
              </h2>
              <p className="text-xl text-muted-foreground font-medium mb-12 max-w-2xl mx-auto">
                Comece agora mesmo seu teste grátis de 7 dias. Sem cartão de crédito, sem burocracia. Cancele quando quiser.
              </p>
              <Link href="/login?type=professor&register=true">
                <button className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-wider shadow-2xl hover:scale-105 hover:shadow-primary/50 transition-all flex items-center gap-2 mx-auto">
                  Criar conta grátis agora <ArrowRight size={24} />
                </button>
              </Link>
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
                A plataforma definitiva para gestão de escolas de música. Criada por músicos, para músicos. Transforme sua paixão em um negócio organizado.
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
