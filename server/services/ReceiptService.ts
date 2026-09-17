// ─── PRD_RECIBO_MENSALIDADE — Geração de Recibo/Comprovante em PDF ───────────
// Gera um recibo com: nome do aluno, valor, mês/ano de referência, data de
// vencimento, data de pagamento (se pago), forma de pagamento e status.
// Usado pelo financeiro (gerar + enviar por WhatsApp) via paymentDues.generateReceipt.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface PaymentReceiptData {
  schoolName: string;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  // PRD_RECIBO_LOGO: logo da escola (data URL base64 OU URL http) estampada no PDF
  logoDataUrl?: string | null;
  studentName: string;
  studentPhone?: string | null;
  dueId: number;
  amount: string | number;
  originalAmount?: string | number | null;
  dueDate: string; // YYYY-MM-DD
  paidAt?: Date | null;
  status: "pendente" | "pago" | "atrasado";
  month: number; // 1-12
  year: number;
  paymentMethod?: string | null; // asaas | mercadopago | infinitepay | manual
}

export const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Número legível do recibo (ex.: REC-2026-0042). */
export function buildReceiptNumber(dueId: number, year: number): string {
  return `REC-${year}-${String(dueId).padStart(4, "0")}`;
}

export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";
}

export function formatReceiptDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  if (isNaN(d.getTime())) return "—";
  const base = d.toLocaleDateString("pt-BR");
  return withTime ? `${base} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : base;
}

export function describePaymentMethod(method?: string | null): string {
  switch ((method || "").toLowerCase()) {
    case "asaas": return "Asaas (PIX/Boleto/Cartão)";
    case "mercadopago": return "Mercado Pago";
    case "infinitepay": return "InfinitePay (PIX/Cartão)";
    case "manual": return "Pagamento manual registrado";
    default: return "—";
  }
}

/**
 * Renderiza o PDF do recibo (A4, pdf-lib — mesmo padrão do contractService).
 * Helvetica (WinAnsi/Latin-1) suporta os acentos PT-BR usados aqui.
 */
export async function renderPaymentReceiptPdf(data: PaymentReceiptData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_WIDTH = 595.28; // A4
  const PAGE_HEIGHT = 841.89;
  const margin = 56;

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const primary = rgb(0.29, 0.15, 0.7);
  const dark = rgb(0.12, 0.12, 0.15);
  const gray = rgb(0.45, 0.45, 0.5);
  const lineColor = rgb(0.85, 0.85, 0.88);

  const draw = (
    t: string,
    opts: { x?: number; y?: number; size?: number; font?: any; color?: any; center?: boolean; right?: boolean } = {}
  ) => {
    const size = opts.size ?? 11;
    const font = opts.font ?? regular;
    const yy = opts.y ?? 0;
    let x = opts.x ?? margin;
    if (opts.center) x = (PAGE_WIDTH - font.widthOfTextAtSize(t, size)) / 2;
    if (opts.right) x = PAGE_WIDTH - margin - font.widthOfTextAtSize(t, size);
    page.drawText(t, { x, y: yy, size, font, color: opts.color ?? dark });
  };

  let y = PAGE_HEIGHT - margin;

  // PRD_RECIBO_LOGO: logo da escola no topo direito (data URL base64 ou http).
  // Falha no embed NUNCA quebra o recibo — apenas segue sem logo.
  try {
    const logo = (data.logoDataUrl || "").trim();
    let bytes: Uint8Array | null = null;
    let isPng = false;
    if (/^data:image\/png;base64,/i.test(logo)) {
      bytes = Buffer.from(logo.split(",")[1], "base64");
      isPng = true;
    } else if (/^data:image\/jpe?g;base64,/i.test(logo)) {
      bytes = Buffer.from(logo.split(",")[1], "base64");
      isPng = false;
    } else if (/^https?:\/\//i.test(logo)) {
      const res = await fetch(logo, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        bytes = new Uint8Array(await res.arrayBuffer());
        const ct = String(res.headers.get("content-type") || "");
        isPng = ct.includes("png") || logo.toLowerCase().endsWith(".png");
      }
    }
    if (bytes && bytes.length > 0) {
      const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const maxW = 150, maxH = 56;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * scale, h = img.height * scale;
      page.drawImage(img, { x: PAGE_WIDTH - margin - w, y: PAGE_HEIGHT - margin - h + 6, width: w, height: h });
    }
  } catch (e) {
    console.warn("[Recibo] Falha ao estampar a logo no PDF (recibo segue sem logo):", e);
  }

  // Cabeçalho
  draw("RECIBO DE PAGAMENTO", { y, size: 20, font: bold, color: primary });
  y -= 16;
  draw(buildReceiptNumber(data.dueId, data.year), { y, size: 10, color: gray });
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: PAGE_WIDTH - margin, y },
    thickness: 1.5,
    color: primary,
  });
  y -= 28;

  // Escola
  draw(data.schoolName || "Escola de Música", { y, size: 14, font: bold });
  y -= 14;
  const schoolContact = [data.schoolPhone || null, data.schoolEmail || null].filter(Boolean).join("  •  ");
  if (schoolContact) {
    draw(schoolContact, { y, size: 9, color: gray });
    y -= 26;
  } else {
    y -= 20;
  }

  // Bloco de informações (rótulo à esquerda, valor à direita)
  const row = (label: string, value: string, valueBold = false) => {
    page.drawLine({
      start: { x: margin, y: y - 2 },
      end: { x: PAGE_WIDTH - margin, y: y - 2 },
      thickness: 0.6,
      color: lineColor,
    });
    y -= 20;
    draw(label.toUpperCase(), { y, size: 8, color: gray });
    draw(value, { y, size: 11, font: valueBold ? bold : regular, right: true });
    y -= 12;
  };

  const isPaid = data.status === "pago";
  row("Aluno(a)", data.studentName || "—", true);
  row("Telefone do aluno", data.studentPhone || "—");
  row("Referência", `${MONTHS_PT[Math.max(0, Math.min(11, data.month - 1))]} / ${data.year}`);
  row("Data de vencimento", formatReceiptDate(data.dueDate));
  row("Data de pagamento", isPaid && data.paidAt ? formatReceiptDate(data.paidAt, true) : "—");
  row("Forma de pagamento", describePaymentMethod(data.paymentMethod));
  row("Valor", formatMoney(data.amount), true);

  // Status destacado
  y -= 18;
  const statusText = isPaid ? "STATUS: PAGO" : data.status === "atrasado" ? "STATUS: ATRASADO" : "STATUS: PENDENTE";
  const statusColor = isPaid ? rgb(0.05, 0.6, 0.35) : data.status === "atrasado" ? rgb(0.85, 0.2, 0.2) : rgb(0.75, 0.5, 0);
  page.drawRectangle({
    x: margin,
    y: y - 8,
    width: 170,
    height: 26,
    color: statusColor,
    opacity: 0.12,
  });
  draw(statusText, { x: margin + 10, y, size: 12, font: bold, color: statusColor });
  y -= 56;

  // Observação
  if (isPaid) {
    draw("Recebemos o pagamento referente à mensalidade acima, dando plena e geral quitação.", { y, size: 9, color: gray });
  } else {
    draw("Este documento comprova o valor e o vencimento da mensalidade acima.", { y, size: 9, color: gray });
    y -= 12;
    draw("Após a confirmação do pagamento, gere um novo recibo para o comprovante definitivo.", { y, size: 9, color: gray });
  }
  y -= 40;

  // Assinatura
  page.drawLine({
    start: { x: PAGE_WIDTH / 2 - 90, y },
    end: { x: PAGE_WIDTH / 2 + 90, y },
    thickness: 0.8,
    color: dark,
  });
  y -= 14;
  draw(data.schoolName || "Escola de Música", { y, size: 10, center: true });

  // Rodapé
  draw("", { y: margin + 24 });
  page.drawLine({
    start: { x: margin, y: margin + 30 },
    end: { x: PAGE_WIDTH - margin, y: margin + 30 },
    thickness: 0.6,
    color: lineColor,
  });
  draw(`Comprovante gerado eletronicamente pelo MusicPro em ${formatReceiptDate(new Date(), true)}.`, {
    y: margin + 16,
    size: 8,
    color: gray,
  });
  draw(`Documento nº ${buildReceiptNumber(data.dueId, data.year)} — consulte a validade com a escola.`, {
    y: margin + 4,
    size: 8,
    color: gray,
  });

  return Buffer.from(await pdfDoc.save());
}
