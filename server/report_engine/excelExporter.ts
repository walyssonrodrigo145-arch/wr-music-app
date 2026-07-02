import ExcelJS from 'exceljs';
import { ReportConfig } from './types';
import { applyHeaderStyles, applyRowStyles, autoFitColumns, COLORS, FONT_BASE } from './styles';
import { formatCellByType } from './formatter';
import { ReportEngineConfig } from './config';
import fs from 'fs';
import path from 'path';

export async function generateExcel(config: ReportConfig): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = config.generated_by || ReportEngineConfig.defaultGenerator;
  workbook.created = new Date();

  const company = config.company || ReportEngineConfig.defaultCompany;
  const period = config.period || ReportEngineConfig.defaultPeriod;
  const totalRows = config.rows.length;
  
  // -- CALCULATE KPIs --
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

  // 1. ABA RESUMO (KPIs)
  const summarySheet = workbook.addWorksheet('Resumo', { properties: { tabColor: { argb: 'FFF59E0B' } } });
  
  summarySheet.mergeCells('A1:C2');
  const sumTitle = summarySheet.getCell('A1');
  sumTitle.value = `Resumo Executivo - ${config.title}`;
  sumTitle.font = { name: FONT_BASE.name, size: 16, bold: true, color: { argb: COLORS.textWhite } };
  sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } };
  sumTitle.alignment = { vertical: 'middle', horizontal: 'center' };

  let rIdx = 4;
  const addCard = (label: string, value: any, isCurrency: boolean = false) => {
    summarySheet.mergeCells(`B${rIdx}:C${rIdx}`);
    summarySheet.mergeCells(`B${rIdx+1}:C${rIdx+1}`);
    
    const lCell = summarySheet.getCell(`B${rIdx}`);
    lCell.value = label;
    lCell.font = { name: FONT_BASE.name, size: 10, color: { argb: 'FF6B7280' } };
    lCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.secondary } };
    lCell.alignment = { horizontal: 'center' };
    lCell.border = { top: { style: 'thin', color: { argb: COLORS.border } }, left: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };

    const vCell = summarySheet.getCell(`B${rIdx+1}`);
    vCell.value = value;
    vCell.font = { name: FONT_BASE.name, size: 14, bold: true, color: { argb: COLORS.primary } };
    if (isCurrency) vCell.numFmt = '_-"R$ "* #,##0.00_-';
    vCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.secondary } };
    vCell.alignment = { horizontal: 'center' };
    vCell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, left: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
    
    rIdx += 3;
  };

  addCard('Total de registros', totalRows);
  if (countAll > 0) {
    addCard('Valor Total', sumAll, true);
    addCard('Valor Médio', avgAll, true);
  }
  addCard('Período', period);
  addCard('Gerado em', config.generated_at || new Date().toLocaleString('pt-BR'));
  
  summarySheet.getColumn('B').width = 25;
  summarySheet.getColumn('C').width = 25;

  // 2. ABA DADOS
  const sheetName = config.sheet_name || ReportEngineConfig.defaultSheetName;
  const worksheet = workbook.addWorksheet(sheetName, { properties: { tabColor: { argb: COLORS.primary } } });

  // Cabeçalho Corporativo
  worksheet.mergeCells('A1:E4');
  const headerCell = worksheet.getCell('A1');
  headerCell.value = `${company}\n${config.title}\nPeríodo: ${period}\nGerado por: ${workbook.creator} em ${config.generated_at || new Date().toLocaleString('pt-BR')}`;
  headerCell.font = { name: FONT_BASE.name, size: 12, bold: true, color: { argb: COLORS.textWhite } };
  headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } };
  headerCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  
  worksheet.addRow([]); // Linha 5 vazia

  // Tabela Principal
  const tableStartRowIndex = 6;
  const headerRow = worksheet.addRow(config.columns);
  
  // Aplica estilos do cabeçalho da tabela
  applyHeaderStyles(headerRow);
  
  // Adiciona os dados
  config.rows.forEach((row, index) => {
    const excelRow = worksheet.addRow([]);
    row.forEach((val, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      formatCellByType(cell, val);
    });
    // Aplica estilos zebrados e alinhamentos
    applyRowStyles(excelRow, index % 2 === 1);
  });

  // Congelar a linha do cabeçalho
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: tableStartRowIndex }
  ];
  
  // Adicionar Filtros à tabela nativamente se houver colunas
  if (config.columns.length > 0) {
    const endCol = String.fromCharCode(64 + config.columns.length); // Funciona até Z (26 colunas)
    worksheet.autoFilter = `A${tableStartRowIndex}:${endCol}${tableStartRowIndex + config.rows.length}`;
  }

  // Ajustar larguras das colunas
  autoFitColumns(worksheet);
  
  // Adicionar Rodapé (Footer nativo de impressão)
  worksheet.headerFooter.oddFooter = `&LRelatório gerado pelo MusicPro - ${company}&R&P`;

  // 3. ABA INSIGHTS DA IA (Opcional)
  if (config.includeAiInsights && config.aiInsightsText) {
    const aiSheet = workbook.addWorksheet('Análise da IA', { properties: { tabColor: { argb: 'FF8B5CF6' } } }); // Purple color
    
    // Configura layout de leitura
    aiSheet.views = [{ showGridLines: false }];
    
    // Título da Aba
    aiSheet.mergeCells('B2:H3');
    const aiTitle = aiSheet.getCell('B2');
    aiTitle.value = '🤖 Insights da Inteligência Artificial';
    aiTitle.font = { name: ReportEngineConfig.defaultFont, size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    aiTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };
    aiTitle.alignment = { vertical: 'middle', horizontal: 'center' };

    // Aviso de uso
    aiSheet.mergeCells('B4:H4');
    const aiWarning = aiSheet.getCell('B4');
    aiWarning.value = 'Esta análise foi gerada automaticamente por IA com base nos dados brutos e pode não substituir a avaliação de um contador.';
    aiWarning.font = { name: ReportEngineConfig.defaultFont, size: 9, italic: true, color: { argb: 'FF64748B' } };
    aiWarning.alignment = { vertical: 'middle', horizontal: 'center' };

    // Caixa de Texto do Insight
    aiSheet.mergeCells('B6:H30');
    const aiContent = aiSheet.getCell('B6');
    aiContent.value = config.aiInsightsText;
    aiContent.font = { name: ReportEngineConfig.defaultFont, size: 11, color: { argb: 'FF334155' } };
    aiContent.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    
    // Bordas no card
    const cardBorder = { style: 'thin' as const, color: { argb: 'FFE2E8F0' } };
    for(let r = 6; r <= 30; r++) {
      for(let c = 2; c <= 8; c++) {
        aiSheet.getCell(r, c).border = {
          top: r === 6 ? cardBorder : undefined,
          bottom: r === 30 ? cardBorder : undefined,
          left: c === 2 ? cardBorder : undefined,
          right: c === 8 ? cardBorder : undefined
        };
      }
    }
  }

  // Retorna como Buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
