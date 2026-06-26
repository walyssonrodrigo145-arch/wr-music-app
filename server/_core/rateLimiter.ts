import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Filtro básico de Rate Limiting (Anti-DDoS / Brute Force)
 * @param windowMs Janela de tempo em milissegundos
 * @param max Máximo de requisições por janela
 * @param message Mensagem de erro amigável
 *
 * CORREÇÃO: cada chamada a createRateLimiter cria seu próprio store isolado
 * (store não é mais um singleton global compartilhado entre todos os limiters).
 * Isso evita contaminação cruzada entre apiLimiter, loginLimiter e registerLimiter.
 */
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  // ✅ FIX: store isolado por closure — cada limiter tem o seu próprio
  const store: Record<string, RateLimitEntry> = {};

  return (req: Request, res: Response, next: NextFunction) => {
    // ✅ FIX: identificar usuário pelo session cookie quando disponível,
    // evitando que todos os usuários atrás do proxy Caddy/Docker sejam contados como UM só
    const sessionId =
      (req.cookies && (req.cookies["sessionId"] || req.cookies["connect.sid"])) ||
      req.headers["authorization"] ||
      null;

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";

    // Chave composta: se há sessão usa ela (mais precisa), senão usa só o IP
    const key = sessionId ? `sess_${sessionId}_${ip}` : `ip_${ip}`;

    const now = Date.now();

    if (!store[key] || now > store[key].resetTime) {
      store[key] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    store[key].count++;

    if (store[key].count > max) {
      // Formata a resposta de erro exatamente como o tRPC + SuperJSON espera
      return res.status(429).json({
        error: {
          json: {
            message: message,
            code: -32005, // TRPC TOO_MANY_REQUESTS code
            data: {
              code: "TOO_MANY_REQUESTS",
              httpStatus: 429
            }
          }
        }
      });
    }

    next();
  };
};

export const loginLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutos
  10,             // limite de 10 tentativas
  "Muitas tentativas de login. Por favor, tente novamente em 15 minutos."
);

export const registerLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hora
  5,              // limite de 5 registros por IP
  "Limite de criação de contas excedido. Tente novamente mais tarde."
);

