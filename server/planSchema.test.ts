import { describe, expect, it } from "vitest";
import { buildPlanOutputSchema, AI_PROMPT_VERSIONS } from "./utils/aiPrompts";

const base = {
  totalMinutes: 30,
  durations: { revisao: 3, warm: 5, tecnica: 10, conceito: 4, aplicacao: 6, desafio: 2 },
};

describe("RF-003 — buildPlanOutputSchema (schema compacto do plano diário)", () => {
  it("contém os 6 blocos fixos na ordem correta", () => {
    const s = buildPlanOutputSchema(base);
    const titles = ["\"Revisão\"", "\"Aquecimento\"", "\"Técnica\"", "\"Conceito Musical\"", "\"Aplicação\"", "\"Desafio\""];
    let last = -1;
    for (const t of titles) {
      const idx = s.indexOf(t);
      expect(idx).toBeGreaterThan(last);
      last = idx;
    }
  });

  it("CA-001: NÃO define icon como campo do JSON (apenas a proibição explícita)", () => {
    const s = buildPlanOutputSchema(base);
    expect(s).not.toMatch(/"icon"\s*:/);
    expect(s).toContain("PROIBIDO o campo \"icon\"");
  });

  it("exige EXATAMENTE 5 dias e concisão em subtitle/points", () => {
    const s = buildPlanOutputSchema(base);
    expect(s).toContain("EXATAMENTE 5 objetos");
    expect(s).toContain("até 8 palavras");
    expect(s).toContain("até 12 palavras");
    expect(s).toContain("3 points");
  });

  it("interpola as durações e o total", () => {
    const s = buildPlanOutputSchema(base);
    expect(s).toContain("(3 min)");
    expect(s).toContain("(10 min)");
    expect(s).toContain("fechar exatamente 30 min");
  });

  it("estrutura JSON inclui weeklyGoal, importantMessage, days e focus", () => {
    const s = buildPlanOutputSchema(base);
    expect(s).toContain("\"weeklyGoal\"");
    expect(s).toContain("\"importantMessage\"");
    expect(s).toContain("\"targetDailyMinutes\": 30");
    expect(s).toContain("\"dayName\": \"Dia 1\"");
  });

  it("versão do prompt diário registrada", () => {
    expect(AI_PROMPT_VERSIONS.planoDiario).toBe("2.0.0");
  });
});
