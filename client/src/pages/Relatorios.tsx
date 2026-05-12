import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, Download, Filter, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Music, CreditCard,
  CalendarDays, Search, CheckCircle2, UserPlus, Target, Clock,
  LayoutGrid
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
  title, value, trend, color, icon: Icon, onClick
}: { 
  title: string; value: string | number; trend: string; color: string; icon: any; onClick?: () => void;
}) {
  const isPositive = trend.startsWith('+');
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group cursor-default",
        onClick && "cursor-pointer hover:border-indigo-500/40 active:scale-[0.98]"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-6 shadow-sm", color.replace('text-', 'bg-') + '/10')}>
          <Icon size={18} className={color} />
        </div>
      </div>
      
      <div className="space-y-1">
        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</h3>
        <div className="flex items-center gap-1.5">
          <div className={cn("flex items-center gap-0.5 text-[10px] font-black", isPositive ? "text-emerald-500" : "text-rose-500")}>
            {isPositive ? <ArrowUpRight size={10} /> : <TrendingUp size={10} className="rotate-180" />}
            {trend}
          </div>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">vs mês anterior</span>
        </div>
      </div>
    </div>
  );
}

const Relatorios: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'financeiro' | 'alunos' | 'aulas' | 'instrumentos' | 'mensalidades'>('financeiro');
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
  const studentsQuery = trpc.students.list.useQuery();
  const overduePaymentsQuery = trpc.paymentDues.overdue.useQuery();

  // Export functionality
  const handleExport = () => {
    try {
      let csvContent = "data:text/csv;charset=utf-8,";
      
      if (activeTab === 'financeiro') {
        csvContent += "Mes,Alunos,Aulas,Receita\n";
        monthlyStatsQuery.data?.forEach(row => {
          csvContent += `${row.month},${row.alunos},${row.aulas},${row.receita}\n`;
        });
      } else if (activeTab === 'alunos') {
        csvContent += "ID,Nome,E-mail,Telefone,Status,Nivel\n";
        studentsQuery.data?.forEach(s => {
          csvContent += `${s.id},${s.name},${s.email || ''},${s.phone},${s.status},${s.level}\n`;
        });
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `relatorio_${activeTab}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Relatório exportado!');
    } catch (error) {
      toast.error('Erro ao exportar.');
    }
  };

  const renderFinanceiro = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <ReportMetricCard 
          title="Receita Recebida" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financeiroDetailsQuery.data?.pago || 0)} 
          trend="+12%" 
          color="text-emerald-500" 
          icon={DollarSign} 
        />
        <ReportMetricCard 
          title="A Receber" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financeiroDetailsQuery.data?.pendente || 0)} 
          trend="+5%" 
          color="text-amber-500" 
          icon={CalendarDays} 
        />
        <ReportMetricCard 
          title="Inadimplência" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financeiroDetailsQuery.data?.atrasado || 0)} 
          trend="-2%" 
          color="text-rose-500" 
          icon={CreditCard} 
        />
        <ReportMetricCard 
          title="Total Projetado" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(financeiroDetailsQuery.data?.total || 0)} 
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
              const count = studentsQuery.data?.filter(s => s.status === status.toLowerCase()).length || 0;
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
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${instr.color}15` }}>
              <Music className="w-7 h-7" style={{ color: instr.color }} />
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
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(pay.amount))}
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
      <header className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-2">
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">Relatórios</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-[0.2em]">Dashboard de Inteligência</p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-[2rem] overflow-x-auto no-scrollbar shadow-inner">
          {(['financeiro', 'alunos', 'aulas', 'instrumentos', 'mensalidades'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn("px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                activeTab === tab 
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xl" 
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
              )}
            >
              {tab}
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
            className="bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-[10px] font-black uppercase focus:ring-2 focus:ring-indigo-500 py-2.5 px-4 dark:text-white"
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
            className="bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-[10px] font-black uppercase focus:ring-2 focus:ring-indigo-500 py-2.5 px-4 dark:text-white"
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
            {activeTab === 'alunos' && renderAlunos()}
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
