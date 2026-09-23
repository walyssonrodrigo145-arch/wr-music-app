// ─── SEO: blog (hub + artigos) ───────────────────────────────────────────────
import type { SeoPage } from "./types";

export const blogPages: SeoPage[] = [
  {
    path: "/blog",
    kind: "blog",
    title: "Blog MusicPro — Gestão de Escolas de Música",
    description:
      "Conteúdo prático para donos de escola de música e professores: precificação, inadimplência, agenda, LGPD, marketing e gestão financeira.",
    h1: "Blog do MusicPro",
    keywords: ["blog escola de música", "gestão de escola de música", "dicas para professor de música"],
    intro:
      "Guias diretos ao ponto para quem administra escola de música: dinheiro, agenda, alunos e tecnologia — sem teoria vazia.",
    sections: [
      {
        heading: "Comece por aqui",
        bullets: [
          "Como precificar a mensalidade da sua escola de música sem perder margem",
          "Como reduzir inadimplência de alunos de música com processo (e não com cobrança constrangedora)",
          "Como organizar a agenda de aulas e acabar com o conflito de horários",
          "LGPD para escolas de música: o que a escola precisa fazer com os dados dos alunos",
        ],
      },
    ],
    cta: { label: "Testar o MusicPro grátis", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/blog/como-precificar-mensalidade-escola-de-musica",
    kind: "blog",
    title: "Como Precificar a Mensalidade da Sua Escola de Música (Passo a Passo)",
    description:
      "Aprenda a calcular o preço da mensalidade de música considerando custos, carga horária, inadimplência e valor percebido — com exemplos práticos.",
    h1: "Como precificar a mensalidade da sua escola de música",
    keywords: [
      "como precificar mensalidade escola de música",
      "quanto cobrar por aula de música",
      "preço mensalidade aulas de música",
    ],
    intro:
      "Precificar errado é o caminho mais rápido para trabalhar muito e lucrar pouco. A conta certa começa pelos custos reais — e termina no valor que o aluno percebe.",
    sections: [
      {
        heading: "1. Some o custo real da hora de aula",
        paragraphs: [
          "Liste os custos fixos mensais (aluguel, energia, internet, secretaria, software, manutenção de instrumentos) e os variáveis (impostos, taxa de cartão, materiais). Divida o total pela quantidade de horas de aula que a escola realmente entrega por mês — não pela capacidade teórica.",
        ],
        bullets: [
          "Custos fixos ÷ horas de aula efetivas = custo da hora",
          "Some o custo do professor (hora/aula ou salário proporcional)",
          "Inclua 5% a 10% para faltas, reposições e horas vagas",
        ],
      },
      {
        heading: "2. Precifique sobre a inadimplência, não depois dela",
        paragraphs: [
          "Se 8% das mensalidades atrasam de forma definitiva, o preço precisa embutir essa perda. Simule: para cada R$ 10.000 de receita prevista com 8% de perda, você só recebe R$ 9.200. Ajuste o preço ou ataque a inadimplência com processo — de preferência os dois.",
        ],
      },
      {
        heading: "3. Ancore no valor percebido",
        paragraphs: [
          "O aluno não paga por 'uma hora de aula'; paga por evolução, pertencimento e comodidade. Plano com material, portal de estudo, apresentação semestral e comunicação organizada sustenta um preço maior do que aula solta sem acompanhamento.",
        ],
        bullets: [
          "Diferencie planos por frequência, duração e recursos (ex.: 1x, 2x por semana)",
          "Crie uma aula experimental que mostre o método, não só o professor",
          "Mostre o progresso do aluno: quem vê evolução aceita melhor o reajuste",
        ],
      },
      {
        heading: "4. Revise uma vez por ano (e avise antes)",
        paragraphs: [
          "Reajuste anual é prática normal, desde que comunicada com antecedência e justificada. Use contrato para dar previsibilidade — o MusicPro gera o contrato digital com vigência e valor e envia para assinatura.",
        ],
      },
    ],
    faq: [
      {
        question: "Quanto cobrar por aula de música?",
        answer:
          "Não existe número único: depende do custo da sua hora, da região e do formato (individual ou turma). A regra prática é nunca cobrar abaixo do custo hora + impostos + uma margem mínima de 20%.",
      },
      {
        question: "Devo cobrar reposição de aula?",
        answer:
          "O ideal é prever no contrato: reposição com aviso prévio tem regra própria; falta sem aviso pode ter custo. O importante é ter a política escrita e visível para o aluno.",
      },
    ],
    cta: { label: "Gerar contratos e mensalidades no MusicPro", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/blog/como-reduzir-inadimplencia-alunos-musica",
    kind: "blog",
    title: "Como Reduzir a Inadimplência de Alunos de Música (7 Ações Práticas)",
    description:
      "Estratégias práticas para diminuir mensalidades atrasadas na escola de música: lembrete no canal certo, facilidade de pagamento, política clara e automação.",
    h1: "Como reduzir a inadimplência de alunos de música",
    keywords: [
      "inadimplência escola de música",
      "reduzir atraso de mensalidade",
      "cobrança de alunos de música",
    ],
    intro:
      "A maioria dos atrasos não é má-fé: é esquecimento. Quando a escola facilita o pagamento e lembra na hora certa, a inadimplência cai rápido — sem desgaste na relação.",
    sections: [
      {
        heading: "7 ações que funcionam",
        bullets: [
          "1. Lembre antes de vencer: aviso no WhatsApp 3 dias antes e no dia do vencimento",
          "2. Ofereça PIX, boleto e cartão: cada aluno paga no que já usa",
          "3. Envie o link/boleto direto na conversa, com um clique para pagar",
          "4. Tenha política escrita: tolerância, juros, multa e o que acontece após X dias",
          "5. Ofereça desconto para pagamento antecipado (ex.: 5% até o dia 5)",
          "6. Recupere atrasados com régua de mensagens, não com cobrança informal",
          "7. Automatize: quem depende de lembrar manualmente esquece na correria",
        ],
      },
      {
        heading: "Monte a régua de cobrança em 4 toques",
        paragraphs: [
          "Toque 1 (3 dias antes): lembrete amigável com o valor e o link. Toque 2 (dia do vencimento): 'vence hoje, segue o link'. Toque 3 (3 dias após): aviso de atraso com valor atualizado. Toque 4 (10 dias após): contato direto, com proposta de regularização. No MusicPro, essa régua pode rodar sozinha no WhatsApp da escola.",
        ],
      },
      {
        heading: "Meça o que importa",
        paragraphs: [
          "Acompanhe mensalmente: percentual de atraso, dias médios de atraso e valor total em aberto. Sem número, você só descobre o problema quando já virou bola de neve.",
        ],
      },
    ],
    faq: [
      {
        question: "Posso negar aula para aluno inadimplente?",
        answer:
          "Depende da sua política e do contrato. O mais comum é prever consequências progressivas (suspensão de reposição, comunicação formal) e manter o diálogo antes de medidas duras.",
      },
      {
        question: "Cobrar juros e multa afasta o aluno?",
        answer:
          "Não, quando está no contrato e é aplicado com transparência. A cobrança previsível mostra profissionalismo e protege a escola.",
      },
    ],
    cta: { label: "Automatizar cobranças no WhatsApp", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/blog/como-organizar-agenda-de-aulas",
    kind: "blog",
    title: "Como Organizar a Agenda de Aulas de Música e Evitar Conflitos",
    description:
      "Organize a grade de aulas da sua escola: horários por professor e sala, turmas, reposições e confirmação de presença — sem choque de horários.",
    h1: "Como organizar a agenda de aulas de música",
    keywords: [
      "organizar agenda de aulas de música",
      "horários aulas de música",
      "grade de horários escola de música",
    ],
    intro:
      "Agenda desorganizada vira conflito de sala, aluno espremido e professor sobrecarregado. A solução é ter uma única fonte de verdade — e regras claras de reposição.",
    sections: [
      {
        heading: "Comece pela grade, não pelos pedidos",
        paragraphs: [
          "Monte a grade por professor e sala antes de encaixar alunos: defina os blocos de horário (a duração padrão ajuda), os intervalos e os períodos de cada profissional. Só então encaixe as matrículas nos espaços disponíveis.",
        ],
        bullets: [
          "Blocos de horário com duração fixa (40, 45, 50 ou 60 minutos)",
          "Reserve horários nobres para turmas e instrumentos com mais procura",
          "Deixe folga para reposição e remarcação",
        ],
      },
      {
        heading: "Regras de reposição que todos entendem",
        bullets: [
          "Aviso mínimo (ex.: 24h) para remarcar sem custo",
          "Quantidade de reposições por mês e prazo para usar o crédito",
          "Reposição condicionada a vaga na agenda",
          "Falta do professor: reposição garantida",
        ],
      },
      {
        heading: "Confirmação de presença reduz falta",
        paragraphs: [
          "Quando o aluno recebe o lembrete e confirma presença (ou avisa que não vai), a escola abre o horário para reposição ou para outro aluno. Só esse processo recupera horas que hoje simplesmente se perdem.",
        ],
      },
    ],
    faq: [
      {
        question: "Qual a melhor duração de aula?",
        answer:
          "Para crianças, blocos de 40 a 50 minutos funcionam melhor; adultos costumam preferir 50 a 60. O importante é padronizar para a agenda ficar previsível.",
      },
      {
        question: "Como evitar conflito de sala?",
        answer:
          "Use um sistema que valide a sala no momento do agendamento — se o espaço já estiver ocupado, ele bloqueia o conflito antes de acontecer.",
      },
    ],
    cta: { label: "Organizar minha agenda no MusicPro", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/blog/lgpd-para-escolas-de-musica",
    kind: "blog",
    title: "LGPD para Escolas de Música: o que a Sua Escola Precisa Fazer",
    description:
      "Guia prático de LGPD para escolas de música: quais dados você guarda, por quanto tempo, quem acessa e como reduzir risco com processos simples.",
    h1: "LGPD para escolas de música: guia prático",
    keywords: [
      "lgpd escola de música",
      "proteção de dados alunos",
      "lgpd professor particular",
    ],
    intro:
      "Sua escola guarda CPF, endereço, telefone, dados de responsáveis e informações financeiras de alunos. Isso é dado pessoal — e a LGPD vale para escola de música do mesmo jeito que para qualquer empresa.",
    sections: [
      {
        heading: "O básico que a escola precisa fazer",
        bullets: [
          "Mapear quais dados pessoais você coleta e para quê",
          "Coletar só o necessário (evite pedir dado que não usa)",
          "Ter uma finalidade clara e informar o titular (aluno/responsável)",
          "Controlar quem acessa o quê dentro da equipe",
          "Definir prazo de guarda e o que fazer quando o aluno sai",
          "Proteger os arquivos: nada de planilha no computador da recepção sem controle",
        ],
      },
      {
        heading: "Onde a planilha te coloca em risco",
        paragraphs: [
          "Planilhas locais, grupos de WhatsApp com prints e pastas compartilhadas sem controle são os cenários mais comuns de vazamento. Sem registro de acesso, a escola não consegue nem provar quem viu o quê.",
        ],
      },
      {
        heading: "Como um sistema ajuda",
        bullets: [
          "Acesso por perfil: cada pessoa vê apenas o que precisa",
          "Histórico de ações e trilha de auditoria",
          "Dados em ambiente com backup e controle de acesso",
          "Consentimento e política de privacidade publicados",
        ],
      },
    ],
    faq: [
      {
        question: "Escola de música é obrigada a ter encarregado de dados (DPO)?",
        answer:
          "A obrigação varia com o porte e o volume de dados. Para a maioria das escolas pequenas, o caminho é ter processo documentado e um responsável interno pelo tema.",
      },
      {
        question: "Posso mandar cobrança no WhatsApp do aluno?",
        answer:
          "Sim, desde que o dado seja usado para a finalidade contratada (cobrança) e a escola mantenha o mínimo necessário na mensagem — evite expor valores e dados em grupos.",
      },
      {
        question: "O que fazer quando o aluno pede exclusão dos dados?",
        answer:
          "Atenda dentro do prazo legal, resguardando o que a legislação exige manter (por exemplo, registros fiscais e contratuais).",
      },
    ],
    cta: { label: "Organizar os dados da minha escola", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
];
