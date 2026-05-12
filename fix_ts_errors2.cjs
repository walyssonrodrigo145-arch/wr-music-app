const fs = require('fs');

let file = fs.readFileSync('server/routers.ts', 'utf-8');

// 1. Missing `db`
file = file.replace(/return db\.select/g, 'const db = await getDb();\n      if (!db) throw new Error("Database not available");\n      return db.select');
file = file.replace(/const rows = await db/g, 'const db = await getDb();\n        if (!db) throw new Error("Database not available");\n        const rows = await db');

// 2. `db` is possibly null (when it was obtained using `const db = await getDb()`)
file = file.replace(/const db = await getDb\(\);\s*(?!if\()/g, 'const db = await getDb();\n        if (!db) throw new Error("Database not available");\n        ');

// Remove redundant `if (!db)` checks if any were duplicated
file = file.replace(/if \(!db\) throw new Error\("Database not available"\);\s*if \(!db\) throw new Error\("Database not available"\);/g, 'if (!db) throw new Error("Database not available");');

// 3. `now` is undefined
file = file.replace(/const now = new Date\(\);/g, ''); // Remove existing to put it at the top level or replace all usages
file = file.replace(/gte\(lessons\.scheduledAt, now\)/g, 'gte(lessons.scheduledAt, new Date())');
file = file.replace(/lte\(lessons\.scheduledAt, now\)/g, 'lte(lessons.scheduledAt, new Date())');
file = file.replace(/, now/g, ', new Date()');

// 4. `isAdmin` missing or redefined
file = file.replace(/const isAdmin = ctx\.user\.role/g, 'const isUserAdmin = ctx.user.role');
file = file.replace(/isAdmin \? undefined/g, 'isUserAdmin ? undefined');
file = file.replace(/isAdmin \?/g, 'isUserAdmin ?');

fs.writeFileSync('server/routers.ts', file);
