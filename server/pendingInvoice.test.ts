import { describe, it, expect } from "vitest";
import { pickMostUrgentPendingPayment } from "./routers/plataformaRouters";

/**
 * Seleção da fatura pendente da assinatura MusicPro (Asaas):
 * parcelas da assinatura + cobranças avulsas (PENDING e OVERDUE).
 */
describe("Assinatura — fatura pendente (Asaas)", () => {
  it("escolhe a vencida antes de uma pendente futura (caso Balista)", () => {
    const picked = pickMostUrgentPendingPayment([
      { id: "recebida", status: "RECEIVED", dueDate: "2026-08-21" },
      { id: "futura", status: "PENDING", dueDate: "2026-10-21" },
      { id: "avulsa-vencida", status: "OVERDUE", dueDate: "2026-09-22" },
    ]);
    expect(picked?.id).toBe("avulsa-vencida");
  });

  it("entre vencidas, pega a mais antiga", () => {
    const picked = pickMostUrgentPendingPayment([
      { id: "v2", status: "OVERDUE", dueDate: "2026-09-22" },
      { id: "v1", status: "OVERDUE", dueDate: "2026-08-21" },
    ]);
    expect(picked?.id).toBe("v1");
  });

  it("entre pendentes, pega a que vence antes", () => {
    const picked = pickMostUrgentPendingPayment([
      { id: "p2", status: "PENDING", dueDate: "2026-11-21" },
      { id: "p1", status: "PENDING", dueDate: "2026-10-21" },
    ]);
    expect(picked?.id).toBe("p1");
  });

  it("ignora status que não são pendência", () => {
    const picked = pickMostUrgentPendingPayment([
      { id: "a", status: "RECEIVED" },
      { id: "b", status: "CONFIRMED" },
      { id: "c", status: "REFUNDED" },
      { id: "d", status: "PENDING", dueDate: "2026-10-01" },
    ]);
    expect(picked?.id).toBe("d");
  });

  it("sem pendências devolve null (Tudo em dia)", () => {
    expect(pickMostUrgentPendingPayment([{ status: "RECEIVED" }, { status: "CONFIRMED" }])).toBeNull();
    expect(pickMostUrgentPendingPayment([])).toBeNull();
    expect(pickMostUrgentPendingPayment(null)).toBeNull();
    expect(pickMostUrgentPendingPayment(undefined)).toBeNull();
  });

  it("cobrança sem dueDate fica por último (mesma urgência)", () => {
    const picked = pickMostUrgentPendingPayment([
      { id: "sem-data", status: "PENDING" },
      { id: "com-data", status: "PENDING", dueDate: "2026-10-21" },
    ]);
    expect(picked?.id).toBe("com-data");

    // Vencida sem data ainda ganha de pendente com data (urgência manda)
    const picked2 = pickMostUrgentPendingPayment([
      { id: "vencida-sem-data", status: "OVERDUE" },
      { id: "pendente-com-data", status: "PENDING", dueDate: "2026-10-21" },
    ]);
    expect(picked2?.id).toBe("vencida-sem-data");
  });
});
