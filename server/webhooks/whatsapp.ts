import { Router } from "express";
import { getDb } from "../db";
import { students, chatbotSessions, lessons, settings } from "../../drizzle/schema";
import { eq, or, and, gte, lt } from "drizzle-orm";
import { sendWhatsAppMessage } from "../utils/whatsapp";

const router = Router();

// Extrai o texto da mensagem do payload do Baileys/Evolution
function extractMessageText(messageObj: any): string {
  if (!messageObj) return "";
  if (messageObj.conversation) return messageObj.conversation;
  if (messageObj.extendedTextMessage?.text) return messageObj.extendedTextMessage.text;
  if (messageObj.imageMessage?.caption) return messageObj.imageMessage.caption;
  return "";
}

// Verifica se o texto é o número de uma opção
function isOption(text: string, option: string): boolean {
  return text.trim() === option;
}

// Retorna horários disponíveis hardcoded (para o plano) baseados no dia atual
// O robô vai verificar os próximos 3 dias úteis às 10:00, 14:00 e 16:00
function generateAvailableSlots() {
  const slots: { label: string; date: Date }[] = [];
  const daysToAdd = [1, 2, 3]; // próximos 3 dias
  
  for (const add of daysToAdd) {
    const d = new Date();
    d.setDate(d.getDate() + add);
    // Pula finais de semana
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Domingo -> Segunda
    if (d.getDay() === 6) d.setDate(d.getDate() + 2); // Sábado -> Segunda

    const baseDate = new Date(d);
    baseDate.setMinutes(0, 0, 0);

    const hours = [10, 14, 16];
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const diaNome = diasSemana[baseDate.getDay()];
    const diaMes = `${String(baseDate.getDate()).padStart(2, '0')}/${String(baseDate.getMonth() + 1).padStart(2, '0')}`;

    for (const h of hours) {
      const slotDate = new Date(baseDate);
      slotDate.setHours(h);
      slots.push({
        label: `${diaNome} (${diaMes}) às ${h}h00`,
        date: slotDate
      });
    }
  }
  return slots;
}

router.post("/", async (req, res) => {
  try {
    const payload = req.body;
    
    // Ignora eventos que não sejam de mensagens novas
    if (payload?.event !== "messages.upsert") {
      return res.status(200).json({ ok: true });
    }

    const messageData = payload.data?.message;
    if (!messageData) return res.status(200).json({ ok: true });

    // Evolution API manda como payload.data no formato Baileys
    // Verifica se fomos nós que enviamos (fromMe)
    if (payload.data.key?.fromMe) {
      return res.status(200).json({ ok: true });
    }

    const remoteJid = payload.data.key?.remoteJid || "";
    if (!remoteJid || remoteJid.includes("@g.us")) {
      // Ignora mensagens de grupos
      return res.status(200).json({ ok: true });
    }

    const phone = remoteJid.split("@")[0]; // ex: 5511999999999
    const textMsg = extractMessageText(messageData.message);
    const pushName = payload.data.pushName || "Estudante";

    if (!textMsg) {
      return res.status(200).json({ ok: true });
    }

    console.log(`[Chatbot] Recebeu mensagem de ${phone}: ${textMsg}`);

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "DB offline" });
    }

    // Identificar a qual professor pertence o número do WhatsApp que recebeu a mensagem
    // O sessionId da Evolution API é criado como "prof_X" (onde X é o userId do professor)
    let professorUserId = 1; // Fallback para o primeiro professor
    const instanceName = payload.instance || ""; // ex: "prof_1"
    if (instanceName.startsWith("prof_")) {
      const parsedId = parseInt(instanceName.split("_")[1], 10);
      if (!isNaN(parsedId)) {
        professorUserId = parsedId;
      }
    }

    // 1. Identificar se é aluno cadastrado DESTE PROFESSOR especificamente
    const matchedStudents = await db.select().from(students).where(eq(students.professorId, professorUserId));
    const student = matchedStudents.find(s => {
      const cleanDbPhone = s.phone.replace(/\D/g, "");
      // Comparar os 8-9 ultimos digitos para contornar problemas com o 9 a mais
      const suffixDb = cleanDbPhone.slice(-8);
      const suffixMsg = phone.slice(-8);
      return suffixDb === suffixMsg;
    });

    // 2. Recuperar ou criar Sessão do Chatbot
    let [session] = await db.select().from(chatbotSessions).where(eq(chatbotSessions.phone, phone));
    
    // Tratamento para multi-professores: Se o aluno já tinha sessão mas mudou de professor (falou com outro número),
    // nós resetamos o estado da sessão dele para o início para não misturar as conversas.
    let sessionData: any = {};
    if (session && session.data) {
      try {
        sessionData = JSON.parse(session.data);
      } catch (e) {}
    }

    if (session && sessionData.activeProfessorId && sessionData.activeProfessorId !== professorUserId) {
      sessionData = { activeProfessorId: professorUserId };
      await db.update(chatbotSessions).set({
        state: "START",
        data: JSON.stringify(sessionData),
        updatedAt: new Date()
      }).where(eq(chatbotSessions.id, session.id));

      session.state = "START";
      session.data = JSON.stringify(sessionData);
    }

    if (!session) {
      sessionData = { activeProfessorId: professorUserId };
      [session] = await db.insert(chatbotSessions).values({
        phone,
        state: "START",
        data: JSON.stringify(sessionData)
      }).returning();
    }

    // Função auxiliar para enviar resposta usando a instância do respectivo professor
    const sendReply = async (msg: string) => {
      await sendWhatsAppMessage({
        phone,
        message: msg,
        sessionId: instanceName || "prof_1"
      });
    };

    // Lógica do Chatbot Baseada no Estado
    
    // --- USUÁRIO PEDIU PARA FALAR COM HUMANO OU ESTÁ PAUSADO ---
    if (session.state === "PAUSED_HUMAN") {
      // O bot fica em silêncio. Para religar, se o user mandar "MENU"
      if (textMsg.toUpperCase().trim() === "MENU") {
        await db.update(chatbotSessions).set({ 
          state: "START", 
          data: JSON.stringify({ activeProfessorId: professorUserId }),
          updatedAt: new Date() 
        }).where(eq(chatbotSessions.id, session.id));
        await sendReply("O atendimento robótico foi reativado! 🤖");
        session.state = "START";
      } else {
        return res.status(200).json({ ok: true });
      }
    }

    // --- ALUNO CADASTRADO DO PROFESSOR ---
    if (student) {
      if (session.state === "START" || session.state === "STUDENT_MENU") {
        if (session.state === "START") {
          await db.update(chatbotSessions).set({ 
            state: "STUDENT_MENU", 
            data: JSON.stringify({ activeProfessorId: professorUserId }),
            updatedAt: new Date() 
          }).where(eq(chatbotSessions.id, session.id));
          await sendReply(`Olá, ${student.name.split(' ')[0]}! 🎵\nBem-vindo ao autoatendimento.\n\nEscolha uma opção digitando o número:\n1️⃣ - Minhas próximas aulas\n2️⃣ - Falar com o professor`);
          return res.status(200).json({ ok: true });
        }

        if (isOption(textMsg, "1")) {
          // Busca próximas aulas deste aluno
          const nextLessons = await db.select().from(lessons).where(
            and(
              eq(lessons.studentId, student.id),
              gte(lessons.scheduledAt, new Date()),
              eq(lessons.status, "agendada")
            )
          );

          if (nextLessons.length === 0) {
            await sendReply("Você não possui aulas agendadas no momento. 📅\n\nDigite MENU para voltar.");
          } else {
            let msg = "📅 *Suas próximas aulas:*\n\n";
            nextLessons.slice(0, 3).forEach(l => {
              const data = l.scheduledAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
              const hora = l.scheduledAt.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit', timeZone: "America/Sao_Paulo" });
              msg += `🔹 *${data}* às *${hora}* (${l.duration} min)\n`;
            });
            msg += "\nDigite MENU para voltar.";
            await sendReply(msg);
          }
          await db.update(chatbotSessions).set({ 
            state: "STUDENT_VIEW", 
            data: JSON.stringify({ activeProfessorId: professorUserId }),
            updatedAt: new Date() 
          }).where(eq(chatbotSessions.id, session.id));
          return res.status(200).json({ ok: true });
        }
        else if (isOption(textMsg, "2")) {
          await db.update(chatbotSessions).set({ 
            state: "PAUSED_HUMAN", 
            data: JSON.stringify({ activeProfessorId: professorUserId }),
            updatedAt: new Date() 
          }).where(eq(chatbotSessions.id, session.id));
          await sendReply("Certo! Estou transferindo você para o professor. Aguarde um instante que logo você será atendido. 👤");
          return res.status(200).json({ ok: true });
        }
        else {
          await sendReply("Desculpe, não entendi. Digite *1* para suas aulas ou *2* para falar com o professor.");
          return res.status(200).json({ ok: true });
        }
      }

      if (session.state === "STUDENT_VIEW") {
        if (textMsg.toUpperCase().trim() === "MENU") {
          await db.update(chatbotSessions).set({ 
            state: "START", 
            data: JSON.stringify({ activeProfessorId: professorUserId }),
            updatedAt: new Date() 
          }).where(eq(chatbotSessions.id, session.id));
          await sendReply("Voltando ao menu principal...");
        }
        return res.status(200).json({ ok: true });
      }
    } 
    
    // --- NOVO ALUNO (NÃO CADASTRADO NESTE PROFESSOR) ---
    else {
      if (session.state === "START" || session.state === "NEW_USER_MENU") {
        if (session.state === "START") {
          await db.update(chatbotSessions).set({ 
            state: "NEW_USER_MENU", 
            data: JSON.stringify({ activeProfessorId: professorUserId }),
            updatedAt: new Date() 
          }).where(eq(chatbotSessions.id, session.id));
          await sendReply(`Olá! Bem-vindo(a) à nossa Escola de Música! 🎵\nSomos especialistas em ensino musical e estamos prontos para te ajudar a realizar seu sonho.\n\nComo posso te ajudar hoje?\n1️⃣ - Marcar Aula Experimental\n2️⃣ - Falar com o professor`);
          return res.status(200).json({ ok: true });
        }

        if (isOption(textMsg, "1")) {
          await db.update(chatbotSessions).set({ 
            state: "NEW_USER_NAME", 
            data: JSON.stringify({ activeProfessorId: professorUserId }),
            updatedAt: new Date() 
          }).where(eq(chatbotSessions.id, session.id));
          await sendReply("Que ótimo! Vamos marcar sua aula experimental. 🎉\n\nPor favor, digite o seu *NOME COMPLETO* para começarmos:");
          return res.status(200).json({ ok: true });
        }
        else if (isOption(textMsg, "2")) {
          await db.update(chatbotSessions).set({ 
            state: "PAUSED_HUMAN", 
            data: JSON.stringify({ activeProfessorId: professorUserId }),
            updatedAt: new Date() 
          }).where(eq(chatbotSessions.id, session.id));
          await sendReply("Certo! Estou te transferindo para o professor. Logo responderemos! 👤");
          return res.status(200).json({ ok: true });
        }
        else {
          await sendReply("Desculpe, não entendi. Digite *1* para marcar uma aula ou *2* para falar com o professor.");
          return res.status(200).json({ ok: true });
        }
      }

      if (session.state === "NEW_USER_NAME") {
        const newName = textMsg.trim();
        
        // Gerar horários disponiveis
        const slots = generateAvailableSlots();
        // Checar ocupados apenas para ESTE professor
        const ocupadas = await db.select().from(lessons).where(
          and(
            eq(lessons.userId, professorUserId),
            gte(lessons.scheduledAt, new Date()),
            eq(lessons.status, "agendada")
          )
        );

        // Filtra slots ocupados (mesmo horário exato)
        const freeSlots = slots.filter(slot => {
          return !ocupadas.some(l => l.scheduledAt.getTime() === slot.date.getTime());
        });

        const dataObj = { 
          name: newName, 
          freeSlots: freeSlots.slice(0, 5),
          activeProfessorId: professorUserId 
        };

        await db.update(chatbotSessions).set({ 
          state: "NEW_USER_SLOT", 
          data: JSON.stringify(dataObj),
          updatedAt: new Date() 
        }).where(eq(chatbotSessions.id, session.id));

        let msg = `Prazer, ${newName}! 😊\nTemos os seguintes horários livres para a sua aula experimental com o professor:\n\n`;
        dataObj.freeSlots.forEach((s, idx) => {
          msg += `${idx + 1}️⃣ - ${s.label}\n`;
        });
        msg += "\nDigite o *número* da opção desejada ou *0* para falar com o professor.";
        await sendReply(msg);
        return res.status(200).json({ ok: true });
      }

      if (session.state === "NEW_USER_SLOT") {
        if (textMsg === "0") {
          await db.update(chatbotSessions).set({ 
            state: "PAUSED_HUMAN", 
            data: JSON.stringify({ activeProfessorId: professorUserId }),
            updatedAt: new Date() 
          }).where(eq(chatbotSessions.id, session.id));
          await sendReply("Certo, transferindo para o professor para vermos outro horário! 👤");
          return res.status(200).json({ ok: true });
        }

        let sessionData: any = {};
        try { sessionData = JSON.parse(session.data || "{}"); } catch(e){}

        const optionIdx = parseInt(textMsg) - 1;
        if (!isNaN(optionIdx) && sessionData.freeSlots && sessionData.freeSlots[optionIdx]) {
          const chosenSlot = sessionData.freeSlots[optionIdx];
          
          // Agendar a aula associada ao professor correto
          const orgIdResult = await db.select({ organizationId: settings.organizationId })
            .from(settings)
            .where(eq(settings.userId, professorUserId))
            .limit(1);
          
          const orgId = orgIdResult[0]?.organizationId;

          await db.insert(lessons).values({
            organizationId: orgId,
            userId: professorUserId,
            isExperimental: true,
            experimentalName: sessionData.name,
            title: `Aula Experimental - ${sessionData.name}`,
            scheduledAt: new Date(chosenSlot.date),
            duration: 60,
            status: "agendada",
            lessonType: "individual"
          });

          await db.update(chatbotSessions).set({ 
            state: "START", 
            data: JSON.stringify({ activeProfessorId: professorUserId }), 
            updatedAt: new Date() 
          }).where(eq(chatbotSessions.id, session.id));
          
          await sendReply(`Tudo certo, ${sessionData.name}! 🎉\nSua aula experimental foi agendada para *${chosenSlot.label}*.\n\nFicamos te aguardando! Se precisar de algo, só mandar mensagem e escolher falar com o professor.`);
          return res.status(200).json({ ok: true });
        } else {
          await sendReply("Opção inválida. Por favor, digite o número correspondente ao horário ou 0 para falar com o professor.");
          return res.status(200).json({ ok: true });
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[WhatsApp Webhook] Erro:", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

export default router;
