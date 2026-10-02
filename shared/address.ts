/**
 * shared/address.ts — Helpers puros de endereço (PRD_ENDERECO_CONTRATOS_VARIAVEIS).
 *
 * Usados pelo servidor (espelho de `students.address`, montagem das variáveis do
 * contrato) e testáveis sem banco.
 */

export interface AddressParts {
  cep?: string | null;
  street?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
}

/** Máscara de CEP: "12345678" -> "12345-678" (parcial também é formatado). */
export function maskCEP(value: string): string {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** True quando o CEP tem exatamente 8 dígitos. */
export function isValidCEP(value: string | null | undefined): boolean {
  return String(value || "").replace(/\D/g, "").length === 8;
}

/**
 * Monta o espelho textual do endereço (compatibilidade com portal e variáveis
 * legadas): "Rua X, 123, Compl., Bairro, Cidade - UF, CEP 00000-000".
 * Campos vazios são omitidos; retorna "" quando não há nada.
 */
export function buildAddressMirror(parts: AddressParts): string {
  const chunks: string[] = [];
  const street = (parts.street || "").trim();
  const number = (parts.addressNumber || "").trim();
  const complement = (parts.addressComplement || "").trim();
  const district = (parts.district || "").trim();
  const city = (parts.city || "").trim();
  const state = (parts.state || "").trim().toUpperCase();
  const cep = (parts.cep || "").trim();

  if (street) chunks.push(number ? `${street}, ${number}` : street);
  else if (number) chunks.push(number);
  if (complement) chunks.push(complement);
  if (district) chunks.push(district);

  const cityState = [city, state].filter(Boolean).join(" - ");
  if (cityState) chunks.push(cityState);

  let text = chunks.join(", ");
  if (cep) text = text ? `${text}, CEP ${cep}` : `CEP ${cep}`;
  return text;
}

/** Versão multilinha (contratos): cada grupo em uma linha. */
export function formatAddressForContract(parts: AddressParts): string {
  const streetLine = [parts.street, parts.addressNumber].filter(Boolean).join(", ");
  const lines = [
    streetLine,
    parts.addressComplement,
    parts.district,
    [parts.city, parts.state].filter(Boolean).join(" - "),
    parts.cep ? `CEP ${parts.cep}` : null,
  ]
    .map((l) => (l || "").trim())
    .filter((l) => l.length > 0);
  return lines.join(", ");
}
