import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./drizzle/schema";
import crypto from "crypto";

// Gera hash no mesmo formato que o servidor usa: salt:scryptKey
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

async function createTestUser() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is missing no arquivo .env");
    process.exit(1);
  }

  const sql = postgres(url);
  const db = drizzle(sql, { schema });

  try {
    console.log("🔍 Verificando usuários existentes...");
    
    const existingUsers = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      organizationId: schema.users.organizationId,
    }).from(schema.users).limit(10);

    if (existingUsers.length > 0) {
      console.log("\n✅ Usuários já existentes no banco:");
      console.table(existingUsers);
      console.log("\n💡 Use um desses usuários para fazer login.");
      console.log("   Se precisar criar novo, execute: pnpm tsx create_test_user.ts --force\n");
      
      if (!process.argv.includes("--force")) {
        await sql.end();
        return;
      }
    }

    // Verifica se já existe organização de teste
    let orgId: number | null = null;
    const existingOrgs = await db.select().from(schema.organizations).limit(1);
    
    if (existingOrgs.length > 0) {
      orgId = existingOrgs[0].id;
      console.log(`\n✅ Usando organização existente: ${existingOrgs[0].name} (ID: ${orgId})`);
    } else {
      // Cria organização de teste
      const [newOrg] = await db.insert(schema.organizations).values({
        name: "Escola de Música Teste",
        slug: "escola-teste-" + Date.now(),
        active: true,
      }).returning();
      orgId = newOrg.id;
      console.log(`\n✅ Organização criada: ID ${orgId}`);
    }

    // Cria usuário de teste
    const testEmail = "teste@wrmusic.com";
    const testPassword = "123456";
    const openId = "test-user-" + Date.now();

    // Verifica se email já existe
    const existingEmail = await sql`
      SELECT id, email FROM users WHERE email = ${testEmail} LIMIT 1
    `;

    if (existingEmail.length > 0) {
      console.log(`\n⚠️  Email ${testEmail} já existe (ID: ${existingEmail[0].id})`);
      console.log("Use --force para recriar ou use o email acima para login.");
      
      // Atualiza a senha mesmo assim
      await sql`
        UPDATE users SET 
          "passwordHash" = ${hashPassword(testPassword)},
          "isEmailVerified" = true
        WHERE email = ${testEmail}
      `;
      console.log(`✅ Senha atualizada para: ${testPassword}`);
    } else {
      const [newUser] = await db.insert(schema.users).values({
        organizationId: orgId,
        openId,
        name: "Usuário Teste",
        email: testEmail,
        passwordHash: hashPassword(testPassword),
        loginMethod: "email",
        role: "admin",
        isEmailVerified: true,
      }).returning();

      console.log(`\n✅ Usuário criado com sucesso!`);
      console.log(`   ID: ${newUser.id}`);
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎉 CREDENCIAIS DE ACESSO");
    console.log("=".repeat(50));
    console.log(`   Email   : teste@wrmusic.com`);
    console.log(`   Senha   : 123456`);
    console.log(`   URL     : http://localhost:3000`);
    console.log("=".repeat(50) + "\n");

  } catch (error) {
    console.error("❌ Erro ao criar usuário:", error);
  } finally {
    await sql.end();
  }
}

createTestUser();
