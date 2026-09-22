// Avisos da assinatura MusicPro — funções puras (client + testes).
// Regras: modal de lembrete a partir de 3 dias do vencimento (1x/dia);
// banner enquanto vencida/pendente. Nunca bloqueia o acesso.

/**
 * Converte Date/ISO/`YYYY-MM-DD` em uma data LOCAL, sem deslocar -1 dia:
 *  • string `YYYY-MM-DD` → data local direta;
 *  • timestamp à MEIA-NOITE UTC (ex.: nextDueDate do Asaas gravado como
 *    `new Date("2026-10-15")`) → usa os componentes UTC (é uma data, não um instante);
 *  • demais instantes → converte para a data no fuso de Brasília.
 */
function toLocalDate(value: Date | string): Date | null {
  let parsed: Date | null = null;

  if (value instanceof Date) {
    parsed = Number.isNaN(value.getTime()) ? null : value;
  } else {
    const raw = String(value).trim();
    const plain = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plain) return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
    const d = new Date(raw);
    parsed = Number.isNaN(d.getTime()) ? null : d;
  }

  if (!parsed) return null;

  const isMidnightUTC =
    parsed.getUTCHours() === 0 &&
    parsed.getUTCMinutes() === 0 &&
    parsed.getUTCSeconds() === 0 &&
    parsed.getUTCMilliseconds() === 0;

  if (isMidnightUTC) {
    return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  }

  const brt = parsed.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [y, m, d] = brt.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function computeDaysLeft(
  due: Date | string | null | undefined,
  today: Date = new Date()
): number | null {
  if (!due) return null;
  const dueDate = toLocalDate(due);
  if (!dueDate) return null;
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - t.getTime()) / 86_400_000);
}

/** Vencida quando a data passou e a assinatura não está ativa (ou está past_due). */
export function isSubscriptionOverdue(
  due: Date | string | null | undefined,
  status: string | null | undefined,
  today: Date = new Date()
): boolean {
  const daysLeft = computeDaysLeft(due, today);
  if (daysLeft === null) return false;
  return daysLeft < 0 && status !== "active";
}

/** Modal de lembrete: 1 a 3 dias para vencer, assinatura ativa/trial, 1x/dia. */
export function shouldShowRenewalNotice(params: {
  dueDate: Date | string | null | undefined;
  status: string | null | undefined;
  alreadyShownToday: boolean;
  today?: Date;
}): boolean {
  if (params.alreadyShownToday) return false;
  const daysLeft = computeDaysLeft(params.dueDate, params.today);
  if (daysLeft === null) return false;
  if (daysLeft < 0 || daysLeft > 3) return false;
  return params.status === "active" || params.status === "trialing";
}
