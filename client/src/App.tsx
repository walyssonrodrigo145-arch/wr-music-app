import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch, Redirect, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingScreen from "./components/LoadingScreen";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MusicLayout } from "./components/MusicLayout";
import { StudentPortalLayout } from "./components/StudentPortalLayout";
import { useAuth } from "@/hooks/useAuth";
import { useBotStatusSSE } from "@/hooks/useBotStatusSSE";
import { isSeoContentPath } from "@shared/seo";

// Lazy loading the pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Alunos = lazy(() => import("./pages/Alunos"));
const Aulas = lazy(() => import("./pages/Aulas"));
const Instrumentos = lazy(() => import("./pages/Instrumentos"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Assinatura = lazy(() => import("./pages/Assinatura"));
const Lembretes = lazy(() => import("./pages/Lembretes"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Login = lazy(() => import("./pages/Login"));
const Progresso = lazy(() => import("./pages/Progresso"));
const RankingsPage = lazy(() => import("./pages/Rankings"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const PublicReferralPage = lazy(() => import("./pages/indicacao/PublicReferralPage"));
const SeoSite = lazy(() => import("./pages/SeoSite"));
const Migracao = lazy(() => import("./pages/Migracao"));
const ReferralProgram = lazy(() => import("./pages/indicacao/ReferralProgram"));
const ReferralAdmin = lazy(() => import("./pages/indicacao/ReferralAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NovoAluno = lazy(() => import("./pages/NovoAluno"));
const Comunicados = lazy(() => import("./pages/Comunicados"));
const MarketingDashboard = lazy(() => import("@/pages/marketing/MarketingDashboard"));
const CreateCampaign = lazy(() => import("@/pages/marketing/CreateCampaign"));
const CampaignDetails = lazy(() => import("@/pages/marketing/CampaignDetails"));

const Solicitacoes = lazy(() => import("./pages/Solicitacoes"));
const Reposicoes = lazy(() => import("./pages/Reposicoes"));
const IAAssistente = lazy(() => import("./pages/IAAssistente"));
const ProfessorExtract = lazy(() => import("./pages/ProfessorExtract"));
const RecepcaoQRCode = lazy(() => import("./pages/RecepcaoQRCode"));
const QRScanner = lazy(() => import("./pages/QRScanner"));
const Automacoes = lazy(() => import("./pages/Automacoes"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const AnalyticsDashboard = lazy(() => import('./pages/analytics/AnalyticsDashboard'));
const LeadsApp = lazy(() => import('./pages/leads/LeadsApp'));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const SalasEstudio = lazy(() => import("./pages/SalasEstudio"));
const ChatbotFlowBuilder = lazy(() => import("./pages/ChatbotFlowBuilder"));
const BaseConhecimentoIA = lazy(() => import("./pages/BaseConhecimentoIA"));
const Contratos = lazy(() => import("./pages/Contratos"));
const NotasFiscais = lazy(() => import("./pages/NotasFiscais"));
const Tutoriais = lazy(() => import("./pages/Tutoriais"));
const Novidades = lazy(() => import("./pages/Novidades"));
const Professores = lazy(() => import("./pages/Professores"));
const Perfil = lazy(() => import("./pages/Perfil"));

// Student Portal Pages
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const StudentLessons = lazy(() => import("./pages/student/Aulas"));
const StudentMaterials = lazy(() => import("./pages/student/Materiais"));
const StudentExercises = lazy(() => import("./pages/student/Exercicios"));
const StudentProgress = lazy(() => import("./pages/student/Progresso"));
const StudentPayments = lazy(() => import("./pages/student/Pagamentos"));
const StudentProfile = lazy(() => import("./pages/student/Perfil"));
const StudentAgenda = lazy(() => import("./pages/student/Agenda"));

const StudentAnnouncements = lazy(() => import("./pages/student/Avisos"));
const StudentContracts = lazy(() => import("./pages/student/Contratos"));
const StudentResults = lazy(() => import("./pages/student/Resultados"));

const PageLoader = () => <LoadingScreen />;

function AssinaturaAdminOnly() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user && user.role !== "admin") return <Redirect to="/dashboard" />;
  return <Assinatura />;
}

const PublicEnrollmentPage = lazy(() => import("./pages/PublicEnrollment"));

function Router() {
  const { user, isAuthenticated, loading } = useAuth();
  const [currentPath] = useLocation();
  const host = typeof window !== "undefined" ? window.location.hostname : "";

  // Rota pública de matrícula — acessível independente de autenticação
  if (currentPath.startsWith("/matricula/")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/matricula/:code" component={PublicEnrollmentPage} />
        </Switch>
      </Suspense>
    );
  }

  // Landing pública do Programa Indique & Ganhe — acessível logado ou deslogado
  if (currentPath.startsWith("/indicacao/")) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/indicacao/:codigo" component={PublicReferralPage} />
        </Switch>
      </Suspense>
    );
  }

  if (loading) return <PageLoader />;

  // Site público de conteúdo (SEO): funcionalidades, planos, comparativos, blog e glossário
  // — acessível logado ou deslogado, com meta tags e links internos próprios.
  if (isSeoContentPath(currentPath)) {
    return (
      <Suspense fallback={<PageLoader />}>
        <SeoSite />
      </Suspense>
    );
  }

  // Se o acesso for via subdomínio leads.wrmusicpro.com.br ou rota /leads
  const isLeadsHost =
    host.startsWith("leads.") ||
    (typeof window !== "undefined" &&
      (window.location.search.includes("leads=true") || window.location.pathname === "/leads"));

  if (isLeadsHost) {
    if (!isAuthenticated) {
      return (
        <Suspense fallback={<PageLoader />}>
          <Login />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<PageLoader />}>
        <LeadsApp />
      </Suspense>
    );
  }

  // Se o acesso for via subdomínio analytics.wrmusicpro.com.br ou rota /analytics
  const isAnalyticsHost =
    host.startsWith("analytics.") ||
    (typeof window !== "undefined" &&
      (window.location.search.includes("analytics=true") || window.location.pathname === "/analytics"));

  if (isAnalyticsHost) {
    if (!isAuthenticated) {
      return (
        <Suspense fallback={<PageLoader />}>
          <Login />
        </Suspense>
      );
    }
    // Renderiza EXCLUSIVAMENTE o Dashboard de Analytics (sem barra lateral da escola ou do aluno)
    return (
      <Suspense fallback={<PageLoader />}>
        <AnalyticsDashboard />
      </Suspense>
    );
  }

  // Redirect unauthenticated users to login, except for landing page
  if (!isAuthenticated) {
    const isNativeApp = typeof window !== "undefined" && (window.location.protocol.includes("capacitor") || window.location.origin.includes("localhost"));
    
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={isNativeApp ? Login : LandingPage} />
          <Route path="/login" component={Login} />
          <Route path="/cadastro" component={Cadastro} />
          <Route path="/termos-de-uso" component={TermosDeUso} />
          <Route path="/politica-de-privacidade" component={PoliticaPrivacidade} />
          <Route>
            <Redirect to="/login" />
          </Route>
        </Switch>
      </Suspense>
    );
  }

  // Redirect Alunos trying to access Admin pages
  if (user?.role === "aluno") {
    return (
      <StudentPortalLayout>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/aluno" component={StudentDashboard} />
            <Route path="/aluno/aulas" component={StudentLessons} />
            <Route path="/aluno/agenda" component={StudentAgenda} />
            <Route path="/aluno/materiais" component={StudentMaterials} />
            <Route path="/aluno/exercicios" component={StudentExercises} />
            <Route path="/aluno/progresso" component={StudentProgress} />
            <Route path="/aluno/resultados" component={StudentResults} />

            <Route path="/aluno/pagamentos" component={StudentPayments} />
            <Route path="/aluno/perfil" component={StudentProfile} />
            <Route path="/aluno/avisos" component={StudentAnnouncements} />
            <Route path="/aluno/contratos" component={StudentContracts} />
            <Route path="/aluno/scanner" component={QRScanner} />
            <Route>
              <Redirect to="/aluno" />
            </Route>
          </Switch>
        </Suspense>
      </StudentPortalLayout>
    );
  }

  // Admin/Professor Paywall Logic
  const trialEndsAt = user?.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const isTrialExpired = trialEndsAt ? trialEndsAt < new Date() : false;
  
  const isHardBlocked = isTrialExpired;
  const isSubscriptionActive = user?.subscriptionStatus === "active";
  
  // Concede acesso se a assinatura estiver ativa OU se o trial ainda estiver válido
  const hasAccess = isSubscriptionActive || (trialEndsAt && !isHardBlocked);

  if (!hasAccess) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
           <Route path="/checkout" component={Checkout} />
           <Route>
             <Redirect to="/checkout" />
           </Route>
        </Switch>
      </Suspense>
    );
  }

  // Admin/Professor Routes
  return (
    <MusicLayout>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/alunos" component={Alunos} />
          <Route path="/professores" component={Professores} />
          <Route path="/alunos/novo" component={NovoAluno} />
          <Route path="/alunos/:id/editar" component={NovoAluno} />
          <Route path="/aulas" component={Aulas} />
          <Route path="/reposicoes" component={Reposicoes} />
          <Route path="/instrumentos" component={Instrumentos} />
          <Route path="/relatorios" component={Relatorios} />
          <Route path="/lembretes" component={Lembretes} />
          <Route path="/financeiro" component={Financeiro} />
          <Route path="/configuracoes" component={Configuracoes} />
          <Route path="/perfil" component={Perfil} />
          <Route path="/assinatura" component={AssinaturaAdminOnly} />
          <Route path="/progresso" component={Progresso} />
          <Route path="/rankings" component={RankingsPage} />
          <Route path="/comunicados" component={Comunicados} />
          <Route path="/marketing" component={MarketingDashboard} />
          <Route path="/marketing/nova" component={CreateCampaign} />
          <Route path="/marketing/:id" component={CampaignDetails} />
          <Route path="/automacoes" component={Automacoes} />
          <Route path="/chatbot-fluxo" component={ChatbotFlowBuilder} />
          <Route path="/fluxo-chatbot" component={ChatbotFlowBuilder} />
          <Route path="/base-conhecimento-ia" component={BaseConhecimentoIA} />
          <Route path="/ia-conhecimento" component={BaseConhecimentoIA} />
          <Route path="/solicitacoes" component={Solicitacoes} />
          <Route path="/ia" component={IAAssistente} />
          <Route path="/folha" component={ProfessorExtract} />
          <Route path="/recepcao-qr" component={RecepcaoQRCode} />
          <Route path="/scanner" component={QRScanner} />
          <Route path="/master-panel" component={SuperAdmin} />
          <Route path="/programa-indicacao" component={ReferralAdmin} />
          <Route path="/indicacoes" component={ReferralProgram} />
          <Route path="/migracao" component={Migracao} />
          <Route path="/analytics" component={AnalyticsDashboard} />
          <Route path="/comercial" component={LeadsApp} />
          <Route path="/leads" component={LeadsApp} />
          <Route path="/contratos" component={Contratos} />
          <Route path="/tutoriais" component={Tutoriais} />
          <Route path="/novidades" component={Novidades} />
          <Route path="/salas" component={SalasEstudio} />
          <Route path="/salas-estudio" component={SalasEstudio} />
          <Route path="/checkout" component={Checkout} />
          <Route>
            <Redirect to="/dashboard" />
          </Route>
        </Switch>
      </Suspense>
    </MusicLayout>
  );
}

import { TourProvider } from "./components/tour/TourProvider";
import { WelcomeModal } from "./components/tour/WelcomeModal";
import { WhatsNewProvider } from "./components/novidades/WhatsNewProvider";
import { WhatsNewModal } from "./components/novidades/WhatsNewModal";
import { initAnalytics, trackPageView } from "./lib/analytics";
import { useEffect } from "react";

// Initialize analytics outside of the component tree to run once on load
initAnalytics();

import { setAnalyticsUser } from "./lib/analytics";

function AppTracking() {
  const [location] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      setAnalyticsUser(user.id, user.name, user.role);
    }
  }, [user]);

  useEffect(() => {
    trackPageView(location);
  }, [location]);

  return null;
}

import { ImpersonationBanner } from "./components/ImpersonationBanner";

function BootLoaderDismiss() {
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const el = document.getElementById("boot-loader");
    if (!el) return;
    const wait = Math.max(0, 400 - performance.now());
    const timer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        el.classList.add("bl-hide");
        window.setTimeout(() => el.remove(), 450);
      });
    }, wait);
    return () => window.clearTimeout(timer);
  }, [loading]);

  return null;
}

function App() {
  // Escuta eventos SSE do bot e exibe toast quando a sessão WhatsApp cair
  useBotStatusSSE();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <TourProvider>
            <WhatsNewProvider>
              <AppTracking />
              <BootLoaderDismiss />
              <WelcomeModal />
              <WhatsNewModal />
              <ImpersonationBanner />
              <Router />
            </WhatsNewProvider>
          </TourProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
