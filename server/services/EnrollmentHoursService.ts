// ─── PRD_MATRICULA_HORARIOS: resolução do expediente da escola para matrículas ─
// `settings` é POR USUÁRIO (várias linhas por organização). O expediente real
// costuma estar na linha de quem o configurou (professor/admin), NÃO na linha
// com schoolName — antes, se a linha "schoolName" não tinha hours, o link de
// matrícula mostrava "Sem horários disponíveis" para sempre.
// Regra: usa a linha que de fato TIVER dias ativos configurados; fallback
// escolar padrão seg-sex 08:00-18:00 (mesma regra do ScheduleAvailabilityService).

import { parseSchoolHours, type SchoolDayConfig } from "./ScheduleAvailabilityService";

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
