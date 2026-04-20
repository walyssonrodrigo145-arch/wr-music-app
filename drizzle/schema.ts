import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  decimal,
  date,
  serial,
  boolean
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum('role', ["user", "admin"]);
export const levelEnum = pgEnum('level', ["iniciante", "intermediario", "avancado"]);
export const statusEnum = pgEnum('status', ["ativo", "inativo", "pausado"]);
export const lessonStatusEnum = pgEnum('lesson_status', ["agendada", "concluida", "cancelada", "remarcada", "falta"]);
export const reminderTypeEnum = pgEnum('reminder_type', ["aula", "cobranca", "inadimplencia", "manual"]);
export const reminderStatusEnum = pgEnum('reminder_status', ["pendente", "enviado", "cancelado"]);
export const paymentDueStatusEnum = pgEnum('payment_due_status', ["pendente", "pago", "atrasado"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  isEmailVerified: boolean("isEmailVerified").default(false).notNull(),
  verificationToken: text("verificationToken"),
  verificationTokenExpiresAt: timestamp("verificationTokenExpiresAt"),
  resetPasswordToken: text("resetPasswordToken"),
  resetPasswordTokenExpiresAt: timestamp("resetPasswordTokenExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const instruments = pgTable("instruments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).unique(),
  phone: varchar("phone", { length: 30 }).default("").notNull(),
  avatar: text("avatar"),
  instrumentId: integer("instrumentId"),
  level: levelEnum("level").default("iniciante").notNull(),
  status: statusEnum("status").default("ativo").notNull(),
  monthlyFee: decimal("monthlyFee", { precision: 10, scale: 2 }).default("0.00").notNull(),
  dueDay: integer("dueDay").default(10).notNull(),
  startDate: date("startDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  studentId: integer("studentId"), // Made optional for experimental lessons
  isExperimental: boolean("isExperimental").default(false).notNull(),
  experimentalName: varchar("experimentalName", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduledAt").notNull(),
  duration: integer("duration").default(60).notNull(), // minutes
  status: lessonStatusEnum("status").default("agendada").notNull(),
  notes: text("notes"),
  rating: integer("rating"), // 1-5
  instrumentId: integer("instrumentId"),
  recurringGroupId: varchar("recurringGroupId", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const monthlyStats = pgTable("monthly_stats", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  newStudents: integer("newStudents").default(0).notNull(),
  activeStudents: integer("activeStudents").default(0).notNull(),
  lessonsGiven: integer("lessonsGiven").default(0).notNull(),
  lessonsCancelled: integer("lessonsCancelled").default(0).notNull(),
  revenue: decimal("revenue", { precision: 12, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  // Perfil do professor
  phone: varchar("phone", { length: 30 }),
  bio: text("bio"),
  // Dados da escola
  schoolName: varchar("schoolName", { length: 255 }),
  schoolAddress: text("schoolAddress"),
  schoolCity: varchar("schoolCity", { length: 100 }),
  schoolPhone: varchar("schoolPhone", { length: 30 }),
  schoolWebsite: varchar("schoolWebsite", { length: 255 }),
  schoolDescription: text("schoolDescription"),
  // Notificações
  notifyLessonReminder: integer("notifyLessonReminder").default(1).notNull(),
  notifyPaymentDue: integer("notifyPaymentDue").default(1).notNull(),
  notifyStudentAbsence: integer("notifyStudentAbsence").default(1).notNull(),
  notifyNewStudent: integer("notifyNewStudent").default(1).notNull(),
  notifyWeeklyReport: integer("notifyWeeklyReport").default(0).notNull(),
  // Automação de lembretes
  automationEnabled: integer("automationEnabled").default(0).notNull(),
  automationLastRun: timestamp("automationLastRun"),
  // Aparência
  theme: varchar("theme", { length: 20 }).default("light"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  studentId: integer("studentId"),
  lessonId: integer("lessonId"),
  paymentDueId: integer("paymentDueId"),
  templateId: integer("templateId"),
  type: reminderTypeEnum("type").default("manual").notNull(),
  message: text("message").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  status: reminderStatusEnum("status").default("pendente").notNull(),
  autoGenerated: integer("autoGenerated").default(0).notNull(),
  sentAt: timestamp("sentAt"),
  cancelledAt: timestamp("cancelledAt"),
  refId: varchar("refId", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const reminderTemplates = pgTable("reminder_templates", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: reminderTypeEnum("type").default("manual").notNull(),
  body: text("body").notNull(), // ex: "Olá {nome}, sua aula é dia {data_aula} às {hora_aula}."
  isDefault: integer("isDefault").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const paymentDues = pgTable("payment_dues", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  studentId: integer("studentId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("dueDate").notNull(),
  paidAt: timestamp("paidAt"),
  status: paymentDueStatusEnum("status").default("pendente").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;
export type ReminderTemplate = typeof reminderTemplates.$inferSelect;
export type InsertReminderTemplate = typeof reminderTemplates.$inferInsert;
export type PaymentDue = typeof paymentDues.$inferSelect;
export type InsertPaymentDue = typeof paymentDues.$inferInsert;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = typeof settings.$inferInsert;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Instrument = typeof instruments.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type MonthlyStat = typeof monthlyStats.$inferSelect;
