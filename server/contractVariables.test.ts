import { describe, it, expect } from "vitest";
import { buildContractVariables, type ContractVariablesInput } from "../server/services/contractService";

const base: ContractVariablesInput = {
  schoolName: "Escola de Música Teste",
  schoolCnpj: "11.222.333/0001-81",
  schoolAddress: "Rua da Escola",
  schoolNumber: "100",
  schoolDistrict: "Centro",
  schoolCity: "Vitória",
  schoolState: "ES",
  schoolCep: "29000-000",
  schoolRazaoSocial: "Escola Teste LTDA",
  schoolLegalRepName: "João Diretor",
  schoolLegalRepCpf: "111.222.333-44",
  studentName: "Aluno Teste",
  studentCpf: "222.333.444-55",
  studentBirthDate: "2015-05-10", // menor de idade
  studentStreet: "Rua do Aluno",
  studentNumber: "50",
  studentDistrict: "Praia",
  studentCity: "Vitória",
  studentState: "ES",
  studentCep: "29000-100",
  guardianName: "Maria Responsável",
  guardianCpf: "333.444.555-66",
  guardianRg: "1234567",
  monthlyFee: "180.00",
  dueDay: "10",
  startDate: "2026-10-03",
  endDate: "2027-10-03",
  contractNumber: "CT-2026-0007",
  planName: "Anual 1x/semana",
  durationMonths: 12,
  lessonsPerWeek: 1,
  valorCheio: "200.00",
  taxaInscricao: "60.00",
  now: new Date("2026-10-03T15:00:00Z"),
};

describe("Variáveis de contrato (padrão Emusys)", () => {
  it("preenche as variáveis novas com os dados do contrato/plano", () => {
    const v = buildContractVariables(base);
    expect(v.numero_contrato).toBe("CT-2026-0007");
    expect(v.ano_atual).toBe("2026");
    expect(v.data_hoje).toBe("03/10/2026");
    expect(v.data_hoje_extenso).toBe("3 de outubro de 2026");
    expect(v.nome_fantasia_escola).toBe("Escola de Música Teste");
    expect(v.razao_social_escola).toBe("Escola Teste LTDA");
    expect(v.cidade_escola).toBe("Vitória");
    expect(v.estado_escola).toBe("ES");
    expect(v.valor_parcela).toBe("180.00");
    expect(v.valor_parcela_sem_desconto).toBe("200.00");
    expect(v.meses_pagamento).toBe("12");
    expect(v.meses_aula).toBe("12");
    expect(v.aulas_por_semana).toBe("1");
    expect(v.quantidade_aulas_total).toBe("52"); // 1 × 4,333 × 12
    expect(v.data_inicial).toBe("03/10/2026");
    expect(v.data_final).toBe("03/10/2027");
    expect(v.nome_plano).toBe("Anual 1x/semana");
    expect(v.taxa_inscricao).toBe("60.00");
  });

  it("RN-004: aluno menor com responsável (nome+CPF) usa os dados do responsável no contratante", () => {
    const v = buildContractVariables(base);
    expect(v.nome_contratante).toBe("Maria Responsável");
    expect(v.cpf_contratante).toBe("333.444.555-66");
    expect(v.rg_contratante).toBe("1234567");
    expect(v.logradouro_contratante).toBe("Rua do Aluno");
    expect(v.numero_endereco_contratante).toBe("50");
    expect(v.cidade_contratante).toBe("Vitória");
    expect(v.estado_contratante).toBe("ES");
  });

  it("RN-004: sem CPF do responsável o contratante volta a ser o aluno", () => {
    const v = buildContractVariables({ ...base, guardianCpf: null });
    expect(v.nome_contratante).toBe("Aluno Teste");
    expect(v.cpf_contratante).toBe("222.333.444-55");
  });

  it("RN-004: aluno maior de idade usa os próprios dados mesmo com responsável cadastrado", () => {
    const v = buildContractVariables({ ...base, studentBirthDate: "2000-01-01" });
    expect(v.nome_contratante).toBe("Aluno Teste");
    expect(v.cpf_contratante).toBe("222.333.444-55");
  });

  it("usa o espelho do plano quando valor cheio não existe (A-03) e placeholders quando faltam dados", () => {
    const v = buildContractVariables({ ...base, valorCheio: null, contractNumber: null, durationMonths: null, lessonsPerWeek: null });
    expect(v.valor_parcela_sem_desconto).toBe("180.00");
    expect(v.numero_contrato).toBe("CT-____-____");
    expect(v.meses_pagamento).toBe("__________");
    expect(v.quantidade_aulas_total).toBe("__________");
  });

  it("mantém as variáveis legadas funcionando", () => {
    const v = buildContractVariables(base);
    expect(v.school_name).toBe("Escola de Música Teste");
    expect(v.school_cnpj).toBe("11.222.333/0001-81");
    expect(v.student_name).toBe("Aluno Teste");
    expect(v.student_cpf).toBe("222.333.444-55");
    expect(v.monthly_fee).toBe("180.00");
    expect(v.contract_start_date).toBe("03/10/2026");
    expect(v.contract_end_date).toBe("03/10/2027");
    expect(v.guardian_name).toBe("Maria Responsável");
    expect(v.guardian_cpf).toBe("333.444.555-66");
  });

  it("preenche a escola com fallback e linhas pontilhadas para campos vazios", () => {
    const v = buildContractVariables({ ...base, schoolCep: null, schoolNumber: null });
    expect(v.cep_escola).toBe("__________");
    expect(v.numero_endereco_escola).toBe("__________");
  });
});
