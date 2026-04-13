import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { MusicLayout } from "./components/MusicLayout";
import Dashboard from "./pages/Dashboard";
import Alunos from "./pages/Alunos";
import Aulas from "./pages/Aulas";
import Instrumentos from "./pages/Instrumentos";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Lembretes from "./pages/Lembretes";
import Mensalidades from "./pages/Mensalidades";
import Login from "./pages/Login";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>

        <MusicLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/alunos" component={Alunos} />
            <Route path="/aulas" component={Aulas} />
            <Route path="/instrumentos" component={Instrumentos} />
            <Route path="/relatorios" component={Relatorios} />
            <Route path="/lembretes" component={Lembretes} />
            <Route path="/mensalidades" component={Mensalidades} />
            <Route path="/configuracoes" component={Configuracoes} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </MusicLayout>
      </Route>
    </Switch>
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
