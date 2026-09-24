// Formatação de datas centralizada — AUDIT FIX (elimina safeFormat duplicado entre páginas)
// e fix do off-by-one de fuso: colunas `date` do banco vêm como "YYYY-MM-DD" e não podem
// ser lidas com `new Date("YYYY-MM-DD")` (isso vira meia-noite UTC → dia anterior no Brasil).
import { format, isValid } from "date-fns";

/** Converte data com segurança. Strings "YYYY-MM-DD" são lidas como data LOCAL (meio-dia). */
export function parseDateOnly(date: unknown): Date | null {
  if (date === null || date === undefined || date === "") return null;
  if (date instanceof Date) return isValid(date) ? date : null;
  if (typeof date === "string") {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
      return isValid(parsed) ? parsed : null;
    }
  }
  const parsed = new Date(date as string | number);
  return isValid(parsed) ? parsed : null;
}

/** Formata data de forma segura (nunca lança erro; retorna "Inválido" se a data não puder ser interpretada). */
export function safeFormat(date: unknown, formatStr: string, options?: Parameters<typeof format>[2]): string {
  try {
    const parsed = parseDateOnly(date);
    if (!parsed) return "Inválido";
    return format(parsed, formatStr, options);
  } catch {
    return "Inválido";
  }
}
