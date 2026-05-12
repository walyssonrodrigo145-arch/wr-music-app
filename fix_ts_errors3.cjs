const fs = require('fs');

function fixDbTs() {
    let code = fs.readFileSync('server/db.ts', 'utf-8');
    if (!code.includes('import { organizations }')) {
        code = code.replace(/import { users, students/, 'import { organizations, users, students');
        fs.writeFileSync('server/db.ts', code);
    }
}

function fixRoutersTs() {
    let code = fs.readFileSync('server/routers.ts', 'utf-8');
    
    if (!code.includes('import { organizations }')) {
        code = code.replace(/import { users, students/, 'import { organizations, users, students');
    }

    const replacements = [
        // db possibly null
        { search: /const db = await getDb\(\);\n\s*return db\.select\(\)\.from\(studentGoals\)/g, replace: 'const db = await getDb();\n      if (!db) throw new Error("Database not available");\n      return db.select().from(studentGoals)' },
        { search: /const db = await getDb\(\);\n\s*return db\.select\(\)\.from\(studentMaterials\)/g, replace: 'const db = await getDb();\n      if (!db) throw new Error("Database not available");\n      return db.select().from(studentMaterials)' },
        { search: /const db = await getDb\(\);\n\s*return db\.select\(\)\.from\(studentProgress\)/g, replace: 'const db = await getDb();\n      if (!db) throw new Error("Database not available");\n      return db.select().from(studentProgress)' },
        
        { search: /const db = await getDb\(\);\n\s*const \[existing\] = await db/g, replace: 'const db = await getDb();\n        if (!db) throw new Error("Database not available");\n        const [existing] = await db' },
        
        // db not found
        { search: /const isAdmin = ctx\.user\.role === 'admin' \|\| ctx\.user\.openId === ENV\.ownerOpenId;\n\s*const orgId = ctx\.user\.organizationId!;\n\s*return db\.select/g, replace: 'const isAdmin = ctx.user.role === \'admin\' || ctx.user.openId === ENV.ownerOpenId;\n      const orgId = ctx.user.organizationId!;\n      const db = await getDb();\n      if (!db) throw new Error("Database not available");\n      return db.select' },
        
        { search: /const orgId = ctx\.user\.organizationId!;\n\s*const rows = await db\.select/g, replace: 'const orgId = ctx.user.organizationId!;\n        const db = await getDb();\n        if (!db) throw new Error("Database not available");\n        const rows = await db.select' },
        
        { search: /const orgId = ctx\.user\.organizationId!;\n\s*return db\.select/g, replace: 'const orgId = ctx.user.organizationId!;\n      const db = await getDb();\n      if (!db) throw new Error("Database not available");\n      return db.select' },

        { search: /const orgId = ctx\.user\.organizationId!;\n\s*await db/g, replace: 'const orgId = ctx.user.organizationId!;\n          const db = await getDb();\n          if (!db) throw new Error("Database not available");\n          await db' },

        { search: /const orgId = ctx\.user\.organizationId!;\n\s*const \[existing\] = await db/g, replace: 'const orgId = ctx.user.organizationId!;\n          const db = await getDb();\n          if (!db) throw new Error("Database not available");\n          const [existing] = await db' },
        
        // isAdmin redeclaration
        { search: /const isAdmin =/g, replace: 'const isUserAdmin =' },
        { search: /isAdmin \? undefined/g, replace: 'isUserAdmin ? undefined' },
        { search: /isAdmin \?/g, replace: 'isUserAdmin ?' },
        { search: /isAdmin,/g, replace: 'isUserAdmin,' },
        
        // now undefined
        { search: /gte\(lessons\.scheduledAt, now\)/g, replace: 'gte(lessons.scheduledAt, new Date())' },
        { search: /lte\(lessons\.scheduledAt, now\)/g, replace: 'lte(lessons.scheduledAt, new Date())' },
        { search: /, now\)/g, replace: ', new Date())' },

        // specific line fixes
        { search: /month \|\| now\.getMonth/g, replace: 'month || new Date().getMonth' },
        { search: /year \|\| now\.getFullYear/g, replace: 'year || new Date().getFullYear' },
        { search: /input\?\.month \?\? now\.getMonth/g, replace: 'input?.month ?? new Date().getMonth' },
        { search: /input\?\.year \?\? now\.getFullYear/g, replace: 'input?.year ?? new Date().getFullYear' },

        { search: /studentId: z\.number\(\)\.optional\(\),/g, replace: 'studentId: z.number().nullable().optional(),' },
        
        // fix missing now in some other places
        { search: /status: now > /g, replace: 'status: new Date() > ' }
    ];

    for (let r of replacements) {
        code = code.replace(r.search, r.replace);
    }
    
    // Fix number | undefined
    code = code.replace(/eq\(students\.id, input\.studentId\)/g, 'eq(students.id, input.studentId as number)');
    code = code.replace(/eq\(lessons\.studentId, input\.studentId\)/g, 'eq(lessons.studentId, input.studentId as number)');

    fs.writeFileSync('server/routers.ts', code);
}

fixDbTs();
fixRoutersTs();
console.log("Done");
