import { describe, it, expect } from "vitest";
import { addDaysISO, firstWeekdayISO, sumRequestedWeeks } from "./routers/lessonsRouters";
import { resolveMigrationFee, resolvePlanFee, computeRemainingMonths, resolveEffectivePlanId, groupActiveStudentsByPlan } from "./routers/financeiroRouters";
import { periodicityStep } from "@shared/billing";
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

  it("sumRequestedWeeks soma quantidades individuais com fallback no padrão", () => {
    // Individual vence o padrão
    expect(sumRequestedWeeks([{ weeks: 12 }, { weeks: 20 }], 8)).toBe(32);
    // Sem individual → usa o padrão
    expect(sumRequestedWeeks([{}, {}], 8)).toBe(16);
    // Mistura: um individual e outro no padrão
    expect(sumRequestedWeeks([{ weeks: 4 }, {}], 10)).toBe(14);
    // Clamp 1–104 e valores inválidos caem no padrão
    expect(sumRequestedWeeks([{ weeks: 0 }, { weeks: 999 }], 8)).toBe(8 + 104);
    expect(sumRequestedWeeks([{ weeks: null }], 8)).toBe(8);
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

describe("Migração — plano selecionado e saldo de meses", () => {
  it("resolvePlanFee: valor do plano vence; sem valor no plano usa o informado", () => {
    expect(resolvePlanFee(180, 100)).toBe(180);
    expect(resolvePlanFee("180.00", null)).toBe(180);
    expect(resolvePlanFee(0, 150)).toBe(150);
    expect(resolvePlanFee(0, 0)).toBe(0);
    expect(resolvePlanFee(null, null)).toBe(0);
  });

  it("computeRemainingMonths: duração − lançadas, nunca negativo", () => {
    expect(computeRemainingMonths(12, 4)).toBe(8);
    expect(computeRemainingMonths(12, 0)).toBe(12);
    expect(computeRemainingMonths(12, 12)).toBe(0);
    expect(computeRemainingMonths(12, 14)).toBe(0);
    expect(computeRemainingMonths(0, 0)).toBe(0);
    expect(computeRemainingMonths(null, null)).toBe(0);
    expect(computeRemainingMonths("12", "3")).toBe(9);
  });

  it("limita as mensalidades geradas ao restante do plano", () => {
    const remaining = computeRemainingMonths(12, 4); // 8
    expect(Math.min(12, remaining)).toBe(8); // pediu 12 → gera 8
    expect(Math.min(6, remaining)).toBe(6);  // pediu 6 → gera 6
    expect(Math.min(12, computeRemainingMonths(12, 12))).toBe(0); // plano completo
  });

  it("considera a periodicidade: cada fatura lançada cobre N meses", () => {
    expect(periodicityStep("mensal")).toBe(1);
    expect(periodicityStep("bimestral")).toBe(2);
    expect(periodicityStep("trimestral")).toBe(3);
    expect(periodicityStep("semestral")).toBe(6);
    expect(periodicityStep("anual")).toBe(12);
    expect(periodicityStep(null)).toBe(1);

    // Plano de 12 meses com 2 faturas bimestrais lançadas (4 meses) → faltam 8
    expect(computeRemainingMonths(12, 2, periodicityStep("bimestral"))).toBe(8);
    // 4 faturas trimestrais (12 meses) → plano completo
    expect(computeRemainingMonths(12, 4, periodicityStep("trimestral"))).toBe(0);
    // 1 fatura semestral (6 meses) → faltam 6
    expect(computeRemainingMonths(12, 1, periodicityStep("semestral"))).toBe(6);
  });
});

describe("Migração — plano INDIVIDUAL por aluno", () => {
  it("resolveEffectivePlanId: individual vence o padrão (inclusive 'sem plano')", () => {
    // Individual escolhido → vence
    expect(resolveEffectivePlanId(true, 7, 3)).toBe(7);
    // Individual "sem plano" (null) → vence o padrão
    expect(resolveEffectivePlanId(true, null, 3)).toBeNull();
    expect(resolveEffectivePlanId(true, undefined, 3)).toBeNull();
    // Sem escolha individual → usa o padrão
    expect(resolveEffectivePlanId(false, null, 3)).toBe(3);
    expect(resolveEffectivePlanId(false, 7, 3)).toBe(3);
    // Sem individual e sem padrão → sem plano
    expect(resolveEffectivePlanId(false, null, null)).toBeNull();
    expect(resolveEffectivePlanId(false, null, undefined)).toBeNull();
    // Números em string são normalizados
    expect(resolveEffectivePlanId(true, Number("7"), 3)).toBe(7);
  });

  it("groupActiveStudentsByPlan: agrupa ativos por plano e ignora inativos/sem plano", () => {
    const students = [
      { id: 1, status: "ativo" },
      { id: 2, status: "ativo" },
      { id: 3, status: "ativo" },
      { id: 4, status: "inativo" },
    ];
    const planIdByStudent = new Map<number, number | null | undefined>([
      [1, 10],
      [2, 20],
      [3, null],
      [4, 10], // inativo — ignorado
    ]);
    const groups = groupActiveStudentsByPlan(students, planIdByStudent);
    expect(groups.get(10)).toEqual([1]);
    expect(groups.get(20)).toEqual([2]);
    expect(groups.has(3)).toBe(false);
    expect(groups.size).toBe(2);
  });

  it("groupActiveStudentsByPlan: alunos sem plano efetivo mantêm o plano atual", () => {
    const students = [{ id: 1, status: "ativo" }, { id: 2, status: "ativo" }];
    const groups = groupActiveStudentsByPlan(students, new Map([[1, 5], [2, 5]]));
    expect(groups.get(5)).toEqual([1, 2]);
    expect(groupActiveStudentsByPlan(students, new Map()).size).toBe(0);
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
