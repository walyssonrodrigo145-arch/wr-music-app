import { describe, it, expect } from "vitest";
import { proximoDiaUtil, normalizeLimitDate, lastDayOfMonth } from "./services/BillingEngine";

/**
 * Postergação do valor promocional para o próximo dia útil (Planos & Bolsas).
 * Regra: o prazo do desconto é estendido quando o dia limite cai em sábado ou
 * domingo; não altera o vencimento da fatura nem o status de atraso.
 */
describe("Planos & Bolsas — próximo dia útil (sáb/dom → segunda)", () => {
  it("sábado → segunda", () => {
    expect(proximoDiaUtil("2026-09-26")).toBe("2026-09-28");
  });

  it("domingo → segunda", () => {
    expect(proximoDiaUtil("2026-09-27")).toBe("2026-09-28");
  });

  it("segunda permanece segunda (já é dia útil)", () => {
    expect(proximoDiaUtil("2026-09-21")).toBe("2026-09-21");
  });

  it("sexta permanece sexta (já é dia útil)", () => {
    expect(proximoDiaUtil("2026-09-25")).toBe("2026-09-25");
  });

  it("virada de mês: sábado 30/05/2026 → segunda 01/06/2026", () => {
    expect(proximoDiaUtil("2026-05-30")).toBe("2026-06-01");
  });

  it("virada de ano: sábado 02/01/2027 → segunda 04/01/2027", () => {
    expect(proximoDiaUtil("2027-01-02")).toBe("2027-01-04");
  });

  it("data inválida é devolvida sem quebrar", () => {
    expect(proximoDiaUtil("abc")).toBe("abc");
  });
});

describe("Planos & Bolsas — dia limite inexistente no mês", () => {
  it("lastDayOfMonth: fevereiro 2026 (não bissexto) = 28; 2028 (bissexto) = 29", () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28);
    expect(lastDayOfMonth(2028, 2)).toBe(29);
    expect(lastDayOfMonth(2026, 4)).toBe(30);
    expect(lastDayOfMonth(2026, 12)).toBe(31);
  });

  it("dia 31 em fevereiro/2026 → 28/02 (sem data inválida)", () => {
    expect(normalizeLimitDate("2026-02-05", 31)).toBe("2026-02-28");
  });

  it("dia 30 em fevereiro/2026 → 28/02", () => {
    expect(normalizeLimitDate("2026-02-10", 30)).toBe("2026-02-28");
  });

  it("dia 31 em abril → 30/04", () => {
    expect(normalizeLimitDate("2026-04-05", 31)).toBe("2026-04-30");
  });

  it("dia válido é preservado", () => {
    expect(normalizeLimitDate("2026-09-05", 10)).toBe("2026-09-10");
  });
});

describe("Planos & Bolsas — combinação normalização + postergação (prazo efetivo)", () => {
  const prazoEfetivo = (dueStr: string, limiteDia: number, postergar: boolean) => {
    const base = normalizeLimitDate(dueStr, limiteDia);
    return postergar ? proximoDiaUtil(base) : base;
  };

  it("sem a opção, limite em domingo continua domingo (valor cheio na segunda)", () => {
    // 2026-09-27 é domingo
    expect(prazoEfetivo("2026-09-05", 27, false)).toBe("2026-09-27");
  });

  it("com a opção, limite em domingo vira segunda (mantém o desconto na segunda)", () => {
    expect(prazoEfetivo("2026-09-05", 27, true)).toBe("2026-09-28");
  });

  it("com a opção, limite em dia útil não muda", () => {
    expect(prazoEfetivo("2026-09-05", 21, true)).toBe("2026-09-21");
  });

  it("com a opção, 31 em fevereiro → 28 (sábado) → segunda 02/03/2026", () => {
    // 2026-02-28 é sábado; 2026-03-02 é segunda
    expect(prazoEfetivo("2026-02-05", 31, true)).toBe("2026-03-02");
  });
});
