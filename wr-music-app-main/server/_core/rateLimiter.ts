import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [ip: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Filtro básico de Rate Limiting (Anti-DDoS / Brute Force)
 * @param windowMs Janela de tempo em milissegundos
 * @param max Máximo de requisições por janela
 * @param message Mensagem de erro amigável
 */
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
    const now = Date.now();

    if (!store[ip] || now > store[ip].resetTime) {
      store[ip] = {
        count: 1,
        resetTime: now + windowMs,
      };
      return next();
    }

    store[ip].count++;

    if (store[ip].count > max) {
      return res.status(429).json({
        error: {
          message: message,
          code: "TOO_MANY_REQUESTS",
        },
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
