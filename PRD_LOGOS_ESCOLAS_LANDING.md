# PRD — Puxar logos das escolas cadastradas para a Landing Page (Super Admin)

## 1. Visão Geral

### Problema
A seção "Clientes & Escolas Parceiras" da Landing Page é alimentada por uma lista **manual** (`landing_clients`): o super admin precisa pedir a logo para cada escola, subir arquivo/colar URL e cadastrar. As escolas **já têm logo cadastrada** no sistema (`organizations.logo`, espelhando `settings.logoUrl`) — hoje 10 de 18 escolas têm logo, e esse material é desperdiçado.

### Objetivo
No Super Admin, permitir **puxar automaticamente as logos de todas as escolas cadastradas** e **escolher quais vão para a Landing Page** (liga/desliga por escola), sem precisar pedir nada aos clientes.

### Contexto
- Tela: Super Admin → "Clientes & Escolas Parceiras" (`LandingClientsManager` em `client/src/pages/SuperAdmin.tsx`).
- Backend: `superAdminRouter` (`list/create/update/deleteLandingClient`) e tabela `landing_clients`.
- Público: `publicData.getLandingClients` → `ClientsMarquee` na Landing Page (filtra `isActive`).
- Fonte das logos: `organizations.logo` (base64/URL, espelho de `settings.logoUrl` via `settings.updateSchool`).

---

## 2. Usuários Envolvidos

- **Super Admin (Owner)**: único que vê a área e define as escolas da vitrine.
- **Visitante da Landing Page**: vê o carrossel de logos.
- **Escola (cliente)**: não faz nada — a logo já está no sistema.

---

## 3. Escopo

### Incluído
- Botão **"Puxar logos das escolas"** no gerenciador da Landing.
- Modal com busca, lista de escolas, preview da logo, selo "Sem logo" (bloqueada) e estado "já publicada".
- Seleção múltipla + atalho "selecionar todas com logo".
- Salvar = **sincronizar**: marcadas entram/reativam na vitrine; desmarcadas são **desativadas** (soft, preserva depoimento/ordem).
- Vínculo `landing_clients.organizationId` (evita duplicar a mesma escola).
- Selo "Escola do sistema" nos cards já vinculados.

### Fora do escopo
- Editar a logo dentro do Super Admin (segue sendo da escola).
- Aprovação/consentimento da escola para exibição (decisão do super admin).
- Ordenação automática das logos na vitrine (usa a ordem atual + fim da fila; ajustável nos cards).
- Envio de notificação à escola ao publicar.

---

## 4. Requisitos Funcionais

### RF-001 — Listar escolas com logo
`superAdmin.listSchoolLogos` retorna todas as organizações com `{ id, name, logo, hasLogo, landingClientId, landingActive }`, ordenadas por nome.

### RF-002 — Sincronizar seleção
`superAdmin.syncSchoolLogos({ organizationIds })`:
- Publica (ou reativa) as escolas selecionadas **que têm logo**;
- **Desativa** vínculos existentes que não estão mais selecionados;
- Ignora ids inexistentes ou sem logo (contabiliza em `invalid`).

### RF-003 — Importação só com logo
Escolas sem logo aparecem desabilitadas com o selo "Sem logo" e não podem ser selecionadas.

### RF-004 — Sem duplicidade
Uma escola nunca vira dois registros: o vínculo é por `organizationId`; re-selecionar apenas reativa o registro existente.

### RF-005 — Preservar personalizações
Desativar não apaga: depoimento, link do site, ordem e nome continuam editáveis nos cards.

### RF-006 — Lista continua editável
Criar/editar/excluir manualmente continua funcionando (clientes sem vínculo, ex.: parceiros que não são escolas).

---

## 5. Regras de Negócio

### RN-001 — Quem entra na vitrine
Somente registros com `isActive = true` aparecem na landing (regra pública já existente).

### RN-002 — Fonte da logo
`organizations.logo` (espelho de `settings.logoUrl`). Se a escola atualizar a logo no sistema **depois** de publicada, o super admin pode re-sincronizar para atualizar? → **Decisão:** na primeira publicação copiamos a logo para `landing_clients.logoUrl`; re-sincronizar (salvar com a escola marcada) **atualiza** a logo copiada.

### RN-003 — Desativar ≠ excluir
Desmarcar → `isActive = false`. Excluir continua sendo ação manual no card.

### RN-004 — Limite
Até 200 escolas por sincronização (18 hoje), com `order` sequencial a partir do maior existente.

---

## 6. Fluxos

### Fluxo principal
```text
Super Admin → Landing Page (Clientes & Escolas)
↓
"Puxar logos das escolas"
↓
Busca/lista com logos; marca as que devem aparecer
↓
Salvar → publica novas, reativa antigas, desativa desmarcadas
↓
Carrossel da Landing atualizado (publicData invalida)
```

### Fluxos alternativos
- Escola sem logo → não selecionável.
- Escola já publicada → caixa marcada ao abrir.
- Escola atualizou a logo → re-salvar com ela marcada atualiza a cópia.

### Fluxos de erro
- Nenhuma escola com logo → aviso "Nenhuma escola com logo cadastrada".
- Falha ao salvar → toast de erro; seleção permanece no modal.

---

## 7. Casos Extremos

- Organização sem logo → `invalid`, nunca publicada.
- Org selecionada inexistente → ignorada.
- Registro de landing com nome diferente (editado manual) → vínculo mantém o registro e apenas reativa/atualiza logo? → **Decisão:** ao reativar/atualizar, mantém nome editado pelo admin (não sobrescreve nome, só a logo).
- Duas sincronizações simultâneas → operação idempotente por `organizationId`.
- Escola excluída/desativada depois de publicada → registro permanece (snapshot) até o super admin desmarcar.
- Mais de 200 escolas → bloqueado pelo schema.
- Ordem: novas entram no fim; reordenação manual continua no editar.

---

## 8. Dados Envolvidos

| Tabela | Campo | Tipo | Regra |
| --- | --- | --- | --- |
| `landing_clients` | `organizationId` | integer (nullable) | novo; vínculo com a escola |
| `landing_clients` | `logoUrl` | text | cópia da logo da escola (atualizável) |
| `organizations` | `logo`, `name` | text/varchar | fonte |

Sem novas tabelas; ALTER idempotente no bootstrap.

---

## 9. Permissões e Segurança

- Todas as procedures novas usam `isSuperAdmin` (mesma guarda de `listLandingClients`).
- Nenhum dado sensível novo; logos já são exibidas publicamente após seleção.
- Isolamento: nada de outras organizações além de nome/logo (já públicos na landing).

---

## 10. Tratamento de Erros

- **Esperado:** "Nenhuma escola com logo...", "Selecione pelo menos uma escola".
- **Interno:** falha de banco → mensagem genérica + log no servidor.

---

## 11. Requisitos Não Funcionais

- RNF-001: modal responsivo (`w-[95vw] sm:max-w-2xl`), lista com scroll e busca.
- RNF-002: imagens em `object-contain` com lazy loading.
- RNF-003: sincronização em poucas queries (2 selects + updates/insert), idempotente.
- RNF-004: dark mode com os tokens existentes.

---

## 12. Critérios de Aceite

- CA-001: abrir "Puxar logos das escolas" lista todas as escolas com preview; sem logo = desabilitada.
- CA-002: marcar 3 escolas e salvar cria 3 registros ativos e elas aparecem no carrossel.
- CA-003: desmarcar uma escola publicada e salvar a remove do carrossel (registro fica inativo).
- CA-004: re-salvar não duplica registros da mesma escola.
- CA-005: escola que já estava publicada abre com a caixa marcada.
- CA-006: re-sincronizar com a escola marcada atualiza a logo dela no registro.

---

## 13. Riscos e Dependências

- **Risco:** logos em base64 grandes aumentam o payload da landing — os registros existentes já usam o mesmo formato; limite implícito de upload (5MB) do sistema.
- **Dependência:** `organizations.logo` ser mantida por `settings.updateSchool` (já é).

---

## 14. Métricas de Sucesso

- Tempo para montar a vitrine (sem pedir arquivos aos clientes).
- Nº de escolas publicadas sem trabalho manual.

---

## 15. Plano de Implementação

### Fase 1 — Dados
Coluna `landing_clients.organizationId` + bootstrap.

### Fase 2 — Backend
`listSchoolLogos`, `syncSchoolLogos` + helper puro `diffLandingSchoolSelection` + testes.

### Fase 3 — Frontend
Botão + modal de seleção no `LandingClientsManager`; selo "Escola do sistema" nos cards.

### Fase 4 — Testes e release
`pnpm check`, vitest, build e `shared/releases.ts`.
