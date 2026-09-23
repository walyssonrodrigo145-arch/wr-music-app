// ─── SEO: páginas por segmento (escola, conservatório, professor, estúdio) ────
import type { SeoPage } from "./types";

export const segmentPages: SeoPage[] = [
  {
    path: "/para/escola-de-musica",
    kind: "segment",
    title: "Sistema para Escola de Música: Gestão Completa | MusicPro",
    description:
      "Organize alunos, professores, turmas, mensalidades e cobranças da sua escola de música. Teste grátis por 7 dias, sem cartão de crédito.",
    h1: "Sistema para escola de música",
    keywords: ["sistema para escola de música", "software para escola de música", "gestão de escola de música"],
    intro:
      "Sua escola com dezenas de alunos, vários professores e horários que mudam toda semana precisa de mais do que uma planilha. O MusicPro junta a operação pedagógica e financeira em um painel único.",
    sections: [
      {
        heading: "O dia a dia da escola resolvido",
        bullets: [
          "Cadastro de alunos com responsáveis, instrumentos e nível",
          "Agenda por professor, sala e aluno, com turmas e reposições",
          "Mensalidades por plano, bolsistas e descontos",
          "Cobrança e lembretes automáticos no WhatsApp da escola",
          "Contratos digitais e portal do aluno",
          "Relatórios de receita, inadimplência e frequência",
        ],
      },
      {
        heading: "Da matrícula à renovação",
        paragraphs: [
          "O MusicPro acompanha o ciclo completo do aluno: interessado, aula experimental, matrícula com contrato, aulas, pagamentos e renovação — com automações que avisam a equipe quando algo precisa de atenção.",
        ],
      },
      {
        heading: "Migração sem dor",
        paragraphs: [
          "Vem de outro sistema? Importe alunos, aulas já agendadas e mensalidades (inclusive as pagas) em lote ou por planilha, com relatório do que entrou e do que foi ignorado.",
        ],
      },
    ],
    faq: [
      {
        question: "Quantos alunos o MusicPro suporta?",
        answer: "O sistema atende de professores com poucos alunos até escolas e conservatórios com centenas de alunos ativos e múltiplos professores.",
      },
      {
        question: "Meus professores têm acesso separado?",
        answer: "Sim. Cada professor tem seu login, vê apenas os próprios alunos e aulas, e o administrador define o que cada perfil pode acessar.",
      },
    ],
    cta: { label: "Testar na minha escola", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/para/conservatorio",
    kind: "segment",
    title: "Sistema para Conservatório Musical | MusicPro",
    description:
      "Conservatórios com muitos professores, turmas, salas e horários: organize a grade, o financeiro e a comunicação com alunos em um só sistema.",
    h1: "Sistema para conservatório musical",
    keywords: ["sistema para conservatório musical", "gestão de conservatório", "software escola de música grande"],
    intro:
      "Conservatórios lidam com grade complexa, equipe grande e volume alto de mensalidades. O MusicPro dá visibilidade para a coordenação sem planilhas paralelas.",
    sections: [
      {
        heading: "Estrutura para operação grande",
        bullets: [
          "Múltiplos professores, salas e instrumentos",
          "Turmas com vários alunos e controle individual de presença",
          "Planos diferentes por curso, com valores e durações próprios",
          "Perfis de acesso: administração, coordenação, professor e aluno",
          "Relatórios por professor, curso e período",
        ],
      },
      {
        heading: "Comunicação institucional",
        paragraphs: [
          "Avisos, comunicados e lembretes saem pelo WhatsApp oficial com a identidade do conservatório — e o portal do aluno centraliza materiais, notas e pagamentos.",
        ],
      },
    ],
    faq: [
      {
        question: "Dá para controlar a carga horária por professor?",
        answer: "Sim. A agenda mostra as aulas por professor e a folha de pagamento calcula os valores com base nas aulas dadas e nas regras da escola.",
      },
      {
        question: "Consigo importar a grade de horários já existente?",
        answer: "Sim. As aulas já agendadas podem ser importadas por planilha CSV ou geradas em lote por turma e período.",
      },
    ],
    cta: { label: "Falar com o time", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/para/professor-particular",
    kind: "segment",
    title: "App para Professor de Música: Aulas, Cobranças e Alunos | MusicPro",
    description:
      "Professor particular: pare de controlar aula e mensalidade na caderneta. Organize horários, cobre pelo WhatsApp e acompanhe a evolução dos alunos.",
    h1: "MusicPro para professor particular",
    keywords: ["app para professor de música", "software para professor de música", "controle de aulas particulares de música"],
    intro:
      "Você dá aula, cobra, marca reposição e ainda responde mensagem? O MusicPro assume a parte operacional para você focar no que faz bem: ensinar.",
    sections: [
      {
        heading: "Feito para quem trabalha sozinho",
        bullets: [
          "Agenda simples com lembretes automáticos para o aluno",
          "Mensalidade com PIX, boleto ou cartão e cobrança no WhatsApp",
          "Controle de pagamentos e inadimplência por aluno",
          "Plano de estudo diário com IA para o aluno praticar em casa",
          "Contrato digital para formalizar a relação",
        ],
      },
      {
        heading: "Comece sem custo",
        paragraphs: [
          "Crie a conta, cadastre seus alunos e use 7 dias grátis. O plano de entrada foi pensado para quem dá aula sozinho, com preço de mensalidade de aluno.",
        ],
      },
    ],
    faq: [
      {
        question: "Serve para poucos alunos?",
        answer: "Sim. O MusicPro tem plano de entrada para professores particulares e cresce com você quando a agenda aumentar.",
      },
      {
        question: "O aluno precisa criar conta?",
        answer: "Para usar o portal e o plano de estudo, sim — o convite é enviado automaticamente. Para receber cobranças e lembretes, não é necessário.",
      },
    ],
    cta: { label: "Começar grátis como professor", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/para/estudio-de-musica",
    kind: "segment",
    title: "Sistema para Estúdio de Música: Alunos, Salas e Agenda | MusicPro",
    description:
      "Estúdios que dão aula e alugam salas: controle a agenda de salas, as aulas, os pacotes e o financeiro em um só lugar.",
    h1: "Sistema para estúdio de música",
    keywords: ["sistema para estúdio de música", "gestão de estúdio musical", "agenda de salas de estúdio"],
    intro:
      "Se o estúdio vende aula, hora de sala e pacotes, a agenda precisa enxergar tudo junto — sem conflito de horário entre locação e aula.",
    sections: [
      {
        heading: "Salas e aulas na mesma agenda",
        bullets: [
          "Cadastro de salas de estúdio com checagem de conflito",
          "Aulas individuais, turmas e locação por horário",
          "Pacotes e mensalidades com validade e saldo",
          "Cobranças por PIX, boleto ou cartão no WhatsApp",
          "Relatórios de ocupação e receita por sala",
        ],
      },
      {
        heading: "Financeiro separado por tipo de receita",
        paragraphs: [
          "Nem toda receita do estúdio vem de aula: hora de sala, pacote de horas, gravação e venda de material entram no caixa. O MusicPro registra cada cobrança no cadastro do cliente, com histórico de pagamentos e comprovantes, para você saber qual linha realmente sustenta o estúdio.",
        ],
      },
    ],
    faq: [
      {
        question: "Consigo controlar a ocupação das salas?",
        answer: "Sim. As salas ficam vinculadas às aulas e locações, e o painel mostra os horários livres e ocupados.",
      },
      {
        question: "Dá para vender pacote de horas?",
        answer: "Sim. Os planos podem representar pacotes de aulas ou horas, com duração e valor próprios.",
      },
    ],
    cta: { label: "Testar no meu estúdio", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
];
