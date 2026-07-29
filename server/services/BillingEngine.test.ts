import { describe, it, expect, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = "test_jwt_secret";
  process.env.DATABASE_URL = "postgres://dummy:dummy@localhost:5432/dummy";
});

import { BillingEngine, SchoolBillingSettings } from "./BillingEngine";

describe("BillingEngine - Financial Calculation Tests", () => {
  const defaultSettings: SchoolBillingSettings = {
    lateFeeEnabled: true,
    lateFeeType: "percentage",
    lateFeeValue: 2.0, // 2%
    interestEnabled: true,
    interestType: "daily",
    interestRate: 0.33, // 0.33% ao dia
    graceDays: 3,
    autoUpdateInvoice: true,
    showFeeBreakdown: true,
  };

  it("deve retornar valor original para cobrança em dia", () => {
    const today = new Date(2026, 6, 29);
    const dueDate = new Date(2026, 6, 30); // Vencimento amanhã

    const invoice = {
      id: 1,
      amount: "200.00",
      dueDate: dueDate.toISOString().slice(0, 10),
      status: "pendente",
    };

    const res = BillingEngine.computeInvoiceAmounts(invoice, defaultSettings, today);

    expect(res.originalAmount).toBe(200.0);
    expect(res.daysOverdue).toBe(0);
    expect(res.lateFeeAmount).toBe(0);
    expect(res.interestAmount).toBe(0);
    expect(res.updatedAmount).toBe(200.0);
  });

  it("não deve cobrar juros ou multa dentro do período de carência", () => {
    const today = new Date(2026, 6, 29);
    const dueDate = new Date(2026, 6, 27); // 2 dias de atraso (carência é 3)

    const invoice = {
      id: 2,
      amount: "200.00",
      dueDate: dueDate.toISOString().slice(0, 10),
      status: "pendente",
    };

    const res = BillingEngine.computeInvoiceAmounts(invoice, defaultSettings, today);

    expect(res.daysOverdue).toBe(0);
    expect(res.lateFeeAmount).toBe(0);
    expect(res.interestAmount).toBe(0);
    expect(res.updatedAmount).toBe(200.0);
  });

  it("deve aplicar multa de 2% e juros diários de 0.33% quando ultrapassar a carência", () => {
    const today = new Date(2026, 6, 29);
    const dueDate = new Date(2026, 6, 24); // 5 dias de atraso (> 3 dias de carência)

    const invoice = {
      id: 3,
      amount: "200.00",
      dueDate: dueDate.toISOString().slice(0, 10),
      status: "pendente",
    };

    const res = BillingEngine.computeInvoiceAmounts(invoice, defaultSettings, today);

    // Multa: 200 * 2% = R$ 4,00
    // Juros: 200 * (0.33 / 100) * 5 dias = R$ 3,30
    // Total Atualizado: 200 + 4 + 3.30 = R$ 207.30
    expect(res.daysOverdue).toBe(5);
    expect(res.lateFeeAmount).toBe(4.0);
    expect(res.interestAmount).toBe(3.3);
    expect(res.updatedAmount).toBe(207.3);
  });

  it("deve suportar multa fixa e juros ao mês", () => {
    const today = new Date(2026, 6, 29);
    const dueDate = new Date(2026, 5, 29); // 30 dias de atraso

    const settingsFixedMonthly: SchoolBillingSettings = {
      ...defaultSettings,
      lateFeeType: "fixed",
      lateFeeValue: 10.0, // R$ 10,00 fixo
      interestType: "monthly",
      interestRate: 1.0, // 1% ao mês
      graceDays: 0,
    };

    const invoice = {
      id: 4,
      amount: "500.00",
      dueDate: dueDate.toISOString().slice(0, 10),
      status: "pendente",
    };

    const res = BillingEngine.computeInvoiceAmounts(invoice, settingsFixedMonthly, today);

    // Multa: R$ 10,00
    // Juros: 500 * 1% * (30/30) = R$ 5,00
    // Total: 500 + 10 + 5 = 515.00
    expect(res.daysOverdue).toBe(30);
    expect(res.lateFeeAmount).toBe(10.0);
    expect(res.interestAmount).toBe(5.0);
    expect(res.updatedAmount).toBe(515.0);
  });

  it("deve manter valor pago inalterado para cobrança com status pago", () => {
    const today = new Date(2026, 6, 29);
    const dueDate = new Date(2026, 5, 1);

    const invoice = {
      id: 5,
      amount: "200.00",
      dueDate: dueDate.toISOString().slice(0, 10),
      status: "pago",
    };

    const res = BillingEngine.computeInvoiceAmounts(invoice, defaultSettings, today);

    expect(res.daysOverdue).toBe(0);
    expect(res.lateFeeAmount).toBe(0);
    expect(res.interestAmount).toBe(0);
    expect(res.updatedAmount).toBe(200.0);
  });
});
