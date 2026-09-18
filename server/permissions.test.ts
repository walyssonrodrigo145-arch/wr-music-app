/**
 * Testes do catálogo canônico de permissões (shared/permissions.ts).
 * Protege: normalização do formato legado (sem '/', "recepcao"), preservação das
 * permissões de dados ("alunos_editar") e o guard de rota do professor.
 */
import { describe, expect, it } from "vitest";
import {
  PAGE_PERMISSION_IDS,
  normalizePermissions,
  isPageAllowed,
  isAdminOnlyPath,
  firstAllowedPath,
  resolvePageId,
  DEFAULT_PROFESSOR_PERMISSIONS,
} from "@shared/permissions";

describe("normalizePermissions", () => {
  it("converte o default legado para ids canônicos (com '/' e alias recepcao)", () => {
    const r = normalizePermissions(["aulas", "progresso", "recepcao", "ia", "lembretes", "relatorios"]);
    expect(r).toEqual(["/ia", "/aulas", "/relatorios", "/lembretes", "/progresso", "/recepcao-qr"]);
  });

  it("preserva permissões de dados (ids desconhecidos) sem adicionar barra", () => {
    const r = normalizePermissions(["alunos_editar", "/aulas", "alunos_mensalidade"]);
    expect(r).toContain("alunos_editar");
    expect(r).toContain("alunos_mensalidade");
    expect(r).toContain("/aulas");
  });

  it("remove duplicatas e valores inválidos", () => {
    const r = normalizePermissions(["aulas", "/aulas", "", "   ", null, 42, "aulas"]);
    expect(r).toEqual(["/aulas"]);
  });

  it("retorna [] para entradas não-array", () => {
    expect(normalizePermissions(null)).toEqual([]);
    expect(normalizePermissions(undefined)).toEqual([]);
    expect(normalizePermissions("aulas")).toEqual([]);
  });

  it("todo id do catálogo é estável (não muda ao normalizar)", () => {
    expect(normalizePermissions(PAGE_PERMISSION_IDS)).toEqual(PAGE_PERMISSION_IDS);
  });
});

describe("resolvePageId", () => {
  it("mapeia sub-rotas de alunos para /alunos", () => {
    expect(resolvePageId("/alunos/novo")).toBe("/alunos");
    expect(resolvePageId("/alunos/12/editar")).toBe("/alunos");
  });

  it("mapeia aliases de rota", () => {
    expect(resolvePageId("/scanner")).toBe("/recepcao-qr");
    expect(resolvePageId("/fluxo-chatbot")).toBe("/chatbot-fluxo");
    expect(resolvePageId("/ia-conhecimento")).toBe("/base-conhecimento-ia");
    expect(resolvePageId("/salas-estudio")).toBe("/salas");
  });

  it("ignora query string e barra final", () => {
    expect(resolvePageId("/aulas?mes=1")).toBe("/aulas");
    expect(resolvePageId("/aulas/")).toBe("/aulas");
  });

  it("retorna null para rota fora do catálogo", () => {
    expect(resolvePageId("/checkout")).toBeNull();
    expect(resolvePageId("/assinatura")).toBeNull();
  });
});

describe("isPageAllowed", () => {
  const perms = ["/dashboard", "/alunos", "/aulas"];

  it("libera páginas concedidas e suas sub-rotas", () => {
    expect(isPageAllowed(perms, "/dashboard")).toBe(true);
    expect(isPageAllowed(perms, "/alunos/7/editar")).toBe(true);
    expect(isPageAllowed(perms, "/aulas")).toBe(true);
  });

  it("bloqueia páginas não concedidas", () => {
    expect(isPageAllowed(perms, "/financeiro")).toBe(false);
    expect(isPageAllowed(perms, "/folha")).toBe(false);
    expect(isPageAllowed(perms, "/ia")).toBe(false);
  });

  it("bloqueia rotas admin-only mesmo com permissão ampla", () => {
    const all = PAGE_PERMISSION_IDS;
    expect(isPageAllowed(all, "/novidades")).toBe(false);
    expect(isPageAllowed(all, "/professores")).toBe(false);
    expect(isPageAllowed(all, "/marketing/nova")).toBe(false);
    expect(isPageAllowed(all, "/master-panel")).toBe(false);
  });

  it("libera rotas fora do catálogo (checkout/assinatura)", () => {
    expect(isPageAllowed([], "/checkout")).toBe(true);
    expect(isPageAllowed([], "/assinatura")).toBe(true);
  });

  it("aceita permissões legadas ao avaliar a rota", () => {
    expect(isPageAllowed(["recepcao"], "/recepcao-qr")).toBe(true);
    expect(isPageAllowed(["aulas"], "/aulas")).toBe(true);
  });
});

describe("isAdminOnlyPath", () => {
  it("detecta rotas admin-only e sub-rotas", () => {
    expect(isAdminOnlyPath("/novidades")).toBe(true);
    expect(isAdminOnlyPath("/marketing/nova")).toBe(true);
    expect(isAdminOnlyPath("/dashboard")).toBe(false);
  });
});

describe("firstAllowedPath", () => {
  it("segue a ordem do catálogo", () => {
    expect(firstAllowedPath(["/aulas", "/ia"])).toBe("/ia");
    expect(firstAllowedPath(DEFAULT_PROFESSOR_PERMISSIONS)).toBe("/dashboard");
  });

  it("retorna null quando não há páginas liberadas", () => {
    expect(firstAllowedPath([])).toBeNull();
    expect(firstAllowedPath(["alunos_editar"])).toBeNull();
  });
});
