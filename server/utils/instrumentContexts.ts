/**
 * INSTRUMENT_CONTEXTS
 *
 * Mapa estático de contextos pedagógicos por categoria de instrumento.
 * Usado pelo gerador de Plano Diário de Estudos para garantir que
 * o prompt da IA use terminologia correta para cada instrumento.
 *
 * Categorias suportadas:
 *   cordas_dedilhadas | teclado | percussao | voz | sopro | cordas_arco | geral
 */

export interface InstrumentContext {
  /** Termos técnicos corretos e esperados para este instrumento */
  terminology: string[];
  /** Termos de outros instrumentos que NÃO devem aparecer neste plano */
  forbiddenTerms: string[];
  /** Descrição do tipo de aquecimento adequado */
  warmupDescription: string;
  /** Exemplos de exercícios de aquecimento */
  warmupExamples: string[];
  /** Exemplos de focos técnicos típicos */
  technicalFocusExamples: string[];
  /** Exemplos de desafios práticos */
  challengeExamples: string[];
  /** Dicas de linguagem e abordagem para cada nível */
  levelHints: {
    iniciante: string;
    intermediario: string;
    avancado: string;
  };
  /** Instrução extra para a IA sobre este instrumento */
  extraInstruction: string;
}

export type InstrumentCategory =
  | "cordas_dedilhadas"
  | "teclado"
  | "percussao"
  | "voz"
  | "sopro"
  | "cordas_arco"
  | "geral";

export const INSTRUMENT_CONTEXTS: Record<InstrumentCategory, InstrumentContext> = {
  // ─── CORDAS DEDILHADAS: Violão, Guitarra, Baixo, Ukulele, Cavaquinho ─────
  cordas_dedilhadas: {
    terminology: [
      "cordas",
      "trastes",
      "pestana",
      "dedilhado",
      "palhetada",
      "acorde",
      "escala",
      "arpejo",
      "afinação",
      "braço do instrumento",
      "captador",
      "corpo do instrumento",
      "ponte",
      "capotraste",
      "slides",
      "bend",
      "vibrato",
      "ligado ascendente (hammer-on)",
      "ligado descendente (pull-off)",
    ],
    forbiddenTerms: [
      "bumbum", "caixa", "chimbal", "bumbo", "prato", "rudimento",
      "pedal de bumbo", "hi-hat",
      "mão esquerda e mão direita separadas para cada pauta",
      "nota grave na clave de fá",
      "vocalise", "projeção vocal", "dicção", "respiração diafragmática",
      "embocadura", "língua dupla",
      "arco", "golpe de arco", "pizzicato",
    ],
    warmupDescription: "Exercícios de aquecimento dos dedos no braço do instrumento, sem pressionar as cordas com força excessiva",
    warmupExamples: [
      "Exercício cromático (1-2-3-4) no braço, subindo e descendo os trastes devagar",
      "Abrir e fechar os dedos da mão de fretes lentamente sobre uma superfície plana",
      "Tocar as cordas soltas alternando dedos indicador e médio (ou palheta) em ritmo lento e constante",
    ],
    technicalFocusExamples: [
      "Formação e troca limpa de acordes",
      "Desenvolvimento da pestana (dedo índice cobrindo todas as cordas em um traste)",
      "Palhetada alternada em velocidade controlada",
      "Dedilhado padrão (p-i-m-a) nas cordas",
      "Leitura de tablatura",
      "Técnica de palm mute (abafamento com a palma)",
    ],
    challengeExamples: [
      "Trocar entre dois acordes sem parar o ritmo em X segundos",
      "Tocar um riff ou trecho de música do início ao fim sem errar",
      "Gravar 30 segundos tocando e ouvir para identificar erros",
    ],
    levelHints: {
      iniciante:
        "Use linguagem muito simples. Diga exatamente quais dedos usar (indicador, médio, anelar, mínimo). Evite termos técnicos em inglês. Descreva a postura da mão. Limite a 2-3 acordes por exercício.",
      intermediario:
        "Pode usar termos como 'palhetada alternada', 'pestana', 'arpejo'. Foque na limpeza do som e troca fluida entre acordes. Introduza posições além da primeira posição.",
      avancado:
        "Use terminologia técnica completa. Foque em velocidade, expressividade, dinâmica e musicalidade. Pode incluir improvisação sobre escalas e progressões.",
    },
    extraInstruction:
      "NUNCA mencione termos de bateria, piano ou instrumentos de sopro. Todos os exercícios devem ser realizados com o instrumento de cordas.",
  },

  // ─── TECLADO / PIANO ──────────────────────────────────────────────────────
  teclado: {
    terminology: [
      "mão direita",
      "mão esquerda",
      "posição dos dedos",
      "dedilhado",
      "legato",
      "staccato",
      "pedal de sustain",
      "oitava",
      "acorde de mão esquerda",
      "melodia de mão direita",
      "escala",
      "arpejo",
      "posição de cinco dedos",
      "cruzamento de polegar",
      "dinâmica (piano, forte, mezzoforte)",
      "pauta (clave de sol, clave de fá)",
      "nota",
      "tecla",
      "toque suave / toque firme",
    ],
    forbiddenTerms: [
      "acorde com pestana", "traste", "corda solta", "palheta", "palm mute",
      "bumbum", "caixa", "chimbal", "rudimento", "pedal de bumbo",
      "vocalise", "projeção vocal", "dicção", "respiração diafragmática",
      "embocadura", "arco", "golpe de arco",
    ],
    warmupDescription: "Exercícios de alongamento de dedos e escala na posição de cinco dedos com cada mão separadamente",
    warmupExamples: [
      "Tocar a escala de Dó maior (ou a escala da tonalidade da meta) com mão direita devagar, nota por nota",
      "Tocar a mesma escala com mão esquerda devagar",
      "Exercício de Hanon 1: cada dedo tocando independentemente em sequência ascendente e descendente",
    ],
    technicalFocusExamples: [
      "Coordenação entre mão direita e mão esquerda",
      "Legato suave: conectar as notas sem deixar espaço entre elas",
      "Staccato: tocar notas curtas e destacadas",
      "Uso correto do pedal de sustain",
      "Leitura de partitura nas duas pautas simultaneamente",
      "Dinâmica: tocar suave (piano) e forte",
    ],
    challengeExamples: [
      "Tocar melodia com mão direita enquanto marca o tempo com mão esquerda",
      "Executar trecho de música com as duas mãos juntas do início ao fim",
      "Tocar devagar com olhos fechados apenas pelo tato nas teclas",
    ],
    levelHints: {
      iniciante:
        "Use linguagem simples. Explique 'mão direita' e 'mão esquerda' separadamente. Comece sempre com uma mão de cada vez antes de juntar. Explique quais dedos (1=polegar, 2=indicador, 3=médio, 4=anelar, 5=mínimo).",
      intermediario:
        "Pode introduzir leitura de partitura básica. Foque na coordenação entre as mãos. Trabalhe dinâmica e articulação (legato, staccato).",
      avancado:
        "Foque em expressividade, pedal, dinâmica refinada, velocidade e musicalidade. Pode incluir ornamentos e fraseado musical avançado.",
    },
    extraInstruction:
      "NUNCA use termos de cordas (traste, pestana, corda solta) nem de bateria. Todos os exercícios devem ser executados no teclado/piano, descrevendo claramente qual mão e quais dedos.",
  },

  // ─── PERCUSSÃO / BATERIA ──────────────────────────────────────────────────
  percussao: {
    terminology: [
      "bumbum (bumbo)",
      "caixa",
      "chimbal (hi-hat)",
      "prato de condução",
      "prato de ataque (crash)",
      "prato de ride",
      "tons (tom-tom)",
      "surdo",
      "baqueta",
      "pé direito (pedal de bumbo)",
      "pé esquerdo (pedal do chimbal)",
      "rudimento",
      "paradiddle",
      "flam",
      "drag",
      "compasso",
      "tempo / pulsação",
      "groove",
      "fill (virada)",
      "metrônomo",
      "BPM",
    ],
    forbiddenTerms: [
      "acorde", "nota musical", "Dó", "Ré", "Mi", "Fá", "Sol", "Lá", "Si",
      "corda", "traste", "palheta", "pestana", "dedilhado",
      "mão esquerda para clave de fá", "mão direita para melodia",
      "vocalise", "projeção vocal", "respiração diafragmática",
      "embocadura", "arco", "pizzicato",
    ],
    warmupDescription: "Exercícios de aquecimento com rudimentos básicos nas mãos e pés separadamente, em tempo lento",
    warmupExamples: [
      "Rudimento Single Stroke Roll (RLRL) nas pernas (coxa), devagar e uniforme",
      "Double Stroke Roll (RRLL) nas coxas, aumentando gradualmente a velocidade",
      "Tocar pé de bumbo em tempo constante (semínimas) enquanto bate o chimbal com a mão",
    ],
    technicalFocusExamples: [
      "Coordenação entre mãos e pés (independência de membros)",
      "Groove básico de rock (bumbo, caixa e chimbal)",
      "Fill (virada) simples de 4 tempos nos tons",
      "Rudimentos: paradiddle, flam, drag",
      "Leitura de partitura de bateria",
      "Controle de dinâmica (tocar suave vs. forte)",
    ],
    challengeExamples: [
      "Tocar o groove por 2 minutos sem parar no metrônomo em X BPM",
      "Incluir um fill a cada 4 compassos sem perder o tempo",
      "Gravar um groove e ouvir para checar se bumbo e caixa estão encaixados",
    ],
    levelHints: {
      iniciante:
        "Comece com exercícios de mãos separado dos pés. Explique cada peça da bateria por nome. Use metrônomo em BPM baixo (60-80 BPM). Foque em regularidade do tempo antes da velocidade.",
      intermediario:
        "Introduza fills e grooves de estilos diferentes (rock, samba, funk). Trabalhe independência de membros. Aumente BPM progressivamente.",
      avancado:
        "Foque em expressividade, dinâmica, fills complexos, polirritmo e leitura de partitura avançada. Pode introduzir estilos como jazz e latin.",
    },
    extraInstruction:
      "NUNCA mencione notas musicais (Dó, Ré, Mi...), acordes ou qualquer conteúdo harmônico. A bateria é um instrumento rítmico. Todos os exercícios devem envolver apenas ritmo, tempo, coordenação e dinâmica.",
  },

  // ─── VOZ / CANTO ─────────────────────────────────────────────────────────
  voz: {
    terminology: [
      "respiração diafragmática",
      "apoio vocal",
      "projeção vocal",
      "vocalise",
      "dicção",
      "articulação",
      "afinação",
      "tessitura",
      "passagem de registro",
      "voz de peito",
      "voz de cabeça",
      "falsete",
      "vibrato vocal",
      "ressonância",
      "aquecimento vocal",
      "resfriamento vocal",
      "frase musical",
      "dinâmica vocal (piano, forte)",
      "postura corporal para o canto",
    ],
    forbiddenTerms: [
      "traste", "corda solta", "acorde com pestana", "palheta", "palm mute",
      "bumbum", "caixa", "chimbal", "rudimento", "pedal de bumbo",
      "arco", "golpe de arco", "pizzicato",
      "embocadura de bocal", "língua dupla",
    ],
    warmupDescription: "Aquecimento vocal com exercícios de respiração e vocalises curtos em tons confortáveis",
    warmupExamples: [
      "Respiração diafragmática: inspirar em 4 tempos, segurar 2, soltar em 8",
      "Humming (cantarolar com boca fechada) em escala ascendente e descendente",
      "Vocalise com vogal 'mah' do Dó até o Sol e voltando",
    ],
    technicalFocusExamples: [
      "Afinação em escala maior",
      "Dicção e articulação de consoantes na letra",
      "Passagem de registro (voz de peito para voz de cabeça)",
      "Vibrato natural e controlado",
      "Dinâmica: cantar piano (suave) e forte com controle",
      "Projeção vocal sem forçar a garganta",
    ],
    challengeExamples: [
      "Cantar uma frase da música com olhos fechados, focando só na afinação",
      "Gravar um trecho do repertório e ouvir para identificar pontos de melhoria",
      "Cantar a mesma frase 3 vezes mais forte e 3 vezes mais suave mantendo afinação",
    ],
    levelHints: {
      iniciante:
        "Foque em respiração correta e postura corporal. Vocalises simples em âmbito curto. Evite notas extremas da tessitura. Linguagem simples, sem termos técnicos excessivos.",
      intermediario:
        "Introduza passagem de registro, vibrato inicial e trabalho de dicção. Repertório mais desafiador. Foque na afinação em intervalos maiores.",
      avancado:
        "Trabalhe expressividade, fraseado, vibrato refinado, coloração vocal e domínio da dinâmica completa. Inclua técnicas avançadas de acordo com o estilo.",
    },
    extraInstruction:
      "A voz é o instrumento. NUNCA mencione instrumento físico nas mãos (violão, teclas, baqueta). Todos os exercícios são para a voz, corpo e respiração. Se houver acompanhamento de instrumento, mencione apenas como referência de afinação.",
  },

  // ─── SOPROS: Flauta, Saxofone, Clarinete, Trompete, Trombone, etc. ───────
  sopro: {
    terminology: [
      "embocadura",
      "coluna de ar",
      "apoio de ar",
      "língua simples",
      "língua dupla",
      "articulação",
      "digitação",
      "chaves",
      "nota longa (long tone)",
      "afinação",
      "vibrato",
      "dinâmica (piano, forte)",
      "ligado",
      "staccato",
      "respiração circular (avançado)",
      "bocal",
      "palheta (sopros de palheta: sax, clarinete)",
      "registo (grave, médio, agudo)",
    ],
    forbiddenTerms: [
      "traste", "corda solta", "acorde com pestana", "palheta da guitarra",
      "bumbum", "caixa", "chimbal", "rudimento",
      "vocalise (termo de canto)", "projeção vocal do cantor",
      "mão direita e esquerda no teclado", "tecla",
      "arco", "pizzicato",
    ],
    warmupDescription: "Exercícios de embocadura e notas longas para aquecer o instrumento e a musculatura facial",
    warmupExamples: [
      "Notas longas (long tones): sustentar cada nota por 8 tempos com ar constante e controlado",
      "Escala de Dó maior (ou escala da meta) em semínimas no metrônomo em BPM lento",
      "Exercício de articulação: tocar a mesma nota repetindo a sílaba 'tu-tu-tu' com língua",
    ],
    technicalFocusExamples: [
      "Embocadura firme e estável nas notas agudas",
      "Suavidade nas ligações entre notas (legato)",
      "Articulação staccato clara e limpa",
      "Digitação rápida e precisa nas chaves",
      "Controle de dinâmica (crescendo e decrescendo numa mesma nota)",
      "Afinação comparada ao afinador eletrônico",
    ],
    challengeExamples: [
      "Tocar um trecho de música do início ao fim sem parar, focando na afinação",
      "Aumentar BPM em 5 a cada repetição sem perder a limpeza das notas",
      "Gravar um exercício e comparar afinação com o afinador",
    ],
    levelHints: {
      iniciante:
        "Foque na formação correta da embocadura e na produção de som limpo. Explique a respiração diafragmática adaptada ao sopro. Comece com poucas notas e escala simples.",
      intermediario:
        "Introduza articulação variada (legato e staccato), vibrato suave e controle de dinâmica. Trabalhe escalas maiores e repertório intermediário.",
      avancado:
        "Foque em expressividade, vibrato refinado, velocidade e técnicas avançadas como língua dupla e respiração circular.",
    },
    extraInstruction:
      "NUNCA mencione cordas, trastes, teclas de piano ou peças de bateria. Todos os exercícios devem envolver ar, embocadura, digitação e articulação específicas do instrumento de sopro.",
  },

  // ─── CORDAS COM ARCO: Violino, Viola, Violoncelo, Contrabaixo ────────────
  cordas_arco: {
    terminology: [
      "arco",
      "golpe de arco",
      "détaché",
      "legato com arco",
      "staccato com arco",
      "spiccato",
      "pressão do arco",
      "velocidade do arco",
      "crina do arco",
      "ponto de contato (corda vs. arco)",
      "mão esquerda (posição)",
      "mão direita (arco)",
      "corda",
      "posições (1ª, 2ª, 3ª posição...)",
      "vibrato de corda",
      "pizzicato",
      "escala",
      "afinação por ouvido",
      "bequadro, sustenido, bemol",
    ],
    forbiddenTerms: [
      "traste", "palheta da guitarra", "acorde com pestana",
      "bumbum", "caixa", "chimbal", "rudimento",
      "vocalise de cantor", "embocadura de sopro",
      "tecla", "pedal de piano",
    ],
    warmupDescription: "Exercícios de arco em cordas soltas e notas longas para aquecimento de mão direita e escala de posição para mão esquerda",
    warmupExamples: [
      "Notas longas nas cordas soltas: arco inteiro de ponta a talão, ouvindo a qualidade do som",
      "Escala de Ré maior (ou escala da meta) em 1ª posição, uma nota por arco, devagar",
      "Exercício de détaché suave: colcheia por colcheia na corda mais grave",
    ],
    technicalFocusExamples: [
      "Distribuição de arco (talão, meio, ponta) em diferentes golpes",
      "Afinação por ouvido na posição",
      "Vibrato suave e controlado",
      "Cruzamento de cordas sem ruído",
      "Golpes de arco: détaché, legato, staccato, spiccato",
      "Mudança de posição fluida",
    ],
    challengeExamples: [
      "Tocar um trecho de música do início ao fim com arco constante e afinação correta",
      "Gravar e comparar com referência gravada para identificar afinação e timbre",
      "Tocar pizzicato um trecho que normalmente é tocado com arco, focando na afinação",
    ],
    levelHints: {
      iniciante:
        "Foque na postura do arco e na produção de som limpo nas cordas soltas. Explique a diferença entre mão do arco e mão das posições. Use linguagem simples e muitos detalhes de postura.",
      intermediario:
        "Introduza golpes de arco variados, mudanças de posição e vibrato inicial. Trabalhe afinação em escalas e peças de repertório.",
      avancado:
        "Foque em expressividade, vibrato refinado, golpes de arco avançados, dinâmica e musicalidade. Pode incluir cordas duplas e harmônicos.",
    },
    extraInstruction:
      "NUNCA mencione trastes, teclas, palheta de guitarra ou peças de bateria. O instrumento tem arco e cordas sem trastes. A afinação é feita pelo ouvido e por posição dos dedos na corda, não por trastes.",
  },

  // ─── GENÉRICO (Fallback para instrumento não mapeado) ────────────────────
  geral: {
    terminology: [
      "instrumento",
      "nota",
      "ritmo",
      "melodia",
      "técnica",
      "postura",
      "dedos",
      "prática",
      "repetição",
      "metrônomo",
    ],
    forbiddenTerms: [],
    warmupDescription: "Exercício de aquecimento adequado ao instrumento do aluno",
    warmupExamples: [
      "Exercício de aquecimento muscular dos membros usados no instrumento",
      "Tocar notas ou sons simples em ritmo lento para aquecer",
    ],
    technicalFocusExamples: [
      "Técnica básica do instrumento",
      "Exercício de ritmo e tempo",
      "Repertório inicial do nível do aluno",
    ],
    challengeExamples: [
      "Tocar um trecho de música do início ao fim",
      "Repetir o exercício aumentando a velocidade gradualmente",
    ],
    levelHints: {
      iniciante:
        "Use linguagem muito simples, passo a passo, voltada para quem está começando. Evite jargão técnico excessivo.",
      intermediario:
        "Use linguagem natural com termos básicos do instrumento. Foque na qualidade do som e precisão técnica.",
      avancado:
        "Use terminologia técnica completa. Foque em refinamento, expressividade e musicalidade.",
    },
    extraInstruction:
      "⚠️ O instrumento deste aluno não está mapeado no sistema. Crie exercícios adequados ao instrumento mencionado no contexto, adaptando a linguagem ao nível do aluno.",
  },
};

/**
 * Retorna o contexto pedagógico para um dado nome/categoria de instrumento.
 * Faz correspondência por categoria (campo do banco) ou por nome do instrumento.
 */
export function getInstrumentContext(
  instrumentName: string,
  instrumentCategory: string
): { context: InstrumentContext; resolvedCategory: InstrumentCategory } {
  const cat = instrumentCategory.toLowerCase().trim();
  const name = instrumentName.toLowerCase().trim();

  // Mapeamento por categoria (campo direto do banco)
  const categoryMap: Record<string, InstrumentCategory> = {
    // Cordas dedilhadas
    cordas: "cordas_dedilhadas",
    "cordas dedilhadas": "cordas_dedilhadas",
    cordas_dedilhadas: "cordas_dedilhadas",
    violao: "cordas_dedilhadas",
    guitarra: "cordas_dedilhadas",
    baixo: "cordas_dedilhadas",
    ukulele: "cordas_dedilhadas",
    cavaquinho: "cordas_dedilhadas",
    bandolim: "cordas_dedilhadas",
    // Teclado / Piano
    teclado: "teclado",
    piano: "teclado",
    orgao: "teclado",
    "teclado/piano": "teclado",
    // Percussão
    percussao: "percussao",
    percussão: "percussao",
    bateria: "percussao",
    // Voz / Canto
    voz: "voz",
    canto: "voz",
    vocal: "voz",
    "tecnica vocal": "voz",
    "técnica vocal": "voz",
    // Sopros
    sopros: "sopro",
    sopro: "sopro",
    flauta: "sopro",
    saxofone: "sopro",
    clarinete: "sopro",
    trompete: "sopro",
    trombone: "sopro",
    tuba: "sopro",
    oboa: "sopro",
    fagote: "sopro",
    // Cordas com arco
    "cordas com arco": "cordas_arco",
    cordas_arco: "cordas_arco",
    violino: "cordas_arco",
    viola: "cordas_arco",
    violoncelo: "cordas_arco",
    contrabaixo: "cordas_arco",
    celo: "cordas_arco",
  };

  // Tenta categoria primeiro
  if (categoryMap[cat]) {
    const resolved = categoryMap[cat];
    return { context: INSTRUMENT_CONTEXTS[resolved], resolvedCategory: resolved };
  }

  // Tenta pelo nome do instrumento
  if (categoryMap[name]) {
    const resolved = categoryMap[name];
    return { context: INSTRUMENT_CONTEXTS[resolved], resolvedCategory: resolved };
  }

  // Tenta match parcial no nome
  for (const [key, resolved] of Object.entries(categoryMap)) {
    if (name.includes(key) || key.includes(name)) {
      return { context: INSTRUMENT_CONTEXTS[resolved], resolvedCategory: resolved };
    }
  }

  // Fallback genérico
  return { context: INSTRUMENT_CONTEXTS.geral, resolvedCategory: "geral" };
}
