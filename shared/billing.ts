// Regras de cobrança compartilhadas (server + client + testes).
// Fonte única do "passo" de periodicidade e do saldo de meses de um plano.

/** Quantos meses cada fatura cobre, conforme a periodicidade do aluno. */
export function periodicityStep(periodicity: string | null | undefined): number {
  const p = String(periodicity || "mensal");
  return p === "bimestral" ? 2 : p === "trimestral" ? 3 : p === "semestral" ? 6 : p === "anual" ? 12 : 1;
}

/**
 * Quantos MESES ainda faltam para o plano finalizar, considerando quantas
 * faturas já foram lançadas e quantos meses cada uma cobre.
 * Ex.: plano de 12 meses, 2 faturas bimestrais lançadas (4 meses) → faltam 8.
 */
export function computeRemainingMonths(
  durationMonths: unknown,
  launchedInvoices: unknown,
  step = 1
): number {
  const duration = Math.max(0, Math.floor(Number(durationMonths) || 0));
  const launched = Math.max(0, Math.floor(Number(launchedInvoices) || 0));
  const s = Math.max(1, Math.floor(Number(step) || 1));
  return Math.max(0, duration - launched * s);
}

/**
 * Plano EFETIVO do aluno na migração: a escolha INDIVIDUAL vence o plano padrão
 * da operação — inclusive "sem plano" (individual null vence o padrão).
 */
export function resolveEffectivePlanId(
  hasIndividualChoice: boolean,
  individualPlanId: number | null | undefined,
  globalPlanId: number | null | undefined
): number | null {
  if (hasIndividualChoice) return individualPlanId != null ? Number(individualPlanId) : null;
  return globalPlanId != null ? Number(globalPlanId) : null;
}
