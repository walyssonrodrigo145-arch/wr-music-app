import { TRPCError } from "@trpc/server";

export function handleDbError(error: any, context: string = "operação"): never {
  console.error(`[DB Error] ${context}:`, error);

  // Se já for um erro do tRPC, apenas repassamos
  if (error instanceof TRPCError) {
    throw error;
  }

  const message = error.message || "";
  
  // Mapeamento de erros comuns do PostgreSQL/Drizzle
  if (message.includes("unique constraint") || message.includes("duplicate key")) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Este registro já existe (e-mail ou identificador duplicado).",
    });
  }

  if (message.includes("foreign key constraint")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Não foi possível realizar esta ação pois existem registros dependentes.",
    });
  }

  if (message.includes("lesson_status") && message.includes("invalid input value")) {
     throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "O status selecionado não é suportado pelo sistema no momento.",
    });
  }

  // Erro genérico amigável (com detalhe para debug em desenvolvimento)
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Erro ao realizar ${context}: ${message}. Por favor, tente novamente mais tarde.`,
    cause: error,
  });
}
