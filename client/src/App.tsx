import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MusicLayout } from "./components/MusicLayout";
import { StudentPortalLayout } from "./components/StudentPortalLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBotStatusSSE } from "@/hooks/useBotStatusSSE";

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
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NovoAluno = lazy(() => import("./pages/NovoAluno"));
const Comunicados = lazy(() => import("./pages/Comunicados"));

const Solicitacoes = lazy(() => import("./pages/Solicitacoes"));
const IAAssistente = lazy(() => import("./pages/IAAssistente"));
const ProfessorExtract = lazy(() => import("./pages/ProfessorExtract"));
const RecepcaoQRCode = lazy(() => import("./pages/RecepcaoQRCode"));
const QRScanner = lazy(() => import("./pages/QRScanner"));
const Automacoes = lazy(() => import("./pages/Automacoes"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));

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
const StudentRequestMakeUp = lazy(() => import("./pages/student/SolicitarReposicao"));
const StudentRequestReschedule = lazy(() => import("./pages/student/SolicitarRemarcacao"));

const PageLoader = () => (
  <div className="flex-1 h-full min-h-[50vh] flex flex-col items-center justify-center text-muted-foreground gap-4">
    <Loader2 className="animate-spin text-primary" size={32} />
    <span className="text-xs font-bold uppercase tracking-widest text-primary/60">Carregando MusicPro...</span>
  </div>
);

function Router() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <PageLoader />;

  // Redirect unauthenticated users to login, except for landing page
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/login" component={Login} />
          <Route path="/cadastro" component={Cadastro} />
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

            <Route path="/aluno/pagamentos" component={StudentPayments} />
            <Route path="/aluno/perfil" component={StudentProfile} />
            <Route path="/aluno/avisos" component={StudentAnnouncements} />
            <Route path="/aluno/solicitar-reposicao" component={StudentRequestMakeUp} />
            <Route path="/aluno/solicitar-remarcacao" component={StudentRequestReschedule} />
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
  
  // 3 dias de tolerância (carência) após o fim do trial
  const hardBlockDate = trialEndsAt ? new Date(trialEndsAt.getTime() + 3 * 24 * 60 * 60 * 1000) : null;
  const isHardBlocked = hardBlockDate ? hardBlockDate < new Date() : false;

  const isSubscriptionActive = user?.subscriptionStatus === "active";
  
  // Concede acesso se a assinatura estiver ativa OU se ainda não passou a carência de 3 dias do trial
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
          <Route path="/alunos/novo" component={NovoAluno} />
          <Route path="/alunos/:id/editar" component={NovoAluno} />
          <Route path="/aulas" component={Aulas} />
          <Route path="/instrumentos" component={Instrumentos} />
          <Route path="/relatorios" component={Relatorios} />
          <Route path="/lembretes" component={Lembretes} />
          <Route path="/financeiro" component={Financeiro} />
          <Route path="/configuracoes" component={Configuracoes} />
          <Route path="/assinatura" component={Assinatura} />
          <Route path="/progresso" component={Progresso} />
          <Route path="/comunicados" component={Comunicados} />

          <Route path="/automacoes" component={Automacoes} />
          <Route path="/solicitacoes" component={Solicitacoes} />
          <Route path="/ia" component={IAAssistente} />
          <Route path="/folha" component={ProfessorExtract} />
          <Route path="/recepcao-qr" component={RecepcaoQRCode} />
          <Route path="/scanner" component={QRScanner} />
          <Route path="/master-panel" component={SuperAdmin} />
          <Route path="/checkout" component={Checkout} />
          <Route>
            <Redirect to="/dashboard" />
          </Route>
        </Switch>
      </Suspense>
    </MusicLayout>
  );
}

function App() {
  // Escuta eventos SSE do bot e exibe toast quando a sessão WhatsApp cair
  useBotStatusSSE();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
