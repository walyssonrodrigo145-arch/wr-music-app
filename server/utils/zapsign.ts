import axios from "axios";

// ZapSign API Integration
// Docs: https://docs.zapsign.co

const ZAPSIGN_BASE_URL = "https://api.zapsign.com.br/api/v1";

interface ZapSignConfig {
  apiToken: string;
}

interface CreateDocumentParams {
  name: string;
  urlPdf?: string;
  base64Pdf?: string;
  signers: {
    name: string;
    email: string;
    phone?: string;
    lock_name?: boolean;
    lock_email?: boolean;
    auth_mode?: "assinaturaTela" | "tokenEmail" | "tokenSms";
  }[];
  lang?: "pt-br" | "en" | "es";
  disable_signer_emails?: boolean;
  brand_logo?: string;
  brand_primary_color?: string;
}

interface ZapSignDocument {
  open_id: string;
  token: string;
  name: string;
  status: string;
  created_at: string;
  signers: {
    token: string;
    name: string;
    email: string;
    sign_url: string;
    status: string;
  }[];
}

export async function createZapSignDocument(
  config: ZapSignConfig,
  params: CreateDocumentParams
): Promise<ZapSignDocument> {
  const response = await axios.post(
    `${ZAPSIGN_BASE_URL}/docs/`,
    {
      name: params.name,
      url_pdf: params.urlPdf,
      base64_pdf: params.base64Pdf,
      signers: params.signers,
      lang: params.lang || "pt-br",
      disable_signer_emails: params.disable_signer_emails || false,
      brand_logo: params.brand_logo,
      brand_primary_color: params.brand_primary_color,
    },
    {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
}

export async function getZapSignDocumentStatus(
  config: ZapSignConfig,
  docToken: string
): Promise<ZapSignDocument> {
  const response = await axios.get(
    `${ZAPSIGN_BASE_URL}/docs/${docToken}/`,
    {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
    }
  );
  return response.data;
}

export async function deleteZapSignDocument(
  config: ZapSignConfig,
  docToken: string
): Promise<void> {
  await axios.delete(
    `${ZAPSIGN_BASE_URL}/docs/${docToken}/`,
    {
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
    }
  );
}

// Generate a simple contract PDF as base64
// This creates a basic HTML-to-PDF-like contract
export function generateContractHtml(data: {
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  studentName: string;
  studentCpf?: string;
  studentPhone?: string;
  instrumentName?: string;
  monthlyFee: string;
  dueDay: number;
  startDate?: string;
  lessonDuration?: number;
  lessonType?: string;
}): string {
  const today = new Date().toLocaleDateString("pt-BR");
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Georgia', serif; margin: 40px 60px; line-height: 1.8; color: #333; font-size: 13px; }
  h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
  h2 { text-align: center; font-size: 14px; font-weight: normal; color: #666; margin-bottom: 30px; }
  .clause { margin-bottom: 15px; }
  .clause-title { font-weight: bold; }
  .signature-area { margin-top: 60px; display: flex; justify-content: space-between; }
  .signature-line { text-align: center; width: 45%; }
  .signature-line hr { border: none; border-top: 1px solid #333; margin-bottom: 5px; }
  .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #999; }
</style></head>
<body>
  <h1>CONTRATO DE PRESTAÇÃO DE SERVIÇO</h1>
  <h2>${data.schoolName || "Escola de Música"}</h2>

  <div class="clause">
    <span class="clause-title">CONTRATADA:</span> ${data.schoolName || "Escola de Música"}, 
    ${data.schoolAddress ? `localizada em ${data.schoolAddress},` : ""}
    ${data.schoolPhone ? `telefone ${data.schoolPhone},` : ""}
    doravante denominada CONTRATADA.
  </div>

  <div class="clause">
    <span class="clause-title">CONTRATANTE:</span> ${data.studentName}, 
    ${data.studentCpf ? `CPF ${data.studentCpf},` : ""}
    ${data.studentPhone ? `telefone ${data.studentPhone},` : ""}
    doravante denominado(a) CONTRATANTE.
  </div>

  <div class="clause">
    <span class="clause-title">CLÁUSULA PRIMEIRA —</span> O objeto do presente instrumento é a prestação de serviços de ensino musical 
    ${data.instrumentName ? `no curso de ${data.instrumentName},` : ""}
    na modalidade ${data.lessonType === "turma" ? "em turma" : "individual"}, 
    com aulas de ${data.lessonDuration || 60} minutos de duração, 
    1 vez por semana.
  </div>

  <div class="clause">
    <span class="clause-title">CLÁUSULA SEGUNDA —</span> O valor da mensalidade é de R$ ${data.monthlyFee}, 
    com vencimento todo dia ${data.dueDay} de cada mês. O pagamento poderá ser efetuado via Pix, boleto ou cartão de crédito.
  </div>

  <div class="clause">
    <span class="clause-title">CLÁUSULA TERCEIRA —</span> O atraso no pagamento da mensalidade superior a 5 (cinco) dias úteis 
    acarretará multa de 2% sobre o valor da mensalidade, acrescido de juros de 1% ao mês.
  </div>

  <div class="clause">
    <span class="clause-title">CLÁUSULA QUARTA —</span> Em caso de ausência do CONTRATANTE, a aula não será reposta, 
    salvo se o cancelamento for comunicado com no mínimo 24 horas de antecedência.
  </div>

  <div class="clause">
    <span class="clause-title">CLÁUSULA QUINTA —</span> O presente contrato entra em vigor a partir de 
    ${data.startDate || today} e tem duração indeterminada, podendo ser rescindido por qualquer das partes 
    mediante aviso prévio de 30 (trinta) dias.
  </div>

  <div class="clause">
    <span class="clause-title">CLÁUSULA SEXTA —</span> Fica eleito o foro da comarca da sede da CONTRATADA 
    para dirimir quaisquer dúvidas ou litígios decorrentes deste contrato.
  </div>

  <p style="text-align: center; margin-top: 30px;">
    E por estarem justos e contratados, firmam o presente instrumento em formato digital.
  </p>

  <p style="text-align: center; margin-top: 10px;">
    Data: ${today}
  </p>

  <div class="footer">
    Documento gerado automaticamente pelo sistema MusicPro
  </div>
</body>
</html>`;
}
