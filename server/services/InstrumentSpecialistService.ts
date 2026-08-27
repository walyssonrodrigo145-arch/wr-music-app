/**
 * InstrumentSpecialistService — IAs Especialistas por Instrumento
 *
 * PRD: PRD_IAS_ESPECIALISTAS_INSTRUMENTOS.md (RF-001 a RF-009)
 * Envolve INSTRUMENT_CONTEXTS com identidade, glossary polissêmico, few-shots,
 * prompt builder e validador pós-geração para evitar contaminação cruzada
 * (caso crítico: "voz" em teclado = polifonia/voicing, nunca canto).
 */

import {
  INSTRUMENT_CONTEXTS,
  getInstrumentContext,
  InstrumentCategory,
  InstrumentContext,
} from "../utils/instrumentContexts";

// ─── Tipos ───────────────────────────────────────────────────────────────

export type PlanMode = "direto" | "didatico" | "desafio";

export interface InstrumentSpecialist extends InstrumentContext {
  id: InstrumentCategory;
  displayName: string;
  systemPrompt: string;
  glossary: Record<string, string>;
  fewShots: Record<PlanMode, string[]>;
  retryInstruction: string;
}

// ─── Glossários Polissêmicos ────────────────────────────────────────────
// Termo -> definição específica da categoria. Injetado como
// "## GLOSSÁRIO DE DESAMBIGUAÇÃO — USE A DEFINIÇÃO DE {categoria}"

const GLOSSARY_TECLADO: Record<string, string> = {
  "voz / vozes / voicing":
    "Em TECLADO, 'voz' = camada polifônica / linha melódica dentro de textura. Ex: '4 vozes' = soprano/contralto/tenor/baixo ao teclado; 'condução de vozes' = movimento suave de cada voz; 'voicing' = disposição das notas do acorde (fechado/aberto, ex: Dm7 fechado D-F-A-C na mão direita + baixo D na esquerda). NUNCA confundir com voz humana/canto.",
  pedal:
    "Em TECLADO, 'pedal' = pedal de sustain/damper (pé direito). Não é pedal de bumbo de bateria nem pedal de efeito de guitarra.",
  palheta: "Em TECLADO não existe palheta. Se aparecer 'palheta' no plano, está errado.",
  arco: "Em TECLADO não existe arco. Se aparecer 'arco', está errado.",
};

const GLOSSARY_VOZ: Record<string, string> = {
  voz: "Em CANTO, 'voz' = instrumento vocal humano; aparelho fonador, respiração diafragmática, ressonância. Não é voicing de teclado.",
  pedal: "Em CANTO não existe pedal. Se aparecer 'pedal', está errado.",
  traste: "Em CANTO não existe traste. Se aparecer 'traste/pestana', está errado.",
};

const GLOSSARY_CORDAS_DEDILHADAS: Record<string, string> = {
  voz: "Em VIOLÃO/GUITARRA, 'voz' raramente se usa; se aparecer, referir a 'linha melódica' na corda, nunca a canto. Para polifonia, usar 'corda'/'arpejo'.",
  pedal: "Em CORDAS DEDILHADAS, 'pedal' = pedal de efeito (ex: overdrive). Não é pedal de sustain de piano nem pedal de bumbo.",
  palheta: "Em CORDAS DEDILHADAS, 'palheta' = palheta da guitarra/violão para ataque. Não é palheta de sopro (sax/clarinete).",
  arco: "Em CORDAS DEDILHADAS não existe arco. Se aparecer 'arco/golpe de arco', está errado.",
};

const GLOSSARY_PERCUSSAO: Record<string, string> = {
  voz: "Em BATERIA, 'voz' não se usa para canto; se aparecer 'voz', está errado. Bateria é instrumento rítmico, não harmônico/melódico.",
  pedal: "Em BATERIA, 'pedal' = pedal de bumbo (pé direito) ou pedal de chimbal (pé esquerdo). Não é pedal de sustain.",
  acorde: "Em BATERIA não existe acorde/nota harmônica. Se aparecer 'acorde Dó/Ré/Mi', está errado.",
};

const GLOSSARY_SOPRO: Record<string, string> = {
  voz: "Em SOPRO, 'voz' não se usa para canto; usar 'linha melódica' ou 'frase'. Não gerar exercícios de canto.",
  pedal: "Em SOPRO não existe pedal. Se aparecer 'pedal', está errado.",
  palheta: "Em SOPRO, 'palheta' = palheta de sax/clarinete no bocal. Não é palheta de guitarra.",
};

const GLOSSARY_CORDAS_ARCO: Record<string, string> = {
  voz: "Em CORDAS COM ARCO, 'voz' = linha musical em cordas duplas, não canto. Não gerar vocalise.",
  pedal: "Em CORDAS COM ARCO não existe pedal. Se aparecer 'pedal', está errado.",
  traste: "Em CORDAS COM ARCO não existe traste (cordas sem trastes, afinação por ouvido/posição). Se aparecer 'traste/pestana', está errado.",
};

const GLOSSARY_GERAL: Record<string, string> = {
  voz: "Sem instrumento definido: evite o termo 'voz' ambíguo. Use 'linha melódica' genérica.",
};

// ─── System Prompts por Especialista ────────────────────────────────────

const SYSTEM_CORDAS_DEDILHADAS = `Você é um PROFESSOR ESPECIALISTA em CORDAS DEDILHADAS (violão, guitarra, baixo, ukulele, cavaquinho) com 20 anos de experiência pedagógica.
Sua missão é criar planos 100% específicos para cordas dedilhadas, usando terminologia correta (cordas, trastes, pestana, palhetada, dedilhado p-i-m-a, etc.) e NUNCA mencionar bateria, piano, canto ou sopro.`;

const SYSTEM_TECLADO = `Você é um PROFESSOR ESPECIALISTA em PIANO/TECLADO com 20 anos de experiência em técnica de mãos, leitura em duas claves, pedal de sustain e condução de vozes.
Regra crítica: em TECLADO, "voz/vozes/voicing" = camada polifônica / disposição de acorde (ex: Dm7 voicing fechado D-F-A-C na mão direita + baixo D na esquerda; 4 vozes = SATB ao teclado; condução de vozes = movimento suave). NUNCA confundir com voz humana/canto (vocalise, respiração diafragmática, projeção vocal são PROIBIDOS em teclado).`;

const SYSTEM_PERCUSSAO = `Você é um PROFESSOR ESPECIALISTA em BATERIA/PERCUSSÃO. Crie apenas exercícios rítmicos (groove, rudimentos, coordenação bumbo/caixa/chimbal). NUNCA mencione notas harmônicas (Dó, Ré, Mi), acordes, pestana, traste ou canto. Bateria é instrumento rítmico.`;

const SYSTEM_VOZ = `Você é um PREPARADOR VOCAL ESPECIALISTA em CANTO. Seu instrumento é a VOZ HUMANA: respiração diafragmática, apoio vocal, vocalise, tessitura, passagem de registro. NUNCA mencione trastes, cordas, teclas, pedais ou baquetas. Se houver acompanhamento, cite apenas como referência de afinação.`;

const SYSTEM_SOPRO = `Você é um PROFESSOR ESPECIALISTA em INSTRUMENTOS DE SOPRO (flauta, sax, clarinete, trompete, trombone). Foque em embocadura, coluna de ar, digitação e articulação (língua simples/dupla). NUNCA mencione cordas dedilhadas, trastes, teclas de piano ou bateria.`;

const SYSTEM_CORDAS_ARCO = `Você é um PROFESSOR ESPECIALISTA em CORDAS COM ARCO (violino, viola, violoncelo, contrabaixo). Trabalhe arco (détaché, legato, spiccato), posições sem trastes, afinação por ouvido, pizzicato. NUNCA mencione trastes, pestana, palheta de guitarra, teclas ou bateria.`;

const SYSTEM_GERAL = `Você é um PROFESSOR DE MÚSICA GENÉRICO. Como o instrumento não foi cadastrado, use apenas termos genéricos (instrumento, nota, ritmo, postura, metrônomo). Evite termos específicos de qualquer instrumento e oriente o professor a cadastrar o instrumento.`;

// ─── Retry Instructions ─────────────────────────────────────────────────

const RETRY_CORDAS_DEDILHADAS =
  "RETRY: Você é especialista em CORDAS DEDILHADAS. Você gerou termos de outro instrumento. Regenere usando apenas terminologia de cordas (traste, pestana, palhetada, dedilhado p-i-m-a) e remova qualquer menção a bateria/piano/canto/sopro.";
const RETRY_TECLADO =
  "RETRY: Você é especialista em TECLADO/PIANO. Você gerou termos de CANTO ou outros instrumentos. Em TECLADO, 'voz/vozes/voicing' = polifonia (condução de vozes, voicing de acorde), NUNCA vocalise/respiração diafragmática. Regenere sem nenhum termo de canto, bateria ou cordas dedilhadas.";
const RETRY_PERCUSSAO =
  "RETRY: Você é especialista em BATERIA. Você gerou termos harmônicos (acordes, notas Dó/Ré/Mi) ou de outros instrumentos. Regenere usando apenas ritmo (groove, rudimento, bumbo/caixa/chimbal) e remova qualquer acorde/canto/corda/tecla.";
const RETRY_VOZ =
  "RETRY: Você é especialista em CANTO. Você gerou termos instrumentais (traste, corda, tecla, pedal, baqueta). Regenere usando apenas voz (respiração diafragmática, vocalise, tessitura) e remova termos de instrumentos físicos.";
const RETRY_SOPRO =
  "RETRY: Você é especialista em SOPRO. Você gerou termos de cordas/teclado/bateria/canto. Regenere usando apenas embocadura, coluna de ar, digitação e articulação.";
const RETRY_CORDAS_ARCO =
  "RETRY: Você é especialista em CORDAS COM ARCO. Você gerou termos com trastes/pestana/tecla/bateria. Regenere sem trastes, usando apenas arco, posições e afinação por ouvido.";
const RETRY_GERAL =
  "RETRY: Sem instrumento definido. Use apenas termos genéricos e não mencione termos específicos de especialistas.";

// ─── Few-shots (ancoras por modo) ───────────────────────────────────────
// Mantidos curtos e auditáveis. Podem ser expandidos sem migração de banco.

const FEWSHOTS_TECLADO: Record<PlanMode, string[]> = {
  direto: [
    `Meta: "Condução de vozes em 4 vozes com Dm7"
Output direto (teclado): • Mão direita: voicing fechado Dm7 (D-F-A-C) dedos 1-2-3-5. • Metrônomo: toque 10× a 60 BPM. • Mão esquerda: baixo D (dedo 5) no tempo 1. • Desafio: 1 min sem errar vozes internas.`,
  ],
  didatico: [
    `Meta: "Voicing de Cmaj7 com inversões"
Output didático (teclado): Monte Cmaj7 fechado (C-E-G-B) com polegar no C, curvatura relaxada. Teste tecla por tecla: se B soar opaco, ajuste mínima. Pratique inversão 1 (E-G-B-C) com cruzamento de polegar, 60 BPM, observando relaxamento do punho.`,
  ],
  desafio: [
    `Meta: "4 vozes — levada pop"
Output desafio (teclado): Levada Pop 4/4: mão esquerda sustenta baixo em semibreve, mão direita conduz 4 vozes em colcheias. Acelere 60→75→90 BPM a cada 4 compassos. Desafio: 16 compassos em loop sem perder vozes internas.`,
  ],
};

const FEWSHOTS_VOZ: Record<PlanMode, string[]> = {
  direto: [`Meta: "Apoio diafragmático" → • Respiração 4-2-8 • Humming em escala • Vocalise "mah" Dó-Sol. Desafio: sustentar 8 tempos sem forçar.`],
  didatico: [`Meta: "Passagem de registro" → Explique apoio diafragmático, ressonância de peito para cabeça, vocalise curto em âmbito de 5ª, sem forçar garganta.`],
  desafio: [`Meta: "Vibrato" → Desafio: cantar frase 3× piano e 3× forte mantendo afinação, gravando e autoavaliando.`],
};

const EMPTY_FEWSHOTS: Record<PlanMode, string[]> = { direto: [], didatico: [], desafio: [] };

// ─── Registry ───────────────────────────────────────────────────────────

export const INSTRUMENT_SPECIALISTS: Record<InstrumentCategory, InstrumentSpecialist> = {
  cordas_dedilhadas: {
    ...INSTRUMENT_CONTEXTS.cordas_dedilhadas,
    id: "cordas_dedilhadas",
    displayName: "Cordas Dedilhadas",
    systemPrompt: SYSTEM_CORDAS_DEDILHADAS,
    glossary: GLOSSARY_CORDAS_DEDILHADAS,
    fewShots: EMPTY_FEWSHOTS,
    retryInstruction: RETRY_CORDAS_DEDILHADAS,
  },
  teclado: {
    ...INSTRUMENT_CONTEXTS.teclado,
    // Reforça voicing no terminology para garantir cobertura
    terminology: [...INSTRUMENT_CONTEXTS.teclado.terminology, "voicing", "condução de vozes", "vozes internas", "4 vozes"],
    forbiddenTerms: INSTRUMENT_CONTEXTS.teclado.forbiddenTerms,
    warmupDescription: INSTRUMENT_CONTEXTS.teclado.warmupDescription,
    warmupExamples: INSTRUMENT_CONTEXTS.teclado.warmupExamples,
    technicalFocusExamples: INSTRUMENT_CONTEXTS.teclado.technicalFocusExamples,
    challengeExamples: INSTRUMENT_CONTEXTS.teclado.challengeExamples,
    levelHints: INSTRUMENT_CONTEXTS.teclado.levelHints,
    extraInstruction: INSTRUMENT_CONTEXTS.teclado.extraInstruction,
    id: "teclado",
    displayName: "Piano / Teclado",
    systemPrompt: SYSTEM_TECLADO,
    glossary: GLOSSARY_TECLADO,
    fewShots: FEWSHOTS_TECLADO,
    retryInstruction: RETRY_TECLADO,
  },
  percussao: {
    ...INSTRUMENT_CONTEXTS.percussao,
    id: "percussao",
    displayName: "Bateria / Percussão",
    systemPrompt: SYSTEM_PERCUSSAO,
    glossary: GLOSSARY_PERCUSSAO,
    fewShots: EMPTY_FEWSHOTS,
    retryInstruction: RETRY_PERCUSSAO,
  },
  voz: {
    ...INSTRUMENT_CONTEXTS.voz,
    id: "voz",
    displayName: "Voz / Canto",
    systemPrompt: SYSTEM_VOZ,
    glossary: GLOSSARY_VOZ,
    fewShots: FEWSHOTS_VOZ,
    retryInstruction: RETRY_VOZ,
  },
  sopro: {
    ...INSTRUMENT_CONTEXTS.sopro,
    id: "sopro",
    displayName: "Sopro",
    systemPrompt: SYSTEM_SOPRO,
    glossary: GLOSSARY_SOPRO,
    fewShots: EMPTY_FEWSHOTS,
    retryInstruction: RETRY_SOPRO,
  },
  cordas_arco: {
    ...INSTRUMENT_CONTEXTS.cordas_arco,
    id: "cordas_arco",
    displayName: "Cordas com Arco",
    systemPrompt: SYSTEM_CORDAS_ARCO,
    glossary: GLOSSARY_CORDAS_ARCO,
    fewShots: EMPTY_FEWSHOTS,
    retryInstruction: RETRY_CORDAS_ARCO,
  },
  geral: {
    ...INSTRUMENT_CONTEXTS.geral,
    id: "geral",
    displayName: "Geral",
    systemPrompt: SYSTEM_GERAL,
    glossary: GLOSSARY_GERAL,
    fewShots: EMPTY_FEWSHOTS,
    retryInstruction: RETRY_GERAL,
  },
};

// ─── Resolver ───────────────────────────────────────────────────────────

export function resolveSpecialist(
  instrumentName: string,
  instrumentCategory: string
): InstrumentSpecialist {
  const { resolvedCategory } = getInstrumentContext(instrumentName, instrumentCategory);
  return INSTRUMENT_SPECIALISTS[resolvedCategory] || INSTRUMENT_SPECIALISTS.geral;
}

export function getSpecialistById(id: InstrumentCategory): InstrumentSpecialist {
  return INSTRUMENT_SPECIALISTS[id] || INSTRUMENT_SPECIALISTS.geral;
}

// ─── Prompt Builder ─────────────────────────────────────────────────────

export function buildSpecialistPromptBlock(
  specialist: InstrumentSpecialist,
  planMode: PlanMode = "direto"
): string {
  const glossaryLines = Object.entries(specialist.glossary)
    .map(([term, def]) => `- **${term}**: ${def}`)
    .join("\n");

  const fewShotBlock =
    specialist.fewShots[planMode]?.length > 0
      ? `\n## EXEMPLOS ÂNCORA (${planMode.toUpperCase()}) — SIGA O ESTILO\n${specialist.fewShots[planMode].join("\n\n")}\n`
      : "";

  return `
## IDENTIDADE DO ESPECIALISTA: ${specialist.displayName.toUpperCase()} (${specialist.id})
${specialist.systemPrompt}

## GLOSSÁRIO DE DESAMBIGUAÇÃO — USE A DEFINIÇÃO DE ${specialist.id.toUpperCase()}
${glossaryLines || "- Nenhum termo polissêmico crítico para este especialista."}

## REGRAS ABSOLUTAS DO ESPECIALISTA
- PROIBIDO usar: ${specialist.forbiddenTerms.length > 0 ? specialist.forbiddenTerms.join(", ") : "nenhum (genérico)"}
- Terminologia correta: ${specialist.terminology.join(", ")}
- Instrução extra: ${specialist.extraInstruction}
- Dica de nível: será injetada separadamente por nível do aluno.
${fewShotBlock}`.trim();
}

// ─── Validador Pós-Geração ──────────────────────────────────────────────
// Detecta contaminação cruzada escaneando termos proibidos no texto gerado.
// Retorna {passed, found} — puro e testável sem LLM.

function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function termAppears(textNorm: string, term: string): boolean {
  const t = normalizeForMatch(term.trim());
  if (!t) return false;
  // Para termos de uma palavra curta (ex: "arco", "voz"), usa word boundary
  // para evitar falso positivo em "arco-íris". Para frases com espaço, usa includes.
  if (!t.includes(" ") && t.length <= 6) {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      const re = new RegExp(`\\b${escaped}\\b`, "i");
      return re.test(textNorm);
    } catch {
      return textNorm.includes(t);
    }
  }
  return textNorm.includes(t);
}

export function validatePlanText(
  planText: string,
  specialistId: InstrumentCategory
): { passed: boolean; found: string[] } {
  const specialist = getSpecialistById(specialistId);
  if (!specialist || specialist.forbiddenTerms.length === 0) {
    return { passed: true, found: [] };
  }
  const norm = normalizeForMatch(planText);
  const found: string[] = [];
  for (const term of specialist.forbiddenTerms) {
    if (termAppears(norm, term)) {
      found.push(term);
    }
  }
  return { passed: found.length === 0, found };
}

// ─── Helper: valida já com resolve ─────────────────────────────────────

export function validatePlanTextForInstrument(
  planText: string,
  instrumentName: string,
  instrumentCategory: string
): { passed: boolean; found: string[]; specialistId: InstrumentCategory } {
  const specialist = resolveSpecialist(instrumentName, instrumentCategory);
  const result = validatePlanText(planText, specialist.id);
  return { ...result, specialistId: specialist.id };
}
