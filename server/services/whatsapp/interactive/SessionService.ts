// ─── InteractiveSessionService (§12) — sessão de atendimento por telefone.
// TTL padrão de 30 min (env). Expirada → "Essa sessão expirou..." e reinício.

import { eq } from "drizzle-orm";
import { interactiveSessions } from "../../../../drizzle/schema";
import { INTERACTIVE_CONFIG } from "./types";

export interface InteractiveSession {
  id: number;
  organizationId: number;
  userId: number;
  phone: string;
  currentMenu: string;
  previousMenu: string | null;
  context: any;
  status: string;
  expiresAt: Date;
}

export function computeExpiry(base = new Date()): Date {
  return new Date(base.getTime() + INTERACTIVE_CONFIG.sessionMinutes() * 60_000);
}

export function isExpired(session: { status: string; expiresAt: Date | string } | null): boolean {
  if (!session) return false;
  if (session.status === "expired") return true;
  return new Date(session.expiresAt).getTime() < Date.now();
}

export async function getActiveSession(db: any, phone: string): Promise<InteractiveSession | null> {
  const [s] = await db.select().from(interactiveSessions).where(eq(interactiveSessions.phone, phone)).limit(1);
  if (!s) return null;
  if (isExpired(s)) {
    await db.update(interactiveSessions).set({ status: "expired" }).where(eq(interactiveSessions.id, s.id));
    return null;
  }
  return s as InteractiveSession;
}

/** Cria (upsert) a sessão do contato — reativa se expirada. */
export async function upsertSession(db: any, opts: {
  organizationId: number; userId: number; phone: string;
  currentMenu: string; previousMenu?: string | null; context?: any;
}): Promise<InteractiveSession> {
  const payload = {
    organizationId: opts.organizationId,
    userId: opts.userId,
    currentMenu: opts.currentMenu,
    previousMenu: opts.previousMenu ?? null,
    context: opts.context ?? null,
    status: "active",
    expiresAt: computeExpiry(),
  };
  const [row] = await db.insert(interactiveSessions)
    .values({ phone: opts.phone, ...payload })
    .onConflictDoUpdate({
      target: interactiveSessions.phone,
      set: payload,
    })
    .returning();
  return row as InteractiveSession;
}

export async function navigateSession(db: any, sessionId: number, currentMenu: string, previousMenu: string | null, context?: any) {
  await db.update(interactiveSessions).set({
    currentMenu,
    previousMenu,
    context: context ?? null,
    status: "active",
    expiresAt: computeExpiry(),
    updatedAt: new Date(),
  }).where(eq(interactiveSessions.id, sessionId));
}

export async function closeSession(db: any, phone: string) {
  await db.delete(interactiveSessions).where(eq(interactiveSessions.phone, phone));
}
