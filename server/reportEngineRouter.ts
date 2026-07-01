import { router, protectedProcedure } from './_core/trpc';
import { z } from 'zod';
import { ReportGenerator } from './report_engine';

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
      })
    )
    .mutation(async ({ input, ctx }) => {
      const report = new ReportGenerator({
        title: input.title,
        company: input.company,
        period: input.period,
        generated_by: ctx.user.name || undefined,
        columns: input.columns,
        rows: input.rows,
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
