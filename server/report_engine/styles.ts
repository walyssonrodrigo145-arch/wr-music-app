import { Workbook, Worksheet, Cell, Row, Column } from 'exceljs';

export function applyHeaderStyles(row: Row) {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0070C0' }, // Azul padrão
    };
    cell.font = {
      color: { argb: 'FFFFFFFF' },
      bold: true,
      name: 'Inter',
      size: 11,
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
      right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
    };
  });
}

export function applyRowStyles(row: Row, isAlternate: boolean) {
  row.eachCell((cell) => {
    cell.font = { name: 'Inter', size: 10 };
    cell.alignment = { vertical: 'middle', wrapText: true };
    if (isAlternate) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9F9F9' },
      };
    }
  });
}

export function autoFitColumns(worksheet: Worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    if (column && column.eachCell) {
      column.eachCell({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    }
    // Limite máximo de 50 para não ficar gigantesca, limite minimo 10
    column.width = Math.max(10, Math.min(50, maxLength + 2));
  });
}
