// ─── SEO: hub + páginas de funcionalidades ───────────────────────────────────
import type { SeoPage } from "./types";

export const featurePages: SeoPage[] = [
  {
    path: "/funcionalidades",
    kind: "hub",
    title: "Funcionalidades — MusicPro para Escolas de Música",
    description:
      "Conheça os recursos do MusicPro: financeiro com boleto e PIX, agenda de aulas, WhatsApp automático, portal do aluno, contratos digitais e relatórios.",
    h1: "Funcionalidades para gerir sua escola de música",
    keywords: ["funcionalidades sistema escola de música", "recursos gestão musical"],
    intro:
      "Do financeiro ao relacionamento com o aluno: veja como cada módulo do MusicPro resolve uma parte da rotina da escola de música.",
    sections: [
      {
        heading: "Módulos do MusicPro",
        bullets: [
          "Financeiro e mensalidades: cobranças, baixa de pagamento, juros, multa e descontos",
          "Agenda de aulas: individual, turma, reposição e visão de professores e salas",
          "WhatsApp automático: lembretes de aula, cobranças e avisos",
          "Portal do aluno: aulas, materiais, progresso e pagamentos",
          "Contratos digitais: modelos próprios com assinatura eletrônica",
          "Relatórios e indicadores: alunos ativos, inadimplência, receita e frequência",
        ],
      },
    ],
    cta: { label: "Testar todos os módulos grátis", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/funcionalidades/financeiro",
    kind: "feature",
    title: "Financeiro para Escola de Música: Boleto e PIX | MusicPro",
    description:
      "Controle mensalidades, gere boleto e PIX, dê baixa nos pagamentos, aplique juros e multa e reduza a inadimplência da sua escola de música.",
    h1: "Financeiro e mensalidades da escola de música",
    keywords: [
      "controle de mensalidades escola de música",
      "sistema financeiro para escola de música",
      "cobrança de mensalidade por boleto",
      "gerar pix mensalidade alunos",
    ],
    intro:
      "O módulo financeiro foi feito para quem cobra mensalidade de aluno de música: valores por plano, vencimentos por aluno, desconto para pagamento antecipado, juros e multa automáticos e emissão de cobrança no PIX, boleto ou cartão.",
    cover: { src: "/images/relatorios-preview.png", alt: "Financeiro do MusicPro com mensalidades, inadimplência e relatórios" },
    sections: [
      {
        heading: "Mensalidades sem retrabalho",
        paragraphs: [
          "Gere as mensalidades do mês para um aluno ou para a escola inteira, com valor por plano, vencimento individual e periodicidade (mensal, bimestral, trimestral, semestral ou anual). O sistema ignora competências já lançadas e mantém o histórico de tudo.",
        ],
        bullets: [
          "Valor vindo do plano do aluno (com desconto de bolsista, quando houver)",
          "Vencimento por aluno com opção de postergar para dia útil",
          "Desconto para pagamento antecipado, juros e multa por atraso",
          "Baixa de pagamento com valor pago e valor original registrados",
        ],
      },
      {
        heading: "Cobrança no canal certo",
        paragraphs: [
          "Com a integração Asaas (PIX, boleto e cartão) ou Mercado Pago e InfinitePay, a escola emite a cobrança e envia o lembrete pelo WhatsApp — com o link do checkout ou o boleto em PDF anexado, conforme a preferência da escola.",
        ],
      },
      {
        heading: "Inadimplência sob controle",
        paragraphs: [
          "A lista de mensalidades mostra status (a vencer, vencida, paga), dias de atraso e valor atualizado. Relatórios de receita e inadimplência ajudam a agir antes do problema crescer.",
        ],
      },
    ],
    faq: [
      {
        question: "Consigo cobrar por boleto além do PIX?",
        answer:
          "Sim. No Asaas, a escola pode emitir boleto (com PDF e linha digitável) ou PIX; no modo de envio em boleto, o lembrete do WhatsApp leva a linha digitável e anexa o PDF.",
      },
      {
        question: "Dá para dar desconto para quem paga antes?",
        answer: "Sim. O desconto antecipado é configurável por tipo (valor fixo ou percentual) e por número de dias antes do vencimento.",
      },
      {
        question: "O sistema calcula juros e multa automaticamente?",
        answer: "Sim. A multa é aplicada uma vez e os juros incidem por dia de atraso, com os valores atualizados na lista e na cobrança.",
      },
      {
        question: "A escola precisa emitir cobrança manualmente todo mês?",
        answer:
          "Não. Você pode gerar as mensalidades em lote e automatizar os lembretes; a emissão da cobrança acontece no momento do envio.",
      },
    ],
    cta: { label: "Organizar meu financeiro grátis", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/funcionalidades/agenda-aulas",
    kind: "feature",
    title: "Agenda de Aulas de Música: Turma e Reposição | MusicPro",
    description:
      "Agende aulas individuais e em turma, controle presença, remarcações e reposições, e veja a agenda de cada professor e sala da escola de música.",
    h1: "Agenda de aulas individuais e em turma",
    keywords: [
      "agenda de aulas de música",
      "sistema de agendamento para escola de música",
      "controle de presença alunos de música",
      "reposição de aula de música",
    ],
    intro:
      "Organize a semana da escola com visão por dia, semana, mês e lista. Cada aula tem aluno, professor, sala, duração e status — e a presença pode ser confirmada pelo próprio aluno.",
    cover: { src: "/images/aulas-preview.png", alt: "Agenda de aulas individuais e em turma no MusicPro" },
    sections: [
      {
        heading: "Individual e turma no mesmo calendário",
        paragraphs: [
          "Aulas individuais recorrentes, turmas com vários alunos no mesmo horário e aulas experimentais convivem no mesmo calendário, com checagem de conflito de horário por aluno, professor e sala.",
        ],
        bullets: [
          "Aulas em turma: adicione ou remova alunos de uma sessão ou de todas as próximas",
          "Duração padrão configurável (30, 40, 45, 60, 90 ou 120 minutos)",
          "Reagendamento e reposição com crédito de aula",
          "Chamada com presença, falta e aula concluída",
        ],
      },
      {
        heading: "Menos faltas com confirmação e lembretes",
        paragraphs: [
          "O aluno recebe o lembrete no WhatsApp e pode confirmar presença ou avisar que não irá. A escola enxerga as respostas na agenda e consegue liberar o horário para outro aluno antes de perder a aula.",
        ],
      },
    ],
    faq: [
      {
        question: "Como funciona a aula em turma?",
        answer:
          "Você escolhe os alunos marcados como turma, o horário, a duração e por quantas semanas a turma se repete. Depois é possível adicionar ou remover alunos só daquela aula ou de todas as próximas.",
      },
      {
        question: "O aluno pode confirmar presença sozinho?",
        answer: "Sim. O lembrete enviado no WhatsApp traz um link (e botões, quando ativado) para o aluno confirmar presença sem precisar fazer login.",
      },
      {
        question: "Consigo controlar reposição de aulas faltadas?",
        answer: "Sim. O módulo de reposições registra motivo, aprova e agenda a aula de reposição com crédito para o aluno.",
      },
    ],
    cta: { label: "Testar a agenda grátis", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/funcionalidades/whatsapp-automatico",
    kind: "feature",
    title: "WhatsApp Automático para Escola de Música | MusicPro",
    description:
      "Automatize lembretes de aula, cobranças de mensalidade, avisos e reengajamento no WhatsApp oficial da escola — com robô de atendimento e recepcionista IA.",
    h1: "WhatsApp automático para escola de música",
    keywords: [
      "whatsapp automático escola de música",
      "robô de cobrança whatsapp",
      "lembrete de aula whatsapp",
      "chatbot escola de música",
    ],
    intro:
      "Use o próprio número da escola para falar com alunos e responsáveis: lembretes de aula, cobranças com link ou boleto, avisos e confirmação de presença — tudo automático.",
    cover: { src: "/images/lembretes-preview.png", alt: "Lembretes e cobranças automáticas do MusicPro no WhatsApp" },
    sections: [
      {
        heading: "Automações que economizam horas",
        bullets: [
          "Lembrete de aula com confirmação de presença",
          "Cobrança de mensalidade no vencimento e depois do atraso",
          "Aviso de aula cancelada ou remarcada",
          "Comunicados em massa para todos os alunos",
          "Reengajamento de aluno inativo",
        ],
      },
      {
        heading: "Robô que atende de verdade",
        paragraphs: [
          "Com o Robô de Autoatendimento e a Recepcionista Virtual (IA), o aluno tira dúvidas, consulta próxima aula e mensalidade e até agenda aula pelo WhatsApp — e os casos complexos são encaminhados para um atendente humano.",
        ],
      },
      {
        heading: "Sem risco de banimento",
        paragraphs: [
          "As mensagens saem com pausas humanizadas e o sistema monitora a conexão da sessão, reduzindo o risco de bloqueio do número e mantendo a escola sempre disponível.",
        ],
      },
    ],
    faq: [
      {
        question: "Preciso de outro número de WhatsApp?",
        answer:
          "Você conecta o número da escola (celular ou chip dedicado) via Evolution API e o sistema passa a enviar as mensagens por ele.",
      },
      {
        question: "O envio é automático ou manual?",
        answer:
          "Os dois. Você pode disparar manualmente pelos lembretes ou deixar as regras de automação enviarem sozinhas, conforme a configuração da escola.",
      },
      {
        question: "O robô pode enviar boleto?",
        answer:
          "Sim. No modo boleto, a mensagem leva a linha digitável e o PDF do boleto vai anexado na conversa.",
      },
    ],
    cta: { label: "Automatizar meu WhatsApp", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/funcionalidades/portal-do-aluno",
    kind: "feature",
    title: "Portal do Aluno: Aulas, Progresso, Materiais e Pagamentos | MusicPro",
    description:
      "Dê ao aluno um portal com agenda de aulas, materiais, exercícios, plano de estudo com IA, progresso, avisos e histórico financeiro.",
    h1: "Portal do aluno",
    keywords: ["portal do aluno escola de música", "app para aluno de música", "plano de estudo musical online"],
    intro:
      "Cada aluno recebe um acesso próprio para acompanhar as aulas, estudar com o plano diário e resolver a parte financeira sem precisar falar com a secretaria.",
    cover: { src: "/images/alunos-preview.png", alt: "Portal do aluno e gestão de alunos no MusicPro" },
    sections: [
      {
        heading: "O aluno no controle da própria evolução",
        bullets: [
          "Agenda e histórico de aulas",
          "Plano de estudo diário gerado com IA e cronômetro de prática",
          "Materiais, cifras, exercícios e vídeos do professor",
          "Progresso com metas, conquistas e rankings",
          "Histórico de mensalidades, PIX e comprovantes",
          "Avisos e comunicados da escola",
        ],
      },
      {
        heading: "Mais retenção, menos suporte",
        paragraphs: [
          "Com o portal, o aluno encontra sozinho as informações que antes viravam mensagens para a escola — e enxerga valor no acompanhamento, o que aumenta a permanência.",
        ],
      },
    ],
    faq: [
      {
        question: "O aluno precisa instalar aplicativo?",
        answer:
          "O portal funciona no navegador e pode ser instalado como app (PWA) no celular, com notificações quando o aluno permite.",
      },
      {
        question: "O comprovante do PIX pode ser enviado pelo portal?",
        answer: "Sim. O aluno pode anexar o comprovante e a escola recebe a notificação para conferir e dar baixa.",
      },
    ],
    cta: { label: "Conhecer o portal do aluno", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/funcionalidades/contratos-digitais",
    kind: "feature",
    title: "Contratos Digitais para Escola de Música | MusicPro",
    description:
      "Monte modelos de contrato em blocos, gere o contrato do aluno com dados preenchidos automaticamente e colete a assinatura eletrônica.",
    h1: "Contratos digitais para escola de música",
    keywords: ["contrato de prestação de serviços escola de música", "contrato digital assinatura eletrônica", "modelo de contrato para professor de música"],
    intro:
      "Crie modelos de contrato com as cláusulas da sua escola e gere o documento do aluno em segundos, com nome, CPF, valor da mensalidade e vigência preenchidos automaticamente.",
    cover: { src: "/images/dashboard-preview.png", alt: "Painel do MusicPro com contratos digitais e modelos da escola" },
    sections: [
      {
        heading: "Modelos em blocos, do seu jeito",
        paragraphs: [
          "O editor organiza o contrato em itens (título, contratante, contratada, cláusulas, parágrafo único, assinaturas), com variáveis dinâmicas e prévia em tempo real. Quando é um aluno menor de idade, o modelo de responsável legal entra em ação.",
        ],
        bullets: [
          "Variáveis automáticas: aluno, responsável, escola, instrumento, valor e datas",
          "Assinatura eletrônica com trilha de auditoria",
          "Histórico de status: enviado, aguardando, assinado, cancelado",
          "Renovação de contrato com poucos cliques",
        ],
      },
    ],
    faq: [
      {
        question: "A assinatura eletrônica tem validade?",
        answer:
          "Os contratos são assinados por plataforma de assinatura eletrônica com registro de autoria, data e hora, e o PDF assinado fica guardado no sistema.",
      },
      {
        question: "Consigo usar o contrato que já uso hoje?",
        answer: "Sim. Você cola o texto atual no editor em blocos e o sistema passa a preencher as variáveis automaticamente.",
      },
    ],
    cta: { label: "Criar meu modelo de contrato", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
];
