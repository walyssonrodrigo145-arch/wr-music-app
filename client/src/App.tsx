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

// Lazy loading the pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Alunos = lazy(() => import("./pages/Alunos"));
const Aulas = lazy(() => import("./pages/Aulas"));
const Instrumentos = lazy(() => import("./pages/Instrumentos"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Lembretes = lazy(() => import("./pages/Lembretes"));
const Mensalidades = lazy(() => import("./pages/Mensalidades"));
const Login = lazy(() => import("./pages/Login"));
const Progresso = lazy(() => import("./pages/Progresso"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NovoAluno = lazy(() => import("./pages/NovoAluno"));

// Student Portal Pages
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const StudentLessons = lazy(() => import("./pages/student/Aulas"));
const StudentMaterials = lazy(() => import("./pages/student/Materiais"));
const StudentExercises = lazy(() => import("./pages/student/Exercicios"));
const StudentProgress = lazy(() => import("./pages/student/Progresso"));
const StudentPayments = lazy(() => import("./pages/student/Pagamentos"));
const StudentProfile = lazy(() => import("./pages/student/Perfil"));
const StudentAgenda = lazy(() => import("./pages/student/Agenda"));
const StudentMessages = lazy(() => import("./pages/student/Mensagens"));
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

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public Routes */}
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={Login} />
        
        {!isAuthenticated ? (
          <Route>
            <Redirect to="/login" />
          </Route>
        ) : user?.role === "aluno" ? (
          /* Student Routes */
          <Route path="/aluno/:rest*">
            <StudentPortalLayout>
              <Suspense fallback={<PageLoader />}>
                <Switch>
                  <Route path="/aluno" component={StudentDashboard} />
                  <Route path="/aluno/aulas" component={StudentLessons} />
                  <Route path="/aluno/agenda" component={StudentAgenda} />
                  <Route path="/aluno/materiais" component={StudentMaterials} />
                  <Route path="/aluno/exercicios" component={StudentExercises} />
                  <Route path="/aluno/progresso" component={StudentProgress} />
                  <Route path="/aluno/mensagens" component={StudentMessages} />
                  <Route path="/aluno/pagamentos" component={StudentPayments} />
                  <Route path="/aluno/perfil" component={StudentProfile} />
                  <Route path="/aluno/avisos" component={StudentAnnouncements} />
                  <Route path="/aluno/solicitar-reposicao" component={StudentRequestMakeUp} />
                  <Route path="/aluno/solicitar-remarcacao" component={StudentRequestReschedule} />
                  <Route component={() => <Redirect to="/aluno" />} />
                </Switch>
              </Suspense>
            </StudentPortalLayout>
          </Route>
        ) : (
          /* Admin/Professor Routes */
          <Route>
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
                  <Route path="/mensalidades" component={Mensalidades} />
                  <Route path="/configuracoes" component={Configuracoes} />
                  <Route path="/progresso" component={Progresso} />
                  <Route component={() => <Redirect to="/dashboard" />} />
                </Switch>
              </Suspense>
            </MusicLayout>
          </Route>
        )}
        
        {/* Default Redirect if authenticated but path not caught */}
        <Route>
          {isAuthenticated ? (
            user?.role === "aluno" ? <Redirect to="/aluno" /> : <Redirect to="/dashboard" />
          ) : (
            <Redirect to="/login" />
          )}
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
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
