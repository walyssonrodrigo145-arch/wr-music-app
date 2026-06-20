const { appRouter } = require('./dist/routers.js');
const { createContext } = require('./dist/_core/context.js');

async function test() {
  const caller = appRouter.createCaller({
    user: { id: 1, organizationId: 1, role: 'admin' },
    req: {}, res: {}
  });

  try {
    const res = await caller.automations.create({
      name: "Teste Direto " + Date.now(),
      trigger: "payment_due",
      offsetDays: 1,
      offsetHours: 0,
      messageTemplate: "Ola TESTE DIRETO",
      channel: "whatsapp",
      isActive: 1
    });
    console.log("SUCCESS_CALLER:", res);
  } catch (err) {
    console.error("ERROR_CALLER:", err);
  }
}

test();
