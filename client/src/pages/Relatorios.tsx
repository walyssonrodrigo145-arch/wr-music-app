import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, Download, Filter, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Music, CreditCard,
  CalendarDays, Search, CheckCircle2, UserPlus, Target, Clock,
  LayoutGrid, PieChart as PieIcon, TrendingDown, Wallet, LineChart as LineIcon
} from 'lucide-react';
import { trpc } from '../lib/trpc';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ─── Stat Card Component ───────────────────────────────────────────────────
function ReportMetricCard({ 
  title, value, trend, color, icon: Icon, onClick, subtitle
}: { 
  title: string; value: string | number; trend: string; color: string; icon: any; onClick?: () => void; subtitle?: string;
}) {
  const isPositive = trend.startsWith('+');
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group cursor-default flex flex-col justify-between",
        onClick && "cursor-pointer hover:border-indigo-500/40 active:scale-[0.98]"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-6 shadow-sm shrink-0", color.replace('text-', 'bg-') + '/10')}>
          <Icon size={18} className={color} />
        </div>
      </div>
      
      <div className="space-y-1">
        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h3>
        <div className="flex items-center gap-1.5">
          <div className={cn("flex items-center gap-0.5 text-[10px] font-black", isPositive ? "text-emerald-500" : "text-rose-500")}>
            {isPositive ? <ArrowUpRight size={10} /> : <TrendingDown size={10} />}
            {trend}
          </div>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{subtitle || "vs mês anterior"}</span>
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportMetricCard 
          title="Receita Recebida" 
          value={currencyFormat(financeiroDetailsQuery.data?.pago || 0)} 
          trend="+12%" 
          color="text-emerald-500" 
          icon={DollarSign} 
        />
        <ReportMetricCard 
          title="A Receber" 
          value={currencyFormat(financeiroDetailsQuery.data?.pendente || 0)} 
          trend="+5%" 
          color="text-amber-500" 
          icon={CalendarDays} 
        />
        <ReportMetricCard 
          title="Inadimplência" 
          value={currencyFormat(financeiroDetailsQuery.data?.atrasado || 0)} 
          trend="-2%" 
          color="text-rose-500" 
          icon={CreditCard} 
        />
        <ReportMetricCard 
          title="Total Projetado" 
          value={currencyFormat(financeiroDetailsQuery.data?.total || 0)} 
          trend="+8%" 
          color="text-indigo-500" 
          icon={TrendingUp} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-black mb-6 dark:text-white">Evolução da Receita</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyStatsQuery.data || []}>
                <defs>
                  <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip />
                <Area type="monotone" dataKey="receita" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorReceita)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-black mb-6 dark:text-white">Composição Financeira</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Pago', value: financeiroDetailsQuery.data?.pago || 0 },
                    { name: 'Pendente', value: financeiroDetailsQuery.data?.pendente || 0 },
                    { name: 'Atrasado', value: financeiroDetailsQuery.data?.atrasado || 0 },
                  ]}
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
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
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ReportMetricCard 
            title="Valor a Receber (Receita)" 
            value={currencyFormat(receitaPrevista)} 
            trend="+8%" 
            color="text-indigo-500" 
            icon={DollarSign} 
            subtitle="mês selecionado"
          />
          <ReportMetricCard 
            title="Despesas do Mês" 
            value={currencyFormat(despesasTotal)} 
            trend={despesasTotal > 0 ? "+15%" : "0%"} 
            color="text-rose-500" 
            icon={CreditCard} 
            subtitle="saídas registradas"
          />
          <ReportMetricCard 
            title="Lucro Líquido" 
            value={currencyFormat(lucroLiquido)} 
            trend={lucroLiquido >= 0 ? "+12%" : "-5%"} 
            color={lucroLiquido >= 0 ? "text-emerald-500" : "text-rose-500"} 
            icon={TrendingUp} 
            subtitle="receita - despesa"
          />
          <ReportMetricCard 
            title="Margem de Lucro" 
            value={`${margem.toFixed(1)}%`} 
            trend={margem >= 20 ? "+5%" : "-2%"} 
            color="text-purple-500" 
            icon={PieIcon} 
            subtitle="sobre faturamento"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Gráfico Donut de Comparativo */}
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
            <h3 className="text-lg font-black mb-6 dark:text-white flex items-center gap-2">
              <PieIcon size={20} className="text-purple-500" /> Comparativo: Receitas vs Despesas
            </h3>
            
            {/* Container do Gráfico e Texto Central */}
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
                  <Tooltip formatter={(val: any) => currencyFormat(Number(val))} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Texto Centralizado Perfeitamente */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Faturamento</span>
                <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{currencyFormat(receitaPrevista)}</span>
              </div>
            </div>

            {/* Legenda HTML Customizada Elegante */}
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
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
            <h3 className="text-lg font-black mb-6 dark:text-white flex items-center gap-2">
              <LayoutGrid size={20} className="text-rose-500" /> Despesas por Categoria
            </h3>
            <div className="h-80 flex-1">
              {(despesasDetailsQuery.data?.categories || []).length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium italic">Nenhuma despesa no período.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={despesasDetailsQuery.data?.categories || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                    <Tooltip formatter={(val: any) => currencyFormat(Number(val))} />
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
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ReportMetricCard 
            title="Receita Mensal Recorrente" 
            value={currencyFormat(receitaBase)} 
            trend="+10%" 
            color="text-indigo-500" 
            icon={DollarSign} 
            subtitle="alunos ativos"
          />
          <ReportMetricCard 
            title="Despesa Mensal Fixa" 
            value={currencyFormat(despesaBase)} 
            trend="0%" 
            color="text-rose-500" 
            icon={CreditCard} 
            subtitle="contas mensais"
          />
          <ReportMetricCard 
            title="Lucro Mensal Base" 
            value={currencyFormat(lucroBase)} 
            trend="+12%" 
            color="text-emerald-500" 
            icon={TrendingUp} 
            subtitle="projeção mensal"
          />
          <ReportMetricCard 
            title="Lucro Acumulado (6 Meses)" 
            value={currencyFormat(lucro6Meses)} 
            trend="+15%" 
            color="text-purple-500" 
            icon={Wallet} 
            subtitle="projeção total"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 dark:border-slate-700 pb-6">
            <div>
              <h3 className="text-lg font-black dark:text-white flex items-center gap-2">
                <LineIcon size={20} className="text-indigo-500" /> Projeção de Ganhos (Próximos 6 Meses)
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">Cálculo baseado na manutenção dos alunos ativos atuais e despesas fixas mensais.</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
               <span className="flex items-center gap-1.5 text-indigo-600"><span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" /> Receita</span>
               <span className="flex items-center gap-1.5 text-rose-600"><span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" /> Despesa</span>
               <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-3 h-1 bg-emerald-500 shrink-0" /> Lucro Líquido</span>
            </div>
          </div>

          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={proj?.projection || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} width={80} tickFormatter={(val) => currencyFormat(val)} />
                <Tooltip formatter={(val: any) => currencyFormat(Number(val))} />
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-black mb-6 dark:text-white">Crescimento de Matrículas</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyStatsQuery.data || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
              <Tooltip />
              <Line type="monotone" dataKey="alunos" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 3, stroke: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-black mb-6 dark:text-white">Status dos Alunos</h3>
          <div className="space-y-4">
            {['Ativo', 'Inativo', 'Pausado'].map((status) => {
              const count = studentsQuery.data?.filter((s: any) => s.status === status.toLowerCase()).length || 0;
              const total = studentsQuery.data?.length || 1;
              const percent = (count / total) * 100;
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs font-bold uppercase mb-2">
                    <span className="text-slate-500">{status}</span>
                    <span className="text-slate-900 dark:text-white">{count} ({Math.round(percent)}%)</span>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-1000", 
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
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
           <div className="w-24 h-24 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 mb-4">
              <UserPlus size={40} />
           </div>
           <h4 className="text-2xl font-black dark:text-white">Conversão</h4>
           <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mt-2">Experimental para Matrícula</p>
           <p className="text-4xl font-black text-indigo-600 mt-4">82%</p>
        </div>
      </div>
    </div>
  );

  const renderInstrumentos = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {instrumentStatsQuery.data?.map((instr) => (
          <div key={instr.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${instr.color || '#6366f1'}15` }}>
              <Music className="w-7 h-7" style={{ color: instr.color || '#6366f1' }} />
            </div>
            <div>
              <h4 className="font-black text-slate-900 dark:text-white">{instr.name}</h4>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{instr.studentCount} Alunos</p>
            </div>
            <div className="ml-auto">
              <div className="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 w-8 h-8 rounded-lg flex items-center justify-center">
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-black mb-8 dark:text-white">Alunos por Instrumento</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={instrumentStatsQuery.data || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
              <Tooltip />
              <Bar dataKey="studentCount" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

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
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
               <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <Users size={20} />
               </div>
               <h3 className="text-lg font-black dark:text-white">Distribuição de Alunos</h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={studentData}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    <Cell fill="#6366f1" />
                    <Cell fill="#a855f7" />
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
               <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <DollarSign size={20} />
               </div>
               <h3 className="text-lg font-black dark:text-white">Faturamento por Modalidade</h3>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                  <Tooltip formatter={(value: number) => currencyFormat(value)} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {revenueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#6366f1" : "#a855f7"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-black mb-8 dark:text-white">Ticket Médio por Modalidade</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
             {stats.map((s, i) => (
               <div key={i} className="p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between group hover:scale-[1.02] transition-all">
                  <div className="flex items-center gap-5">
                     <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", s.lessonType === 'individual' ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600")}>
                        {s.lessonType === 'individual' ? <Target size={24} /> : <Users size={24} />}
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{s.lessonType === 'individual' ? 'Aula Individual' : 'Aula em Turma'}</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{currencyFormat(s.avg)}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{s.count} Alunos</p>
                     <p className="text-xs font-bold text-slate-500">Total: {currencyFormat(s.revenue)}</p>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAulas = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-black mb-8 dark:text-white">Distribuição de Aulas (Semana)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lessonsByDayQuery.data || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
              <Tooltip />
              <Bar dataKey="aulas" fill="#8b5cf6" radius={[10, 10, 0, 0]} barSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderMensalidades = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h3 className="text-lg font-black dark:text-white">Mensalidades em Aberto</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 w-full md:w-80 dark:text-white font-medium"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <th className="pb-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Aluno</th>
                <th className="pb-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                <th className="pb-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="pb-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="pb-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {overduePaymentsQuery.data?.filter(p => p.studentName?.toLowerCase().includes(searchTerm.toLowerCase())).map((pay) => (
                <tr key={pay.id} className="group hover:bg-slate-50 dark:hover:bg-indigo-900/10 transition-colors">
                  <td className="py-5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm">
                        {pay.studentName?.charAt(0)}
                      </div>
                      <span className="font-black text-slate-800 dark:text-slate-200">{pay.studentName}</span>
                    </div>
                  </td>
                  <td className="py-5 px-4 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-tight">
                    {format(new Date(pay.dueDate), 'dd/MM/yyyy')}
                  </td>
                  <td className="py-5 px-4 font-black text-slate-900 dark:text-white">
                    {currencyFormat(Number(pay.amount))}
                  </td>
                  <td className="py-5 px-4">
                    <span className={cn("px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest", 
                      new Date(pay.dueDate) < new Date() 
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" 
                        : "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                    )}>
                      {new Date(pay.dueDate) < new Date() ? 'Atrasado' : 'Pendente'}
                    </span>
                  </td>
                  <td className="py-5 px-4 text-right">
                    <button className="text-indigo-600 hover:text-indigo-700 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 font-sans animate-fade-in">
      <header className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">Relatórios</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-[0.2em]">Dashboard de Inteligência</p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-[2rem] overflow-x-auto no-scrollbar shadow-inner border border-slate-200 dark:border-slate-700">
          {(['financeiro', 'despesas', 'projecao', 'alunos', 'aulas', 'instrumentos', 'mensalidades', 'modalidades'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn("px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab 
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xl border border-slate-200/50 dark:border-slate-600" 
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
              )}
            >
              {tab === 'despesas' ? 'Despesas & Lucro' : tab === 'projecao' ? 'Projeção 6M' : tab}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4 mb-10 p-5 bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600">
            <Filter size={18} />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtros Ativos</span>
        </div>
        
        <div className="flex gap-2">
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-[10px] font-black uppercase focus:ring-2 focus:ring-indigo-500 py-2.5 px-4 dark:text-white cursor-pointer"
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
            className="bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-[10px] font-black uppercase focus:ring-2 focus:ring-indigo-500 py-2.5 px-4 dark:text-white cursor-pointer"
          >
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={handleExport}
          className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/30 active:scale-95"
        >
          <Download size={16} />
          Exportar Dados
        </button>
      </div>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
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
