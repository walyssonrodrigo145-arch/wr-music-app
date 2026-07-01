import { Cell } from 'exceljs';

export function formatCellByType(cell: Cell, value: any) {
  if (value === null || value === undefined) {
    cell.value = '';
    return;
  }

  // Detect and format Dates
  if (value instanceof Date) {
    cell.value = value;
    cell.numFmt = 'dd/mm/yyyy hh:mm:ss';
    return;
  }

  // Se string parecer data dd/mm/yyyy ou yyyy-mm-dd
  if (typeof value === 'string') {
    const dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/;
    if (dateRegex.test(value) && !isNaN(Date.parse(value))) {
      // Deixa como string ou converte pra data, dependendo da necessidade
      cell.value = value;
      return;
    }
  }

  // Detect and format Numbers
  if (typeof value === 'number') {
    cell.value = value;
    // Se tiver decimal, formata com 2 casas
    if (value % 1 !== 0) {
      cell.numFmt = '#,##0.00';
    } else {
      cell.numFmt = '#,##0'; // Inteiro
    }
    return;
  }

  // Default string
  cell.value = String(value);
}
