import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Sem banco no ambiente de teste: a rota pública deve responder zeros (nunca quebrar a landing).
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getDb: vi.fn().mockResolvedValue(null) };
});

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("publicData.getPublicStats (números da landing)", () => {
  it("é público e devolve contagens zeradas sem banco (landing não quebra)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const stats = await caller.publicData.getPublicStats();
    expect(stats).toEqual({ schools: 0, students: 0, lessons: 0 });
  });

  it("nunca expõe dados de escola/aluno — apenas números", async () => {
    const caller = appRouter.createCaller(createCtx());
    const stats = await caller.publicData.getPublicStats();
    expect(Object.keys(stats).sort()).toEqual(["lessons", "schools", "students"]);
    for (const value of Object.values(stats)) {
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});
