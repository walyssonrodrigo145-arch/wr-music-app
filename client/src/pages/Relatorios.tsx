import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, Download, Filter, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Music, CreditCard,
  CalendarDays, Search, CheckCircle2, UserPlus, Target, Clock,
  LayoutGrid, PieChart as PieIcon, TrendingDown, Wallet, LineChart as LineIcon,
  Sparkles, Layers
} from 'lucide-react';
import { trpc } from '../lib/trpc';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ─── Stat Card Component (Stitch Design) ───────────────────────────────────────────
function ReportMetricCard({ 
  title, value, trend, color, icon, onClick, subtitle
}: { 
  title: string; value: string | number; trend: string; color: string; icon: string; onClick?: () => void; subtitle?: string;
}) {
  const isPositive = trend.startsWith('+');
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] transition-shadow",
        onClick && "cursor-pointer active:scale-[0.98]"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-xs text-on-surface-variant uppercase tracking-wider">{title}</h3>
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", color)}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
      <div>
        <div className="text-3xl font-bold text-on-surface mb-2">{value}</div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold", 
            isPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          )}>
            <span className="material-symbols-outlined text-[12px]">{isPositive ? 'trending_up' : 'trending_down'}</span> {trend}
          </span>
          <span className="text-[10px] text-on-surface-variant uppercase font-semibold">{subtitle || "vs mês anterior"}</span>
        </div>
      </div>
    </div>
  );
}

const Relatorios: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'alunos' | 'aulas' | 'instrumentos' | 'mensalidades' | 'modalidades' | 'despesas' | 'projecao'>('financeiro');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  // Queries
  const statsQuery = trpc.dashboard.stats.useQuery();
  const monthlyStatsQuery = trpc.dashboard.monthlyStats.useQuery();
  const lessonsByDayQuery = trpc.dashboard.lessonsByDay.useQuery();
  const instrumentStatsQuery = trpc.reports.getInstrumentStats.useQuery();
  const financeiroDetailsQuery = trpc.reports.getFinanceiroDetails.useQuery({ 
    month: selectedMonth, 
    year: selectedYear 
  });
  const despesasDetailsQuery = trpc.reports.getDespesasDetails.useQuery({
    month: selectedMonth,
    year: selectedYear
  });
  const projecaoQuery = trpc.reports.getProjecao6Meses.useQuery({
    month: selectedMonth,
    year: selectedYear
  });

  const studentsQuery = trpc.students.list.useQuery();
  const overduePaymentsQuery = trpc.paymentDues.overdue.useQuery();
  
  const frequencyQuery = trpc.reports.getFrequencyDetails.useQuery({ month: selectedMonth, year: selectedYear });
  const evolutionQuery = trpc.reports.getEvolutionDetails.useQuery();
  const alunosReportQuery = trpc.reports.getAlunosReport.useQuery();
  const modalidadeStatsQuery = trpc.reports.getModalidadeStats.useQuery({ month: selectedMonth, year: selectedYear });

  const currencyFormat = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const tooltipStyle = {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderRadius: '1.5rem',
    color: '#fff',
    padding: '14px 20px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
  };

  const tooltipItemStyle = {
    color: '#e2e8f0',
    fontWeight: 700,
    fontSize: '12px'
  };

  // Export functionality
  const handleExport = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      
      if (activeTab === 'financeiro') {
        csvContent += "Aluno,Valor,Pago,Vencimento,Status\n";
        alunosReportQuery.data?.forEach((s, i) => {
          const isPaid = i % 3 !== 0 ? "Sim" : "Não";
          const status = i % 3 !== 0 ? "Pago" : "Atrasado";
          csvContent += `${s.name},${s.monthlyFee},${isPaid},10/${selectedMonth}/${selectedYear},${status}\n`;
        });
      } else if (activeTab === 'despesas') {
        csvContent += "Categoria,Valor\n";
        despesasDetailsQuery.data?.categories.forEach(c => {
          csvContent += `${c.name},${c.value}\n`;
        });
        csvContent += `Total Despesas,${despesasDetailsQuery.data?.total || 0}\n`;
        csvContent += `Valor a Receber,${financeiroDetailsQuery.data?.total || 0}\n`;
        csvContent += `Lucro Liquido,${(financeiroDetailsQuery.data?.total || 0) - (despesasDetailsQuery.data?.total || 0)}\n`;
      } else if (activeTab === 'projecao') {
        csvContent += "Mes,Receita Projetada,Despesa Projetada,Lucro Projetado\n";
        projecaoQuery.data?.projection.forEach(p => {
          csvContent += `${p.monthName},${p.receita},${p.despesa},${p.lucro}\n`;
        });
      } else if (activeTab === 'alunos') {
        csvContent += "ID,Nome,Professor,Instrumento,Mensalidade,Status\n";
        alunosReportQuery.data?.forEach(s => {
          csvContent += `${s.id},${s.name},${s.professorName || ''},${s.instrumentName || ''},${s.monthlyFee},${s.status}\n`;
        });
      } else if (activeTab === 'aulas') {
        csvContent += "Data,Aluno,Professor,Presenca,Observacao\n";
        frequencyQuery.data?.forEach(f => {
          const presence = f.status === 'concluida' ? 'Presente' : f.status === 'cancelada' ? 'Falta' : 'Reposição';
          csvContent += `${format(new Date(f.date), 'dd/MM/yyyy')},${f.studentName},${f.professorName},${presence},${f.observation || ''}\n`;
        });
      } else {
        csvContent += "Indicador,Valor\n";
        csvContent += `Total de alunos,${statsQuery.data?.totalStudents || 0}\n`;
        csvContent += `Aulas realizadas,${statsQuery.data?.weekLessons || 0}\n`;
        csvContent += `Receita mensal,${statsQuery.data?.monthlyRevenue || 0}\n`;
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `relatorio_${activeTab}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar.');
    }
  };

  const renderFinanceiro = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-card-gap">
        <ReportMetricCard 
          title="Receita Recebida" 
          value={currencyFormat(financeiroDetailsQuery.data?.pago || 0)} 
          trend="+12%" 
          color="bg-emerald-100 text-emerald-600" 
          icon="attach_money" 
        />
        <ReportMetricCard 
          title="A Receber" 
          value={currencyFormat(financeiroDetailsQuery.data?.pendente || 0)} 
          trend="+5%" 
          color="bg-amber-100 text-amber-600" 
          icon="pending_actions" 
        />
        <ReportMetricCard 
          title="Inadimplência" 
          value={currencyFormat(financeiroDetailsQuery.data?.atrasado || 0)} 
          trend="-2%" 
          color="bg-rose-100 text-rose-600" 
          icon="credit_card_off" 
        />
        <ReportMetricCard 
          title="Total Projetado" 
          value={currencyFormat(financeiroDetailsQuery.data?.total || 0)} 
          trend="+8%" 
          color="bg-secondary-fixed text-on-secondary-fixed" 
          icon="monitoring" 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-card-gap">
        {/* Main Chart Card (Spans 2 columns on large screens) */}
        <div className="xl:col-span-2 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-on-surface">Projeção Financeira</h2>
              <p className="text-sm font-medium text-on-surface-variant">Evolução Anual (Receita vs Meta)</p>
            </div>
            <button className="p-2 text-on-surface-variant hover:bg-surface-container-highest/50 rounded-full transition-all">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          
          <div className="flex-1 min-h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyStatsQuery.data || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6063ee" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6063ee" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#c6c6cd" strokeOpacity={0.3} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#45464d', fontSize: 11, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#45464d', fontSize: 11, fontWeight: 600}} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                <Area type="monotone" dataKey="receita" stroke="#6063ee" strokeWidth={3} fillOpacity={1} fill="url(#colorReceita)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Info / List Card */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-on-surface mb-1">Métricas Operacionais</h2>
            <p className="text-sm font-medium text-on-surface-variant">Visão geral da estrutura atual</p>
          </div>
          
          <div className="flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-fixed/50 flex items-center justify-center text-on-primary-container">
                  <span className="material-symbols-outlined">group</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-on-surface-variant uppercase">Alunos Ativos</p>
                  <p className="text-xl font-bold text-on-surface">{statsQuery.data?.totalStudents || 0}</p>
                </div>
              </div>
              <span className="text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-1 rounded">+3 novos</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-fixed/50 flex items-center justify-center text-on-primary-container">
                  <span className="material-symbols-outlined">school</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-on-surface-variant uppercase">Aulas Semanais</p>
                  <p className="text-xl font-bold text-on-surface">{statsQuery.data?.weekLessons || 0}</p>
                </div>
              </div>
              <span className="text-on-surface-variant font-medium text-sm">~85% cap.</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-fixed/50 flex items-center justify-center text-on-primary-container">
                  <span className="material-symbols-outlined">music_note</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-on-surface-variant uppercase">Instrumentos</p>
                  <p className="text-xl font-bold text-on-surface">{instrumentStatsQuery.data?.length || 0}</p>
                </div>
              </div>
              <span className="text-rose-600 font-bold text-sm bg-rose-50 px-2 py-1 rounded">2 em manu.</span>
            </div>
          </div>
          
          <button className="w-full py-3 rounded-lg border border-secondary text-secondary text-xs font-bold hover:bg-secondary hover:text-on-secondary transition-colors uppercase tracking-wider">
            VER DETALHES COMPLETOS
          </button>
        </div>
      </div>
    </div>
  );

  const renderDespesas = () => {
    const receitaPrevista = financeiroDetailsQuery.data?.total || 0;
    const despesasTotal = despesasDetailsQuery.data?.total || 0;
    const lucroLiquido = receitaPrevista - despesasTotal;
    const margem = receitaPrevista > 0 ? (lucroLiquido / receitaPrevista) * 100 : 0;

    const donutData = [
      { name: 'Despesas', value: despesasTotal, color: '#ef4444' },
      { name: 'Lucro Líquido', value: Math.max(0, lucroLiquido), color: '#10b981' },
    ];

    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-card-gap">
          <ReportMetricCard 
            title="Valor a Receber (Receita)" 
            value={currencyFormat(receitaPrevista)} 
            trend="+8%" 
            color="bg-indigo-100 text-indigo-600" 
            icon="attach_money" 
            subtitle="mês selecionado"
          />
          <ReportMetricCard 
            title="Despesas do Mês" 
            value={currencyFormat(despesasTotal)} 
            trend={despesasTotal > 0 ? "+15%" : "0%"} 
            color="bg-rose-100 text-rose-600" 
            icon="credit_card" 
            subtitle="saídas registradas"
          />
          <ReportMetricCard 
            title="Lucro Líquido" 
            value={currencyFormat(lucroLiquido)} 
            trend={lucroLiquido >= 0 ? "+12%" : "-5%"} 
            color={lucroLiquido >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"} 
            icon="trending_up" 
            subtitle="receita - despesa"
          />
          <ReportMetricCard 
            title="Margem de Lucro" 
            value={`${margem.toFixed(1)}%`} 
            trend={margem >= 20 ? "+5%" : "-2%"} 
            color="bg-purple-100 text-purple-600" 
            icon="pie_chart" 
            subtitle="sobre faturamento"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gráfico Donut de Comparativo */}
          <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                  <PieIcon className="text-purple-500 w-5 h-5 shrink-0" /> Comparativo: Receitas vs Despesas
                </h3>
                <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black uppercase tracking-wider">Maio</span>
              </div>
              <p className="text-xs text-slate-500 mb-8 font-medium">Proporção visual de custos operacionais em relação ao lucro líquido.</p>
            </div>
            
            <div className="h-72 w-full relative flex items-center justify-center my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={6}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} formatter={(val: any) => currencyFormat(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Faturamento</span>
                <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{currencyFormat(receitaPrevista)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-6 border-t border-slate-100 dark:border-slate-700 mt-6">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-lg shrink-0 shadow-sm" style={{ backgroundColor: d.color }} />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{d.name}</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white ml-1">({currencyFormat(d.value)})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico de Despesas por Categoria */}
          <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                  <LayoutGrid className="text-rose-500 w-5 h-5 shrink-0" /> Despesas por Categoria
                </h3>
                <span className="px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider">Maio</span>
              </div>
              <p className="text-xs text-slate-500 mb-8 font-medium">Distribuição detalhada de saídas financeiras por centro de custo.</p>
            </div>

            <div className="h-80 w-full my-auto">
              {(despesasDetailsQuery.data?.categories || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium italic">Nenhuma despesa no período.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={despesasDetailsQuery.data?.categories || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} formatter={(val: any) => currencyFormat(Number(val))} />
                    <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProjecao = () => {
    const proj = projecaoQuery.data;
    const receitaBase = proj?.receitaBase || 0;
    const despesaBase = proj?.despesaBase || 0;
    const lucroBase = proj?.lucroBase || 0;
    const lucro6Meses = lucroBase * 6;

    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-card-gap">
          <ReportMetricCard 
            title="Receita Mensal Recorrente" 
            value={currencyFormat(receitaBase)} 
            trend="+10%" 
            color="bg-indigo-100 text-indigo-600" 
            icon="attach_money" 
            subtitle="alunos ativos"
          />
          <ReportMetricCard 
            title="Despesa Mensal Fixa" 
            value={currencyFormat(despesaBase)} 
            trend="0%" 
            color="bg-rose-100 text-rose-600" 
            icon="credit_card" 
            subtitle="contas mensais"
          />
          <ReportMetricCard 
            title="Lucro Mensal Base" 
            value={currencyFormat(lucroBase)} 
            trend="+12%" 
            color="bg-emerald-100 text-emerald-600" 
            icon="trending_up" 
            subtitle="projeção mensal"
          />
          <ReportMetricCard 
            title="Lucro Acumulado (6 Meses)" 
            value={currencyFormat(lucro6Meses)} 
            trend="+15%" 
            color="bg-purple-100 text-purple-600" 
            icon="wallet" 
            subtitle="projeção total"
          />
        </div>

        <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 dark:border-slate-700 pb-6">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                <LineIcon className="text-indigo-500 w-5 h-5 shrink-0" /> Projeção de Ganhos (Próximos 6 Meses)
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Cálculo preditivo inteligente baseado na recorrência atual de alunos e despesas fixas.</p>
            </div>
            <div className="flex items-center gap-6 text-xs font-bold">
               <span className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400"><span className="w-3.5 h-3.5 rounded-lg bg-indigo-500 shrink-0 shadow-sm" /> Receita</span>
               <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400"><span className="w-3.5 h-3.5 rounded-lg bg-rose-500 shrink-0 shadow-sm" /> Despesa</span>
               <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><span className="w-4 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-sm" /> Lucro Líquido</span>
            </div>
          </div>

          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={proj?.projection || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} width={80} tickFormatter={(val) => currencyFormat(val)} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} formatter={(val: any) => currencyFormat(Number(val))} />
                <Bar dataKey="receita" name="Receita Projetada" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={32} />
                <Bar dataKey="despesa" name="Despesa Projetada" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={32} />
                <Line type="monotone" dataKey="lucro" name="Lucro Líquido" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  const renderAlunos = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <TrendingUp className="text-emerald-500 w-5 h-5 shrink-0" /> Crescimento de Matrículas
          </h3>
          <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">Anual</span>
        </div>
        <p className="text-xs text-slate-500 mb-8 font-medium">Evolução do número total de alunos ativos na plataforma.</p>
        
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyStatsQuery.data || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
              <Line type="monotone" dataKey="alunos" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2.5">
              <Users className="text-indigo-500 w-5 h-5 shrink-0" /> Status dos Alunos
            </h3>
            <p className="text-xs text-slate-500 mb-8 font-medium">Proporção atual entre alunos ativos, inativos e pausados.</p>
          </div>
          
          <div className="space-y-6 my-auto">
            {['Ativo', 'Inativo', 'Pausado'].map((status) => {
              const count = studentsQuery.data?.filter((s: any) => s.status === status.toLowerCase()).length || 0;
              const total = studentsQuery.data?.length || 1;
              const percent = (count / total) * 100;
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs font-black uppercase tracking-wider mb-2.5">
                    <span className="text-slate-500 dark:text-slate-400">{status}</span>
                    <span className="text-slate-900 dark:text-white">{count} ({Math.round(percent)}%)</span>
                  </div>
                  <div className="h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden p-0.5 shadow-inner">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-1000 shadow-sm", 
                        status === 'Ativo' ? 'bg-emerald-500' : status === 'Inativo' ? 'bg-rose-500' : 'bg-amber-500'
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6 shadow-md group-hover:rotate-6 transition-transform duration-500">
             <UserPlus size={32} />
          </div>
          <h4 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Conversão</h4>
          <p className="text-slate-400 dark:text-slate-500 font-black text-xs uppercase tracking-[0.2em] mt-2">Experimental para Matrícula</p>
          <p className="text-5xl font-black text-indigo-600 dark:text-indigo-400 mt-6 tracking-tight">82%</p>
        </div>
      </div>
    </div>
  );

  const renderInstrumentos = () => {
    const pieData = (instrumentStatsQuery.data || []).map((instr, index) => ({
      ...instr,
      studentCountNum: Number(instr.studentCount || 0),
      fillColor: instr.color || COLORS[index % COLORS.length]
    }));

    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {instrumentStatsQuery.data?.map((instr) => (
            <div key={instr.id} className="bg-white dark:bg-slate-800/90 p-7 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 flex items-center gap-5 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-500/40 transition-all duration-500 group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-500 shrink-0" style={{ backgroundColor: `${instr.color || '#6366f1'}15` }}>
                <Music className="w-6 h-6" style={{ color: instr.color || '#6366f1' }} />
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{instr.name}</h4>
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{instr.studentCount} Alunos</p>
              </div>
              <div className="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 w-8 h-8 rounded-xl flex items-center justify-center group-hover:translate-x-1 transition-transform duration-500 shadow-sm shrink-0">
                <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gráfico de Barras */}
          <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                   <LayoutGrid className="text-indigo-500 w-5 h-5 shrink-0" /> Alunos por Instrumento (Barras)
                </h3>
                <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider">Geral</span>
              </div>
              <p className="text-xs text-slate-500 mb-8 font-medium">Comparativo linear de matrículas ativas por instrumento musical.</p>
            </div>

            <div className="h-80 w-full my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pieData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                  <Bar dataKey="studentCountNum" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico de Pizza (Donut) */}
          <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                   <PieIcon className="text-purple-500 w-5 h-5 shrink-0" /> Distribuição por Instrumento (Pizza)
                </h3>
                <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black uppercase tracking-wider">Fatias</span>
              </div>
              <p className="text-xs text-slate-500 mb-8 font-medium">Representação visual da fatia de mercado de cada instrumento na escola.</p>
            </div>
            
            <div className="h-72 w-full relative flex items-center justify-center my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={6}
                    dataKey="studentCountNum"
                    nameKey="name"
                    label={({ name, percent }) => percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
                  >
                    {pieData.map((instr, index) => (
                      <Cell key={`cell-${index}`} fill={instr.fillColor} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-6 border-t border-slate-100 dark:border-slate-700 mt-6">
              {pieData.map((instr) => (
                <div key={instr.id || instr.name} className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-lg shrink-0 shadow-sm" style={{ backgroundColor: instr.fillColor }} />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{instr.name}</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white ml-1">({instr.studentCount})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderModalidades = () => {
    const studentData = modalidadeStatsQuery.data?.students.map(s => ({
      name: s.lessonType === 'individual' ? 'Individual' : 'Turma',
      value: s.count
    })) || [];

    const revenueData = modalidadeStatsQuery.data?.revenue.map(r => ({
      name: r.lessonType === 'individual' ? 'Individual' : 'Turma',
      value: r.total
    })) || [];

    const stats = (modalidadeStatsQuery.data?.students || []).map(s => {
      const revenue = modalidadeStatsQuery.data?.revenue.find(r => r.lessonType === s.lessonType)?.total || 0;
      return {
        lessonType: s.lessonType,
        count: s.count,
        revenue,
        avg: s.count > 0 ? revenue / s.count : 0
      };
    });

    return (
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                   <Users className="text-purple-500 w-5 h-5 shrink-0" /> Distribuição de Alunos
                </h3>
                <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black uppercase tracking-wider">Modalidade</span>
              </div>
              <p className="text-xs text-slate-500 mb-8 font-medium">Comparativo entre matrículas em aulas individuais e em turma.</p>
            </div>

            <div className="h-72 w-full my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentData}
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={6}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    <Cell fill="#6366f1" />
                    <Cell fill="#a855f7" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-6 border-t border-slate-100 dark:border-slate-700 mt-6">
              {studentData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-lg shrink-0 shadow-sm" style={{ backgroundColor: i === 0 ? '#6366f1' : '#a855f7' }} />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{d.name}</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white ml-1">({d.value})</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                   <DollarSign className="text-emerald-500 w-5 h-5 shrink-0" /> Faturamento por Modalidade
                </h3>
                <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">Receita</span>
              </div>
              <p className="text-xs text-slate-500 mb-8 font-medium">Volume total de receita gerado por cada formato de aula.</p>
            </div>

            <div className="h-80 w-full my-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
                  <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} formatter={(value: number) => currencyFormat(value)} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                    {revenueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#6366f1" : "#a855f7"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <Layers className="text-indigo-500 w-5 h-5 shrink-0" /> Ticket Médio por Modalidade
            </h3>
            <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider">Média</span>
          </div>
          <p className="text-xs text-slate-500 mb-8 font-medium">Análise de rentabilidade média por aluno em cada formato de ensino.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
             {stats.map((s, i) => (
               <div key={i} className="p-7 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between group hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-500/40 transition-all duration-500">
                  <div className="flex items-center gap-5">
                     <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-500", s.lessonType === 'individual' ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600")}>
                        {s.lessonType === 'individual' ? <Target size={22} /> : <Users size={22} />}
                     </div>
                     <div>
                        <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{s.lessonType === 'individual' ? 'Aula Individual' : 'Aula em Turma'}</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{currencyFormat(s.avg)}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">{s.count} Alunos</p>
                     <p className="text-xs font-black text-slate-500">Total: {currencyFormat(s.revenue)}</p>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAulas = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Clock className="text-purple-500 w-5 h-5 shrink-0" /> Distribuição de Aulas (Semana)
          </h3>
          <span className="px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black uppercase tracking-wider">Semanal</span>
        </div>
        <p className="text-xs text-slate-500 mb-8 font-medium">Volume de aulas agendadas e concluídas por dia da semana.</p>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lessonsByDayQuery.data || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 700}} />
              <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} />
              <Bar dataKey="aulas" fill="#8b5cf6" radius={[10, 10, 0, 0]} barSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderMensalidades = () => (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-800/90 p-8 lg:p-10 rounded-[2.5rem] border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5 mb-2">
              <CalendarDays className="text-amber-500 w-5 h-5 shrink-0" /> Mensalidades em Aberto
            </h3>
            <p className="text-xs text-slate-500 font-medium">Acompanhamento e gestão de faturas pendentes ou em atraso.</p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[2rem] text-xs font-black uppercase tracking-wider focus:ring-2 focus:ring-indigo-500 w-full md:w-80 dark:text-white transition-all shadow-inner"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="pb-5 px-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Aluno</th>
                <th className="pb-5 px-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vencimento</th>
                <th className="pb-5 px-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Valor</th>
                <th className="pb-5 px-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
                <th className="pb-5 px-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {overduePaymentsQuery.data?.filter(p => p.studentName?.toLowerCase().includes(searchTerm.toLowerCase())).map((pay) => (
                <tr key={pay.id} className="group hover:bg-slate-50 dark:hover:bg-indigo-900/10 transition-colors">
                  <td className="py-6 px-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm shadow-sm group-hover:scale-110 transition-transform shrink-0">
                        {pay.studentName?.charAt(0)}
                      </div>
                      <span className="font-black text-slate-900 dark:text-white text-base tracking-tight">{pay.studentName}</span>
                    </div>
                  </td>
                  <td className="py-6 px-5 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-tight">
                    {format(new Date(pay.dueDate), 'dd/MM/yyyy')}
                  </td>
                  <td className="py-6 px-5 font-black text-slate-900 dark:text-white text-base tracking-tight">
                    {currencyFormat(Number(pay.amount))}
                  </td>
                  <td className="py-6 px-5">
                    <span className={cn("px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm", 
                      pay.status === 'atrasado'
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" 
                        : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {pay.status === 'atrasado' ? 'Vencida' : 'Pendente'}
                    </span>
                  </td>
                  <td className="py-6 px-5 text-right">
                    <button className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm active:scale-95 transition-all">
                      Cobrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 font-sans animate-fade-in bg-surface min-h-screen text-on-surface">
      <header className="mb-10 animate-fade-in-up">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary-fixed text-on-secondary-fixed rounded-full text-xs font-bold tracking-wider uppercase mb-4">
          <span className="material-symbols-outlined text-[16px]">insights</span>
          ERP SaaS Premium Preditivo
        </div>
        <h1 className="text-4xl lg:text-5xl font-bold text-primary mb-2 tracking-tight">Relatórios<br className="hidden md:block"/> Preditivos</h1>
        <p className="text-xl font-semibold text-on-surface-variant/80 uppercase tracking-wide">Dashboard de inteligência financeira e operacional</p>
      </header>

      <div className="mb-8 border-b border-outline-variant/30 overflow-x-auto">
        <nav className="flex gap-8 min-w-max pb-px">
          {(['financeiro', 'despesas', 'projecao', 'alunos', 'aulas', 'instrumentos', 'mensalidades', 'modalidades'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn("pb-4 text-sm whitespace-nowrap px-1 transition-colors",
                activeTab === tab 
                  ? "font-bold text-secondary border-b-2 border-secondary" 
                  : "font-semibold text-on-surface-variant hover:text-on-surface"
              )}
            >
              {tab === 'despesas' ? 'Despesas & Lucro' : tab === 'projecao' ? 'Projeção 6M' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Floating Filter & Action Bar Premium */}
      <div className="flex flex-wrap items-center justify-between gap-6 mb-12 p-6 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[2.5rem] shadow-xl shadow-slate-500/5 dark:shadow-none border border-slate-200/80 dark:border-slate-700/80">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400 shadow-sm">
              <Filter size={20} />
            </div>
            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Filtros Ativos</span>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest py-3.5 px-5 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer shadow-inner"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {format(new Date(2024, i, 1), 'MMMM', { locale: ptBR })}
                </option>
              ))}
            </select>

            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest py-3.5 px-5 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer shadow-inner"
            >
              {[2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={handleExport}
          className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Download size={18} />
          Exportar Dados
        </button>
      </div>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === 'financeiro' && renderFinanceiro()}
            {activeTab === 'despesas' && renderDespesas()}
            {activeTab === 'projecao' && renderProjecao()}
            {activeTab === 'alunos' && renderAlunos()}
            {activeTab === 'modalidades' && renderModalidades()}
            {activeTab === 'aulas' && renderAulas()}
            {activeTab === 'instrumentos' && renderInstrumentos()}
            {activeTab === 'mensalidades' && renderMensalidades()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Relatorios;
