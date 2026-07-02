import { generateExcel } from './server/report_engine/excelExporter.js';

async function run() {
  try {
    const buf = await generateExcel({
      title: 'Teste',
      company: 'MusicPro',
      period: 'Julho/2026',
      columns: ['Col1', 'Col2'],
      rows: [['A', 10], ['B', -5]]
    });
    console.log('Success, buffer length:', buf.length);
  } catch (err) {
    console.error('ERROR:', err);
  }
}

run();
