/**
 * shared/contractDates.ts — Helpers puros de datas de contrato.
 */

/** Soma meses a uma data ISO (AAAA-MM-DD) com clamp no último dia do mês. */
export function addMonthsClamped(iso: string, months: number): string {
  const match = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || months <= 0) return iso;

  const zeroBased = month - 1 + months;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = ((zeroBased % 12) + 12) % 12; // 0-11
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(targetDay)}`;
}

/** Data de hoje em America/Sao_Paulo no formato AAAA-MM-DD. */
export function todayISOInSaoPaulo(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(now);
}

/** "2026-10-03" -> "03/10/2026" (ou null). */
export function formatDateBR(iso: string | null | undefined): string | null {
  const match = String(iso || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** "3 de outubro de 2026" (pt-BR, fuso de São Paulo). */
export function formatLongDateBR(iso: string, now: Date = new Date()): string {
  const date = /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(`${iso.slice(0, 10)}T12:00:00-03:00`) : now;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
