import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, AlertCircle, ArrowRight, Loader2, Mail, CheckCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (err) => setErrorMsg(err.message)
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setSuccessMsg(data.message || "Conta criada com sucesso! Você já pode entrar.");
      setIsRegistering(false);
      setEmail("");
      setPassword("");
      setName("");
    },
    onError: (err) => setErrorMsg(err.message)
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (isRegistering) {
      if (!name.trim()) return setErrorMsg("Por favor, informe seu nome completo.");
      if (!email.trim()) return setErrorMsg("O e-mail é obrigatório para criar sua conta.");
      if (!emailRegex.test(email)) return setErrorMsg("Por favor, insira um e-mail válido.");
      if (!password) return setErrorMsg("Crie uma senha para sua segurança.");
      if (password.length < 6) return setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
      if (!registrationToken.trim()) return setErrorMsg("O Token de Segurança é obrigatório.");
      
      registerMutation.mutate({ 
        name: name.trim(), 
        email: email.trim(), 
        password,
        registrationToken: registrationToken.trim()
      });
    } else {
      if (!email.trim()) return setErrorMsg("Informe seu e-mail para entrar.");
      if (!emailRegex.test(email)) return setErrorMsg("O formato do e-mail parece incorreto.");
      if (!password) return setErrorMsg("A senha é necessária para o acesso.");
      
      loginMutation.mutate({ email: email.trim(), password, rememberMe });
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px]" />
      
      <div className="z-10 w-full max-w-md p-6">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-indigo-500/20">
            <Music className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            {isRegistering ? "Crie sua conta" : "Acesse sua conta"}
          </h1>
          <p className="text-zinc-400 mt-2">
            Gestão inteligente para sua escola de música
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 p-8 rounded-3xl shadow-2xl space-y-6">
          {successMsg ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-semibold text-white">Quase lá!</h2>
              <p className="text-zinc-400 leading-relaxed">
                {successMsg}
              </p>
              <Button 
                onClick={() => setSuccessMsg("")}
                variant="outline"
                className="mt-4 border-zinc-700 text-zinc-300 hover:text-white"
              >
                Voltar para Login
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                {errorMsg && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p>{errorMsg}</p>
                  </div>
                )}

                {isRegistering && (
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Seu Nome</Label>
                    <Input 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: João Silva" 
                      className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-indigo-500 text-zinc-100 h-12"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-zinc-300">E-mail</Label>
                  <Input 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email" 
                    placeholder="seu@email.com" 
                    className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-indigo-500 text-zinc-100 h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-zinc-300">Senha</Label>
                  <Input 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password" 
                    placeholder="••••••" 
                    className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-indigo-500 text-zinc-100 h-12"
                  />
                </div>

                {isRegistering && (
                  <div className="space-y-2">
                    <Label className="text-zinc-300">Token de Segurança</Label>
                    <Input 
                      value={registrationToken}
                      onChange={(e) => setRegistrationToken(e.target.value)}
                      type="password"
                      placeholder="Digite o token de acesso" 
                      className="bg-zinc-950/50 border-zinc-800 focus-visible:ring-indigo-500 text-zinc-100 h-12"
                    />
                    <p className="text-[10px] text-zinc-500 px-1">
                      Este token é obrigatório para autorizar seu acesso exclusivo.
                    </p>
                  </div>
                )}
                
                {!isRegistering && (
                  <div className="flex items-center space-x-2 px-1">
                    <Checkbox 
                      id="remember" 
                      checked={rememberMe} 
                      onCheckedChange={(checked) => setRememberMe(!!checked)}
                      className="border-zinc-700 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                    />
                    <label 
                      htmlFor="remember" 
                      className="text-xs font-medium text-zinc-400 cursor-pointer select-none hover:text-zinc-300 transition-colors"
                    >
                      Mantenha-me conectado
                    </label>
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-medium text-base rounded-xl border-0 shadow-lg shadow-indigo-500/25 transition-all duration-300"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="flex items-center">
                      {isRegistering ? "Criar Conta" : "Entrar"}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-zinc-900/50 px-2 text-zinc-500">ou continue com</span>
                </div>
              </div>

              <Button 
                type="button"
                variant="outline"
                onClick={handleGoogleLogin}
                className="w-full h-12 border-zinc-800 bg-white/5 hover:bg-white/10 text-zinc-200 transition-all duration-200"
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Google
              </Button>

              <div className="mt-8 text-center text-sm text-zinc-400">
                {isRegistering ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
                <button 
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  {isRegistering ? "Fazer Login" : "Criar uma agora"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

