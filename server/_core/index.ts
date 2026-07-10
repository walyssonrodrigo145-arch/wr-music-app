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
import { marketingWorker } from "../services/MarketingQueueWorker";
import { createRateLimiter } from "./rateLimiter";
import { runAutoMigrations } from "./migrate";
import { runTenantMigrations } from "./migrate_tenants";
import { getDb } from "../db";
import { settings, paymentDues, organizations, asaasWebhooksLog, students } from "../../drizzle/schema";
import { ENV } from './env';
import { eq, and } from "drizzle-orm";
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

  // CRÍTICO-02 FIX: Limite de 10MB no body parser global para evitar DoS.
  // Requests de upload de arquivo (musicLibrary.upload, etc.) recebem base64 grande,
  // mas esses endpoints têm autenticação prévia e devem usar streaming quando possível.
  // Se necessário, crie middleware específico por rota com limite maior.
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Rota especial de upload com limite maior (requer autenticação via JWT cookie):
  // Obs: o trânsito de base64 para arquivos de músca/vídeo passa por aqui.
  // O middleware do tRPC já verifica o cookie antes de processar o payload.
  // Límite: 200MB — suficiente para vídeos educacionais sem expor DoS.
  app.use(
    "/api/trpc/musicLibrary.upload",
    express.json({ limit: "200mb" }),
    express.urlencoded({ limit: "200mb", extended: true })
  );
  
  registerOAuthRoutes(app);
  registerGoogleAuthRoutes(app);

  // ─── Asaas Webhook ───────────────────────────────────────────────────────
  // Recebe notificações do Asaas e atualiza o status das mensalidades automaticamente.
  app.post("/api/webhooks/asaas", async (req, res) => {
    try {
      // CRÍTICO-10 FIX: Token de webhook agora é OBRIGATÓRIO.
      // Se ASAAS_WEBHOOK_TOKEN não estiver configurado, o endpoint recusa qualquer requisição.
      // Isso impede que terceiros simulem eventos Asaas e manipulem dados financeiros.
      const webhookToken = ENV.asaasWebhookToken;
      const requestToken = req.headers["asaas-access-token"];

      if (!webhookToken) {
        // Em produção, ASAAS_WEBHOOK_TOKEN é obrigatório (validado em env.ts).
        // Em dev, se não configurado, apenas loga e aceita para facilitar testes locais.
        if (ENV.isProduction) {
          console.error("[Asaas Webhook] ASAAS_WEBHOOK_TOKEN não configurado em produção. Requisição bloqueada.");
          return res.status(401).json({ error: "Webhook token not configured" });
        }
        console.warn("[Asaas Webhook] ASAAS_WEBHOOK_TOKEN não configurado (ambiente dev — aceito sem validação).");
      } else if (requestToken !== webhookToken) {
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
        // ── FIX-3: Busca com validação de existência (tenant safety) ──────────
        // Buscamos o paymentDue pelo asaasId E validamos que ele existe antes de
        // atualizar — garantindo que o asaasId pertence a um registro real do sistema.
        const [paymentDetails] = await db
          .select({
            id: paymentDues.id,
            organizationId: paymentDues.organizationId,
            userId: paymentDues.userId,
            amount: paymentDues.amount,
            studentName: students.name,
          })
          .from(paymentDues)
          .leftJoin(students, eq(paymentDues.studentId, students.id))
          .where(eq(paymentDues.asaasId, payment.id))
          .limit(1);

        if (!paymentDetails) {
          // asaasId não encontrado no banco — pode ser webhook de outro ambiente ou ID inválido
          console.warn(`[Asaas Webhook] asaasId não encontrado no banco: ${payment.id} — ignorado`);
          return res.status(200).json({ ok: true });
        }

        // Atualiza apenas o registro encontrado (usando o ID interno — nunca só o asaasId genérico)
        await db
          .update(paymentDues)
          .set({ status: "pago", paidAt: new Date(), updatedAt: new Date() })
          .where(and(eq(paymentDues.id, paymentDetails.id), eq(paymentDues.organizationId, paymentDetails.organizationId!)));
        console.log(`[Asaas Webhook] Mensalidade marcada como PAGA (${payment.id}) — org ${paymentDetails.organizationId}`);

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


      if (event === "PAYMENT_OVERDUE") {
        // CRÍTICO-08 FIX: Idempotência para PAYMENT_OVERDUE.
        // Só atualiza se o status atual NÃO for já "atrasado" (evita reprocessamento).
        const [due] = await db
          .select({ id: paymentDues.id, organizationId: paymentDues.organizationId, status: paymentDues.status })
          .from(paymentDues)
          .where(eq(paymentDues.asaasId, payment.id))
          .limit(1);
        if (due) {
          if (due.status === "atrasado") {
            console.log(`[Asaas Webhook] Evento duplicado ignorado (já atrasado): ${event} ${payment.id}`);
          } else {
            await db
              .update(paymentDues)
              .set({ status: "atrasado", updatedAt: new Date() })
              .where(and(eq(paymentDues.id, due.id), eq(paymentDues.organizationId, due.organizationId!)));
            console.log(`[Asaas Webhook] Mensalidade marcada como ATRASADA (${payment.id}) — org ${due.organizationId}`);
          }
        } else {
          console.warn(`[Asaas Webhook] PAYMENT_OVERDUE — asaasId não encontrado: ${payment.id}`);
        }
      }

      if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
        // CRÍTICO-08 FIX: Idempotência para PAYMENT_DELETED/REFUNDED.
        // Só limpa o asaasId se ele ainda estiver preenchido no registro (evita reprocessamento).
        const [due] = await db
          .select({ id: paymentDues.id, organizationId: paymentDues.organizationId, asaasId: paymentDues.asaasId })
          .from(paymentDues)
          .where(eq(paymentDues.asaasId, payment.id))
          .limit(1);
        if (due) {
          if (!due.asaasId) {
            console.log(`[Asaas Webhook] Evento duplicado ignorado (asaasId já nulo): ${event} ${payment.id}`);
          } else {
            await db
              .update(paymentDues)
              .set({ status: "pendente", asaasId: null, asaasPaymentLink: null, asaasBillingType: null, updatedAt: new Date() })
              .where(and(eq(paymentDues.id, due.id), eq(paymentDues.organizationId, due.organizationId!)));
            console.log(`[Asaas Webhook] Cobrança removida/estornada (${payment.id}) — org ${due.organizationId}`);
          }
        } else {
          console.warn(`[Asaas Webhook] ${event} — asaasId não encontrado: ${payment.id}`);
        }
      }

      if (event === "PAYMENT_CREATED") {
        // CRÍTICO-08 FIX: Idempotência para PAYMENT_CREATED.
        // Só atualiza se o registro existir E ainda não tiver asaasId preenchido de outra forma.
        const [due] = await db
          .select({ id: paymentDues.id, organizationId: paymentDues.organizationId })
          .from(paymentDues)
          .where(eq(paymentDues.asaasId, payment.id))
          .limit(1);
        if (due) {
          await db
            .update(paymentDues)
            .set({ status: "pendente", updatedAt: new Date() })
            .where(and(eq(paymentDues.id, due.id), eq(paymentDues.organizationId, due.organizationId!)));
          console.log(`[Asaas Webhook] Nova cobrança criada/registrada (${payment.id}) — org ${due.organizationId}`);
        }
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
      // CRÍTICO-10 FIX: Token de webhook agora é OBRIGATÓRIO (igual ao webhook de mensalidades).
      const webhookToken = ENV.asaasWebhookToken;
      const requestToken = req.headers["asaas-access-token"];

      if (!webhookToken) {
        if (ENV.isProduction) {
          console.error("[Asaas Platform Webhook] ASAAS_WEBHOOK_TOKEN não configurado em produção. Requisição bloqueada.");
          return res.status(401).json({ error: "Webhook token not configured" });
        }
        console.warn("[Asaas Platform Webhook] ASAAS_WEBHOOK_TOKEN não configurado (ambiente dev — aceito sem validação).");
      } else if (requestToken !== webhookToken) {
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

      // ── FIX-1: Validação cruzada de subscriptionId ────────────────────────────
      // Antes de processar qualquer evento de plataforma, verificamos que o
      // payment.customer corresponde a uma organização que TEM o asaasSubscriptionId
      // correto — evitando ativação indevida por colisão de IDs ou eventos errados.
      const [targetOrg] = await db
        .select({ id: organizations.id, asaasSubscriptionId: organizations.asaasSubscriptionId })
        .from(organizations)
        .where(eq(organizations.asaasCustomerId, payment.customer))
        .limit(1);

      if (!targetOrg) {
        console.warn(`[Asaas Platform Webhook] Customer não encontrado no banco: ${payment.customer} — ignorado`);
        return res.status(200).json({ ok: true });
      }

      // Se o evento tem subscription ID, validar que corresponde ao registrado
      const paymentWithSub = req.body as { event: string; payment?: { id: string; status: string; customer: string; subscription?: string } };
      if (paymentWithSub.payment?.subscription && targetOrg.asaasSubscriptionId &&
          paymentWithSub.payment.subscription !== targetOrg.asaasSubscriptionId) {
        console.warn(
          `[Asaas Platform Webhook] subscriptionId divergente para customer ${payment.customer}: ` +
          `esperado=${targetOrg.asaasSubscriptionId} recebido=${paymentWithSub.payment.subscription} — ignorado`
        );
        return res.status(200).json({ ok: true });
      }

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
          .where(eq(organizations.id, targetOrg.id));
        console.log(`[Asaas Platform Webhook] Assinatura ATIVADA para customer ${payment.customer} | próximo vencimento: ${nextPeriodEnd.toISOString().slice(0,10)}`);
      } else if (event === "PAYMENT_OVERDUE") {
        await db
          .update(organizations)
          .set({ subscriptionStatus: "past_due", updatedAt: new Date() })
          .where(eq(organizations.id, targetOrg.id));
        console.log(`[Asaas Platform Webhook] Assinatura ATRASADA para customer ${payment.customer}`);
      } else if (event === "SUBSCRIPTION_CANCELED" || event === "SUBSCRIPTION_DELETED" || event === "PAYMENT_REFUNDED") {
        // ── BUG 2 FIX: Tratar cancelamento de assinatura pelo portal Asaas ───
        await db
          .update(organizations)
          .set({ 
            subscriptionStatus: "canceled",
            asaasSubscriptionId: null,
            updatedAt: new Date()
          })
          .where(eq(organizations.id, targetOrg.id));
        console.log(`[Asaas Platform Webhook] Assinatura CANCELADA para customer ${payment.customer}`);
      } else {
        // FIX-7: Log de eventos não mapeados para facilitar diagnóstico futuro
        console.warn(`[Asaas Platform Webhook] Evento não tratado recebido: "${event}" para customer ${payment.customer}`);
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

  // CRÍTICO-03 FIX: CSP habilitado em produção com política restritiva.
  // Em desenvolvimento, CSP permanece desabilitado para compatibilidade com Vite HMR.
  app.use(helmet({
    contentSecurityPolicy: ENV.isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Necessário para React e bundlers modernos (hash ou nonce deve substituir em v2)
          "'unsafe-inline'",
          "'unsafe-eval'", // remover após migrar para hash-based CSP
          "https://www.googletagmanager.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.asaas.com",
          "https://sandbox.asaas.com",
          "https://generativelanguage.googleapis.com",
          "wss:",
        ],
        mediaSrc: ["'self'", "blob:", "https:"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    } : false, // desabilitado em dev para compatibilidade com Vite
    crossOriginEmbedderPolicy: false,
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
    // Iniciar job de automação de marketing
    marketingWorker.start();
    // Configura o webhook do WhatsApp
    setupEvolutionWebhook();
  });
}

startServer().catch(console.error);
