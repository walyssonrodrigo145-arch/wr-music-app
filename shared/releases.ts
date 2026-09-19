// 📣 Changelog versionado do MusicPro (FONTE ÚNICA das "Novidades").
//
// COMO MANTER (100% automático — sem cadastro no sistema):
// Ao lançar uma funcionalidade, adicione um objeto `Release` NO TOPO da lista
// (mais recente primeiro). Use `version` única (recomendado: AAAA.MM.DD ou semver)
// e `date` no formato YYYY-MM-DD. O app lê daqui e mostra badge + modal + histórico.
//
// Nada precisa ser cadastrado no banco: o conteúdo é este arquivo; só o estado
// de "já vi" é persistido por usuário (users.lastSeenReleaseVersion).

export type ReleaseItemType = "novo" | "melhoria" | "correcao";

export interface ReleaseItem {
  type: ReleaseItemType;
  title: string;
  description?: string;
}

export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  summary?: string;
  items: ReleaseItem[];
}

export const RELEASES: Release[] = [
  {
    version: "2026.09.19",
    date: "2026-09-19",
    title: "Metrônomo funcionando no iPhone e iPad",
    summary: "O metrônomo do Plano Diário voltou a tocar no iOS — inclusive com o celular no silencioso e depois de bloquear a tela.",
    items: [
      { type: "correcao", title: "Som no iPhone mesmo no modo silencioso", description: "O áudio do metrônomo agora usa a sessão de reprodução do iOS, então toca mesmo com a chave de silencioso ligada." },
      { type: "correcao", title: "Volta a tocar depois de bloquear a tela ou receber ligação", description: "Se o sistema interromper o áudio (tela bloqueada, chamada, Siri), o metrônomo retoma sozinho ao voltar para o app." },
      { type: "melhoria", title: "Aviso quando o áudio não inicia", description: "Se o aparelho bloquear o som, aparece um aviso orientando a tocar novamente — antes o botão parecia morto, sem explicação." },
    ],
  },
  {
    version: "2026.09.18",
    date: "2026-09-18",
    title: "Correções na agenda e nas turmas",
    summary: "Excluir/remarcar séries futuras agora funciona de verdade, e as aulas de turma aparecem identificadas com o nome da turma.",
    items: [
      { type: "correcao", title: "Excluir e remarcar toda a série (futuras)", description: "Ao escolher 'toda a série (futuras)' em uma aula de turma, as semanas seguintes também são excluídas/remarcadas. Antes apenas a sessão selecionada era afetada." },
      { type: "correcao", title: "Card de turma na agenda do dia", description: "As aulas de turma agora aparecem em roxo, com selo TURMA, o nome da turma e a quantidade de alunos — antes pareciam aula individual." },
      { type: "correcao", title: "Menu de ações (3 pontinhos) no modal do dia", description: "O menu não abre mais atrás do modal e as opções Editar/Excluir Registro voltaram a funcionar." },
    ],
  },
  {
    version: "2026.09.17.3",
    date: "2026-09-17",
    title: "Escolha do professor no link de matrícula",
    summary: "Ao gerar o link de matrícula você agora escolhe o professor responsável — o aluno vê os horários dele e a matrícula é vinculada a ele.",
    items: [
      { type: "novo", title: "Professor Responsável no link de matrícula", description: "No modal 'Link de Matrícula' apareceu o campo Professor Responsável. Em Automático o sistema segue escolhendo pelo instrumento; ao selecionar, os horários exibidos ao aluno, as aulas e a matrícula ficam vinculados ao professor escolhido." },
      { type: "melhoria", title: "Nome do professor na mensagem do WhatsApp", description: "Quando um professor é escolhido, o nome dele é incluído na mensagem enviada ao aluno (no envio automático e no botão Enviar no WhatsApp)." },
    ],
  },
  {
    version: "2026.09.17.2",
    date: "2026-09-17",
    title: "Permissões de professor e download no app Android",
    summary: "O professor agora vê só as páginas liberadas pelo administrador — e recibos, contratos e materiais baixam de verdade dentro do app no celular.",
    items: [
      { type: "correcao", title: "Professor só vê os menus liberados", description: "A tela de cadastro do professor passou a listar TODAS as páginas do sistema (Reposições, Salas, Rankings, Robô WhatsApp, Cérebro da IA, Tutoriais, Contratos etc.) e o menu lateral mostra apenas o que o administrador marcou. Digitar a URL de uma página sem permissão também é bloqueado." },
      { type: "correcao", title: "Novidades exclusiva do administrador", description: "Professores e alunos não veem mais o item, o badge nem o modal de Novidades." },
      { type: "correcao", title: "Download de PDF, recibo e planilha no app Android", description: "Recibos, contratos, comprovantes, materiais e relatórios agora são salvos em Downloads/MusicPro (ou compartilhados pelo Android) dentro do app — antes o download não funcionava no celular." },
    ],
  },
  {
    version: "2026.09.17.1",
    date: "2026-09-17",
    title: "Link de matrícula com pagamento via Pix direto",
    summary: "Escolas que não usam checkout (Asaas/Mercado Pago/InfinitePay) agora matriculam com Pix simples — e o link no WhatsApp já vai com a chave e o valor.",
    items: [
      { type: "novo", title: "Matrícula sem checkout, pagando via Pix", description: "Se a escola não tem gateway configurado e preencheu a Chave PIX em Configurações, o link de matrícula mostra apenas Curso → Dados → Horário. Ao final aparece a chave Pix e o valor a pagar, com botão de copiar e orientação para enviar o comprovante." },
      { type: "novo", title: "Chave Pix na mensagem do link (WhatsApp)", description: "Ao gerar o link com envio automático por WhatsApp, a mensagem já inclui a chave Pix e o valor da matrícula para o aluno pagar direto ao professor." },
    ],
  },
  {
    version: "2026.09.17",
    date: "2026-09-17",
    title: "Lembretes com a logo da escola",
    summary: "Os lembretes de aula agora podem sair com a logo da escola — visual profissional configurável.",
    items: [
      { type: "novo", title: "Logo nos lembretes de aula", description: "Os lembretes chegam com a logo cadastrada no perfil da escola como imagem + mensagem de confirmação de presença. Dá um ar profissional ao atendimento." },
      { type: "novo", title: "Ligue ou desligue quando quiser", description: "Em Configurações → Robô do WhatsApp há o interruptor 'Lembretes com a Logo da Escola': ligado envia com imagem, desligado envia somente o texto." },
    ],
  },
  {
    version: "2026.09.16.5",
    date: "2026-09-16",
    title: "Instale o MusicPro no seu celular",
    summary: "O app agora pode ser instalado direto da tela de perfil — ícone na tela inicial, sem loja de aplicativos.",
    items: [
      { type: "novo", title: "Instalar o app", description: "No perfil do aluno (e nas configurações da escola) apareceu o botão 'Instalar o App': toque e o MusicPro fica instalado como aplicativo na tela inicial do celular, abrindo em tela cheia como um app de verdade. No iPhone/iPad aparecem os passos do Safari — necessário para receber notificações no iOS." },
    ],
  },
  {
    version: "2026.09.16.4",
    date: "2026-09-16",
    title: "Novo relatório de Clientes Ativos no Super Admin",
    summary: "Veja quantos clientes pagaram a mensalidade do mês de verdade — status de cobrança de cada escola direto do Asaas.",
    items: [
      { type: "novo", title: "Aba 'Clientes Ativos' (Super Admin)", description: "Relatório por mês/ano com o status real da mensalidade de cada escola consultado no Asaas: pagas, pendentes, atrasadas, em trial, canceladas e sem cobrança — com valor, vencimento, data de pagamento, alunos ativos e último acesso." },
      { type: "novo", title: "KPI 'Clientes ativos de fato'", description: "A resposta à pergunta difícil: quantos clientes pagaram a mensalidade do mês corrente e quanto isso rendeu. KPIs de receita recebida, pendente e atrasada inclusos." },
    ],
  },
  {
    version: "2026.09.16.3",
    date: "2026-09-16",
    title: "Hotfix: horários do link funcionam em qualquer escola",
    summary: "Escolas operadas apenas pela conta do administrador voltam a ter horários no link de matrícula.",
    items: [
      { type: "correcao", title: "Horários para escolas sem ficha de professor", description: "O passo de horários do link de matrícula parava de carregar em escolas que não possuem professores cadastrados (operadas só pelo admin). Agora o sistema resolve o professor automaticamente: ficha de professor → usuário professor → conta administrativa da escola." },
      { type: "correcao", title: "Matrícula conclui e já agenda", description: "O mesmo critério é usado ao confirmar a matrícula — o horário escolhido é reservado exatamente para quem vai dar a aula, sem erro de 'professor não disponível'." },
    ],
  },
  {
    version: "2026.09.16.2",
    date: "2026-09-16",
    title: "Matrícula multi-uso, recibo de mensalidade e horários corrigidos",
    summary: "Um link serve vários alunos sem conflito de horário, recibo em PDF por WhatsApp e o passo de horários do link voltou a funcionar.",
    items: [
      { type: "novo", title: "Link de matrícula para vários alunos", description: "Ao gerar o link, a escola escolhe quantos alunos podem usá-lo (2, 5, 10 ou 50). Cada aluno preenche seus dados e paga a própria matrícula — sem precisar gerar um link por pessoa." },
      { type: "novo", title: "Recibo de mensalidade em PDF", description: "No Financeiro, cada mensalidade tem os botões 'Recibo' (abre o PDF) e 'Enviar' (manda o recibo por WhatsApp). O PDF traz nome do aluno, valor, referência do mês, vencimento, pagamento e status." },
      { type: "correcao", title: "Horários do link de matrícula", description: "O passo 3 (escolha de horário) voltou a listar horários: o sistema agora busca o expediente configurado na agenda da escola (dias e horários de funcionamento), mesmo que esteja salvo em outro perfil de usuário." },
      { type: "correcao", title: "Fim dos conflitos de horário na matrícula", description: "Se o horário escolhido for ocupado por outro aluno no meio do caminho, a matrícula avisa e pede para escolher outro — nunca mais aluno matriculado e pago sem aula. Dois alunos no mesmo link não criam matrícula duplicada." },
      { type: "melhoria", title: "Horários sempre atualizados", description: "A lista de horários do link recarrega sozinha a cada 15 segundos, refletindo o que foi ocupado por outros alunos em tempo real." },
    ],
  },
  {
    version: "2026.09.16",
    date: "2026-09-16",
    title: "Confirmação de presença e notificações no Portal do Aluno",
    summary: "Lembrete de aula agora pede confirmação no painel do aluno — professor sabe na hora quem vem e quem não vem.",
    items: [
      { type: "novo", title: "Confirme sua presença", description: "Ao receber o lembrete de aula, o aluno é avisado no painel (sino + push) e pode responder com 1 toque: 'Estarei presente' ou 'Não poderei ir'. O lembrete do WhatsApp também chega com o link de confirmação." },
      { type: "novo", title: "Professor avisado na hora", description: "Assim que o aluno responde, o professor recebe notificação (e push) e vê a confirmação na agenda e no detalhe da aula — fim das faltas silenciosas." },
      { type: "novo", title: "Ativação de notificações", description: "No primeiro acesso ao portal, um banner convida o aluno a habilitar as notificações no navegador — com direito a push mesmo com o app fechado." },
      { type: "melhoria", title: "Confirmação resetada ao remarcar", description: "Se a aula for remarcada (pelo aluno ou professor), a resposta de presença é limpa e o aluno é convidado a confirmar novamente para a nova data." },
    ],
  },
  {
    version: "2026.09.15",
    date: "2026-09-15",
    title: "Renovação pelo portal e avaliações de professores",
    summary: "Aluno renova o contrato com 1 toque (vigência pelo plano) e pode avaliar seu professor — nota sigilosa para a administração.",
    items: [
      { type: "novo", title: "Renovar contrato pelo portal", description: "No portal do aluno, quando o contrato está perto do fim aparece o botão 'Renovar contrato' — o novo contrato já sai com a duração e o valor do plano cadastrado, sem trabalho manual para o professor." },
      { type: "novo", title: "Avalie seu professor", description: "De tempos em tempos o portal convida você a dar uma nota de 1 a 5 (com comentário opcional) ao seu professor. Sua avaliação é sigilosa: apenas a administração da escola tem acesso." },
      { type: "novo", title: "Relatório e ranking para a escola", description: "No painel do administrador (Professores → Avaliações): relatório completo com filtros e ranking dos professores, do melhor ao pior, para decisões de gestão." },
    ],
  },
  {
    version: "2026.09.14.2",
    date: "2026-09-14",
    title: "Nova aba Resultados no Portal do Aluno",
    summary: "Histórico completo de desafios, medalhas e rankings em um só lugar — e o painel do aluno mais limpo.",
    items: [
      { type: "novo", title: "Aba Resultados", description: "No portal do aluno, o menu agora tem a aba Resultados: todo o histórico de desafios avaliados (com feedback do professor), medalhas conquistadas e competições de ranking em que participou." },
      { type: "melhoria", title: "Painel do aluno mais limpo", description: "Desafios encerrados não poluem mais o painel do aluno — só os desafios ativos aparecem. O histórico completo ficou na aba Resultados." },
      { type: "melhoria", title: "Feedback no lugar certo", description: "A notificação de avaliação de desafio agora leva direto para a aba Resultados." },
    ],
  },
  {
    version: "2026.09.14.1",
    date: "2026-09-14",
    title: "Ajustes no Relatório de Salas (mobile)",
    summary: "Modal do relatório de ocupação com navegação corrigida no celular.",
    items: [
      { type: "correcao", title: "Botão X fixo no relatório", description: "O botão de fechar não rola junto com o conteúdo e não sobrepõe mais o título." },
      { type: "correcao", title: "Tabela com rolagem lateral", description: "No celular, arraste a tabela do relatório para o lado para ver todas as colunas (Agendadas e Ocupação), sem dados cortados." },
      { type: "correcao", title: "Trava de cards do dashboard", description: "No cadastro do professor, o admin agora vê e marca quais cards do dashboard o professor pode acessar (seção Cards do Dashboard)." },
      { type: "correcao", title: "Vídeo do desafio assistível", description: "O professor consegue assistir/ouvir o vídeo ou áudio enviado pelo aluno na resposta do desafio, direto no painel de respostas." },
      { type: "melhoria", title: "Limpeza automática de mídia", description: "Ao encerrar ou excluir um desafio, os vídeos/imagens enviados pelos alunos são removidos do servidor — economiza espaço sem perder pontos e feedback." },
    ],
  },
  {
    version: "2026.09.14",
    date: "2026-09-14",
    title: "Dashboard inteligente e Financeiro mais claro",
    summary: "Novos cards no painel, desconto antecipado registrado corretamente e controles de privacidade.",
    items: [
      { type: "novo", title: "Horários Livres do Dia", description: "Veja no dashboard as vagas de hoje, com filtro por professor e por sala." },
      { type: "novo", title: "Salas ao Vivo (24h)", description: "Status em tempo quase real das salas de estúdio: livre, ocupada, manutenção." },
      { type: "novo", title: "Dashboard personalizável", description: "Escolha, em Configurações → Aparência, quais cards quer ver." },
      { type: "novo", title: "Botão Olhinho", description: "Oculta os valores financeiros no Dashboard e no Financeiro com um clique." },
      { type: "novo", title: "Card Desconto Concedido", description: "No Financeiro, veja quanto de desconto por pagamento antecipado foi dado no mês." },
      { type: "melhoria", title: "Desconto registrado corretamente", description: "Ao dar baixa ou gerar a cobrança, o valor pago com desconto é gravado junto do valor cheio da mensalidade." },
      { type: "melhoria", title: "Configurações mais enxutas", description: "A aba Professores saiu das Configurações (já está no menu lateral)." },
    ],
  },
];

export const LATEST_RELEASE_VERSION: string = RELEASES[0]?.version ?? "";

/** Lançamento mais recente (ou null se não houver nenhum). */
export function getLatestRelease(): Release | null {
  return RELEASES[0] ?? null;
}

/** Versão que o usuário ainda não viu (última), ou null se está em dia. */
export function getUnseenRelease(lastSeenVersion: string | null | undefined): Release | null {
  const latest = getLatestRelease();
  if (!latest) return null;
  if (lastSeenVersion === latest.version) return null;
  return latest;
}

export function hasUnseenRelease(lastSeenVersion: string | null | undefined): boolean {
  return getUnseenRelease(lastSeenVersion) !== null;
}
