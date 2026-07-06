import { Step } from "react-joyride";

export const tourSteps: Step[] = [
  // Dashboard Steps
  {
    target: "body",
    placement: "center",
    content: "Vamos começar o nosso tour guiado! Aqui você terá uma visão geral de toda a plataforma MusicPro.",
    title: "Bem-vindo ao Tour! 🚀",
    disableBeacon: true,
  },
  {
    target: "#tour-sidebar",
    placement: "right",
    content: "Aqui no menu lateral você encontra todas as áreas do sistema, como Dashboard, Alunos, Financeiro e muito mais.",
    title: "Menu Principal",
  },
  {
    target: "#tour-dashboard-stats",
    placement: "bottom",
    content: "Estes são os seus indicadores principais. Eles resumem como está a saúde da sua escola, como o total de alunos ativos e inadimplentes.",
    title: "Visão Geral",
  },
  {
    target: "#tour-dashboard-charts",
    placement: "top",
    content: "Acompanhe o crescimento da sua escola mês a mês através destes gráficos financeiros e de retenção.",
    title: "Gráficos",
  },
  {
    target: "#tour-user-menu",
    placement: "left",
    content: "Aqui você acessa o seu perfil, configurações do sistema e a opção de sair.",
    title: "Seu Perfil",
  },
  
  // Transition to Financeiro
  {
    target: "body",
    placement: "center",
    content: "Agora vamos conhecer a área Financeira. Clique em 'Próximo' para mudarmos de tela.",
    title: "Vamos para o Financeiro? 💰",
    data: { navigateTo: "/financeiro" }
  },
  
  // Financeiro Steps
  {
    target: "#tour-finance-cards",
    placement: "bottom",
    content: "Aqui você tem o controle total das suas finanças: saldo em caixa, previsão de recebimentos e inadimplência.",
    title: "Resumo Financeiro",
  },
  {
    target: "#tour-finance-tabs",
    placement: "bottom",
    content: "Você pode alternar entre Pagamentos (Mensalidades dos alunos), Receitas avulsas e Despesas da escola.",
    title: "Abas Financeiras",
  },
  {
    target: "#tour-new-charge",
    placement: "left",
    content: "Use este botão sempre que precisar gerar uma nova cobrança manual, boleto ou link PIX.",
    title: "Nova Cobrança",
  },

  // Transition to Agenda
  {
    target: "body",
    placement: "center",
    content: "Excelente! Que tal vermos como funciona a Agenda de aulas? Clique em 'Próximo' para ir até lá.",
    title: "Hora da Agenda 📅",
    data: { navigateTo: "/agenda" }
  },

  // Agenda Steps
  {
    target: "#tour-calendar-view",
    placement: "right",
    content: "Aqui fica o seu calendário. Você pode visualizar por dia, semana ou mês.",
    title: "Calendário",
  },
  {
    target: "#tour-new-lesson",
    placement: "left",
    content: "Para marcar uma nova aula, basta clicar neste botão ou clicar diretamente em um horário vazio no calendário.",
    title: "Agendar Aula",
  },

  // Transition to Alunos
  {
    target: "body",
    placement: "center",
    content: "Vamos dar uma olhada na gestão de Alunos agora? Clique em 'Próximo' para continuar.",
    title: "Gestão de Alunos 🎓",
    data: { navigateTo: "/alunos" }
  },

  // Alunos Steps
  {
    target: "#tour-students-list",
    placement: "top",
    content: "Nesta tabela ficam todos os seus alunos. Você pode pesquisar pelo nome e filtrar por status.",
    title: "Lista de Alunos",
  },
  {
    target: "#tour-new-student",
    placement: "left",
    content: "Para cadastrar um novo aluno e enviá-lo o acesso ao aplicativo, utilize este botão.",
    title: "Novo Aluno",
  },

  // Final Step
  {
    target: "body",
    placement: "center",
    content: "Isso é tudo por enquanto! Explore a plataforma e, se precisar rever este tour, você pode acessá-lo na área de Configurações > Ajuda.",
    title: "Tour Concluído! 🎉",
  }
];
