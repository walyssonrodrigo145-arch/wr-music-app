import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { canManageTurmaStudents } from "./routers/lessonsRouters";
import type { TrpcContext } from "./_core/context";

// Sem banco no ambiente de teste: cobre a validação de input e o guard de conexão.
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn().mockResolvedValue(null),
  };
});

function createCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-open-id",
      name: "Professor Teste",
      email: "professor@teste.com",
      loginMethod: "manus",
      role: "admin",
      organizationId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const baseInput = {
  groupId: "turma-1",
  scheduledAt: "2026-10-05T19:00:00.000Z",
  title: "Turma de Violão",
};

describe("Turma — gestão de alunos (adicionar/remover)", () => {
  it("canManageTurmaStudents: só turma agendada permite alterar", () => {
    expect(canManageTurmaStudents("agendada")).toBe(true);
    expect(canManageTurmaStudents(undefined)).toBe(true);
    expect(canManageTurmaStudents(null)).toBe(true);
    expect(canManageTurmaStudents("concluida")).toBe(false);
    expect(canManageTurmaStudents("falta")).toBe(false);
    expect(canManageTurmaStudents("cancelada")).toBe(false);
    expect(canManageTurmaStudents("remarcada")).toBe(false);
  });

  it("addTurmaStudents rejeita lista vazia (validação de input)", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.lessons.addTurmaStudents({ ...baseInput, studentIds: [] })
    ).rejects.toThrow();
  });

  it("addTurmaStudents rejeita mais de 50 alunos por operação", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.lessons.addTurmaStudents({ ...baseInput, studentIds: Array.from({ length: 51 }, (_, i) => i + 1) })
    ).rejects.toThrow();
  });

  it("addTurmaStudents e removeTurmaStudent existem e falham sem banco (guard)", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.lessons.addTurmaStudents({ ...baseInput, studentIds: [1] })
    ).rejects.toThrow(/Banco de dados/i);
    await expect(
      caller.lessons.removeTurmaStudent({ lessonId: 1 })
    ).rejects.toThrow(/Banco de dados/i);
  });
});
