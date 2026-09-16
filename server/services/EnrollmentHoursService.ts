// ─── PRD_MATRICULA_HORARIOS: resolução do expediente da escola para matrículas ─
// `settings` é POR USUÁRIO (várias linhas por organização). O expediente real
// costuma estar na linha de quem o configurou (professor/admin), NÃO na linha
// com schoolName — antes, se a linha "schoolName" não tinha hours, o link de
// matrícula mostrava "Sem horários disponíveis" para sempre.
// Regra: usa a linha que de fato TIVER dias ativos configurados; fallback
// escolar padrão seg-sex 08:00-18:00 (mesma regra do ScheduleAvailabilityService).

import { eq, and, asc } from "drizzle-orm";
import { parseSchoolHours, type SchoolDayConfig } from "./ScheduleAvailabilityService";
import { professores, users } from "../../drizzle/schema";

export interface SettingsHoursLite {
  schoolHours: string | null;
  lessonDuration: number | null;
  schoolName: string | null;
}

export interface ResolvedSchoolHours {
  primary: SettingsHoursLite | null;
  dayConfig: SchoolDayConfig | null;
  hoursConfigured: boolean;
}

/**
 * Escolhe a linha de settings e a configuração do dia pedida:
 * 1º: qualquer linha com o dia solicitado ativo (start/end presentes);
 * 2º: qualquer linha com expediente configurado (honra dia fechado);
 * 3º: sem nenhuma configuração → padrão seg-sex 08:00-18:00 (fim de semana fechado).
 */
export function pickSettingsForHours(
  rows: SettingsHoursLite[],
  weekdayKey?: string
): ResolvedSchoolHours {
  const primary = rows.find(r => r.schoolName && r.schoolName.trim() !== "") || rows[0] || null;

  // 1º: linha com o dia solicitado ativo
  if (weekdayKey) {
    for (const row of rows) {
      const hours = parseSchoolHours((row as any).schoolHours);
      const cfg = hours[weekdayKey];
      if (cfg && cfg.active && cfg.start && cfg.end) {
        return { primary, dayConfig: cfg, hoursConfigured: true };
      }
    }
  }

  // 2º: linha com expediente configurado (dia pedido fechado → honra o fechamento)
  for (const row of rows) {
    const hours = parseSchoolHours((row as any).schoolHours);
    if (Object.values(hours).some((d: any) => d && d.active && d.start && d.end)) {
      const cfg = weekdayKey ? hours[weekdayKey] : undefined;
      return {
        primary,
        dayConfig: cfg ?? { active: false, start: "08:00", end: "18:00" },
        hoursConfigured: true,
      };
    }
  }

  // 3º: nada configurado na organização → padrão escolar
  const weekend = weekdayKey === "saturday" || weekdayKey === "sunday";
  return {
    primary,
    dayConfig: weekend
      ? { active: false, start: "08:00", end: "18:00" }
      : { active: true, start: "08:00", end: "18:00" },
    hoursConfigured: false,
  };
}

/**
 * PRD_MATRICULA_HORARIOS — RF-002 (fix produção 16/09): cadeia de resolução do
 * professor efetivo para o link de matrícula. Antes, escolas operadas por uma
 * única conta admin (sem registros em `professores` nem usuários role=professor)
 * quebravam o passo de horários ("Nenhum professor disponível") e a própria
 * matrícula. Cadeia:
 *   1) registros de `professores` da org (especialidade compatível → primeiro);
 *   2) usuários com role='professor' da org;
 *   3) dono/admin da org (aulas ficam vinculadas à conta administrativa).
 * Mesma cadeia usada pelo picker (getWeekdaySlots/getAvailableSlots) e pelo
 * submitEnrollment — garante que o slot mostrado e o slot reservado batem.
 */
export async function resolveEnrollmentTeacher(
  db: any,
  organizationId: number,
  instrumentName?: string | null
): Promise<{ userId: number | null; name: string | null }> {
  // 1. Registros formais de professores da escola
  const profs = await db
    .select({ userId: professores.userId, name: users.name, especialidade: professores.especialidade })
    .from(professores)
    .leftJoin(users, eq(professores.userId, users.id))
    .where(eq(professores.organizationId, organizationId));

  if (profs.length > 0) {
    const wanted = (instrumentName || "").toLowerCase();
    const match = profs.find((p: any) => (p.especialidade || "").toLowerCase().includes(wanted));
    const chosen = match || profs[0];
    return { userId: chosen.userId ?? null, name: chosen.name ?? null };
  }

  // 2. Usuários com perfil de professor (mesmo sem ficha em `professores`)
  const profUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.organizationId, organizationId), eq(users.role, "professor")));
  if (profUsers.length > 0) {
    return { userId: profUsers[0].id, name: profUsers[0].name };
  }

  // 3. Escola operada por uma única conta: dono/admin assume as aulas do link
  const admins = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.organizationId, organizationId), eq(users.role, "admin")))
    .orderBy(asc(users.id))
    .limit(1);
  if (admins.length > 0) {
    return { userId: admins[0].id, name: admins[0].name };
  }

  return { userId: null, name: null };
}
