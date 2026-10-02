// Busca de CEP com fallback: ViaCEP → BrasilAPI.
// Nunca lança: retorna null quando o CEP é inválido ou nenhum provedor responde.

export interface CepResult {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
}

const CEP_TIMEOUT_MS = 4000;

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CEP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function buscarCep(rawCep: string): Promise<CepResult | null> {
  const cep = String(rawCep || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;

  const via = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`);
  if (via && !via.erro && (via.cep || via.localidade)) {
    return {
      cep: String(via.cep || "").replace(/\D/g, "") || cep,
      street: via.logradouro || "",
      district: via.bairro || "",
      city: via.localidade || "",
      state: via.uf || "",
    };
  }

  const brasil = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (brasil && !brasil.errors && (brasil.cep || brasil.city)) {
    return {
      cep: String(brasil.cep || "").replace(/\D/g, "") || cep,
      street: brasil.street || "",
      district: brasil.neighborhood || "",
      city: brasil.city || "",
      state: brasil.state || "",
    };
  }

  return null;
}
