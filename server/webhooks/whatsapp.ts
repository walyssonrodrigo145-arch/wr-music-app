import { Router } from "express";
import { getDb } from "../db";
import { students, chatbotSessions, lessons, settings, paymentDues } from "../../drizzle/schema";
import { eq, and, gte } from "drizzle-orm";
import { sendWhatsAppMessage } from "../utils/whatsapp";
import { buildUserContext } from "../utils/aiContext";
import { getSystemPrompt } from "../utils/aiPrompts";
import { callGemini } from "../utils/gemini";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extrai o texto da mensagem do payload do Baileys/Evolution */
function extractMessageText(messageObj: any): string {
  if (!messageObj) return "";
  if (messageObj.conversation) return messageObj.conversation;
  if (messageObj.extendedTextMessage?.text) return messageObj.extendedTextMessage.text;
  if (messageObj.imageMessage?.caption) return messageObj.imageMessage.caption;
  return "";
}

/** Compara opção digitada */
function isOption(text: string, option: string): boolean {
  return text.trim() === option;
}

function generateAvailableSlots(schoolHoursStr: string) {
  let schoolHours: any;
  try {
    schoolHours = JSON.parse(schoolHoursStr);
  } catch (e) {
    schoolHours = {
      monday: { active: true, start: "08:00", end: "18:00" },
      tuesday: { active: true, start: "08:00", end: "18:00" },
      wednesday: { active: true, start: "08:00", end: "18:00" },
      thursday: { active: true, start: "08:00", end: "18:00" },
      friday: { active: true, start: "08:00", end: "18:00" },
      saturday: { active: false },
      sunday: { active: false },
    };
  }

  const daysMap: Record<number, string> = {
    0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
    4: "thursday", 5: "friday", 6: "saturday"
  };

  const slots: { label: string; date: Date }[] = [];
  let added = 0;
  let offset = 1;

  while (added < 9 && offset <= 14) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    offset++;
    
    const dow = d.getDay();
    const dayKey = daysMap[dow];
    const dayConfig = schoolHours[dayKey];
    
    if (!dayConfig || !dayConfig.active) continue;

    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const diaNome = diasSemana[dow];
    const diaMes = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

    const startHour = parseInt(String(dayConfig.start || "08:00").split(":")[0]);
    const endHour = parseInt(String(dayConfig.end || "18:00").split(":")[0]);
    
    const hoursToTry = [startHour, Math.floor((startHour+endHour)/2), endHour - 2];
    
    for (const h of hoursToTry) {
      if (h >= startHour && h < endHour && added < 9) {
        const slot = new Date(d);
        slot.setHours(h, 0, 0, 0);
        slots.push({ label: `${diaNome} (${diaMes}) às ${h}h00`, date: slot });
        added++;
      }
    }
  }

  return slots;
}

// ─── Menu Principal ───────────────────────────────────────────────────────────

function menuPrincipalMsg(schoolName: string): string {
  return `Olá! Bem-vindo(a) à *${schoolName}*! 🎵\nSelecione uma opção abaixo:\n\n1️⃣ - 📅 Minhas Aulas\n2️⃣ - 💰 Financeiro\n3️⃣ - 🎵 Quero me matricular\n4️⃣ - 🎸 Falar com o Professor\n5️⃣ - ⭐ Indicar um amigo`;
}

function menuPrincipalNovoMsg(schoolName: string): string {
  return `Olá! Bem-vindo(a) à *${schoolName}*! 🎵\nSomos especialistas em ensino musical!\n\nComo posso te ajudar?\n\n1️⃣ - 🎵 Quero me matricular\n2️⃣ - 💬 Falar com nossa equipe`;
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    console.log("[Webhook Debug] Payload recebido:", JSON.stringify(payload).substring(0, 300));

    // O Evolution API às vezes envia "messages.upsert" (v1) e outras vezes "MESSAGES_UPSERT" (v2)
    const eventName = payload?.event || "";
    if (eventName !== "messages.upsert" && eventName !== "MESSAGES_UPSERT") {
      return res.status(200).json({ ok: true });
    }

    const messageData = payload.data?.message;
    if (!messageData) return res.status(200).json({ ok: true });

    // O bloqueio de fromMe será feito mais abaixo, após descobrirmos se é o professor

    const remoteJid = payload.data.key?.remoteJid || "";
    if (!remoteJid || remoteJid.includes("@g.us")) {
      return res.status(200).json({ ok: true }); // ignora grupos
    }

    const phone = remoteJid.split("@")[0];
    const textMsg = extractMessageText(messageData);
    const pushName = payload.data.pushName || "Aluno";

    if (!textMsg) return res.status(200).json({ ok: true });

    console.log(`[Chatbot] Mensagem de ${phone}: ${textMsg}`);

    const db = await getDb();
    if (!db) return res.status(500).json({ error: "DB offline" });

    // ── Identificar professor pela instância Evolution API ──
    let professorUserId = 1;
    const instanceName = payload.instance || "";
    if (instanceName.startsWith("prof_")) {
      const parsedId = parseInt(instanceName.split("_")[1], 10);
      if (!isNaN(parsedId)) professorUserId = parsedId;
    }

    // ── Verificar se o chatbot está habilitado ──
    const [profSettings] = await db
      .select({
        chatbotEnabled: settings.chatbotEnabled,
        schoolName: settings.schoolName,
        whatsappBotUrl: settings.whatsappBotUrl,
        whatsappBotToken: settings.whatsappBotToken,
        schoolHours: settings.schoolHours,
        phone: settings.phone,
        organizationId: settings.organizationId,
        geminiApiKey: settings.geminiApiKey,
        geminiModel: settings.geminiModel,
      })
      .from(settings)
      .where(eq(settings.userId, professorUserId))
      .limit(1);

    if (!profSettings || !profSettings.chatbotEnabled) {
      // Robô desativado — ignora silenciosamente
      return res.status(200).json({ ok: true });
    }

    const schoolName = profSettings.schoolName || "nossa Escola de Música";

    const cleanProfPhone = profSettings.phone ? profSettings.phone.replace(/\D/g, "") : "";
    const cleanMsgPhone = phone.replace(/\D/g, "");
    
    // É o próprio professor mandando mensagem para o seu próprio número?
    const isProfessorChat = (cleanProfPhone.length > 8 && cleanMsgPhone.endsWith(cleanProfPhone.slice(-8)));

    // Ignora mensagens enviadas por nós mesmos (bot), exceto se for o chat do professor (para a IA)
    if (payload.data.key?.fromMe && !isProfessorChat) {
      return res.status(200).json({ ok: true });
    }

    // Se for o bot respondendo no chat do professor, ignoramos para não gerar loop infinito
    if (isProfessorChat && textMsg.startsWith("🤖")) {
      return res.status(200).json({ ok: true });
    }

    // ── Função auxiliar de resposta ──
    const sendReply = async (msg: string) => {
      const result = await sendWhatsAppMessage({
        url: profSettings.whatsappBotUrl || undefined,
        token: profSettings.whatsappBotToken || undefined,
        phone,
        message: msg,
        sessionId: instanceName || "prof_1",
      });
      console.log(`[Chatbot] Resposta para ${phone} via ${instanceName || "prof_1"}: success=${result.success}`, result.error ? `Erro: ${result.error}` : "");
    };

    // ── Função auxiliar para notificar o professor ──
    const notifyProfessor = async (msg: string) => {
      if (!profSettings.phone) return;
      const result = await sendWhatsAppMessage({
        url: profSettings.whatsappBotUrl || undefined,
        token: profSettings.whatsappBotToken || undefined,
        phone: profSettings.phone,
        message: `🤖 *Aviso do Robô:*\n\n${msg}`,
        sessionId: instanceName || "prof_1",
      });
      console.log(`[Chatbot] Notificação enviada ao professor (${profSettings.phone}): success=${result.success}`);
    };

    // ── Identificar aluno cadastrado ──
    const allStudents = await db
      .select()
      .from(students)
      .where(eq(students.professorId, professorUserId));

    const student = allStudents.find((s) => {
      const cleanDb = s.phone.replace(/\D/g, "").slice(-8);
      const cleanMsg = phone.slice(-8);
      return cleanDb === cleanMsg;
    });

    // ── Recuperar ou criar sessão ──
    let [session] = await db
      .select()
      .from(chatbotSessions)
      .where(eq(chatbotSessions.phone, phone));

    let sessionData: any = {};
    if (session?.data) {
      try { sessionData = JSON.parse(session.data); } catch (_) {}
    }

    // Reset de sessão se mudou de professor
    if (session && sessionData.activeProfessorId && sessionData.activeProfessorId !== professorUserId) {
      sessionData = { activeProfessorId: professorUserId };
      await db.update(chatbotSessions).set({
        state: "START",
        data: JSON.stringify(sessionData),
        updatedAt: new Date(),
      }).where(eq(chatbotSessions.id, session.id));
      session.state = "START";
      session.data = JSON.stringify(sessionData);
    }

    if (!session) {
      sessionData = { activeProfessorId: professorUserId };
      [session] = await db.insert(chatbotSessions).values({
        phone,
        state: "START",
        data: JSON.stringify(sessionData),
      }).returning();
    }

    const updateState = async (state: string, data?: any) => {
      const mergedData = { ...sessionData, ...(data || {}), activeProfessorId: professorUserId };
      await db.update(chatbotSessions).set({
        state,
        data: JSON.stringify(mergedData),
        updatedAt: new Date(),
      }).where(eq(chatbotSessions.id, session.id));
      session.state = state;
      sessionData = mergedData;
    };

    const input = textMsg.trim();
    const inputUpper = input.toUpperCase();

    // ─────────────────────────────────────────────────────
    // FLUXO: IA ASSISTENTE DO PROFESSOR (Chat Próprio)
    // ─────────────────────────────────────────────────────
    if (isProfessorChat) {
      try {
        console.log(`[Chatbot] IA Assistente acionada pelo Professor ${phone}`);
        // Indica que está "digitando..." ou manda um status de espera (opcional)
        
        // Monta o contexto da escola (planilhas virtuais, dados, etc.)
        const userDataContext = await buildUserContext(db, professorUserId, profSettings.organizationId, true);
        const systemPrompt = getSystemPrompt(userDataContext) + 
          "\n\nIMPORTANTE: Você está respondendo ao Professor diretamente pelo WhatsApp. Responda de forma concisa e amigável. Não gere blocos ACTION ou SPREADSHEET pelo WhatsApp, pois eles não são renderizados no celular. Responda apenas em formato de texto estruturado.";

        const historyObj = sessionData.aiHistory || [];
        historyObj.push({ role: "user", content: input });
        
        // Limita o histórico para não estourar tokens
        if (historyObj.length > 10) historyObj.splice(0, historyObj.length - 10);

        const aiResponse = await callGemini(
          historyObj,
          systemPrompt,
          false,
          profSettings.geminiApiKey,
          profSettings.geminiModel
        );

        historyObj.push({ role: "assistant", content: aiResponse });
        
        // Atualiza estado com histórico
        await updateState("PROFESSOR_AI", { aiHistory: historyObj });

        // Envia resposta (com prefixo do robô para evitar loop no webhook)
        await sendReply(`🤖 ${aiResponse}`);
        
      } catch (error: any) {
        console.error("[WhatsApp AI Error]:", error);
        await sendReply("🤖 *Erro na IA:* Não consegui processar sua solicitação no momento. Verifique sua chave de API do Groq/Gemini nas configurações do site.");
      }
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // ESTADO: PAUSED_HUMAN — robô em silêncio
    // ─────────────────────────────────────────────────────
    if (session.state === "PAUSED_HUMAN") {
      if (inputUpper === "MENU") {
        await updateState("START");
        await sendReply("O atendimento automático foi reativado! 🤖\nDigite qualquer mensagem para continuar.");
      }
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // ESTADO: START — exibir menu conforme perfil do usuário
    // ─────────────────────────────────────────────────────
    if (session.state === "START") {
      if (student) {
        await updateState("MENU_ALUNO");
        await sendReply(
          `Olá, *${student.name.split(" ")[0]}*! 🎵 Que bom te ver aqui!\n\nEscolha uma opção:\n\n1️⃣ - 📅 Minhas Aulas\n2️⃣ - 💰 Financeiro\n3️⃣ - 📅 Agendar Aula\n4️⃣ - 🔄 Reagendar Aula\n5️⃣ - 🎸 Falar com o Professor\n6️⃣ - ⭐ Indicar um amigo`
        );
      } else {
        await updateState("MENU_NOVO");
        await sendReply(menuPrincipalNovoMsg(schoolName));
      }
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // MENU: ALUNO CADASTRADO
    // ─────────────────────────────────────────────────────
    if (session.state === "MENU_ALUNO") {
      if (!student) {
        await updateState("START");
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "1")) {
        // Ver próximas aulas
        const nextLessons = await db
          .select()
          .from(lessons)
          .where(
            and(
              eq(lessons.studentId, student.id),
              gte(lessons.scheduledAt, new Date()),
              eq(lessons.status, "agendada")
            )
          );

        if (nextLessons.length === 0) {
          await sendReply("Você não possui aulas agendadas no momento. 📅\n\nDigite *MENU* para voltar.");
        } else {
          let msg = `📅 *Suas próximas aulas:*\n\n`;
          nextLessons.slice(0, 5).forEach((l) => {
            const data = l.scheduledAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
            const hora = l.scheduledAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            msg += `🔹 *${data}* às *${hora}* (${l.duration} min)\n`;
          });
          msg += "\nDigite *MENU* para voltar.";
          await sendReply(msg);
        }
        await updateState("AGUARDANDO_MENU");
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "2")) {
        // Financeiro
        const pendingDues = await db
          .select()
          .from(paymentDues)
          .where(
            and(
              eq(paymentDues.studentId, student.id),
              eq(paymentDues.status, "pendente")
            )
          );

        if (pendingDues.length === 0) {
          await sendReply("✅ Parabéns! Você está em dia com seus pagamentos!\n\nDigite *MENU* para voltar.");
        } else {
          let msg = `💰 *Suas mensalidades em aberto:*\n\n`;
          pendingDues.slice(0, 5).forEach((p) => {
            const valor = parseFloat(String(p.amount)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const venc = new Date(p.dueDate + "T12:00:00").toLocaleDateString("pt-BR");
            msg += `🔸 *${valor}* — venc. ${venc}\n`;
            if (p.asaasPaymentLink) {
              msg += `   💳 Asaas: ${p.asaasPaymentLink}\n`;
            } else if (p.mpPaymentLink) {
              msg += `   💳 Mercado Pago: ${p.mpPaymentLink}\n`;
            }
          });
          msg += "\nDigite *MENU* para voltar ou *4* para falar com o professor.";
          await sendReply(msg);
        }
        await updateState("AGUARDANDO_MENU");
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "3")) {
        // Agendar Aula
        const slots = generateAvailableSlots(profSettings.schoolHours || "");
        const ocupadas = await db
          .select()
          .from(lessons)
          .where(
            and(
              eq(lessons.userId, professorUserId),
              gte(lessons.scheduledAt, new Date()),
              eq(lessons.status, "agendada")
            )
          );

        const freeSlots = slots
          .filter((s) => !ocupadas.some((l) => l.scheduledAt.getTime() === s.date.getTime()))
          .slice(0, 5);

        await updateState("AGENDAR_AULA_SLOT", { freeSlots });

        let msg = `Temos os seguintes horários disponíveis para agendamento:\n\n`;
        freeSlots.forEach((s, i) => {
          msg += `${i + 1}️⃣ - ${s.label}\n`;
        });
        msg += "\nDigite o *número* do horário desejado ou *MENU* para voltar.";
        await sendReply(msg);
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "4")) {
        // Reagendar Aula (lista próximas aulas)
        const nextLessons = await db
          .select()
          .from(lessons)
          .where(
            and(
              eq(lessons.studentId, student.id),
              gte(lessons.scheduledAt, new Date()),
              eq(lessons.status, "agendada")
            )
          )
          .limit(3);

        if (nextLessons.length === 0) {
          await sendReply("Você não possui aulas agendadas no momento para reagendar. 📅\n\nDigite *MENU* para voltar.");
          await updateState("AGUARDANDO_MENU");
        } else {
          let msg = `📅 *Qual aula você deseja reagendar?*\n\n`;
          nextLessons.forEach((l, i) => {
            const data = l.scheduledAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
            const hora = l.scheduledAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            msg += `${i + 1}️⃣ - ${data} às ${hora}\n`;
          });
          msg += "\nDigite o *número* da aula ou *MENU* para voltar.";
          await updateState("REAGENDAR_SELECIONAR_AULA", { nextLessons });
          await sendReply(msg);
        }
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "5")) {
        // Falar com professor
        await updateState("PAUSED_HUMAN");
        await sendReply("Certo! Estou te transferindo para o professor. Aguarde um instante! 👤\n\n_Para reativar o robô, digite MENU._");
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "6")) {
        // Indicar amigo
        await updateState("INDICAR_NOME");
        await sendReply("Que ótimo! Vamos registrar a sua indicação. 🌟\n\nDigite o *nome completo* do seu amigo que deseja indicar:");
        return res.status(200).json({ ok: true });
      }

      // Opção inválida
      await sendReply("Desculpe, não entendi. Digite o número da opção desejada:\n\n1️⃣ - 📅 Minhas Aulas\n2️⃣ - 💰 Financeiro\n3️⃣ - 📅 Agendar Aula\n4️⃣ - 🔄 Reagendar Aula\n5️⃣ - 🎸 Falar com o Professor\n6️⃣ - ⭐ Indicar um amigo");
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // MENU: NOVO USUÁRIO (NÃO CADASTRADO)
    // ─────────────────────────────────────────────────────
    if (session.state === "MENU_NOVO") {
      if (isOption(input, "1")) {
        // Quero me matricular
        await updateState("MATRICULA_NOME");
        await sendReply("Que incrível! Vamos começar sua matrícula. 🎉\n\nPrimeiro, me diga o seu *nome completo*:");
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "2")) {
        // Falar com equipe
        await updateState("PAUSED_HUMAN");
        await sendReply("Certo! Estou te transferindo para nossa equipe. Responderemos em breve! 👤\n\n_Para reativar o robô, digite MENU._");
        return res.status(200).json({ ok: true });
      }

      await sendReply(`Desculpe, não entendi. Digite o número da opção:\n\n1️⃣ - 🎵 Quero me matricular\n2️⃣ - 💬 Falar com nossa equipe`);
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // FLUXO: MATRÍCULA — Nome
    // ─────────────────────────────────────────────────────
    if (session.state === "MATRICULA_NOME") {
      const nome = input;
      if (nome.length < 3) {
        await sendReply("Por favor, insira seu nome completo.");
        return res.status(200).json({ ok: true });
      }

      const slots = generateAvailableSlots(profSettings.schoolHours || "");
      const ocupadas = await db
        .select()
        .from(lessons)
        .where(
          and(
            eq(lessons.userId, professorUserId),
            gte(lessons.scheduledAt, new Date()),
            eq(lessons.status, "agendada")
          )
        );

      const freeSlots = slots
        .filter((s) => !ocupadas.some((l) => l.scheduledAt.getTime() === s.date.getTime()))
        .slice(0, 5);

      await updateState("MATRICULA_SLOT", { matriculaNome: nome, freeSlots });

      let msg = `Prazer, *${nome}*! 😊\nTemos os seguintes horários disponíveis para a sua aula experimental:\n\n`;
      freeSlots.forEach((s, i) => {
        msg += `${i + 1}️⃣ - ${s.label}\n`;
      });
      msg += "\nDigite o *número* do horário desejado ou *0* para falar com nossa equipe.";
      await sendReply(msg);
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // FLUXO: MATRÍCULA — Escolher horário
    // ─────────────────────────────────────────────────────
    if (session.state === "MATRICULA_SLOT") {
      if (isOption(input, "0")) {
        await updateState("PAUSED_HUMAN");
        await sendReply("Transferindo para nossa equipe para vermos um horário! 👤\n\n_Para reativar o robô, digite MENU._");
        return res.status(200).json({ ok: true });
      }

      const currentData: any = {};
      try { Object.assign(currentData, JSON.parse(session.data || "{}")); } catch (_) {}

      const idx = parseInt(input) - 1;
      if (!isNaN(idx) && currentData.freeSlots && currentData.freeSlots[idx]) {
        const slot = currentData.freeSlots[idx];
        const nome = currentData.matriculaNome || "Novo Aluno";

        // Buscar orgId do professor
        const orgResult = await db
          .select({ organizationId: settings.organizationId })
          .from(settings)
          .where(eq(settings.userId, professorUserId))
          .limit(1);
        const orgId = orgResult[0]?.organizationId;

        await db.insert(lessons).values({
          organizationId: orgId,
          userId: professorUserId,
          isExperimental: true,
          experimentalName: nome,
          experimentalPhone: phone,
          title: `Aula Experimental - ${nome}`,
          scheduledAt: new Date(slot.date),
          duration: 60,
          status: "agendada",
          lessonType: "individual",
        });

        await notifyProfessor(`🎉 Um novo aluno chamado *${nome}* (${phone}) acabou de agendar uma aula experimental para *${slot.label}* pelo robô!`);

        await updateState("START", {});
        await sendReply(
          `Perfeito, *${nome}*! 🎉\nSua aula experimental foi agendada para *${slot.label}*.\n\nFicamos te esperando! Se precisar de qualquer coisa, pode mandar mensagem.\n\nDigite *MENU* para voltar ao início.`
        );
        return res.status(200).json({ ok: true });
      }

      await sendReply("Opção inválida. Por favor, digite o número correspondente ou *0* para falar com nossa equipe.");
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // FLUXO: INDICAÇÃO — Nome do amigo
    // ─────────────────────────────────────────────────────
    if (session.state === "INDICAR_NOME") {
      const nomeAmigo = input;
      if (nomeAmigo.length < 3) {
        await sendReply("Por favor, insira o nome completo do seu amigo.");
        return res.status(200).json({ ok: true });
      }

      await updateState("INDICAR_PHONE", { indicacaoNome: nomeAmigo });
      await sendReply(`Ótimo! E qual é o *número de WhatsApp* de *${nomeAmigo}*?\n\n_Ex: 11999998888_`);
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // FLUXO: AGENDAR AULA (Aluno)
    // ─────────────────────────────────────────────────────
    if (session.state === "AGENDAR_AULA_SLOT") {
      if (!student) {
        await updateState("START");
        return res.status(200).json({ ok: true });
      }

      if (inputUpper === "MENU") {
        await updateState("START");
        await sendReply("Voltando ao menu principal... 🎵");
        return res.status(200).json({ ok: true });
      }

      const currentData: any = {};
      try { Object.assign(currentData, JSON.parse(session.data || "{}")); } catch (_) {}

      const idx = parseInt(input) - 1;
      if (!isNaN(idx) && currentData.freeSlots && currentData.freeSlots[idx]) {
        const slot = currentData.freeSlots[idx];

        const orgResult = await db.select({ organizationId: settings.organizationId }).from(settings).where(eq(settings.userId, professorUserId)).limit(1);
        const orgId = orgResult[0]?.organizationId;

        await db.insert(lessons).values({
          organizationId: orgId,
          userId: professorUserId,
          studentId: student!.id,
          title: `Aula Avulsa - ${student!.name.split(" ")[0]}`,
          scheduledAt: new Date(slot.date),
          duration: 60,
          status: "agendada",
          lessonType: "individual",
        });

        await notifyProfessor(`O aluno *${student!.name}* acabou de agendar uma aula para *${slot.label}*.`);
        
        await updateState("START", {});
        await sendReply(`Perfeito! 🎉\nSua aula foi agendada para *${slot.label}*.\n\nDigite *MENU* para voltar ao início.`);
        return res.status(200).json({ ok: true });
      }

      await sendReply("Opção inválida. Digite o número correspondente ou *MENU* para voltar.");
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // FLUXO: REAGENDAR AULA (Aluno)
    // ─────────────────────────────────────────────────────
    if (session.state === "REAGENDAR_SELECIONAR_AULA") {
      if (!student) {
        await updateState("START");
        return res.status(200).json({ ok: true });
      }

      if (inputUpper === "MENU") {
        await updateState("START");
        await sendReply("Voltando ao menu principal... 🎵");
        return res.status(200).json({ ok: true });
      }

      const currentData: any = {};
      try { Object.assign(currentData, JSON.parse(session.data || "{}")); } catch (_) {}

      const idx = parseInt(input) - 1;
      if (!isNaN(idx) && currentData.nextLessons && currentData.nextLessons[idx]) {
        const selectedLesson = currentData.nextLessons[idx];
        
        const slots = generateAvailableSlots(profSettings.schoolHours || "");
        const ocupadas = await db
          .select()
          .from(lessons)
          .where(
            and(
              eq(lessons.userId, professorUserId),
              gte(lessons.scheduledAt, new Date()),
              eq(lessons.status, "agendada")
            )
          );

        const freeSlots = slots
          .filter((s) => !ocupadas.some((l) => l.scheduledAt.getTime() === s.date.getTime()))
          .slice(0, 5);

        await updateState("REAGENDAR_SLOT", { selectedLesson, freeSlots });

        let msg = `Certo. Para quando você deseja reagendar?\n\n`;
        freeSlots.forEach((s, i) => {
          msg += `${i + 1}️⃣ - ${s.label}\n`;
        });
        msg += "\nDigite o *número* do novo horário ou *MENU* para cancelar.";
        await sendReply(msg);
        return res.status(200).json({ ok: true });
      }

      await sendReply("Opção inválida. Digite o número da aula ou *MENU* para voltar.");
      return res.status(200).json({ ok: true });
    }

    if (session.state === "REAGENDAR_SLOT") {
      if (!student) {
        await updateState("START");
        return res.status(200).json({ ok: true });
      }

      if (inputUpper === "MENU") {
        await updateState("START");
        await sendReply("Voltando ao menu principal... 🎵");
        return res.status(200).json({ ok: true });
      }

      const currentData: any = {};
      try { Object.assign(currentData, JSON.parse(session.data || "{}")); } catch (_) {}

      const idx = parseInt(input) - 1;
      if (!isNaN(idx) && currentData.freeSlots && currentData.freeSlots[idx] && currentData.selectedLesson) {
        const slot = currentData.freeSlots[idx];
        const oldLesson = currentData.selectedLesson;

        await db.update(lessons)
          .set({
            scheduledAt: new Date(slot.date),
            updatedAt: new Date()
          })
          .where(eq(lessons.id, oldLesson.id));

        const oldData = new Date(oldLesson.scheduledAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const oldHora = new Date(oldLesson.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

        await notifyProfessor(`O aluno *${student!.name}* reagendou a aula do dia ${oldData} às ${oldHora} para o novo horário: *${slot.label}*.`);
        
        await updateState("START", {});
        await sendReply(`Aula reagendada com sucesso para *${slot.label}*! 🔄\n\nDigite *MENU* para voltar ao início.`);
        return res.status(200).json({ ok: true });
      }

      await sendReply("Opção inválida. Digite o número correspondente ou *MENU* para cancelar.");
      return res.status(200).json({ ok: true });
    }

    if (session.state === "INDICAR_PHONE") {
      const currentData: any = {};
      try { Object.assign(currentData, JSON.parse(session.data || "{}")); } catch (_) {}

      const nomeAmigo = currentData.indicacaoNome || "Amigo";
      const telAmigo = input.replace(/\D/g, "");
      const indicadorNome = student?.name || pushName;

      console.log(`[Chatbot] Indicação registrada: ${nomeAmigo} (${telAmigo}) indicado por ${indicadorNome} (${phone})`);

      await updateState("START", {});
      await sendReply(
        `Obrigado pela indicação! 🌟\nVamos entrar em contato com *${nomeAmigo}* em breve.\n\nVocê é incrível! 🎵\n\nDigite *MENU* para voltar ao início.`
      );
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // ESTADO: AGUARDANDO_MENU — espera o usuário digitar MENU
    // ─────────────────────────────────────────────────────
    if (session.state === "AGUARDANDO_MENU") {
      if (inputUpper === "MENU") {
        await updateState("START");
        await sendReply("Voltando ao menu principal... 🎵");
      } else {
        await sendReply("Digite *MENU* para voltar ao início.");
      }
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // Fallback — qualquer estado desconhecido volta ao START
    // ─────────────────────────────────────────────────────
    await updateState("START");
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("[WhatsApp Webhook] Erro:", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
