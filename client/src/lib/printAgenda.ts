// Impressão da agenda (semana/dia/mês) — janela limpa com window.print().
// P0 agenda: botão "Imprimir" no desktop, com filtros aplicados.

export interface PrintAgendaLesson {
  scheduledAt: string | Date;
  title?: string | null;
  studentName?: string | null;
  experimentalName?: string | null;
  teacherName?: string | null;
  studioRoomName?: string | null;
  status?: string | null;
  studentCount?: number | null;
  lessonType?: string | null;
}

export interface PrintAgendaDay {
  date: Date;
  lessons: PrintAgendaLesson[];
  notes?: string[];
}

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  concluida: "Concluída",
  falta: "Falta",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
  a_repor: "A Repor",
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const hora = (v: string | Date) => {
  const d = new Date(v);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const dataBR = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** Abre uma janela de impressão da agenda. Retorna false se o navegador bloqueou o popup. */
export function imprimirAgenda(opts: { titulo: string; subtitulo?: string; dias: PrintAgendaDay[] }): boolean {
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) return false;

  const blocos = opts.dias
    .filter((d) => d.lessons.length > 0 || (d.notes && d.notes.length > 0))
    .map((dia) => {
      const linhas = dia.lessons
        .slice()
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
        .map((l) => {
          const aluno = l.studentName || l.experimentalName || "Aluno";
          const extra = l.lessonType === "turma" && l.studentCount && l.studentCount > 1 ? ` (turma: ${l.studentCount})` : "";
          return `<tr>
            <td class="hora">${esc(hora(l.scheduledAt))}</td>
            <td><strong>${esc(aluno)}</strong>${esc(extra)}</td>
            <td>${esc(l.title || "Aula")}</td>
            <td>${esc(l.teacherName || "")}</td>
            <td>${esc(l.studioRoomName || "")}</td>
            <td>${esc(STATUS_LABEL[String(l.status || "agendada")] || l.status || "")}</td>
          </tr>`;
        })
        .join("");

      const feriados = (dia.notes || []).length
        ? `<p class="feriado">📌 ${dia.notes!.map(esc).join(" • ")}</p>`
        : "";

      return `<section class="dia">
        <h2>${DIAS_SEMANA[dia.date.getDay()]}, ${dataBR(dia.date)} <span class="qtd">${dia.lessons.length} aula(s)</span></h2>
        ${feriados}
        ${linhas ? `<table><thead><tr><th>Hora</th><th>Aluno</th><th>Aula</th><th>Professor</th><th>Sala</th><th>Status</th></tr></thead><tbody>${linhas}</tbody></table>` : `<p class="vazio">Sem aulas.</p>`}
      </section>`;
    })
    .join("");

  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <title>${esc(opts.titulo)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin: 24px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .sub { font-size: 12px; color: #555; margin: 0 0 18px; }
      .dia { margin-bottom: 20px; break-inside: avoid; }
      .dia h2 { font-size: 14px; margin: 0 0 6px; border-bottom: 2px solid #111; padding-bottom: 4px; }
      .qtd { font-size: 11px; color: #666; font-weight: normal; }
      .feriado { font-size: 11px; background: #fff7e6; border: 1px solid #ffd591; padding: 4px 8px; border-radius: 6px; margin: 4px 0 8px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee; }
      th { background: #fafafa; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #666; }
      td.hora { font-weight: 700; white-space: nowrap; }
      .vazio { font-size: 11px; color: #999; margin: 4px 0; }
      @media print { body { margin: 12mm; } }
    </style></head><body>
    <h1>${esc(opts.titulo)}</h1>
    ${opts.subtitulo ? `<p class="sub">${esc(opts.subtitulo)}</p>` : ""}
    ${blocos || "<p class='vazio'>Nenhuma aula no período.</p>"}
    <script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
  </body></html>`);
  win.document.close();
  return true;
}
