import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { useTour } from "./TourProvider";
import { trpc } from "@/lib/trpc";

export function WelcomeModal() {
  const { hasSeenTutorial, setHasSeenTutorial, startTour } = useTour();
  const completeTutorial = trpc.auth.completeTutorial.useMutation({
    onSuccess: () => {
      setHasSeenTutorial(true);
    }
  });

  const handleStart = () => {
    startTour();
  };

  const handleSkip = () => {
    completeTutorial.mutate();
  };

  return (
    <AlertDialog open={!hasSeenTutorial}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold flex items-center gap-2">
            Bem-vindo(a)! 👋
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base mt-2">
            Percebemos que este é seu primeiro acesso. Gostaria de conhecer rapidamente todas as funcionalidades da plataforma através de um tutorial guiado?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex gap-2 sm:justify-center">
          <AlertDialogCancel onClick={handleSkip} className="w-full sm:w-auto">
            Agora Não
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleStart} className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700">
            Iniciar Tutorial
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
