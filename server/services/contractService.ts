/**
 * contractService.ts — Orquestração do módulo de contratos digitais.
 *
 * Fluxo: renderiza o PDF do contrato → envia para o provedor (Assinafy)
 * → cria signatário → gera processo de assinatura → persiste contrato + eventos.
 *
 * Multi-tenancy: TODA operação recebe orgId validado pelo chamador.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

export function buildDefaultTemplateContent(): string {
  return DEFAULT_TEMPLATE_CONTENT;
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

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const margin = 56;
  const maxWidth = page.getWidth() - margin * 2;
  const lineHeight = 15;

  let y = page.getHeight() - margin;

  const drawLineOn = (p: any, l: string, f: any, s: number) => {
    p.drawText(l, { x: margin, y, size: s, font: f, color: rgb(0.1, 0.1, 0.1), lineHeight });
  };

  const drawParagraph = (paragraph: string, opts: { bold?: boolean; size?: number; gapAfter?: number } = {}) => {
    const size = opts.size ?? 11;
    const font = opts.bold ? helveticaBold : helvetica;
    const words = paragraph.split(/\s+/);
    let line = "";
    const pushLine = (l: string) => {
      if (y < margin) {
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        y = newPage.getHeight() - margin;
        drawLineOn(newPage, l, font, size);
      } else {
        drawLineOn(page, l, font, size);
      }
      y -= lineHeight;
    };
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        pushLine(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) pushLine(line);
    y -= (opts.gapAfter ?? 8);
  };

  const lines = text.split(/\n+/).filter((l) => l.trim().length > 0);
  for (const line of lines) {
    const isTitle = line === line.toUpperCase() && line.length < 80;
    drawParagraph(line.trim(), {
      bold: isTitle,
      size: isTitle ? 13 : 11,
      gapAfter: isTitle ? 12 : 8,
    });
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
  studentName: string;
  studentCpf?: string | null;
  studentEmail?: string | null;
  studentPhone?: string | null;
  studentAddress?: string | null;
  instrument?: string | null;
  monthlyFee?: string | null;
  dueDay?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export function buildContractVariables(input: ContractVariablesInput): Record<string, string> {
  const fmtDate = (d?: string | null) => {
    if (!d) return "____/____/________";
    const [y, m, day] = String(d).slice(0, 10).split("-");
    if (!y || !m || !day) return d;
    return `${day}/${m}/${y}`;
  };
  return {
    school_name: input.schoolName || "A escola",
    school_cnpj: input.schoolCnpj || "__________",
    school_address: [input.schoolAddress, input.schoolCity].filter(Boolean).join(", ") || "__________",
    school_phone: input.schoolPhone || "__________",
    school_email: input.schoolEmail || "__________",
    student_name: input.studentName,
    student_cpf: input.studentCpf || "__________",
    student_email: input.studentEmail || "__________",
    student_phone: input.studentPhone || "__________",
    student_address: input.studentAddress || "__________",
    instrument: input.instrument || "música",
    monthly_fee: input.monthlyFee || "__________",
    due_date: input.dueDay || "10",
    contract_start_date: fmtDate(input.startDate),
    contract_end_date: fmtDate(input.endDate),
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

// ─── Contexto de renderização (compartilhado entre criar, prévia e renovar) ──
// Busca tudo que o PDF precisa (aluno, modelo, dados da escola) e já renderiza.
export interface PreparedContract {
  student: any;
  template: any;
  variables: Record<string, string>;
  pdfBuffer: Buffer;
  title: string;
}

export async function prepareContractRender(
  db: any,
  orgId: number,
  studentId: number,
  templateId: number,
  opts: { startDate?: string | null; endDate?: string | null; monthlyFeeOverride?: string | null }
): Promise<PreparedContract> {
  const { students, instruments, settings: settingsT, organizations: orgs, contractTemplates: templates } =
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

  const [orgSettings] = await db.select().from(settingsT).where(eq(settingsT.organizationId, orgId)).limit(1);
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  const [instrument] = student.instrumentId
    ? await db.select().from(instruments).where(and(eq(instruments.id, student.instrumentId), eq(instruments.organizationId, orgId))).limit(1)
    : [null];

  const monthlyFee = opts.monthlyFeeOverride ?? (student.monthlyFee as string | null) ?? null;

  const variables = buildContractVariables({
    schoolName: orgSettings?.schoolName || org?.name,
    schoolCnpj: orgSettings?.schoolCnpj,
    schoolAddress: orgSettings?.schoolAddress,
    schoolCity: orgSettings?.schoolCity,
    schoolPhone: orgSettings?.schoolPhone,
    schoolEmail: orgSettings?.schoolEmail || null,
    studentName: student.name,
    studentCpf: student.cpf,
    studentEmail: student.email,
    studentPhone: student.phone,
    studentAddress: student.address,
    instrument: instrument?.name,
    monthlyFee,
    dueDay: student.dueDay ? String(student.dueDay) : "10",
    startDate: opts.startDate,
    endDate: opts.endDate,
  });

  const pdfBuffer = await renderContractPdf(template.content || buildDefaultTemplateContent(), variables);
  return {
    student,
    template,
    variables,
    pdfBuffer,
    title: `Contrato - ${student.name}`,
  };
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
