import { describe, it, expect } from "vitest";
import { ptBR } from "date-fns/locale";
import { parseDateOnly, safeFormat } from "@/lib/dates";

describe("datas — off-by-one de fuso (colunas date do banco)", () => {
  it("lê 'YYYY-MM-DD' como data local (não volta um dia)", () => {
    const parsed = parseDateOnly("2026-09-05");
    expect(parsed).not.toBeNull();
    expect(parsed!.getFullYear()).toBe(2026);
    expect(parsed!.getMonth()).toBe(8);
    expect(parsed!.getDate()).toBe(5);
    expect(safeFormat("2026-09-05", "dd/MM/yyyy")).toBe("05/09/2026");
    expect(safeFormat("2026-09-05", "dd MMM yyyy", { locale: ptBR })).toBe("05 set 2026");
  });

  it("mantém Date e timestamps completos funcionando", () => {
    expect(safeFormat(new Date(2026, 8, 5, 10, 0, 0), "dd/MM/yyyy")).toBe("05/09/2026");
    expect(safeFormat(new Date(2026, 8, 5).getTime(), "yyyy-MM-dd")).toBe("2026-09-05");
  });

  it("retorna Inválido para valores ausentes ou inválidos", () => {
    expect(safeFormat(null, "dd/MM/yyyy")).toBe("Inválido");
    expect(safeFormat(undefined, "dd/MM/yyyy")).toBe("Inválido");
    expect(safeFormat("", "dd/MM/yyyy")).toBe("Inválido");
    expect(safeFormat("abc", "dd/MM/yyyy")).toBe("Inválido");
  });
});
