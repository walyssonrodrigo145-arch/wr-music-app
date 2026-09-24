import { describe, it, expect } from "vitest";
import {
  computePlanRange,
  normalizeStudentCount,
  recommendPlan,
  simulateMonthly,
  sortPlans,
  type SimPlan,
} from "@shared/planPricing";

function makePlan(overrides: Partial<SimPlan> & Pick<SimPlan, "id" | "maxStudents">): SimPlan {
  return {
    name: overrides.id,
    priceMonthly: 99,
    allowExtraStudents: true,
    extraStudentPrice: 1.49,
    ...overrides,
  };
}

describe("Simulador de planos (shared/planPricing)", () => {
  it("cobra excedente quando passa do limite (CA-002)", () => {
    const escola = makePlan({ id: "escola", maxStudents: 30, priceMonthly: 99, extraStudentPrice: 1.49 });
    const sim = simulateMonthly(escola, 35);

    expect(sim.excessCount).toBe(5);
    expect(sim.excessSubtotal).toBe(7.45);
    expect(sim.total).toBe(106.45);
    expect(sim.basePrice).toBe(99);
    expect(sim.exceedsLimit).toBe(true);
    expect(sim.isExcessAllowed).toBe(true);
  });

  it("não cobra excedente dentro do limite (CA-003)", () => {
    const escola = makePlan({ id: "escola", maxStudents: 30, priceMonthly: 99 });
    const sim = simulateMonthly(escola, 25);

    expect(sim.excessCount).toBe(0);
    expect(sim.excessSubtotal).toBe(0);
    expect(sim.total).toBe(99);
    expect(sim.exceedsLimit).toBe(false);
  });

  it("não calcula excedente quando o plano não permite (RN-004)", () => {
    const noExtra = makePlan({ id: "iniciante", maxStudents: 20, priceMonthly: 49.9, allowExtraStudents: false });
    const sim = simulateMonthly(noExtra, 35);

    expect(sim.excessCount).toBe(15);
    expect(sim.excessSubtotal).toBe(0);
    expect(sim.total).toBe(49.9);
    expect(sim.exceedsLimit).toBe(true);
    expect(sim.isExcessAllowed).toBe(false);
  });

  it("recomenda o menor plano que comporta a quantidade (CA-006)", () => {
    const plans = [
      makePlan({ id: "20", maxStudents: 20, priceMonthly: 49.9 }),
      makePlan({ id: "50", maxStudents: 50, priceMonthly: 99 }),
      makePlan({ id: "100", maxStudents: 100, priceMonthly: 199 }),
    ];

    expect(recommendPlan(plans, 35).plan?.id).toBe("50");
    expect(recommendPlan(plans, 20).plan?.id).toBe("20");
    expect(recommendPlan(plans, 1).plan?.id).toBe("20");
  });

  it("prefere plano que aceita excedente em caso de empate de limite (RN-006)", () => {
    const plans = [
      makePlan({ id: "sem-extra", maxStudents: 20, priceMonthly: 49, allowExtraStudents: false }),
      makePlan({ id: "com-extra", maxStudents: 20, priceMonthly: 59, allowExtraStudents: true }),
    ];

    expect(recommendPlan(plans, 20).plan?.id).toBe("com-extra");
  });

  it("usa o maior plano com excedente quando a quantidade passa de todos os limites (RN-004)", () => {
    const plans = [
      makePlan({ id: "30", maxStudents: 30, priceMonthly: 99, allowExtraStudents: true }),
      makePlan({ id: "100", maxStudents: 100, priceMonthly: 149, allowExtraStudents: false }),
    ];

    const rec = recommendPlan(plans, 150);
    expect(rec.plan?.id).toBe("30");
    expect(rec.needsCustomQuote).toBe(false);
    expect(simulateMonthly(rec.plan!, 150).total).toBe(99 + 120 * 1.49);
  });

  it("pede orçamento sob medida quando nenhum plano comporta (CA-005)", () => {
    const plans = [
      makePlan({ id: "20", maxStudents: 20, allowExtraStudents: false }),
      makePlan({ id: "50", maxStudents: 50, allowExtraStudents: false }),
    ];

    const rec = recommendPlan(plans, 80);
    expect(rec.needsCustomQuote).toBe(true);
    expect(rec.plan?.id).toBe("50");
  });

  it("plano ilimitado nunca gera excedente (CA-012)", () => {
    const ilimitado = makePlan({ id: "ilimitado", maxStudents: 999999, priceMonthly: 299 });
    const sim = simulateMonthly(ilimitado, 5000);

    expect(sim.isUnlimited).toBe(true);
    expect(sim.excessCount).toBe(0);
    expect(sim.total).toBe(299);

    const rec = recommendPlan([makePlan({ id: "50", maxStudents: 50 }), ilimitado], 400);
    expect(rec.plan?.id).toBe("ilimitado");
    expect(rec.needsCustomQuote).toBe(false);
  });

  it("calcula o intervalo do slider (RN-007)", () => {
    const plans = [
      makePlan({ id: "10", maxStudents: 10 }),
      makePlan({ id: "30", maxStudents: 30 }),
      makePlan({ id: "100", maxStudents: 100 }),
    ];
    const range = computePlanRange(plans);

    expect(range).toEqual({ min: 10, max: 500, initial: 10, step: 1 });

    const huge = computePlanRange([makePlan({ id: "grande", maxStudents: 10000 })]);
    expect(huge.max).toBe(5000);

    const unlimitedOnly = computePlanRange([makePlan({ id: "ilimitado", maxStudents: 999999 })]);
    expect(unlimitedOnly.min).toBe(10);
    expect(unlimitedOnly.max).toBe(750);
  });

  it("normaliza entradas inválidas (CA-011)", () => {
    const range = { min: 10, max: 500, initial: 10, step: 1 };

    expect(normalizeStudentCount(Number.NaN, range)).toBe(10);
    expect(normalizeStudentCount(-5, range)).toBe(10);
    expect(normalizeStudentCount(0, range)).toBe(10);
    expect(normalizeStudentCount(100000, range)).toBe(500);
    expect(normalizeStudentCount(35.7, range)).toBe(36);
    expect(normalizeStudentCount(35, range)).toBe(35);
  });

  it("arredonda valores em centavos (RN-009)", () => {
    const plan = makePlan({ id: "centavos", maxStudents: 0, priceMonthly: 49.9, extraStudentPrice: 1.49 });
    const sim = simulateMonthly(plan, 7);

    expect(sim.excessSubtotal).toBeCloseTo(10.43, 2);
    expect(sim.total).toBeCloseTo(60.33, 2);

    const decimals = makePlan({ id: "decimais", maxStudents: 0, priceMonthly: 0.1, extraStudentPrice: 0.1 });
    const decimalSim = simulateMonthly(decimals, 3);
    expect(decimalSim.excessSubtotal).toBe(0.3);
    expect(decimalSim.total).toBe(0.4);
  });

  it("não quebra com quantidade não numérica (CA-011)", () => {
    const plan = makePlan({ id: "escola", maxStudents: 30 });
    const sim = simulateMonthly(plan, Number.NaN);

    expect(sim.excessCount).toBe(0);
    expect(Number.isFinite(sim.total)).toBe(true);
  });

  it("ordena planos por limite, excedente e preço", () => {
    const plans = [
      makePlan({ id: "100", maxStudents: 100 }),
      makePlan({ id: "20-caros", maxStudents: 20, priceMonthly: 59 }),
      makePlan({ id: "20-barato", maxStudents: 20, priceMonthly: 49 }),
      makePlan({ id: "20-sem-extra", maxStudents: 20, allowExtraStudents: false, priceMonthly: 39 }),
    ];

    expect(sortPlans(plans).map((p) => p.id)).toEqual([
      "20-barato",
      "20-caros",
      "20-sem-extra",
      "100",
    ]);
  });
});
