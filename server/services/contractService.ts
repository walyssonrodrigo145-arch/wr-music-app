/**
 * contractService.ts — Orquestração do módulo de contratos digitais.
 *
 * Fluxo: renderiza o PDF do contrato → envia para o provedor (Assinafy)
 * → cria signatário → gera processo de assinatura → persiste contrato + eventos.
 *
 * Multi-tenancy: TODA operação recebe orgId validado pelo chamador.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { addMonthsClamped } from "@shared/contractDates";
import { formatAddressForContract } from "@shared/address";

const DEFAULT_TEMPLATE_CONTENT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS

Pelo presente instrumento particular, de um lado {{school_name}}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {{school_cnpj}}, com sede em {{school_address}}, doravante denominada CONTRATADA, e de outro lado {{student_name}}, inscrito(a) no CPF sob o nº {{student_cpf}}, residente em {{student_address}}, doravante denominado(a) CONTRATANTE, têm entre si justo e acertado o presente Contrato de Prestação de Serviços Educacionais, que se regerá pelas seguintes cláusulas:

CLÁUSULA 1ª — DO OBJETO
O presente contrato tem como objeto a prestação de serviços educacionais de aulas de {{instrument}}, ministradas pela CONTRATADA ao CONTRATANTE, conforme grade pedagógica da instituição.

CLÁUSULA 2ª — DA MENSAALIDADE
Pela prestação dos serviços, o CONTRATANTE pagará à CONTRATADA o valor mensal de R$ {{monthly_fee}}, com vencimento todo dia {{due_date}} de cada mês.

CLÁUSULA 3ª — DA VIGÊNCIA
O presente contrato terá vigência de {{contract_start_date}} a {{contract_end_date}}.

CLÁUSULA 4ª — DO PAGAMENTO
O pagamento será realizado por meio de boleto, PIX ou cartão de crédito, conforme disponibilizado pela CONTRATADA. O atraso no pagamento sujeitará o CONTRATANTE aos encargos previstos na política financeira da instituição.

CLÁUSULA 5ª — DA RESCISÃO
O CONTRATANTE poderá solicitar a rescisão deste contrato mediante comunicação prévia, respeitando as condições previstas na política interna da CONTRATADA.

CLÁUSULA 6ª — DO FORO
Fica eleito o foro da comarca da CONTRATADA para dirimir quaisquer dúvidas oriundas do presente contrato.

E, por estarem assim justos e contratados, firmam o presente instrumento em via digital, para que produza seus jurídicos e legais efeitos.

{{school_name}}
CNPJ: {{school_cnpj}}
E-mail: {{school_email}} • Telefone: {{school_phone}}

{{student_name}}
CPF: {{student_cpf}}
E-mail: {{student_email}} • Telefone: {{student_phone}}`;

const DEFAULT_MINOR_TEMPLATE_CONTENT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS
(ALUNO MENOR DE IDADE — REPRESENTADO POR RESPONSÁVEL LEGAL)

Pelo presente instrumento particular, de um lado {{school_name}}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {{school_cnpj}}, com sede em {{school_address}}, doravante denominada CONTRATADA, e de outro lado:

CONTRATANTE / RESPONSÁVEL LEGAL:
Nome: {{guardian_name}}
CPF: {{guardian_cpf}}
Telefone: {{guardian_phone}} • E-mail: {{guardian_email}}
Endereço: {{guardian_address}}

REPRESENTANDO O(A) ALUNO(A) BENEFICIÁRIO(A):
Nome do(a) Aluno(a): {{student_name}}
Data de Nascimento: {{student_birth_date}} • CPF: {{student_cpf}}

Têm entre si justo e acertado o presente Contrato de Prestação de Serviços Educacionais, que se regerá pelas seguintes cláusulas:

CLÁUSULA 1ª — DO OBJETO
O presente contrato tem como objeto a prestação de serviços educacionais de aulas de {{instrument}}, ministradas pela CONTRATADA ao(à) ALUNO(A) beneficiário(a), devidamente representado(a) pelo(a) CONTRATANTE, conforme grade pedagógica e horários estabelecidos pela instituição.

CLÁUSULA 2ª — DAS OBRIGAÇÕES DO RESPONSÁVEL LEGAL (CONTRATANTE)
O(A) CONTRATANTE, na qualidade de responsável legal pelo(a) menor de idade, assume integral responsabilidade civil e financeira por todas as obrigações decorrentes deste instrumento, comprometendo-se a honrar a pontualidade nos pagamentos, acompanhar a assiduidade escolar e zelar pelo cumprimento das normas da instituição.

CLÁUSULA 3ª — DA MENSALIDADE E FORMA DE PAGAMENTO
Pela prestação dos serviços educacionais, o(a) CONTRATANTE pagará à CONTRATADA o valor mensal de R$ {{monthly_fee}}, com vencimento todo dia {{due_date}} de cada mês.
Parágrafo Único: O pagamento poderá ser realizado por meio de boleto bancário, PIX ou cartão de crédito. O atraso sujeitará o(a) CONTRATANTE aos encargos de mora e multa previstos na política da CONTRATADA.

CLÁUSULA 4ª — DA VIGÊNCIA
O presente contrato terá vigência de {{contract_start_date}} a {{contract_end_date}}.

CLÁUSULA 5ª — DA RESCISÃO
O(A) CONTRATANTE poderá solicitar a rescisão deste contrato mediante comunicação prévia por escrito com antecedência mínima de 30 (trinta) dias, quitando eventuais débitos pendentes até a data do encerramento.

CLÁUSULA 6ª — DO FORO
Fica eleito o foro da comarca da CONTRATADA para dirimir quaisquer dúvidas oriundas do presente contrato.

E, por estarem assim justos e contratados, firmam o presente instrumento em via digital, para que produza seus jurídicos e legais efeitos.

{{school_name}}
CNPJ: {{school_cnpj}}
E-mail: {{school_email}} • Telefone: {{school_phone}}

CONTRATANTE / RESPONSÁVEL LEGAL:
Nome: {{guardian_name}}
CPF: {{guardian_cpf}}
E-mail: {{guardian_email}} • Telefone: {{guardian_phone}}

ALUNO(A) BENEFICIÁRIO(A):
Nome: {{student_name}}`;

export function buildDefaultTemplateContent(): string {
  return DEFAULT_TEMPLATE_CONTENT;
}

export function buildMinorTemplateContent(): string {
  return DEFAULT_MINOR_TEMPLATE_CONTENT;
}

// ─── Renderização do PDF ──────────────────────────────────────────────────────
export async function renderContractPdf(
  templateContent: string,
  variables: Record<string, string>
): Promise<Buffer> {
  let text = templateContent;
  for (const [key, value] of Object.entries(variables)) {
    text = text.split(`{{${key}}}`).join(value ?? "");
  }
  // Remove qualquer variável não preenchida
  text = text.replace(/\{\{[^}]+\}\}/g, "");

  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28; // A4
  const PAGE_HEIGHT = 841.89; // A4
  const margin = 50;
  const maxWidth = PAGE_WIDTH - margin * 2;
  const lineHeight = 15;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - margin;

  const pushLine = (lineText: string, font: any, size: number) => {
    // Se não couber mais nesta página, cria a próxima página e reseta o cursor Y
    if (y < margin + lineHeight) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - margin;
    }
    currentPage.drawText(lineText, {
      x: margin,
      y,
      size,
      font,
      color: rgb(0.12, 0.12, 0.12),
      lineHeight,
    });
    y -= lineHeight;
  };

  const drawParagraph = (paragraph: string, opts: { bold?: boolean; size?: number; gapAfter?: number } = {}) => {
    const size = opts.size ?? 10.5;
    const font = opts.bold ? helveticaBold : helvetica;
    const words = paragraph.split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, size) > maxWidth && currentLine) {
        pushLine(currentLine, font, size);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      pushLine(currentLine, font, size);
    }
    y -= (opts.gapAfter ?? 6);
  };

  const lines = text.split(/\n+/).filter((l) => l.trim().length > 0);
  for (const line of lines) {
    const trimmed = line.trim();
    const isMainTitle = trimmed === "CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS";
    const isClause = trimmed.startsWith("CLÁUSULA ") || trimmed.startsWith("CONTRATANTE") || trimmed.startsWith("CONTRATADA") || trimmed.startsWith("ALUNO(A)") || trimmed.startsWith("REPRESENTANDO");
    const isSubTitle = trimmed.startsWith("(") && trimmed.endsWith(")");

    if (isMainTitle) {
      drawParagraph(trimmed, { bold: true, size: 13, gapAfter: 4 });
    } else if (isSubTitle) {
      drawParagraph(trimmed, { bold: true, size: 10, gapAfter: 12 });
    } else if (isClause) {
      drawParagraph(trimmed, { bold: true, size: 11, gapAfter: 6 });
    } else {
      drawParagraph(trimmed, { bold: false, size: 10.5, gapAfter: 6 });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

// ─── Variáveis do contrato ────────────────────────────────────────────────────
export interface ContractVariablesInput {
  schoolName?: string | null;
  schoolCnpj?: string | null;
  schoolAddress?: string | null;
  schoolCity?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  // PRD_ENDERECO_CONTRATOS_VARIAVEIS: dados completos da CONTRATADA
  schoolRazaoSocial?: string | null;
  schoolNumber?: string | null;
  schoolComplement?: string | null;
  schoolDistrict?: string | null;
  schoolCep?: string | null;
  schoolState?: string | null;
  schoolLegalRepName?: string | null;
  schoolLegalRepRg?: string | null;
  schoolLegalRepCpf?: string | null;
  studentName: string;
  studentCpf?: string | null;
  studentRg?: string | null;
  studentBirthDate?: string | null;
  studentEmail?: string | null;
  studentPhone?: string | null;
  studentAddress?: string | null;
  // Endereço estruturado do contratante (aluno/responsável)
  studentStreet?: string | null;
  studentNumber?: string | null;
  studentComplement?: string | null;
  studentDistrict?: string | null;
  studentCep?: string | null;
  studentCity?: string | null;
  studentState?: string | null;
  guardianName?: string | null;
  guardianCpf?: string | null;
  guardianRg?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  guardianAddress?: string | null;
  instrument?: string | null;
  monthlyFee?: string | null;
  dueDay?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  // Execução do contrato (plano/matrícula)
  contractNumber?: string | null;
  planName?: string | null;
  durationMonths?: number | null;
  lessonsPerWeek?: number | null;
  totalLessons?: number | null;
  valorCheio?: string | null;
  taxaInscricao?: string | null;
  now?: Date;
}

/** Idade em anos a partir de uma data ISO (BRT). */
function ageFromISOBirth(birth?: string | null, now: Date = new Date()): number | null {
  const match = String(birth || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now) + "T12:00:00Z");
  let age = today.getUTCFullYear() - y;
  const beforeBirthday = today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function buildContractVariables(input: ContractVariablesInput): Record<string, string> {
  const fmtDate = (d?: string | null) => {
    if (!d) return "____/____/________";
    const [y, m, day] = String(d).slice(0, 10).split("-");
    if (!y || !m || !day) return d;
    return `${day}/${m}/${y}`;
  };
  const orBlank = (v?: string | number | null) => (v === null || v === undefined || v === "" ? "__________" : String(v));

  const now = input.now ?? new Date();
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const dataHoje = fmtDate(todayISO);
  const dataHojeExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long", year: "numeric" }).format(now);
  const anoAtual = todayISO.slice(0, 4);

  // RN-004 (A-01): contratante = responsável quando o aluno é menor E há nome+CPF do responsável
  const age = ageFromISOBirth(input.studentBirthDate, now);
  const useGuardian = age !== null && age < 18 && Boolean(input.guardianName && input.guardianCpf);
  const contratanteNome = useGuardian ? input.guardianName! : input.studentName;
  const contratanteCpf = useGuardian ? input.guardianCpf : input.studentCpf;
  const contratanteRg = useGuardian ? input.guardianRg : input.studentRg;

  // Endereço do contratante (responsável mora com o menor — usa o endereço do aluno)
  const contratanteLogradouro = input.studentStreet || input.studentAddress || null;
  const contratanteCidade = input.studentCity || null;
  const contratanteEstado = input.studentState || null;

  const totalLessons = input.totalLessons ??
    (input.durationMonths && input.lessonsPerWeek ? Math.round(input.lessonsPerWeek * 4.333 * input.durationMonths) : null);

  // A-03: valor cheio do plano (bolsa) quando existir; senão a própria parcela
  const valorSemDesconto = input.valorCheio && Number(String(input.valorCheio).replace(",", ".")) > 0
    ? input.valorCheio
    : input.monthlyFee;

  const schoolAddressFull = [
    input.schoolAddress,
    input.schoolNumber ? `nº ${input.schoolNumber}` : null,
    input.schoolComplement,
    input.schoolDistrict,
    [input.schoolCity, input.schoolState].filter(Boolean).join(" - ") || null,
    input.schoolCep ? `CEP ${input.schoolCep}` : null,
  ].map((p) => (p || "").trim()).filter(Boolean).join(", ") || [input.schoolAddress, input.schoolCity].filter(Boolean).join(", ");

  return {
    // ─── Legado (mantido para compatibilidade) ───
    school_name: input.schoolName || "A escola",
    school_cnpj: input.schoolCnpj || "__________",
    school_address: schoolAddressFull || "__________",
    school_phone: input.schoolPhone || "__________",
    school_email: input.schoolEmail || "__________",
    student_name: input.studentName,
    student_cpf: input.studentCpf || "__________",
    student_rg: input.studentRg || "__________",
    student_birth_date: fmtDate(input.studentBirthDate),
    student_email: input.studentEmail || "__________",
    student_phone: input.studentPhone || "__________",
    student_address: input.studentAddress || "__________",
    guardian_name: input.guardianName || input.studentName || "__________",
    guardian_cpf: input.guardianCpf || "__________",
    guardian_rg: input.guardianRg || "__________",
    guardian_phone: input.guardianPhone || input.studentPhone || "__________",
    guardian_email: input.guardianEmail || input.studentEmail || "__________",
    guardian_address: input.guardianAddress || input.studentAddress || "__________",
    instrument: input.instrument || "música",
    monthly_fee: input.monthlyFee || "__________",
    due_date: input.dueDay || "10",
    contract_start_date: fmtDate(input.startDate),
    contract_end_date: fmtDate(input.endDate),

    // ─── Contrato (PRD_ENDERECO_CONTRATOS_VARIAVEIS / padrão Emusys) ───
    numero_contrato: input.contractNumber || "CT-____-____",
    ano_atual: anoAtual,
    data_hoje: dataHoje,
    data_hoje_extenso: dataHojeExtenso,

    // ─── Contratante (aluno ou responsável — RN-004) ───
    nome_contratante: contratanteNome || "__________",
    rg_contratante: orBlank(contratanteRg),
    cpf_contratante: orBlank(contratanteCpf),
    logradouro_contratante: orBlank(contratanteLogradouro),
    numero_endereco_contratante: orBlank(input.studentNumber),
    complemento_contratante: orBlank(input.studentComplement),
    bairro_contratante: orBlank(input.studentDistrict),
    cep_contratante: orBlank(input.studentCep),
    cidade_contratante: orBlank(contratanteCidade),
    estado_contratante: orBlank(contratanteEstado),
    telefone_contratante: orBlank(useGuardian ? (input.guardianPhone || input.studentPhone) : input.studentPhone),
    email_contratante: orBlank(useGuardian ? (input.guardianEmail || input.studentEmail) : input.studentEmail),

    // ─── Contratada (escola) ───
    nome_fantasia_escola: input.schoolName || "A escola",
    razao_social_escola: input.schoolRazaoSocial || input.schoolName || "A escola",
    cnpj_escola: input.schoolCnpj || "__________",
    logradouro_escola: orBlank(input.schoolAddress),
    numero_endereco_escola: orBlank(input.schoolNumber),
    complemento_escola: orBlank(input.schoolComplement),
    bairro_escola: orBlank(input.schoolDistrict),
    cep_escola: orBlank(input.schoolCep),
    cidade_escola: orBlank(input.schoolCity),
    estado_escola: orBlank(input.schoolState),
    telefone_escola: orBlank(input.schoolPhone),
    email_escola: orBlank(input.schoolEmail),
    nome_responsavel_escola: orBlank(input.schoolLegalRepName),
    rg_responsavel_escola: orBlank(input.schoolLegalRepRg),
    cpf_responsavel_escola: orBlank(input.schoolLegalRepCpf),
    cidade_responsavel_escola: orBlank(input.schoolCity),

    // ─── Financeiro ───
    valor_parcela: input.monthlyFee || "__________",
    valor_parcela_sem_desconto: valorSemDesconto || "__________",
    meses_pagamento: orBlank(input.durationMonths),
    taxa_inscricao: input.taxaInscricao && Number(String(input.taxaInscricao).replace(",", ".")) > 0 ? input.taxaInscricao : "__________",
    dia_vencimento: input.dueDay || "________",

    // ─── Vigência e aulas ───
    data_inicial: fmtDate(input.startDate),
    data_final: fmtDate(input.endDate),
    meses_aula: orBlank(input.durationMonths),
    aulas_por_semana: orBlank(input.lessonsPerWeek),
    quantidade_aulas_total: orBlank(totalLessons),
    nome_plano: orBlank(input.planName),
  };
}

// ─── Eventos de contrato (histórico) ──────────────────────────────────────────
export async function addContractEvent(
  db: any,
  contractId: number,
  eventType: string,
  description: string,
  providerEventId?: string | null,
  metadata?: Record<string, unknown> | null
) {
  const { contractEvents } = await import("../../drizzle/schema");
  try {
    await db.insert(contractEvents).values({
      contractId,
      provider: "assinafy",
      providerEventId: providerEventId ?? null,
      eventType,
      description,
      metadata: metadata ?? null,
      createdAt: new Date(),
    }).onConflictDoNothing();
  } catch (e) {
    console.error(`[Contracts] Falha ao registrar evento ${eventType} do contrato ${contractId}:`, e);
  }
}

// ─── Mapeamento de status do provedor → status interno ─────────────────────────
export function mapProviderStatus(status: string): {
  internalStatus: "rascunho" | "enviado" | "assinado" | "cancelado" | "aguardando_assinatura" | "expirado" | "erro";
  signed?: boolean;
} {
  switch (status) {
    case "certificated":
    case "certificating":
      return { internalStatus: "assinado", signed: true };
    case "rejected_by_signer":
    case "rejected_by_user":
      return { internalStatus: "cancelado" };
    case "expired":
      return { internalStatus: "expirado" };
    case "failed":
    case "uploading":
      return { internalStatus: "erro" };
    case "pending_signature":
    case "metadata_ready":
    case "uploaded":
    case "metadata_processing":
      return { internalStatus: "aguardando_assinatura" };
    default:
      return { internalStatus: "aguardando_assinatura" };
  }
}

// ─── Contexto de renderização (compartilhado entre criar, prévia, imprimir e renovar) ──
// Busca tudo que o PDF precisa (aluno, modelo, dados da escola, plano/matrícula) e
// monta TODAS as variáveis — sem renderizar — para reuso na criação, prévia e reimpressão.
export interface PreparedContract {
  student: any;
  template: any;
  variables: Record<string, string>;
  pdfBuffer: Buffer;
  title: string;
  startDate: string | null;
  endDate: string | null;
}

export interface ContractRenderContext {
  student: any;
  variables: Record<string, string>;
  resolvedStartDate: string | null;
  resolvedEndDate: string | null;
}

export async function buildContractRenderContext(
  db: any,
  orgId: number,
  student: any,
  opts: { startDate?: string | null; endDate?: string | null; monthlyFeeOverride?: string | null; contractNumber?: string | null } = {}
): Promise<ContractRenderContext> {
  const { instruments, settings: settingsT, organizations: orgs, schoolPlans, studentEnrollments } =
    await import("../../drizzle/schema");
  const { eq, and, desc } = await import("drizzle-orm");

  // ─── FIX: busca TODOS os registros de settings desta org e prioriza o que
  // tem schoolName preenchido (o admin que configurou a escola).
  const allOrgSettings = await db
    .select()
    .from(settingsT)
    .where(eq(settingsT.organizationId, orgId))
    .orderBy(settingsT.id); // mais antigo primeiro = geralmente o admin/dono

  const orgSettings =
    allOrgSettings.find((s: any) => s.schoolName && String(s.schoolName).trim() !== "") ??
    allOrgSettings[0] ??
    null;

  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);

  // AUDIT-CONTRACTS FIX: coleta CNPJ de todas as linhas + espelho da organizations
  const schoolCnpjResolved =
    [orgSettings?.schoolCnpj, ...allOrgSettings.map((s: any) => s.schoolCnpj), (org as any)?.cnpj]
      .find((c: any) => c && String(c).trim() !== "") || null;

  const [instrument] = student.instrumentId
    ? await db.select().from(instruments).where(and(eq(instruments.id, student.instrumentId), eq(instruments.organizationId, orgId))).limit(1)
    : [null];

  // ─── Plano & Bolsas → fallback para a matrícula ativa mais recente (RF-005) ───
  let plan: any = null;
  if (student.schoolPlanId) {
    [plan] = await db.select().from(schoolPlans)
      .where(and(eq(schoolPlans.id, student.schoolPlanId), eq(schoolPlans.organizationId, orgId)))
      .limit(1);
  }
  const [enrollment] = await db.select().from(studentEnrollments)
    .where(and(eq(studentEnrollments.studentId, student.id), eq(studentEnrollments.status, "ativo")))
    .orderBy(desc(studentEnrollments.id))
    .limit(1);

  const durationMonths = plan?.duracaoMeses ?? enrollment?.durationMonths ?? null;
  const lessonsPerWeek = plan?.aulasPorSemana ?? enrollment?.lessonsPerWeek ?? null;

  const monthlyFee = opts.monthlyFeeOverride ?? (student.monthlyFee as string | null) ?? null;

  const resolvedStartDate = opts.startDate ? String(opts.startDate).slice(0, 10) : null;
  // RN-010: sugere término = início + duração do plano/matrícula quando o admin não informar
  const resolvedEndDate = opts.endDate
    ? String(opts.endDate).slice(0, 10)
    : (resolvedStartDate && durationMonths ? addMonthsClamped(resolvedStartDate, durationMonths) : null);

  // ─── Endereço do contratante: estruturado (ViaCEP) com fallback para o texto legado ───
  const addressInput = {
    cep: student.cep,
    street: student.street,
    addressNumber: student.addressNumber,
    addressComplement: student.addressComplement,
    district: student.district,
    city: student.city,
    state: student.state,
  };
  const hasStructured = ["cep", "street", "addressNumber", "district", "city", "state"]
    .some((k) => Boolean((addressInput as any)[k]));
  const studentAddressFull = hasStructured ? formatAddressForContract(addressInput) : (student.address || null);

  const variables = buildContractVariables({
    schoolName:        orgSettings?.schoolName    || (org as any)?.name     || null,
    schoolCnpj:        schoolCnpjResolved,
    schoolAddress:     orgSettings?.schoolAddress || (org as any)?.address  || null,
    schoolRazaoSocial: orgSettings?.schoolRazaoSocial || null,
    schoolNumber:      orgSettings?.schoolAddressNumber || null,
    schoolComplement:  orgSettings?.schoolAddressComplement || null,
    schoolDistrict:    orgSettings?.schoolAddressDistrict || null,
    schoolCep:         orgSettings?.schoolCep || null,
    schoolState:       orgSettings?.schoolState || null,
    schoolLegalRepName: orgSettings?.schoolLegalRepName || null,
    schoolLegalRepRg:   orgSettings?.schoolLegalRepRg || null,
    schoolLegalRepCpf:  orgSettings?.schoolLegalRepCpf || null,
    schoolCity:        orgSettings?.schoolCity    || (org as any)?.city     || null,
    schoolPhone:       orgSettings?.schoolPhone   || (org as any)?.phone    || null,
    schoolEmail:       orgSettings?.schoolEmail   || (org as any)?.email    || null,
    studentName:       student.name,
    studentCpf:        student.cpf,
    studentRg:         student.rg,
    studentBirthDate:  student.birthDate ? String(student.birthDate) : null,
    studentEmail:      student.email,
    studentPhone:      student.phone,
    studentAddress:    studentAddressFull,
    studentStreet:     student.street || null,
    studentNumber:     student.addressNumber || null,
    studentComplement: student.addressComplement || null,
    studentDistrict:   student.district || null,
    studentCep:        student.cep || null,
    studentCity:       student.city || null,
    studentState:      student.state || null,
    guardianName:      student.guardianName || null,
    guardianCpf:       student.guardianCpf || null,
    guardianRg:        student.guardianRg || null,
    guardianPhone:     student.guardianPhone || null,
    guardianEmail:     student.guardianEmail || null,
    guardianAddress:   studentAddressFull,
    instrument:        instrument?.name,
    monthlyFee,
    dueDay:            student.dueDay ? String(student.dueDay) : "10",
    startDate:         resolvedStartDate,
    endDate:           resolvedEndDate,
    contractNumber:    opts.contractNumber ?? null,
    planName:          plan?.nome ?? null,
    durationMonths,
    lessonsPerWeek,
    valorCheio:        plan?.valorCheio ?? null,
    taxaInscricao:     plan?.taxaInscricao ?? enrollment?.enrollmentFee ?? null,
  });

  return { student, variables, resolvedStartDate, resolvedEndDate };
}

export async function prepareContractRender(
  db: any,
  orgId: number,
  studentId: number,
  templateId: number,
  opts: { startDate?: string | null; endDate?: string | null; monthlyFeeOverride?: string | null; contractNumber?: string | null }
): Promise<PreparedContract> {
  const { students, contractTemplates: templates } =
    await import("../../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");

  const [student] = await db.select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.organizationId, orgId)))
    .limit(1);
  if (!student) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({ code: "NOT_FOUND", message: "Aluno não encontrado" });
  }

  const [template] = await db.select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.organizationId, orgId)))
    .limit(1);
  if (!template) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({ code: "NOT_FOUND", message: "Modelo de contrato não encontrado" });
  }

  const ctx = await buildContractRenderContext(db, orgId, student, opts);
  const pdfBuffer = await renderContractPdf(template.content || buildDefaultTemplateContent(), ctx.variables);
  return {
    student,
    template,
    variables: ctx.variables,
    pdfBuffer,
    title: `Contrato - ${student.name}`,
    startDate: ctx.resolvedStartDate,
    endDate: ctx.resolvedEndDate,
  };
}

/** Re-renderiza o PDF de um contrato existente (snapshot + dados atuais) — RF-007. */
export async function renderContractFromContract(db: any, orgId: number, contract: any): Promise<Buffer> {
  const { students } = await import("../../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");
  const [student] = await db.select()
    .from(students)
    .where(and(eq(students.id, contract.studentId), eq(students.organizationId, orgId)))
    .limit(1);
  if (!student) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({ code: "NOT_FOUND", message: "Aluno não encontrado" });
  }
  const ctx = await buildContractRenderContext(db, orgId, student, {
    startDate: contract.startDate ? String(contract.startDate).slice(0, 10) : null,
    endDate: contract.endDate ? String(contract.endDate).slice(0, 10) : null,
    monthlyFeeOverride: contract.monthlyFee ? String(contract.monthlyFee) : null,
    contractNumber: contract.contractNumber ?? null,
  });
  const content = contract.templateContentSnapshot || buildDefaultTemplateContent();
  return renderContractPdf(content, ctx.variables);
}

// ─── Numeração sequencial por escola (ex: CT-2026-0003) ───────────────────────
export async function getNextContractNumber(db: any, orgId: number): Promise<string> {
  const { sql } = await import("drizzle-orm");
  const { contracts } = await import("../../drizzle/schema");
  const [row] = await db.select({ n: sql<number>`COUNT(*)` }).from(contracts).where(sql`"organizationId" = ${orgId}`);
  const seq = Number(row?.n || 0) + 1;
  const year = new Date().getFullYear();
  return `CT-${year}-${String(seq).padStart(4, "0")}`;
}
