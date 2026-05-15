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

export const roleEnum = pgEnum('role', ["admin", "professor", "aluno"]);
export const levelEnum = pgEnum('level', ["iniciante", "intermediario", "avancado"]);
export const statusEnum = pgEnum('status', ["ativo", "inativo", "pausado"]);
export const lessonStatusEnum = pgEnum('lesson_status', ["agendada", "concluida", "cancelada", "remarcada", "falta"]);
export const reminderTypeEnum = pgEnum('reminder_type', ["aula", "cobranca", "inadimplencia", "manual"]);
export const reminderStatusEnum = pgEnum('reminder_status', ["pendente", "enviado", "cancelado"]);
export const paymentDueStatusEnum = pgEnum('payment_due_status', ["pendente", "pago", "atrasado"]);
export const goalStatusEnum = pgEnum('goal_status', ["pendente", "concluida"]);
export const timelineCategoryEnum = pgEnum('timeline_category', ["tecnica", "teoria", "repertorio", "geral"]);
export const fileCategoryEnum = pgEnum('file_category', ["imagem", "video", "pdf", "audio", "documento"]);
export const rescheduleStatusEnum = pgEnum('reschedule_status', ["pendente", "aprovada", "recusada"]);
export const lessonTypeEnum = pgEnum('lesson_type', ["individual", "turma"]);

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  logo: text("logo"),
  active: boolean("active").default(true).notNull(),
  ownerId: integer("ownerId"), // Admin/Owner of the school
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"), // Multi-tenancy isolation
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("professor").notNull(),
  studentId: integer("studentId"), // Link to students table if role is 'aluno'
  isEmailVerified: boolean("isEmailVerified").default(false).notNull(),
  verificationToken: text("verificationToken"),
  verificationTokenExpiresAt: timestamp("verificationTokenExpiresAt"),
  resetPasswordToken: text("resetPasswordToken"),
  resetPasswordTokenExpiresAt: timestamp("resetPasswordTokenExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const professores = pgTable("professores", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull().unique(),
  especialidade: text("especialidade"),
  telefone: varchar("telefone", { length: 30 }),
  foto: text("foto"),
  pixKey: text("pixKey"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const instruments = pgTable("instruments", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  professorId: integer("professorId").notNull(), // Owner of the student record
  studentUserId: integer("studentUserId"), // Student's own user account
  name: varchar("name", { length: 255 }).notNull(),
  socialName: varchar("socialName", { length: 255 }),
  email: varchar("email", { length: 320 }).unique(),
  phone: varchar("phone", { length: 30 }).default("").notNull(),
  birthDate: date("birthDate"),
  gender: varchar("gender", { length: 50 }),
  cpf: varchar("cpf", { length: 20 }),
  rg: varchar("rg", { length: 20 }),
  address: text("address"),
  guardianName: varchar("guardianName", { length: 255 }),
  guardianPhone: varchar("guardianPhone", { length: 30 }),
  guardianEmail: varchar("guardianEmail", { length: 320 }),
  avatar: text("avatar"),
  instrumentId: integer("instrumentId"),
  level: levelEnum("level").default("iniciante").notNull(),
  status: statusEnum("status").default("ativo").notNull(),
  monthlyFee: decimal("monthlyFee", { precision: 10, scale: 2 }).default("0.00").notNull(),
  dueDay: integer("dueDay").default(10).notNull(),
  lessonType: lessonTypeEnum("lessonType").default("individual").notNull(),
  startDate: date("startDate"),
  notes: text("notes"),
  permissions: text("permissions"), // JSON string: { canSeeFinanceiro: boolean, etc }
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  studentId: integer("studentId"),
  isExperimental: boolean("isExperimental").default(false).notNull(),
  experimentalName: varchar("experimentalName", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduledAt").notNull(),
  duration: integer("duration").default(60).notNull(),
  status: lessonStatusEnum("status").default("agendada").notNull(),
  lessonType: lessonTypeEnum("lessonType").default("individual").notNull(),
  notes: text("notes"),
  rating: integer("rating"),
  instrumentId: integer("instrumentId"),
  recurringGroupId: varchar("recurringGroupId", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const monthlyStats = pgTable("monthly_stats", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
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
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull().unique(),
  phone: varchar("phone", { length: 30 }),
  bio: text("bio"),
  schoolName: varchar("schoolName", { length: 255 }),
  schoolAddress: text("schoolAddress"),
  schoolCity: varchar("schoolCity", { length: 100 }),
  schoolPhone: varchar("schoolPhone", { length: 30 }),
  schoolWebsite: varchar("schoolWebsite", { length: 255 }),
  schoolDescription: text("schoolDescription"),
  notifyLessonReminder: integer("notifyLessonReminder").default(1).notNull(),
  notifyPaymentDue: integer("notifyPaymentDue").default(1).notNull(),
  notifyStudentAbsence: integer("notifyStudentAbsence").default(1).notNull(),
  notifyNewStudent: integer("notifyNewStudent").default(1).notNull(),
  notifyWeeklyReport: integer("notifyWeeklyReport").default(0).notNull(),
  automationEnabled: integer("automationEnabled").default(0).notNull(),
  automationLastRun: timestamp("automationLastRun"),
  theme: varchar("theme", { length: 20 }).default("light"),
  pixKey: text("pixKey"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const reminders = pgTable("reminders", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
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
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: reminderTypeEnum("type").default("manual").notNull(),
  body: text("body").notNull(),
  isDefault: integer("isDefault").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const paymentDues = pgTable("payment_dues", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  studentId: integer("studentId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: date("dueDate").notNull(),
  paidAt: timestamp("paidAt"),
  status: paymentDueStatusEnum("status").default("pendente").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  notes: text("notes"),
  // Asaas integration
  asaasId: text("asaasId"),
  asaasPaymentLink: text("asaasPaymentLink"),
  asaasBillingType: varchar("asaasBillingType", { length: 30 }), // PIX, CREDIT_CARD
  receiptUrl: text("receiptUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const asaasCustomers = pgTable("asaas_customers", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  studentId: integer("studentId").notNull(),
  asaasCustomerId: text("asaasCustomerId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});


export const studentGoals = pgTable("student_goals", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  studentId: integer("studentId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: goalStatusEnum("status").default("pendente").notNull(),
  targetDate: date("targetDate"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const studentTimeline = pgTable("student_timeline", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  studentId: integer("studentId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: timelineCategoryEnum("category").default("geral").notNull(),
  grade: decimal("grade", { precision: 3, scale: 1 }),
  achievedAt: timestamp("achievedAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const studentFiles = pgTable("student_files", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  studentId: integer("studentId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: varchar("fileType", { length: 100 }).notNull(),
  category: fileCategoryEnum("category").notNull(),
  fileUrl: text("fileUrl").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  comments: text("comments"),
  size: integer("size"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(), // Author (Professor/Admin)
  targetStudentId: integer("targetStudentId"), // Null means "All students of this professor"
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  important: boolean("important").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  senderId: integer("senderId").notNull(),
  receiverId: integer("receiverId").notNull(),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const rescheduleRequests = pgTable("reschedule_requests", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  studentId: integer("studentId").notNull(),
  lessonId: integer("lessonId").notNull(),
  reason: text("reason").notNull(),
  preferredDates: text("preferredDates").notNull(),
  status: rescheduleStatusEnum("status").default("pendente").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const studentEvolution = pgTable("student_evolution", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  studentId: integer("studentId").notNull(),
  technical: integer("technical").default(0).notNull(),
  rhythm: integer("rhythm").default(0).notNull(),
  harmony: integer("harmony").default(0).notNull(),
  reading: integer("reading").default(0).notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
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

export type StudentGoal = typeof studentGoals.$inferSelect;
export type InsertStudentGoal = typeof studentGoals.$inferInsert;
export type StudentTimeline = typeof studentTimeline.$inferSelect;
export type InsertStudentTimeline = typeof studentTimeline.$inferInsert;
export type StudentFile = typeof studentFiles.$inferSelect;
export type InsertStudentFile = typeof studentFiles.$inferInsert;

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type RescheduleRequest = typeof rescheduleRequests.$inferSelect;
export type InsertRescheduleRequest = typeof rescheduleRequests.$inferInsert;

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const aiMessages = pgTable("ai_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(),
  role: varchar("role", { length: 50 }).notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;
export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = typeof aiMessages.$inferInsert;
