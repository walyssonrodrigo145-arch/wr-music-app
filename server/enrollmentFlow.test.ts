import { describe, it, expect } from "vitest";
import { pickSettingsForHours } from "./services/EnrollmentHoursService";
import { firstRecurringLessonDate } from "./services/EnrollmentGenerationService";
import {
  buildReceiptNumber,
  formatMoney,
  formatReceiptDate,
  describePaymentMethod,
  renderPaymentReceiptPdf,
} from "./services/ReceiptService";

describe("EnrollmentHoursService — resolução do expediente (PRD_MATRICULA_HORARIOS)", () => {
  it("usa a linha que de fato tem o expediente, mesmo sem schoolName (bug do link)", () => {
    // Linha "schoolName" SEM hours (a que era escolhida antes) + linha do professor COM hours
    const rows = [
      { schoolHours: null, lessonDuration: 60, schoolName: "Escola de Música" },
      { schoolHours: '{"monday":{"active":true,"start":"14:00","end":"20:00"}}', lessonDuration: null, schoolName: null },
    ];
    const resolved = pickSettingsForHours(rows, "monday");
    expect(resolved.dayConfig).toEqual({ active: true, start: "14:00", end: "20:00" });
    expect(resolved.hoursConfigured).toBe(true);
    expect(resolved.primary?.schoolName).toBe("Escola de Música");
  });

  it("honra dia fechado quando existe expediente configurado em outra linha", () => {
    const rows = [
      { schoolHours: null, lessonDuration: 60, schoolName: "Escola" },
      { schoolHours: '{"sunday":{"active":false,"start":"08:00","end":"12:00"},"monday":{"active":true,"start":"08:00","end":"18:00"}}', lessonDuration: null, schoolName: null },
    ];
    const sunday = pickSettingsForHours(rows, "sunday");
    expect(sunday.dayConfig?.active).toBe(false);
    const monday = pickSettingsForHours(rows, "monday");
    expect(monday.dayConfig?.active).toBe(true);
  });

  it("fallback padrão seg-sex 08:00-18:00 quando NINGUÉM configurou expediente", () => {
    const rows = [
      { schoolHours: null, lessonDuration: 60, schoolName: "Escola" },
      { schoolHours: "{}", lessonDuration: null, schoolName: null },
    ];
    const monday = pickSettingsForHours(rows, "monday");
    expect(monday.dayConfig).toEqual({ active: true, start: "08:00", end: "18:00" });
    expect(monday.hoursConfigured).toBe(false);
    const sunday = pickSettingsForHours(rows, "sunday");
    expect(sunday.dayConfig?.active).toBe(false);
  });

  it("ignora linhas com hours malformado", () => {
    const rows = [
      { schoolHours: "não-é-json{{{", lessonDuration: 60, schoolName: null },
      { schoolHours: '{"tuesday":{"active":true,"start":"09:00","end":"17:00"}}', lessonDuration: null, schoolName: null },
    ];
    const resolved = pickSettingsForHours(rows, "tuesday");
    expect(resolved.dayConfig).toEqual({ active: true, start: "09:00", end: "17:00" });
  });
});

describe("EnrollmentGenerationService — firstRecurringLessonDate (revalidação do slot)", () => {
  it("retorna data válida no futuro para o weekday+horário pedidos", () => {
    const d = firstRecurringLessonDate(1, "15:30");
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d.getTime())).toBe(false);
    expect(d.getHours()).toBe(15);
    expect(d.getMinutes()).toBe(30);
    // próxima ocorrência a partir de amanhã — nunca hoje
    const now = new Date();
    expect(d.getTime()).toBeGreaterThan(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime());
  });
});

describe("ReceiptService — recibo de mensalidade (PRD_RECIBO_MENSALIDADE)", () => {
  it("número do recibo: REC-{ano}-{id com padding}", () => {
    expect(buildReceiptNumber(42, 2026)).toBe("REC-2026-0042");
    expect(buildReceiptNumber(1234, 2026)).toBe("REC-2026-1234");
  });

  it("valores em BRL pt-BR", () => {
    expect(formatMoney("200")).toContain("200");
    expect(formatMoney(0)).toContain("0,00");
  });

  it("datas formatadas em pt-BR e fallback para '—'", () => {
    expect(formatReceiptDate("2026-09-10")).toContain("/2026");
    expect(formatReceiptDate(null)).toBe("—");
    const withTime = formatReceiptDate(new Date(2026, 8, 10, 15, 30), true);
    expect(withTime).toContain("15:30");
  });

  it("descrição da forma de pagamento", () => {
    expect(describePaymentMethod("asaas")).toContain("Asaas");
    expect(describePaymentMethod("infinitepay")).toContain("InfinitePay");
    expect(describePaymentMethod(null)).toBe("—");
  });

  it("gera PDF válido com status pago (pasta do buffer começa com %PDF)", async () => {
    const pdf = await renderPaymentReceiptPdf({
      schoolName: "Escola de Música Teste",
      schoolPhone: "11999990000",
      studentName: "João da Silva",
      studentPhone: "11888880000",
      dueId: 42,
      amount: "200.00",
      dueDate: "2026-09-10",
      paidAt: new Date(),
      status: "pago",
      month: 9,
      year: 2026,
      paymentMethod: "asaas",
    });
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("gera PDF válido para mensalidade pendente", async () => {
    const pdf = await renderPaymentReceiptPdf({
      schoolName: "Escola de Música Teste",
      studentName: "Maria",
      dueId: 43,
      amount: "180.00",
      dueDate: "2026-09-20",
      status: "pendente",
      month: 9,
      year: 2026,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
