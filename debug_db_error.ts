import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { students } from './drizzle/schema';
dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function main() {
  try {
    const [newStudent] = await db.insert(students).values({
      organizationId: 1,
      professorId: 163,
      name: "Micaelly dos Santos Amaral",
      socialName: "",
      email: "",
      phone: "(33) 98809-4290",
      birthDate: "",
      gender: "",
      cpf: "",
      rg: "",
      address: "",
      guardianName: "",
      guardianPhone: "",
      guardianEmail: "",
      instrumentId: 2,
      level: "iniciante",
      monthlyFee: "120",
      dueDay: 5,
      lessonType: "turma",
      startDate: "2026-06-04",
      notes: null,
      status: "ativo",
      userId: 163,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({ id: students.id });
    console.log("Success:", newStudent);
  } catch (err: any) {
    console.error("Exact DB Error:", err);
    if (err.code) console.error("Error code:", err.code);
    if (err.detail) console.error("Error detail:", err.detail);
    if (err.constraint) console.error("Error constraint:", err.constraint);
  } finally {
    process.exit(0);
  }
}

main();
