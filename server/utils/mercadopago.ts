import { ENV } from "../_core/env";

export interface MPPreferenceItem {
  title: string;
  quantity: number;
  currency_id: string;
  unit_price: number;
}

export interface MPPreferencePayer {
  name: string;
  email: string;
}

export interface CreatePreferenceParams {
  items: MPPreferenceItem[];
  payer: MPPreferencePayer;
  external_reference: string;
  successUrl: string;
}

export async function createMPPreference(
  params: CreatePreferenceParams,
  accessToken: string
) {
  const url = "https://api.mercadopago.com/checkout/preferences";
  
  const payload = {
    items: params.items,
    payer: params.payer,
    payment_methods: {
      excluded_payment_types: [
        { id: "ticket" } // Desabilitar boleto se quisermos forçar Pix/Cartão apenas
      ],
      installments: 1
    },
    back_urls: {
      success: params.successUrl,
      failure: params.successUrl,
      pending: params.successUrl,
    },
    auto_return: "approved",
    external_reference: params.external_reference,
    // Webhook nativo de IPN/Notificação para atualização automática
    notification_url: `${ENV.appUrl || 'https://wrmusicpro.com.br'}/api/webhooks/mercadopago/student?dueId=${params.external_reference}`,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`[MercadoPago] Erro ao criar preferência: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  
  return {
    id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point
  };
}
