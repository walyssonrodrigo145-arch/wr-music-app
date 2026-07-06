import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { Joyride, EventData, EVENTS, STATUS, ACTIONS, Step } from "react-joyride";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { tourSteps } from "./tourSteps";

interface TourContextType {
  runTour: boolean;
  startTour: () => void;
  stopTour: () => void;
  hasSeenTutorial: boolean;
  setHasSeenTutorial: (value: boolean) => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);
  // Pausa o Joyride durante navegação entre páginas para evitar tela cinza
  const [isNavigating, setIsNavigating] = useState(false);
  const pendingStepIndex = useRef<number | null>(null);
  const [, setLocation] = useLocation();

  const { data: user } = trpc.auth.me.useQuery(undefined, {
    staleTime: Infinity,
  });

  const completeTutorial = trpc.auth.completeTutorial.useMutation({
    onSuccess: () => {
      setHasSeenTutorial(true);
    }
  });

  useEffect(() => {
    if (user && user.hasSeenTutorial === false) {
      setHasSeenTutorial(false);
    }
  }, [user]);

  const startTour = () => {
    setStepIndex(0);
    setIsNavigating(false);
    pendingStepIndex.current = null;
    setRunTour(true);
  };

  const stopTour = () => {
    setRunTour(false);
    setStepIndex(0);
    setIsNavigating(false);
    pendingStepIndex.current = null;
  };

  useEffect(() => {
    if (runTour) {
      document.body.classList.add('tour-active');
    } else {
      document.body.classList.remove('tour-active');
    }
    return () => document.body.classList.remove('tour-active');
  }, [runTour]);

  // Quando isNavigating, aguarda 700ms para o DOM da nova página renderizar, depois retoma
  useEffect(() => {
    if (!isNavigating) return;

    const timer = setTimeout(() => {
      setIsNavigating(false);
      if (pendingStepIndex.current !== null) {
        setStepIndex(pendingStepIndex.current);
        pendingStepIndex.current = null;
        // Reativa o tour após a página ter renderizado
        setRunTour(true);
      }
    }, 750);

    return () => clearTimeout(timer);
  }, [isNavigating]);

  const handleJoyrideCallback = (data: EventData) => {
    const { action, index, status, type, step } = data as EventData & { step: Step & { data?: { navigateTo?: string } } };

    // Tour finalizado ou pulado
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRunTour(false);
      setStepIndex(0);
      setIsNavigating(false);
      pendingStepIndex.current = null;
      if (!hasSeenTutorial) {
        completeTutorial.mutate();
      }
      return;
    }

    // Avança/volta entre steps
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);

      // Se o próximo step requer navegação para outra página
      if (action === ACTIONS.NEXT && (step as Step & { data?: { navigateTo?: string } }).data?.navigateTo) {
        const navigateTo = (step as Step & { data?: { navigateTo?: string } }).data!.navigateTo!;
        // 1. Pausa o Joyride — evita tela cinza sem spotlight
        setRunTour(false);
        // 2. Navega para a nova rota
        setLocation(navigateTo);
        // 3. Guarda qual step deve ser exibido após a navegação
        pendingStepIndex.current = nextStepIndex;
        // 4. Ativa o estado de navegação — o useEffect acima vai reativar após 750ms
        setIsNavigating(true);
        return;
      }

      setStepIndex(nextStepIndex);
    }
  };

  // O tour só roda quando não está navegando
  const shouldRun = runTour && !isNavigating;

  return (
    <TourContext.Provider value={{ runTour, startTour, stopTour, hasSeenTutorial, setHasSeenTutorial }}>
      {children}
      <Joyride
        steps={tourSteps}
        run={shouldRun}
        stepIndex={stepIndex}
        onEvent={handleJoyrideCallback}
        continuous={true}
        scrollToFirstStep={true}
        locale={{
          back: 'Voltar',
          close: 'Fechar',
          last: 'Finalizar',
          next: 'Próximo',
          skip: 'Pular Tutorial',
        }}
        options={{
          primaryColor: '#8b5cf6',
          textColor: '#333',
          zIndex: 10000,
          overlayColor: 'rgba(0, 0, 0, 0.55)',
          overlayClickAction: false,
          showProgress: true,
          spotlightRadius: 8,
          skipBeacon: true,
          buttons: ['back', 'primary', 'skip'],
        }}
        styles={{
          tooltipContainer: {
            textAlign: 'left',
          },
          buttonPrimary: {
            backgroundColor: '#8b5cf6',
            borderRadius: '6px',
          },
          buttonBack: {
            color: '#8b5cf6',
          },
          buttonSkip: {
            color: '#6b7280',
          },
        }}
      />
    </TourContext.Provider>
  );
}

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
};
