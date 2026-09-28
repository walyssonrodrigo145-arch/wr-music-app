import { describe, expect, it } from "vitest";
import {
  STUDENT_EXIT_REASONS,
  STUDENT_EXIT_REASON_IDS,
  buildWinbackMessage,
  exitReasonLabel,
} from "../shared/studentExitReasons";

describe("studentExitReasons (PRD_HISTORICO_ALUNOS)", () => {
  it("tem ids únicos e todos com label", () => {
    const ids = STUDENT_EXIT_REASONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const reason of STUDENT_EXIT_REASONS) {
      expect(reason.label.length).toBeGreaterThan(0);
    }
    expect(STUDENT_EXIT_REASON_IDS).toEqual(ids);
  });

  it("mapeia motivo conhecido para label legível", () => {
    expect(exitReasonLabel("financeiro")).toBe("Motivos financeiros");
    expect(exitReasonLabel("mudanca")).toBe("Mudança de cidade/escola");
  });

  it("faz fallback para motivo desconhecido/ausente", () => {
    expect(exitReasonLabel(null)).toBe("Sem motivo informado");
    expect(exitReasonLabel(undefined)).toBe("Sem motivo informado");
    expect(exitReasonLabel("custom")).toBe("custom");
  });

  it("monta mensagem de winback com nome do aluno", () => {
    const msg = buildWinbackMessage("Maria");
    expect(msg).toContain("Maria");
    const comEscola = buildWinbackMessage("Maria", "Escola Harmonia");
    expect(comEscola).toContain("Escola Harmonia");
  });
});
