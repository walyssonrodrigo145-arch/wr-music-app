export interface SchedulePreviewInput {
  date: Date;
  slot?: { dayOfWeek: number; time: string } | null;
}

export interface SchedulePreviewGroup {
  dayOfWeek: number;
  label: string;
  dates: Date[];
  times: string[];
}

export interface SchedulePreview {
  total: number;
  groups: SchedulePreviewGroup[];
  firstDate: Date | null;
  lastDate: Date | null;
  summary: string;
}

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function weekdayShort(dayOfWeek: number): string {
  return WEEKDAY_SHORT[((dayOfWeek % 7) + 7) % 7];
}

export function weekdayFull(dayOfWeek: number): string {
  return WEEKDAY_FULL[((dayOfWeek % 7) + 7) % 7];
}

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function buildSchedulePreview(occurrences: SchedulePreviewInput[]): SchedulePreview {
  const items = (occurrences || [])
    .filter((item) => item && item.date instanceof Date && !isNaN(item.date.getTime()))
    .map((item) => ({
      date: item.date,
      time: item.slot?.time || formatTime(item.date),
      dayOfWeek: item.date.getDay(),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const groupsMap = new Map<number, SchedulePreviewGroup>();
  for (const item of items) {
    const group =
      groupsMap.get(item.dayOfWeek) ||
      ({ dayOfWeek: item.dayOfWeek, label: weekdayShort(item.dayOfWeek), dates: [], times: [] } as SchedulePreviewGroup);
    group.dates.push(item.date);
    if (!group.times.includes(item.time)) group.times.push(item.time);
    groupsMap.set(item.dayOfWeek, group);
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const uniqueTimes = Array.from(new Set(items.map((item) => item.time)));
  const parts = [`${items.length} ${items.length === 1 ? "aula" : "aulas"}`];
  if (groups.length > 0 && groups.length <= 4) parts.push(groups.map((group) => group.label).join(", "));
  if (uniqueTimes.length === 1) parts.push(uniqueTimes[0]);

  return {
    total: items.length,
    groups,
    firstDate: items[0]?.date || null,
    lastDate: items[items.length - 1]?.date || null,
    summary: parts.join(" · "),
  };
}
