import { describe, it, expect } from "vitest";
import { getInstrumentContext } from "./utils/instrumentContexts";
import { resolveSpecialist, validatePlanText } from "./services/InstrumentSpecialistService";

/**
 * Regressão: violão e guitarra têm especialistas DIFERENTES.
 * Violão: dedilhado E batida/levada. Guitarra: palhetada/técnicas (sem dedilhado forçado).
 */
describe("resolveSpecialist — violão x guitarra (nome antes da categoria)", () => {
  it("Guitarra Elétrica (categoria Cordas) resolve para guitarra", () => {
    const s = resolveSpecialist("Guitarra Elétrica", "Cordas");
    expect(s.id).toBe("guitarra");
  });

  it("Violão Clássico & Popular (categoria Cordas) resolve para violao", () => {
    const s = resolveSpecialist("Violão Clássico & Popular", "Cordas");
    expect(s.id).toBe("violao");
  });

  it("nomes simples e variações resolvem corretamente", () => {
    expect(resolveSpecialist("Violão", "Geral").id).toBe("violao");
    expect(resolveSpecialist("Guitarra", "Cordas").id).toBe("guitarra");
    expect(resolveSpecialist("Guitarra Base", "Cordas").id).toBe("guitarra");
    expect(resolveSpecialist("Violão de Aço", "Cordas").id).toBe("violao");
  });

  it("ukulele/cavaquinho continuam no especialista geral de cordas", () => {
    expect(resolveSpecialist("Ukulele", "Cordas").id).toBe("cordas_dedilhadas");
    expect(resolveSpecialist("Cavaquinho", "Cordas").id).toBe("cordas_dedilhadas");
  });

  it("baixo continua no especialista próprio (mesmo com categoria Cordas)", () => {
    expect(resolveSpecialist("Baixo Elétrico", "Cordas").id).toBe("baixo");
  });
});

describe("técnicas por especialista", () => {
  it("guitarra prioriza palhetada/técnicas e proíbe dedilhado p-i-m-a como padrão", () => {
    const g = resolveSpecialist("Guitarra Elétrica", "Cordas");
    expect(g.allowedTechniques).toEqual(expect.arrayContaining(["palhetada alternada", "palm mute", "tapping"]));
    expect(g.systemPrompt.toLowerCase()).toContain("palhetada");
    expect(g.extraInstruction.toLowerCase()).toContain("dedilhado");
  });

  it("violão permite dedilhado E batida; proíbe técnicas de guitarra elétrica", () => {
    const v = resolveSpecialist("Violão", "Cordas");
    expect(v.allowedTechniques).toEqual(expect.arrayContaining(["dedilhado p-i-m-a", "batida", "levada rítmica"]));
    expect(v.forbiddenTerms).toEqual(expect.arrayContaining(["tapping", "sweep picking", "power chord"]));
  });
});

describe("validatePlanText — contaminação entre violão e guitarra", () => {
  it("plano de guitarra com dedilhado p-i-m-a é reprovado", () => {
    const res = validatePlanText("Exercício: toque o arpejo com dedilhado p-i-m-a na escala maior", "guitarra");
    expect(res.passed).toBe(false);
  });

  it("plano de guitarra com palhetada alternada passa", () => {
    const res = validatePlanText("Exercício: escala maior de G com palhetada alternada, 70 BPM, 10 repetições", "guitarra");
    expect(res.passed).toBe(true);
  });

  it("plano de violão com tapping é reprovado", () => {
    const res = validatePlanText("Exercício: escala maior com tapping na corda G", "violao");
    expect(res.passed).toBe(false);
  });

  it("plano de violão com batida/levada passa", () => {
    const res = validatePlanText("Exercício: levada pop 4/4 (batida) sobre os acordes G, D e Em, 60 BPM", "violao");
    expect(res.passed).toBe(true);
  });
});

describe("getInstrumentContext — categorias novas no contexto", () => {
  it("guitarra e violao têm contextos distintos", () => {
    const g = getInstrumentContext("Guitarra Elétrica", "Cordas");
    const v = getInstrumentContext("Violão", "Cordas");
    expect(g.resolvedCategory).toBe("guitarra");
    expect(v.resolvedCategory).toBe("violao");
    expect(g.context.terminology).not.toEqual(v.context.terminology);
  });
});
