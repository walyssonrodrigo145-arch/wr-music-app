# PRD — Histórico de Alunos (Arquivamento, Reativação e Reengajamento)

> Versão: 1.0 · Data: 2026-09-25 · Status: Aguardando aprovação para implementação
> Autor: Skill `prdspec` (Análise de Sistemas / Product)
> Origem: solicitação do dono — "ao excluir um aluno isso se perde e pode impactar até em relatório; quero um histórico com opção de reativar e tentar trazer o aluno de volta".

---

## 1. Visão Geral

### Problema

Hoje a exclusão de aluno é um **hard delete transacional** (`server/routers/studentsRouters.ts:863-982`) que apaga em cascata, dentro de uma transação:

- **pagamentos pagos** (`paymentDues`, inclusive `status='pago'`), **contratos assinados**, **timeline**, **evolução**, **arquivos**, **presenças** (`attendanceLogs`), **reposições**, **aulas** (passadas e futuras) e o **cliente no Asaas** (API externa);
- o usuário de portal do aluno (`users`) é removido fora da transação (pode sobrar órfão se falhar).

Consequências reais:

1. **Relatórios são reescritos no passado** — ex.: `getMonthlyStats` calcula headcount por competência (`server/db.ts:1683-1690`); excluir um aluno altera meses anteriores. Frequência/evolução perdem a base (aulas apagadas).
2. **Dados irrecuperáveis** — não há como reativar ou tentar trazer o aluno de volta: o cadastro, o financeiro e o pedagógico somem.
3. **Órfãos garantidos** — não existem FKs/`onDelete` para `students`; o delete deixa registros apontando para o ID morto (`studentEnrollments`, `studySessions`, `challengeResponses`, `studentPedagogicalMemory`, rankings/achievements, `professorEvaluations`, `fiscalInvoices`, `crmLeads.convertedStudentId`) — ver inventário em §7/§13.
4. **Zero rastro de saída** — não existe motivo de saída, data de saída nem histórico de reengajamento.

### Objetivo

Transformar a exclusão em **arquivamento reversível** e criar um **Histórico de Alunos** para reativação e reengajamento:

1. "Excluir aluno" passa a **Arquivar** (vai para o Histórico), preservando todos os dados.
2. Histórico lista os ex-alunos com **motivo de saída**, observações, dados de contato e **botão de WhatsApp** para reengajamento.
3. **Reativar** devolve o aluno como **Ativo** (com a validação de limite do plano já existente).
4. **Exclusão definitiva** (LGPD) fica disponível **apenas para admin**, com dupla confirmação.

### Contexto (decisões aprovadas pelo solicitante)

| # | Decisão | Valor aprovado |
|---|---|---|
| D1 | Exclusão | "Excluir" → **Arquivar sempre** + ação separada "Excluir definitivamente" (somente admin, dupla confirmação) |
| D2 | Reativação | Volta como **Ativo**, com a mesma validação de limite do plano de `updateStatus` (`studentsRouters.ts:806-827`) |
| D3 | Reengajamento v1 | **Lista + motivo de saída + observações + WhatsApp** (sem workflow de follow-up e sem integração com o CRM de Leads) |
| D4 | Acesso | Histórico e reativação **somente admin** |

**Estado atual relevante:**
- `statusEnum = ["ativo","inativo","pausado"]` (`drizzle/schema.ts:19`) e `students.status` (`schema.ts:161`). `inativo`/`pausado` já são "arquivamento visual" (linha viva, portal bloqueado em `authRouters.ts:448-453`, reativável).
- Não existe `deletedAt`/`archivedAt` em nenhuma tabela.
- O CRM tem lead separado (`crmLeads`, com `lostReason`/`lossNotes`) e elo `convertedStudentId` (`schema.ts:1674`), mas **sem tela de histórico pós-conversão**.
- O modal de exclusão atual: `client/src/components/alunos/DeleteConfirm.tsx` ("A exclusão de X é permanente e removerá todo o histórico").

---

## 2. Usuários Envolvidos

| Ator | Papel |
| --- | --- |
| **Admin da escola** (principal) | Arquiva alunos, vê o Histórico, reativa e (se necessário) exclui definitivamente |
| Professor | **Não vê** o Histórico nem reativa (D4). Continua com o fluxo atual de status ativo/pausado/inativo do seu aluno |
| Aluno (portal) | Tem o acesso bloqueado ao ser arquivado (mesma regra de `status != ativo`); ao reativar, volta a acessar |
| Suporte MusicPro | Pode orientar; não tem tela nova (super admin permanece como está) |

---

## 3. Escopo

### Incluído

1. **Schema/migração**: colunas de arquivamento em `students` (`deletedAt`, `deletedBy`, `exitReason`, `exitNotes`, `reactivatedAt`).
2. **Backend**:
   - `students.archive` (substitui o uso de `students.delete` na UI): valida admin, registra motivo/notas, **não apaga** dados históricos; aplica a opção de cancelar/excluir pendências (futuras), desativa portal e **mantém o cliente Asaas** para reativação.
   - `students.listArchived` (admin): lista arquivados com paginação simples e busca por nome/telefone.
   - `students.reactivate` (admin): volta para `ativo` com a validação de limite do plano existente; limpa campos de arquivamento e grava `reactivatedAt`; reativa o acesso do portal.
   - `students.permanentlyDelete` (admin): exclusão definitiva (LGPD), reaproveitando a cascata atual + corrigindo órfãos conhecidos, removendo arquivos físicos e o cliente Asaas.
   - **Filtros de exclusão**: todas as listagens/consultas que podem devolver arquivados passam a ignorar `deletedAt IS NOT NULL` por padrão (🔎 lista em §4 RF-006).
3. **Frontend (`client/src/pages/Alunos.tsx`)**:
   - Botão de excluir → **Arquivar aluno** com motivo (select), observações e a opção já existente de cancelar pendências.
   - **Modo "Histórico"** na própria página (aba/chip "Arquivados", visível só para admin): lista com nome, contato, motivo, data de arquivamento, WhatsApp, **Reativar** e **Excluir definitivamente**.
4. **Timeline**: registrar evento "Arquivado (motivo)" e "Reativado" em `studentTimeline` quando existir (rastro no prontuário).
5. **Relatórios**: garantir que `students.list`/`reports.getAlunosReport` e demais consultas não contem arquivados nem "quebrem" (dados preservados).
6. **Estados de UI** (loading/vazio/erro) e responsividade mobile no modo Histórico.
7. **Release no What's New** (`shared/releases.ts`).

### Fora do escopo (v1)

1. Workflow de follow-up/recontato (tentativas com data/resultado) — evolução futura (D3).
2. Integração com o CRM de Leads / criação automática de lead de reengajamento (D3).
3. Dar acesso ao Histórico a professores ou secretárias (D4).
4. Arquivamento automático por inatividade (job) — apenas manual.
5. Recuperação de aluno **já excluído antes desta feature** (dados perdidos no hard delete antigo).
6. Reescrita das séries históricas de relatórios para incluir ex-alunos em meses passados (ver Risco R3).

---

## 4. Requisitos Funcionais

### RF-001 — Arquivar aluno (substitui a exclusão)

**Descrição:** a ação "Excluir" passa a arquivar: o aluno sai das listas ativas, entra no Histórico e **nenhum dado histórico é apagado** (pagamentos, contratos, timeline, evolução, arquivos, presenças, aulas passadas).
**Atores:** admin (e professor para o próprio aluno, mantendo a regra atual de posse — ver RN-007).
**Pré-condições:** aluno existente na organização e não arquivado.
**Fluxo principal:**

1. Usuário aciona "Excluir/Arquivar" (dropdown, card mobile ou detalhes do aluno).
2. Sistema abre `ArquivarAlunoConfirm`: motivo (obrigatório, lista), observações (opcional) e checkbox **"Cancelar aulas futuras e faturas pendentes"** (padrão marcado).
3. Usuário confirma.
4. Sistema:
   - grava `exitReason`, `exitNotes`, `deletedAt = now`, `deletedBy = ctx.user.id`;
   - muda `status` para `inativo` (garante que **nenhuma** consulta por `status='ativo'` o conte);
   - se o checkbox estiver marcado: **cancela/exclui** apenas itens futuros/pendentes (aulas `agendada` com `scheduledAt >= agora` e `paymentDues` `pendente`), preservando passados e pagos;
   - bloqueia o login do portal (usuário existente) sem apagar o usuário;
   - **não** remove o cliente Asaas;
   - registra linha em `studentTimeline` (quando houver) e sincroniza a assinatura (`syncOrgAsaasSubscription`, pois saiu de `ativo`).
5. UI mostra "Aluno arquivado. Você pode reativar no Histórico." e invalida as listas.

**Exceções:** já arquivado → no-op com sucesso idempotente; erro do Asaas sync → não bloqueia (best-effort, como hoje).
**Dados:** `students`, `lessons`, `paymentDues`, `users`, `studentTimeline`.

### RF-002 — Histórico de alunos arquivados (admin)

**Descrição:** novo modo "Histórico" na página Alunos (visível só admin) com busca e lista de arquivados.
**Atores:** admin.
**Pré-condições:** existir ≥ 1 aluno arquivado.
**Fluxo principal:**

1. Admin abre `Alunos` → botão/aba **Histórico** (badge com contagem).
2. Sistema lista arquivados (nome, telefone/WhatsApp, instrumento, motivo, data de arquivamento, mensalidade de referência).
3. Busca por nome/telefone (server-side simples).
4. Cada item tem: **WhatsApp** (link `wa.me` com mensagem de reengajamento pré-preenchida), **Reativar** e **Excluir definitivamente** (admin).
5. Estado vazio: "Nenhum aluno arquivado ainda." com explicação curta.
**Exceções:** erro de query → mensagem + "Tentar novamente"; professor não vê a aba.
**Dados:** `students` (leitura).

### RF-003 — Reativar aluno (volta como Ativo)

**Descrição:** reativar um arquivado devolvendo-o às listas ativas, com validação de limite do plano.
**Atores:** admin.
**Pré-condições:** aluno arquivado.
**Fluxo principal:**

1. Admin clica em **Reativar** no Histórico.
2. Sistema confirma ("Reativar {nome}? Ele voltará como aluno ativo.").
3. Sistema valida o limite do plano (mesma regra de `studentsRouters.ts:806-827`: se `status='ativo'` estourar `maxStudents` e `allowExtraStudents=false` → `FORBIDDEN` com mensagem clara).
4. Sistema limpa `deletedAt`/`deletedBy` (e `exitReason`/`exitNotes` **movidos para a timeline/notes**), seta `status='ativo'`, `reactivatedAt = now`, registra timeline "Reativado".
5. Toast de sucesso; lista ativa e Histórico são atualizados.
**Exceções:** sem vaga no plano → erro claro e nenhuma alteração; falha do Asaas sync → best-effort.
**Dados:** `students`, `studentTimeline`.

### RF-004 — Excluir definitivamente (LGPD, admin, dupla confirmação)

**Descrição:** remover de verdade um arquivado, com segurança reforçada.
**Atores:** admin.
**Pré-condições:** aluno arquivado.
**Fluxo principal:**

1. Admin aciona **Excluir definitivamente** no Histórico.
2. Modal de risco: resumo do que será apagado + campo para **digitar o nome do aluno** para liberar o botão vermelho.
3. Sistema executa a cascata completa (RF-005) e remove: cliente Asaas, usuário do portal, e os registros históricos.
4. Toast "Aluno excluído definitivamente."; item sai do Histórico.
**Exceções:** nome digitado não confere → botão continua desabilitado; falha parcial → erro claro, sem estado inconsistente (transação).
**Dados:** ver RF-005.

### RF-005 — Cascata da exclusão definitiva (correção de órfãos)

**Descrição:** manter a cascata atual (`studentsRouters.ts:918-971`) e **cobrir os órfãos conhecidos** que o delete antigo deixava:

- `studentEnrollments`, `studySessions`, `challengeResponses`, `studentPedagogicalMemory`, `rankingParticipants`/`rankingScores`/`studentAchievements`, `professorEvaluations`, `fiscalInvoices.studentId` (decisão: **bloquear** exclusão definitiva se houver NFS-e emitida ou apenas anonimizar? → RN-009), `crmLeads.convertedStudentId` (setar `null` e manter o lead), tokens FCM/notificações do usuário do aluno.
- Remover arquivos físicos do storage dos `studentFiles` (hoje a linha é apagada e o arquivo fica órfão).

**Atores:** admin (via RF-004).
**Pré-condições:** aluno arquivado.
**Exceções:** falha no storage → registrar e seguir (linha já removida) sem expor detalhe técnico.
**Dados:** todas as tabelas dependentes listadas.

### RF-006 — Consultas passam a ignorar arquivados

**Descrição:** ajustar as consultas que hoje poderiam retornar arquivados (as que **não** filtram `status='ativo'`), aplicando `deletedAt IS NULL` por padrão:

| Área | Arquivo | Ajuste |
| --- | --- | --- |
| Lista de alunos | `server/db.ts:1728-1759` (`students.list`) | `deletedAt IS NULL` + novo endpoint de arquivados |
| Busca de aluno | `studentsRouters.ts:983-999` (`students.search`) | `deletedAt IS NULL` |
| Relatório de alunos | `reportsRouters.ts:258-281` (`getAlunosReport`) | `deletedAt IS NULL` |
| Financeiro (nomes em faturas) | `financeiroRouters.ts:169-204, 226-263` | **manter** (histórico de cobranças deve continuar mostrando o nome) |
| Migração/Comunicados por IDs | `Migracao.tsx`, `comunicacaoRouters.ts:1261-1283` | excluir arquivados da seleção |
| Ranking/Progresso/Metas | já filtram `status='ativo'` | nenhum ajuste (status vira `inativo` ao arquivar) |

**Atores:** sistema.
**Dados:** consultas de leitura.

### RF-007 — Página/estado do Histórico na UI

**Descrição:** o Histórico é um modo da própria `Alunos.tsx` (aba "Histórico" no topo, visível só admin), não uma rota nova — evita mexer no catálogo de permissões (`shared/permissions.ts`) e reaproveita busca/filtros.
**Atores:** admin.
**Fluxo principal:** alternar entre "Alunos" e "Histórico"; URL opcional via querystring (`/alunos?arquivados=1`) para deep-link.
**Exceções:** acesso direto por professor → redireciona para a lista normal (sem o botão).
**Dados:** estado de UI.

### RF-008 — WhatsApp de reengajamento

**Descrição:** botão no item do Histórico abre `https://wa.me/<telefone>?text=...` com mensagem pré-preenchida e editável pelo professor antes de enviar (texto padrão: "Olá {nome}! Sentimos sua falta na {escola}. Quer retomar suas aulas? Podemos te ajudar a voltar. 🎵").
**Atores:** admin.
**Pré-condições:** aluno com telefone/`guardianPhone`.
**Exceções:** sem telefone → botão desabilitado com tooltip "Sem telefone cadastrado".
**Dados:** `students.phone`/`guardianPhone`.

### RF-009 — Auditoria mínima

**Descrição:** registrar em `studentTimeline` (se a tabela existir no contexto) os eventos "arquivado" (com motivo/notas e autor) e "reativado" (com autor); se `studentTimeline` for apagada apenas na exclusão definitiva. A timeline preservada é a prova do histórico para o prontuário.
**Atores:** sistema.
**Dados:** `studentTimeline`.

---

## 5. Regras de Negócio

### RN-001 — Arquivar nunca apaga histórico

**Regra:** arquivar preserva `paymentDues` (todos os status), `contracts`, `studentTimeline`, `studentEvolution`, `studentFiles`, `attendanceLogs`, `lessonRepositions` e `lessons` passadas.
**Exemplo válido:** aluno arquivado continua aparecendo nas faturas pagas e no relatório financeiro do mês.
**Exemplo inválido:** apagar pagamentos/contratos ao arquivar.
**Consequência:** violação é bug de severidade máxima.

### RN-002 — Arquivo é invisível nas contagens ativas

**Regra:** ao arquivar, `status` vira `inativo`, garantindo que todo filtro `status='ativo'` (dashboard, projeção, rankings, cobranças, automações) deixe de contá-lo automaticamente. Consultas sem filtro de status recebem `deletedAt IS NULL` (RF-006).
**Exemplo válido:** dashboard reduz "alunos ativos" ao arquivar.
**Exemplo inválido:** arquivado contando em "Novos (30 dias)" ou no relatório de alunos.
**Consequência:** contagem errada é bug alto.

### RN-003 — Pendências na hora de arquivar

**Regra:** o checkbox "Cancelar aulas futuras e faturas pendentes" (padrão ligado) remove apenas itens **futuros/pendentes**:
- aulas `status='agendada'` com `scheduledAt >= agora`;
- `paymentDues` com `status='pendente'`.
Tudo o que é passado ou pago permanece.
**Exemplo válido:** 3 aulas futuras e 1 fatura pendente somem; 20 aulas passadas e 12 pagas ficam.
**Exemplo inválido:** apagar faturas pagas.
**Consequência:** mesma lógica de `updateStatus` (`studentsRouters.ts:841-855`), agora também no arquivamento.

### RN-004 — Reativação valida o plano

**Regra:** reativar só é permitido se houver vaga (ou o plano aceitar excedentes). Reutiliza exatamente a regra de `studentsRouters.ts:806-827`.
**Exemplo válido:** plano 30 alunos com 30 ativos e `allowExtraStudents=true` → reativa como excedente, com aviso.
**Exemplo inválido:** plano sem excedente e lotado → bloqueia com mensagem.
**Consequência:** `FORBIDDEN` com texto claro; nada muda.

### RN-005 — Reativado volta como Ativo (D2)

**Regra:** reativação seta `status='ativo'`, limpa `deletedAt/deletedBy` e grava `reactivatedAt`. Motivo/observações antigos são movidos para a timeline/notes (não se perdem, mas não travam o cadastro).
**Consequência:** aluno reaparece nas listas ativas, no portal e nas cobranças futuras (as passadas continuam como estão).

### RN-006 — Exclusão definitiva é irreversível e só admin (D1/D4)

**Regra:** somente `admin` (mesma checagem de `isAdmin` usada no backend) acessa o Histórico e executa exclusão definitiva; exige digitar o nome do aluno.
**Exemplo inválido:** professor chamando `students.permanentlyDelete` → `FORBIDDEN`.
**Consequência:** erro controlado e log.

### RN-007 — Professor pode arquivar, mas não vê o Histórico

**Regra:** mantém a regra atual de posse (`student.professorId === user.id`) para arquivar; **Histórico/reativar/excluir definitivamente são admin**.
**Consequência:** professor não vê aba nem botões do Histórico.

### RN-008 — Portal do aluno

**Regra:** arquivado não loga (mensagem "Seu acesso foi desativado ou pausado…", já existente). Reativado volta a logar normalmente, com os dados preservados (progresso, materiais).
**Consequência:** usuário do portal **não** é apagado no arquivamento (só na exclusão definitiva).

### RN-009 — NFS-e emitida bloqueia exclusão definitiva

**Regra:** se existir `fiscalInvoices.studentId` (nota fiscal emitida), a exclusão definitiva é **bloqueada** com mensagem "Existem notas fiscais emitidas para este aluno — obrigação fiscal impede a exclusão." (anonimização fica para v2).
**Exemplo válido:** arquivado sem NFS-e → exclusão definitiva liberada.
**Exemplo inválido:** apagar registros fiscais.
**Consequência:** evita quebra fiscal; o aluno permanece no Histórico.

### RN-010 — Cliente Asaas

**Regra:** no arquivamento o cliente Asaas **é mantido** (para reativação reutilizar o histórico financeiro); na exclusão definitiva é removido (comportamento atual).
**Consequência:** reativar não cria cliente duplicado.

### RN-011 — Novo aluno com o mesmo e-mail/CPF de um arquivado

**Regra:** o índice único `students_email_org_idx` (`schema.ts:188-190`) considera todos os registros; como o arquivado **permanece na tabela**, o cadastro de um novo aluno com o mesmo e-mail falha. O sistema deve detectar e oferecer: **"Já existe um aluno arquivado com este e-mail. Deseja reativá-lo?"** com link para reativar.
**Exemplo válido:** fluxo de novo aluno mostra o aviso e leva ao Histórico.
**Exemplo inválido:** erro técnico "duplicate key" sem saída.
**Consequência:** melhora a UX e evita aluno "duplicado" morto na base.

---

## 6. Fluxos

### Fluxo principal — Arquivar

```text
Admin (ou professor dono) clica em Excluir
        ↓
Modal "Arquivar aluno?" (motivo + observações + checkbox pendências)
        ↓
Confirma
        ↓
Backend: grava deletedAt/exitReason/deletedBy, status=inativo
        ↓
Opcional: remove aulas futuras + faturas pendentes
        ↓
Bloqueia portal (sem apagar) · mantém Asaas · timeline
        ↓
Aluno sai das listas ativas e entra no Histórico
```

### Fluxo alternativo A — Reativar

```text
Admin abre Alunos → aba Histórico
        ↓
Busca o ex-aluno → Reativar
        ↓
Confirma
        ↓
Valida limite do plano (RN-004)
        ↓
status=ativo, deletedAt=null, reactivatedAt=now · timeline "Reativado"
        ↓
Aluno volta às listas, portal e cobranças futuras
```

### Fluxo alternativo B — Reengajamento (v1)

```text
Admin no Histórico → botão WhatsApp do ex-aluno
        ↓
Abre wa.me com mensagem pré-preenchida
        ↓
Conversa fora do sistema (v1)
```

### Fluxo de erro — Plano lotado na reativação

```text
Reativar → limite do plano sem vaga e sem excedente
        ↓
Erro claro: "Limite de alunos do plano atingido. Faça upgrade…"
        ↓
Nada é alterado; item permanece no Histórico
```

### Fluxo de erro — Falha de rede/API

```text
Ação falha
        ↓
Toast com mensagem controlada; estado anterior preservado
        ↓
Nenhum registro fica parcialmente alterado (transações)
```

### Fluxo de cancelamento

```text
Usuário fecha o modal de arquivar/excluir
        ↓
Nada acontece
```

### Fluxo sem dados

```text
Histórico vazio
        ↓
" Nenhum aluno arquivado ainda — quando você arquivar um aluno, ele aparece aqui."
```

### Fluxo de permissão negada

```text
Professor tenta acessar o Histórico/reivindicar reativação
        ↓
Aba/botões não renderizados (client) + backend rejeita com FORBIDDEN (defesa em profundidade)
```

---

## 7. Casos Extremos

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| 1 | Arquivar duas vezes (duplo clique/duas abas) | Idempotente: segundo clique retorna sucesso sem efeito |
| 2 | Arquivar aluno com faturas pagas | Pagas permanecem e continuam nos relatórios |
| 3 | Arquivar aluno com NFS-e emitida | Permitido (arquivar); bloqueia apenas a exclusão definitiva (RN-009) |
| 4 | Reativar plano lotado e sem excedente | `FORBIDDEN`, nada muda (RN-004) |
| 5 | Reativar aluno que tem e-mail igual a outro ativo | (não ocorre: unique já era do registro antigo) |
| 6 | Novo aluno com e-mail de arquivado | Aviso + oferta de reativar (RN-011) |
| 7 | Aluno arquivado em relatório financeiro passado | Cobranças continuam com o nome (join preservado) |
| 8 | Aluno arquivado e reativado no mesmo mês | Não volta para "Novos (30 dias)" duplicado (usa `startDate`/`createdAt` originais) |
| 9 | Professor sem permissão tenta arquivar aluno de outro professor | `FORBIDDEN` (regra de posse mantida) |
| 10 | Professor tenta ver Histórico por URL direta | Sem aba/botões; backend rejeita listagem por admin |
| 11 | Falha do Asaas ao sincronizar assinatura | Registra log, não bloqueia (best-effort, igual hoje) |
| 12 | Falha ao excluir usuário do portal na exclusão definitiva | Transação/rollback + erro claro (corrige o órfão atual) |
| 13 | Arquivo físico de `studentFiles` em storage | Removido na exclusão definitiva; se falhar, log e segue |
| 14 | Lista vazia no Histórico | Estado vazio amigável |
| 15 | Muitos arquivados (milhares) | Busca server-side + paginação/limite; sem carregar tudo |
| 16 | Telefone vazio | WhatsApp desabilitado com tooltip |
| 17 | Motivo "Outro" sem observação | Permitido, mas observação recomendada (placeholder) |
| 18 | Mobile (360px) | Modal e lista em coluna, botões com toque ≥ 44px, sem overflow |
| 19 | Sessão expirada durante a ação | Erro controlado; nada alterado |
| 20 | Dois admins agindo no mesmo aluno | Segundo recebe idempotência/erro claro; sem duplicidade |
| 21 | Aluno arquivado some do portal | Login bloqueado com a mensagem existente |
| 22 | Reativação após meses com aulas passadas | Aulas passadas continuam no histórico; sem reagendamento automático |
| 23 | Aluno arquivado com contrato assinado ativo | Contrato permanece; nada é cancelado automaticamente (v1) |
| 24 | Fuso horário | `deletedAt`/`reactivatedAt` em timestamps UTC (padrão do banco) |

---

## 8. Dados Envolvidos

### Alterações em `students` (`drizzle/schema.ts:139-190`)

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `deletedAt` | timestamp | Não | NULL = visível; preenchido = arquivado |
| `deletedBy` | integer | Não | `users.id` de quem arquivou |
| `exitReason` | varchar(60) | Não | Um de: `financeiro`, `mudanca`, `insatisfacao`, `conclusao`, `saude`, `outro` |
| `exitNotes` | text | Não | Observação livre da saída |
| `reactivatedAt` | timestamp | Não | Última reativação (métrica) |

- **Índice**: `students_org_deleted_idx` em `(organizationId, deletedAt)` para a listagem do Histórico.
- **Sem FK nova** (padrão do projeto); integridade permanece em código.
- **Sem soft delete nas demais tabelas** — elas já são "histórico" e passam a ser preservadas.

### Migração

- Adicionar colunas via rotina idempotente de migração (padrão já usado em `server/db.ts:147-149`, com `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) + declarar no `drizzle/schema.ts`. **Risco baixo**; sem backfill (defaults NULL).

---

## 9. Permissões e Segurança

| Ação | Admin | Professor (dono do aluno) | Professor (outro aluno) | Aluno |
| --- | --- | --- | --- | --- |
| Arquivar aluno | Sim | Sim (regra de posse atual) | Não | Não |
| Ver Histórico | Sim | Não | Não | Não |
| Reativar | Sim | Não | Não | Não |
| Excluir definitivamente | Sim (dupla confirmação) | Não | Não | Não |
| WhatsApp de reengajamento | Sim | Não | Não | Não |

1. **Backend valida papel** em `listArchived`, `reactivate` e `permanentlyDelete` (mesma checagem `isAdmin` usada em `students.delete`/`updateStatus`), nunca apenas UI.
2. Isolamento por organização (`organizationId`) em todas as queries, com guarda de posse para arquivar.
3. Erros nunca expõem stack/SQL: mensagens controladas ("Aluno não encontrado", "Sem permissão…").
4. A exclusão definitiva exige digitar o nome do aluno (mitiga clique acidental).
5. Nenhum dado sensível novo é exposto; telefones já visíveis a admins.

---

## 10. Tratamento de Erros

### Erros esperados

| Situação | Mensagem |
| --- | --- |
| Aluno não encontrado | "Aluno não encontrado." |
| Sem permissão (professor/tenants) | "Você não tem permissão para esta ação." |
| Plano lotado na reativação | "Limite de alunos do plano atingido. Faça upgrade ou remova um aluno ativo." |
| NFS-e emitida | "Existem notas fiscais emitidas para este aluno — obrigação fiscal impede a exclusão definitiva." |
| Nome de confirmação incorreto | Botão desabilitado (sem chamada) |
| Sem telefone | Botão WhatsApp desabilitado com tooltip |

### Erros internos

- "Ocorreu um erro ao processar sua solicitação. Tente novamente." — detalhes apenas em log seguro (`debugLog`/`console.error` sem dados sensíveis além do ID interno).

---

## 11. Requisitos Não Funcionais

- **RNF-001 Performance:** Histórico paginado/limitado (ex.: 50 por página) com busca server-side; índice novo garante listagem rápida.
- **RNF-002 Responsividade:** modal e lista funcionam de 360px a 1440px; botões com área de toque ≥ 44px.
- **RNF-003 Acessibilidade:** modal com foco inicial no motivo, `Esc` fecha, `aria-labels` em Reativar/WhatsApp/Excluir.
- **RNF-004 Consistência visual:** tokens de tema (dark ok), `font-outfit` em títulos, glassmorphism nos cards do Histórico, seguindo o padrão de `Alunos.tsx`.
- **RNF-005 Segurança:** validação de papel no backend; idempotência nas mutations.
- **RNF-006 Integridade:** operações em transação; nenhum estado parcial.
- **RNF-007 Observabilidade:** logs de arquivar/reativar/excluir definitiva com org/IDs (sem PII além do necessário).
- **RNF-008 Testes:** cobrir arquivar (não apaga histórico), reativar (valida plano), exclusão definitiva (limpa órfãos) e filtros `deletedAt`.

---

## 12. Critérios de Aceite

### CA-001 — Arquivar preserva o histórico
**Dado** um aluno com mensalidades pagas, contrato assinado e 10 aulas passadas,
**Quando** o admin o arquiva,
**Então** ele sai das listas ativas, aparece no Histórico e **as faturas pagas, o contrato e as aulas passadas continuam existindo** (relatório financeiro do mês permanece igual).

### CA-002 — Pendências seguem o checkbox
**Dado** o modal de arquivar com o checkbox marcado e o aluno com 3 aulas futuras + 1 fatura pendente,
**Quando** arquivar,
**Então** as 3 aulas futuras e a fatura pendente somem; as passadas/pagas ficam. Desmarcado: tudo fica.

### CA-003 — Histórico só para admin
**Dado** um professor logado com acesso a Alunos,
**Quando** ele abre a página,
**Então** não vê a aba/Histórico; chamando a API de listagem de arquivados, recebe `FORBIDDEN`.

### CA-004 — Reativar volta como Ativo
**Dado** um arquivado e plano com vaga,
**Quando** o admin clica em Reativar e confirma,
**Então** o aluno volta como `ativo`, com os dados preservados, portal liberado e toast de sucesso.

### CA-005 — Reativar respeita o plano
**Dado** plano lotado e sem excedente,
**Quando** o admin tenta reativar,
**Então** recebe erro claro e o aluno continua arquivado (nada muda).

### CA-006 — Exclusão definitiva exige admin + nome
**Dado** o modal de exclusão definitiva,
**Quando** o nome digitado não confere,
**Então** o botão permanece desabilitado; com o nome correto, a exclusão remove aluno, usuário do portal, cliente Asaas e registros dependentes (incluindo os órfãos do RF-005).

### CA-007 — NFS-e bloqueia exclusão definitiva
**Dado** um arquivado com NFS-e emitida,
**Quando** o admin tenta excluir definitivamente,
**Então** o sistema bloqueia com a mensagem fiscal e o aluno permanece no Histórico.

### CA-008 — Consultas não contam arquivados
**Dado** 1 aluno arquivado,
**Quando** abrir Dashboard, Relatório de Alunos, busca de alunos e "Novos (30 dias)",
**Então** o arquivado não aparece em nenhuma delas.

### CA-009 — WhatsApp de reengajamento
**Dado** um arquivado com telefone,
**Quando** o admin clica no botão WhatsApp,
**Então** abre `wa.me` com mensagem pré-preenchida. Sem telefone, o botão fica desabilitado.

### CA-010 — Novo aluno com e-mail de arquivado
**Dado** um arquivado com `aluno@exemplo.com`,
**Quando** o admin tenta cadastrar um novo aluno com o mesmo e-mail,
**Então** o sistema avisa que existe um arquivado com esse e-mail e oferece reativá-lo.

### CA-011 — Timeline
**Dado** um aluno arquivado e depois reativado,
**Então** a timeline registra "Arquivado (motivo)" e "Reativado", com autor e data.

### CA-012 — Regressão
`pnpm check`, `pnpm test` e `pnpm build` passam sem novos erros vs. baseline do `AGENTS.md`.

### CA-013 — What's New
Entrada no topo de `shared/releases.ts` com a novidade.

---

## 13. Riscos e Dependências

### Riscos

| # | Risco | Mitigação |
| --- | --- | --- |
| R1 | Consultas esquecidas retornando arquivados | Inventário em RF-006 + testes de CA-008; arquivar muda `status='inativo'` (rede de segurança) |
| R2 | Índice único de e-mail impedir novo cadastro | RN-011 com aviso + reativar |
| R3 | Séries históricas (headcount por mês) não "devolvem" o arquivado a meses passados | Documentado como limitação v1; dados preservados permitem evolução futura (relatórios por `deletedAt`) |
| R4 | Exclusão definitiva deixar órfãos como hoje | RF-005 cobre a lista conhecida; teste dedicado |
| R5 | Cliente Asaas duplicado ao reativar | RN-010 (não remove no arquivamento) |
| R6 | Fiscal (NFS-e) | RN-009 bloqueia a exclusão definitiva |
| R7 | Arquivos físicos órfãos no storage | Remover na exclusão definitiva (best-effort + log) |
| R8 | Migração em produção | Colunas novas com default NULL (sem backfill); rotina idempotente |
| R9 | Cache stale no client após arquivar/reativar | Invalidar `students.*`, `dashboard.*`, `reports.*`, `financeiro.*`, `rankings.*` |

### Dependências

- `students.delete` atual como base da cascata definitiva — D1.
- Validação de limite do plano (`studentsRouters.ts:806-827`) — D2.
- `studentTimeline` (existente) para auditoria — D3.
- `syncOrgAsaasSubscription` (`helpers.ts:136-193`) — D4.
- Rotina de migração idempotente (`server/db.ts`) + `drizzle/schema.ts` — D5.
- Nenhuma integração externa nova além do `wa.me` (link simples) — D6.

---

## 14. Métricas de Sucesso

| Métrica | Como medir | Alvo |
| --- | --- | --- |
| Ex-alunos recuperados | % de arquivados reativados em 90 dias | ≥ 10% |
| Perda de dados em exclusão | Incidentes de "sumiu do relatório" | 0 |
| Uso do Histórico | Admins que abrem a aba por mês | ≥ 40% dos admins ativos |
| Exclusões definitivas | Volume (deve ser raro) | < 5% dos arquivados |

---

## 15. Plano de Implementação Sugerido

### Fase 1 — Estrutura e dados
1. Colunas em `students` (schema + migração idempotente) e índice `(organizationId, deletedAt)`.
2. Tipos/constantes de motivo de saída em `@shared` (para client+server).

### Fase 2 — Backend/API
1. `students.archive` (transação, pendências opcionais, timeline, mantém Asaas, bloqueia portal).
2. `students.listArchived` (admin, busca, paginação) e `students.reactivate` (valida plano, timeline).
3. `students.permanentlyDelete` (admin, cascata atual + órfãos do RF-005 + storage + Asaas + usuário).
4. Ajustes de consultas (RF-006) e aviso de e-mail duplicado (RN-011).

### Fase 3 — Frontend
1. `DeleteConfirm` → **ArquivarAlunoConfirm** (motivo/notas/checkbox).
2. Aba/modo **Histórico** em `Alunos.tsx` (admin) com busca, WhatsApp, Reativar e Excluir definitivamente (modal com nome).
3. Estados de loading/vazio/erro, responsivo e dark mode.

### Fase 4 — Integrações e rastro
1. Timeline nos eventos; invalidações completas de cache.
2. Release em `shared/releases.ts`.

### Fase 5 — Testes e verificação
1. Testes de servidor: arquivar preserva histórico; reativar valida plano; exclusão definitiva limpa dependentes; filtros `deletedAt`.
2. `pnpm check` · `pnpm test` · `pnpm build` (comparando com o baseline).
3. QA manual dos CA-001 a CA-013 (desktop e mobile).

---

## Checklist do Analista

- [x] Problema, objetivo e contexto (com evidências de código/linhas).
- [x] Decisões de negócio confirmadas com o solicitante (D1–D4).
- [x] Escopo (incluído e fora) explícito.
- [x] Requisitos funcionais com IDs (RF-001 a RF-009).
- [x] Regras de negócio explícitas (RN-001 a RN-011).
- [x] Fluxos principal, alternativos, erro, cancelamento, vazio e permissão negada.
- [x] 24 casos extremos mapeados.
- [x] Dados, índice, migração e ausência de FK documentados.
- [x] Permissões e segurança (backend + UI, LGPD, dupla confirmação).
- [x] Erros esperados vs. internos separados.
- [x] Estados de loading/vazio/sucesso/erro definidos.
- [x] Critérios de aceite testáveis (CA-001 a CA-013).
- [x] Riscos e dependências mapeados.
- [x] Métricas de sucesso propostas.
- [x] Plano de implementação em 5 fases.
