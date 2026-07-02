import { router, protectedProcedure } from './_core/trpc';
import { z } from 'zod';
import { ReportGenerator } from './report_engine';
import { getDb } from './db';
import { callGemini } from './utils/gemini';

export const reportEngineRouter = router({
  generate: protectedProcedure
    .input(
      z.object({
        format: z.enum(['csv', 'excel']),
        title: z.string(),
        company: z.string().optional(),
        period: z.string().optional(),
        columns: z.array(z.string()),
        rows: z.array(z.array(z.any())),
        includeAiInsights: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let aiInsightsText: string | undefined = undefined;

      if (input.includeAiInsights && input.format === 'excel') {
        const db = await getDb();
        if (db) {
          const { getSettingsByUserId } = await import('./db');
          const settings = await getSettingsByUserId(ctx.user.organizationId!, ctx.user.id);
          const apiKey = settings?.aiProvider === 'groq' ? settings?.groqApiKey : settings?.geminiApiKey;
          const model = settings?.aiProvider === 'groq' ? settings?.groqModel : settings?.geminiModel;

          const systemPrompt = `Você é um Consultor de Negócios Sênior especialista em Escolas de Música.
Sua tarefa é analisar os dados financeiros/operacionais fornecidos e gerar um Resumo Executivo altamente estratégico e de fácil leitura.
Diretrizes:
- NÃO use NENHUMA formatação Markdown (NÃO use asteriscos **, sustenidos #, etc, pois o texto será injetado direto no Excel).
- Divida sua análise em 3 blocos claros: 1. Diagnóstico Geral, 2. Pontos Críticos / Oportunidades, 3. Plano de Ação (2 a 3 sugestões práticas).
- Traga insights reais cruzando os valores. Evite frases genéricas.
Relatório: ${input.title} - Período: ${input.period || 'Geral'}`;

          const dataStr = JSON.stringify({
            columns: input.columns,
            rows: input.rows.slice(0, 500) // Limite de 500 linhas para não estourar o token limit
          });

          try {
            aiInsightsText = await callGemini(
              [{ role: 'user', content: `Analise estes dados: ${dataStr}` }],
              systemPrompt,
              false,
              apiKey,
              model
            );
          } catch (error) {
            console.error("Falha ao gerar AI Insights para o relatório:", error);
            aiInsightsText = "A Inteligência Artificial não conseguiu gerar o relatório devido a uma falha na API ou falta de chave configurada.";
          }
        }
      }

      const report = new ReportGenerator({
        title: input.title,
        company: input.company,
        period: input.period,
        generated_by: ctx.user.name || undefined,
        columns: input.columns,
        rows: input.rows,
        includeAiInsights: input.includeAiInsights,
        aiInsightsText: aiInsightsText,
      });

      if (input.format === 'csv') {
        const csvString = report.exportCSV();
        return { type: 'csv', data: Buffer.from(csvString, 'utf-8').toString('base64') };
      } else {
        const excelBuffer = await report.exportExcel();
        return { type: 'excel', data: excelBuffer.toString('base64') };
      }
    }),
});
