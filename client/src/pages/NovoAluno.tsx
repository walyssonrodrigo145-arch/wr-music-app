import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { 
  ChevronLeft, 
  Save, 
  X, 
  User, 
  GraduationCap, 
  Phone, 
  Users, 
  FileText,
  Calendar as CalendarIcon,
  Search,
  Check,
  Loader2,
  AlertCircle,
  MapPin,
  Mail,
  UserCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { differenceInYears, parseISO, isValid } from "date-fns";

export default function NovoAluno() {
  const [location, setLocation] = useLocation();

  // Extract student ID from URL: /alunos/:id/editar
  const editMatch = location.match(/^\/alunos\/(\d+)\/editar$/);
  const studentId = editMatch ? Number(editMatch[1]) : null;
  const isEditMode = !!studentId;

  const utils = trpc.useUtils();
  const { data: instruments = [] } = trpc.instruments.list.useQuery();
  const { data: studentData, isLoading: isLoadingStudent } = trpc.students.getForEdit.useQuery(
    { id: studentId! },
    { enabled: isEditMode, staleTime: 0 }
  );

  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    socialName: "",
    birthDate: "",
    gender: "",
    cpf: "",
    rg: "",
    email: "",
    phone: "",
    address: "",
    instrumentId: "",
    level: "iniciante",
    startDate: new Date().toISOString().split('T')[0],
    monthlyFee: "",
    dueDay: "10",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    notes: "",
    temporaryPassword: "",
  });

  // Pre-populate form when editing
  useEffect(() => {
    if (isEditMode && studentData) {
      console.log("[NovoAluno] Populating form with student data:", studentData.name);
      setForm({
        name: studentData.name ?? "",
        socialName: (studentData as any).socialName ?? "",
        birthDate: (studentData as any).birthDate ? String(studentData.birthDate).slice(0, 10) : "",
        gender: (studentData as any).gender ?? "",
        cpf: (studentData as any).cpf ?? "",
        rg: (studentData as any).rg ?? "",
        email: studentData.email ?? "",
        phone: studentData.phone ?? "",
        address: (studentData as any).address ?? "",
        instrumentId: studentData.instrumentId ? String(studentData.instrumentId) : "",
        level: studentData.level ?? "iniciante",
        startDate: studentData.startDate ? String(studentData.startDate).slice(0, 10) : new Date().toISOString().split('T')[0],
        monthlyFee: studentData.monthlyFee ? String(Number(studentData.monthlyFee)) : "",
        dueDay: studentData.dueDay ? String(studentData.dueDay) : "10",
        guardianName: (studentData as any).guardianName ?? "",
        guardianPhone: (studentData as any).guardianPhone ?? "",
        guardianEmail: (studentData as any).guardianEmail ?? "",
        notes: (studentData as any).notes ?? "",
      });

      const bd = (studentData as any).birthDate;
      if (bd) {
        const date = parseISO(String(bd));
        if (isValid(date)) {
          setIsMinor(differenceInYears(new Date(), date) < 18);
        }
      }
    } else if (isEditMode && !isLoadingStudent && studentData === null) {
      toast.error("Aluno não encontrado ou sem permissão de acesso.");
      setLocation("/alunos");
    }
  }, [studentData, isEditMode, isLoadingStudent, setLocation]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isMinor, setIsMinor] = useState(false);

  // Auto-masking for CPF and Phone
  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };

  const handleInputChange = (field: string, value: string) => {
    let maskedValue = value;
    if (field === 'cpf') maskedValue = maskCPF(value);
    if (field === 'phone' || field === 'guardianPhone') maskedValue = maskPhone(value);
    
    setForm(prev => ({ ...prev, [field]: maskedValue }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    if (field === 'birthDate') {
      const date = parseISO(value);
      if (isValid(date)) {
        const age = differenceInYears(new Date(), date);
        setIsMinor(age < 18);
      }
    }
  };

  const createMutation = trpc.students.create.useMutation({
    onSuccess: () => {
      toast.success("Aluno cadastrado com sucesso!");
      utils.students.list.invalidate();
      setLocation("/alunos");
    },
    onError: (e) => {
      toast.error("Erro ao cadastrar aluno: " + e.message);
      setIsSaving(false);
    }
  });

  const updateMutation = trpc.students.update.useMutation({
    onSuccess: () => {
      toast.success("Aluno atualizado com sucesso!");
      utils.students.list.invalidate();
      utils.students.getForEdit.invalidate({ id: studentId! });
      setLocation("/alunos");
    },
    onError: (e) => {
      toast.error("Erro ao atualizar aluno: " + e.message);
      setIsSaving(false);
    }
  });

  const handleSave = async () => {
    // Basic validation
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = "Nome é obrigatório";
    if (!form.phone.trim()) newErrors.phone = "Telefone é obrigatório";
    if (!form.birthDate) newErrors.birthDate = "Data de nascimento é obrigatória";
    
    if (isMinor) {
      if (!form.guardianName.trim()) newErrors.guardianName = "Nome do responsável é obrigatório";
      if (!form.guardianPhone.trim()) newErrors.guardianPhone = "Telefone do responsável é obrigatório";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Por favor, preencha os campos obrigatórios");
      return;
    }

    setIsSaving(true);
    const payload = {
      name: form.name,
      socialName: form.socialName,
      email: form.email,
      phone: form.phone,
      birthDate: form.birthDate,
      gender: form.gender,
      cpf: form.cpf,
      rg: form.rg,
      address: form.address,
      guardianName: form.guardianName,
      guardianPhone: form.guardianPhone,
      guardianEmail: form.guardianEmail,
      instrumentId: form.instrumentId ? Number(form.instrumentId) : undefined,
      level: form.level as any,
      monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : 0,
      dueDay: Number(form.dueDay),
      notes: form.notes,
      temporaryPassword: form.temporaryPassword || undefined,
    };

    if (isEditMode) {
      updateMutation.mutate({ id: studentId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // UI section for Portal Access
  const PortalAccessCard = () => (
    <motion.div variants={cardVariants} className="bg-card rounded-[2rem] p-8 shadow-sm border border-emerald-500/20 bg-emerald-500/5 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-110 transition-transform duration-700 blur-3xl opacity-50" />
      
      <div className="flex items-center gap-4 mb-8 relative z-10">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/10 group-hover:scale-110 transition-transform">
          <UserCheck size={24} />
        </div>
        <div>
          <h3 className="text-lg font-black text-foreground tracking-tight">Portal do Aluno</h3>
          <p className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-[0.2em]">Acesso ao portal</p>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">
            Senha Temporária (mín. 6 caracteres)
          </label>
          <div className="relative group/input">
            <Input 
              placeholder="Defina uma senha inicial" 
              type="password"
              value={form.temporaryPassword}
              onChange={(e) => handleInputChange('temporaryPassword', e.target.value)}
              className="h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-semibold pl-11"
            />
            <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-emerald-500 transition-colors" size={18} />
          </div>
          <p className="text-[10px] text-muted-foreground/70 font-medium px-1">
            O aluno usará o e-mail cadastrado e esta senha para o primeiro acesso.
          </p>
        </div>
      </div>
    </motion.div>
  );

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1 
      }
    }
  };

  const cardVariants: any = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {isEditMode && isLoadingStudent ? (
        <div className="flex items-center justify-center h-screen">
          <Loader2 size={40} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <>
      {/* Header Premium */}
      <header className="bg-card/80 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLocation("/alunos")}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">{isEditMode ? "Editar Aluno" : "Novo Aluno"}</h1>
              <p className="text-sm text-muted-foreground font-medium">{isEditMode ? "Atualize as informações do cadastro do aluno." : "Preencha as informações do aluno para cadastrá-lo no sistema."}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="rounded-xl border-border font-bold text-slate-600 hover:bg-slate-50 h-11 px-6"
              onClick={() => setLocation("/alunos")}
            >
              Cancelar
            </Button>
            <Button 
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold h-11 px-8 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 group"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} className="group-hover:scale-110 transition-transform" />}
              {isEditMode ? "Salvar alterações" : "Salvar aluno"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* Coluna 1 */}
          <div className="space-y-8">
            {/* CARD 1 — Dados Pessoais */}
            <motion.div variants={cardVariants} className="bg-card rounded-[2rem] p-8 shadow-sm border border-border/50 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-110 transition-transform duration-700 blur-3xl opacity-50" />
              
              <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/10">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground tracking-tight">Dados Pessoais</h3>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Informações básicas do aluno</p>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5 ml-1">
                      Nome completo <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative group/input">
                      <Input 
                        placeholder="Ex: walysson Rodrigo" 
                        value={form.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={cn(
                          "h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-semibold pl-11",
                          errors.name && "border-rose-300 bg-rose-50/30 focus:ring-rose-500/10 focus:border-rose-500"
                        )}
                      />
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                    </div>
                    {errors.name && <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 ml-1"><AlertCircle size={10} /> {errors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Nome social (opcional)</label>
                    <div className="relative group/input">
                      <Input 
                        placeholder="Como prefere ser chamado" 
                        value={form.socialName}
                        onChange={(e) => handleInputChange('socialName', e.target.value)}
                        className="h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-semibold pl-11"
                      />
                      <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5 ml-1">
                      Data de nascimento <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative group/input">
                      <Input 
                        type="date" 
                        value={form.birthDate}
                        onChange={(e) => handleInputChange('birthDate', e.target.value)}
                        className={cn(
                          "h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-semibold pl-11 pr-4",
                          errors.birthDate && "border-rose-300 bg-rose-50/30 focus:ring-rose-500/10 focus:border-rose-500"
                        )}
                      />
                      <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                    </div>
                    {errors.birthDate && <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 ml-1"><AlertCircle size={10} /> {errors.birthDate}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Gênero</label>
                    <Select value={form.gender} onValueChange={(v) => handleInputChange('gender', v)}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-semibold px-4">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl p-1">
                        <SelectItem value="masculino" className="rounded-lg font-medium">Masculino</SelectItem>
                        <SelectItem value="feminino" className="rounded-lg font-medium">Feminino</SelectItem>
                        <SelectItem value="outro" className="rounded-lg font-medium">Outro / Prefiro não dizer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">CPF</label>
                    <div className="relative group/input">
                      <Input 
                        placeholder="000.000.000-00" 
                        value={form.cpf}
                        onChange={(e) => handleInputChange('cpf', e.target.value)}
                        className="h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-semibold pl-11"
                      />
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">RG</label>
                    <div className="relative group/input">
                      <Input 
                        placeholder="00.000.000-0" 
                        value={form.rg}
                        onChange={(e) => handleInputChange('rg', e.target.value)}
                        className="h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-semibold pl-11"
                      />
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* CARD 3 — Contato */}
            <motion.div variants={cardVariants} className="bg-card rounded-[2rem] p-8 shadow-sm border border-border/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-110 transition-transform duration-700 blur-3xl opacity-50" />
              
              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/100 text-white flex items-center justify-center shadow-lg shadow-blue-500/10 group-hover:scale-110 transition-transform">
                  <Phone size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground tracking-tight">Contato</h3>
                  <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-[0.2em]">Meios de comunicação</p>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5 ml-1">
                      Telefone / WhatsApp <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative group/input">
                      <Input 
                        placeholder="(00) 00000-0000" 
                        value={form.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        className={cn(
                          "h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-semibold pl-11",
                          errors.phone && "border-rose-300 bg-rose-50/30 focus:ring-rose-500/10 focus:border-rose-500"
                        )}
                      />
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-blue-500 transition-colors" size={18} />
                    </div>
                    {errors.phone && <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 ml-1"><AlertCircle size={10} /> {errors.phone}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">E-mail</label>
                    <div className="relative group/input">
                      <Input 
                        placeholder="email@exemplo.com" 
                        value={form.email}
                        type="email"
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-semibold pl-11"
                      />
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-blue-500 transition-colors" size={18} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Endereço</label>
                  <div className="relative group/input">
                    <Input 
                      placeholder="Rua, número, bairro, cidade - UF" 
                      value={form.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      className="h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-semibold pl-11"
                    />
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-blue-500 transition-colors" size={18} />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Coluna 2 */}
          <div className="space-y-8">
            {/* CARD 2 — Informações Acadêmicas */}
            <motion.div variants={cardVariants} className="bg-card rounded-[2rem] p-8 shadow-sm border border-border/50 hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-500 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-110 transition-transform duration-700 blur-3xl opacity-50" />
              
              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/10 group-hover:scale-110 transition-transform">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground tracking-tight">Acadêmico</h3>
                  <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-[0.2em]">Ensino e aprendizado</p>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Instrumento principal</label>
                    <Select value={form.instrumentId} onValueChange={(v) => handleInputChange('instrumentId', v)}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30 focus:ring-4 focus:ring-violet-500/10 transition-all text-sm font-semibold px-4">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl p-1">
                        {instruments.map(inst => (
                          <SelectItem key={inst.id} value={String(inst.id)} className="rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: inst.color || '#6366f1' }} />
                              <span className="font-medium">{inst.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Nível</label>
                    <Select value={form.level} onValueChange={(v) => handleInputChange('level', v)}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30 focus:ring-4 focus:ring-violet-500/10 transition-all text-sm font-semibold px-4">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl p-1">
                        <SelectItem value="iniciante" className="rounded-lg">
                          <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 border-none font-bold">Iniciante</Badge>
                        </SelectItem>
                        <SelectItem value="intermediario" className="rounded-lg">
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-none font-bold">Intermediário</Badge>
                        </SelectItem>
                        <SelectItem value="avancado" className="rounded-lg">
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none font-bold">Avançado</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Data de início</label>
                    <div className="relative group/input">
                      <Input 
                        type="date" 
                        value={form.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className="h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all text-sm font-semibold pl-11 pr-4"
                      />
                      <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-violet-500 transition-colors" size={18} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Vencimento (Dia)</label>
                    <Select value={form.dueDay} onValueChange={(v) => handleInputChange('dueDay', v)}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30 focus:ring-4 focus:ring-violet-500/10 transition-all text-sm font-semibold px-4">
                        <SelectValue placeholder="Dia" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl p-1">
                        {[5, 10, 15, 20, 25].map(d => (
                          <SelectItem key={d} value={String(d)} className="rounded-lg font-medium">Dia {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Mensalidade (R$)</label>
                  <div className="relative group/input">
                    <Input 
                      placeholder="0,00" 
                      type="number"
                      value={form.monthlyFee}
                      onChange={(e) => handleInputChange('monthlyFee', e.target.value)}
                      className="h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all text-sm font-semibold pl-11"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 font-bold text-sm group-focus-within/input:text-violet-500 transition-colors">R$</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* CARD 4 — Responsável (Conditional) */}
            <AnimatePresence>
              {isMinor && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, scale: 0.95 }}
                  animate={{ height: "auto", opacity: 1, scale: 1 }}
                  exit={{ height: 0, opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card rounded-[2rem] p-8 shadow-sm border border-amber-500/20 bg-amber-500/5 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-500 relative group mb-8">
                    <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
                        <Users size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground tracking-tight">Responsável Legal</h3>
                        <p className="text-[10px] text-amber-600/70 font-bold uppercase tracking-[0.2em]">Obrigatório para menores</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5 ml-1">
                          Nome do responsável <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative group/input">
                          <Input 
                            placeholder="Nome completo do responsável" 
                            value={form.guardianName}
                            onChange={(e) => handleInputChange('guardianName', e.target.value)}
                            className={cn(
                              "h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm font-semibold pl-11",
                              errors.guardianName && "border-rose-300 bg-rose-50/30 focus:ring-rose-500/10 focus:border-rose-500"
                            )}
                          />
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-amber-500 transition-colors" size={18} />
                        </div>
                        {errors.guardianName && <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 ml-1"><AlertCircle size={10} /> {errors.guardianName}</p>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] flex items-center gap-1.5 ml-1">
                            Telefone <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative group/input">
                            <Input 
                              placeholder="(00) 00000-0000" 
                              value={form.guardianPhone}
                              onChange={(e) => handleInputChange('guardianPhone', e.target.value)}
                              className={cn(
                                "h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm font-semibold pl-11",
                                errors.guardianPhone && "border-rose-300 bg-rose-50/30 focus:ring-rose-500/10 focus:border-rose-500"
                              )}
                            />
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-amber-500 transition-colors" size={18} />
                          </div>
                          {errors.guardianPhone && <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 ml-1"><AlertCircle size={10} /> {errors.guardianPhone}</p>}
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">E-mail</label>
                          <div className="relative group/input">
                            <Input 
                              placeholder="email@exemplo.com" 
                              type="email"
                              value={form.guardianEmail}
                              onChange={(e) => handleInputChange('guardianEmail', e.target.value)}
                              className="h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-sm font-semibold pl-11"
                            />
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-amber-500 transition-colors" size={18} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* CARD 5 — Observações */}
            <motion.div variants={cardVariants} className="bg-card rounded-[2rem] p-8 shadow-sm border border-border/50 hover:shadow-xl hover:shadow-slate-500/5 transition-all duration-500 relative group">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-lg shadow-slate-800/20 group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground tracking-tight">Observações</h3>
                  <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-[0.2em]">Informações extras</p>
                </div>
              </div>

              <div className="space-y-2">
                <Textarea 
                  placeholder="Adicione detalhes sobre o aluno, objetivos ou histórico musical..." 
                  className="min-h-[160px] rounded-2xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-slate-800/10 focus:border-slate-800 transition-all text-sm font-semibold p-4 resize-none leading-relaxed shadow-inner"
                  value={form.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  maxLength={500}
                />
                <div className="flex justify-between items-center px-1">
                  <p className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-widest italic">Visível apenas para professores</p>
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest",
                    form.notes.length > 450 ? "text-rose-500" : "text-muted-foreground/70"
                  )}>
                    {form.notes.length} / 500
                  </span>
                </div>
              </div>
            </motion.div>

            {/* CARD 6 — Portal do Aluno (Novo) */}
            {!isEditMode && <PortalAccessCard />}
          </div>
        </motion.div>

        {/* Footer actions mobile */}
        <div className="mt-12 flex items-center justify-center gap-4 lg:hidden pb-10">
           <Button 
              variant="outline" 
              className="rounded-xl border-border font-bold text-slate-600 h-12 px-8"
              onClick={() => setLocation("/alunos")}
            >
              Cancelar
            </Button>
            <Button 
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 px-8 shadow-lg shadow-indigo-500/10"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Check size={18} className="mr-2" />}
              Salvar Aluno
            </Button>
        </div>
      </main>
        </>
      )}
    </div>
  );
}
