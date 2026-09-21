import { describe, it, expect } from "vitest";
import { buildWhatsAppMessage, rewardPercentForPosition, type ReferralConfigView } from "./services/ReferralEngine";

const baseConfig = {
  rewardPercent1: 30,
  rewardPercent2: 60,
  rewardPercent3: 100,
  cycleSize: 3,
} as unknown as ReferralConfigView;

describe("Indique & Ganhe — recompensa progressiva (30/60/100 por ciclo de 3)", () => {
  it("1ª conversão do ciclo = 30% OFF", () => {
    expect(rewardPercentForPosition(baseConfig, 1)).toBe(30);
  });

  it("2ª conversão do ciclo = 60% OFF", () => {
    expect(rewardPercentForPosition(baseConfig, 2)).toBe(60);
  });

  it("3ª conversão do ciclo = 100% (mensalidade grátis)", () => {
    expect(rewardPercentForPosition(baseConfig, 3)).toBe(100);
  });

  it("ciclo reinicia: a 4ª conversão volta para 30%", () => {
    const cycleSize = 3;
    const converted = 3;
    const nextPosition = (converted % cycleSize) + 1;
    expect(nextPosition).toBe(1);
    expect(rewardPercentForPosition(baseConfig, nextPosition)).toBe(30);
  });

  it("progressão completa de 6 conversões: 30, 60, 100, 30, 60, 100", () => {
    const cycleSize = 3;
    const percents = Array.from({ length: 6 }, (_, i) => {
      const position = (i % cycleSize) + 1;
      return rewardPercentForPosition(baseConfig, position);
    });
    expect(percents).toEqual([30, 60, 100, 30, 60, 100]);
  });

  it("respeita configuração personalizada do SuperAdmin", () => {
    const custom = { rewardPercent1: 10, rewardPercent2: 20, rewardPercent3: 50 } as unknown as ReferralConfigView;
    expect(rewardPercentForPosition(custom, 1)).toBe(10);
    expect(rewardPercentForPosition(custom, 2)).toBe(20);
    expect(rewardPercentForPosition(custom, 3)).toBe(50);
  });
});

describe("Indique & Ganhe — compartilhamento", () => {
  it("mensagem inclui o link real da escola e os dias grátis configurados", () => {
    const message = buildWhatsAppMessage("Escola A", "https://wrmusicpro.com.br/indicacao/WR12345", 7);
    expect(message).toContain("https://wrmusicpro.com.br/indicacao/WR12345");
    expect(message).toContain("7 dias grátis");
    expect(message).toContain("MusicPro");
  });

  it("respeita dias grátis diferentes (config do SuperAdmin)", () => {
    const message = buildWhatsAppMessage(null, "https://wrmusicpro.com.br/indicacao/MP99999", 14);
    expect(message).toContain("14 dias grátis");
  });
});
