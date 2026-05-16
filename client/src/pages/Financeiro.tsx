import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import MensalidadesTab from "./financeiro/MensalidadesTab";
import { DespesasTab } from "./financeiro/DespesasTab";

const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function Financeiro() {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const { data: payments = [], isLoading: isLoadingPayments } = trpc.paymentDues.list.useQuery({ month: viewMonth, year: viewYear });
  const { data: expenses = [], isLoading: isLoadingExpenses } = trpc.expenses.list.useQuery({ month: viewMonth, year: viewYear });

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const currencyFormat = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const saldoLiquido = useMemo(() => {
    const sumRecebido = payments.filter(p => p.status === "pago").reduce((acc, p) => acc + Number(p.amount), 0);
    const sumGasto = expenses.filter(p => p.status === "pago").reduce((acc, p) => acc + Number(p.amount), 0);
    return sumRecebido - sumGasto;
  }, [payments, expenses]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden -m-4 sm:-m-6 bg-background">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 scrollbar-thin no-scrollbar">
        
        {/* Date Selector */}
        <div className="flex items-center justify-center gap-4 bg-card p-2 rounded-2xl border border-border shadow-sm w-fit mx-auto lg:mx-0">
           <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-lg"><ChevronLeft size={16} /></Button>
           <h3 className="text-xs font-black text-foreground min-w-[120px] text-center uppercase tracking-widest">
             {MONTHS_FULL[viewMonth-1]} {viewYear}
           </h3>
           <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-lg"><ChevronRight size={16} /></Button>
        </div>

        {/* Saldo Geral Líquido */}
        <div className={cn(
          "relative p-6 lg:p-8 rounded-[2rem] border shadow-sm overflow-hidden",
          saldoLiquido >= 0 ? "bg-gradient-to-br from-emerald-500/20 to-background border-emerald-500/30" : "bg-gradient-to-br from-rose-500/20 to-background border-rose-500/30"
        )}>
          <div className="flex items-center gap-4 relative z-10">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
              saldoLiquido >= 0 ? "bg-emerald-500/20 text-emerald-600" : "bg-rose-500/20 text-rose-600"
            )}>
              <Wallet size={24} />
            </div>
            <div>
              <p className={cn("text-[10px] font-bold uppercase tracking-widest", saldoLiquido >= 0 ? "text-emerald-700" : "text-rose-700")}>Saldo Geral Líquido</p>
              <p className="text-2xl lg:text-3xl font-black text-foreground mt-1">
                 {currencyFormat(saldoLiquido)}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground mt-1">Total recebido menos despesas pagas do mês.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="mensalidades" className="w-full">
          <TabsList className="w-full lg:w-auto grid grid-cols-2 lg:inline-flex mb-6 rounded-2xl bg-muted/50 p-1">
            <TabsTrigger value="mensalidades" className="rounded-xl text-xs font-bold uppercase tracking-widest h-10 data-[state=active]:bg-card data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Mensalidades</TabsTrigger>
            <TabsTrigger value="despesas" className="rounded-xl text-xs font-bold uppercase tracking-widest h-10 data-[state=active]:bg-card data-[state=active]:text-rose-600 data-[state=active]:shadow-sm">Despesas</TabsTrigger>
          </TabsList>

          <TabsContent value="mensalidades" className="mt-0">
            <MensalidadesTab viewMonth={viewMonth} viewYear={viewYear} payments={payments} isLoading={isLoadingPayments} />
          </TabsContent>
          
          <TabsContent value="despesas" className="mt-0">
            <DespesasTab viewMonth={viewMonth} viewYear={viewYear} expenses={expenses} isLoading={isLoadingExpenses} />
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
