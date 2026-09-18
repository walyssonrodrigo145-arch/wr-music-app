import { describe, it, expect } from "vitest";
import { resolveEnrollmentTeacher, resolveEnrollmentTeacherForLink } from "./services/EnrollmentHoursService";

/**
 * Fake db: cada db.select() consome o próximo bucket e devolve um builder
 * thenable — qualquer encadeamento (from/leftJoin/where/orderBy/limit)
 * resolve o mesmo bucket (comportamento do resolveEnrollmentTeacher:
 * 1º select = professores, 2º = users professor, 3º = users admin).
 */
function makeDb(buckets: any[][]) {
  let i = 0;
  return {
    select: () => {
      const bucket = buckets[i++] ?? [];
      const b: any = {};
      for (const m of ["from", "leftJoin", "where", "orderBy", "limit"]) {
        b[m] = () => b;
      }
      b.then = (res: any, rej: any) => Promise.resolve(bucket).then(res, rej);
      return b;
    },
  } as any;
}

describe("resolveEnrollmentTeacher — cadeia professores → professor → admin (fix produção)", () => {
  it("1º nível: ficha de professor com especialidade compatível tem prioridade", async () => {
    const db = makeDb([[
      { userId: 10, name: "Prof Violão", especialidade: "Violão" },
      { userId: 11, name: "Prof Teclado", especialidade: "Teclado" },
    ]]);
    const t = await resolveEnrollmentTeacher(db, 28, "Teclado");
    expect(t.userId).toBe(11);
    expect(t.name).toBe("Prof Teclado");
  });

  it("1º nível sem match: cai no primeiro professor da ficha", async () => {
    const db = makeDb([[
      { userId: 10, name: "Prof Violão", especialidade: "Violão" },
      { userId: 11, name: "Prof Teclado", especialidade: "Teclado" },
    ]]);
    const t = await resolveEnrollmentTeacher(db, 28, "Bateria");
    expect(t.userId).toBe(10);
  });

  it("2º nível: escola sem ficha de professores usa usuário role=professor", async () => {
    const db = makeDb([[], [{ id: 20, name: "User Professor" }]]);
    const t = await resolveEnrollmentTeacher(db, 28, "Teclado");
    expect(t.userId).toBe(20);
  });

  it("3º nível (caso org 28): escola operada só pelo admin → aulas vão para o admin", async () => {
    const db = makeDb([[], [], [{ id: 1595, name: "Jaderson" }]]);
    const t = await resolveEnrollmentTeacher(db, 28, "Teclado");
    expect(t.userId).toBe(1595);
  });

  it("org sem nenhum usuário: retorna null (caller decide o erro)", async () => {
    const db = makeDb([[], [], []]);
    const t = await resolveEnrollmentTeacher(db, 999, "Teclado");
    expect(t.userId).toBeNull();
  });
});

describe("resolveEnrollmentTeacherForLink — professor escolhido no link tem prioridade", () => {
  it("professor escolhido no link vence a cadeia automática", async () => {
    const db = makeDb([[{ userId: 55, name: "Prof Escolhido" }]]);
    const t = await resolveEnrollmentTeacherForLink(db, { organizationId: 28, teacherUserId: 55 }, "Teclado");
    expect(t.userId).toBe(55);
    expect(t.name).toBe("Prof Escolhido");
  });

  it("professor do link removido/inválido cai na cadeia automática", async () => {
    const db = makeDb([
      [], // users: professor do link não encontrado
      [{ userId: 10, name: "Prof Violão", especialidade: "Violão" }],
    ]);
    const t = await resolveEnrollmentTeacherForLink(db, { organizationId: 28, teacherUserId: 999 }, "Violão");
    expect(t.userId).toBe(10);
  });

  it("link sem professor escolhido usa a cadeia automática direto", async () => {
    const db = makeDb([[{ userId: 11, name: "Prof Teclado", especialidade: "Teclado" }]]);
    const t = await resolveEnrollmentTeacherForLink(db, { organizationId: 28, teacherUserId: null }, "Teclado");
    expect(t.userId).toBe(11);
  });
});
