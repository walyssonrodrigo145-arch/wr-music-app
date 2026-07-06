import React, { createContext, useContext, useState, useEffect } from "react";
import { Joyride, CallBackProps, STATUS, EVENTS, ACTIONS, Step } from "react-joyride";
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
    setRunTour(true);
  };

  const stopTour = () => {
    setRunTour(false);
    setStepIndex(0);
  };

  useEffect(() => {
    if (runTour) {
      document.body.classList.add('tour-active');
    } else {
      document.body.classList.remove('tour-active');
    }
    return () => document.body.classList.remove('tour-active');
  }, [runTour]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type, step } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRunTour(false);
      setStepIndex(0);
      if (!hasSeenTutorial) {
        completeTutorial.mutate();
      }
    } else if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      
      if (action === ACTIONS.NEXT && step.data?.navigateTo) {
        setLocation(step.data.navigateTo);
      }
      
      setStepIndex(nextStepIndex);
    }
  };

  return (
    <TourContext.Provider value={{ runTour, startTour, stopTour, hasSeenTutorial, setHasSeenTutorial }}>
      {children}
      <Joyride
        steps={tourSteps}
        run={runTour}
        stepIndex={stepIndex}
        callback={handleJoyrideCallback}
        continuous={true}
        showProgress={true}
        showSkipButton={true}
        disableOverlayClose={true}
        spotlightClicks={false}
        locale={{
          back: 'Voltar',
          close: 'Fechar',
          last: 'Finalizar',
          next: 'Próximo',
          skip: 'Pular Tutorial',
        }}
        styles={{
          options: {
            primaryColor: '#8b5cf6', // Violet 500 do tailwind (combinando c/ MusicPro)
            textColor: '#333',
            zIndex: 10000,
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          buttonNext: {
            backgroundColor: '#8b5cf6',
            borderRadius: '6px',
          },
          buttonBack: {
            color: '#8b5cf6',
          }
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
