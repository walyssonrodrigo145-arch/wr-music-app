import { sendWhatsAppMessage } from "./whatsapp";

export interface RoutingParams {
  sendToStudent: boolean;
  sendToGuardian: boolean;
  student: { 
    phone?: string | null; 
    guardianPhone?: string | null; 
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
    if (sendToGuardian && !hasGuardianPhone && hasStudentPhone) {
      targetPhones.push(student.phone!);
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
      await sendWhatsAppMessage({ 
        url: whatsappConfig.url,
        token: whatsappConfig.token,
        phone, 
        message, 
        sessionId 
      });
      // pequeno delay para não bloquear a API e evitar Anti-Spam
      await new Promise(r => setTimeout(r, 800));
    } catch (err: any) {
      errors.push(`Erro ao enviar para ${phone}: ${err?.message || 'Desconhecido'}`);
    }
  }

  return { 
    success: errors.length === 0 && uniquePhones.length > 0,
    errors: errors.length > 0 ? errors : (uniquePhones.length === 0 ? ["Nenhum telefone válido encontrado para envio."] : undefined)
  };
}
