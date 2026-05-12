const fs = require('fs');
let code = fs.readFileSync('server/routers.ts', 'utf-8');

// 1. Fix 'db is possibly null' by ensuring all 'const db = await getDb();' are followed by 'if (!db) throw new Error("Database not available");'
code = code.replace(/const db = await getDb\(\);\s*(?!if \(!db\))/g, 'const db = await getDb();\n        if (!db) throw new Error("Database not available");\n        ');

// 2. Fix missing 'db' in reminderTemplates.update and delete
code = code.replace(/mutation\(async \(\{ ctx, input \}\) => \{\s*try \{\s*const orgId = ctx\.user\.organizationId!;/g, 'mutation(async ({ ctx, input }) => {\n        try {\n          const db = await getDb();\n          if (!db) throw new Error("Database not available");\n          const orgId = ctx.user.organizationId!;');

// 3. Fix missing 'db' in reminderTemplates.list
code = code.replace(/list: protectedProcedure\.query\(async \(\{ ctx \}\) => \{\s*const orgId = ctx\.user\.organizationId!;\s*return db\.select/g, 'list: protectedProcedure.query(async ({ ctx }) => {\n      const db = await getDb();\n      if (!db) throw new Error("Database not available");\n      const orgId = ctx.user.organizationId!;\n      return db.select');

// 4. Fix missing 'now' in settings
code = code.replace(/now\(\)/g, 'new Date()');

fs.writeFileSync('server/routers.ts', code);
console.log('Fixed routers.ts');
