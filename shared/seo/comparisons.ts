// ─── SEO: páginas comparativas (planilha × sistema, migração) ────────────────
import type { SeoPage } from "./types";

export const comparisonPages: SeoPage[] = [
  {
    path: "/comparativos/planilha-vs-sistema",
    kind: "comparison",
    title: "Planilha ou Sistema para Escola de Música? Veja o Comparativo",
    description:
      "Planilha resolve no começo, mas cobra um preço alto em tempo e inadimplência. Compare planilha e sistema de gestão para escola de música.",
    h1: "Planilha ou sistema de gestão para escola de música?",
    keywords: [
      "planilha para escola de música",
      "planilha vs sistema de gestão",
      "como organizar escola de música",
    ],
    intro:
      "Toda escola começa com uma planilha — e muitas continuam nela por anos. O problema não é a planilha em si, e sim o que ela não faz: avisar o aluno, cobrar no vencimento, controlar conflito de agenda ou mostrar a inadimplência real.",
    sections: [
      {
        heading: "O que a planilha custa (sem aparecer no extrato)",
        bullets: [
          "Horas por semana copiando e conferindo dados entre arquivos",
          "Mensalidade esquecida: aluno que atrasa e ninguém percebe",
          "Agenda em dois lugares e conflito de horário de sala/professor",
          "Histórico do aluno perdido quando alguém sai da escola",
          "Sem contrato digital e sem portal: tudo vira mensagem no WhatsApp",
          "Risco de LGPD: dados de alunos espalhados em arquivos locais",
        ],
      },
      {
        heading: "O que muda com um sistema dedicado",
        bullets: [
          "Mensalidades geradas em lote e cobranças enviadas automaticamente",
          "Agenda com regras de conflito, turma, reposição e presença",
          "Painel de receita, inadimplência e frequência em tempo real",
          "Contrato digital e portal do aluno",
          "Dados isolados por escola, com controle de acesso por perfil",
        ],
      },
      {
        heading: "Quando vale migrar",
        paragraphs: [
          "Se a escola já passou de 15–20 alunos ou tem mais de um professor, o custo de manter a planilha (tempo + mensalidades perdidas) normalmente supera a mensalidade do sistema. O MusicPro tem migração assistida para você trazer alunos, aulas e histórico financeiro sem digitar tudo de novo.",
        ],
      },
    ],
    faq: [
      {
        question: "Consigo importar minha planilha atual?",
        answer:
          "Sim. O MusicPro importa alunos, aulas agendadas e mensalidades (inclusive as pagas) por planilha CSV, com relatório do que foi importado e do que foi ignorado.",
      },
      {
        question: "Perco meu histórico financeiro?",
        answer: "Não. As mensalidades antigas podem ser importadas com status pago, mantendo o histórico do aluno dentro do sistema.",
      },
    ],
    cta: { label: "Migrar minha escola para o MusicPro", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
  {
    path: "/comparativos/como-migrar-de-sistema",
    kind: "comparison",
    title: "Como Migrar de Sistema de Gestão Escolar sem Perder Dados",
    description:
      "Passo a passo para trocar de sistema de gestão de escola de música: o que exportar, como importar alunos, aulas e mensalidades e o que conferir depois.",
    h1: "Como migrar de sistema sem perder dados",
    keywords: [
      "como migrar de sistema escolar",
      "importar alunos para sistema de gestão",
      "migração de escola de música",
    ],
    intro:
      "Trocar de sistema dá medo porque ninguém quer perder o histórico dos alunos nem parar a operação. Com o processo certo, a migração leva dias — não meses.",
    sections: [
      {
        heading: "Antes de migrar",
        bullets: [
          "Liste o que precisa ir: alunos, responsáveis, planos, aulas futuras, mensalidades pagas e em aberto",
          "Exporte os dados do sistema atual em CSV (peça ao fornecedor se não achar a opção)",
          "Defina os planos no sistema novo (valores, duração, aulas por semana)",
          "Escolha uma data de corte: até quando o sistema antigo é a fonte da verdade",
        ],
      },
      {
        heading: "Migração assistida no MusicPro",
        paragraphs: [
          "A aba Migração permite três caminhos: gerar aulas em lote para vários alunos (com horário, dia e quantidade individual), gerar mensalidades por aluno ou em lote (com plano individual por aluno) e importar planilhas CSV de aulas e mensalidades com prévia e relatório de erros.",
        ],
        bullets: [
          "Aulas: data inicial, dia da semana, horário e quantidade de semanas por aluno",
          "Mensalidades: mês inicial, competências já lançadas e saldo do plano",
          "Importação por planilha com validação linha a linha",
          "Tudo registrado para auditoria, sem emissão automática de cobranças",
        ],
      },
      {
        heading: "Depois de migrar",
        bullets: [
          "Confira alunos ativos, planos vinculados e vencimentos",
          "Rode uma emissão de teste e valide o valor das mensalidades",
          "Ative as automações de lembrete e cobrança no WhatsApp",
          "Comunique os alunos sobre o novo canal de pagamento",
        ],
      },
    ],
    faq: [
      {
        question: "Preciso parar as aulas durante a migração?",
        answer: "Não. A migração acontece em paralelo: você importa os dados e continua usando o sistema novo sem interromper a agenda.",
      },
      {
        question: "E se eu tiver muita coisa no sistema antigo?",
        answer:
          "A importação em lote suporta centenas de linhas por operação, e o relatório mostra exatamente o que entrou e o que precisa de ajuste.",
      },
    ],
    cta: { label: "Migrar minha escola agora", href: "/cadastro" },
    updatedAt: "2026-09-22",
  },
];
