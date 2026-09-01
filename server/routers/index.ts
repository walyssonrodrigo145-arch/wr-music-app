// Composição do appRouter — AUDIT FIX (split do monólito routers.ts por domínio)
import { router } from "../_core/trpc";
import { superAdminRouter } from "../superAdminRouter";
import { reportEngineRouter } from "../reportEngineRouter";
import { marketingRouter } from "../marketingRouter";
import { analyticsRouter } from "../analyticsRouter";
import { studioRoomsRouter } from "../studioRoomsRouter";
import { enrollmentRouter } from "../enrollmentRouter";
import { advancedAiRouter } from "../advancedAiRouter";
import { slotAdvanceRouter } from "../slotAdvanceRouter";
import { fiscalRouter } from "../fiscalRouter";
import { crmRouter } from "../crmRouter";
import { chatbotFlowRouter } from "../chatbotFlowRouter";
import { schoolAiRouter } from "../schoolAiRouter";
import { fcmRouter } from "../fcmRouter";
import { authRouters } from "./authRouters";
import { progressRouters } from "./progressRouters";
import { dashboardRouters } from "./dashboardRouters";
import { studentsRouters } from "./studentsRouters";
import { lessonsRouters } from "./lessonsRouters";
import { plataformaRouters } from "./plataformaRouters";
import { financeiroRouters } from "./financeiroRouters";
import { portalRouters } from "./portalRouters";
import { comunicacaoRouters } from "./comunicacaoRouters";
import { contratosRouters } from "./contratosRouters";
import { reportsRouters } from "./reportsRouters";
import { aiRouters } from "./aiRouters";
import { rankingsRouter } from "./rankingsRouter";

export const appRouter = router({
  superAdmin: superAdminRouter,
  reportEngine: reportEngineRouter,
  marketing: marketingRouter,
  analytics: analyticsRouter,
  studioRooms: studioRoomsRouter,
  enrollment: enrollmentRouter,
  advancedAi: advancedAiRouter,
  slotAdvance: slotAdvanceRouter,
  fiscal: fiscalRouter,
  ...authRouters,
  ...progressRouters,
  ...dashboardRouters,
  ...studentsRouters,
  ...lessonsRouters,
  ...plataformaRouters,
  ...financeiroRouters,
  ...portalRouters,
  ...comunicacaoRouters,
  ...contratosRouters,
  ...reportsRouters,
  ...aiRouters,
  fcm: fcmRouter,
  crm: crmRouter,
  chatbotFlow: chatbotFlowRouter,
  schoolAi: schoolAiRouter,
  rankings: rankingsRouter,
});

export type AppRouter = typeof appRouter;