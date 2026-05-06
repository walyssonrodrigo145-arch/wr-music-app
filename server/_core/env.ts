export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET || "fallback_default_secret_padrao_muito_seguro_da_aplicacao",
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
  appUrl: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000",
  registrationToken: (process.env.REGISTRATION_TOKEN || process.env.REGIATRATION_TOKEN || "44C9rDweFjfrEwk").trim(),
};




