import { sql } from 'drizzle-orm';
import { systemPlans } from './drizzle/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log("Creating tables...");
  const connectionString = process.env.DATABASE_URL!.replace('localhost', '127.0.0.1');
  const client = postgres(connectionString);
  const db = drizzle(client);
  
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "system_plans" (
      "id" varchar(50) PRIMARY KEY,
      "name" varchar(100) NOT NULL,
      "price_monthly" numeric NOT NULL,
      "price_yearly" numeric NOT NULL,
      "max_students" integer NOT NULL,
      "features" text DEFAULT '[]' NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "show_on_landing" boolean DEFAULT true NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "system_coupons" (
      "id" serial PRIMARY KEY,
      "code" varchar(50) NOT NULL UNIQUE,
      "discount_type" varchar(20) NOT NULL,
      "discount_value" numeric NOT NULL,
      "duration_months" integer,
      "max_uses" integer,
      "current_uses" integer DEFAULT 0 NOT NULL,
      "valid_until" timestamp,
      "is_active" boolean DEFAULT true NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    );
  `);

  console.log("Inserting initial plans...");
  
  const initialPlans = [
    { id: "10alunos", name: "10 Alunos", priceMonthly: "10.00", priceYearly: "100.00", maxStudents: 10, features: JSON.stringify(["Gestão de até 10 alunos ativos", "Controle financeiro", "Gestão de aulas e agendamentos", "Acesso ao painel do aluno"]) },
    { id: "20alunos", name: "20 Alunos", priceMonthly: "15.00", priceYearly: "150.00", maxStudents: 20, features: JSON.stringify(["Gestão de até 20 alunos ativos", "Controle financeiro", "Gestão de aulas e agendamentos", "Acesso ao painel do aluno"]) },
    { id: "30alunos", name: "30 Alunos", priceMonthly: "20.00", priceYearly: "200.00", maxStudents: 30, features: JSON.stringify(["Gestão de até 30 alunos ativos", "Controle financeiro", "Gestão de aulas e agendamentos", "Acesso ao painel do aluno"]) },
    { id: "basico", name: "Básico", priceMonthly: "29.99", priceYearly: "299.90", maxStudents: 50, features: JSON.stringify(["Gestão de até 50 alunos ativos", "Painel Financeiro Completo", "Automações de WhatsApp (Básico)", "Contratos Digitais"]) },
    { id: "profissional", name: "Profissional", priceMonthly: "59.90", priceYearly: "599.00", maxStudents: 100, features: JSON.stringify(["Gestão de até 100 alunos ativos", "Todas as ferramentas", "Automações de WhatsApp Ilimitadas", "Relatórios e métricas", "Suporte prioritário"]) },
    { id: "premium", name: "Premium (Ilimitado)", priceMonthly: "99.90", priceYearly: "999.00", maxStudents: 999999, features: JSON.stringify(["Alunos Ilimitados", "Acesso total e irrestrito", "Integrações avançadas", "Prioridade em novas funções", "Gerente de conta exclusivo"]) },
  ];

  for (const p of initialPlans) {
    await db.insert(systemPlans).values(p).onConflictDoNothing();
  }

  console.log("Done!");
  process.exit(0);
}

run().catch(console.error);
