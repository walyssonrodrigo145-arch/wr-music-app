import { describe, it, expect } from "vitest";
import { maskCEP, isValidCEP, buildAddressMirror, formatAddressForContract } from "@shared/address";
import { addMonthsClamped, formatDateBR, formatLongDateBR, todayISOInSaoPaulo } from "@shared/contractDates";

describe("Endereço (PRD_ENDERECO_CONTRATOS_VARIAVEIS)", () => {
  it("mascara o CEP progressivamente e valida 8 dígitos", () => {
    expect(maskCEP("12345678")).toBe("12345-678");
    expect(maskCEP("12345")).toBe("12345");
    expect(maskCEP("1234567890")).toBe("12345-678");
    expect(isValidCEP("12345-678")).toBe(true);
    expect(isValidCEP("1234567")).toBe(false);
    expect(isValidCEP(null)).toBe(false);
  });

  it("monta o espelho textual do endereço com os campos preenchidos", () => {
    expect(buildAddressMirror({
      street: "Rua das Flores", addressNumber: "123", addressComplement: "Apto 4",
      district: "Centro", city: "Vitória", state: "es", cep: "29000-000",
    })).toBe("Rua das Flores, 123, Apto 4, Centro, Vitória - ES, CEP 29000-000");
  });

  it("ignora campos vazios e retorna vazio quando não há nada", () => {
    expect(buildAddressMirror({})).toBe("");
    expect(buildAddressMirror({ street: "Rua A", number: undefined } as any)).toBe("Rua A");
    expect(buildAddressMirror({ state: "rj" })).toBe("RJ");
  });

  it("formata endereço para contrato (linha única com vírgulas)", () => {
    const text = formatAddressForContract({
      street: "Av. Brasil", addressNumber: "10", district: "Centro",
      city: "São Paulo", state: "SP", cep: "01000-000",
    });
    expect(text).toBe("Av. Brasil, 10, Centro, São Paulo - SP, CEP 01000-000");
  });
});

describe("Datas de contrato", () => {
  it("soma meses com clamp no fim do mês/ano", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsClamped("2026-10-03", 12)).toBe("2027-10-03");
    expect(addMonthsClamped("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonthsClamped("2026-10-03", 0)).toBe("2026-10-03");
    expect(addMonthsClamped("data-ruim", 3)).toBe("data-ruim");
  });

  it("converte para o fuso de São Paulo e formata", () => {
    // 2026-10-03 02:30 UTC = 2026-10-02 23:30 BRT
    const now = new Date("2026-10-03T02:30:00Z");
    expect(todayISOInSaoPaulo(now)).toBe("2026-10-02");
    expect(formatDateBR("2026-10-03")).toBe("03/10/2026");
    expect(formatLongDateBR("2026-10-03")).toBe("3 de outubro de 2026");
    expect(formatDateBR(null)).toBe(null);
  });
});
