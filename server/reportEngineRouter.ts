import { router, protectedProcedure } from './_core/trpc';
import { z } from 'zod';
import { ReportGenerator } from './report_engine';
import { db } from './db';
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
        const settings = await db.query.settings.findFirst();
        const apiKey = settings?.geminiApiKey;
        const model = settings?.geminiModel;

        const systemPrompt = `Você é um Consultor Sênior em uma escola/estúdio de música. 
Sua tarefa é analisar os dados do relatório fornecido e gerar um Resumo Executivo Premium.
Identifique tendências, anomalias, picos de inadimplência, melhores números, e dê 2 a 3 sugestões de melhoria acionáveis.
Seja direto, corporativo, e use formatação limpa (tópicos, sem markdown excessivo que quebre no excel).
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
