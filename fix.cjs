const fs = require('fs');
let code = fs.readFileSync('server/routers.ts', 'utf-8');

// fix 'db is possibly null' globally for paymentDues and others that have const db = await getDb(); without check.
code = code.replace(/const db = await getDb\(\);\s*(?!if\s*\(!db\))/g, 'const db = await getDb();\n          if (!db) throw new Error("Database not available");\n          ');

// reminderTemplates: list
code = code.replace(/list: protectedProcedure\.query\(async \(\{ ctx \}\) => \{\s*const orgId = ctx\.user\.organizationId!;/g, 'list: protectedProcedure.query(async ({ ctx }) => {\n      const db = await getDb();\n      if (!db) throw new Error("Database not available");\n      const orgId = ctx.user.organizationId!;');

// reminderTemplates: update and delete
code = code.replace(/mutation\(async \(\{ ctx, input \}\) => \{\s*try \{\s*const orgId = ctx\.user\.organizationId!;/g, 'mutation(async ({ ctx, input }) => {\n        try {\n          const db = await getDb();\n          if (!db) throw new Error("Database not available");\n          const orgId = ctx.user.organizationId!;');

// paymentDues: getRevenueByDueDay
code = code.replace(/getRevenueByDueDay: protectedProcedure\s*\.input\(z\.object\(\{[\s\S]*?\}\)\)\s*\.query\(async \(\{ ctx, input \}\) => \{\s*try \{\s*const orgId = ctx\.user\.organizationId!;/g, 'getRevenueByDueDay: protectedProcedure\n      .input(z.object({\n        month: z.number(),\n        year: z.number(),\n      }))\n      .query(async ({ ctx, input }) => {\n        try {\n          const db = await getDb();\n          if (!db) throw new Error("Database not available");\n          const orgId = ctx.user.organizationId!;');

// paymentDues: syncOverdue
code = code.replace(/syncOverdue: protectedProcedure\s*\.mutation\(async \(\{ ctx \}\) => \{\s*try \{\s*const orgId = ctx\.user\.organizationId!;/g, 'syncOverdue: protectedProcedure.mutation(async ({ ctx }) => {\n        try {\n          const db = await getDb();\n          if (!db) throw new Error("Database not available");\n          const orgId = ctx.user.organizationId!;');

// fix missing 'now' in routers.ts 
code = code.replace(/createdAt: now\(\)/g, 'createdAt: new Date()');

fs.writeFileSync('server/routers.ts', code);
console.log('Fixed routers.ts with fix.cjs');
