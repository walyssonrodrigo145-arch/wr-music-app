// ─── Token store para URLs temporárias de arquivos locais ─────────────────
// Permite que iframes, <video> e <audio> acessem /uploads sem cookie de sessão.
// Tokens são válidos por 30 minutos e usam UUID v4 para evitar colisões.
//
// Mantido em módulo separado para evitar import circular entre
// server/_core/index.ts (que registra a rota) e server/routers/portalRouters.ts
// (que gera os tokens via tRPC).

import crypto from "crypto";

interface FileTokenEntry { relKey: string; expiresAt: number; }
export const fileTokenStore = new Map<string, FileTokenEntry>();

/** Cria um token temporário (30 min) para servir um arquivo local via /uploads-token. */
export function createFileToken(relKey: string): string {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutos
  fileTokenStore.set(token, { relKey, expiresAt });
  // Limpa tokens expirados a cada geração (low-traffic path)
  const now = Date.now();
  fileTokenStore.forEach((v, k) => {
    if (now > v.expiresAt) fileTokenStore.delete(k);
  });
  return token;
}
