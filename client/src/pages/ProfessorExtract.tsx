import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calculator, 
  CheckCircle2, 
  DollarSign, 
  RefreshCw, 
  Calendar, 
  FileText, 
  Settings2, 
  Plus, 
  Trash2, 
  Download,
  Users,
  TrendingUp,
  Wallet,
  ArrowDownRight,
  Eye,
  MoreVertical,
  Sparkles,
  Printer,
  ChevronRight,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadBase64File } from "../utils/downloadReport";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

const DONUT_COLORS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#94a3b8", // Slate
];

export default function ProfessorExtract() {
  const { user } = useAuth();
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [chartMetric, setChartMetric] = useState<"liquido" | "bruto">("liquido");

  // Modals state
  const [detailsPaymentId, setDetailsPaymentId] = useState<number | null>(null);
  const [adjustPayment, setAdjustPayment] = useState<any | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Manual payment form state
  const [manualProfId, setManualProfId] = useState<string>("");
  const [manualCredits, setManualCredits] = useState<string>("");
  const [manualDebits, setManualDebits] = useState<string>("0");
  const [manualNotes, setManualNotes] = useState<string>("");

  const isAdmin = user?.role === "admin";

  // Data Queries
  const { data: payments, isLoading, refetch } = trpc.professorPayments.list.useQuery({
    month: viewMonth,
    year: viewYear,
  });

  const { data: historyData } = trpc.professorPayments.getHistory.useQuery({
    year: viewYear,
  });

  const { data: professoresList } = trpc.professores.list.useQuery(undefined, {
    enabled: isAdmin,
  });

  const generateReport = trpc.reportEngine.generate.useMutation();

  const calculateMutation = trpc.professorPayments.calculateAll.useMutation({
    onSuccess: (data) => {
      toast.success("Pagamentos calculados com sucesso!", {
        description: `Processados registros para ${data.count} professores.`,
      });
      refetch();
    },
    onError: (err) => toast.error(err.message || "Erro ao calcular pagamentos"),
  });

  const calculateSingleMutation = trpc.professorPayments.calculate.useMutation({
    onSuccess: () => {
      toast.success("Pagamento recalculado com sucesso!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const approveMutation = trpc.professorPayments.approve.useMutation({
    onSuccess: () => {
      toast.success("Pagamento aprovado com sucesso!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const markPaidMutation = trpc.professorPayments.markPaid.useMutation({
    onSuccess: () => {
      toast.success("Pagamento marcado como PAGO!");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateAdjustmentsMutation = trpc.professorPayments.updateAdjustments.useMutation({
    onSuccess: () => {
      toast.success("Ajustes salvos com sucesso!");
      setAdjustPayment(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const createManualMutation = trpc.professorPayments.createManual.useMutation({
    onSuccess: () => {
      toast.success("Pagamento manual criado com sucesso!");
      setIsManualModalOpen(false);
      setManualProfId("");
      setManualCredits("");
      setManualDebits("0");
      setManualNotes("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: detailsData, isLoading: detailsLoading } = trpc.professorPayments.getDetails.useQuery(
    { paymentId: detailsPaymentId! },
    { enabled: !!detailsPaymentId }
  );

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(2024, i, 1), "MMMM", { locale: ptBR }),
  }));

  const years = [viewYear - 1, viewYear, viewYear + 1];

  const displayPayments = payments || [];

  // Indicators calculations
  const totalBruto = displayPayments.reduce((acc, p) => acc + Number(p.totalCredits || 0), 0);
  const totalDescontos = displayPayments.reduce((acc, p) => acc + Number(p.totalDebits || 0), 0);
  const totalLiquido = displayPayments.reduce((acc, p) => acc + Number(p.totalAmount || 0), 0);
  const professoresAtivos = displayPayments.filter(p => p.totalClasses > 0 || Number(p.totalAmount) > 0).length;

  // Donut chart data calculations
  const donutData = displayPayments
    .filter(p => Number(p.totalAmount) > 0)
    .map(p => ({
      name: p.professorName || "Professor",
      value: Number(p.totalAmount),
    }));

  const totalDonutValue = donutData.reduce((acc, curr) => acc + curr.value, 0);
  const formattedDonutData = donutData.map(item => ({
    ...item,
    percentage: totalDonutValue > 0 ? Math.round((item.value / totalDonutValue) * 100) : 0,
  }));

  // Format hours and minutes
  const formatCargaHoraria = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  };

  // Receipt printing
  const handlePrint = (payment: any) => {
    if (!payment) return;
    const adjustments: any[] = payment.adjustments ? JSON.parse(payment.adjustments) : [];
    const totalCredits = Number(payment.totalCredits).toFixed(2);
    const totalDebits = Number(payment.totalDebits).toFixed(2);
    const totalAmount = Number(payment.totalAmount).toFixed(2);
    const refDate = format(new Date(payment.year, payment.month - 1), "MMMM 'de' yyyy", { locale: ptBR });
    const emitDate = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const adjustRows = adjustments.map((adj: any) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;">${adj.desc}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:right;color:#16a34a;font-weight:700;">${adj.value > 0 ? 'R$ ' + Number(adj.value).toFixed(2) : '—'}</td>
        <td style="padding:12px 16px;border-bottom:1px solid #f1f5f9;text-align:right;color:#dc2626;font-weight:700;">${adj.value < 0 ? 'R$ ' + Math.abs(adj.value).toFixed(2) : '—'}</td>
      </tr>
    `).join('');

    const printContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Recibo — ${payment.professorName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Inter',sans-serif;background:#f8fafc;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .page{max-width:760px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08);}
    .header{background:linear-gradient(135deg,#1e1b4b 0%,#312e81 60%,#4f46e5 100%);padding:36px 40px;display:flex;justify-content:space-between;align-items:center;}
    .header-title{color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;}
    .header-sub{color:#a5b4fc;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-top:4px;}
    .badge{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 16px;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;}
    .body{padding:36px 40px;}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px;}
    .info-block{background:#f8fafc;border-radius:10px;padding:16px;}
    .info-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;margin-bottom:4px;}
    .info-value{font-size:14px;font-weight:700;color:#0f172a;}
    table{width:100%;border-collapse:collapse;margin-bottom:24px;}
    thead tr{background:#f1f5f9;}
    th{padding:12px 16px;text-align:left;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;}
    th:not(:first-child){text-align:right;}
    td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f1f5f9;}
    .total-row td{background:#f8fafc;font-weight:700;font-size:13px;}
    .net-row td{background:linear-gradient(90deg,#1e1b4b,#312e81);color:#fff;font-weight:900;font-size:15px;padding:16px;}
    .net-row td:last-child{text-align:right;}
    .signature{margin-top:48px;display:flex;justify-content:center;}
    .sig-block{text-align:center;}
    .sig-line{width:280px;border-top:2px solid #1e1b4b;margin-bottom:8px;}
    .sig-name{font-weight:700;font-size:14px;}
    .sig-label{font-size:11px;color:#94a3b8;margin-top:2px;}
    .footer{background:#f8fafc;padding:16px 40px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;}
    @media print{body{background:#fff;}.page{box-shadow:none;border-radius:0;margin:0;max-width:100%;}}
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="header-title">🎵 WR Music</div>
        <div class="header-sub">Recibo de Pagamento — Professores</div>
      </div>
      <div class="badge">${payment.status?.toUpperCase() || 'CALCULADO'}</div>
    </div>
    <div class="body">
      <div class="info-grid">
        <div class="info-block">
          <div class="info-label">Professor</div>
          <div class="info-value">${payment.professorName}</div>
        </div>
        <div class="info-block">
          <div class="info-label">Referência</div>
          <div class="info-value">${refDate.charAt(0).toUpperCase() + refDate.slice(1)}</div>
        </div>
        <div class="info-block">
          <div class="info-label">Total de Aulas</div>
          <div class="info-value">${payment.totalClasses} aulas / ${payment.totalMinutes} min</div>
        </div>
        <div class="info-block">
          <div class="info-label">Data de Emissão</div>
          <div class="info-value">${emitDate.charAt(0).toUpperCase() + emitDate.slice(1)}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Proventos (+)</th>
            <th>Descontos (−)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Valor base das aulas concluídas</td>
            <td style="text-align:right;color:#16a34a;font-weight:700;">R$ ${totalCredits}</td>
            <td style="text-align:right;">—</td>
          </tr>
          ${adjustRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="1"><strong>Totais</strong></td>
            <td style="text-align:right;color:#16a34a;"><strong>R$ ${totalCredits}</strong></td>
            <td style="text-align:right;color:#dc2626;"><strong>R$ ${totalDebits}</strong></td>
          </tr>
          <tr class="net-row">
            <td colspan="2"><strong>💰 VALOR LÍQUIDO A RECEBER</strong></td>
            <td><strong>R$ ${totalAmount}</strong></td>
          </tr>
        </tfoot>
      </table>
      <div class="signature">
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-name">${payment.professorName}</div>
          <div class="sig-label">Assinatura do Recebedor</div>
        </div>
      </div>
    </div>
    <div class="footer">Documento gerado automaticamente pelo WR Music • ${emitDate}</div>
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 600);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (displayPayments.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    let csv = "data:text/csv;charset=utf-8,\uFEFF";
    csv += "Professor;Especialidade;Aulas Concluídas;Carga Horária;Total Bruto (R$);Descontos (R$);Líquido (R$);Status\n";
    displayPayments.forEach(p => {
      csv += `"${p.professorName}";"${p.specialty || '-'}";"${p.totalClasses}";"${formatCargaHoraria(p.totalMinutes)}";"${Number(p.totalCredits).toFixed(2)}";"${Number(p.totalDebits).toFixed(2)}";"${Number(p.totalAmount).toFixed(2)}";"${p.status}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `folha_pagamento_${viewMonth}_${viewYear}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("CSV exportado com sucesso!");
  };

  // Excel Export via Report Engine
  const handleExportExcel = () => {
    if (displayPayments.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }

    const rows = displayPayments.map(p => [
      p.professorName,
      p.specialty || '-',
      `${p.totalClasses} aulas`,
      formatCargaHoraria(p.totalMinutes),
      `R$ ${Number(p.totalCredits).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${Number(p.totalDebits).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${Number(p.totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      p.status.toUpperCase(),
    ]);

    toast.loading("Gerando planilha Excel...", { id: 'export-loading' });

    generateReport.mutate({
      format: 'excel',
      title: `Folha de Pagamento - ${months.find(m => m.value === viewMonth)?.label} / ${viewYear}`,
      columns: ["Professor", "Especialidade", "Aulas", "Carga Horária", "Total Bruto", "Descontos", "Líquido", "Status"],
      rows,
      period: `${viewMonth}/${viewYear}`,
    }, {
      onSuccess: (data) => {
        toast.dismiss('export-loading');
        downloadBase64File(data.data, 'excel', `folha_pagamento_${viewMonth}_${viewYear}`);
        toast.success("Excel exportado com sucesso!");
      },
      onError: () => {
        toast.dismiss('export-loading');
        toast.error("Erro ao gerar arquivo Excel.");
      }
    });
  };

  const handleManualCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualProfId || !manualCredits) {
      toast.error("Preencha o professor e o valor bruto.");
      return;
    }

    const credits = parseFloat(manualCredits) || 0;
    const debits = parseFloat(manualDebits) || 0;
    const amount = credits - debits;

    createManualMutation.mutate({
      professorId: parseInt(manualProfId),
      month: viewMonth,
      year: viewYear,
      totalCredits: credits,
      totalDebits: debits,
      totalAmount: amount,
      notes: manualNotes || "Lançamento Manual Extraordinário",
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8 font-sans bg-background/50 min-h-screen">
      {/* 1. Header Moderno SaaS Premium */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-card/60 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-border/40 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold shadow-inner">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-outfit text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                Folha de Pagamento
              </h1>
              <p className="text-sm md:text-base text-muted-foreground font-medium">
                Gerencie e acompanhe os pagamentos dos professores de forma simples e eficiente.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor Mês/Ano */}
          <div className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-2xl border border-border/40 shadow-inner">
            <Calendar className="w-4 h-4 text-muted-foreground ml-2" />
            <Select value={viewMonth.toString()} onValueChange={(v) => setViewMonth(parseInt(v))}>
              <SelectTrigger className="w-[130px] border-none bg-transparent font-semibold h-9 rounded-xl focus:ring-0 focus:ring-offset-0 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()} className="capitalize">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={viewYear.toString()} onValueChange={(v) => setViewYear(parseInt(v))}>
              <SelectTrigger className="w-[90px] border-none bg-transparent font-semibold h-9 rounded-xl focus:ring-0 focus:ring-offset-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Botão Exportar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-2xl h-11 px-4 font-semibold border-border/60 hover:bg-muted/50 transition-all">
                <Download className="w-4 h-4 mr-2 text-muted-foreground" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl">
              <DropdownMenuItem className="cursor-pointer font-medium" onClick={handleExportCSV}>
                <FileText className="w-4 h-4 mr-2 text-blue-500" /> Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer font-medium" onClick={handleExportExcel}>
                <FileText className="w-4 h-4 mr-2 text-emerald-500" /> Exportar Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer font-medium" onClick={() => {
                if (displayPayments.length > 0) handlePrint(displayPayments[0]);
              }}>
                <Printer className="w-4 h-4 mr-2 text-purple-500" /> Gerar Recibos (Lote)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Botão Novo Pagamento */}
          {isAdmin && (
            <Button 
              variant="default"
              className="rounded-2xl h-11 px-5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 hover:-translate-y-0.5 transition-all"
              onClick={() => setIsManualModalOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" /> Novo Pagamento
            </Button>
          )}
        </div>
      </div>

      {/* 2. Cards de Indicadores (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Bruto */}
        <div className="bg-card/70 backdrop-blur-md p-6 rounded-3xl border border-border/40 shadow-sm relative overflow-hidden group hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Bruto</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-outfit text-3xl font-black text-foreground tracking-tight">
              R$ {totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs font-medium text-muted-foreground mt-1">Valor total antes de descontos</p>
          </div>
        </div>

        {/* Descontos */}
        <div className="bg-card/70 backdrop-blur-md p-6 rounded-3xl border border-border/40 shadow-sm relative overflow-hidden group hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Descontos</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-outfit text-3xl font-black text-foreground tracking-tight">
              R$ {totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs font-medium text-muted-foreground mt-1">Impostos e taxas</p>
          </div>
        </div>

        {/* Líquido a Pagar (Destaque Principal) */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-3xl text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group hover:scale-[1.01] transition-all">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100 uppercase tracking-wider">Líquido a Pagar</span>
            <div className="w-10 h-10 rounded-2xl bg-white/15 text-white flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-outfit text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-sm">
              R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs font-medium text-indigo-100/80 mt-1">Valor final aos professores</p>
          </div>
        </div>

        {/* Professores Ativos */}
        <div className="bg-card/70 backdrop-blur-md p-6 rounded-3xl border border-border/40 shadow-sm relative overflow-hidden group hover:border-border transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Professores Ativos</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="font-outfit text-3xl font-black text-foreground tracking-tight">
              {professoresAtivos}
            </h3>
            <p className="text-xs font-medium text-muted-foreground mt-1">Com aulas no período</p>
          </div>
        </div>
      </div>

      {/* 3 & 4. Painel de Gráficos (Evolução + Distribuição) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Evolução do Líquido/Bruto a Pagar */}
        <div className="lg:col-span-2 bg-card/60 backdrop-blur-xl p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-outfit text-xl font-bold text-foreground">Evolução do Líquido a Pagar</h3>
              <p className="text-xs text-muted-foreground font-medium">Histórico de pagamentos ao longo dos meses ({viewYear})</p>
            </div>

            {/* Toggle Bruto | Líquido */}
            <div className="flex bg-muted/40 p-1 rounded-xl border border-border/40 text-xs font-bold">
              <button
                onClick={() => setChartMetric("bruto")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  chartMetric === "bruto"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Bruto
              </button>
              <button
                onClick={() => setChartMetric("liquido")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  chartMetric === "liquido"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Líquido
              </button>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            {historyData && historyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
                  <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', border: 'none', color: '#fff' }}
                    formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, chartMetric === "liquido" ? "Líquido" : "Bruto"]}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartMetric}
                    stroke="#6366f1"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorMetric)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm font-medium">
                Carregando histórico...
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Distribuição por Professor (Donut) */}
        <div className="bg-card/60 backdrop-blur-xl p-6 rounded-3xl border border-border/40 shadow-sm space-y-4">
          <div>
            <h3 className="font-outfit text-xl font-bold text-foreground">Distribuição por Professor</h3>
            <p className="text-xs text-muted-foreground font-medium">Participação financeira dos professores no período</p>
          </div>

          {formattedDonutData.length > 0 ? (
            <div className="flex flex-col sm:flex-row lg:flex-col items-center gap-6 pt-2">
              <div className="w-44 h-44 relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={formattedDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {formattedDonutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', border: 'none', color: '#fff' }}
                      formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="font-outfit text-2xl font-black text-foreground">{professoresAtivos}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Professores</span>
                </div>
              </div>

              {/* Lista/Legenda ao lado */}
              <div className="w-full space-y-2 max-h-48 overflow-y-auto pr-1">
                {formattedDonutData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-semibold p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                      <span className="truncate text-foreground">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground font-medium">{item.percentage}%</span>
                      <span className="font-bold text-foreground">R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground text-sm p-4">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              Nenhum valor calculado para a distribuição neste período.
            </div>
          )}
        </div>
      </div>

      {/* 5. Área Principal — Pagamentos do Período */}
      <div className="bg-card/60 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-border/40 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div className="flex items-center gap-3">
            <h2 className="font-outfit text-2xl font-extrabold text-foreground tracking-tight">
              Pagamentos do Período
            </h2>
            <Badge variant="secondary" className="rounded-xl px-3 py-1 font-bold text-xs bg-muted text-muted-foreground">
              {displayPayments.length} registros
            </Badge>
          </div>

          {/* Banner de Destaque da Automação */}
          <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-2xl text-xs md:text-sm text-indigo-700 dark:text-indigo-300 font-semibold max-w-xl">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <span className="font-bold">✨ Os valores são calculados automaticamente</span>
              <p className="text-xs opacity-90 font-medium">Com base nas aulas realizadas, carga horária e regras de cada professor.</p>
            </div>
          </div>
        </div>

        {/* 6. Botão Principal "Calcular Pagamentos" */}
        {isAdmin && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-2xl border border-border/30">
            <div className="text-sm font-medium text-muted-foreground">
              Clique no botão ao lado para processar/atualizar a folha de pagamento de todos os professores no mês de <strong className="text-foreground capitalize">{months.find(m => m.value === viewMonth)?.label} de {viewYear}</strong>.
            </div>
            <Button
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl h-14 px-8 text-base shadow-xl shadow-indigo-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0"
              onClick={() => calculateMutation.mutate({ month: viewMonth, year: viewYear })}
              disabled={calculateMutation.isPending}
            >
              {calculateMutation.isPending ? (
                <>
                  <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
                  Calculando pagamentos...
                </>
              ) : (
                <>
                  <Calculator className="mr-3 h-5 w-5" />
                  🧮 Calcular Pagamentos
                </>
              )}
            </Button>
          </div>
        )}

        {/* 8. Tabela SaaS de Pagamentos */}
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : displayPayments.length === 0 ? (
          <div className="bg-muted/20 rounded-2xl p-12 text-center border border-dashed border-border/50">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h4 className="font-outfit text-xl font-bold text-foreground mb-1">Nenhum pagamento registrado neste mês</h4>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Clique no botão "Calcular Pagamentos" acima para ler as aulas concluídas do mês e gerar a folha automaticamente.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-2xl border border-border/40 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider font-extrabold border-b border-border/40">
                  <tr>
                    <th className="px-6 py-4">Professor</th>
                    <th className="px-6 py-4">Aulas realizadas</th>
                    <th className="px-6 py-4">Carga horária</th>
                    <th className="px-6 py-4 text-right">Total bruto</th>
                    <th className="px-6 py-4 text-right">Descontos</th>
                    <th className="px-6 py-4 text-right">Líquido</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 bg-card/40 font-medium">
                  {displayPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-muted/30 transition-colors group">
                      {/* Professor Name & Specialty */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-outfit font-black text-lg shadow-inner shrink-0">
                            {payment.professorName?.charAt(0) || "P"}
                          </div>
                          <div>
                            <p className="font-outfit font-bold text-foreground text-base group-hover:text-indigo-600 transition-colors">
                              {payment.professorName}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">
                              {payment.specialty || "Música"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Aulas */}
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {payment.totalClasses} aulas
                      </td>

                      {/* Carga horária */}
                      <td className="px-6 py-4 text-muted-foreground font-semibold">
                        {formatCargaHoraria(payment.totalMinutes)}
                      </td>

                      {/* Total Bruto */}
                      <td className="px-6 py-4 text-right font-outfit font-bold text-foreground">
                        R$ {Number(payment.totalCredits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Descontos */}
                      <td className="px-6 py-4 text-right font-outfit font-semibold text-red-500">
                        {Number(payment.totalDebits || 0) > 0 ? `- R$ ${Number(payment.totalDebits).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : "R$ 0,00"}
                      </td>

                      {/* Líquido */}
                      <td className="px-6 py-4 text-right font-outfit font-black text-indigo-600 dark:text-indigo-400 text-lg">
                        R$ {Number(payment.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status Badges (Item 9) */}
                      <td className="px-6 py-4 text-center">
                        {payment.status === "pago" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            🟢 PAGO
                          </span>
                        )}
                        {payment.status === "aprovado" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            🟠 PENDENTE
                          </span>
                        )}
                        {payment.status === "aberto" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                            ⚪ EM ABERTO
                          </span>
                        )}
                      </td>

                      {/* Ações (Item 10) */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-xl h-9 px-3 font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => setDetailsPaymentId(payment.id)}
                          >
                            <Eye className="w-4 h-4 mr-1.5" /> Visualizar
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="rounded-xl h-9 w-9">
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl font-medium">
                              <DropdownMenuItem onClick={() => setDetailsPaymentId(payment.id)}>
                                <Eye className="w-4 h-4 mr-2" /> Visualizar detalhes
                              </DropdownMenuItem>
                              
                              {isAdmin && payment.status === "aberto" && (
                                <DropdownMenuItem onClick={() => setAdjustPayment({
                                  ...payment,
                                  adjs: payment.adjustments ? JSON.parse(payment.adjustments) : []
                                })}>
                                  <Settings2 className="w-4 h-4 mr-2" /> Editar / Ajustes
                                </DropdownMenuItem>
                              )}

                              {isAdmin && payment.status === "aberto" && (
                                <DropdownMenuItem onClick={() => approveMutation.mutate({ id: payment.id })}>
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-amber-600" /> Aprovar Pagamento
                                </DropdownMenuItem>
                              )}

                              {isAdmin && payment.status === "aprovado" && (
                                <DropdownMenuItem onClick={() => markPaidMutation.mutate({ id: payment.id })}>
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Marcar como Pago
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem onClick={() => handlePrint(payment)}>
                                <FileText className="w-4 h-4 mr-2 text-purple-600" /> Gerar Recibo
                              </DropdownMenuItem>

                              {isAdmin && (
                                <DropdownMenuItem onClick={() => calculateSingleMutation.mutate({
                                  professorId: payment.professorId,
                                  month: viewMonth,
                                  year: viewYear,
                                })}>
                                  <RefreshCw className="w-4 h-4 mr-2 text-indigo-600" /> Recalcular
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (Item 16) */}
            <div className="block md:hidden space-y-4">
              {displayPayments.map((payment) => (
                <div key={payment.id} className="bg-card p-5 rounded-2xl border border-border/40 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-outfit font-black text-lg">
                        {payment.professorName?.charAt(0) || "P"}
                      </div>
                      <div>
                        <h4 className="font-outfit font-bold text-foreground">{payment.professorName}</h4>
                        <p className="text-xs text-muted-foreground">{payment.specialty || "Música"}</p>
                      </div>
                    </div>

                    {payment.status === "pago" && <Badge className="bg-emerald-500/10 text-emerald-600 border-none">PAGO</Badge>}
                    {payment.status === "aprovado" && <Badge className="bg-amber-500/10 text-amber-600 border-none">PENDENTE</Badge>}
                    {payment.status === "aberto" && <Badge className="bg-slate-500/10 text-slate-600 border-none">EM ABERTO</Badge>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-3 rounded-xl">
                    <div>
                      <span className="text-muted-foreground">Aulas:</span>
                      <p className="font-bold text-foreground">{payment.totalClasses} aulas</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Carga Horária:</span>
                      <p className="font-bold text-foreground">{formatCargaHoraria(payment.totalMinutes)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">Líquido a Pagar</span>
                      <p className="font-outfit text-xl font-black text-indigo-600">
                        R$ {Number(payment.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <Button size="sm" className="rounded-xl font-bold bg-indigo-600" onClick={() => setDetailsPaymentId(payment.id)}>
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 11. Modal/Drawer: Detalhamento do Pagamento */}
      <Dialog open={!!detailsPaymentId} onOpenChange={(o) => !o && setDetailsPaymentId(null)}>
        <DialogContent className="w-[95vw] sm:max-w-4xl rounded-3xl bg-card border-border/40 p-6 md:p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-outfit text-2xl font-black text-foreground">
              Resumo do Pagamento
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Detalhamento de atividades e cálculo financeiro do professor.
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-12 flex justify-center"><RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" /></div>
          ) : (
            <div className="space-y-6 mt-4">
              {/* Info Header */}
              {displayPayments.find(p => p.id === detailsPaymentId) && (
                <div className="bg-muted/30 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-border/30">
                  <div>
                    <h3 className="font-outfit text-xl font-bold text-foreground">
                      {displayPayments.find(p => p.id === detailsPaymentId)?.professorName}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium">
                      Período de Referência: <span className="capitalize text-foreground font-bold">{months.find(m => m.value === viewMonth)?.label} / {viewYear}</span>
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-xl font-bold">
                    Status: {displayPayments.find(p => p.id === detailsPaymentId)?.status.toUpperCase()}
                  </Badge>
                </div>
              )}

              {/* Atividades & Cálculo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Atividades */}
                <div className="bg-card p-5 rounded-2xl border border-border/40 space-y-4">
                  <h4 className="font-outfit font-bold text-base text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Atividades
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between pb-2 border-b border-border/30">
                      <span className="text-muted-foreground">Aulas realizadas:</span>
                      <span className="font-bold text-foreground">{detailsData?.lessons?.length || 0} aulas</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-border/30">
                      <span className="text-muted-foreground">Horas trabalhadas:</span>
                      <span className="font-bold text-foreground">
                        {formatCargaHoraria(detailsData?.lessons?.reduce((acc: number, l: any) => acc + (l.duration || 0), 0) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Alunos atendidos:</span>
                      <span className="font-bold text-foreground">
                        {new Set(detailsData?.lessons?.map((l: any) => l.studentId).filter(Boolean)).size} alunos
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cálculo */}
                <div className="bg-card p-5 rounded-2xl border border-border/40 space-y-4">
                  <h4 className="font-outfit font-bold text-base text-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-indigo-600" /> Cálculo
                  </h4>
                  {displayPayments.find(p => p.id === detailsPaymentId) && (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between pb-2 border-b border-border/30">
                        <span className="text-muted-foreground">Valor das aulas:</span>
                        <span className="font-bold text-foreground">
                          R$ {Number(displayPayments.find(p => p.id === detailsPaymentId)?.totalCredits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between pb-2 border-b border-border/30">
                        <span className="text-muted-foreground">Descontos:</span>
                        <span className="font-bold text-red-500">
                          - R$ {Number(displayPayments.find(p => p.id === detailsPaymentId)?.totalDebits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span className="font-bold text-indigo-600">Líquido a receber:</span>
                        <span className="font-outfit text-xl font-black text-indigo-600">
                          R$ {Number(displayPayments.find(p => p.id === detailsPaymentId)?.totalAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabela de Aulas Concluídas */}
              <div className="space-y-3">
                <h4 className="font-outfit font-bold text-base text-foreground">Aulas Ministradas no Período</h4>
                <div className="overflow-hidden rounded-xl border border-border/40 max-h-56 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground font-bold uppercase">
                      <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3">Aluno</th>
                        <th className="p-3">Título</th>
                        <th className="p-3">Duração</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 font-medium">
                      {detailsData?.lessons?.map((lesson: any) => (
                        <tr key={lesson.id} className="hover:bg-muted/20">
                          <td className="p-3">{format(new Date(lesson.scheduledAt), "dd/MM/yyyy HH:mm")}</td>
                          <td className="p-3 font-bold">{lesson.studentName || "-"}</td>
                          <td className="p-3 text-muted-foreground">{lesson.title}</td>
                          <td className="p-3">{lesson.duration}m</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Botão Recalcular Pagamento */}
              <div className="flex items-center justify-between pt-4 border-t border-border/40">
                <Button variant="outline" className="rounded-xl" onClick={() => handlePrint(displayPayments.find(p => p.id === detailsPaymentId))}>
                  <Printer className="w-4 h-4 mr-2" /> Gerar Recibo PDF
                </Button>

                {isAdmin && (
                  <Button
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    onClick={() => {
                      const profId = displayPayments.find(p => p.id === detailsPaymentId)?.professorId;
                      if (profId) {
                        calculateSingleMutation.mutate({
                          professorId: profId,
                          month: viewMonth,
                          year: viewYear,
                        });
                      }
                    }}
                    disabled={calculateSingleMutation.isPending}
                  >
                    {calculateSingleMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Calculator className="w-4 h-4 mr-2" />}
                    Recalcular Pagamento
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 12. Modal: Novo Pagamento Manual Extraordinário */}
      <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-3xl bg-card border-border/40 p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="font-outfit text-2xl font-black text-foreground">
              + Novo Pagamento Manual
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Utilize esta opção apenas para lançar pagamentos manuais ou extraordinários fora do fluxo automático.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleManualCreateSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground uppercase">Professor</Label>
              <Select value={manualProfId} onValueChange={setManualProfId}>
                <SelectTrigger className="w-full rounded-xl bg-muted/30 border-border/40 font-medium">
                  <SelectValue placeholder="Selecione o professor..." />
                </SelectTrigger>
                <SelectContent>
                  {professoresList?.map((prof: any) => (
                    <SelectItem key={prof.id} value={prof.id.toString()}>
                      {prof.name} ({prof.especialidade || prof.specialty || "Música"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground uppercase">Valor Bruto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={manualCredits}
                  onChange={(e) => setManualCredits(e.target.value)}
                  className="rounded-xl bg-muted/30 border-border/40 font-outfit font-bold"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground uppercase">Descontos (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={manualDebits}
                  onChange={(e) => setManualDebits(e.target.value)}
                  className="rounded-xl bg-muted/30 border-border/40 font-outfit font-bold text-red-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground uppercase">Observações / Descrição</Label>
              <Input
                placeholder="Ex: Bônus de fim de ano, Lançamento extra..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                className="rounded-xl bg-muted/30 border-border/40 font-medium"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
              <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setIsManualModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold" disabled={createManualMutation.isPending}>
                {createManualMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Criar Pagamento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Ajustes Manuais */}
      <Dialog open={!!adjustPayment} onOpenChange={(o) => !o && setAdjustPayment(null)}>
        <DialogContent className="w-[95vw] sm:max-w-xl rounded-3xl bg-card border-border/40 p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="font-outfit text-2xl font-black text-foreground">Ajustes Manuais</DialogTitle>
          </DialogHeader>
          {adjustPayment && (
            <div className="space-y-6 mt-4">
              <div className="space-y-4">
                {adjustPayment.adjs.map((adj: any, idx: number) => (
                  <div key={idx} className="flex gap-3 items-center bg-muted/20 p-2.5 rounded-2xl border border-border/30">
                    <Input 
                      placeholder="Descrição (ex: Bônus, Falta)" 
                      value={adj.desc} 
                      onChange={e => {
                        const newAdjs = [...adjustPayment.adjs];
                        newAdjs[idx].desc = e.target.value;
                        setAdjustPayment({...adjustPayment, adjs: newAdjs});
                      }}
                      className="flex-1 rounded-xl bg-background/50"
                    />
                    <Input 
                      type="number" 
                      placeholder="Valor (R$)" 
                      value={adj.value} 
                      onChange={e => {
                        const newAdjs = [...adjustPayment.adjs];
                        newAdjs[idx].value = parseFloat(e.target.value) || 0;
                        setAdjustPayment({...adjustPayment, adjs: newAdjs});
                      }}
                      className="w-32 rounded-xl bg-background/50 font-outfit font-bold"
                    />
                    <Button variant="ghost" size="icon" className="hover:bg-red-500/10 hover:text-red-500 rounded-xl" onClick={() => {
                      const newAdjs = adjustPayment.adjs.filter((_:any, i:number) => i !== idx);
                      setAdjustPayment({...adjustPayment, adjs: newAdjs});
                    }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                
                <Button variant="outline" className="w-full border-dashed border-2 hover:bg-indigo-500/5 hover:text-indigo-600 transition-colors py-5 rounded-2xl font-bold text-xs" onClick={() => {
                  setAdjustPayment({...adjustPayment, adjs: [...adjustPayment.adjs, { desc: "", value: 0 }]});
                }}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Novo Ajuste
                </Button>
              </div>

              <div className="bg-indigo-500/5 p-5 rounded-2xl border border-indigo-500/10 space-y-2 text-sm">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="font-medium">Créditos Base:</span>
                  <span className="font-outfit font-bold">R$ {Number(adjustPayment.totalCredits).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600 font-semibold">
                  <span>Ajustes (+):</span>
                  <span className="font-outfit">+ R$ {adjustPayment.adjs.filter((a:any)=>a.value>0).reduce((sum:number,a:any)=>sum+a.value,0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-red-500 font-semibold">
                  <span>Ajustes (-):</span>
                  <span className="font-outfit">- R$ {Math.abs(adjustPayment.adjs.filter((a:any)=>a.value<0).reduce((sum:number,a:any)=>sum+a.value,0)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-bold border-t border-indigo-500/20 pt-3 mt-2">
                  <span className="text-foreground">Total Líquido:</span>
                  <span className="font-outfit text-2xl font-black text-indigo-600">R$ {(
                    Number(adjustPayment.totalCredits) + 
                    adjustPayment.adjs.reduce((sum:number,a:any)=>sum+a.value,0)
                  ).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" className="rounded-xl" onClick={() => setAdjustPayment(null)}>Cancelar</Button>
                <Button className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold" disabled={updateAdjustmentsMutation.isPending} onClick={() => {
                  const manualCredits = adjustPayment.adjs.filter((a:any)=>a.value>0).reduce((sum:number,a:any)=>sum+a.value,0);
                  const manualDebits = Math.abs(adjustPayment.adjs.filter((a:any)=>a.value<0).reduce((sum:number,a:any)=>sum+a.value,0));
                  
                  const totalAmount = Number(adjustPayment.totalCredits) + adjustPayment.adjs.reduce((sum:number,a:any)=>sum+a.value, 0);

                  updateAdjustmentsMutation.mutate({
                    paymentId: adjustPayment.id,
                    adjustments: JSON.stringify(adjustPayment.adjs),
                    totalAmount: totalAmount,
                    totalCredits: Number(adjustPayment.totalCredits) + manualCredits,
                    totalDebits: manualDebits
                  });
                }}>
                  {updateAdjustmentsMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
