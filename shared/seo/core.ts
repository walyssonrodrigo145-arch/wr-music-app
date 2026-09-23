// ─── SEO: páginas core (home, planos, cadastro, login, legais) ────────────────
import type { SeoPage } from "./types";

export const corePages: SeoPage[] = [
  {
    path: "/",
    kind: "home",
    title: "MusicPro — Sistema de Gestão para Escolas de Música",
    description:
      "Gerencie alunos, aulas, mensalidades e cobranças da sua escola de música em um só lugar. Automação de WhatsApp, portal do aluno e teste grátis.",
    h1: "Sistema de gestão para escolas de música",
    keywords: [
      "sistema para escola de música",
      "software de gestão para professor de música",
      "app para escola de música",
      "controle de mensalidades",
      "agenda de aulas de música",
    ],
    intro:
      "O MusicPro organiza a rotina da sua escola de música: matrículas, agenda de aulas individuais e em turma, mensalidades, cobranças automáticas por WhatsApp, contratos digitais e portal do aluno — com relatórios prontos para decidir com clareza.",
    sections: [
      {
        heading: "Tudo que a sua escola precisa em um só sistema",
        paragraphs: [
          "Chega de planilhas espalhadas e mensagens perdidas no WhatsApp: o MusicPro centraliza a gestão pedagógica e financeira da escola de música, do primeiro contato do interessado até a renovação do contrato.",
        ],
        bullets: [
          "Gestão de alunos com ficha completa, responsáveis e histórico",
          "Agenda de aulas individuais, em turma e reposições",
          "Mensalidades com juros, multa, desconto e boleto/PIX",
          "Cobrança automática e lembretes pelo WhatsApp da escola",
          "Portal do aluno com aulas, materiais, progresso e pagamentos",
          "Contratos digitais com assinatura eletrônica",
        ],
      },
      {
        heading: "Feito para quem vive de música",
        paragraphs: [
          "Professores particulares, conservatórios e escolas com dezenas de professores usam o MusicPro para reduzir inadimplência, organizar a agenda e fidelizar alunos — sem depender de conhecimento técnico.",
        ],
      },
    ],
    faq: [
      {
        question: "O que é o MusicPro?",
        answer:
          "É um sistema de gestão para escolas de música e professores particulares que reúne alunos, aulas, mensalidades, cobranças no WhatsApp, contratos digitais e portal do aluno em uma única plataforma.",
      },
      {
        question: "Existe teste grátis?",
        answer:
          "Sim. Você cria sua conta e usa o MusicPro gratuitamente por 7 dias, com todos os recursos liberados e sem cartão de crédito para começar.",
      },
      {
        question: "Consigo cobrar as mensalidades pelo WhatsApp?",
        answer:
          "Sim. O MusicPro gera a cobrança (PIX, boleto ou cartão) e envia o lembrete direto no WhatsApp do aluno ou responsável, com o link ou o boleto em PDF anexado.",
      },
      {
        question: "Serve para professor particular?",
        answer:
          "Sim. Além das escolas, o MusicPro atende professores particulares que querem parar de controlar aulas e pagamentos em planilhas.",
      },
      {
        question: "Como funciona a migração do meu sistema atual?",
        answer:
          "O MusicPro tem uma área de migração assistida: você importa alunos, aulas já agendadas e mensalidades (inclusive histórico pago) em lote ou por planilha CSV.",
      },
    ],
    cta: { label: "Começar teste grátis de 7 dias", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/planos",
    kind: "plans",
    title: "Planos e Preços — MusicPro para Escolas de Música",
    description:
      "Planos do MusicPro com mensalidade a partir de R$ 49,99: gestão de alunos, aulas, mensalidades, WhatsApp automático e portal do aluno. Teste grátis.",
    h1: "Planos do MusicPro",
    keywords: ["preço sistema escola de música", "planos software de gestão musical", "quanto custa sistema para escola de música"],
    intro:
      "Escolha o plano pelo número de alunos ativos da sua escola. Todos incluem agenda, financeiro, automação de WhatsApp, contratos e portal do aluno.",
    sections: [
      {
        heading: "Um plano para cada estágio da escola",
        bullets: [
          "Professor particular: ideal para dar aula sozinho e organizar mensalidades",
          "Escolas em crescimento: mais alunos, professores e recursos de gestão",
          "Conservatórios e escolas grandes: alto volume, múltiplos professores e salas",
          "Excedentes: passou do limite do plano? Cada aluno extra tem valor por aluno/mês",
        ],
      },
      {
        heading: "Comece grátis e decida com calma",
        paragraphs: [
          "O teste grátis dá acesso completo por 7 dias — inclusive automações e portal do aluno. Você só paga se decidir continuar, e pode trocar de plano quando quiser.",
        ],
      },
    ],
    faq: [
      {
        question: "Posso trocar de plano depois?",
        answer: "Sim. A troca é feita na própria tela Assinatura e o valor é ajustado automaticamente para o próximo ciclo.",
      },
      {
        question: "O que acontece se eu passar do limite de alunos?",
        answer: "Os alunos excedentes são cobrados por aluno/mês conforme a política do plano, informada na tela de Assinatura.",
      },
      {
        question: "Preciso pagar para testar?",
        answer: "Não. São 7 dias grátis sem cartão de crédito para começar.",
      },
    ],
    cta: { label: "Criar conta e testar grátis", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/cadastro",
    kind: "signup",
    title: "Criar Conta Grátis — MusicPro",
    description:
      "Crie sua conta no MusicPro e teste 7 dias grátis a gestão completa da sua escola de música: alunos, aulas, mensalidades e WhatsApp automático.",
    h1: "Crie sua conta e teste o MusicPro grátis",
    keywords: ["cadastro sistema escola de música", "teste grátis gestão musical"],
    intro:
      "Em poucos minutos você cadastra sua escola, importa seus alunos e começa a organizar aulas e mensalidades. Sem cartão de crédito no teste.",
    cta: { label: "Criar minha conta", href: "/cadastro" },
    updatedAt: "2026-09-22",
    noindex: false,
  },
  {
    path: "/login",
    kind: "login",
    title: "Entrar — MusicPro",
    description: "Acesse sua conta MusicPro para gerenciar alunos, aulas, mensalidades e cobranças da sua escola de música.",
    h1: "Entrar no MusicPro",
    noindex: true,
    updatedAt: "2026-09-22",
  },
  {
    path: "/termos-de-uso",
    kind: "legal",
    title: "Termos de Uso — MusicPro",
    description: "Leia os termos de uso da plataforma MusicPro para gestão de escolas de música: contratação, uso aceitável, responsabilidades e cancelamento.",
    h1: "Termos de Uso",
    noindex: false,
    updatedAt: "2026-09-22",
  },
  {
    path: "/politica-de-privacidade",
    kind: "legal",
    title: "Política de Privacidade — MusicPro",
    description: "Saiba como o MusicPro coleta, usa e protege os dados da sua escola, dos professores e dos alunos (LGPD).",
    h1: "Política de Privacidade",
    keywords: ["política de privacidade sistema escola de música", "lgpd musicpro"],
    noindex: false,
    updatedAt: "2026-09-22",
  },
];
