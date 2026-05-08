import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MusicLayout } from "./components/MusicLayout";

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

const PageLoader = () => (
  <div className="flex-1 h-full min-h-[50vh] flex flex-col items-center justify-center text-muted-foreground gap-4">
    <Loader2 className="animate-spin text-primary" size={32} />
    <span className="text-xs font-bold uppercase tracking-widest">Carregando...</span>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={Login} />
        <Route>
          <MusicLayout>
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/alunos" component={Alunos} />
                <Route path="/aulas" component={Aulas} />
                <Route path="/instrumentos" component={Instrumentos} />
                <Route path="/relatorios" component={Relatorios} />
                <Route path="/lembretes" component={Lembretes} />
                <Route path="/mensalidades" component={Mensalidades} />
                <Route path="/configuracoes" component={Configuracoes} />
                <Route path="/progresso" component={Progresso} />
                <Route path="/404" component={NotFound} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </MusicLayout>
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
