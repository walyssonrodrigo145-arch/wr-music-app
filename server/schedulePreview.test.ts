import { describe, it, expect } from "vitest";
import { buildSchedulePreview, weekdayFull, weekdayShort } from "@shared/schedulePreview";

function at(year: number, month: number, day: number, hour: number, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

describe("Prévia do agendamento (shared/schedulePreview)", () => {
  it("retorna vazio quando não há ocorrências", () => {
    const preview = buildSchedulePreview([]);

    expect(preview.total).toBe(0);
    expect(preview.groups).toHaveLength(0);
    expect(preview.firstDate).toBeNull();
    expect(preview.lastDate).toBeNull();
    expect(preview.summary).toBe("0 aulas");
  });

  it("resume 4 aulas semanais no mesmo dia e horário", () => {
    const preview = buildSchedulePreview([
      { date: at(2026, 9, 29, 17) },
      { date: at(2026, 10, 6, 17) },
      { date: at(2026, 10, 13, 17) },
      { date: at(2026, 10, 20, 17) },
    ]);

    expect(preview.total).toBe(4);
    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0].label).toBe("Ter");
    expect(preview.groups[0].dates.map((d) => d.getDate())).toEqual([29, 6, 13, 20]);
    expect(preview.summary).toBe("4 aulas · Ter · 17:00");
    expect(preview.firstDate?.getDate()).toBe(29);
    expect(preview.lastDate?.getDate()).toBe(20);
  });

  it("agrupa multi-slot (seg e qua) e ordena crescente", () => {
    const preview = buildSchedulePreview([
      { date: at(2026, 9, 30, 17) },
      { date: at(2026, 9, 28, 17) },
      { date: at(2026, 10, 7, 17) },
      { date: at(2026, 10, 5, 17) },
    ]);

    expect(preview.total).toBe(4);
    expect(preview.groups.map((group) => group.label)).toEqual(["Seg", "Qua"]);
    expect(preview.firstDate?.getDate()).toBe(28);
    expect(preview.lastDate?.getDate()).toBe(7);
    expect(preview.summary).toBe("4 aulas · Seg, Qua · 17:00");
  });

  it("não mostra horário no resumo quando os dias têm horários diferentes", () => {
    const preview = buildSchedulePreview([
      { date: at(2026, 9, 28, 17), slot: { dayOfWeek: 1, time: "17:00" } },
      { date: at(2026, 9, 30, 19), slot: { dayOfWeek: 3, time: "19:00" } },
    ]);

    expect(preview.summary).toBe("2 aulas · Seg, Qua");
    expect(preview.groups[0].times).toEqual(["17:00"]);
    expect(preview.groups[1].times).toEqual(["19:00"]);
  });

  it("ignora datas inválidas e mantém hora do slot", () => {
    const preview = buildSchedulePreview([
      { date: new Date("data-invalida") },
      { date: at(2026, 9, 29, 8), slot: { dayOfWeek: 1, time: "08:30" } },
    ]);

    expect(preview.total).toBe(1);
    expect(preview.summary).toBe("1 aula · Ter · 08:30");
  });

  it("expõe rótulos de dia da semana", () => {
    expect(weekdayShort(0)).toBe("Dom");
    expect(weekdayFull(1)).toBe("Segunda");
    expect(weekdayShort(6)).toBe("Sáb");
  });
});
