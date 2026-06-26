import { Request, Response, NextFunction } from "express";
import { COOKIE_NAME } from "../../shared/const";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Filtro de Rate Limiting (Anti-DDoS / Brute Force)
 *
 * CORREÇÃO CRÍTICA (v2):
 * - Agora usa COOKIE_NAME ("app_session_id") importado de shared/const — mesmo nome
 *   que o SDK do servidor seta ao autenticar o usuário.
 * - Antes, buscava "sessionId" / "connect.sid" que nunca existem neste sistema,
 *   fazendo com que TODOS os usuários fossem agrupados pelo IP — esgotando o
 *   contador em conjunto.
 *
 * @param windowMs   Janela de tempo em milissegundos
 * @param max        Máximo de requisições por janela por chave (usuário/IP)
 * @param message    Mensagem de erro amigável
 * @param skipRoutes Lista de sufixos de rota que ficam isentos do limite (ex.: automações internas)
 */
export const createRateLimiter = (
  windowMs: number,
  max: number,
  message: string,
  skipRoutes: string[] = []
) => {
  // Store isolado por closure — cada limiter tem o seu próprio
  const store: Record<string, RateLimitEntry> = {};

  // Limpeza periódica para evitar vazamento de memória (a cada windowMs)
  setInterval(() => {
    const now = Date.now();
    for (const key in store) {
      if (store[key].resetTime <= now) {
        delete store[key];
      }
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Permite isentar rotas específicas (ex.: mutations de automações que
    // já são protectedProcedures com autenticação própria)
    if (skipRoutes.length > 0) {
      const path = req.path || "";
      if (skipRoutes.some((r) => path.includes(r))) {
        return next();
      }
    }

    // ✅ FIX v2: usa COOKIE_NAME = "app_session_id" — o mesmo nome que o SDK
    // seta ao autenticar. Antes era "sessionId"/"connect.sid" que nunca existem.
    const sessionId =
      (req.cookies && req.cookies[COOKIE_NAME]) ||
      req.headers["authorization"] ||
      null;

    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown";

    // Chave composta: se há sessão usa ela (mais precisa), senão cai no IP
    const key = sessionId ? `sess_${sessionId}_${ip}` : `ip_${ip}`;

    const now = Date.now();

    if (!store[key] || now > store[key].resetTime) {
      store[key] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    store[key].count++;

    if (store[key].count > max) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);

      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(store[key].resetTime / 1000)));

      // Formato compatível com tRPC + SuperJSON
      return res.status(429).json({
        error: {
          json: {
            message: message,
            code: -32005, // TRPC TOO_MANY_REQUESTS code
            data: {
              code: "TOO_MANY_REQUESTS",
              httpStatus: 429,
            },
          },
        },
      });
    }

    next();
  };
};

export const loginLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutos
  10, // limite de 10 tentativas
  "Muitas tentativas de login. Por favor, tente novamente em 15 minutos."
);

export const registerLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hora
  5, // limite de 5 registros por IP
  "Limite de criação de contas excedido. Tente novamente mais tarde."
);
