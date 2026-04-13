import { TRPCError } from "@trpc/server";

export function handleDbError(error: any, context: string = "operação"): never {
  console.error(`[DB Error] ${context}:`, error);

  // Se já for um erro do tRPC, apenas repassamos
  if (error instanceof TRPCError) {
    throw error;
  }

  const message = error.message || "";
  const detail = error.detail || "";
  const code = error.code || "";
  const hint = error.hint || "";
  
  // Log completo no servidor para debug
  console.error(`[DB Error Details] Code: ${code}, Detail: ${detail}, Hint: ${hint}`);

  // Mapeamento de erros comuns do PostgreSQL/Drizzle
  if (code === '23505' || message.includes("unique constraint") || message.includes("duplicate key")) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este registro já existe (e-mail ou identificador duplicado).",
    });
  }

  if (code === '23503' || message.includes("foreign key constraint")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Não foi possível realizar esta ação pois existem registros dependentes.",
    });
  }

  // Erro de NOT NULL (específico para studentId)
  if (code === '23502') {
     throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Erro de integridade: O campo '${error.column || "desconhecido"}' não pode ser nulo. Isso indica que a migração para aulas experimentais não foi aplicada corretamente no banco.`,
    });
  }

  if (message.includes("lesson_status") && message.includes("invalid input value")) {
     throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "O status selecionado não é suportado pelo sistema no momento.",
    });
  }

  // Erro genérico amigável (com detalhe para debug em desenvolvimento)
  const fullDetail = detail ? ` (${detail})` : "";
  const fullHint = hint ? ` [Dica: ${hint}]` : "";
  
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Erro ao realizar ${context}: ${message}${fullDetail}${fullHint}. Code: ${code}.`,
    cause: error,
  });
}
