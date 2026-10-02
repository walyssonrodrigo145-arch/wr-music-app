/**
 * shared/contractVariablesCatalog.ts — Catálogo das variáveis de contrato para a
 * UI (Modelos de Contrato). Os tokens DEVEM existir em
 * `server/services/contractService.ts` (buildContractVariables).
 *
 * Padrão Emusys: variáveis em português, agrupadas por categoria, com label
 * amigável. As variáveis "Legado" continuam funcionando em modelos antigos.
 */

export interface ContractVariableItem {
  token: string;
  label: string;
}

export interface ContractVariableCategory {
  id: string;
  title: string;
  description: string;
  items: ContractVariableItem[];
}

export const CONTRACT_VARIABLE_CATEGORIES: ContractVariableCategory[] = [
  {
    id: "contrato",
    title: "Contrato",
    description: "Número e datas da emissão",
    items: [
      { token: "numero_contrato", label: "Número do Contrato" },
      { token: "ano_atual", label: "Ano Atual" },
      { token: "data_hoje", label: "Data de Hoje" },
      { token: "data_hoje_extenso", label: "Data de Hoje por Extenso" },
    ],
  },
  {
    id: "contratante",
    title: "Contratante",
    description: "Aluno (ou responsável, quando menor)",
    items: [
      { token: "nome_contratante", label: "Nome do Contratante" },
      { token: "rg_contratante", label: "RG do Contratante" },
      { token: "cpf_contratante", label: "CPF do Contratante" },
      { token: "logradouro_contratante", label: "Logradouro do Contratante" },
      { token: "numero_endereco_contratante", label: "Número do Endereço do Contratante" },
      { token: "complemento_contratante", label: "Complemento do Contratante" },
      { token: "bairro_contratante", label: "Bairro do Contratante" },
      { token: "cep_contratante", label: "CEP do Contratante" },
      { token: "cidade_contratante", label: "Cidade do Contratante" },
      { token: "estado_contratante", label: "Estado do Contratante" },
      { token: "telefone_contratante", label: "Telefone do Contratante" },
      { token: "email_contratante", label: "E-mail do Contratante" },
    ],
  },
  {
    id: "contratada",
    title: "Contratada (Escola)",
    description: "Dados cadastrais da escola",
    items: [
      { token: "nome_fantasia_escola", label: "Nome Fantasia da Escola" },
      { token: "razao_social_escola", label: "Razão Social da Escola" },
      { token: "cnpj_escola", label: "CNPJ da Escola" },
      { token: "logradouro_escola", label: "Logradouro da Escola" },
      { token: "numero_endereco_escola", label: "Número do Endereço da Escola" },
      { token: "complemento_escola", label: "Complemento da Escola" },
      { token: "bairro_escola", label: "Bairro da Escola" },
      { token: "cep_escola", label: "CEP da Escola" },
      { token: "cidade_escola", label: "Cidade da Escola" },
      { token: "estado_escola", label: "Estado da Escola" },
      { token: "telefone_escola", label: "Telefone da Escola" },
      { token: "email_escola", label: "E-mail da Escola" },
      { token: "nome_responsavel_escola", label: "Nome do Responsável pela Escola" },
      { token: "rg_responsavel_escola", label: "RG do Responsável pela Escola" },
      { token: "cpf_responsavel_escola", label: "CPF do Responsável pela Escola" },
      { token: "cidade_responsavel_escola", label: "Cidade do Responsável pela Escola" },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description: "Valores e parcelas",
    items: [
      { token: "valor_parcela", label: "Valor da Parcela" },
      { token: "valor_parcela_sem_desconto", label: "Valor da Parcela sem Desconto" },
      { token: "meses_pagamento", label: "Meses de Pagamento" },
      { token: "taxa_inscricao", label: "Taxa de Inscrição" },
      { token: "dia_vencimento", label: "Dia do Vencimento" },
    ],
  },
  {
    id: "vigencia",
    title: "Vigência e Aulas",
    description: "Duração do contrato e aulas previstas",
    items: [
      { token: "data_inicial", label: "Data Inicial" },
      { token: "data_final", label: "Data Final" },
      { token: "meses_aula", label: "Meses de Aula" },
      { token: "aulas_por_semana", label: "Aulas por Semana" },
      { token: "quantidade_aulas_total", label: "Quantidade de Aulas no Total" },
      { token: "nome_plano", label: "Nome do Plano" },
    ],
  },
  {
    id: "legado",
    title: "Legado (compatibilidade)",
    description: "Variáveis dos modelos já existentes",
    items: [
      { token: "school_name", label: "Escola — Nome (legado)" },
      { token: "school_cnpj", label: "Escola — CNPJ (legado)" },
      { token: "school_address", label: "Escola — Endereço (legado)" },
      { token: "school_phone", label: "Escola — Telefone (legado)" },
      { token: "school_email", label: "Escola — E-mail (legado)" },
      { token: "student_name", label: "Aluno — Nome (legado)" },
      { token: "student_cpf", label: "Aluno — CPF (legado)" },
      { token: "student_rg", label: "Aluno — RG (legado)" },
      { token: "student_birth_date", label: "Aluno — Nascimento (legado)" },
      { token: "student_email", label: "Aluno — E-mail (legado)" },
      { token: "student_phone", label: "Aluno — Telefone (legado)" },
      { token: "student_address", label: "Aluno — Endereço (legado)" },
      { token: "guardian_name", label: "Responsável — Nome (legado)" },
      { token: "guardian_cpf", label: "Responsável — CPF (legado)" },
      { token: "guardian_rg", label: "Responsável — RG (legado)" },
      { token: "guardian_phone", label: "Responsável — Telefone (legado)" },
      { token: "guardian_email", label: "Responsável — E-mail (legado)" },
      { token: "guardian_address", label: "Responsável — Endereço (legado)" },
      { token: "instrument", label: "Instrumento (legado)" },
      { token: "monthly_fee", label: "Mensalidade (legado)" },
      { token: "due_date", label: "Dia do Vencimento (legado)" },
      { token: "contract_start_date", label: "Início do Contrato (legado)" },
      { token: "contract_end_date", label: "Término do Contrato (legado)" },
    ],
  },
];
