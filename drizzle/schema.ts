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
export const contractStatusEnum = pgEnum('contract_status', ["rascunho", "enviado", "assinado", "cancelado", "aguardando_assinatura", "expirado", "erro"]);
export const integrationProviderEnum = pgEnum('integration_provider', ["assinafy"]);
export const integrationEnvironmentEnum = pgEnum('integration_environment', ["sandbox", "production"]);
export const integrationConnectionStatusEnum = pgEnum('integration_connection_status', ["connected", "invalid_credentials", "disconnected", "error"]);
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
  billingPeriodicity: varchar("billingPeriodicity", { length: 20 }).default("mensal").notNull(),
  dueDay: integer("dueDay").default(10).notNull(),
  lessonType: lessonTypeEnum("lessonType").default("individual").notNull(),
  onlineMeetingLink: text("onlineMeetingLink"),
  startDate: date("startDate"),
  notes: text("notes"),
  permissions: text("permissions"), // JSON string: { canSeeFinanceiro: boolean, etc }
  methodologyFilename: varchar("methodologyFilename", { length: 255 }),
  methodologyText: text("methodologyText"),
  allowAutoReminders: boolean("allowAutoReminders").default(true).notNull(),
  studioRoomId: integer("studioRoomId"),
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
  studioRoomId: integer("studioRoomId"),
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
  schoolCnpj: varchar("schoolCnpj", { length: 30 }),
  schoolAddress: text("schoolAddress"),
  schoolCity: varchar("schoolCity", { length: 100 }),
  schoolPhone: varchar("schoolPhone", { length: 30 }),
  schoolWebsite: varchar("schoolWebsite", { length: 255 }),
  schoolDescription: text("schoolDescription"),
  logoUrl: text("logoUrl"),
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
  whatsappBotUrl: varchar("whatsappBotUrl", { length: 255 }).default("http://179.197.76.174:8080"),
  whatsappBotToken: text("whatsappBotToken").default("minha_chave_secreta_123"),
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
  // Lesson Duration (minutos): 30, 45, 60, 90, 120
  lessonDuration: integer("lessonDuration").default(60).notNull(),
  // ZapSign Integration (Digital Contracts)
  zapsignApiKey: text("zapsignApiKey"),
  // Billing Engine (Juros e Multas)
  lateFeeEnabled: integer("lateFeeEnabled").default(1).notNull(),
  lateFeeType: varchar("lateFeeType", { length: 20 }).default("percentage").notNull(),
  lateFeeValue: decimal("lateFeeValue", { precision: 10, scale: 2 }).default("2.00").notNull(),
  interestEnabled: integer("interestEnabled").default(1).notNull(),
  interestType: varchar("interestType", { length: 20 }).default("daily").notNull(),
  interestRate: decimal("interestRate", { precision: 10, scale: 4 }).default("0.3300").notNull(),
  graceDays: integer("graceDays").default(3).notNull(),
  autoUpdateInvoice: integer("autoUpdateInvoice").default(1).notNull(),
  showFeeBreakdown: integer("showFeeBreakdown").default(1).notNull(),
  earlyDiscountEnabled: integer("earlyDiscountEnabled").default(0).notNull(),
  earlyDiscountType: varchar("earlyDiscountType", { length: 20 }).default("percentage").notNull(),
  earlyDiscountValue: decimal("earlyDiscountValue", { precision: 10, scale: 2 }).default("5.00").notNull(),
  earlyDiscountDays: integer("earlyDiscountDays").default(0).notNull(),
  // Antecipação Inteligente de Vagas por Falta
  autoAdvanceSlotsEnabled: integer("autoAdvanceSlotsEnabled").default(1).notNull(),
  autoAdvanceWhatsAppTemplate: text("autoAdvanceWhatsAppTemplate"),
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
  billingPeriodicity: varchar("billingPeriodicity", { length: 20 }).default("mensal"),
  // Asaas integration
  asaasId: text("asaasId"),
  asaasPaymentLink: text("asaasPaymentLink"),
  asaasBillingType: varchar("asaasBillingType", { length: 30 }), // PIX, CREDIT_CARD
  // Mercado Pago integration
  mpPaymentId: text("mpPaymentId"),
  mpPaymentLink: text("mpPaymentLink"),
  receiptUrl: text("receiptUrl"),
  // Billing Engine cache/informative fields
  originalAmount: decimal("originalAmount", { precision: 10, scale: 2 }),
  lastCalculation: timestamp("lastCalculation"),
  daysOverdueCache: integer("daysOverdueCache"),
  updatedAmountCache: decimal("updatedAmountCache", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  index("payment_dues_student_id_idx").on(table.studentId),
  index("payment_dues_organization_id_idx").on(table.organizationId),
  index("payment_dues_status_idx").on(table.status),
  index("payment_dues_due_date_idx").on(table.dueDate),
  index("payment_dues_asaas_id_idx").on(table.asaasId),
]);

export const billingAuditLogs = pgTable("billing_audit_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  invoiceId: integer("invoiceId").notNull(),
  originalAmount: decimal("originalAmount", { precision: 10, scale: 2 }).notNull(),
  lateFeeAmount: decimal("lateFeeAmount", { precision: 10, scale: 2 }).notNull(),
  interestAmount: decimal("interestAmount", { precision: 10, scale: 2 }).notNull(),
  daysOverdue: integer("daysOverdue").notNull(),
  updatedAmount: decimal("updatedAmount", { precision: 10, scale: 2 }).notNull(),
  userId: integer("userId"),
  origin: varchar("origin", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("billing_audit_logs_invoice_idx").on(table.invoiceId),
  index("billing_audit_logs_org_idx").on(table.organizationId),
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

// ─── CONTRACTS (ZapSign + Assinafy) ──────────────────────────
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  userId: integer("userId").notNull(),
  studentId: integer("studentId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: contractStatusEnum("status").default("rascunho").notNull(),
  provider: varchar("provider", { length: 30 }).default("zapsign").notNull(),
  templateId: integer("templateId"),
  zapsignDocId: text("zapsignDocId"),
  zapsignSignUrl: text("zapsignSignUrl"),
  assinafyDocId: text("assinafyDocId"),
  assinafySignUrl: text("assinafySignUrl"),
  signedDocumentUrl: text("signedDocumentUrl"),
  signedAt: timestamp("signedAt"),
  documentUrl: text("documentUrl"),
  sentAt: timestamp("sentAt"),
  cancelledAt: timestamp("cancelledAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

// ─── SCHOOL INTEGRATIONS (BYOK — chave por escola/provedor) ───
export const schoolIntegrations = pgTable("school_integrations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  provider: integrationProviderEnum("provider").notNull(),
  apiKeyEncrypted: text("apiKeyEncrypted").notNull(),
  environment: integrationEnvironmentEnum("environment").default("production").notNull(),
  accountId: varchar("accountId", { length: 100 }),
  active: boolean("active").default(true).notNull(),
  lastConnectionTest: timestamp("lastConnectionTest"),
  connectionStatus: integrationConnectionStatusEnum("connectionStatus").default("disconnected").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("school_integrations_org_provider_idx").on(table.organizationId, table.provider),
]);

export type SchoolIntegration = typeof schoolIntegrations.$inferSelect;
export type InsertSchoolIntegration = typeof schoolIntegrations.$inferInsert;

// ─── CONTRACT TEMPLATES (modelos por escola) ──────────────────
export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  content: text("content").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = typeof contractTemplates.$inferInsert;

// ─── CONTRACT EVENTS (histórico + idempotência de webhook) ────
export const contractEvents = pgTable("contract_events", {
  id: serial("id").primaryKey(),
  contractId: integer("contractId").notNull(),
  provider: varchar("provider", { length: 30 }).default("assinafy").notNull(),
  providerEventId: varchar("providerEventId", { length: 100 }),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("contract_events_provider_event_idx").on(table.provider, table.providerEventId),
]);

export type ContractEvent = typeof contractEvents.$inferSelect;
export type InsertContractEvent = typeof contractEvents.$inferInsert;

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
  allowExtraStudents: boolean("allow_extra_students").default(true).notNull(),
  extraStudentPrice: decimal("extra_student_price").default("1.49").notNull(),
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

// --- Marketing Tables ---

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  mediaUrl: text("mediaUrl"),
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

// ─────────────────────────────────────────────────────────────────────────────
// MusicPro Analytics — Tabelas de Rastreamento e Métricas
// ─────────────────────────────────────────────────────────────────────────────

export const deviceTypeEnum = pgEnum('device_type', ['desktop', 'tablet', 'mobile', 'tv', 'unknown']);
export const analyticsEventNameEnum = pgEnum('analytics_event_name', [
  'page_view', 'session_start', 'session_end', 'button_click', 'link_click',
  'signup_started', 'signup_completed', 'trial_started', 'trial_finished',
  'login', 'logout', 'plan_selected', 'checkout_started', 'pix_generated',
  'payment_success', 'payment_failed', 'subscription_created', 'subscription_cancelled',
  'email_open', 'email_click', 'whatsapp_click', 'video_play', 'video_finish',
  'download', 'upload', 'form_submit', 'search', 'feature_used', 'error', 'api_error',
  'scroll_depth', 'heatmap_click', 'heatmap_move', 'web_vital',
]);

// ── Visitantes únicos (por fingerprint/cookie anônimo) ────────────────────────
export const analyticsVisitors = pgTable("analytics_visitors", {
  id: serial("id").primaryKey(),
  visitorId: varchar("visitor_id", { length: 64 }).notNull().unique(), // UUID do localStorage
  fingerprint: varchar("fingerprint", { length: 128 }),
  firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  totalSessions: integer("total_sessions").default(1).notNull(),
  totalEvents: integer("total_events").default(0).notNull(),
  country: varchar("country", { length: 100 }),
  state: varchar("state", { length: 100 }),
  city: varchar("city", { length: 100 }),
  deviceType: deviceTypeEnum("device_type").default("unknown"),
}, (table) => [
  index("analytics_visitors_visitor_id_idx").on(table.visitorId),
  index("analytics_visitors_first_seen_idx").on(table.firstSeenAt),
  index("analytics_visitors_country_idx").on(table.country),
]);

// ── Sessões de navegação ───────────────────────────────────────────────────────
export const analyticsSessions = pgTable("analytics_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull().unique(),
  visitorId: varchar("visitor_id", { length: 64 }).notNull(),
  userId: integer("user_id"),       // null se visitante anônimo
  organizationId: integer("organization_id"),

  // Geo (via Cloudflare headers ou IP-api)
  ipMasked: varchar("ip_masked", { length: 20 }), // ex: 189.28.*.*
  country: varchar("country", { length: 100 }),
  state: varchar("state", { length: 100 }),
  city: varchar("city", { length: 100 }),
  language: varchar("language", { length: 20 }),
  timezone: varchar("timezone", { length: 60 }),

  // Dispositivo
  deviceType: deviceTypeEnum("device_type").default("unknown"),
  os: varchar("os", { length: 80 }),
  browser: varchar("browser", { length: 80 }),
  screenRes: varchar("screen_res", { length: 20 }),
  userAgent: text("user_agent"),

  // Origem
  referrer: text("referrer"),
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),
  utmContent: varchar("utm_content", { length: 100 }),
  utmTerm: varchar("utm_term", { length: 100 }),

  // Métricas da sessão
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  durationSec: integer("duration_sec"),
  pageCount: integer("page_count").default(1).notNull(),
  isBounce: boolean("is_bounce").default(true).notNull(),
}, (table) => [
  index("analytics_sessions_session_id_idx").on(table.sessionId),
  index("analytics_sessions_visitor_id_idx").on(table.visitorId),
  index("analytics_sessions_started_at_idx").on(table.startedAt),
  index("analytics_sessions_utm_source_idx").on(table.utmSource),
  index("analytics_sessions_utm_campaign_idx").on(table.utmCampaign),
  index("analytics_sessions_country_idx").on(table.country),
]);

// ── Todos os eventos rastreados ────────────────────────────────────────────────
export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  visitorId: varchar("visitor_id", { length: 64 }).notNull(),
  userId: integer("user_id"),

  // Evento
  eventName: analyticsEventNameEnum("event_name").notNull(),
  pageUrl: text("page_url"),
  pageTitle: varchar("page_title", { length: 255 }),
  referrer: text("referrer"),

  // Elemento (para button_click, link_click)
  elementId: varchar("element_id", { length: 100 }),
  elementText: varchar("element_text", { length: 255 }),
  elementTag: varchar("element_tag", { length: 30 }),

  // UTMs (copiados da sessão para facilitar queries diretas)
  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),
  utmContent: varchar("utm_content", { length: 100 }),
  utmTerm: varchar("utm_term", { length: 100 }),

  // Geo e Device
  country: varchar("country", { length: 100 }),
  state: varchar("state", { length: 100 }),
  city: varchar("city", { length: 100 }),
  deviceType: deviceTypeEnum("device_type").default("unknown"),
  os: varchar("os", { length: 80 }),
  browser: varchar("browser", { length: 80 }),
  screenRes: varchar("screen_res", { length: 20 }),

  // Valor financeiro (para payment_success, etc.)
  value: decimal("value", { precision: 10, scale: 2 }),

  // Dados extras (JSON livre)
  metadata: jsonb("metadata"),

  // Métricas de tempo
  timeOnPageSec: integer("time_on_page_sec"),
  scrollDepth: integer("scroll_depth"), // percentual 0-100

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("analytics_events_event_name_idx").on(table.eventName),
  index("analytics_events_created_at_idx").on(table.createdAt),
  index("analytics_events_session_id_idx").on(table.sessionId),
  index("analytics_events_visitor_id_idx").on(table.visitorId),
  index("analytics_events_utm_campaign_idx").on(table.utmCampaign),
  index("analytics_events_event_date_idx").on(table.eventName, table.createdAt),
  index("analytics_events_page_url_idx").on(table.pageUrl),
  index("analytics_events_country_idx").on(table.country),
]);

// ── Dados de Heatmap (cliques e movimentos por página) ────────────────────────
export const analyticsHeatmap = pgTable("analytics_heatmap", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  pageUrl: text("page_url").notNull(),
  pageUrlNormalized: varchar("page_url_normalized", { length: 255 }).notNull(), // sem query params

  // Coordenadas relativas (0-100%)
  xPercent: decimal("x_percent", { precision: 5, scale: 2 }).notNull(),
  yPercent: decimal("y_percent", { precision: 5, scale: 2 }).notNull(),

  eventType: varchar("event_type", { length: 20 }).notNull(), // click | move | scroll

  // Viewport (para normalização)
  viewportW: integer("viewport_w"),
  viewportH: integer("viewport_h"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("analytics_heatmap_page_url_idx").on(table.pageUrlNormalized),
  index("analytics_heatmap_event_type_idx").on(table.eventType),
  index("analytics_heatmap_created_at_idx").on(table.createdAt),
]);

// ── Usuários Online (TTL: 2min sem ping = offline) ────────────────────────────
export const analyticsOnline = pgTable("analytics_online", {
  sessionId: varchar("session_id", { length: 64 }).primaryKey(),
  visitorId: varchar("visitor_id", { length: 64 }).notNull(),
  userId: integer("user_id"),
  userName: varchar("user_name", { length: 255 }),

  pageUrl: text("page_url"),
  pageTitle: varchar("page_title", { length: 255 }),

  country: varchar("country", { length: 100 }),
  state: varchar("state", { length: 100 }),
  city: varchar("city", { length: 100 }),

  deviceType: deviceTypeEnum("device_type").default("unknown"),
  browser: varchar("browser", { length: 80 }),
  os: varchar("os", { length: 80 }),
  screenRes: varchar("screen_res", { length: 20 }),

  utmSource: varchar("utm_source", { length: 100 }),
  referrer: text("referrer"),
  ipMasked: varchar("ip_masked", { length: 20 }),

  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  lastPingAt: timestamp("last_ping_at").defaultNow().notNull(),
}, (table) => [
  index("analytics_online_last_ping_idx").on(table.lastPingAt),
  index("analytics_online_visitor_id_idx").on(table.visitorId),
]);

// ── Estatísticas agregadas por página ─────────────────────────────────────────
export const analyticsPages = pgTable("analytics_pages", {
  id: serial("id").primaryKey(),
  pageUrlNormalized: varchar("page_url_normalized", { length: 500 }).notNull(),
  pageTitle: varchar("page_title", { length: 255 }),
  date: date("date").notNull(), // agrega por dia

  totalViews: integer("total_views").default(0).notNull(),
  uniqueVisitors: integer("unique_visitors").default(0).notNull(),
  avgTimeOnPageSec: integer("avg_time_on_page_sec").default(0).notNull(),
  bounces: integer("bounces").default(0).notNull(),
  exits: integer("exits").default(0).notNull(),
  conversions: integer("conversions").default(0).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  index("analytics_pages_url_date_idx").on(table.pageUrlNormalized, table.date),
  index("analytics_pages_date_idx").on(table.date),
]);

// ── Funil de Conversão (etapas) ───────────────────────────────────────────────
export const analyticsConversions = pgTable("analytics_conversions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  visitorId: varchar("visitor_id", { length: 64 }).notNull(),
  userId: integer("user_id"),

  // Etapas alcançadas (booleano por etapa)
  reachedLanding: boolean("reached_landing").default(false).notNull(),
  reachedSignupStart: boolean("reached_signup_start").default(false).notNull(),
  reachedSignupComplete: boolean("reached_signup_complete").default(false).notNull(),
  reachedTrialStart: boolean("reached_trial_start").default(false).notNull(),
  reachedPlanSelect: boolean("reached_plan_select").default(false).notNull(),
  reachedCheckout: boolean("reached_checkout").default(false).notNull(),
  reachedPixGenerated: boolean("reached_pix_generated").default(false).notNull(),
  reachedPayment: boolean("reached_payment").default(false).notNull(),
  reachedFirstLogin: boolean("reached_first_login").default(false).notNull(),

  utmSource: varchar("utm_source", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  index("analytics_conversions_session_id_idx").on(table.sessionId),
  index("analytics_conversions_created_at_idx").on(table.createdAt),
  index("analytics_conversions_utm_campaign_idx").on(table.utmCampaign),
]);

// ── Espelho de Receita para Analytics ─────────────────────────────────────────
export const analyticsRevenue = pgTable("analytics_revenue", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  sessionId: varchar("session_id", { length: 64 }),
  visitorId: varchar("visitor_id", { length: 64 }),
  userId: integer("user_id"),

  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  planId: varchar("plan_id", { length: 50 }),
  planName: varchar("plan_name", { length: 100 }),

  utmSource: varchar("utm_source", { length: 100 }),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }),

  country: varchar("country", { length: 100 }),
  state: varchar("state", { length: 100 }),
  city: varchar("city", { length: 100 }),

  type: varchar("type", { length: 50 }).default("subscription").notNull(), // subscription | one_time
  asaasPaymentId: varchar("asaas_payment_id", { length: 100 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("analytics_revenue_created_at_idx").on(table.createdAt),
  index("analytics_revenue_org_id_idx").on(table.organizationId),
  index("analytics_revenue_utm_campaign_idx").on(table.utmCampaign),
  index("analytics_revenue_state_idx").on(table.state),
]);

// ── Campanhas UTM (agregação) ─────────────────────────────────────────────────
export const analyticsCampaigns = pgTable("analytics_campaigns", {
  id: serial("id").primaryKey(),
  utmSource: varchar("utm_source", { length: 100 }).notNull(),
  utmMedium: varchar("utm_medium", { length: 100 }),
  utmCampaign: varchar("utm_campaign", { length: 100 }).notNull(),
  utmContent: varchar("utm_content", { length: 100 }),
  utmTerm: varchar("utm_term", { length: 100 }),

  // Investimento (manual, informado pelo usuário)
  investment: decimal("investment", { precision: 10, scale: 2 }).default("0.00"),

  // Métricas calculadas (cache)
  totalVisits: integer("total_visits").default(0).notNull(),
  totalLeads: integer("total_leads").default(0).notNull(),
  totalConversions: integer("total_conversions").default(0).notNull(),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0.00"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  index("analytics_campaigns_utm_campaign_idx").on(table.utmCampaign),
  index("analytics_campaigns_utm_source_idx").on(table.utmSource),
]);

// ── Relatórios agendados ──────────────────────────────────────────────────────
export const analyticsReports = pgTable("analytics_reports", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // daily | weekly | monthly | annual
  period: varchar("period", { length: 30 }).notNull(), // ex: 2025-07-28
  status: varchar("status", { length: 30 }).default("pending").notNull(),

  // Snapshot JSON do relatório
  data: jsonb("data"),

  emailSentTo: text("email_sent_to"),
  emailSentAt: timestamp("email_sent_at"),

  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Insights gerados por IA ────────────────────────────────────────────────────
export const analyticsAiInsights = pgTable("analytics_ai_insights", {
  id: serial("id").primaryKey(),
  insightType: varchar("insight_type", { length: 50 }).notNull(), // growth | drop | campaign | revenue | churn | behavior
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  severity: varchar("severity", { length: 20 }).default("info").notNull(), // info | warning | success | critical
  recommendation: text("recommendation"),
  metricRef: varchar("metric_ref", { length: 100 }),
  metricValue: decimal("metric_value", { precision: 10, scale: 2 }),

  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isRead: boolean("is_read").default(false).notNull(),
}, (table) => [
  index("analytics_ai_insights_generated_at_idx").on(table.generatedAt),
  index("analytics_ai_insights_type_idx").on(table.insightType),
]);

// ── Security & Audit Logs ───────────────────────────────────────────────────
export const analyticsSecurityLogs = pgTable("analytics_security_logs", {
  id: serial("id").primaryKey(),
  ip: varchar("ip", { length: 45 }).notNull(),
  route: text("route").notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: integer("status_code").default(200).notNull(),
  eventCategory: varchar("event_category", { length: 50 }).notNull(), // 'access' | 'blocked_rate_limit' | 'unauthorized' | 'bot_scanner' | 'brute_force'
  severity: varchar("severity", { length: 20 }).default("info").notNull(), // 'info' | 'low' | 'medium' | 'high' | 'critical'
  userAgent: text("user_agent"),
  referer: text("referer"),
  userId: integer("user_id"),
  organizationId: integer("organization_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("analytics_security_logs_ip_idx").on(table.ip),
  index("analytics_security_logs_created_at_idx").on(table.createdAt),
  index("analytics_security_logs_category_idx").on(table.eventCategory),
  index("analytics_security_logs_severity_idx").on(table.severity),
]);

// ── Types exportados ──────────────────────────────────────────────────────────
export type AnalyticsVisitor = typeof analyticsVisitors.$inferSelect;
export type InsertAnalyticsVisitor = typeof analyticsVisitors.$inferInsert;
export type AnalyticsSession = typeof analyticsSessions.$inferSelect;
export type InsertAnalyticsSession = typeof analyticsSessions.$inferInsert;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;
export type AnalyticsHeatmap = typeof analyticsHeatmap.$inferSelect;
export type InsertAnalyticsHeatmap = typeof analyticsHeatmap.$inferInsert;
export type AnalyticsOnline = typeof analyticsOnline.$inferSelect;
export type InsertAnalyticsOnline = typeof analyticsOnline.$inferInsert;
export type AnalyticsRevenue = typeof analyticsRevenue.$inferSelect;
export type InsertAnalyticsRevenue = typeof analyticsRevenue.$inferInsert;
export type AnalyticsAiInsight = typeof analyticsAiInsights.$inferSelect;
export type InsertAnalyticsAiInsight = typeof analyticsAiInsights.$inferInsert;
export type AnalyticsSecurityLog = typeof analyticsSecurityLogs.$inferSelect;
export type InsertAnalyticsSecurityLog = typeof analyticsSecurityLogs.$inferInsert;

// ── CRM / Funil de Vendas & Dashboard Comercial ─────────────────────────────
export const crmLeads = pgTable("crm_leads", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  name: text("name").notNull(),
  companyOrSchool: text("company_or_school"),
  cityState: text("city_state"), // ex: 'São Paulo - SP'
  phone: text("phone"),
  email: text("email"),
  birthDate: varchar("birth_date", { length: 20 }),
  instrument: text("instrument"),
  course: text("course"),
  level: text("level"), // 'Iniciante' | 'Intermediário' | 'Avançado'
  modality: text("modality"), // 'Presencial' | 'Online' | 'Híbrido'
  preferredTeacherId: integer("preferred_teacher_id"),
  planName: text("plan_name").default("Plano Pro"),
  stage: text("stage").notNull().default("novo"), // 'novo' | 'primeiro_contato' | 'em_conversa' | 'aula_experimental' | 'proposta' | 'aguardando_decisao' | 'matriculado' | 'perdido'
  temperature: text("temperature").default("morno"), // 'quente' | 'morno' | 'frio'
  priority: text("priority").default("media"), // 'alta' | 'media' | 'baixa'
  conversionProbability: integer("conversion_probability").default(50),
  expectedEnrollmentDate: timestamp("expected_enrollment_date"),
  firstContactAt: timestamp("first_contact_at"),
  lastContactAt: timestamp("last_contact_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  value: decimal("value", { precision: 10, scale: 2 }).default("0.00"),
  notes: text("notes"),
  source: text("source").default("WhatsApp"),
  tags: jsonb("tags").$type<string[]>().default([]),
  lostReason: text("lost_reason"),
  lossNotes: text("loss_notes"),
  productService: text("product_service"), // Produto / Serviço / Imóvel / Projeto de interesse
  customFields: jsonb("custom_fields").$type<Record<string, any>>().default({}),
  assignedToUserId: integer("assigned_to_user_id"),
  convertedStudentId: integer("converted_student_id"),
  convertedAt: timestamp("converted_at"),
  dueDateAlert: timestamp("due_date_alert"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CrmLead = typeof crmLeads.$inferSelect;
export type InsertCrmLead = typeof crmLeads.$inferInsert;

export const crmGoals = pgTable("crm_goals", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  monthYear: varchar("month_year", { length: 20 }).notNull(), // ex: '08/2026'
  targetNewStudents: integer("target_new_students").default(10).notNull(),
  targetDemos: integer("target_demos").default(25).notNull(),
  targetProposals: integer("target_proposals").default(20).notNull(),
  targetDeals: integer("target_deals").default(10).notNull(),
  targetMrr: decimal("target_mrr", { precision: 10, scale: 2 }).default("2000.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CrmGoal = typeof crmGoals.$inferSelect;

export const crmActivities = pgTable("crm_activities", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  leadId: integer("lead_id"),
  title: text("title").notNull(),
  type: text("type").notNull().default("whatsapp"), // 'criacao' | 'mudanca_etapa' | 'contato' | 'ligacao' | 'whatsapp' | 'email' | 'aula_experimental' | 'proposta' | 'follow_up' | 'conversao' | 'perda' | 'observacao'
  description: text("description"),
  scheduledTime: text("scheduled_time"),
  assignedUserName: text("assigned_user_name"),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CrmActivity = typeof crmActivities.$inferSelect;

export const crmFollowUps = pgTable("crm_follow_ups", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  leadId: integer("lead_id").notNull(),
  title: text("title").notNull(),
  dueDate: timestamp("due_date").notNull(),
  dueTime: varchar("due_time", { length: 10 }),
  assignedToUserId: integer("assigned_to_user_id"),
  assignedUserName: text("assigned_user_name"),
  contactType: text("contact_type").default("whatsapp").notNull(), // 'whatsapp' | 'ligacao' | 'reuniao' | 'email' | 'outro'
  notes: text("notes"),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CrmFollowUp = typeof crmFollowUps.$inferSelect;
export type InsertCrmFollowUp = typeof crmFollowUps.$inferInsert;

export const crmSettings = pgTable("crm_settings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().unique(),
  customOrigins: jsonb("custom_origins").$type<string[]>().default([]),
  customLossReasons: jsonb("custom_loss_reasons").$type<string[]>().default([]),
  customTags: jsonb("custom_tags").$type<string[]>().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CrmSettings = typeof crmSettings.$inferSelect;

// ── Salas de Estúdio / Ensaio ───────────────────────────────────────────────
export const studioRooms = pgTable("studio_rooms", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).default("Estúdio de gravação").notNull(),
  capacity: integer("capacity").default(8).notNull(),
  equipments: text("equipments").default("Bateria, Teclado, Ar Condicionado").notNull(),
  status: varchar("status", { length: 20 }).default("ativa").notNull(), // "ativa" | "manutencao" | "inativa"
  imageUrl: text("imageUrl"),
  utilizationRate: integer("utilization_rate").default(75).notNull(),
  isPrincipal: boolean("is_principal").default(false).notNull(),
  color: varchar("color", { length: 20 }).default("#3b82f6").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type StudioRoom = typeof studioRooms.$inferSelect;
export type InsertStudioRoom = typeof studioRooms.$inferInsert;

// ── Convites e Links de Auto-Matrícula do Aluno ──────────────────────────────
export const enrollmentLinks = pgTable("enrollment_links", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  instrumentId: integer("instrumentId"),
  monthlyFee: decimal("monthlyFee", { precision: 10, scale: 2 }),
  leadId: integer("leadId"),
  status: varchar("status", { length: 20 }).default("active").notNull(), // 'active' | 'used' | 'expired'
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ── Memória Pedagógica Contínua da IA (Opção 4) ──────────────────────────────
export const studentPedagogicalMemory = pgTable("student_pedagogical_memory", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  studentId: integer("studentId").notNull().unique(),
  strongPoints: text("strongPoints").default("[]"), // JSON string / array
  weakPoints: text("weakPoints").default("[]"),   // JSON string / array
  repertoireMastered: text("repertoireMastered").default("[]"), // JSON array
  repertoireLearning: text("repertoireLearning").default("[]"), // JSON array
  pedagogicalDirectives: text("pedagogicalDirectives"), // Recomendações consolidadas da IA
  lastAiAnalysisAt: timestamp("lastAiAnalysisAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type StudentPedagogicalMemory = typeof studentPedagogicalMemory.$inferSelect;
export type InsertStudentPedagogicalMemory = typeof studentPedagogicalMemory.$inferInsert;

// ── Registro e Cache de Otimizações de Agenda via IA (Opção 6) ───────────────
export const scheduleOptimizationLogs = pgTable("schedule_optimization_logs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId").notNull(),
  userId: integer("userId").notNull(),
  inputConstraints: text("inputConstraints").notNull(), // JSON com parâmetros enviados
  proposedSchedule: text("proposedSchedule").notNull(),  // JSON com a grade ótima sugerida
  status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending', 'applied', 'rejected'
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduleOptimizationLog = typeof scheduleOptimizationLogs.$inferSelect;
export type InsertScheduleOptimizationLog = typeof scheduleOptimizationLogs.$inferInsert;

// ── Clientes / Escolas em Destaque na Landing Page (Super Admin) ────────────
export const landingClients = pgTable("landing_clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  logoUrl: text("logoUrl").notNull(),
  websiteUrl: text("websiteUrl"),
  testimonial: text("testimonial"),
  order: integer("order").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type LandingClient = typeof landingClients.$inferSelect;
export type InsertLandingClient = typeof landingClients.$inferInsert;

// ── Ofertas de Antecipação de Horários por Falta ───────────────────────────
export const slotOffers = pgTable("slot_offers", {
  id: serial("id").primaryKey(),
  organizationId: integer("organizationId"),
  originalLessonId: integer("originalLessonId").notNull(),
  teacherId: integer("teacherId").notNull(),
  slotDate: timestamp("slotDate").notNull(),
  duration: integer("duration").default(60).notNull(),
  instrumentId: integer("instrumentId"),
  title: varchar("title", { length: 255 }),
  status: varchar("status", { length: 20 }).default("aberta").notNull(), // 'aberta', 'aceita', 'expirada', 'cancelada'
  acceptedByStudentId: integer("acceptedByStudentId"),
  acceptedLessonId: integer("acceptedLessonId"),
  acceptedAt: timestamp("acceptedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
}, (table) => [
  index("slot_offers_org_status_idx").on(table.organizationId, table.status),
  index("slot_offers_slot_date_idx").on(table.slotDate),
]);

export type SlotOffer = typeof slotOffers.$inferSelect;
export type InsertSlotOffer = typeof slotOffers.$inferInsert;
