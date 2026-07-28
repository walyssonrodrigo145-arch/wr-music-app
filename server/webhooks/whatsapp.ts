import { Router } from "express";
import { getDb } from "../db";
import { students, chatbotSessions, lessons, settings, paymentDues, notifications, fcmTokens } from "../../drizzle/schema";
import { eq, and, gte, ilike } from "drizzle-orm";
import { sendWhatsAppMessage } from "../utils/whatsapp";
import { buildUserContext } from "../utils/aiContext";
import { getSystemPrompt } from "../utils/aiPrompts";
import { callGemini } from "../utils/gemini";
import { sendPushNotification } from "../firebaseAdmin";

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
    
    // Gera horários de hora em hora
    for (let h = startHour; h < endHour; h++) {
      if (added < 20) { // Limit total slots to process
        const slot = new Date(d);
        slot.setHours(h, 0, 0, 0);
        slots.push({ label: `${diaNome} (${diaMes}) às ${String(h).padStart(2, '0')}h00`, date: slot });
        added++;
      }
    }
  }

  return slots;
}

// ─── Helper para verificar sobreposição ──────────────────────────────────────
function isSlotFree(slotDate: Date, ocupadas: any[]) {
  const sStart = slotDate.getTime();
  const sEnd = sStart + 60 * 60 * 1000; // Aula padrão de 60 min
  
  return !ocupadas.some((l) => {
    const lStart = l.scheduledAt.getTime();
    const lEnd = lStart + (l.duration || 60) * 60 * 1000;
    // Sobreposição: Slot inicia antes da aula ocupada terminar E Slot termina depois da aula ocupada iniciar
    return (sStart < lEnd && sEnd > lStart);
  });
}

// ─── Menu Principal ───────────────────────────────────────────────────────────

function menuPrincipalMsg(schoolName: string, studentName: string): string {
  return `Oi, *${studentName}*! Que alegria te ver por aqui! 🎵😊\n\nComo posso te ajudar hoje na *${schoolName}*?\n\n1️⃣  📅  Minhas Aulas\n2️⃣  💰  Financeiro\n3️⃣  📆  Agendar uma Aula\n4️⃣  🔄  Reagendar Aula\n5️⃣  ⭐  Indicar um amigo\n0️⃣  🎸  Falar com o Professor\n9️⃣9️⃣ ❌  Encerrar Atendimento\n\n_Digite o número da opção desejada_ 👇`;
}

function menuPrincipalNovoMsg(schoolName: string): string {
  return `Olá! Seja muito bem-vindo(a) à *${schoolName}*! 🎶\n\nFicamos felizes com seu contato! Aqui você encontra as melhores aulas de música. 😊\n\nComo posso te ajudar?\n\n1️⃣  🎵  Quero me matricular\n2️⃣  💬  Falar com nossa equipe / Professor\n9️⃣9️⃣ ❌  Encerrar Atendimento\n\n_Só me diga o número e eu te ajudo! 👇_`;
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
        groqApiKey: settings.groqApiKey,
        groqModel: settings.groqModel,
        aiProvider: settings.aiProvider,
        pixKey: settings.pixKey,
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

    // ── Função auxiliar para notificar o professor (Push FCM + Sistema + WhatsApp) ──
    const notifyProfessor = async (msg: string, title?: string) => {
      const notifTitle = title || "🤖 Aviso do Robô WhatsApp";

      // 1. Inserir no painel do sistema (banco de dados)
      try {
        await db.insert(notifications).values({
          organizationId: profSettings.organizationId,
          userId: professorUserId,
          title: notifTitle,
          message: msg,
          type: "info",
          read: false,
          actionUrl: "/automacoes",
          createdAt: new Date(),
        });
      } catch (nErr) {
        console.error("[notifyProfessor] Erro ao salvar notificação no banco:", nErr);
      }

      // 2. Disparar notificação PUSH para o aparelho do professor (FCM)
      try {
        const tokens = await db
          .select({ token: fcmTokens.token })
          .from(fcmTokens)
          .where(eq(fcmTokens.userId, professorUserId));

        for (const { token } of tokens) {
          await sendPushNotification(
            token,
            notifTitle,
            msg.replace(/\*/g, ""),
            { url: "/automacoes" }
          );
        }
      } catch (fcmErr) {
        console.error("[notifyProfessor] Erro ao enviar Push FCM:", fcmErr);
      }

      // 3. Notificar via mensagem do WhatsApp
      if (!profSettings.phone) return;
      const result = await sendWhatsAppMessage({
        url: profSettings.whatsappBotUrl || undefined,
        token: profSettings.whatsappBotToken || undefined,
        phone: profSettings.phone,
        message: `🤖 *${notifTitle}:*\n\n${msg}`,
        sessionId: instanceName || "prof_1",
      });
      console.log(`[Chatbot] Notificação enviada ao professor (${profSettings.phone}): success=${result.success}`);
    };

    // ── Identificar aluno cadastrado (pelo telefone do aluno OU do responsável) ──
    const allStudents = await db
      .select()
      .from(students)
      .where(eq(students.professorId, professorUserId));

    const student = allStudents.find((s) => {
      const cleanMsg = phone.replace(/\D/g, "");
      if (!cleanMsg) return false;

      // 1. Telefone do aluno
      const cleanStudentPhone = s.phone ? s.phone.replace(/\D/g, "") : "";
      if (cleanStudentPhone) {
        // Compara com os últimos 8 e 9 dígitos (cobre variações com/sem DDD e com/sem 9º dígito)
        if (cleanStudentPhone.slice(-8) === cleanMsg.slice(-8)) return true;
        if (cleanStudentPhone.length >= 10 && cleanMsg.length >= 10 && cleanStudentPhone.slice(-10) === cleanMsg.slice(-10)) return true;
      }

      // 2. Telefone do responsável (pai / mãe)
      const cleanGuardianPhone = s.guardianPhone ? s.guardianPhone.replace(/\D/g, "") : "";
      if (cleanGuardianPhone) {
        if (cleanGuardianPhone.slice(-8) === cleanMsg.slice(-8)) return true;
        if (cleanGuardianPhone.length >= 10 && cleanMsg.length >= 10 && cleanGuardianPhone.slice(-10) === cleanMsg.slice(-10)) return true;
      }

      return false;
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
    // COMANDOS GLOBAIS: Falar com Professor (0) e Encerrar (99 / SAIR)
    // ─────────────────────────────────────────────────────
    if (session.state !== "PAUSED_HUMAN" && !isProfessorChat) {
      if (input === "0") {
        await updateState("PAUSED_HUMAN");
        await notifyProfessor(`👤 *Solicitação de Atendimento Humano!*\n\nContato *${student?.name || pushName}* (${phone}) solicitou falar com o professor pelo robô (opção 0).`);
        await sendReply("Claro! Chamei o professor para te atender. Aguarde um instante! 🎸👤\n\n_Quando quiser voltar ao robô automático no futuro, é só digitar *MENU*._");
        return res.status(200).json({ ok: true });
      }

      if (input === "99" || inputUpper === "SAIR" || inputUpper === "ENCERRAR" || inputUpper === "TCHAU") {
        await updateState("AGUARDANDO_MENU");
        await sendReply("Atendimento encerrado! 😊\n\nFoi um prazer falar com você. Se precisar de algo no futuro, é só mandar uma mensagem ou digitar *MENU*! 🎵👋");
        return res.status(200).json({ ok: true });
      }
    }

    // ─────────────────────────────────────────────────────
    // ESTADO: PAUSED_HUMAN — robô em silêncio
    // ─────────────────────────────────────────────────────
    if (session.state === "PAUSED_HUMAN") {
      if (inputUpper === "MENU") {
        await updateState("START");
        await sendReply("Estou de volta! 🤖✨\nPode falar comigo normalmente, estou aqui pra te ajudar!");
      }
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // ESTADO: START / MENU — exibir menu conforme perfil do usuário
    // ─────────────────────────────────────────────────────
    if (session.state === "START" || inputUpper === "MENU") {
      if (student) {
        await updateState("MENU_ALUNO");
        const primeiroNome = student.name.split(" ")[0];
        await sendReply(menuPrincipalMsg(schoolName, primeiroNome));
      } else {
        await updateState("MENU_NOVO");
        await sendReply(menuPrincipalNovoMsg(schoolName));
      }
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // PROCESSAMENTO AUTOMÁTICO DE COMPROVANTES DE PAGAMENTO (PIX/FOTO/PDF)
    // ─────────────────────────────────────────────────────
    const isReceiptContext =
      messageData.imageMessage ||
      messageData.documentMessage ||
      /comprovante|paguei|pix|transferencia|transferência|pagamento|deposito|depósito/i.test(textMsg);

    if (student && isReceiptContext && !payload.data.key?.fromMe) {
      const pendingDues = await db
        .select()
        .from(paymentDues)
        .where(
          and(
            eq(paymentDues.studentId, student.id),
            eq(paymentDues.status, "pendente")
          )
        );

      if (pendingDues.length > 0) {
        let targetDue = pendingDues[0];
        let extractedAmount: number | null = null;
        let isReceiptValid = false;

        const priceMatch = textMsg.match(/R\$\s?(\d+(?:[.,]\d{2})?)/i) || textMsg.match(/(\d+(?:[.,]\d{2})?)\s?(reais|brl)/i);
        if (priceMatch) {
          extractedAmount = parseFloat(priceMatch[1].replace(",", "."));
        }

        try {
          const aiAnalysis = await callGemini(
            [{ role: "user", content: `Mensagem com comprovante: "${textMsg}". O aluno tem mensalidade pendente de R$ ${targetDue.amount}.` }],
            "Você é um analisador financeiro. Determine se a mensagem indica um comprovante de pagamento de mensalidade. Responda APENAS em JSON: {\"isReceipt\": true, \"amount\": 150.00}",
            true,
            profSettings.aiProvider === 'groq' ? profSettings.groqApiKey : profSettings.geminiApiKey,
            profSettings.aiProvider === 'groq' ? profSettings.groqModel : profSettings.geminiModel
          );
          const cleanJsonStr = aiAnalysis.replace(/```json/gi, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleanJsonStr);
          if (parsed.isReceipt) {
            isReceiptValid = true;
            if (parsed.amount) extractedAmount = parsed.amount;
          }
        } catch (_) {
          if (messageData.imageMessage || messageData.documentMessage || /comprovante/i.test(textMsg)) {
            isReceiptValid = true;
          }
        }

        if (isReceiptValid) {
          if (extractedAmount) {
            const matched = pendingDues.find(d => Math.abs(parseFloat(String(d.amount)) - extractedAmount!) < 1.0);
            if (matched) targetDue = matched;
          }

          await db.update(paymentDues)
            .set({
              status: "pago",
              paidAt: new Date(),
              paymentMethod: "pix",
              updatedAt: new Date(),
            })
            .where(eq(paymentDues.id, targetDue.id));

          const formattedValue = parseFloat(String(targetDue.amount)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const formattedDueDate = new Date(targetDue.dueDate + "T12:00:00").toLocaleDateString("pt-BR");

          await notifyProfessor(
            `✅ *Baixa Automática de Mensalidade!*\n\n👤 *Aluno:* ${student.name}\n💰 *Valor:* ${formattedValue}\n📅 *Vencimento:* ${formattedDueDate}\n📱 *Comprovante recebido via WhatsApp*`,
            "💳 Comprovante Recebido e Baixado"
          );

          await updateState("AGUARDANDO_MENU");
          await sendReply(
            `✅ *Comprovante recebido com sucesso!*\n\nConfirmamos a baixa da sua mensalidade no valor de *${formattedValue}* (vencimento: ${formattedDueDate}) no nosso sistema! 🎵🌟\n\nMuito obrigado pelo pagamento! Digite *MENU* se precisar de mais alguma coisa. 😊`
          );
          return res.status(200).json({ ok: true });
        }
      }
    }

    // ─────────────────────────────────────────────────────
    // FLUXO: IA ASSISTENTE DO PROFESSOR (Chat Próprio)
    // ─────────────────────────────────────────────────────
    if (isProfessorChat) {
      try {
        console.log(`[Chatbot] IA Assistente acionada pelo Professor ${phone}`);
        // Indica que está "digitando..." ou manda um status de espera (opcional)
        
        // Monta o contexto da escola (planilhas virtuais, dados, etc.)
        const userDataContext = await buildUserContext(db, professorUserId, profSettings.organizationId || 1, true);
        const systemPrompt = getSystemPrompt(userDataContext) + 
          "\n\nIMPORTANTE: Você está respondendo ao Professor diretamente pelo WhatsApp. Responda de forma clara, amigável e concisa. Você pode usar blocos ACTION como ACTION:CREATE_LESSON e ACTION:CREATE_STUDENT para realizar agendamentos de aulas e cadastros de alunos diretamente pelo WhatsApp! Não use o bloco SPREADSHEET no WhatsApp.";

        const historyObj = sessionData.aiHistory || [];
        historyObj.push({ role: "user", content: input });
        
        // Limita o histórico para não estourar tokens
        if (historyObj.length > 10) historyObj.splice(0, historyObj.length - 10);

        const apiKey = profSettings.aiProvider === 'groq' ? profSettings.groqApiKey : profSettings.geminiApiKey;
        const model = profSettings.aiProvider === 'groq' ? profSettings.groqModel : profSettings.geminiModel;

        const aiResponseRaw = await callGemini(
          historyObj,
          systemPrompt,
          false,
          apiKey,
          model
        );

        let finalResponseContent = aiResponseRaw;

        // ── Executar ações de agendamento enviadas via WhatsApp ──
        const LESSON_ACTION_REGEX = /<!--ACTION:CREATE_LESSON\s+(\{[\s\S]*?\})-->/g;
        let lessonMatch;
        while ((lessonMatch = LESSON_ACTION_REGEX.exec(aiResponseRaw)) !== null) {
          const blockStr = lessonMatch[0];
          const jsonStr = lessonMatch[1];
          try {
            const lessonData = JSON.parse(jsonStr);
            let targetStudentId: number | null = null;
            if (lessonData.studentName) {
              const whereConds = [ilike(students.name, `%${lessonData.studentName}%`)];
              if (profSettings.organizationId) whereConds.push(eq(students.organizationId, profSettings.organizationId));
              const [foundStudent] = await db.select({ id: students.id })
                .from(students)
                .where(and(...whereConds))
                .limit(1);
              if (foundStudent) targetStudentId = foundStudent.id;
            }

            const scheduledDate = lessonData.scheduledAt ? new Date(lessonData.scheduledAt) : new Date();

            await db.insert(lessons).values({
              organizationId: profSettings.organizationId,
              userId: professorUserId,
              studentId: targetStudentId,
              title: lessonData.title || `Aula - ${lessonData.studentName || 'Aluno'}`,
              scheduledAt: scheduledDate,
              duration: lessonData.duration || 60,
              isExperimental: !!lessonData.isExperimental,
              experimentalName: lessonData.experimentalName || null,
              lessonType: lessonData.lessonType || (lessonData.isExperimental ? "experimental" : "individual"),
              status: "agendada",
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            const formattedScheduled = scheduledDate.toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short',
              timeZone: 'America/Sao_Paulo'
            });

            const confirmMsg = `\n\n✅ *Aula agendada com sucesso!*\n📌 *Título:* ${lessonData.title}\n📅 *Data/Hora:* ${formattedScheduled}\n⏱️ *Duração:* ${lessonData.duration || 60} min`;
            finalResponseContent = finalResponseContent.replace(blockStr, confirmMsg);
          } catch (parseErr) {
            console.error("[WhatsApp AI ACTION:CREATE_LESSON] Erro:", parseErr);
            finalResponseContent = finalResponseContent.replace(blockStr, "\n\n⚠️ Erro ao registrar o agendamento da aula.");
          }
        }

        // ── Executar ações de cadastro enviadas via WhatsApp ──
        const STUDENT_ACTION_REGEX = /<!--ACTION:CREATE_STUDENT\s+(\{[\s\S]*?\})-->/g;
        let studentMatch;
        while ((studentMatch = STUDENT_ACTION_REGEX.exec(aiResponseRaw)) !== null) {
          const blockStr = studentMatch[0];
          const jsonStr = studentMatch[1];
          try {
            const actionData = JSON.parse(jsonStr);
            await db.insert(students).values({
              organizationId: profSettings.organizationId,
              professorId: professorUserId,
              userId: professorUserId,
              name: actionData.name,
              phone: actionData.phone || "",
              email: actionData.email || null,
              birthDate: actionData.birthDate || null,
              guardianName: actionData.guardianName || null,
              guardianPhone: actionData.guardianPhone || null,
              guardianEmail: null,
              level: actionData.level || "iniciante",
              monthlyFee: String(actionData.monthlyFee ?? 0),
              dueDay: actionData.dueDay ?? 15,
              lessonType: "individual",
              status: "ativo",
              startDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
              notes: actionData.notes || null,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            const confirmMsg = `\n\n✅ *Aluno cadastrado com sucesso:* ${actionData.name}`;
            finalResponseContent = finalResponseContent.replace(blockStr, confirmMsg);
          } catch (parseErr) {
            console.error("[WhatsApp AI ACTION:CREATE_STUDENT] Erro:", parseErr);
            finalResponseContent = finalResponseContent.replace(blockStr, "\n\n⚠️ Erro ao cadastrar o aluno.");
          }
        }

        historyObj.push({ role: "assistant", content: finalResponseContent });
        
        // Atualiza estado com histórico
        await updateState("PROFESSOR_AI", { aiHistory: historyObj });

        // Envia resposta (com prefixo do robô para evitar loop no webhook)
        await sendReply(`🤖 ${finalResponseContent}`);
        
      } catch (error: any) {
        console.error("[WhatsApp AI Error]:", error);
        await sendReply("🤖 *Erro na IA:* Não consegui processar sua solicitação no momento. Verifique sua chave de API do Groq/Gemini nas configurações do site.");
      }
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // COMANDOS GLOBAIS: Falar com Professor (0) e Encerrar (99 / SAIR)
    // ─────────────────────────────────────────────────────
    if (session.state !== "PAUSED_HUMAN" && !isProfessorChat) {
      if (input === "0") {
        await updateState("PAUSED_HUMAN");
        await notifyProfessor(`👤 *Solicitação de Atendimento Humano!*\n\nContato *${student?.name || pushName}* (${phone}) solicitou falar com o professor pelo robô (opção 0).`);
        await sendReply("Claro! Chamei o professor para te atender. Aguarde um instante! 🎸👤\n\n_Quando quiser voltar ao robô automático no futuro, é só digitar *MENU*._", false);
        return res.status(200).json({ ok: true });
      }

      if (input === "99" || inputUpper === "SAIR" || inputUpper === "ENCERRAR" || inputUpper === "TCHAU") {
        await updateState("AGUARDANDO_MENU");
        await sendReply("Atendimento encerrado! 😊\n\nFoi um prazer falar com você. Se precisar de algo no futuro, é só mandar uma mensagem ou digitar *MENU*! 🎵👋", false);
        return res.status(200).json({ ok: true });
      }
    }

    // ─────────────────────────────────────────────────────
    // ESTADO: PAUSED_HUMAN — robô em silêncio
    // ─────────────────────────────────────────────────────
    if (session.state === "PAUSED_HUMAN") {
      if (inputUpper === "MENU") {
        await updateState("START");
        await sendReply("Estou de volta! 🤖✨\nPode falar comigo normalmente, estou aqui pra te ajudar!");
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
          `Oi, *${student.name.split(" ")[0]}*! Que alegria te ver por aqui! 🎵😊\n\nO que posso fazer por você hoje?\n\n1️⃣  📅  Minhas Aulas\n2️⃣  💰  Financeiro\n3️⃣  📆  Agendar uma Aula\n4️⃣  🔄  Reagendar Aula\n5️⃣  🎸  Falar com o Professor\n6️⃣  ⭐  Indicar um amigo\n\n_Digite o número da opção_ 👇`
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
          await sendReply("Hmm, parece que você não tem nenhuma aula agendada por enquanto. 📅\n\nSe quiser marcar uma, é só digitar *MENU* e escolher a opção 3! 😊");
        } else {
          let msg = `📅 *Suas próximas aulas:*\n━━━━━━━━━━━━━━━━━━\n`;
          nextLessons.slice(0, 5).forEach((l) => {
            const data = l.scheduledAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
            const hora = l.scheduledAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            msg += `🎵 *${data}* às *${hora}* — ${l.duration} min\n`;
          });
          msg += `━━━━━━━━━━━━━━━━━━\n\nTe esperamos! 😊 Digite *MENU* para voltar.`;
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
          await sendReply("✅ *Que ótima notícia!*\nVocê está em dia com seus pagamentos. Continue assim! 🌟\n\nDigite *MENU* para voltar.");
        } else {
          let msg = `💰 *Mensalidades em aberto:*\n━━━━━━━━━━━━━━━━━━\n`;
          pendingDues.slice(0, 5).forEach((p) => {
            const valor = parseFloat(String(p.amount)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const venc = new Date(p.dueDate + "T12:00:00").toLocaleDateString("pt-BR");
            msg += `🔸 *${valor}* — vence em ${venc}\n`;
            if (p.asaasPaymentLink) {
              msg += `   💳 Pague aqui: ${p.asaasPaymentLink}\n`;
            } else if (p.mpPaymentLink) {
              msg += `   💳 Pague aqui: ${p.mpPaymentLink}\n`;
            }
          });
          if (profSettings.pixKey) {
            msg += `\n🔑 *Chave PIX para pagamento:* ${profSettings.pixKey}\n`;
          }
          msg += `━━━━━━━━━━━━━━━━━━\n\nQualquer dúvida, é só falar! Digite *MENU* para voltar ou *5* para falar com o professor.`;
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
          .filter((s) => isSlotFree(s.date, ocupadas))
          .slice(0, 5);

        await updateState("AGENDAR_AULA_SLOT", { freeSlots });

        if (freeSlots.length === 0) {
          await sendReply("Hmm, parece que não temos horários disponíveis nos próximos dias. 😕\n\nEntre em contato com o professor para verificar uma data! Digite *MENU* para voltar.");
          return res.status(200).json({ ok: true });
        }

        let msg = `📆 *Horários disponíveis:*\n━━━━━━━━━━━━━━━━━━\n`;
        freeSlots.forEach((s, i) => {
          msg += `${i + 1}️⃣  ${s.label}\n`;
        });
        msg += `━━━━━━━━━━━━━━━━━━\n\nDigite o *número* do horário que preferir, ou *MENU* para voltar. 😊`;
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
          await sendReply("Você não tem nenhuma aula agendada para reagendar no momento. 📅\n\nQuer marcar uma nova? É só digitar *MENU* e escolher a opção 3! 😊");
          await updateState("AGUARDANDO_MENU");
        } else {
          let msg = `🔄 *Qual aula você quer reagendar?*\n━━━━━━━━━━━━━━━━━━\n`;
          nextLessons.forEach((l, i) => {
            const data = l.scheduledAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
            const hora = l.scheduledAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
            msg += `${i + 1}️⃣  ${data} às ${hora}\n`;
          });
          msg += `━━━━━━━━━━━━━━━━━━\n\nDigite o *número* da aula ou *MENU* para voltar.`;
          await updateState("REAGENDAR_SELECIONAR_AULA", { nextLessons });
          await sendReply(msg);
        }
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "5")) {
        // Falar com professor
        await updateState("PAUSED_HUMAN");
        await notifyProfessor(`👤 *Solicitação de Atendimento Humano!*\n\nO aluno *${student?.name || pushName}* (${phone}) solicitou falar com você no WhatsApp.`);
        await sendReply("Claro! Vou chamar o professor pra você agora. Aguarda um instante! 🎸👤\n\n_Quando quiser voltar ao menu automático, é só digitar *MENU*._");
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "6")) {
        // Indicar amigo
        await updateState("INDICAR_NOME");
        await sendReply("Que demais! Sua indicação é muito especial pra gente! 🌟🎶\n\nMe diz o *nome completo* do seu amigo que quer indicar:");
        return res.status(200).json({ ok: true });
      }

      // Opção inválida
      await sendReply("Não entendi essa opção, desculpa! 😅\n\nDigita só o *número* da opção que você quer:\n\n1️⃣  📅  Minhas Aulas\n2️⃣  💰  Financeiro\n3️⃣  📆  Agendar uma Aula\n4️⃣  🔄  Reagendar Aula\n5️⃣  🎸  Falar com o Professor\n6️⃣  ⭐  Indicar um amigo");
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // MENU: NOVO USUÁRIO (NÃO CADASTRADO)
    // ─────────────────────────────────────────────────────
    if (session.state === "MENU_NOVO") {
      if (isOption(input, "1")) {
        // Quero me matricular
        await updateState("MATRICULA_NOME");
        await sendReply("Que notícia incrível! Fico feliz que você quer aprender música com a gente! 🎉🎵\n\nPra começar, me conta: qual é o seu *nome completo*?");
        return res.status(200).json({ ok: true });
      }

      if (isOption(input, "2")) {
        // Falar com equipe
        await updateState("PAUSED_HUMAN");
        await notifyProfessor(`👤 *Novo Cliente Aguardando Atendimento!*\n\nContato (${phone}) solicitou falar com a equipe no WhatsApp.`);
        await sendReply("Perfeito! Já estou chamando nossa equipe pra te atender. Aguarda um pouquinho! 👤😊\n\n_Se quiser voltar ao menu automático depois, é só digitar *MENU*._");
        return res.status(200).json({ ok: true });
      }

      await sendReply(`Hmm, não entendi! 😅 Digita só o número da opção:\n\n1️⃣  🎵  Quero me matricular\n2️⃣  💬  Falar com nossa equipe`);
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // FLUXO: MATRÍCULA — Nome
    // ─────────────────────────────────────────────────────
    if (session.state === "MATRICULA_NOME") {
      const nome = input;
      if (nome.length < 3) {
        await sendReply("Pode me dizer seu nome completo? Preciso dele para fazer seu cadastro! 😊");
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
        .filter((s) => isSlotFree(s.date, ocupadas))
        .slice(0, 5);

      await updateState("MATRICULA_SLOT", { matriculaNome: nome, freeSlots });

      if (freeSlots.length === 0) {
        await sendReply(`Prazer, *${nome}*! 😊\n\nInfelizmente não temos horários disponíveis nos próximos dias.\nMas não se preocupe! Nossa equipe vai te ajudar a encontrar o horário ideal. Digite *0* pra falar com a gente!`);
        return res.status(200).json({ ok: true });
      }

      let msg = `Prazer, *${nome}*! 😄🎶\n\nQue ótimo que você quer fazer uma aula experimental! Confere os horários disponíveis:\n\n━━━━━━━━━━━━━━━━━━\n`;
      freeSlots.forEach((s, i) => {
        msg += `${i + 1}️⃣  ${s.label}\n`;
      });
      msg += `━━━━━━━━━━━━━━━━━━\n\nDigita o *número* do horário que ficou melhor pra você, ou *0* se preferir falar com a nossa equipe. 😊`;
      await sendReply(msg);
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // FLUXO: MATRÍCULA — Escolher horário
    // ─────────────────────────────────────────────────────
    if (session.state === "MATRICULA_SLOT") {
      if (isOption(input, "0")) {
        await updateState("PAUSED_HUMAN");
        await sendReply("Sem problema! Vou chamar alguém da nossa equipe pra te ajudar a encontrar o melhor horário. Aguarda! 👤😊\n\n_Para reativar o menu automático, é só digitar *MENU*._");
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

        await notifyProfessor(`🎉 *Novo Agendamento Experimental!*\n\n👤 *${nome}*\n📱 ${phone}\n📅 *${slot.label}*\n\nEle(a) agendou pelo robô e está esperando por você! 🎵`);

        await updateState("START", {});
        await sendReply(
          `Tudo certo, *${nome}*! 🎉🎶\n\nSua *aula experimental* está confirmada para *${slot.label}*.\n\nEstamos ansiosos pra te conhecer pessoalmente! Se tiver qualquer dúvida antes da aula, pode mandar mensagem aqui mesmo. 😊\n\nAté lá! 👋`
        );
        return res.status(200).json({ ok: true });
      }

      await sendReply("Hmm, não reconheci essa opção. 😅 Digita o *número* do horário ou *0* pra falar com a equipe.");
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // FLUXO: INDICAÇÃO — Nome do amigo
    // ─────────────────────────────────────────────────────
    if (session.state === "INDICAR_NOME") {
      const nomeAmigo = input;
      if (nomeAmigo.length < 3) {
        await sendReply("Pode me dizer o nome completo do seu amigo? 😊");
        return res.status(200).json({ ok: true });
      }

      await updateState("INDICAR_PHONE", { indicacaoNome: nomeAmigo });
      await sendReply(`Ótimo! E qual é o número de *WhatsApp* de *${nomeAmigo}*? 📱\n\n_Ex: 33999998888 (com DDD)_`);
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
        await sendReply("Voltando ao menu! 🎵 Pode escolher uma opção abaixo...");
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

        await notifyProfessor(`📅 *Novo Agendamento!*\n\n👤 *${student!.name}* acabou de marcar uma aula para *${slot.label}*. Tudo certo no sistema! 🎵`);
        
        await updateState("START", {});
        await sendReply(`Aula marcada com sucesso! 🎉\n\n📅 *${slot.label}*\n\nTe esperamos! Se precisar de algo, é só chamar. 😊 Digite *MENU* para voltar ao início.`);
        return res.status(200).json({ ok: true });
      }

      await sendReply("Hmm, não reconheci essa opção. 😅 Digita o *número* do horário ou *MENU* para voltar.");
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
        await sendReply("Voltando ao menu! 🎵 Pode escolher uma opção abaixo...");
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
          .filter((s) => isSlotFree(s.date, ocupadas))
          .slice(0, 5);

        await updateState("REAGENDAR_SLOT", { selectedLesson, freeSlots });

        let msg = `📆 *Para quando você quer reagendar?*\n━━━━━━━━━━━━━━━━━━\n`;
        freeSlots.forEach((s, i) => {
          msg += `${i + 1}️⃣  ${s.label}\n`;
        });
        msg += `━━━━━━━━━━━━━━━━━━\n\nDigita o *número* do novo horário ou *MENU* pra cancelar.`;
        await sendReply(msg);
        return res.status(200).json({ ok: true });
      }

      await sendReply("Não entendi a opção. 😅 Digita o número da aula que quer reagendar ou *MENU* para voltar.");
      return res.status(200).json({ ok: true });
    }

    if (session.state === "REAGENDAR_SLOT") {
      if (!student) {
        await updateState("START");
        return res.status(200).json({ ok: true });
      }

      if (inputUpper === "MENU") {
        await updateState("START");
        await sendReply("Voltando ao menu! 🎵 Pode escolher uma opção abaixo...");
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

        await notifyProfessor(`🔄 *Reagendamento!*\n\n👤 *${student!.name}* reagendou a aula de ${oldData} às ${oldHora} para *${slot.label}*. 📅`);
        
        await updateState("START", {});
        await sendReply(`Prontinho! Aula reagendada com sucesso! 🔄🎉\n\n📅 *Novo horário: ${slot.label}*\n\nQualquer dúvida é só chamar. Digite *MENU* para voltar ao início.`);
        return res.status(200).json({ ok: true });
      }

      await sendReply("Hmm, não reconheci essa opção. 😅 Digita o *número* do horário ou *MENU* para cancelar.");
      return res.status(200).json({ ok: true });
    }

    if (session.state === "INDICAR_PHONE") {
      const currentData: any = {};
      try { Object.assign(currentData, JSON.parse(session.data || "{}")); } catch (_) {}

      const nomeAmigo = currentData.indicacaoNome || "Amigo";
      const telAmigo = input.replace(/\D/g, "");
      const indicadorNome = student?.name || pushName;

      console.log(`[Chatbot] Indicação registrada: ${nomeAmigo} (${telAmigo}) indicado por ${indicadorNome} (${phone})`);

      await notifyProfessor(`⭐ *Nova Indicação de Amigo Recebida!*\n\n👤 *Indicado por:* ${indicadorNome} (${phone})\n🌟 *Nome do amigo:* ${nomeAmigo}\n📱 *WhatsApp do amigo:* ${telAmigo || input}\n\nEntre em contato para oferecer uma aula experimental! 🎵`);

      await updateState("START", {});
      await sendReply(
        `Registrado! Muito obrigado pela indicação! 🌟🎵\n\nVamos entrar em contato com *${nomeAmigo}* em breve e contar que foi você quem nos indicou. Você é demais! 🙌\n\nDigite *MENU* para voltar ao início.`
      );
      return res.status(200).json({ ok: true });
    }

    // ─────────────────────────────────────────────────────
    // ESTADO: AGUARDANDO_MENU — espera o usuário digitar MENU
    // ─────────────────────────────────────────────────────
    if (session.state === "AGUARDANDO_MENU") {
      if (inputUpper === "MENU") {
        if (student) {
          await updateState("MENU_ALUNO");
          const primeiroNome = student.name.split(" ")[0];
          await sendReply(menuPrincipalMsg(schoolName, primeiroNome));
        } else {
          await updateState("MENU_NOVO");
          await sendReply(menuPrincipalNovoMsg(schoolName));
        }
      } else {
        await sendReply("Quando quiser, é só digitar *MENU* pra voltar ao início. 😊");
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
