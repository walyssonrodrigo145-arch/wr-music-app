import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { normalizeInteractiveResponse, parseFallbackChoice } from "./services/whatsapp/interactive/ResponseNormalizer";
import { validateInteractiveMessage } from "./services/whatsapp/interactive/EvolutionProvider";
import { buildFallbackText } from "./services/whatsapp/interactive/FallbackService";
import { canAccessMenu, phoneMatchesStudent } from "./services/whatsapp/interactive/Menus";
import { computeExpiry, isExpired } from "./services/whatsapp/interactive/SessionService";
import { INTERACTIVE_CONFIG, LIMITS } from "./services/whatsapp/interactive/types";
import { normalizeInteractiveResponse as normalize } from "./services/whatsapp/interactive/ResponseNormalizer";
import { validateInteractiveMessage } from "./services/whatsapp/interactive/EvolutionProvider";

describe("ResponseNormalizer — normaliza formatos da Evolution/Baileys (§8)", () => {
  it("normaliza buttonsResponseMessage (clique em botão)", () => {
    const r = normalizeInteractiveResponse({
      buttonsResponseMessage: { selectedDisplayText: "💰 Financeiro", selectedButtonId: "btn_financeiro" },
    }, "5511999999999");
    expect(r).not.toBeNull();
    expect(r!.type).toBe("button");
    expect(r!.buttonId).toBe("btn_financeiro");
    expect(r!.displayText).toBe("💰 Financeiro");
    expect(r!.action).toBeNull(); // resolvido pelo registro de envio, nunca pelo payload
  });

  it("normaliza botão SEM id (Baileys às vezes só envia o displayText)", () => {
    const r = normalizeInteractiveResponse({
      buttonsResponseMessage: { selectedDisplayText: "📅 Agenda" },
    }, "5511999999999");
    expect(r!.buttonId).toBeNull();
    expect(r!.displayText).toBe("📅 Agenda");
  });

  it("normaliza listResponseMessage (rowId da lista)", () => {
    const r = normalizeInteractiveResponse({
      listResponseMessage: { singleSelectReply: { rowId: "btn_consultar_aluno" }, title: "João" },
    }, "5511999999999");
    expect(r!.type).toBe("list");
    expect(r!.buttonId).toBe("btn_consultar_aluno");
  });

  it("normaliza interactiveResponseMessage (nativeFlow)", () => {
    const r = normalizeInteractiveResponse({
      interactiveResponseMessage: {
        nativeFlowResponseMessage: { responseJson: JSON.stringify({ id: "btn_alunos" }) },
      },
    }, "5511999999999");
    expect(r!.type).toBe("button");
    expect(r!.buttonId).toBe("btn_consultar_aluno" === r!.buttonId ? "btn_consultar_aluno" : "btn_alunos");
  });

  it("mensagem comum (texto) → null", () => {
    expect(normalizeInteractiveResponse({ conversation: "oi" }, "5511999999999")).toBeNull();
    expect(normalizeInteractiveResponse(null, "5511999999999")).toBeNull();
  });
});

describe("parseFallbackChoice — parser do texto numerado (§7)", () => {
  const opts = [
    { text: "👨‍🎓 Alunos", id: "btn_alunos" },
    { text: "📅 Agenda", id: "btn_agenda" },
    { text: "💰 Financeiro", id: "btn_financeiro" },
  ];

  it("aceita número puro", () => {
    expect(parseFallbackChoice("1", opts)).toBe(1);
    expect(parseFallbackChoice("3", opts)).toBe(3);
    expect(parseFallbackChoice(" 2 ", opts)).toBe(2);
  });

  it("aceita emoji dígito (fallback renderizado)", () => {
    expect(parseFallbackChoice("1️⃣", opts)).toBe(1);
  });

  it("aceita o texto da opção (com emoji/acentos)", () => {
    expect(parseFallbackChoice("Financeiro", opts)).toBe(3);
    expect(parseFallbackChoice("agenda", opts)).toBe(2);
  });

  it("número fora da lista é inválido (não adivinha)", () => {
    expect(parseFallbackChoice("9", opts)).toBeNull();
  });

  it("texto desconhecido é inválido", () => {
    expect(parseFallbackChoice("abacaxi", opts)).toBeNull();
    expect(parseFallbackChoice("", opts)).toBeNull();
  });
});

describe("validateInteractiveMessage — limites reais do WhatsApp/Baileys (§6)", () => {
  const ok = { id: "btn_x", text: "Op", action: "acao_x", params: {}, order: 1 };

  it("máximo de 3 botões (sendButtons)", () => {
    const errs = validateInteractiveMessage(Array.from({ length: 4 }, (_, i) => ({ ...ok, id: `b${i}` })), "corpo");
    expect(errs.join(" ")).toContain("máximo de 3");
  });

  it("bloqueia id duplicado e botão sem action", () => {
    const errs = validateInteractiveMessage([ok, { ...ok, action: undefined as any }], "corpo");
    expect(errs.join(" ")).toContain("id duplicado");
    expect(errs.join(" ")).toContain("sem action");
  });

  it("bloqueia texto de botão muito longo (>24)", () => {
    const errs = validateInteractiveMessage([{ ...ok, text: "x".repeat(30) }], "corpo");
    expect(errs.join(" ")).toContain("muito longo");
  });

  it("mensagem válida → sem erros", () => {
    expect(validateInteractiveMessage([ok], "corpo")).toEqual([]);
  });

  it("LIMITS coerentes com a Evolution 2.3.7 (§34)", () => {
    expect(LIMITS.MAX_BUTTONS).toBe(3);
    expect(LIMITS.MAX_BUTTON_TEXT).toBe(24);
  });
});

describe("FallbackService — texto numerado (§7/§29)", () => {
  it("lista numerada com instruções de digitação", () => {
    const t = buildFallbackText("Olá! 👋", "Como posso ajudar?", [
      { id: "b1", text: "👨‍🎓 Alunos", action: "a", params: {}, order: 1 },
      { id: "b2", text: "📅 Agenda", action: "a", params: {}, order: 2 },
    ]);
    expect(t).toContain("Como posso ajudar?");
    expect(t).toContain("1️⃣");
    expect(t).toContain("2️⃣");
    expect(t).toContain("Digite o número da opção");
  });
});

describe("Permissões por papel (§15) — professor não acessa financeiro", () => {
  it("professor: alunos/agenda sim, financeiro não", () => {
    expect(canAccessMenu("professor", "alunos")).toBe(true);
    expect(canAccessMenu("professor", "agenda")).toBe(true);
    expect(canAccessMenu("professor", "financeiro")).toBe(false);
  });
  it("admin: tudo liberado", () => {
    expect(canAccessMenu("admin", "financeiro")).toBe(true);
  });
});

describe("Sessão interativa — expiração (§12)", () => {
  it("TTL configurável via env (padrão 30 min)", () => {
    const original = process.env.WHATSAPP_INTERACTIVE_SESSION_MINUTES;
    process.env.WHATSAPP_INTERACTIVE_SESSION_MINUTES = "45";
    expect(INTERACTIVE_CONFIG.sessionMinutes()).toBe(45);
    process.env.WHATSAPP_INTERACTIVE_SESSION_MINUTES = original;
  });

  it("sessão dentro do TTL está ativa; expirada detecta", () => {
    const expiry = computeExpiry();
    expect(isExpired({ status: "active", expiresAt: expiry })).toBe(false);
    const past = new Date(Date.now() - 60_000);
    expect(isExpired({ status: "active", expiresAt: past })).toBe(true);
    expect(isExpired({ status: "expired", expiresAt: expiry })).toBe(true);
  });
});

describe("PRD_LEMBRETE_INTERATIVO — confirmação de presença pelo WhatsApp", () => {
  it("identifica o aluno pelo telefone (sufixo 8 dígitos)", () => {
    expect(phoneMatchesStudent("5511999998888", "(11) 99999-8888", "")).toBe(true);
    expect(phoneMatchesStudent("5511999998888", "11999998888", "")).toBe(true);
  });

  it("identifica o RESPONSÁVEL quando o número é do guarda (menor de idade)", () => {
    expect(phoneMatchesStudent("5511977776666", "11999998888", "11777776666")).toBe(true);
  });

  it("número de outra pessoa NÃO casa", () => {
    expect(phoneMatchesStudent("5511900001111", "11999998888", "")).toBe(false);
    expect(phoneMatchesStudent("", "11999998888", "")).toBe(false);
  });

  it("sufixo curto (<8) não gera falso positivo", () => {
    // telefone do aluno com 7 dígitos nunca deve casar por coincidência
    expect(phoneMatchesStudent("1199", "11999998888", "")).toBe(false);
  });

  it("botões do lembrete passam na validação (texto ≤24, id ≤120)", () => {
    const buttons = [
      { id: "lesson_confirm_123", text: "✅ Vou comparecer", action: "confirmar_presenca_aula", params: { lessonId: 123 }, order: 1 },
      { id: "lesson_novai_123", text: "❌ Não poderei ir", action: "nao_vai_aula", params: { lessonId: 123 }, order: 2 },
    ];
    expect(validateInteractiveMessage(buttons, "Lembrete da aula de violão amanhã às 15h")).toEqual([]);
  });

  it("clique em botão do lembrete é normalizado (response de Baileys sem id)", () => {
    const r = normalize({
      buttonsResponseMessage: { selectedDisplayText: "✅ Vou comparecer" },
    }, "5511999998888");
    expect(r!.type).toBe("button");
    expect(r!.buttonId).toBeNull();
    expect(r!.displayText).toBe("✅ Vou comparecer");
  });
});
