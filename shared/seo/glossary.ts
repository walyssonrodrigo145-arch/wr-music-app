// ─── SEO: glossário (hub + termos) ───────────────────────────────────────────
import type { SeoPage } from "./types";

const TERMS: Array<{ slug: string; term: string; short: string; text: string[]; faqQ?: string; faqA?: string }> = [
  {
    slug: "mensalidade",
    term: "Mensalidade",
    short: "valor mensal pago pelo aluno de música",
    text: [
      "Mensalidade é o valor recorrente pago pelo aluno (ou responsável) para manter as aulas de música. Pode cobrir uma quantidade fixa de aulas por semana, material didático e acesso a recursos da escola, conforme o plano contratado.",
      "Na prática, a mensalidade tem três informações críticas: valor, vencimento e periodicidade. Escolas com planos diferentes precisam controlar cada combinação por aluno — tarefa que fica inviável em planilha quando a base cresce.",
    ],
    faqQ: "Mensalidade e taxa de matrícula são a mesma coisa?",
    faqA: "Não. A matrícula é cobrada uma vez, na entrada do aluno (e pode incluir material); a mensalidade é recorrente e mantém as aulas ao longo do curso.",
  },
  {
    slug: "inadimplencia",
    term: "Inadimplência",
    short: "percentual de mensalidades não pagas no prazo",
    text: [
      "Inadimplência é o percentual de cobranças que não foram pagas até o vencimento (ou que nunca foram pagas). Na escola de música, costuma ser medida por valor em aberto e por dias médios de atraso.",
      "Mais do que um número financeiro, a inadimplência afeta o caixa, a previsibilidade e o clima da equipe. Lembrete automático, facilidade de pagamento e política clara são as alavancas mais eficazes para reduzir.",
    ],
  },
  {
    slug: "competencia",
    term: "Competência",
    short: "mês a que a mensalidade se refere",
    text: [
      "Competência é o mês/a que a mensalidade se refere: a competência de setembro pode ter vencimento em setembro ou outubro, dependendo do dia de vencimento do aluno.",
      "Separar competência de vencimento evita confusão no controle financeiro: a competência organiza o 'mês da aula' e o vencimento organiza o fluxo de caixa. O MusicPro mostra as mensalidades pelo vencimento para facilitar a cobrança e usa a competência para impedir duplicidade.",
    ],
  },
  {
    slug: "reposicao-de-aula",
    term: "Reposição de aula",
    short: "aula de recuperação por falta ou cancelamento",
    text: [
      "Reposição é a aula dada em outro horário para compensar uma falta (do aluno ou do professor) ou um feriado. Funciona melhor com regras escritas: prazo mínimo de aviso, limite mensal e validade do crédito.",
      "Automatizar a reposição — com crédito no cadastro do aluno e agenda que mostra horários livres — evita que a escola perca aula de um lado e cobre do outro.",
    ],
  },
  {
    slug: "taxa-de-inscricao",
    term: "Taxa de inscrição",
    short: "valor cobrado na entrada do aluno",
    text: [
      "A taxa de inscrição (ou matrícula) é cobrada uma vez, na entrada do aluno, e normalmente cobre material didático, camiseta, apostila ou o processo administrativo de matrícula.",
      "No MusicPro, a taxa pode ser somada à primeira mensalidade (em vez de uma cobrança separada), o que reduz o atrito da matrícula e facilita o pagamento pelo responsável.",
    ],
  },
  {
    slug: "contrato-de-prestacao-de-servicos",
    term: "Contrato de prestação de serviços",
    short: "documento que formaliza a relação escola-aluno",
    text: [
      "É o documento que formaliza a relação entre a escola de música e o aluno (ou responsável legal): objeto, valor da mensalidade, vigência, política de reposição, rescisão e foro.",
      "Contratos digitais com assinatura eletrônica dão segurança jurídica sem papelada, e permitem reajuste e renovação com histórico organizado.",
    ],
  },
  {
    slug: "lgpd",
    term: "LGPD",
    short: "Lei Geral de Proteção de Dados aplicada à escola",
    text: [
      "LGPD é a Lei Geral de Proteção de Dados (Lei 13.709/2018), que regula como empresas tratam dados pessoais — CPF, endereço, telefone, dados de saúde e informações financeiras dos alunos.",
      "Para escolas de música, o essencial é mapear os dados coletados, limitar o acesso por perfil, definir prazo de guarda e ter política de privacidade clara. Sistemas com controle de acesso e auditoria ajudam a cumprir essa rotina.",
    ],
  },
  {
    slug: "funil-de-matriculas",
    term: "Funil de matrículas",
    short: "etapas do interessado até virar aluno",
    text: [
      "Funil de matrículas é o caminho do interessado até virar aluno: contato, aula experimental, proposta, matrícula e primeira cobrança. Cada etapa que 'vaza' representa dinheiro investido em divulgação sem retorno.",
      "Medir quantos interessados viram aula experimental e quantos viram matrícula mostra onde a escola perde mais — e o que priorizar: atendimento mais rápido, proposta mais clara ou acompanhamento pós-experimental.",
    ],
  },
];

export const glossaryPages: SeoPage[] = [
  {
    path: "/glossario",
    kind: "hub",
    title: "Glossário de Gestão para Escolas de Música | MusicPro",
    description:
      "Termos essenciais para gerir escola de música: mensalidade, inadimplência, competência, reposição, taxa de inscrição, contrato, LGPD e funil de matrículas.",
    h1: "Glossário de gestão de escolas de música",
    keywords: ["glossário escola de música", "termos gestão musical"],
    intro:
      "Um dicionário rápido com os termos que aparecem no dia a dia de quem administra aulas e mensalidades.",
    sections: [
      {
        heading: "Termos",
        bullets: TERMS.map((t) => `${t.term} — ${t.short}`),
      },
    ],
    cta: { label: "Ver o MusicPro na prática", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  ...TERMS.map<SeoPage>((t) => ({
    path: `/glossario/${t.slug}`,
    kind: "glossary",
    title: `${t.term}: o que é (Glossário) | MusicPro`,
    description: `O que é ${t.term.toLowerCase()} na gestão de escola de música? Entenda o conceito, por que importa e como aplicar no dia a dia — guia rápido do MusicPro.`,
    h1: `${t.term}: o que é`,
    keywords: [`${t.term.toLowerCase()} escola de música`, `o que é ${t.term.toLowerCase()}`],
    intro: `${t.term} é ${t.short}. Neste verbete explicamos o conceito e como ele aparece na rotina da escola de música.`,
    sections: [{ paragraphs: t.text }],
    faq: t.faqQ && t.faqA ? [{ question: t.faqQ, answer: t.faqA }] : undefined,
    cta: { label: "Testar o MusicPro grátis", href: "/cadastro" },
    updatedAt: "2026-09-22",
  })),
];
