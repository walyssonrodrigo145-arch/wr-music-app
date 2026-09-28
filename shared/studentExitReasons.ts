// Motivos de saída do aluno (PRD_HISTORICO_ALUNOS) — fonte única para client e server.
export const STUDENT_EXIT_REASONS = [
  { id: "financeiro", label: "Motivos financeiros" },
  { id: "mudanca", label: "Mudança de cidade/escola" },
  { id: "insatisfacao", label: "Insatisfação" },
  { id: "conclusao", label: "Concluiu os estudos" },
  { id: "saude", label: "Saúde" },
  { id: "outro", label: "Outro" },
] as const;

export type StudentExitReason = (typeof STUDENT_EXIT_REASONS)[number]["id"];

export const STUDENT_EXIT_REASON_IDS = STUDENT_EXIT_REASONS.map((r) => r.id) as StudentExitReason[];

export function exitReasonLabel(id?: string | null): string {
  if (!id) return "Sem motivo informado";
  return STUDENT_EXIT_REASONS.find((r) => r.id === id)?.label || id;
}

/** Mensagem padrão de reengajamento no WhatsApp. */
export function buildWinbackMessage(studentName: string, schoolName?: string | null): string {
  const school = schoolName ? ` na ${schoolName}` : "";
  return `Olá ${studentName}! Sentimos sua falta${school}. Quer retomar suas aulas de música? Podemos te ajudar a voltar. 🎵`;
}
