import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Music, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [code, setCode] = useState("");

  const verifyMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setStatus("success");
    },
    onError: (err: any) => {
      setStatus("error");
      setErrorMsg(err.message || "Erro desconhecido ao verificar e-mail.");
    }
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      verifyMutation.mutate({ token });
    } else {
      // Se não tem token na URL, apenas mostra a tela para digitar
      setStatus("loading"); 
      // Mas o status "loading" aqui é confuso se não está carregando nada. 
      // Vamos mudar o estado inicial para permitir digitação.
    }
  }, []);

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setStatus("loading");
    verifyMutation.mutate({ token: code });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px]" />
      
      <div className="z-10 w-full max-w-md p-6">
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 p-10 rounded-3xl shadow-2xl text-center space-y-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Music className="w-8 h-8 text-white" />
            </div>
          </div>

          {status === "loading" && !code && (
            <div className="space-y-6 py-4 animate-in fade-in duration-500">
               <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Verificação de Conta</h2>
                <p className="text-zinc-400">Insira o código de 6 dígitos enviado para seu e-mail.</p>
              </div>

              <form onSubmit={handleManualVerify} className="space-y-6">
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full bg-zinc-800/50 border border-zinc-700 text-center text-3xl font-mono tracking-[0.5em] py-4 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-700"
                />
                
                <Button 
                  type="submit"
                  disabled={code.length !== 6 || verifyMutation.isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-12 rounded-xl font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                >
                  {verifyMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Verificar Código"
                  )}
                </Button>
              </form>

              <p className="text-xs text-zinc-500 pt-4">
                Não recebeu o e-mail? Verifique sua caixa de spam ou <button onClick={() => setLocation("/login")} className="text-indigo-400 hover:underline">tente novamente</button>.
              </p>
            </div>
          )}

          {status === "loading" && code && (
             <div className="space-y-4 py-8">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
              <h2 className="text-xl font-semibold text-white">Validando código...</h2>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4 py-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">E-mail Verificado!</h2>
              <p className="text-zinc-400 leading-relaxed">
                Sua conta foi ativada com sucesso. Agora você já pode acessar todos os recursos do sistema.
              </p>
              <Button 
                onClick={() => setLocation("/login")}
                className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white h-12 rounded-xl"
              >
                Ir para o Login
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4 py-4 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">Ops! Falha na verificação.</h2>
              <p className="text-zinc-400 leading-relaxed">
                {errorMsg}
              </p>
              <Button 
                onClick={() => {
                  setStatus("loading");
                  setCode("");
                  setErrorMsg("");
                }}
                className="w-full mt-6 bg-zinc-800 hover:bg-zinc-700 text-white h-12 rounded-xl"
              >
                Tentar Outro Código
              </Button>
              <Button 
                onClick={() => setLocation("/login")}
                variant="link"
                className="w-full text-zinc-500 hover:text-zinc-300"
              >
                Voltar para o Login
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
