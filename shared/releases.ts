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
