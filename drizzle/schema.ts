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
  boolean,
  jsonb,
  index,
  uniqueIndex
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
export const lessonTypeEnum = pgEnum('lesson_type', ["individual", "turma", "online"]);
export const contractStatusEnum = pgEnum('contract_status', ["rascunho", "enviado", "assinado", "cancelado"]);
export const professorPaymentTypeEnum = pgEnum('professor_payment_type', ["fixo", "porcentagem"]);
export const professorPaymentStatusEnum = pgEnum('professor_payment_status', ["aberto", "aprovado", "pago"]);

// Marketing Enums
export const campaignStatusEnum = pgEnum('campaign_status', ["draft", "running", "paused", "completed", "error"]);
export const campaignContactStatusEnum = pgEnum('campaign_contact_status', ["pending", "processing", "sent", "failed"]);
export const jobStatusEnum = pgEnum('job_status', ["pending", "running", "completed", "failed"]);

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  logo: text("logo"),
  active: boolean("active").default(true).notNull(),
  ownerId: integer("ownerId"), // Admin/Owner of the school
  
  // Platform Subscription Fields
  subscriptionStatus: varchar("subscriptionStatus", { length: 50 }).default("trialing").notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  asaasCustomerId: varchar("asaasCustomerId", { length: 100 }),
  asaasSubscriptionId: varchar("asaasSubscriptionId", { length: 100 }),
  planId: varchar("planId", { length: 50 }).default("premium").notNull(),

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
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  hasSeenTutorial: boolean("hasSeenTutorial").default(false).notNull(),
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
  // Payment calculation fields
  paymentType: professorPaymentTypeEnum("paymentType").default("fixo"),
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }).default("0.00"),
  paymentPercentage: decimal("paymentPercentage", { precision: 5, scale: 2 }).default("0.00"),
  permissions: jsonb("permissions").default('["aulas", "progresso", "recepcao", "ia", "lembretes", "relatorios"]'),
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
  email: varchar("email", { length: 320 }),
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
  onlineMeetingLink: text("onlineMeetingLink"),
  startDate: date("startDate"),
  notes: text("notes"),
  permissions: text("permissions"), // JSON string: { canSeeFinanceiro: boolean, etc }
  methodologyFilename: varchar("methodologyFilename", { length: 255 }),
  methodologyText: text("methodologyText"),
  allowAutoReminders: boolean("allowAutoReminders").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("students_email_org_idx").on(table.email, table.organizationId),
]);

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  studentId: integer("studentId"),
  isExperimental: boolean("isExperimental").default(false).notNull(),
  experimentalName: varchar("experimentalName", { length: 255 }),
  experimentalPhone: varchar("experimentalPhone", { length: 30 }),
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
  alertSent1h: boolean("alertSent1h").default(false).notNull(),
  alertSent30m: boolean("alertSent30m").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  index("lessons_student_id_idx").on(table.studentId),
  index("lessons_organization_id_idx").on(table.organizationId),
  index("lessons_scheduled_at_idx").on(table.scheduledAt),
  index("lessons_status_idx").on(table.status),
]);

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
  dueDaysForecast: text("dueDaysForecast").default("5,10,15,20"),
  notifyLessonReminder: integer("notifyLessonReminder").default(1).notNull(),
  notifyPaymentDue: integer("notifyPaymentDue").default(1).notNull(),
  notifyStudentAbsence: integer("notifyStudentAbsence").default(1).notNull(),
  notifyNewStudent: integer("notifyNewStudent").default(1).notNull(),
  notifyWeeklyReport: integer("notifyWeeklyReport").default(0).notNull(),
  automationEnabled: integer("automationEnabled").default(0).notNull(),
  automationLastRun: timestamp("automationLastRun"),
  theme: varchar("theme", { length: 20 }).default("light"),
  pixKey: text("pixKey"),
  hiddenTabs: text("hiddenTabs").default("").notNull(),
  // WhatsApp Bot integration (Fly.io)
  whatsappBotUrl: varchar("whatsappBotUrl", { length: 255 }),
  whatsappBotToken: text("whatsappBotToken"),
  whatsappAutoSend: integer("whatsappAutoSend").default(0).notNull(),
  // Chatbot (Robô de Autoatendimento WhatsApp)
  chatbotEnabled: integer("chatbotEnabled").default(0).notNull(),
  // Asaas Integration
  asaasApiKey: text("asaasApiKey"),
  asaasEnabled: integer("asaasEnabled").default(0).notNull(),
  // Mercado Pago Integration
  mpAccessToken: text("mpAccessToken"),
  paymentGateway: varchar("paymentGateway", { length: 20 }).default("asaas").notNull(),
  // AI Integration
  aiProvider: varchar("aiProvider", { length: 50 }).default("gemini"),
  geminiApiKey: varchar("geminiApiKey", { length: 255 }),
  geminiModel: varchar("geminiModel", { length: 255 }),
  groqApiKey: varchar("groqApiKey", { length: 255 }),
  groqModel: varchar("groqModel", { length: 255 }),
  // School Operating Hours
  schoolHours: text("schoolHours").default('{"monday":{"active":true,"start":"08:00","end":"18:00"},"tuesday":{"active":true,"start":"08:00","end":"18:00"},"wednesday":{"active":true,"start":"08:00","end":"18:00"},"thursday":{"active":true,"start":"08:00","end":"18:00"},"friday":{"active":true,"start":"08:00","end":"18:00"},"saturday":{"active":false,"start":"08:00","end":"12:00"},"sunday":{"active":false,"start":"08:00","end":"12:00"}}').notNull(),
  // ZapSign Integration (Digital Contracts)
  zapsignApiKey: text("zapsignApiKey"),
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
  refId: varchar("refId", { length: 200 }), // BUG-002 FIX: Aumentado de 100→200 para evitar truncamento em refIds longos (ex: auto-rule-{id}-lesson-{id}-{date})
  targetPhone: varchar("targetPhone", { length: 30 }),
  // WhatsApp Bot tracking
  externalMessageId: varchar("externalMessageId", { length: 255 }),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  index("reminders_ref_id_idx").on(table.refId),
  index("reminders_organization_id_idx").on(table.organizationId),
  index("reminders_status_idx").on(table.status),
  index("reminders_scheduled_at_idx").on(table.scheduledAt),
]);

export const reminderTemplates = pgTable("reminder_templates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: reminderTypeEnum("type").default("manual").notNull(),
  body: text("body").notNull(),
  isDefault: integer("isDefault").default(0).notNull(),
  sendToStudent: boolean("sendToStudent").default(true).notNull(),
  sendToGuardian: boolean("sendToGuardian").default(false).notNull(),
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
  // Mercado Pago integration
  mpPaymentId: text("mpPaymentId"),
  mpPaymentLink: text("mpPaymentLink"),
  receiptUrl: text("receiptUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  index("payment_dues_student_id_idx").on(table.studentId),
  index("payment_dues_organization_id_idx").on(table.organizationId),
  index("payment_dues_status_idx").on(table.status),
  index("payment_dues_due_date_idx").on(table.dueDate),
  index("payment_dues_asaas_id_idx").on(table.asaasId),
]);

export const asaasCustomers = pgTable("asaas_customers", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  studentId: integer("studentId").notNull(),
  asaasCustomerId: text("asaasCustomerId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("asaas_customers_student_org_idx").on(table.studentId, table.organizationId),
]);

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  supplier: varchar("supplier", { length: 255 }),
  account: varchar("account", { length: 255 }),
  recurrence: varchar("recurrence", { length: 50 }).default("unica").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  status: paymentDueStatusEnum("status").default("pendente").notNull(),
  receiptUrl: text("receiptUrl"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
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
  folder: varchar("folder", { length: 100 }),
  fileUrl: text("fileUrl").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  comments: text("comments"),
  size: integer("size"),
  viewedAt: timestamp("viewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const fileComments = pgTable("file_comments", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  fileId: integer("fileId").notNull(),
  userId: integer("userId").notNull(), // can be student or professor
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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

export const dailyStudyPlans = pgTable("daily_study_plans", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  studentId: integer("studentId").notNull(),
  teacherId: integer("teacherId").notNull(),
  planText: text("planText").notNull(),
  status: statusEnum("status").default("ativo").notNull(), // 'ativo', 'concluido' (we can reuse statusEnum or just use a boolean)
  publishedStatus: varchar("publishedStatus", { length: 20 }).default("rascunho").notNull(), // 'rascunho', 'publicado'
  daysCompleted: text("daysCompleted").default("[false,false,false,false,false]").notNull(), // JSON array
  daysTimeSpent: text("daysTimeSpent").default("[0,0,0,0,0]").notNull(), // Tempo gasto em segundos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(), // Receiver
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).default("info").notNull(), // 'info', 'warning', 'success', 'error'
  read: boolean("read").default(false).notNull(),
  actionUrl: text("actionUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
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
export type FileComment = typeof fileComments.$inferSelect;
export type InsertFileComment = typeof fileComments.$inferInsert;

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type RescheduleRequest = typeof rescheduleRequests.$inferSelect;
export type InsertRescheduleRequest = typeof rescheduleRequests.$inferInsert;

export type DailyStudyPlan = typeof dailyStudyPlans.$inferSelect;
export type InsertDailyStudyPlan = typeof dailyStudyPlans.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

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

export const aiDocuments = pgTable("ai_documents", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  userId: integer("userId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileType: varchar("fileType", { length: 50 }).notNull(),
  extractedText: text("extractedText").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const aiMessages = pgTable("ai_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(),
  role: varchar("role", { length: 50 }).notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const chatbotSessions = pgTable("chatbot_sessions", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"), // to link it if needed
  phone: varchar("phone", { length: 30 }).notNull().unique(),
  state: varchar("state", { length: 50 }).default("START").notNull(),
  data: text("data"), // JSON payload to store temporary information (e.g. chosen date)
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;
export type AiDocument = typeof aiDocuments.$inferSelect;
export type InsertAiDocument = typeof aiDocuments.$inferInsert;
export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = typeof aiMessages.$inferInsert;
export type ChatbotSession = typeof chatbotSessions.$inferSelect;
export type InsertChatbotSession = typeof chatbotSessions.$inferInsert;

export const fcmTokens = pgTable("fcm_tokens", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  token: text("token").notNull().unique(),
  deviceInfo: text("deviceInfo"), // e.g., "Chrome on Windows", "iPhone", etc.
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type FcmToken = typeof fcmTokens.$inferSelect;
export type InsertFcmToken = typeof fcmTokens.$inferInsert;

// ─── CONTRACTS (ZapSign Integration) ──────────────────────────
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  studentId: integer("studentId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: contractStatusEnum("status").default("rascunho").notNull(),
  zapsignDocId: text("zapsignDocId"),
  zapsignSignUrl: text("zapsignSignUrl"),
  signedAt: timestamp("signedAt"),
  documentUrl: text("documentUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

// ─── PROFESSOR PAYMENTS (Monthly Payroll) ─────────────────────
export const professorPayments = pgTable("professor_payments", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  professorId: integer("professorId").notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  totalClasses: integer("totalClasses").default(0).notNull(),
  totalMinutes: integer("totalMinutes").default(0).notNull(),
  totalCredits: decimal("totalCredits", { precision: 10, scale: 2 }).default("0.00").notNull(),
  totalDebits: decimal("totalDebits", { precision: 10, scale: 2 }).default("0.00").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0.00").notNull(),
  status: professorPaymentStatusEnum("status").default("aberto").notNull(),
  approvedAt: timestamp("approvedAt"),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  adjustments: text("adjustments"), // JSON array of manual adjustments: [{desc: string, value: number}]
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type ProfessorPayment = typeof professorPayments.$inferSelect;
export type InsertProfessorPayment = typeof professorPayments.$inferInsert;

// ─── ATTENDANCE TOKENS (QR Code Presence) ─────────────────────
export const attendanceTokens = pgTable("attendance_tokens", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AttendanceToken = typeof attendanceTokens.$inferSelect;
export type InsertAttendanceToken = typeof attendanceTokens.$inferInsert;

export const attendanceLogs = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  lessonId: integer("lessonId"),
  tokenId: integer("tokenId").notNull(),
  scannedAt: timestamp("scannedAt").defaultNow().notNull(),
});

export type AttendanceLog = typeof attendanceLogs.$inferSelect;
export type InsertAttendanceLog = typeof attendanceLogs.$inferInsert;

// ─── MESSAGE AUTOMATION RULES ─────────────────────────────────────────────────
export const messageAutomationRules = pgTable("message_automation_rules", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isSystem: integer("isSystem").default(0).notNull(),    // 1 = native rule, 0 = custom
  isActive: integer("isActive").default(1).notNull(),
  trigger: varchar("trigger", { length: 100 }).notNull(), // payment_due | payment_overdue | lesson_scheduled | birthday | student_inactive | payment_confirmed | new_student
  offsetDays: integer("offsetDays").default(0).notNull(), // negative = before, positive = after
  offsetHours: integer("offsetHours").default(0).notNull(),
  conditions: text("conditions"),                         // JSON: [{field, operator, value}]
  actions: text("actions"),                               // JSON: [{type: 'whatsapp'|'notification'|'task'}]
  messageTemplate: text("messageTemplate").notNull(),
  channel: varchar("channel", { length: 50 }).default("whatsapp").notNull(),
  sendToStudent: integer("sendToStudent").default(1).notNull(), // 1 = true, 0 = false (sqlite style boolean mapping for pg)
  sendToGuardian: integer("sendToGuardian").default(0).notNull(),
  totalSent: integer("totalSent").default(0).notNull(),
  lastExecutedAt: timestamp("lastExecutedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type MessageAutomationRule = typeof messageAutomationRules.$inferSelect;
export type InsertMessageAutomationRule = typeof messageAutomationRules.$inferInsert;

// ─── SYSTEM PLANS & COUPONS (SUPER ADMIN) ─────────────────────
export const systemPlans = pgTable("system_plans", {
  id: varchar("id", { length: 50 }).primaryKey(), // e.g. "10alunos", "basico"
  name: varchar("name", { length: 100 }).notNull(),
  priceMonthly: decimal("price_monthly").notNull(),
  priceYearly: decimal("price_yearly").notNull(),
  maxStudents: integer("max_students").notNull(),
  features: text("features").default("[]").notNull(), // JSON array
  isActive: boolean("is_active").default(true).notNull(),
  showOnLanding: boolean("show_on_landing").default(true).notNull(),
  isPopular: boolean("is_popular").default(false).notNull(),
  order: integer("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type SystemPlan = typeof systemPlans.$inferSelect;
export type InsertSystemPlan = typeof systemPlans.$inferInsert;

export const systemCoupons = pgTable("system_coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountType: varchar("discount_type", { length: 20 }).notNull(), // 'PERCENTAGE' | 'FIXED'
  discountValue: decimal("discount_value").notNull(),
  durationMonths: integer("duration_months"), // null = vitalicio
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0).notNull(),
  validUntil: timestamp("valid_until"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemCoupon = typeof systemCoupons.$inferSelect;
export type InsertSystemCoupon = typeof systemCoupons.$inferInsert;

export type SystemReport = typeof systemReports.$inferSelect;
export type InsertSystemReport = typeof systemReports.$inferInsert;

// --- Marketing Tables ---

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: campaignStatusEnum("status").default("draft").notNull(),
  
  // Settings
  minDelay: integer("minDelay").default(10).notNull(), // Intervalo fixo (segundos)
  maxDelay: integer("maxDelay").default(20).notNull(), // Intervalo máximo (mantido para compatibilidade, mas ignoraremos variação)
  batchSize: integer("batchSize").default(20).notNull(),
  batchDelay: integer("batchDelay").default(600).notNull(), // Segundos
  
  // Stats cache
  totalContacts: integer("totalContacts").default(0).notNull(),
  sentCount: integer("sentCount").default(0).notNull(),
  failedCount: integer("failedCount").default(0).notNull(),
  consecutiveErrors: integer("consecutiveErrors").default(0).notNull(),
  
  createdBy: integer("createdBy").notNull(), // User ID
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const marketingContacts = pgTable("marketing_contacts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  campaignId: integer("campaignId").notNull().references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(), // WhatsApp format
  
  // Custom Variables ({{empresa}}, {{cidade}}, etc.)
  variables: jsonb("variables"), 
  
  messageText: text("messageText").notNull(), // The compiled message or raw template
  
  status: campaignContactStatusEnum("status").default("pending").notNull(),
  errorMessage: text("errorMessage"),
  evolutionMessageId: varchar("evolutionMessageId", { length: 255 }),
  
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const marketingJobs = pgTable("marketing_jobs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  campaignId: integer("campaignId").notNull().references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  
  status: jobStatusEnum("status").default("pending").notNull(),
  lockedAt: timestamp("lockedAt"),
  lockedBy: varchar("lockedBy", { length: 255 }), // Worker ID or instance ID
  
  lastProcessedContactId: integer("lastProcessedContactId"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export const marketingLogs = pgTable("marketing_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  campaignId: integer("campaignId").notNull().references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  contactId: integer("contactId").references(() => marketingContacts.id, { onDelete: "set null" }),
  
  level: varchar("level", { length: 50 }).notNull(), // info, error, warning
  message: text("message").notNull(),
  payload: jsonb("payload"),
  response: jsonb("response"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = typeof marketingCampaigns.$inferInsert;
export type MarketingContact = typeof marketingContacts.$inferSelect;
export type InsertMarketingContact = typeof marketingContacts.$inferInsert;
export type MarketingJob = typeof marketingJobs.$inferSelect;
export type InsertMarketingJob = typeof marketingJobs.$inferInsert;
export type MarketingLog = typeof marketingLogs.$inferSelect;
export type InsertMarketingLog = typeof marketingLogs.$inferInsert;
