import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import whatsappWebhookRouter from "../webhooks/whatsapp";
import botStatusWebhookRouter from "../webhooks/botStatus";
import { serveStatic, setupVite } from "./vite";
import { startAutomationJob } from "../automationJob";
import { createRateLimiter } from "./rateLimiter";
import { runAutoMigrations } from "./migrate";
import { runTenantMigrations } from "./migrate_tenants";
import { getDb } from "../db";
import { paymentDues, students, organizations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { setupEvolutionWebhook } from "../utils/whatsapp";
import { notifyUser } from "./notification";


function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Sincroniza o banco de dados e aplica o isolamento de tenants
  await runAutoMigrations();
  await runTenantMigrations();

  const app = express();
  app.set("trust proxy", 1); // Obrigatório para a Render enviar cookies "Secure"
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads (up to 500MB)
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));
  
  registerOAuthRoutes(app);
  registerGoogleAuthRoutes(app);

  // ─── Asaas Webhook ───────────────────────────────────────────────────────
  // Recebe notificações do Asaas e atualiza o status das mensalidades automaticamente.
  app.post("/api/webhooks/asaas", async (req, res) => {
    try {
      // Opcional: validação do token do webhook para maior segurança
      const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
      const requestToken = req.headers["asaas-access-token"];
      if (webhookToken && requestToken !== webhookToken) {
        console.warn("[Asaas Webhook] Token de autenticação inválido ou não fornecido.");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { event, payment } = req.body as {
        event: string;
        payment?: { id: string; status: string; value: number };
      };

      console.log(`[Asaas Webhook] Evento recebido: ${event}`, payment?.id);

      if (!payment?.id) {
        return res.status(200).json({ ok: true });
      }

      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB unavailable" });

      // ── ALTO-2 FIX: Idempotência — evita reprocessamento de webhook duplicado ──
      // O Asaas faz retry automático se não receber 200 em tempo hábil.
      // Se PAYMENT_RECEIVED/CONFIRMED e o registro já está "pago" no banco, é retry — ignorar.
      if ((event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") && payment?.id) {
        const [alreadyPaid] = await db
          .select({ status: paymentDues.status })
          .from(paymentDues)
          .where(and(eq(paymentDues.asaasId, payment.id), eq(paymentDues.status, "pago")))
          .limit(1);
        if (alreadyPaid) {
          console.log(`[Asaas Webhook] Evento duplicado ignorado (já pago): ${event} ${payment.id}`);
          return res.status(200).json({ ok: true });
        }
      }

      if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
        // Fetch payment details and student name before updating
        const [paymentDetails] = await db
          .select({
            userId: paymentDues.userId,
            amount: paymentDues.amount,
            studentName: students.name,
          })
          .from(paymentDues)
          .leftJoin(students, eq(paymentDues.studentId, students.id))
          .where(eq(paymentDues.asaasId, payment.id))
          .limit(1);

        await db
          .update(paymentDues)
          .set({ status: "pago", paidAt: new Date(), updatedAt: new Date() })
          .where(eq(paymentDues.asaasId, payment.id));
        console.log(`[Asaas Webhook] Mensalidade marcada como PAGA (${payment.id})`);

        if (paymentDetails) {
          const valor = Number(paymentDetails.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const contentStr = `O aluno ${paymentDetails.studentName || "Aluno"} pagou a mensalidade no valor de ${valor}.`;
          
          await notifyUser(paymentDetails.userId, {
            title: "Pagamento Confirmado",
            content: contentStr,
          });

          // SSE Notification for Real-Time UI
          const { broadcastSSE } = await import("../webhooks/botStatus");
          broadcastSSE("PAYMENT_CONFIRMED", {
            studentName: paymentDetails.studentName,
            amount: valor,
            message: contentStr,
          });
        }
      }


      if (event === "PAYMENT_OVERDUE") {
        await db
          .update(paymentDues)
          .set({ status: "atrasado", updatedAt: new Date() })
          .where(eq(paymentDues.asaasId, payment.id));
        console.log(`[Asaas Webhook] Mensalidade marcada como ATRASADA (${payment.id})`);
      }

      if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
        await db
          .update(paymentDues)
          .set({ status: "pendente", asaasId: null, asaasPaymentLink: null, asaasBillingType: null, updatedAt: new Date() })
          .where(eq(paymentDues.asaasId, payment.id));
        console.log(`[Asaas Webhook] Cobrança removida/estornada (${payment.id})`);
      }

      if (event === "PAYMENT_CREATED") {
        await db
          .update(paymentDues)
          .set({ status: "pendente", updatedAt: new Date() })
          .where(eq(paymentDues.asaasId, payment.id));
        console.log(`[Asaas Webhook] Nova cobrança criada/registrada (${payment.id})`);
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[Asaas Webhook] Erro ao processar:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // ─── Asaas Platform Webhook ──────────────────────────────────────────────
  // Recebe notificações sobre a assinatura do próprio professor (SaaS)
  app.post("/api/webhooks/asaas/platform", async (req, res) => {
    try {
      // ── BUG 1 FIX: Validação de token (igual ao webhook de mensalidades) ──
      const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;
      const requestToken = req.headers["asaas-access-token"];
      if (webhookToken && requestToken !== webhookToken) {
        console.warn("[Asaas Platform Webhook] Token de autenticação inválido ou não fornecido.");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { event, payment } = req.body as {
        event: string;
        payment?: { id: string; status: string; customer: string; subscription?: string };
      };

      console.log(`[Asaas Platform Webhook] Evento recebido: ${event}`, payment?.id);

      if (!payment?.customer) {
        return res.status(200).json({ ok: true });
      }

      const db = await getDb();
      if (!db) return res.status(500).json({ error: "DB unavailable" });

      // ── MÉDIO-3 FIX: Preencher currentPeriodEnd ao ativar assinatura ──
      if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
        // Calcular próximo período (default mensal — webhooks de assinatura anual são raros)
        const nextPeriodEnd = new Date();
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
        await db
          .update(organizations)
          .set({ 
            subscriptionStatus: "active",
            trialEndsAt: null,         // usuário é assinante — não está mais em trial
            currentPeriodEnd: nextPeriodEnd, // registrar próximo vencimento
            updatedAt: new Date()
          })
          .where(eq(organizations.asaasCustomerId, payment.customer));
        console.log(`[Asaas Platform Webhook] Assinatura ATIVADA para customer ${payment.customer} | próximo vencimento: ${nextPeriodEnd.toISOString().slice(0,10)}`);
      }

      if (event === "PAYMENT_OVERDUE") {
        await db
          .update(organizations)
          .set({ subscriptionStatus: "past_due", updatedAt: new Date() })
          .where(eq(organizations.asaasCustomerId, payment.customer));
        console.log(`[Asaas Platform Webhook] Assinatura ATRASADA para customer ${payment.customer}`);
      }

      // ── BUG 2 FIX: Tratar cancelamento de assinatura pelo portal Asaas ───
      if (event === "SUBSCRIPTION_CANCELED" || event === "SUBSCRIPTION_DELETED" || event === "PAYMENT_REFUNDED") {
        await db
          .update(organizations)
          .set({ 
            subscriptionStatus: "canceled",
            asaasSubscriptionId: null,
            updatedAt: new Date()
          })
          .where(eq(organizations.asaasCustomerId, payment.customer));
        console.log(`[Asaas Platform Webhook] Assinatura CANCELADA para customer ${payment.customer}`);
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[Asaas Platform Webhook] Erro ao processar:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────

  app.use("/api/webhooks/whatsapp", whatsappWebhookRouter);

  // ─── Bot Status Webhook ───────────────────────────────────────────────────
  // POST /api/webhooks/bot-status  → recebe aviso do bot quando cair
  // GET  /api/webhooks/bot-status/sse → SSE para o frontend escutar
  app.use("/api/webhooks/bot-status", botStatusWebhookRouter);
  // ─────────────────────────────────────────────────────────────────────────

  app.use("/uploads", express.static("uploads"));

  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: false, // Vite/React needs inline scripts in dev
    crossOriginEmbedderPolicy: false
  }));
  app.use(cors({
    origin: process.env.NODE_ENV === "production" ? process.env.APP_URL : "*",
    credentials: true
  }));

  // ─── Rate Limiting para a API (Global) ────────────────────────────────────
  // Limite de 5000 req/min por usuário autenticado (identificado pelo cookie
  // app_session_id) ou por IP quando não autenticado.
  //
  // Rotas de automações (list, update, toggle, create, stats, history, etc.)
  // ficam isentas do rate limit global pois são chamadas em cascata legítimas
  // (salvar 1 automação dispara ~4 invalidações do React Query) e já são
  // protegidas por autenticação JWT (protectedProcedure).
  const AUTOMATION_SKIP_ROUTES = [
    "automations.list",
    "automations.update",
    "automations.toggle",
    "automations.create",
    "automations.delete",
    "automations.stats",
    "automations.history",
    "automations.seedDefaults",
    "settings.getAutomation",
    "settings.toggleAutomation",
  ];
  const apiLimiter = createRateLimiter(
    60 * 1000,
    5000,
    "Muitas requisições. Tente novamente em um minuto.",
    AUTOMATION_SKIP_ROUTES
  );
  app.use("/api/trpc", apiLimiter);


  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Iniciar job de automação de lembretes
    startAutomationJob();
    // Configura o webhook do WhatsApp
    setupEvolutionWebhook();
  });
}

startServer().catch(console.error);
