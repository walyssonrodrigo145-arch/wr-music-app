// Catálogo canônico das permissões de página do professor (fonte única — client + server).
// Toda página do menu lateral (AppSidebar) liberável para professor DEVE estar aqui.
// Páginas admin-only (ex.: /professores, /novidades) não entram no catálogo.

export interface PagePermissionDef {
  id: string;
  label: string;
  icon: string;
  group: string;
}

export const PAGE_PERMISSION_GROUPS = [
  "PRINCIPAL",
  "RELACIONAMENTO",
  "FINANCEIRO",
  "AUTOMAÇÕES",
  "OUTROS",
  "CONTA",
] as const;

export const PAGE_PERMISSIONS: PagePermissionDef[] = [
  { id: "/ia", label: "IA Assistente", icon: "✨", group: "PRINCIPAL" },
  { id: "/dashboard", label: "Dashboard", icon: "📊", group: "PRINCIPAL" },
  { id: "/alunos", label: "Alunos", icon: "👨‍🎓", group: "PRINCIPAL" },
  { id: "/aulas", label: "Aulas", icon: "📅", group: "PRINCIPAL" },
  { id: "/reposicoes", label: "Reposições", icon: "🔄", group: "PRINCIPAL" },
  { id: "/instrumentos", label: "Instrumentos", icon: "🎸", group: "PRINCIPAL" },
  { id: "/salas", label: "Salas de Estúdio", icon: "🚪", group: "PRINCIPAL" },
  { id: "/rankings", label: "Rankings", icon: "🏆", group: "PRINCIPAL" },
  { id: "/relatorios", label: "Relatórios", icon: "📈", group: "PRINCIPAL" },
  { id: "/comunicados", label: "Comunicados", icon: "📢", group: "RELACIONAMENTO" },
  { id: "/financeiro", label: "Finanças", icon: "💰", group: "FINANCEIRO" },
  { id: "/folha", label: "Folha de Pagamento", icon: "💼", group: "FINANCEIRO" },
  { id: "/contratos", label: "Contratos", icon: "📝", group: "FINANCEIRO" },
  { id: "/automacoes", label: "Automação", icon: "⚡", group: "AUTOMAÇÕES" },
  { id: "/chatbot-fluxo", label: "Robô WhatsApp", icon: "🤖", group: "AUTOMAÇÕES" },
  { id: "/base-conhecimento-ia", label: "Cérebro da IA", icon: "🧠", group: "AUTOMAÇÕES" },
  { id: "/lembretes", label: "Lembretes", icon: "🔔", group: "AUTOMAÇÕES" },
  { id: "/solicitacoes", label: "Solicitações", icon: "📋", group: "OUTROS" },
  { id: "/progresso", label: "Progresso", icon: "🎯", group: "OUTROS" },
  { id: "/indicacoes", label: "Indique & Ganhe", icon: "🎁", group: "OUTROS" },
  { id: "/recepcao-qr", label: "Recepção QR", icon: "📷", group: "OUTROS" },
  { id: "/tutoriais", label: "Tutoriais", icon: "🎓", group: "OUTROS" },
  { id: "/configuracoes", label: "Configurações", icon: "⚙️", group: "CONTA" },
];

export const PAGE_PERMISSION_IDS: string[] = PAGE_PERMISSIONS.map((p) => p.id);

export const DEFAULT_PROFESSOR_PERMISSIONS: string[] = ["/dashboard", "/alunos", "/aulas"];

// Rotas administrativas que NUNCA podem ser liberadas para professor.
const ADMIN_ONLY_PATHS = ["/professores", "/novidades", "/master-panel", "/analytics", "/comercial", "/leads", "/marketing", "/programa-indicacao"];

// Aliases legados e rotas alternativas → id canônico do catálogo.
const PATH_ALIASES: Record<string, string> = {
  "/recepcao": "/recepcao-qr",
  "/recepcao-qr": "/recepcao-qr",
  "/scanner": "/recepcao-qr",
  "/fluxo-chatbot": "/chatbot-fluxo",
  "/ia-conhecimento": "/base-conhecimento-ia",
  "/salas-estudio": "/salas",
  "/folha-pagamento": "/folha",
  "/pagamentos": "/financeiro",
  "/financeiro": "/financeiro",
};

/** Normaliza a lista crua vinda do banco: trim, alias, prefixo '/', remove duplicatas.
 *  Páginas conhecidas viram ids canônicos (ordem do catálogo); ids desconhecidos
 *  (ex.: permissões de dados "alunos_editar") são preservados intactos. */
export function normalizePermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const value = item.trim();
    if (!value) continue;
    const withSlash = value.startsWith("/") ? value : `/${value}`;
    const canonical = PATH_ALIASES[withSlash] || (PAGE_PERMISSION_IDS.includes(withSlash) ? withSlash : null);
    if (!canonical) {
      if (!seen.has(value)) {
        seen.add(value);
        unknown.push(value);
      }
      continue;
    }
    if (!seen.has(canonical)) {
      seen.add(canonical);
    }
  }
  return [...PAGE_PERMISSION_IDS.filter((id) => seen.has(id)), ...unknown];
}

/** Converte uma rota acessada para o id canônico de permissão (ex.: /alunos/5/editar → /alunos). */
export function resolvePageId(path: string): string | null {
  if (!path) return null;
  const clean = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  if (PATH_ALIASES[clean]) return PATH_ALIASES[clean];
  if (clean === "/alunos" || clean.startsWith("/alunos/")) return "/alunos";
  if (PAGE_PERMISSION_IDS.includes(clean)) return clean;
  return null;
}

/** Rotas exclusivas do admin (nunca liberáveis para professor). */
export function isAdminOnlyPath(path: string): boolean {
  const clean = path.split("?")[0].split("#")[0];
  return ADMIN_ONLY_PATHS.some((p) => clean === p || clean.startsWith(`${p}/`));
}

/** Página acessível? Rotas fora do catálogo (ex.: /assinatura, /checkout) permanecem liberadas. */
export function isPageAllowed(permissions: readonly string[], path: string): boolean {
  if (isAdminOnlyPath(path)) return false;
  const pageId = resolvePageId(path);
  if (!pageId) return true;
  return normalizePermissions(permissions).includes(pageId);
}

/** Primeira página liberada (ordem do catálogo) — usada para redirecionar quem não tem /dashboard. */
export function firstAllowedPath(permissions: readonly string[]): string | null {
  const normalized = normalizePermissions(permissions);
  return normalized.find((id) => PAGE_PERMISSION_IDS.includes(id)) ?? null;
}
