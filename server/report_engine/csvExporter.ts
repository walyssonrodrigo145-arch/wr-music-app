import { ReportConfig } from './types';
import { ReportEngineConfig } from './config';
import { escapeCSV } from './helpers';

export function generateCSV(config: ReportConfig): string {
  const separator = ReportEngineConfig.csvSeparator;
  const lines: string[] = [];

  // Cabeçalhos
  const headerLine = config.columns.map((col) => escapeCSV(String(col))).join(separator);
  lines.push(headerLine);

  // Linhas de dados
  for (const row of config.rows) {
    const rowLine = row
      .map((val) => {
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return escapeCSV(val.toISOString());
        return escapeCSV(String(val));
      })
      .join(separator);
    lines.push(rowLine);
  }

  // O CSV final é apenas dados (conforme os requisitos: sem titulo, empresa ou formatação visual)
  // Requisito: UTF-8. Em Node.js salvaremos/retornaremos como buffer utf-8.
  return lines.join('\n');
}
