import { sendWhatsAppMessage, humanDelay } from "./whatsapp";

export interface RoutingParams {
  sendToStudent: boolean;
  sendToGuardian: boolean;
  student: { 
    phone?: string | null; 
    guardianPhone?: string | null; 
    birthDate?: string | Date | null;
  };
  message: string;
  sessionId: string;
  whatsappConfig: {
    url: string | null;
    token: string | null;
  };
}

/**
 * Envia uma mensagem de WhatsApp aplicando regras de roteamento inteligente
 * e fallback (Plano B) caso o telefone principal selecionado não exista.
 */
export async function sendSmartWhatsAppNotification({ 
  sendToStudent, 
  sendToGuardian, 
  student, 
  message, 
  sessionId,
  whatsappConfig
}: RoutingParams): Promise<{ success: boolean; errors?: string[] }> {
  
  if (!whatsappConfig.url || !whatsappConfig.token) {
    return { success: false, errors: ["Configuração do WhatsApp Bot ausente"] };
  }

  const hasStudentPhone = !!student.phone && student.phone.trim().length > 0;
  const hasGuardianPhone = !!student.guardianPhone && student.guardianPhone.trim().length > 0;

  const targetPhones: string[] = [];

  // Se marcar para enviar para o Aluno e ele tiver telefone, adiciona
  if (sendToStudent && hasStudentPhone) {
    targetPhones.push(student.phone!);
  }

  // Se marcar para enviar para o Responsável e ele tiver telefone, adiciona
  if (sendToGuardian && hasGuardianPhone) {
    targetPhones.push(student.guardianPhone!);
  }

  // --- PLANO B (FALLBACK) ---
  // Se o resultado for 0 números (ex: marcou para enviar pro pai, mas não tem pai cadastrado)
  if (targetPhones.length === 0) {
    // Se marcou apenas Responsável, mas ele não tem, e o aluno tem -> Manda pro Aluno
    // NOVIDADE: Apenas faz esse fallback se o aluno for MAIOR de idade (>= 18) ou se não tiver data de nascimento cadastrada (presume-se maior)
    if (sendToGuardian && !hasGuardianPhone && hasStudentPhone) {
      let isAdult = true; // Assume adult if no birthdate
      if (student.birthDate) {
        const bDate = new Date(student.birthDate);
        if (!isNaN(bDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - bDate.getFullYear();
          const m = today.getMonth() - bDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
            age--;
          }
          if (age < 18) isAdult = false;
        }
      }

      if (isAdult) {
        targetPhones.push(student.phone!);
      }
    }
    // Se marcou apenas Aluno, mas ele não tem, e o responsável tem -> Manda pro Responsável
    else if (sendToStudent && !hasStudentPhone && hasGuardianPhone) {
      targetPhones.push(student.guardianPhone!);
    }
  }

  const uniquePhones = Array.from(new Set(targetPhones));
  const errors: string[] = [];

  for (const phone of uniquePhones) {
    try {
      const res = await sendWhatsAppMessage({ 
        url: whatsappConfig.url,
        token: whatsappConfig.token,
        phone, 
        message, 
        sessionId 
      });
      if (!res.success) {
        errors.push(`Erro ao enviar para ${phone}: ${res.error || 'Desconhecido'}`);
      }
      // ANTI-BAN: delay humanizado aleat\u00f3rio entre mensagens (3s~10s)
      await humanDelay(3000, 10000);
    } catch (err: any) {
      errors.push(`Erro ao enviar para ${phone}: ${err?.message || 'Desconhecido'}`);
    }
  }

  return { 
    success: errors.length === 0 && uniquePhones.length > 0,
    errors: errors.length > 0 ? errors : (uniquePhones.length === 0 ? ["Nenhum telefone válido encontrado para envio."] : undefined)
  };
}
