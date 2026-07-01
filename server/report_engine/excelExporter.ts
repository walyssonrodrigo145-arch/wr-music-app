import ExcelJS from 'exceljs';
import { ReportConfig } from './types';
import { applyHeaderStyles, applyRowStyles, autoFitColumns } from './styles';
import { formatCellByType } from './formatter';
import { ReportEngineConfig } from './config';

export async function generateExcel(config: ReportConfig): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = config.generated_by || ReportEngineConfig.defaultGenerator;
  workbook.created = new Date();

  const sheetName = config.sheet_name || ReportEngineConfig.defaultSheetName;
  const worksheet = workbook.addWorksheet(sheetName);

  // --- Resumo Executivo ---
  const company = config.company || ReportEngineConfig.defaultCompany;
  const period = config.period || ReportEngineConfig.defaultPeriod;
  const totalRows = config.rows.length;
  
  // Calculate simple totals for numeric columns
  const numericTotals = new Array(config.columns.length).fill(0);
  const numericCounts = new Array(config.columns.length).fill(0);
  
  config.rows.forEach(row => {
    row.forEach((val, index) => {
      if (typeof val === 'number') {
        numericTotals[index] += val;
        numericCounts[index]++;
      }
    });
  });

  let sumAll = 0;
  let countAll = 0;
  numericTotals.forEach((tot, idx) => {
    if (numericCounts[idx] > 0) {
      sumAll += tot;
      countAll += numericCounts[idx];
    }
  });
  const avgAll = countAll > 0 ? sumAll / countAll : 0;

  worksheet.addRow(['Resumo Executivo']);
  worksheet.getCell('A1').font = { bold: true, size: 14, name: 'Inter' };
  
  worksheet.addRow(['Empresa:', company]);
  worksheet.addRow(['Período:', period]);
  worksheet.addRow(['Data de Geração:', config.generated_at || new Date().toLocaleString('pt-BR')]);
  worksheet.addRow(['Gerado por:', workbook.creator]);
  worksheet.addRow(['Total de registros:', totalRows]);
  
  if (countAll > 0) {
    worksheet.addRow(['Soma Valores Numéricos:', sumAll]);
    worksheet.addRow(['Média Valores Numéricos:', avgAll]);
  }

  // Estilizando a tabela de resumo
  for (let i = 2; i <= worksheet.rowCount; i++) {
    worksheet.getCell(`A${i}`).font = { bold: true, name: 'Inter' };
  }

  // Linha vazia antes da tabela principal
  worksheet.addRow([]);
  
  // --- Tabela Principal ---
  const tableStartRowIndex = worksheet.rowCount + 1;
  const headerRow = worksheet.addRow(config.columns);
  
  // Aplica estilos do cabeçalho
  applyHeaderStyles(headerRow);
  
  // Adiciona os dados
  config.rows.forEach((row, index) => {
    const excelRow = worksheet.addRow([]);
    row.forEach((val, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      formatCellByType(cell, val);
    });
    // Aplica estilos zebrados
    applyRowStyles(excelRow, index % 2 === 1);
  });

  // Configurações da Planilha
  // Congelar a linha do cabeçalho
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: tableStartRowIndex }
  ];
  
  // Adicionar Filtros à tabela
  worksheet.autoFilter = {
    from: {
      row: tableStartRowIndex,
      column: 1
    },
    to: {
      row: tableStartRowIndex,
      column: config.columns.length
    }
  };

  // Ajustar larguras das colunas
  autoFitColumns(worksheet);

  // Retorna como Buffer (que será usado para enviar no response do Node.js)
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
