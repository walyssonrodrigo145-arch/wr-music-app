import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  Receipt,
  ShieldCheck,
  Zap,
  Plus,
  Trash2,
  Pencil,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCheck,
  Layers,
  Settings,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function ConfigFiscalTab() {
  const utils = trpc.useUtils();
  const { data: company, isLoading: isLoadingCompany } = trpc.fiscal.company.get.useQuery();
  const { data: services = [], isLoading: isLoadingServices } = trpc.fiscal.services.list.useQuery();

  const [form, setForm] = useState({
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    inscricaoMunicipal: "",
    inscricaoEstadual: "",
    regimeTributario: "simples_nacional" as "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei",
    optanteSimplesNacional: true,
    tipoEmissaoNfse: "automatico" as "municipal" | "nacional" | "automatico",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "SP",
    codigoMunicipio: "",
    telefone: "",
    email: "",
    focusApiKey: "",
    autoEmitOnPayment: false,
    emitTiming: "imediato",
    autoEmailInvoice: true,
    autoRetryErrors: true,
  });

  // Modal de Serviço
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [serviceForm, setServiceForm] = useState({
    nome: "",
    codigoServico: "",
    codigoTributacaoMunicipio: "",
    itemListaServico: "08.01",
    aliquotaIss: "0.00",
    naturezaOperacao: "1",
    descricaoPadrao: "Mensalidade referente a aulas de musica - Competencia {competencia}",
    issRetido: false,
    ativo: true,
  });

  useEffect(() => {
    if (company) {
      setForm({
        cnpj: company.cnpj || "",
        razaoSocial: company.razaoSocial || "",
        nomeFantasia: company.nomeFantasia || "",
        inscricaoMunicipal: company.inscricaoMunicipal || "",
        inscricaoEstadual: company.inscricaoEstadual || "",
        regimeTributario: (company.regimeTributario as any) || "simples_nacional",
        optanteSimplesNacional: company.optanteSimplesNacional ?? true,
        tipoEmissaoNfse: (company.tipoEmissaoNfse as any) || "automatico",
        cep: company.cep || "",
        logradouro: company.logradouro || "",
        numero: company.numero || "",
        complemento: company.complemento || "",
        bairro: company.bairro || "",
        cidade: company.cidade || "",
        uf: company.uf || "SP",
        codigoMunicipio: company.codigoMunicipio || "",
        telefone: company.telefone || "",
        email: company.email || "",
        focusApiKey: company.focusApiKey || "",
        autoEmitOnPayment: company.autoEmitOnPayment ?? false,
        emitTiming: company.emitTiming || "imediato",
        autoEmailInvoice: company.autoEmailInvoice ?? true,
        autoRetryErrors: company.autoRetryErrors ?? true,
      });
    }
  }, [company]);

  const saveCompanyMutation = trpc.fiscal.company.save.useMutation({
    onSuccess: () => {
      toast.success("Configurações fiscais salvas com sucesso!");
      utils.fiscal.company.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createServiceMutation = trpc.fiscal.services.create.useMutation({
    onSuccess: () => {
      toast.success("Serviço fiscal cadastrado!");
      setServiceModalOpen(false);
      utils.fiscal.services.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateServiceMutation = trpc.fiscal.services.update.useMutation({
    onSuccess: () => {
      toast.success("Serviço fiscal atualizado!");
      setServiceModalOpen(false);
      utils.fiscal.services.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteServiceMutation = trpc.fiscal.services.delete.useMutation({
    onSuccess: () => {
      toast.success("Serviço fiscal excluído!");
      utils.fiscal.services.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveCompany = () => {
    if (!form.cnpj || !form.razaoSocial) {
      toast.error("Informe o CNPJ e a Razão Social da escola");
      return;
    }
    saveCompanyMutation.mutate(form);
  };

  const handleSaveService = () => {
    if (!serviceForm.nome || !serviceForm.codigoServico) {
      toast.error("Preencha o nome e o código do serviço");
      return;
    }
    if (editingServiceId) {
      updateServiceMutation.mutate({ id: editingServiceId, ...serviceForm });
    } else {
      createServiceMutation.mutate(serviceForm);
    }
  };

  const handleOpenEditService = (srv: any) => {
    setEditingServiceId(srv.id);
    setServiceForm({
      nome: srv.nome,
      codigoServico: srv.codigoServico,
      codigoTributacaoMunicipio: srv.codigoTributacaoMunicipio || "",
      itemListaServico: srv.itemListaServico || "08.01",
      aliquotaIss: String(srv.aliquotaIss || "0.00"),
      naturezaOperacao: srv.naturezaOperacao || "1",
      descricaoPadrao: srv.descricaoPadrao,
      issRetido: srv.issRetido,
      ativo: srv.ativo,
    });
    setServiceModalOpen(true);
  };

  if (isLoadingCompany) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="animate-spin inline mr-2 text-emerald-500" size={24} />
        Carregando configurações fiscais...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* 1. Dados da Empresa */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-border/60 pb-3">
          <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-500">
            <Building2 size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Dados Fiscais da Escola (Prestador)</h3>
            <p className="text-xs text-muted-foreground">
              Informações cadastrais e endereço da pessoa jurídica emissora da NFS-e.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <Label className="text-xs font-bold">CNPJ *</Label>
            <Input
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs font-mono"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Razão Social *</Label>
            <Input
              value={form.razaoSocial}
              onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
              placeholder="Ex: Escola de Música Harmonia LTDA"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Nome Fantasia</Label>
            <Input
              value={form.nomeFantasia}
              onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
              placeholder="Ex: WR Music Pro"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Inscrição Municipal</Label>
            <Input
              value={form.inscricaoMunicipal}
              onChange={(e) => setForm({ ...form, inscricaoMunicipal: e.target.value })}
              placeholder="Ex: 1234567-8"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs font-mono"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Inscrição Estadual</Label>
            <Input
              value={form.inscricaoEstadual}
              onChange={(e) => setForm({ ...form, inscricaoEstadual: e.target.value })}
              placeholder="Isento ou número"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs font-mono"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Código Município (IBGE)</Label>
            <Input
              value={form.codigoMunicipio}
              onChange={(e) => setForm({ ...form, codigoMunicipio: e.target.value })}
              placeholder="Ex: 3550308 (São Paulo)"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs font-mono"
            />
          </div>
        </div>

        {/* Endereço */}
        <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <Label className="text-xs font-bold">CEP</Label>
            <Input
              value={form.cep}
              onChange={(e) => setForm({ ...form, cep: e.target.value })}
              placeholder="00000-000"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs font-mono"
            />
          </div>

          <div className="lg:col-span-2">
            <Label className="text-xs font-bold">Logradouro / Rua</Label>
            <Input
              value={form.logradouro}
              onChange={(e) => setForm({ ...form, logradouro: e.target.value })}
              placeholder="Av. Paulista"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Número</Label>
            <Input
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              placeholder="1000"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Complemento</Label>
            <Input
              value={form.complemento}
              onChange={(e) => setForm({ ...form, complemento: e.target.value })}
              placeholder="Sala 42"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Bairro</Label>
            <Input
              value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              placeholder="Bela Vista"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">Cidade</Label>
            <Input
              value={form.cidade}
              onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              placeholder="São Paulo"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-bold">UF (Estado)</Label>
            <Input
              value={form.uf}
              onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
              maxLength={2}
              placeholder="SP"
              className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs font-bold uppercase"
            />
          </div>
        </div>
      </div>

      {/* 2. Regime Tributário & NFS-e */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Regime Tributário */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4 text-xs">
          <div className="flex items-center gap-3 border-b border-border/60 pb-3">
            <div className="p-2 rounded-2xl bg-blue-500/10 text-blue-400">
              <Receipt size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Regime Tributário</h3>
              <p className="text-xs text-muted-foreground">Configuração para cálculo correto de alíquotas.</p>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">Regime Tributário</Label>
            <Select
              value={form.regimeTributario}
              onValueChange={(val: any) => setForm({ ...form, regimeTributario: val })}
            >
              <SelectTrigger className="mt-1.5 h-11 rounded-2xl border-border bg-background font-medium text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border bg-card">
                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                <SelectItem value="mei">Microempreendedor Individual (MEI)</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-border">
            <div>
              <Label className="text-xs font-bold block">Optante pelo Simples Nacional?</Label>
              <span className="text-[10px] text-muted-foreground">Gera campo optante_simples_nacional na NFS-e</span>
            </div>
            <Switch
              checked={form.optanteSimplesNacional}
              onCheckedChange={(val) => setForm({ ...form, optanteSimplesNacional: val })}
            />
          </div>
        </div>

        {/* Tipo de Emissão NFS-e & Certificado */}
        <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4 text-xs">
          <div className="flex items-center gap-3 border-b border-border/60 pb-3">
            <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Padrão NFS-e & Certificado</h3>
              <p className="text-xs text-muted-foreground">Modelo de transmissão municipal/nacional.</p>
            </div>
          </div>

          <div>
            <Label className="text-xs font-bold">Padrão de Emissão</Label>
            <Select
              value={form.tipoEmissaoNfse}
              onValueChange={(val: any) => setForm({ ...form, tipoEmissaoNfse: val })}
            >
              <SelectTrigger className="mt-1.5 h-11 rounded-2xl border-border bg-background font-medium text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border bg-card">
                <SelectItem value="automatico">Automático (Recomendado)</SelectItem>
                <SelectItem value="municipal">NFS-e Municipal (Prefeitura)</SelectItem>
                <SelectItem value="nacional">NFS-e Nacional (Padrão Gov)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3.5 rounded-2xl bg-muted/30 border border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <div>
                <p className="font-bold text-xs">Certificado Digital A1</p>
                <p className="text-[10px] text-muted-foreground">Focus NFe Cloud / Conectado</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold h-8 border-border">
              Atualizar Certificado
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Gestão de Serviços Fiscais */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-purple-500/10 text-purple-400">
              <Layers size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-foreground">Serviços Fiscais Cadastrados</h3>
              <p className="text-xs text-muted-foreground">
                Cadastre os códigos de serviço municipais utilizados nas notas fiscais de mensalidades e cursos.
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setEditingServiceId(null);
              setServiceForm({
                nome: "",
                codigoServico: "",
                codigoTributacaoMunicipio: "",
                itemListaServico: "08.01",
                aliquotaIss: "0.00",
                naturezaOperacao: "1",
                descricaoPadrao: "Mensalidade referente a aulas de musica - Competencia {competencia}",
                issRetido: false,
                ativo: true,
              });
              setServiceModalOpen(true);
            }}
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 text-xs gap-1.5 shrink-0"
          >
            <Plus size={16} /> Novo Serviço
          </Button>
        </div>

        {services.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-xs">
            Nenhum serviço fiscal configurado. Clique em &quot;Novo Serviço&quot; para cadastrar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((srv: any) => (
              <div
                key={srv.id}
                className="p-4 rounded-2xl border border-border bg-background flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{srv.nome}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
                      Cód: {srv.codigoServico}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {srv.descricaoPadrao}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2 font-medium">
                    <span>ISS: {srv.aliquotaIss}%</span>
                    <span>Item LC 116: {srv.itemListaServico || "08.01"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEditService(srv)}
                    className="h-8 w-8 rounded-lg hover:bg-muted"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteServiceMutation.mutate({ id: srv.id })}
                    className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Automações & Notificações */}
      <div className="p-6 rounded-3xl border border-border bg-card shadow-sm space-y-4 text-xs">
        <div className="flex items-center gap-3 border-b border-border/60 pb-3">
          <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-500">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">Automação de Emissão</h3>
            <p className="text-xs text-muted-foreground">Regras de disparo automático após pagamentos.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border">
            <div>
              <Label className="text-xs font-bold block">Emitir NFS-e automaticamente após pagamento</Label>
              <span className="text-[10px] text-muted-foreground">
                Gera a solicitação na fila fiscal assim que o pagamento da mensalidade for confirmado.
              </span>
            </div>
            <Switch
              checked={form.autoEmitOnPayment}
              onCheckedChange={(val) => setForm({ ...form, autoEmitOnPayment: val })}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border">
            <div>
              <Label className="text-xs font-bold block">Enviar nota fiscal por e-mail ao aluno</Label>
              <span className="text-[10px] text-muted-foreground">
                Dispara o link do PDF/XML assim que a nota for autorizada pela prefeitura.
              </span>
            </div>
            <Switch
              checked={form.autoEmailInvoice}
              onCheckedChange={(val) => setForm({ ...form, autoEmailInvoice: val })}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border">
            <div>
              <Label className="text-xs font-bold block">Reprocessamento automático com backoff</Label>
              <span className="text-[10px] text-muted-foreground">
                Tenta retransmitir automaticamente em caso de instabilidade na prefeitura.
              </span>
            </div>
            <Switch
              checked={form.autoRetryErrors}
              onCheckedChange={(val) => setForm({ ...form, autoRetryErrors: val })}
            />
          </div>
        </div>
      </div>

      {/* Botão de Salvar Alterações da Escola */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveCompany}
          disabled={saveCompanyMutation.isPending}
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8 text-xs shadow-lg shadow-emerald-950/20 gap-2"
        >
          {saveCompanyMutation.isPending ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Salvando...
            </>
          ) : (
            <>
              <Save size={16} /> Salvar Configurações Fiscais
            </>
          )}
        </Button>
      </div>

      {/* Modal Criar / Editar Serviço Fiscal */}
      <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
        <DialogContent className="max-w-md rounded-3xl border-border bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Layers className="text-emerald-500" size={20} />
              {editingServiceId ? "Editar Serviço Fiscal" : "Novo Serviço Fiscal"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-bold">Nome do Serviço *</Label>
              <Input
                value={serviceForm.nome}
                onChange={(e) => setServiceForm({ ...serviceForm, nome: e.target.value })}
                placeholder="Ex: Mensalidade de Aulas de Música"
                className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Código do Serviço *</Label>
                <Input
                  value={serviceForm.codigoServico}
                  onChange={(e) => setServiceForm({ ...serviceForm, codigoServico: e.target.value })}
                  placeholder="Ex: 0801 ou 08.01.01"
                  className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-bold">Alíquota ISS (%)</Label>
                <Input
                  value={serviceForm.aliquotaIss}
                  onChange={(e) => setServiceForm({ ...serviceForm, aliquotaIss: e.target.value })}
                  placeholder="2.00"
                  className="mt-1.5 h-11 rounded-2xl bg-background border-border text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold">Descrição Padrão da NFS-e *</Label>
              <Textarea
                rows={3}
                value={serviceForm.descricaoPadrao}
                onChange={(e) => setServiceForm({ ...serviceForm, descricaoPadrao: e.target.value })}
                placeholder="Mensalidade referente às aulas de {instrumento} - Competência {competencia}"
                className="mt-1.5 rounded-2xl bg-background border-border text-xs resize-none"
              />
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Variáveis dinâmicas suportadas: {"{aluno}"}, {"{instrumento}"}, {"{competencia}"}, {"{valor}"}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setServiceModalOpen(false)}
              className="rounded-2xl h-11 text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveService}
              disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-5 text-xs shadow-lg shadow-emerald-950/20"
            >
              Salvar Serviço
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
