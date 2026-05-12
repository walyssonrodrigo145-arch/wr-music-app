const fs = require('fs');

let file = fs.readFileSync('server/routers.ts', 'utf-8');
let dbFile = fs.readFileSync('server/db.ts', 'utf-8');

// server/db.ts: Cannot find name 'organizations'
if (!dbFile.includes('import { organizations }')) {
    dbFile = dbFile.replace(/import { users, students/, 'import { organizations, users, students');
    fs.writeFileSync('server/db.ts', dbFile);
}

// Fix missing db
file = file.replace(/const isAdmin = ctx\.user\.role === 'admin' \|\| ctx\.user\.openId === ENV\.ownerOpenId;\n\s*const orgId = ctx\.user\.organizationId!;\n\s*return db\.select/g, `const isAdmin = ctx.user.role === 'admin' || ctx.user.openId === ENV.ownerOpenId;
      const orgId = ctx.user.organizationId!;
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      return db.select`);

file = file.replace(/const orgId = ctx\.user\.organizationId!;\n\s*const rows = await db/g, `const orgId = ctx.user.organizationId!;
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        const rows = await db`);

// Add db to student dashboard
file = file.replace(/const orgId = ctx\.user\.organizationId!;\n\s*\/\/ Próximas aulas/g, `const orgId = ctx.user.organizationId!;
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Próximas aulas`);

file = file.replace(/const db = await getDb\(\);\s*if \(!db\) return \[\];/g, `const db = await getDb();
        if (!db) throw new Error("Database not available");`);

file = file.replace(/if \(!db\) throw new Error\("Acesso não autorizado"\);/g, `if (!db) throw new Error("Database not available");`);

// Remove double db declarations if any
file = file.replace(/const db = await getDb\(\);\s*const db = await getDb\(\);/g, 'const db = await getDb();');

// Fix organizations missing in routers.ts
if (!file.includes('import { organizations } from')) {
    file = file.replace(/import { users, students/, 'import { organizations, users, students');
}

// isAdmin redeclaration (change to var instead of const or rename)
file = file.replace(/const isAdmin = /g, 'let isAdmin = ');
file = file.replace(/let isAdmin = ctx\.user\.role/g, 'const isUserAdmin = ctx.user.role');
file = file.replace(/isAdmin \? undefined/g, 'isUserAdmin ? undefined');
file = file.replace(/isAdmin \?/g, 'isUserAdmin ?');

// 'now' missing 
file = file.replace(/gte\(lessons\.scheduledAt, now\)/g, 'gte(lessons.scheduledAt, new Date())');
file = file.replace(/lte\(lessons\.scheduledAt, now\)/g, 'lte(lessons.scheduledAt, new Date())');
file = file.replace(/, now/g, ', new Date()');

fs.writeFileSync('server/routers.ts', file);
