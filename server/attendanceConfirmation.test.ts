import { describe, it, expect, afterEach } from "vitest";
import {
  buildConfirmationLink,
  appendConfirmationLink,
  buildTeacherNotificationMessage,
  CONFIRMATION_LINK_MARK,
} from "./services/attendanceConfirmation";

describe("attendanceConfirmation — link de confirmação (PRD_NOTIFICACAO_ALUNO)", () => {
  const originalUrl = process.env.APP_PUBLIC_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = originalUrl;
  });

  it("link aponta para o portal do aluno com ?confirmar={lessonId}", () => {
    delete process.env.APP_PUBLIC_URL;
    const link = buildConfirmationLink(123);
    expect(link).toContain("/aluno/aulas?confirmar=123");
    expect(link).toContain("https://");
  });

  it("usa APP_PUBLIC_URL quando configurada e remove barra final", () => {
    process.env.APP_PUBLIC_URL = "https://minhaescola.com.br/";
    const link = buildConfirmationLink(7);
    expect(link).toBe("https://minhaescola.com.br/aluno/aulas?confirmar=7");
  });

  it("appendConfirmationLink acrescenta o link ao lembrete de aula", () => {
    const msg = "Olá! Sua aula de violão é amanhã às 15:00.";
    const withLink = appendConfirmationLink(msg, 42);
    expect(withLink).toContain(msg);
    expect(withLink).toContain("✅ Confirme sua presença:");
    expect(withLink).toContain("/aluno/aulas?confirmar=42");
  });

  it("appendConfirmationLink é idempotente (não duplica o link)", () => {
    const msg = "Olá! Sua aula é amanhã.";
    const once = appendConfirmationLink(msg, 42);
    const twice = appendConfirmationLink(once, 42);
    expect(twice).toBe(once);
    expect(once.split(CONFIRMATION_LINK_MARK).length - 1).toBe(1);
  });

  it("appendConfirmationLink lida com mensagem vazia", () => {
    expect(appendConfirmationLink("", 1)).toBe("");
  });
});

describe("attendanceConfirmation — notificação do professor", () => {
  it("mensagem de confirmação positiva", () => {
    const msg = buildTeacherNotificationMessage("João", "Violão", true);
    expect(msg).toContain("João");
    expect(msg).toContain("Violão");
    expect(msg).toContain("confirmou presença");
  });

  it("mensagem de ausência avisa o professor sem alterar regras", () => {
    const msg = buildTeacherNotificationMessage("João", "Piano", false);
    expect(msg).toContain("NÃO poderá ir");
  });
});
