/**
 * client/src/lib/cnpj.ts — Consulta pública de CNPJ (cnpj.ws).
 *
 * API pública e gratuita: https://publica.cnpj.ws/cnpj/{14 dígitos}
 * Limite: 3 consultas por minuto (429 quando excede).
 */

import { maskCEP } from "@shared/address";

export interface CnpjResult {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigoMunicipio: string;
  telefone: string;
  email: string;
  situacaoCadastral: string;
}

export type CnpjLookupResult =
  | { ok: true; data: CnpjResult }
  | { ok: false; reason: "invalid" | "not_found" | "rate_limit" | "network" };

const onlyDigits = (v: string) => String(v || "").replace(/\D/g, "");

export async function buscarCnpj(raw: string): Promise<CnpjLookupResult> {
  const digits = onlyDigits(raw);
  if (digits.length !== 14) return { ok: false, reason: "invalid" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (res.status === 429) return { ok: false, reason: "rate_limit" };
    if (!res.ok) return { ok: false, reason: "network" };

    const json: any = await res.json();
    const est = json?.estabelecimento ?? {};
    const cidade = est?.cidade ?? {};
    const estado = est?.estado ?? {};
    const ddd = est?.ddd1 ? String(est.ddd1) : "";
    const tel = est?.telefone1 ? String(est.telefone1) : "";

    return {
      ok: true,
      data: {
        cnpj: digits,
        razaoSocial: String(json?.razao_social ?? "").trim(),
        nomeFantasia: String(est?.nome_fantasia ?? "").trim(),
        cep: est?.cep ? maskCEP(String(est.cep)) : "",
        logradouro: String(est?.logradouro ?? "").trim(),
        numero: String(est?.numero ?? "").trim(),
        complemento: String(est?.complemento ?? "").trim(),
        bairro: String(est?.bairro ?? "").trim(),
        cidade: String(cidade?.nome ?? "").trim(),
        uf: String(estado?.sigla ?? "").trim().toUpperCase().slice(0, 2),
        codigoMunicipio: cidade?.ibge_id ? String(cidade.ibge_id) : "",
        telefone: ddd && tel ? `${ddd}${tel}` : "",
        email: String(est?.email ?? "").trim(),
        situacaoCadastral: String(est?.situacao_cadastral ?? "").trim(),
      },
    };
  } catch {
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
  }
}
