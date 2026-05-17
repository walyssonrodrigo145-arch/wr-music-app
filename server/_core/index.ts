import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startAutomationJob } from "../automationJob";
import { createRateLimiter } from "./rateLimiter";
import { runAutoMigrations } from "./migrate";
import { runTenantMigrations } from "./migrate_tenants";
import { getDb } from "../db";
import { paymentDues } from "../../drizzle/schema";
import { eq } from "drizzle-orm";


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

      if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
        await db
          .update(paymentDues)
          .set({ status: "pago", paidAt: new Date(), updatedAt: new Date() })
          .where(eq(paymentDues.asaasId, payment.id));
        console.log(`[Asaas Webhook] Mensalidade marcada como PAGA (${payment.id})`);
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

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[Asaas Webhook] Erro ao processar:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

  app.use("/uploads", express.static("uploads"));

  // Rate Limiting para a API
  const apiLimiter = createRateLimiter(60 * 1000, 120, "Muitas requisições. Tente novamente em um minuto.");
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
  });
}

startServer().catch(console.error);
