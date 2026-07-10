import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Plus, ArrowRight, Play, Pause, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function MarketingDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  if (user?.role !== 'admin') {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground mt-2">Você não tem permissão para acessar o módulo de marketing.</p>
      </div>
    );
  }

  const { data: campaigns, refetch, isLoading } = trpc.marketing.getCampaigns.useQuery();
  const updateStatus = trpc.marketing.updateCampaignStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado com sucesso!");
      refetch();
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return <Badge className="bg-blue-500">Em andamento</Badge>;
      case 'completed': return <Badge className="bg-green-500">Concluída</Badge>;
      case 'paused': return <Badge className="bg-orange-500">Pausada</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      default: return <Badge variant="secondary">Rascunho</Badge>;
    }
  };

  const handleStatusChange = (campaignId: number, status: 'running' | 'paused') => {
    updateStatus.mutate({ campaignId, status });
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-primary" />
            Marketing e Campanhas
          </h1>
          <p className="text-muted-foreground">Envie mensagens em massa via WhatsApp de forma segura.</p>
        </div>
        <Button onClick={() => setLocation('/marketing/nova')} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Campanha
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Campanhas</CardTitle>
            <Megaphone className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Enviado</CardTitle>
            <Send className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns?.reduce((acc, c) => acc + c.sentCount, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Concluídas</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns?.filter(c => c.status === 'completed').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Falhas Recentes</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {campaigns?.reduce((acc, c) => acc + c.failedCount, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campanhas Recentes</CardTitle>
          <CardDescription>Gerencie suas campanhas de envio.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4">Carregando...</TableCell></TableRow>
                ) : campaigns?.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhuma campanha criada.</TableCell></TableRow>
                ) : (
                  campaigns?.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{format(new Date(c.createdAt), "dd 'de' MMM, yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{getStatusBadge(c.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {c.sentCount} / {c.totalContacts} ({c.totalContacts > 0 ? Math.round((c.sentCount / c.totalContacts) * 100) : 0}%)
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {c.status === 'paused' || c.status === 'draft' || c.status === 'error' ? (
                          <Button size="icon" variant="outline" onClick={() => handleStatusChange(c.id, 'running')} title="Iniciar/Retomar">
                            <Play className="w-4 h-4 text-green-500" />
                          </Button>
                        ) : c.status === 'running' ? (
                          <Button size="icon" variant="outline" onClick={() => handleStatusChange(c.id, 'paused')} title="Pausar">
                            <Pause className="w-4 h-4 text-orange-500" />
                          </Button>
                        ) : null}
                        <Button size="icon" variant="ghost" onClick={() => setLocation(`/marketing/${c.id}`)}>
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
