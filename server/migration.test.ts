import { describe, it, expect } from "vitest";
import { addDaysISO, firstWeekdayISO } from "./routers/lessonsRouters";
import { resolveMigrationFee } from "./routers/financeiroRouters";
import { computeDaysLeft, isSubscriptionOverdue, shouldShowRenewalNotice } from "@shared/subscriptionAlerts";

/**
 * Migração assistida — séries de aulas (datas em UTC, sem fuso) e valor da
 * mensalidade (fallback plano → valor informado).
 */
describe("Migração — datas das séries de aulas", () => {
  it("addDaysISO soma dias, inclusive na virada de mês/ano", () => {
    expect(addDaysISO("2026-09-21", 7)).toBe("2026-09-28");
    expect(addDaysISO("2026-09-28", 7)).toBe("2026-10-05");
    expect(addDaysISO("2026-12-28", 7)).toBe("2027-01-04");
  });

  it("firstWeekdayISO encontra o próximo dia da semana a partir do início", () => {
    // 2026-09-21 é segunda-feira
    expect(firstWeekdayISO("2026-09-21", 1)).toBe("2026-09-21"); // segunda
    expect(firstWeekdayISO("2026-09-21", 6)).toBe("2026-09-26"); // sábado
    expect(firstWeekdayISO("2026-09-21", 0)).toBe("2026-09-27"); // domingo
    expect(firstWeekdayISO("2026-09-26", 1)).toBe("2026-09-28"); // sábado → segunda seguinte
  });

  it("firstWeekdayISO cruza mês e ano corretamente", () => {
    expect(firstWeekdayISO("2026-09-28", 6)).toBe("2026-10-03");
    expect(firstWeekdayISO("2026-12-28", 6)).toBe("2027-01-02");
  });
});

describe("Migração — valor da mensalidade (fallback)", () => {
  it("prioriza a mensalidade cadastrada do aluno", () => {
    expect(resolveMigrationFee(180, 150, 100)).toBe(180);
    expect(resolveMigrationFee("180.00", null, 0)).toBe(180);
  });

  it("usa o valor do plano quando o aluno está sem mensalidade", () => {
    expect(resolveMigrationFee(0, 150, 100)).toBe(150);
    expect(resolveMigrationFee(null, "150.00", null)).toBe(150);
  });

  it("usa o valor informado quando não há aluno nem plano", () => {
    expect(resolveMigrationFee(0, 0, 100)).toBe(100);
  });

  it("nunca retorna negativo e devolve 0 quando não há valor", () => {
    expect(resolveMigrationFee(0, 0, 0)).toBe(0);
    expect(resolveMigrationFee(null, undefined, null)).toBe(0);
    expect(resolveMigrationFee(-50, 0, 0)).toBe(0);
  });
});

describe("Avisos da assinatura MusicPro", () => {
  const today = new Date("2026-09-21T12:00:00-03:00");

  it("computeDaysLeft conta os dias até o vencimento", () => {
    expect(computeDaysLeft("2026-09-24", today)).toBe(3);
    expect(computeDaysLeft("2026-09-21", today)).toBe(0);
    expect(computeDaysLeft("2026-09-20", today)).toBe(-1);
    expect(computeDaysLeft(null, today)).toBeNull();
    expect(computeDaysLeft("data-invalida", today)).toBeNull();
  });

  it("não desloca -1 dia em vencimento do Asaas (meia-noite UTC é DATA, não instante)", () => {
    expect(computeDaysLeft("2026-10-15T00:00:00.000Z", new Date("2026-10-15T12:00:00-03:00"))).toBe(0);
    expect(computeDaysLeft(new Date("2026-10-15T00:00:00.000Z"), new Date("2026-10-14T12:00:00-03:00"))).toBe(1);
  });

  it("converte instantes reais para a data de Brasília", () => {
    // 2026-10-15T01:30:00Z = 14/10 22:30 em Brasília → conta como 14/10
    expect(computeDaysLeft("2026-10-15T01:30:00.000Z", new Date("2026-10-14T12:00:00-03:00"))).toBe(0);
  });

  it("isSubscriptionOverdue: só vencida quando a data passou e não está ativa", () => {
    expect(isSubscriptionOverdue("2026-09-20", "past_due", today)).toBe(true);
    expect(isSubscriptionOverdue("2026-09-20", "pending", today)).toBe(true);
    expect(isSubscriptionOverdue("2026-09-20", "trialing", today)).toBe(true);
    expect(isSubscriptionOverdue("2026-09-20", "active", today)).toBe(false);
    expect(isSubscriptionOverdue("2026-09-25", "active", today)).toBe(false);
    expect(isSubscriptionOverdue(null, "past_due", today)).toBe(false);
  });

  it("shouldShowRenewalNotice: 1–3 dias, ativa/trial, uma vez por dia", () => {
    expect(shouldShowRenewalNotice({ dueDate: "2026-09-24", status: "active", alreadyShownToday: false, today })).toBe(true);
    expect(shouldShowRenewalNotice({ dueDate: "2026-09-21", status: "trialing", alreadyShownToday: false, today })).toBe(true);
    expect(shouldShowRenewalNotice({ dueDate: "2026-09-24", status: "active", alreadyShownToday: true, today })).toBe(false);
    expect(shouldShowRenewalNotice({ dueDate: "2026-09-30", status: "active", alreadyShownToday: false, today })).toBe(false);
    expect(shouldShowRenewalNotice({ dueDate: "2026-09-20", status: "active", alreadyShownToday: false, today })).toBe(false);
    expect(shouldShowRenewalNotice({ dueDate: "2026-09-24", status: "canceled", alreadyShownToday: false, today })).toBe(false);
    expect(shouldShowRenewalNotice({ dueDate: null, status: "active", alreadyShownToday: false, today })).toBe(false);
  });
});
