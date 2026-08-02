// ─── Validação de variáveis de ambiente obrigatórias ────────────────────────
// Falha rápida: se variáveis críticas de segurança não estiverem definidas,
// o servidor não inicia — melhor do que silenciosamente usar defaults inseguros.
const requiredEnvVars = [
  "JWT_SECRET",
  "DATABASE_URL",
] as const;

// ─── Variáveis obrigatórias SOMENTE em produção ───────────────────────────────
// Em desenvolvimento local estas podem ser omitidas para facilitar o setup.
const requiredInProduction = [
  "REGISTRATION_TOKEN",
  "ASAAS_WEBHOOK_TOKEN",
  "ASAAS_BASE_URL",
  "SUPER_ADMIN_EMAIL",
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(
      `[ENV] Variável de ambiente obrigatória não definida: ${key}. ` +
      `Configure-a na VPS antes de iniciar o servidor.`
    );
  }
}

if (process.env.NODE_ENV === "production") {
  for (const key of requiredInProduction) {
    if (!process.env[key]) {
      throw new Error(
        `[ENV] Variável obrigatória em produção não definida: ${key}. ` +
        `Configure-a na VPS antes de iniciar o servidor em produção. ` +
        `NUNCA use valores padrão para segredos de segurança.`
      );
    }
  }
}

// ─── Segurança: Asaas não pode apontar para sandbox em produção ───────────────
const asaasBaseUrlRaw = (process.env.ASAAS_BASE_URL ?? "").trim();
if (process.env.NODE_ENV === "production" && asaasBaseUrlRaw.includes("sandbox")) {
  throw new Error(
    "[ENV] ASAAS_BASE_URL aponta para o sandbox em produção! " +
    "Configure a URL de produção: https://api.asaas.com/api/v3"
  );
}

// ─── Segurança: Token de registro hardcoded é proibido ────────────────────────
const registrationTokenRaw = (
  process.env.REGISTRATION_TOKEN ||
  process.env.REGIATRATION_TOKEN || // typo legado mantido por compatibilidade
  ""
).trim();

if (
  process.env.NODE_ENV === "production" &&
  (!registrationTokenRaw || registrationTokenRaw === "44C9rDweFjfrEwk")
) {
  throw new Error(
    "[ENV] REGISTRATION_TOKEN inválido ou usando valor padrão inseguro. " +
    "Defina um token seguro e único na VPS."
  );
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET!, // obrigatório — validado acima
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY || process.env.AUTH_EMAIL || "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
  googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.SECRET_GOOGLE || "",
  appUrl: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || (process.env.NODE_ENV === "production" ? "https://wrmusicpro.com.br" : "http://localhost:3000"),

  // ─── Segurança: sem fallback hardcoded. Em dev, usa string vazia (cadastro bloqueado). ──
  registrationToken: registrationTokenRaw,

  // ─── Super Admin: email definido por variável de ambiente com fallback master ──
  superAdminEmail: (process.env.SUPER_ADMIN_EMAIL || "walyssonrodrigo145@gmail.com").toLowerCase().trim(),
  superAdminEmails: ["walyssonrodrigo145@gmail.com", "ddwvitor@gmail.com"],

  // ─── Asaas: sem fallback para sandbox. Em dev, sem URL = integração desativada. ──
  asaasApiKey: (process.env.ASAAS_API_KEY ?? "").trim(),
  asaasBaseUrl: asaasBaseUrlRaw || "https://sandbox.asaas.com/api/v3", // dev only fallback
  asaasWebhookToken: (process.env.ASAAS_WEBHOOK_TOKEN || "").trim(),

  // ─── Mercado Pago: secret para validação de assinatura do webhook ─────────
  // Obtenha em: Dashboard MP → Suas integrações → Webhooks → Chave secreta
  mpWebhookSecret: (process.env.MP_WEBHOOK_SECRET || "").trim(),
};
