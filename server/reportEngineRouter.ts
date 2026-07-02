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

          const todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
          const systemPrompt = `Você é um Consultor de Negócios Sênior especialista em Escolas de Música.
Sua tarefa é analisar os dados fornecidos e gerar um Resumo Executivo estratégico.
DIRETRIZES ABSOLUTAS E OBRIGATÓRIAS (O NÃO CUMPRIMENTO RESULTARÁ EM FALHA):
1. É ESTRITAMENTE PROIBIDO o uso de formatação Markdown. NÃO USE asteriscos (**), sustenidos (#), negrito ou itálico de forma alguma, pois este texto será exportado para o Excel. Use apenas texto plano.
2. Divida sua análise em: 1. Diagnóstico Geral, 2. Pontos Críticos / Oportunidades, 3. Plano de Ação.
3. ATENÇÃO SOBRE INADIMPLÊNCIA: Hoje é dia ${todayStr}. Se um registro estiver com status PENDENTE mas a data for IGUAL ou MAIOR que a data de hoje, ele está DENTRO DO PRAZO NORMAL. NÃO CHAME de atraso ou inadimplência. Só considere atrasado o que for menor que a data de hoje. 
4. ATENÇÃO: As tabelas enviadas referem-se a DESPESAS (contas a pagar da escola, não alunos). Não confunda contas a pagar (despesas) com falta de pagamentos de alunos.
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
