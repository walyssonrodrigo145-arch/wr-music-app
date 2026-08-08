import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { validateCPF } from "@/lib/cpf";
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
  UserCheck,
  Pencil,
  Bot,
  Info,
  CalendarDays,
  CalendarRange,
  RefreshCw,
  Clock,
  Timer,
  CheckCircle2,
  AlertTriangle
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";

const nameRegex = /^[a-zA-ZáàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ\s]+$/;

export default function NovoAluno() {
  const [location, setLocation] = useLocation();

  // Extract student ID from URL: /alunos/:id/editar
  const editMatch = location.match(/^\/alunos\/(\d+)\/editar$/);
  const studentId = editMatch ? Number(editMatch[1]) : null;
  const isEditMode = !!studentId;

  const utils = trpc.useUtils();
  const { data: instruments = [] } = trpc.instruments.list.useQuery();
  const { data: professores = [] } = trpc.professores.list.useQuery();
  const { data: studentData, isLoading: isLoadingStudent } = trpc.students.getForEdit.useQuery(
    { id: studentId! },
    { enabled: isEditMode, staleTime: 0 }
  );
  const { data: settings } = trpc.settings.get.useQuery(undefined, { staleTime: 60000 });

  // ─── Estado das abas ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"dados" | "agendar">("dados");

  // ─── Estado do formulário de agendamento ──────────────────────────────────────
  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    time: "09:00",
    duration: 60,
    instrumentId: "",
    notes: "",
    weeksCount: 1,
    lessonsPerWeek: 1,
    weeklySlots: [
      { dayOfWeek: 1, time: "09:00", studioRoomId: "" }
    ] as Array<{ dayOfWeek: number; time: string; studioRoomId: string }>,
  });
  const [scheduleStep, setScheduleStep] = useState<"form" | "conflicts">("form");
  const [batchItems, setBatchItems] = useState<any[]>([]);
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({}); 

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
    professorId: "",
    instrumentId: "",
    level: "iniciante",
    startDate: new Date().toISOString().split('T')[0],
    monthlyFee: "",
    billingPeriodicity: "mensal",
    dueDay: "10",
    lessonType: "individual",
    onlineMeetingLink: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    notes: "",
    temporaryPassword: "",
    avatar: "",
    allowAutoReminders: true,
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
        professorId: studentData.professorId ? String(studentData.professorId) : "",
        instrumentId: studentData.instrumentId ? String(studentData.instrumentId) : "",
        level: studentData.level ?? "iniciante",
        startDate: studentData.startDate ? String(studentData.startDate).slice(0, 10) : new Date().toISOString().split('T')[0],
        monthlyFee: studentData.monthlyFee ? String(Number(studentData.monthlyFee)) : "",
        billingPeriodicity: (studentData as any).billingPeriodicity ?? "mensal",
        dueDay: studentData.dueDay ? String(studentData.dueDay) : "10",
        lessonType: (studentData as any).lessonType ?? "individual",
        onlineMeetingLink: (studentData as any).onlineMeetingLink ?? "",
        guardianName: (studentData as any).guardianName ?? "",
        guardianPhone: (studentData as any).guardianPhone ?? "",
        guardianEmail: (studentData as any).guardianEmail ?? "",
        notes: (studentData as any).notes ?? "",
        temporaryPassword: "",
        avatar: (studentData as any).avatar ?? "",
        allowAutoReminders: (studentData as any).allowAutoReminders ?? true,
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

  const uploadAvatarMutation = trpc.musicLibrary.upload.useMutation();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return toast.error("A foto deve ter no máximo 2MB");
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const { url } = await uploadAvatarMutation.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          base64Data: base64
        });
        setForm(prev => ({ ...prev, avatar: url }));
        toast.success("Foto carregada com sucesso!");
      } catch (err) {
        toast.error("Erro ao carregar foto");
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

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
    let clean = value.replace(/\D/g, "");
    if (!clean) return "";
    
    let prefix = "";
    if (clean.startsWith("55") && clean.length > 11) {
      prefix = "+55 ";
      clean = clean.substring(2);
    }
    
    if (clean.length <= 2) {
      return prefix + clean;
    }
    
    if (clean.length <= 6) {
      return prefix + `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
    }
    
    if (clean.length <= 10) {
      return prefix + `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    
    return prefix + `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
  };

  const handleInputChange = (field: string | React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, value?: string) => {
    if (typeof field !== 'string') {
        const { name, value: eValue } = field.target;
        setForm(prev => ({ ...prev, [name]: eValue }));
        return;
    }

    if (value === "none") value = "";

    let maskedValue = value || "";
    if (field === 'cpf') maskedValue = maskCPF(value || "");
    if (field === 'phone' || field === 'guardianPhone') maskedValue = maskPhone(value || "");
    
    setForm(prev => ({ ...prev, [field]: maskedValue }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    if (field === 'birthDate') {
      const date = parseISO(value || "");
      if (isValid(date)) {
        const age = differenceInYears(new Date(), date);
        setIsMinor(age < 18);
      }
    }
  };

  const createMutation = trpc.students.create.useMutation({
    onSuccess: (data) => {
      toast.success("Aluno cadastrado! Agora você pode agendar a primeira aula.");
      utils.students.list.invalidate();
      // Redireciona para edição do aluno recém-criado para que a aba "Agendar Aula" fique disponível
      if (data?.studentId) {
        setLocation(`/alunos/${data.studentId}/editar`);
      } else {
        setLocation("/alunos");
      }
    },
    onError: (e) => {
      let msg = e.message;
      try {
        if (msg.startsWith('[') && msg.endsWith(']')) {
          const parsed = JSON.parse(msg);
          if (Array.isArray(parsed)) {
            msg = parsed.map((err: any) => err.message).join(", ");
          }
        }
      } catch {}
      
      if (msg.includes("unique constraint") || msg.includes("duplicate key")) {
        msg = "Este registro já existe (e-mail ou CPF duplicado).";
      } else if (msg.includes("foreign key constraint")) {
        msg = "Não foi possível realizar esta ação devido a dependências de outros registros.";
      }
      
      toast.error("Erro ao cadastrar aluno: " + msg);
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
      let msg = e.message;
      try {
        if (msg.startsWith('[') && msg.endsWith(']')) {
          const parsed = JSON.parse(msg);
          if (Array.isArray(parsed)) {
            msg = parsed.map((err: any) => err.message).join(", ");
          }
        }
      } catch {}
      
      if (msg.includes("unique constraint") || msg.includes("duplicate key")) {
        msg = "Este registro já existe (e-mail ou CPF duplicado).";
      } else if (msg.includes("foreign key constraint")) {
        msg = "Não foi possível realizar esta ação devido a dependências de outros registros.";
      }
      
      toast.error("Erro ao atualizar aluno: " + msg);
      setIsSaving(false);
    }
  });

  const generateContractMutation = trpc.contracts.create.useMutation({
    onSuccess: (data) => {
      toast.success("Contrato gerado com sucesso!");
      if (data.contract?.zapsignSignUrl) {
        window.open(data.contract.zapsignSignUrl, '_blank');
      }
    },
    onError: (e) => toast.error(`Erro ao gerar contrato: ${e.message}`)
  });

  // ─── Agendamento de aulas ─────────────────────────────────────────────────────

  // Query de aulas do aluno (ativa quando em modo edição ou na aba agendar)
  const { data: studentLessons = [], refetch: refetchStudentLessons } = trpc.lessons.list.useQuery(
    undefined,
    { enabled: isEditMode, staleTime: 0 }
  );
  const studentUpcomingLessons = isEditMode
    ? studentLessons.filter((l: any) => l.studentId === studentId && l.status === "agendada")
        .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .slice(0, 5)
    : [];

  // Query lazy de verificação de conflitos (recorrência)
  const checkConflicts = trpc.lessons.checkConflicts.useQuery(
    (() => {
      try {
        const [y, M, d] = scheduleForm.date.split("-").map(Number);
        const [h, m] = scheduleForm.time.split(":").map(Number);
        const date = new Date(y, M - 1, d, h, m, 0, 0);
        return {
          scheduledAt: date.toISOString(),
          duration: scheduleForm.duration,
          weeksCount: scheduleForm.weeksCount,
          studioRoomId: undefined as any,
        };
      } catch {
        return { scheduledAt: new Date().toISOString(), duration: 60, weeksCount: 1, studioRoomId: undefined as any };
      }
    })(),
    { enabled: false }
  );

  // Mutation: agendar 1 aula avulsa
  const createLessonMutation = trpc.lessons.create.useMutation({
    onSuccess: () => {
      toast.success("✅ Aula agendada com sucesso!");
      utils.lessons.list.invalidate();
      utils.lessons.listRange?.invalidate();
      utils.dashboard.stats?.invalidate();
      setScheduleForm(prev => ({
        ...prev,
        title: "",
        notes: "",
        weeksCount: 1,
      }));
      setScheduleStep("form");
      setBatchItems([]);
      refetchStudentLessons();
    },
    onError: (e) => toast.error("Erro ao agendar aula: " + e.message),
  });

  // Mutation: agendar N aulas recorrentes (batch)
  const createBatchLessonMutation = trpc.lessons.createBatch.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ ${data.count} aula(s) agendada(s) com sucesso!`);
      utils.lessons.list.invalidate();
      utils.lessons.listRange?.invalidate();
      utils.dashboard.stats?.invalidate();
      setScheduleForm(prev => ({
        ...prev,
        title: "",
        notes: "",
        weeksCount: 1,
      }));
      setScheduleStep("form");
      setBatchItems([]);
      refetchStudentLessons();
    },
    onError: (e) => toast.error("Erro ao agendar aulas: " + e.message),
  });

  const buildScheduledAt = () => {
    const [y, M, d] = scheduleForm.date.split("-").map(Number);
    const [h, m] = scheduleForm.time.split(":").map(Number);
    return new Date(y, M - 1, d, h, m, 0, 0);
  };

  const handleScheduleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!scheduleForm.title.trim()) errs.title = "Título obrigatório";
    if (!scheduleForm.date) errs.date = "Data obrigatória";
    if (!scheduleForm.time) errs.time = "Horário obrigatório";
    if (Object.keys(errs).length > 0) { setScheduleErrors(errs); return; }
    setScheduleErrors({});

    const instrument = instruments.find((i: any) => i.id.toString() === scheduleForm.instrumentId);
    const submissionTitle = scheduleForm.title || (instrument ? `Aula de ${instrument.name}` : "Aula de Música");
    const scheduledDate = buildScheduledAt();

    if (scheduleForm.weeksCount <= 1) {
      // Aula avulsa
      createLessonMutation.mutate({
        studentId: studentId!,
        title: submissionTitle,
        scheduledAt: scheduledDate.toISOString(),
        duration: scheduleForm.duration,
        instrumentId: scheduleForm.instrumentId ? Number(scheduleForm.instrumentId) : null,
        notes: scheduleForm.notes,
      });
    } else {
      // Aula recorrente: verificar conflitos primeiro
      try {
        const allItems: Array<{ scheduledAt: string }> = [];
        const [startY, startM, startD] = scheduleForm.date.split("-").map(Number);
        const slotsToUse = (scheduleForm.weeklySlots && scheduleForm.weeklySlots.length > 0)
          ? scheduleForm.weeklySlots
          : [{ dayOfWeek: new Date(startY, startM - 1, startD).getDay(), time: scheduleForm.time, studioRoomId: "" }];

        for (let w = 0; w < scheduleForm.weeksCount; w++) {
          for (const slot of slotsToUse) {
            const baseDate = new Date(startY, startM - 1, startD);
            const baseDay = baseDate.getDay();
            let dayDiff = slot.dayOfWeek - baseDay;
            if (dayDiff < 0) dayDiff += 7;

            const targetDate = new Date(baseDate);
            targetDate.setDate(baseDate.getDate() + (w * 7) + dayDiff);
            const [sh, sm] = slot.time.split(":").map(Number);
            targetDate.setHours(sh, sm, 0, 0);

            allItems.push({ scheduledAt: targetDate.toISOString() });
          }
        }

        const conflicts = await checkConflicts.refetch();
        if (conflicts.data) {
          const hasAny = conflicts.data.some((c: any) => c.hasConflict);
          if (hasAny) {
            setBatchItems(conflicts.data.map((c: any) => ({
              scheduledAt: c.date,
              hasConflict: c.hasConflict,
              conflictingWith: c.conflictingWith,
              force: false,
            })));
            setScheduleStep("conflicts");
          } else {
            createBatchLessonMutation.mutate({
              studentId: studentId!,
              title: submissionTitle,
              duration: scheduleForm.duration,
              instrumentId: scheduleForm.instrumentId ? Number(scheduleForm.instrumentId) : null,
              notes: scheduleForm.notes,
              items: allItems.map(item => ({ scheduledAt: item.scheduledAt, force: false })),
            });
          }
        }
      } catch {
        toast.error("Erro ao verificar conflitos de horário.");
      }
    }
  };

  const handleConfirmBatch = () => {
    const instrument = instruments.find((i: any) => i.id.toString() === scheduleForm.instrumentId);
    const submissionTitle = scheduleForm.title || (instrument ? `Aula de ${instrument.name}` : "Aula de Música");
    createBatchLessonMutation.mutate({
      studentId: studentId!,
      title: submissionTitle,
      duration: scheduleForm.duration,
      instrumentId: scheduleForm.instrumentId ? Number(scheduleForm.instrumentId) : null,
      notes: scheduleForm.notes,
      items: batchItems.map(item => ({ scheduledAt: item.scheduledAt, force: item.force })),
    });
  };

  // Auto-preencher título quando instrumento ou nome do aluno mudar
  useEffect(() => {
    if (!isEditMode) return;
    const instrument = instruments.find((i: any) => i.id.toString() === form.instrumentId);
    if (instrument && form.name) {
      setScheduleForm(prev => ({
        ...prev,
        instrumentId: form.instrumentId,
        title: prev.title || `Aula de ${instrument.name} - ${form.name}`,
      }));
    }
  }, [form.instrumentId, form.name, instruments, isEditMode]);

  // Ao abrir aba de agendamento, buscar aulas existentes do aluno
  useEffect(() => {
    if (activeTab === "agendar" && isEditMode) {
      refetchStudentLessons();
    }
  }, [activeTab, isEditMode]);


  const handleSave = async () => {
    // Basic validation
    const newErrors: Record<string, string> = {};
    
    // Name validation
    if (!form.name.trim()) {
      newErrors.name = "Nome é obrigatório";
    }

    // Phone validation (optional - only validate format if filled)
    const cleanPhone = form.phone.replace(/\D/g, "");
    if (form.phone.trim() && (cleanPhone.length < 10 || cleanPhone.length > 11)) {
      newErrors.phone = "Telefone deve ter 10 ou 11 dígitos";
    } else if (form.phone.trim() && /^0+$/.test(cleanPhone)) {
      newErrors.phone = "Telefone inválido (não pode conter apenas zeros)";
    }

    // CPF validation
    const cpfError = validateCPF(form.cpf);
    if (cpfError) {
      newErrors.cpf = cpfError;
    }

    // RG validation
    const cleanRG = form.rg.replace(/[^a-zA-Z0-9]/g, "");
    if (cleanRG) {
      if (cleanRG.length < 5) {
        newErrors.rg = "RG deve ter pelo menos 5 caracteres";
      } else if (/^0+$/.test(cleanRG)) {
        newErrors.rg = "RG inválido (não pode conter apenas zeros)";
      }
    }

    // Guardian validations (only if minor AND fields are filled)
    if (isMinor) {
      // Guardian name is optional even for minors now
      if (form.guardianName.trim() && !nameRegex.test(form.guardianName.trim())) {
        newErrors.guardianName = "O nome do responsável deve conter apenas letras";
      }

      const cleanGuardianPhone = form.guardianPhone.replace(/\D/g, "");
      if (form.guardianPhone.trim() && (cleanGuardianPhone.length < 10 || cleanGuardianPhone.length > 11)) {
        newErrors.guardianPhone = "Telefone do responsável deve ter 10 ou 11 dígitos";
      } else if (form.guardianPhone.trim() && /^0+$/.test(cleanGuardianPhone)) {
        newErrors.guardianPhone = "Telefone do responsável inválido (não pode conter apenas zeros)";
      }
    } else {
      // If not minor, but guardianPhone is filled, validate it
      const cleanGuardianPhone = form.guardianPhone.replace(/\D/g, "");
      if (cleanGuardianPhone) {
        if (cleanGuardianPhone.length < 10 || cleanGuardianPhone.length > 11) {
          newErrors.guardianPhone = "Telefone do responsável deve ter 10 ou 11 dígitos";
        } else if (/^0+$/.test(cleanGuardianPhone)) {
          newErrors.guardianPhone = "Telefone do responsável inválido (não pode conter apenas zeros)";
        }
      }
      if (form.guardianName.trim() && !nameRegex.test(form.guardianName.trim())) {
        newErrors.guardianName = "O nome do responsável deve conter apenas letras";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Por favor, verifique os campos destacados em vermelho.");
      return;
    }

    setIsSaving(true);
    const parseFee = (val: string) => {
      // Support both "150,00" (BR) and "150.00" (EN) formats
      const normalized = val.replace(',', '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
    };

    const payload: any = {
      name: form.name.trim(),
      socialName: form.socialName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.replace(/\D/g, ""),
      birthDate: form.birthDate || undefined,
      gender: form.gender || undefined,
      cpf: form.cpf || undefined,
      rg: form.rg || undefined,
      address: form.address || undefined,
      guardianName: form.guardianName.trim() || undefined,
      guardianPhone: form.guardianPhone.replace(/\D/g, "") || undefined,
      guardianEmail: form.guardianEmail.trim() || undefined,
      instrumentId: form.instrumentId ? Number(form.instrumentId) : undefined,
      professorId: form.professorId ? Number(form.professorId) : undefined,
      level: form.level as "iniciante" | "intermediario" | "avancado",
      monthlyFee: parseFee(form.monthlyFee),
      billingPeriodicity: form.billingPeriodicity as any,
      dueDay: Number(form.dueDay) || 10,
      lessonType: form.lessonType as any,
      onlineMeetingLink: form.onlineMeetingLink?.trim() || undefined,
      startDate: form.startDate,
      notes: form.notes,
      temporaryPassword: form.temporaryPassword || undefined,
      avatar: form.avatar || undefined,
      allowAutoReminders: form.allowAutoReminders,
    };

    if (isEditMode) {
      updateMutation.mutate({ id: studentId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // MH-006: Atalho Ctrl+S para salvar o formulário
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);


  // UI section for Portal Access
  const renderPortalAccessCard = () => (
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
          {form.email?.toLowerCase().endsWith('@gmail.com') ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-sm font-bold text-emerald-700">Acesso via Google Detectado</p>
              <p className="text-xs text-emerald-600 mt-1">Como o e-mail cadastrado é um @gmail.com, o aluno poderá fazer login diretamente clicando em "Entrar com Google". Nenhuma senha temporária é necessária.</p>
            </div>
          ) : (
            <>
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
            </>
          )}
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
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
            {isEditMode && (
              <Button 
                variant="outline" 
                className="rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 h-11 px-4 md:px-6 flex items-center gap-2 flex-1 md:flex-none"
                onClick={() => generateContractMutation.mutate({ studentId: studentId! })}
                disabled={generateContractMutation.isPending}
              >
                {generateContractMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                <span className="whitespace-nowrap">Gerar Contrato</span>
              </Button>
            )}
            <Button 
              variant="outline" 
              className="rounded-xl border-border font-bold text-slate-600 hover:bg-slate-50 h-11 px-4 md:px-6 flex-1 md:flex-none"
              onClick={() => setLocation("/alunos")}
            >
              Cancelar
            </Button>
            <Button 
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold h-11 px-6 md:px-8 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 group w-full md:w-auto"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} className="group-hover:scale-110 transition-transform" />}
              {isEditMode ? "Salvar alterações" : "Salvar aluno"}
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Tab Navigation (Navegação Permanente por Abas) ─── */}
      <div className="bg-card/60 backdrop-blur-md border-b border-border mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("dados")}
              className={cn(
                "flex items-center gap-2 px-4 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                activeTab === "dados"
                  ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <User size={16} />
              Dados do Aluno
            </button>
            <button
              onClick={() => setActiveTab("agendar")}
              className={cn(
                "flex items-center gap-2 px-4 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap",
                activeTab === "agendar"
                  ? "border-violet-600 text-violet-600 bg-violet-50/50 dark:bg-violet-950/20"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays size={16} />
              Agendar Aula
            </button>
          </div>
        </div>
      </div>

      {/* ─── Aba: Dados do Aluno ─── */}
      {(!isEditMode || activeTab === "dados") && (
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
              
              <div className="flex items-center gap-4 mb-8 relative z-10">
                <div className="relative shrink-0">
                  <Avatar className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/10 border-2 border-background">
                    <AvatarImage src={form.avatar} className="object-cover" />
                    <AvatarFallback className="bg-indigo-600 text-white font-bold uppercase text-xl">
                      {form.name ? form.name.substring(0, 2) : <User size={24} />}
                    </AvatarFallback>
                  </Avatar>
                  <input 
                    type="file" 
                    ref={avatarInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleAvatarChange} 
                  />
                  <button 
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-card border-2 border-border shadow-sm flex items-center justify-center text-indigo-600 cursor-pointer z-10 hover:bg-indigo-50 transition-colors"
                  >
                    {uploadAvatarMutation.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Pencil size={12} />
                    )}
                  </button>
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
                      Data de nascimento
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
                    <p className="text-[10px] font-semibold text-amber-600/90 dark:text-amber-400/90 flex items-center gap-1 ml-1 pt-0.5">
                      <Info size={12} className="shrink-0 text-amber-500" />
                      Ao informar a data de nascimento de um aluno menor de idade (-18 anos), os campos do responsável financeiro serão exibidos automaticamente.
                    </p>
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
                        className={cn(
                          "h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-semibold pl-11",
                          errors.cpf && "border-rose-300 bg-rose-50/30 focus:ring-rose-500/10 focus:border-rose-500"
                        )}
                      />
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                    </div>
                    {errors.cpf && <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 ml-1"><AlertCircle size={10} /> {errors.cpf}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">RG</label>
                    <div className="relative group/input">
                      <Input 
                        placeholder="00.000.000-0" 
                        value={form.rg}
                        onChange={(e) => handleInputChange('rg', e.target.value)}
                        className={cn(
                          "h-12 rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm font-semibold pl-11",
                          errors.rg && "border-rose-300 bg-rose-50/30 focus:ring-rose-500/10 focus:border-rose-500"
                        )}
                      />
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within/input:text-indigo-500 transition-colors" size={18} />
                    </div>
                    {errors.rg && <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 ml-1"><AlertCircle size={10} /> {errors.rg}</p>}
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
                {/* Linha 1: Instrumento e Nível */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

                {/* Linha 2: Professor e Data de Início */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Professor Responsável</label>
                    <Select value={form.professorId} onValueChange={(v) => handleInputChange('professorId', v)}>
                      <SelectTrigger className="h-12 rounded-xl border-border bg-muted/30 focus:ring-4 focus:ring-violet-500/10 transition-all text-sm font-semibold px-4">
                        <SelectValue placeholder="Selecione (Opcional)" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl p-1">
                        <SelectItem value="none" className="rounded-lg">
                           <span className="font-medium text-muted-foreground">Nenhum</span>
                        </SelectItem>
                        {professores.map((prof: any) => (
                          <SelectItem key={prof.id} value={String(prof.userId)} className="rounded-lg">
                            <span className="font-medium">{prof.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
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
                </div>

                {/* Linha 3: Cobrança - Valor e Periodicidade */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 w-full">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Valor / Mensalidade (R$)</label>
                    <div className="relative group/input w-full">
                      <Input 
                        placeholder="0,00" 
                        value={form.monthlyFee}
                        onChange={(e) => handleInputChange('monthlyFee', e.target.value)}
                        className="h-12 w-full rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all text-sm font-semibold pl-11"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 font-bold text-sm group-focus-within/input:text-violet-500 transition-colors">R$</span>
                    </div>
                  </div>
                  <div className="space-y-2 w-full">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Periodicidade de Cobrança</label>
                    <Select value={form.billingPeriodicity} onValueChange={(v) => setForm(prev => ({ ...prev, billingPeriodicity: v }))}>
                      <SelectTrigger className="h-12 w-full rounded-xl border-border bg-muted/30 focus:ring-4 focus:ring-violet-500/10 transition-all text-sm font-semibold px-4 truncate">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl p-1">
                        <SelectItem value="mensal" className="rounded-lg font-medium">Mensal (1 em 1 mês)</SelectItem>
                        <SelectItem value="bimestral" className="rounded-lg font-medium">Bimestral (2 em 2 meses)</SelectItem>
                        <SelectItem value="trimestral" className="rounded-lg font-medium">Trimestral (3 em 3 meses)</SelectItem>
                        <SelectItem value="semestral" className="rounded-lg font-medium">Semestral (6 em 6 meses)</SelectItem>
                        <SelectItem value="anual" className="rounded-lg font-medium">Anual (12 em 12 meses)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Linha 4: Dia de Vencimento e Tipo de Aula */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 w-full">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Vencimento (Dia)</label>
                    <Select value={String(form.dueDay)} onValueChange={(v) => setForm(prev => ({ ...prev, dueDay: v }))}>
                      <SelectTrigger className="h-12 w-full rounded-xl border-border bg-muted/30 focus:ring-4 focus:ring-violet-500/10 transition-all text-sm font-semibold px-4">
                        <SelectValue placeholder="Dia" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl p-1">
                        {[5, 10, 15, 20].map(d => (
                          <SelectItem key={d} value={String(d)} className="rounded-lg font-medium">Dia {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 w-full">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Tipo de Aula</label>
                    <Select value={form.lessonType} onValueChange={(v) => handleInputChange('lessonType', v)}>
                      <SelectTrigger className="h-12 w-full rounded-xl border-border bg-muted/30 focus:ring-4 focus:ring-violet-500/10 transition-all text-sm font-semibold px-4">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border shadow-2xl p-1">
                        <SelectItem value="individual" className="rounded-lg font-medium">Individual</SelectItem>
                        <SelectItem value="turma" className="rounded-lg font-medium">Turma / Coletiva</SelectItem>
                        <SelectItem value="online" className="rounded-lg font-medium">🌐 Online (Zoom, Meet, etc.)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.lessonType === 'online' && (
                    <div className="space-y-2 md:col-span-2 w-full">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Link da Reunião Online</label>
                      <Input
                        placeholder="https://meet.google.com/xxx ou https://zoom.us/j/xxx"
                        value={form.onlineMeetingLink || ''}
                        onChange={(e) => handleInputChange('onlineMeetingLink', e.target.value)}
                        className="h-12 w-full rounded-xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all text-sm font-semibold"
                      />
                    </div>
                  )}
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

            {/* CARD 5.5 — Automações */}
            <motion.div variants={cardVariants} className="bg-card rounded-[2rem] p-8 shadow-sm border border-border/50 hover:shadow-xl hover:shadow-slate-500/5 transition-all duration-500 relative group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/10 group-hover:scale-110 transition-transform">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground tracking-tight">Lembretes Automáticos</h3>
                  <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-[0.2em]">WhatsApp & Robô</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                <div>
                  <p className="text-sm font-bold text-foreground">Permitir mensagens automáticas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Se desativado, o aluno não receberá lembretes automáticos de cobrança, aula ou treinos via WhatsApp.</p>
                </div>
                <Switch 
                  checked={form.allowAutoReminders}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, allowAutoReminders: checked }))}
                />
              </div>
            </motion.div>

            {/* CARD 6 — Portal do Aluno (Novo) */}
            {!isEditMode && renderPortalAccessCard()}
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
      )}

      {/* ─── Aba: Agendar Aula ─── */}
      {activeTab === "agendar" && (
        <main className="max-w-3xl mx-auto px-6 py-8">
          <AnimatePresence mode="wait">

            {/* ─ Formulário de Agendamento ─ */}
            {scheduleStep === "form" && (
              <motion.div
                key="schedule-form"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {/* Card principal */}
                <div className="bg-card rounded-[2rem] p-8 shadow-sm border border-border/50 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 rounded-full -translate-y-20 translate-x-20 blur-3xl opacity-50" />
                  <div className="flex items-center gap-4 mb-8 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
                      <CalendarDays size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-foreground tracking-tight">Nova Aula</h3>
                      <p className="text-[10px] text-violet-600/70 font-bold uppercase tracking-[0.2em]">Agendamento para {form.name || "este aluno"}</p>
                    </div>
                  </div>

                  <div className="space-y-5 relative z-10">
                    {/* Título */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Título da Aula *</label>
                      <Input
                        value={scheduleForm.title}
                        onChange={e => setScheduleForm(p => ({ ...p, title: e.target.value }))}
                        placeholder={`Aula de ${instruments.find((i: any) => i.id.toString() === scheduleForm.instrumentId)?.name ?? "Música"} - ${form.name}`}
                        className={cn("h-12 rounded-xl text-sm font-semibold", scheduleErrors.title && "border-red-500")}
                      />
                      {scheduleErrors.title && <p className="text-xs text-red-500 ml-1">{scheduleErrors.title}</p>}
                    </div>

                    {/* Data + Horário */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Data *</label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={scheduleForm.date}
                            onChange={e => setScheduleForm(p => ({ ...p, date: e.target.value }))}
                            className={cn("h-12 rounded-xl pl-10 text-sm font-semibold", scheduleErrors.date && "border-red-500")}
                          />
                          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        </div>
                        {scheduleErrors.date && <p className="text-xs text-red-500 ml-1">{scheduleErrors.date}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Horário *</label>
                        <div className="relative">
                          <Input
                            type="time"
                            value={scheduleForm.time}
                            onChange={e => setScheduleForm(p => ({ ...p, time: e.target.value }))}
                            className={cn("h-12 rounded-xl pl-10 text-sm font-semibold", scheduleErrors.time && "border-red-500")}
                          />
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        </div>
                        {scheduleErrors.time && <p className="text-xs text-red-500 ml-1">{scheduleErrors.time}</p>}
                      </div>
                    </div>

                    {/* Duração + Instrumento */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Duração</label>
                        <Select
                          value={String(scheduleForm.duration)}
                          onValueChange={v => setScheduleForm(p => ({ ...p, duration: Number(v) }))}
                        >
                          <SelectTrigger className="h-12 rounded-xl">
                            <div className="flex items-center gap-2">
                              <Timer size={14} className="text-muted-foreground" />
                              <SelectValue />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 minutos</SelectItem>
                            <SelectItem value="45">45 minutos</SelectItem>
                            <SelectItem value="60">60 minutos</SelectItem>
                            <SelectItem value="90">90 minutos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Instrumento</label>
                        <Select
                          value={scheduleForm.instrumentId}
                          onValueChange={v => setScheduleForm(p => ({ ...p, instrumentId: v }))}
                        >
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {instruments.map((inst: any) => (
                              <SelectItem key={inst.id} value={String(inst.id)}>{inst.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Recorrência */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Recorrência Semanal</label>
                      <Select
                        value={String(scheduleForm.weeksCount)}
                        onValueChange={v => setScheduleForm(p => ({ ...p, weeksCount: Number(v) }))}
                      >
                        <SelectTrigger className="h-12 rounded-xl">
                          <div className="flex items-center gap-2">
                            <RefreshCw size={14} className="text-muted-foreground" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 vez (aula avulsa)</SelectItem>
                          <SelectItem value="4">4 semanas (~1 mês)</SelectItem>
                          <SelectItem value="8">8 semanas (~2 meses)</SelectItem>
                          <SelectItem value="12">12 semanas (~3 meses)</SelectItem>
                          <SelectItem value="26">26 semanas (~6 meses)</SelectItem>
                          <SelectItem value="52">52 semanas (~1 ano)</SelectItem>
                          <SelectItem value="104">104 semanas (~2 anos)</SelectItem>
                        </SelectContent>
                      </Select>
                      {scheduleForm.weeksCount > 1 && (
                        <p className="text-xs text-violet-600 font-medium ml-1 flex items-center gap-1">
                          <CalendarRange size={12} />
                          {scheduleForm.weeksCount * scheduleForm.lessonsPerWeek} aula(s) serão agendadas ao longo das {scheduleForm.weeksCount} semanas.
                        </p>
                      )}
                    </div>

                    {/* Múltiplas Aulas por Semana */}
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-wider text-primary flex items-center gap-2">
                          <CalendarIcon size={14} /> Aulas na mesma semana
                        </label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4].map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => {
                                const [startY, startM, startD] = scheduleForm.date.split("-").map(Number);
                                const initialDay = new Date(startY, startM - 1, startD).getDay();
                                const newSlots = [];
                                for (let i = 0; i < num; i++) {
                                  newSlots.push({
                                    dayOfWeek: (initialDay + (i * 2)) % 7,
                                    time: scheduleForm.time,
                                    studioRoomId: ""
                                  });
                                }
                                setScheduleForm(p => ({
                                  ...p,
                                  lessonsPerWeek: num,
                                  weeklySlots: newSlots,
                                  // Se selecionar mais de 1x por semana, ajusta weeksCount padrão para 4 semanas se estava em 1
                                  weeksCount: p.weeksCount === 1 ? 4 : p.weeksCount
                                }));
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                                scheduleForm.lessonsPerWeek === num
                                  ? "bg-primary text-white border-primary shadow-sm shadow-primary/20"
                                  : "bg-card text-muted-foreground border-border hover:bg-muted"
                              )}
                            >
                              {num}x/sem
                            </button>
                          ))}
                        </div>
                      </div>

                        {scheduleForm.lessonsPerWeek > 1 && (
                          <div className="space-y-2 pt-2 border-t border-primary/10">
                            <p className="text-xs text-muted-foreground font-medium">Configure os dias e horários das aulas:</p>
                            <div className="grid gap-2">
                              {scheduleForm.weeklySlots.map((slot, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-card/60 p-2 rounded-xl border border-border/40 text-xs">
                                  <span className="font-bold text-foreground min-w-[50px]">Aula {idx + 1}:</span>
                                  <select
                                    value={slot.dayOfWeek}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const updated = [...scheduleForm.weeklySlots];
                                      updated[idx].dayOfWeek = val;
                                      setScheduleForm(p => ({ ...p, weeklySlots: updated }));
                                    }}
                                    className="h-9 bg-muted/20 border border-border/40 rounded-lg px-2 text-xs font-bold outline-none"
                                  >
                                    <option value={0}>Domingo</option>
                                    <option value={1}>Segunda-feira</option>
                                    <option value={2}>Terça-feira</option>
                                    <option value={3}>Quarta-feira</option>
                                    <option value={4}>Quinta-feira</option>
                                    <option value={5}>Sexta-feira</option>
                                    <option value={6}>Sábado</option>
                                  </select>
                                  <input
                                    type="time"
                                    value={slot.time}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updated = [...scheduleForm.weeklySlots];
                                      updated[idx].time = val;
                                      setScheduleForm(p => ({ ...p, weeklySlots: updated }));
                                    }}
                                    className="h-9 bg-muted/20 border border-border/40 rounded-lg px-2 text-xs font-bold outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                    {/* Observações */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] ml-1">Observações</label>
                      <Textarea
                        value={scheduleForm.notes}
                        onChange={e => setScheduleForm(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Conteúdo da aula, objetivos, materiais..."
                        className="rounded-xl text-sm resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Botão de Agendar */}
                    <Button
                      className="w-full h-13 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-sm shadow-lg shadow-violet-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                      onClick={handleScheduleSubmit}
                      disabled={createLessonMutation.isPending || createBatchLessonMutation.isPending || checkConflicts.isFetching}
                    >
                      {(createLessonMutation.isPending || createBatchLessonMutation.isPending || checkConflicts.isFetching) ? (
                        <><Loader2 size={18} className="animate-spin" /> Agendando...</>
                      ) : scheduleForm.weeksCount > 1 ? (
                        <><CalendarRange size={18} /> Validar e Agendar {scheduleForm.weeksCount} Aulas</>
                      ) : (
                        <><CheckCircle2 size={18} /> Agendar Aula</>                       
                      )}
                    </Button>
                  </div>
                </div>

                {/* Mini-lista de próximas aulas */}
                {studentUpcomingLessons.length > 0 && (
                  <div className="bg-card rounded-[2rem] p-6 shadow-sm border border-border/50">
                    <h4 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                      <CalendarDays size={16} className="text-indigo-500" />
                      Próximas Aulas Agendadas
                    </h4>
                    <div className="space-y-2">
                      {studentUpcomingLessons.map((lesson: any) => (
                        <div key={lesson.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                              <CalendarDays size={14} className="text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{lesson.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(lesson.scheduledAt).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} às {new Date(lesson.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{lesson.duration}min</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─ Tela de Conflitos ─ */}
            {scheduleStep === "conflicts" && (
              <motion.div
                key="conflicts"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="bg-card rounded-[2rem] p-8 shadow-sm border border-amber-500/30 bg-amber-50/30">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <AlertTriangle size={22} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-foreground">Conflitos Detectados</h3>
                      <p className="text-sm text-muted-foreground">Algumas datas têm conflito de horário. Você pode forçar o agendamento para cada uma delas.</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    {batchItems.map((item, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all",
                          item.hasConflict
                            ? "border-amber-400/50 bg-amber-50"
                            : "border-border/40 bg-muted/30"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {item.hasConflict ? (
                            <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                          ) : (
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          )}
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {new Date(item.scheduledAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                            </p>
                            {item.hasConflict && item.conflictingWith && (
                              <p className="text-xs text-amber-600">Conflito com: {item.conflictingWith}</p>
                            )}
                          </div>
                        </div>
                        {item.hasConflict && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.force}
                              onChange={e => setBatchItems(prev =>
                                prev.map((b, i) => i === idx ? { ...b, force: e.target.checked } : b)
                              )}
                              className="w-4 h-4 accent-violet-600"
                            />
                            <span className="text-xs font-bold text-amber-700">Forçar</span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 h-12 rounded-xl font-bold"
                      onClick={() => setScheduleStep("form")}
                    >
                      Voltar
                    </Button>
                    <Button
                      className="flex-1 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black"
                      onClick={handleConfirmBatch}
                      disabled={createBatchLessonMutation.isPending}
                    >
                      {createBatchLessonMutation.isPending
                        ? <><Loader2 size={16} className="animate-spin mr-2" />Agendando...</>
                        : <><CheckCircle2 size={16} className="mr-2" />Confirmar Agendamento</>}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      )}
        </>
      )}
    </div>
  );
}
