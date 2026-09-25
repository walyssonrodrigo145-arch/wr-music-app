import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Camera, Loader2, Lock, LogOut, Mail, Phone, Save, ShieldCheck, User } from "lucide-react";

export default function Perfil() {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: profile, isLoading } = trpc.settings.getMyProfile.useQuery();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", bio: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      bio: profile.bio || "",
    });
  }, [profile]);

  const updateAvatarMutation = trpc.settings.updateMyAvatar.useMutation({
    onSuccess: () => {
      toast.success("Foto de perfil atualizada!");
      utils.settings.getMyProfile.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar foto: " + e.message),
  });

  const updateProfileMutation = trpc.settings.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Dados atualizados!");
      utils.settings.getMyProfile.invalidate();
      utils.auth.me.invalidate();
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const updatePasswordMutation = trpc.auth.updateMyPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setPasswordForm({ current: "", next: "", confirm: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAvatarFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 8MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const size = 512;
          const scale = Math.min(1, size / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            toast.error("Falha ao processar a imagem.");
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setAvatarUrl(dataUrl);
          updateAvatarMutation.mutate({ avatar: dataUrl });
        } catch {
          toast.error("Falha ao processar a imagem.");
        }
      };
      img.onerror = () => toast.error("Falha ao ler a imagem.");
      img.src = reader.result as string;
    };
    reader.onerror = () => toast.error("Falha ao ler o arquivo.");
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    updateProfileMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      bio: form.bio.trim() || undefined,
    });
  };

  const handlePassword = () => {
    if (!passwordForm.current) {
      toast.error("Informe a senha atual.");
      return;
    }
    if (passwordForm.next.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    updatePasswordMutation.mutate({ password: passwordForm.next, currentPassword: passwordForm.current });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const displayName = profile?.name || user?.name || "Professor";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const avatarSrc = avatarUrl || profile?.avatar || undefined;
  const isProfessor = profile?.role === "professor";

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 pb-10">
      <div>
        <h1 className="font-outfit text-2xl sm:text-3xl font-black tracking-tight text-foreground">Meu Perfil</h1>
        <p className="text-sm sm:text-base text-muted-foreground font-medium mt-1">
          Gerencie sua foto, seus dados de contato e sua senha de acesso.
        </p>
      </div>

      {/* Cabeçalho do perfil */}
      <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/40 backdrop-blur-xl shadow-2xl shadow-primary/5 p-6 sm:p-8">
        <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group shrink-0">
            <Avatar className="w-24 h-24 sm:w-28 sm:h-28 border-4 border-card shadow-2xl">
              <AvatarImage src={avatarSrc} alt={displayName} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-violet-600 text-white text-2xl font-black">
                {initials}
              </AvatarFallback>
            </Avatar>
            {isProfessor && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    handleAvatarFile(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={updateAvatarMutation.isPending}
                  aria-label="Alterar foto de perfil"
                  title="Alterar foto de perfil"
                  className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
                >
                  {updateAvatarMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                </button>
              </>
            )}
          </div>

          <div className="min-w-0 text-center sm:text-left">
            <h2 className="font-outfit text-xl sm:text-2xl font-extrabold tracking-tight truncate">{displayName}</h2>
            <p className="text-sm text-muted-foreground truncate">{profile?.email || user?.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                <ShieldCheck size={11} /> {isProfessor ? "Professor" : "Administrador"}
              </span>
              {isProfessor && !profile?.avatar && (
                <span className="text-[11px] text-muted-foreground font-medium">Clique na câmera para adicionar sua foto</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="rounded-[2rem] border border-border/60 bg-card/40 backdrop-blur-xl shadow-xl shadow-primary/5 p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2">
          <User size={16} className="text-primary" />
          <h3 className="font-outfit text-base sm:text-lg font-extrabold tracking-tight">Dados pessoais</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Nome completo</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="h-12 rounded-2xl border-border bg-background/60 text-sm"
              placeholder="Seu nome"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">E-mail</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="h-12 rounded-2xl border-border bg-background/60 text-sm pl-10"
                placeholder="voce@escola.com"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">WhatsApp</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="h-12 rounded-2xl border-border bg-background/60 text-sm pl-10"
                placeholder="(00) 00000-0000"
                inputMode="tel"
              />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Bio / apresentação (opcional)</label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              className="rounded-2xl border-border bg-background/60 text-sm resize-none"
              rows={3}
              placeholder="Conte um pouco sobre você e sua atuação musical."
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={updateProfileMutation.isPending}
          className="w-full sm:w-auto h-12 rounded-2xl px-6 font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20"
        >
          {updateProfileMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
          Salvar alterações
        </Button>
      </div>

      {/* Segurança */}
      <div className="rounded-[2rem] border border-border/60 bg-card/40 backdrop-blur-xl shadow-xl shadow-primary/5 p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-primary" />
          <h3 className="font-outfit text-base sm:text-lg font-extrabold tracking-tight">Senha de acesso</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Para trocar a senha, informe a senha atual e a nova senha (mínimo de 6 caracteres).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Senha atual</label>
            <Input
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
              className="h-12 rounded-2xl border-border bg-background/60 text-sm"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Nova senha</label>
            <Input
              type="password"
              value={passwordForm.next}
              onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
              className="h-12 rounded-2xl border-border bg-background/60 text-sm"
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Confirmar nova senha</label>
            <Input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
              className="h-12 rounded-2xl border-border bg-background/60 text-sm"
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handlePassword}
          disabled={updatePasswordMutation.isPending}
          className="w-full sm:w-auto h-12 rounded-2xl px-6 font-black text-xs uppercase tracking-widest"
        >
          {updatePasswordMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Lock size={16} className="mr-2" />}
          Alterar senha
        </Button>
      </div>

      <button
        type="button"
        onClick={() => logout()}
        className={cn(
          "w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest transition-all",
          "border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 flex items-center justify-center gap-2"
        )}
      >
        <LogOut size={16} /> Sair da plataforma
      </button>
    </div>
  );
}
