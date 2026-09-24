# PRD — Agendamento visível e editável no cadastro do aluno

> Versão: 1.0 · Data: 2026-09-24 · Status: Aguardando aprovação para implementação
> Autor: Skill `prdspec` (Análise de Sistemas / Product)
> Origem: relato de cliente — "agendei a aula mas não aparece em lugar nenhum; parece que não agendou".

---

## 1. Visão Geral

### Problema

No cadastro do aluno (`client/src/pages/NovoAluno.tsx`), o card **"Agendar Aula — Opcional na matrícula"**:

1. **Prévia insuficiente:** o único feedback antes de confirmar é um texto — `N aula(s) serão criadas · de X até Y` (`NovoAluno.tsx:1331-1337`). Não mostra **quais dias e horários** serão criados; com aulas 2x/3x por semana (multi-slot), o usuário não consegue conferir a grade.
2. **Sem lista do que foi agendado:** após agendar, o usuário recebe apenas um toast de sucesso. Não existe nenhuma lista de "aulas agendadas" visível na tela.
3. **Consulta morta:** a query `studentLessons` (`NovoAluno.tsx:417-421`) só roda em **modo edição** (`enabled: isEditMode`) e o resultado (`studentUpcomingLessons`, linha 421) **nunca é renderizado** em nenhum ponto da página.
4. **Fluxo expulsa o usuário:** no caminho "Cadastrar Aluno e Agendar Aula", o `createMutation.onSuccess` executa `setLocation("/alunos")` (`NovoAluno.tsx:358`) assim que o aluno é criado — a página é desmontada **antes** de agendar e o usuário nunca vê o resultado (nem o modal de conflitos, se houver).

**Consequência real:** a cliente agendou e concluiu que "não agendou nada", gerando dúvida/contato de suporte. O dado foi gravado corretamente — o problema é exclusivamente de **feedback visual e confirmação**.

### Objetivo

Tornar o agendamento **explícito e verificável** dentro do cadastro do aluno:

1. Antes de confirmar: mostrar **lista detalhada** (dia da semana, data e horário) de tudo o que será criado.
2. Depois de confirmar: mostrar **confirmação com a lista das aulas criadas** e atalhos (ver na agenda / editar / agendar outra).
3. Sempre: um painel **"Aulas agendadas"** no cadastro (novo aluno e edição), listando as próximas aulas com **editar/excluir**, para o usuário ter certeza a qualquer momento.
4. Corrigir o fluxo para **não navegar para fora** enquanto o agendamento está em andamento.

### Contexto

- O agendamento usa `scheduleForm` + `weeklySlots` no card (`NovoAluno.tsx`), gera ocorrências com `generateOccurrences` (`shared/recurrence.ts`) e envia em lote para `lessons.createBatch` (com `recurringGroupId`) ou aula avulsa para `lessons.create`.
- Já existem componentes reutilizáveis: `LessonDetailModal` (detalhe com **Editar**, **Excluir**, remarcar e status — `components/modals/LessonDetailModal.tsx:34-50`) e `AgendarModal` com `editingLesson` (edição — usado em `pages/Aulas.tsx:1210`).
- `lessons.delete` já existe (`Aulas.tsx:195`) e `lessons.list` aceita `studentId` (`NovoAluno.tsx:417`).
- Recentemente o cálculo multi-slot/data-hora do card foi corrigido (release `2026.09.24.3`); este PRD resolve a camada de **visibilidade**.

---

## 2. Usuários Envolvidos

| Ator | Descrição | Como usa |
| --- | --- | --- |
| Admin / dono da escola (principal) | Cadastra o aluno e agenda as aulas dele | Precisa conferir, após agendar, **quais dias/horas** ficaram marcados e corrigir se necessário |
| Secretária / recepção | Faz matrículas e agenda em nome da escola | Mesmo fluxo do admin |
| Professor (quando tem acesso a Alunos) | Agenda aulas do próprio aluno | Mesmo fluxo, respeitando permissões existentes |
| Aluno (portal) | Já vê "Minhas Aulas" no portal | **Fora do escopo** (nada muda no portal) |
| Suporte do MusicPro (indiretamente) | Recebe os chamados "não agendou" | Reduz contatos com o problema resolvido |

---

## 3. Escopo

### Incluído

1. **Prévia detalhada** das ocorrências no card de agendamento (lista com dia da semana, data `dd/MM` e hora), agrupada por dia quando houver multi-slot; substitui/expande o texto atual (`N aulas · de X até Y`).
2. **Confirmação pós-agendamento** ("Aulas agendadas com sucesso") mostrando a lista do que foi criado — data, hora, duração e instrumento — com ações: **Editar** (abre o modal de detalhe/edição da aula), **Ver na agenda** (navega para `/aulas`) e **Agendar outra** (volta ao formulário limpo).
3. **Painel "Aulas agendadas"** no cadastro do aluno, visível em modo **novo** (após o aluno existir) e em modo **edição**, listando as próximas aulas (até 5, com "Ver todas" → `/aulas`), com **Editar** e **Excluir** por aula.
4. **Habilitar a consulta de aulas também fora do modo edição** — assim que houver `studentId` (fluxo de matrícula com agendamento), o painel passa a listar.
5. **Correção do fluxo de navegação:** o `createMutation.onSuccess` não deve redirecionar para `/alunos` quando o usuário está no fluxo de agendamento (`scheduleTouched` / intenção de agendar); a tela permanece para mostrar as aulas criadas e o resultado do agendamento.
6. **Reuso** de `LessonDetailModal` (detalhe/editar/excluir) e `AgendarModal` (`editingLesson`) em vez de criar novas telas/modais.
7. Estados de **loading/vazio/erro** explícitos no painel e na confirmação.

### Fora do escopo

1. Edição em massa da série inteira (`recurringGroupId`) — na v1 a edição/exclusão é **aula a aula**.
2. Notificação de confirmação por WhatsApp/e-mail ao responsável.
3. Qualquer mudança no portal do aluno (ele já vê "Minhas Aulas").
4. Alterar as regras de conflito, limite de 200 ocorrências ou validações existentes do agendamento.
5. Redesenho da tela Agenda (`/aulas`) ou dos cards de aula dela.
6. Recorrência por "último dia útil" ou regras de calendário novas.

---

## 4. Requisitos Funcionais

### RF-001 — Prévia detalhada das ocorrências

**Descrição:** no card de agendamento, exibir a lista do que será criado com **dia da semana + data + hora** (e duração), recalculada em tempo real a cada mudança (data, hora, repetir, gerar por, Nx/sem).
**Atores:** admin, secretária, professor com acesso.
**Pré-condições:** data e horário válidos.
**Fluxo principal:**

1. Usuário ajusta os campos do card.
2. Sistema recalcula `scheduleOccurrences` (`generateOccurrences`).
3. Sistema lista as ocorrências (ex.: `Seg 29/09 17:00`, `Qua 01/10 17:00`, `Seg 06/10 17:00`…) e um resumo (`3 aulas · seg e qua · 17:00`).
4. Se passar de 200 ocorrências, mantém o bloqueio atual com mensagem clara.

**Exceções:** sem data/hora válidas → prévia oculta; data no passado → erro atual mantido.
**Dados envolvidos:** `scheduleForm` (UI), sem persistência.

### RF-002 — Confirmação de agendamento com lista das aulas criadas

**Descrição:** após sucesso do agendamento (avulso ou lote), substituir o simples toast por um **estado de sucesso no próprio card** (ou modal de confirmação) listando as aulas criadas.
**Atores:** idem.
**Pré-condições:** mutation `lessons.create`/`lessons.createBatch` retornou sucesso.
**Fluxo principal:**

1. Sistema recebe `count` de aulas criadas.
2. Exibe cabeçalho "✅ N aula(s) agendada(s)" + lista de `data · hora · duração` (usando os itens submetidos, em ordem).
3. Oferece: **Editar** (abre detalhe da aula), **Ver na agenda** (`/aulas`) e **Agendar outra**.
4. Painel de aulas agendadas é atualizado (refetch).

**Exceções:** lote parcial (itens com conflito pulados no `createBatch`) → informar "N de M aulas criadas; as demais tinham conflito" e listar apenas as criadas quando identificáveis; ao menos alertar a divergência.
**Dados envolvidos:** `lessons` (recém-criadas).

### RF-003 — Painel "Aulas agendadas" no cadastro

**Descrição:** seção fixa no cadastro do aluno (aba de agendamento), listando as **próximas aulas** do aluno (status `agendada`, `scheduledAt >= agora`), ordenadas por data, com no máximo 5 itens + "Ver todas".
**Atores:** idem.
**Pré-condições:** aluno existente (`studentId`) — no modo novo, o `studentId` passa a existir após "Cadastrar Aluno e Agendar Aula".
**Fluxo principal:**

1. Query `lessons.list({ studentId })` habilitada sempre que houver `studentId` (não apenas em edição).
2. Cada item mostra: `dd/MM/aaaa`, `HH:mm`, duração e status.
3. Ações por item: **Editar** e **Excluir** (RF-005).
4. Após agendar/excluir/editar, refetch automático.

**Exceções:** sem aulas → estado vazio "Nenhuma aula agendada ainda — use o formulário acima".
**Dados envolvidos:** `lessons` (leitura).

### RF-004 — Consulta habilitada no fluxo de matrícula (novo aluno)

**Descrição:** permitir que o painel funcione quando o aluno acabou de ser criado no próprio fluxo, sem depender de `isEditMode`.
**Atores:** idem.
**Pré-condições:** `targetStudentId` definido no fluxo.
**Fluxo principal:** após criar o aluno, o sistema mantém o `studentId` em estado e habilita a query/painel; o usuário vê a aula agendada imediatamente.
**Exceções:** falha ao criar aluno → fluxo atual (toast de erro), sem painel.
**Dados envolvidos:** `studentId` (estado local).

### RF-005 — Editar e excluir aula pelo painel

**Descrição:** ações por aula no painel e na confirmação:
- **Editar:** abre `LessonDetailModal` (ou `AgendarModal` com `editingLesson`), reutilizando o fluxo já existente em `/aulas`.
- **Excluir:** confirmação ("Excluir esta aula?") → `lessons.delete` → refetch e toast.
**Atores:** idem.
**Pré-condições:** aula existente e do aluno em tela.
**Fluxo principal:** ação → modal/confirmação → mutation → refetch → feedback.
**Exceções:** erro de permissão/registro inexistente → toast com mensagem do servidor (sem stack).
**Dados envolvidos:** `lessons` (update/delete).

### RF-006 — Não navegar durante o agendamento

**Descrição:** o redirecionamento para `/alunos` em `createMutation.onSuccess` (`NovoAluno.tsx:358`) deixa de ocorrer quando o usuário está agendando (ex.: `scheduleTouched === true` ou havia intenção de agendar). A navegação continua igual no fluxo "apenas salvar aluno".
**Atores:** idem.
**Pré-condições:** usuário acionou o agendamento.
**Fluxo principal:** salvar aluno → permanecer na tela → agendar → ver confirmação/painel → usuário decide sair ("Ver na agenda" / voltar).
**Exceções:** usuário não tocou no agendamento → comportamento atual (vai para `/alunos`).
**Dados envolvidos:** estado de UI.

### RF-007 — Estados de UI do painel e da confirmação

**Descrição:** definir: **loading** (skeleton discreto ao buscar aulas), **vazio** (mensagem amigável), **sucesso** (lista + ações), **erro** (mensagem + "Tentar novamente"), e **sem conflito visual** com o card de agendamento em telas pequenas.
**Atores:** idem.
**Pré-condições:** N/A.
**Fluxo principal:** renderizar conforme estado da query/mutation.
**Exceções:** N/A.
**Dados envolvidos:** estado de UI.

---

## 5. Regras de Negócio

### RN-001 — Fonte de verdade das datas exibidas

**Regra:** todas as datas exibidas no card/painel usam os mesmos formatos e o parser local (`safeFormat`/`parseDateOnly` de `client/src/lib/dates.ts`), evitando off-by-one de fuso.
**Exemplo válido:** aula em `2026-09-05T17:00` exibe `05/09/2026 17:00`.
**Exemplo inválido:** exibir `04/09` por usar `new Date("YYYY-MM-DD")`.
**Consequência:** inconsistência de datas é bug de alta severidade.

### RN-002 — Prévia = envio

**Regra:** a lista da prévia (RF-001) deve ser **exatamente** a mesma coleção enviada ao backend (mesma função `generateOccurrences`/mesma ordem), respeitando o limite de 200.
**Exemplo válido:** prévia com 8 itens → 8 itens no `createBatch`.
**Exemplo inválido:** prévia com 8 e envio com 4 sem aviso.
**Consequência:** divergência entre prévia e criação é bloqueador de aceite.

### RN-003 — Confirmação usa o resultado real

**Regra:** o estado de sucesso mostra as aulas **criadas**; se o lote tiver itens pulados por conflito, informar a quantidade criada vs. solicitada.
**Consequência:** usuário nunca acredita que criou mais do que existe.

### RN-004 — Exclusão é destrutiva com confirmação

**Regra:** excluir aula exige confirmação explícita; após excluir, painel e agenda refazem o fetch.
**Consequência:** ação deve ser reversível apenas conceitualmente (recriar) — por isso a confirmação.

### RN-005 — Edição individual na v1

**Regra:** editar/remarcar afeta **apenas a aula selecionada**, mesmo em séries (`recurringGroupId`).
**Exemplo válido:** mudar horário de uma aula da série deixa as demais iguais.
**Consequência:** edição em série fica documentada como evolução futura (Fora do escopo).

### RN-006 — Escopo multi-tenant

**Regra:** as consultas/ações continuam limitadas pelo `studentId` do aluno em tela e pela organização do usuário (validações já existentes no servidor). Nenhuma consulta nova "global".
**Consequência:** nenhum dado de outro aluno/organização pode aparecer no painel.

### RN-007 — Não navegar quando está agendando

**Regra:** o redirecionamento pós-cadastro só acontece quando o usuário **não** iniciou o agendamento.
**Exemplo válido:** "Salvar aluno" puro → vai para `/alunos`.
**Exemplo inválido:** "Cadastrar Aluno e Agendar Aula" → redirecionar antes de agendar.
**Consequência:** o usuário sempre vê o resultado do agendamento.

### RN-008 — Ordenação e limite do painel

**Regra:** painel mostra as 5 **próximas** aulas (`status = agendada`, `scheduledAt >= agora`), ordenadas ascendentemente; "Ver todas" navega para `/aulas`.
**Consequência:** o painel é um resumo, não um histórico.

---

## 6. Fluxos

### Fluxo principal — matrícula com agendamento

```text
Admin preenche dados do aluno
        ↓
Ajusta data/hora/repetição no card "Agendar Aula"
        ↓
Sistema mostra PRÉVIA detalhada (dias + horas) em tempo real
        ↓
Clica em "Cadastrar Aluno e Agendar Aula"
        ↓
Aluno é criado (sem redirecionar para /alunos)
        ↓
Sistema verifica conflitos (modal de conflito se houver — fluxo atual)
        ↓
Aulas criadas
        ↓
✅ Confirmação com a lista criada (data · hora · duração)
        ↓
Painel "Aulas agendadas" atualizado
        ↓
Admin confere e decide: Editar | Ver na agenda | Agendar outra
```

### Fluxo alternativo A — aluno já cadastrado (edição)

```text
Admin abre aluno existente → aba de agendamento
        ↓
Painel já lista as próximas aulas (RF-003)
        ↓
Agenda nova aula → prévia → cria → confirmação + painel atualizado
```

### Fluxo alternativo B — editar aula pelo painel

```text
Admin clica em "Editar" na aula
        ↓
Abre detalhe/edição (LessonDetailModal ou AgendarModal editingLesson)
        ↓
Salva → toast → painel refaz fetch
```

### Fluxo alternativo C — excluir aula

```text
Admin clica no ícone de excluir
        ↓
Confirmação "Excluir esta aula?"
        ↓
Exclui → toast → painel e agenda atualizados
```

### Fluxo de erro — falha ao agendar

```text
Mutation retorna erro
        ↓
Toast com mensagem do servidor (sem detalhes técnicos)
        ↓
Formulário preservado para nova tentativa
```

### Fluxo de erro — falha ao carregar o painel

```text
Query de aulas falha
        ↓
Painel mostra "Não foi possível carregar as aulas agora." + Tentar novamente
```

### Fluxo sem dados

```text
Aluno sem aulas futuras
        ↓
Painel vazio: "Nenhuma aula agendada ainda — use o formulário acima."
```

### Fluxo de cancelamento

```text
Usuário fecha detalhe/edição sem salvar
        ↓
Nada é alterado; painel permanece como estava
```

### Fluxo de permissão negada

```text
Usuário sem permissão de Alunos não acessa o cadastro (gate atual do AppSidebar/permissões)
        ↓
Servidor rejeita mutate/query com mensagem controlada (comportamento atual mantido)
```

---

## 7. Casos Extremos

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| 1 | Multi-slot 2x/3x/4x por semana | Prévia agrupa por dia (ex.: `Seg e Qua · 17:00 · 8 aulas`) e lista as datas |
| 2 | "Gerar por" 1 semana com Nx/sem | Continua gerando N aulas na semana (fix atual) e aparece na prévia/confirmação |
| 3 | Mais de 200 ocorrências | Bloqueio atual mantido, com mensagem de redução |
| 4 | Conflito de horário | Modal atual de conflito; itens conflitantes não entram sem force |
| 5 | Lote parcialmente criado | Confirmar "N de M criadas" e listar as criadas |
| 6 | Data no passado | Erro de validação atual, sem prévia |
| 7 | Data/hora inválidas ou vazias | Prévia oculta; botão de agendar com validação atual |
| 8 | Virada de mês/ano na série | Datas exibidas corretamente (parser local) |
| 9 | Mudança de fuso (BRT) | Nenhum dia a menos/menos por causa de UTC |
| 10 | Duplo clique em "Agendar" | Botão desabilita durante `isPending` (estado atual) |
| 11 | Internet cai durante o agendamento | Toast de erro; prévia preservada para tentar de novo |
| 12 | Aluno excluído em outra aba durante o fluxo | Mutations retornam erro controlado; painel mostra erro/refetch |
| 13 | Série com aulas passadas | Painel mostra apenas futuras (RN-008) |
| 14 | Todas as aulas da série canceladas | Painel vazio |
| 15 | Registro removido via `/aulas` enquanto cadastro aberto | Refetch ao focar/agir mostra lista atualizada |
| 16 | Tela pequena (mobile) | Prévia e painel empilhados, sem overflow horizontal; ações acessíveis por toque |
| 17 | Leitor de tela | Lista semântica (`ul/li`), botões com `aria-label` ("Editar aula de 29/09", "Excluir aula…") |
| 18 | Muitos itens na prévia (ex.: 40) | Área com scroll (max-height) para não empurrar o botão de agendar |
| 19 | Mudança de nome/instrumento após agendar | Lista reflete o que está no banco (não o formulário) |
| 20 | Plano/limite de alunos | Irrelevante: já tratado no cadastro antes do agendamento |

---

## 8. Dados Envolvidos

### Entidade lida/escrita: `lessons` (`drizzle/schema.ts`)

| Campo | Tipo | Uso nesta feature |
| --- | --- | --- |
| `id` | serial PK | Identificar aula para editar/excluir |
| `studentId` | integer | Filtro do painel/seleção |
| `title` | varchar | Exibir título (opcional na lista) |
| `scheduledAt` | timestamp | **Data/hora exibida** e ordenação |
| `duration` | integer | Exibir duração |
| `status` | enum | Filtrar `agendada`; exibir/cancelar |
| `recurringGroupId` | varchar | Agrupar série (v1 apenas informativo) |
| `organizationId`/`userId` | integer | Isolamento já aplicado pelo backend |

### Estado de UI (sem persistência)

- `scheduleForm` (já existe) — inclui `weeklySlots`.
- Novo: `scheduleResult` (lista de aulas criadas para a confirmação), `detailLessonId` (aula aberta no detalhe), `studentId` reutilizado após criar aluno no fluxo.

### Banco

**Nenhuma migração, coluna, índice ou seed.** Reaproveita `lessons.list`, `lessons.create`, `lessons.createBatch`, `lessons.delete` e validações existentes.

---

## 9. Permissões e Segurança

| Ação | Admin/Professor com acesso a Alunos | Professor sem acesso | Aluno | Super Admin |
| --- | --- | --- | --- | --- |
| Ver painel de aulas do aluno | Sim | Não (gate de rota) | N/A | Sim (painel próprio) |
| Agendar aula | Sim | Não | Não | Via master, fora do escopo |
| Editar/excluir aula | Sim | Não | Não | Sim |
| Ver dados de outro aluno | Não — filtro por `studentId` + organização no servidor | — | — | Não no fluxo escolar |

Regras:

1. Nenhum endpoint novo é criado; permanecem as validações de organização/permissão do backend (`lessons.list/create/createBatch/delete`).
2. Erros exibidos ao usuário são mensagens do servidor já controladas; nunca stack trace, SQL ou dados internos.
3. Logs/telemetria não devem incluir dados sensíveis do aluno além do necessário para suporte.

---

## 10. Tratamento de Erros

### Erros esperados

| Situação | Mensagem | Ação |
| --- | --- | --- |
| Falha ao agendar | "Erro ao agendar aula(s): {mensagem do servidor}" | Formulário preservado; tentar de novo |
| Conflito de horário | Modal de conflito atual | Forçar item ou ajustar |
| Falha ao carregar aulas | "Não foi possível carregar as aulas agora." | "Tentar novamente" (refetch) |
| Falha ao excluir | "Erro ao excluir aula: {mensagem}" | Nada muda; tentar de novo |
| Sem permissão | "Você não tem permissão…" (servidor) | Nada muda |
| Registro inexistente (excluído em outra aba) | "Aula não encontrada…" (servidor) | Refetch do painel |

### Erros internos

- Nunca exibir stack/servidor; apenas mensagem genérica quando não houver mensagem controlada: "Ocorreu um erro ao processar sua solicitação. Tente novamente."

---

## 11. Requisitos Não Funcionais

- **RNF-001 Performance:** prévia é cálculo local (memo) e não dispara requisição; painel usa a query existente com `staleTime: 0` e refetch após mutations; nenhuma consulta nova no backend.
- **RNF-002 Responsividade:** card, prévia e painel funcionam de 360px a 1440px; prévia com scroll interno quando passar de ~6 itens; ações com área de toque ≥ 40px.
- **RNF-003 Acessibilidade:** listas semânticas, `aria-label` nos botões de ação, foco visível, contraste no modo claro/escuro.
- **RNF-004 Consistência:** usar `safeFormat`/`parseDateOnly` (`client/src/lib/dates.ts`) e `formatBRL` quando houver valores; componentes do design system (Button, Card, Dialog).
- **RNF-005 Testabilidade:** RN-001/RN-002 cobertas por testes puros onde possível (geração/ordenação/agrupamento da prévia extraída para função pura) + verificação E2E manual dos CA.
- **RNF-006 Compatibilidade:** sem dependências novas; mantém o app Capacitor (mobile) e PWA.
- **RNF-007 SEO:** não afeta páginas públicas (feature interna autenticada).

---

## 12. Critérios de Aceite

### CA-001 — Prévia detalhada
**Dado** o card de agendamento com data 29/09/2026 às 17:00 e "Repetir: semanal / 4 semanas",
**Quando** o usuário configura os campos,
**Então** ele vê a lista `29/09, 06/10, 13/10, 20/10 · 17:00` (com o dia da semana) e o resumo "4 aulas".

### CA-002 — Prévia multi-slot
**Dado** 2x/sem (seg e qua) por 2 semanas a partir de 29/09,
**Quando** a prévia é calculada,
**Então** são listadas 4 aulas (29/09, 01/10, 06/10, 08/10) com os dias corretos e o agrupamento por dia (Seg/Qua).

### CA-003 — Confirmação com o que foi criado
**Dado** um agendamento de 3 aulas sem conflito,
**Quando** o usuário confirma,
**Então** aparece a confirmação "✅ 3 aulas agendadas" com data/hora de cada uma e os botões Editar, Ver na agenda e Agendar outra.

### CA-004 — Painel persistente
**Dado** um aluno com 2 aulas futuras,
**Quando** o admin abre o cadastro (novo fluxo de matrícula ou edição),
**Então** o painel "Aulas agendadas" lista as 2 aulas em ordem crescente com data, hora, duração e ações Editar/Excluir.

### CA-005 — Não navegar durante o agendamento
**Dado** que o usuário preencheu o agendamento e clicou em "Cadastrar Aluno e Agendar Aula",
**Quando** o aluno é criado e as aulas são criadas,
**Então** a página **não** redireciona para `/alunos` antes de exibir a confirmação/painel; a navegação só acontece se o usuário não agendou ou após ação explícita.

### CA-006 — Editar aula
**Dado** o painel com uma aula,
**Quando** o usuário clica em Editar e altera a data/hora,
**Então** o modal abre com os dados da aula, salva e o painel reflete a alteração.

### CA-007 — Excluir aula
**Dado** uma aula no painel,
**Quando** o usuário exclui e confirma,
**Então** a aula desaparece do painel e da agenda (`lessons.list` atualizado) e um toast de sucesso é exibido.

### CA-008 — Vazio, loading e erro
**Dado** um aluno sem aulas,
**Então** o painel mostra a mensagem de vazio; durante o carregamento, skeleton discreto; em falha, mensagem + "Tentar novamente".

### CA-009 — Lote parcial
**Dado** um lote de 5 itens onde 2 têm conflito e não foram forçados,
**Quando** o usuário confirma sem forçar,
**Então** a confirmação informa "3 de 5 aulas criadas" e lista as 3 criadas.

---

## 13. Riscos e Dependências

### Riscos

| # | Risco | Mitigação |
| --- | --- | --- |
| R1 | A lista de confirmação divergir do que foi criado (lote parcial) | Usar `count` retornado + refetch do painel como fonte de verdade (RN-003) |
| R2 | Regressão no fluxo que hoje redireciona após salvar aluno | Condicionar a navegação a `!scheduleTouched`; CA-005 cobre |
| R3 | Prévia e envio divergirem após futuras mudanças | Extrair o cálculo para função pura compartilhada e testar (RNF-005) |
| R4 | Painel com muitas aulas gerando rolagem longa | Limitar a 5 + "Ver todas" (RN-008) |
| R5 | Reuso do `LessonDetailModal` exigir props não disponíveis | Fallback: abrir `AgendarModal` com `editingLesson` (já usado em `/aulas`) |
| R6 | Alterações no `NovoAluno` conflitarem com correções recentes de data/hora | Já corrigido em `2026.09.24.3`; PRD assume esse estado |

### Dependências

- `lessons.list/create/createBatch/delete` (existentes) — D1.
- `LessonDetailModal` e `AgendarModal` (existentes) — D2.
- `client/src/lib/dates.ts` (`safeFormat`/`parseDateOnly`) — D3.
- Permissões/gates de rota atuais (`AppSidebar`/permissões) — D4.
- `shared/recurrence.ts` (`generateOccurrences`) — D5.

---

## 14. Métricas de Sucesso

| Métrica | Como medir | Alvo |
| --- | --- | --- |
| Contatos de suporte "não agendou" | Tickets/mensagens citando o problema | Redução ≥ 70% em 30 dias |
| Matrículas com agendamento concluído | % de alunos criados com ≥ 1 aula nos primeiros 7 dias | +20% vs. baseline |
| Edições/cancelamentos pelo painel | Uso dos botões Editar/Excluir | ≥ 10% das matrículas com agendamento |
| Tempo até confiança | Tempo entre agendar e sair da tela | Irrelevante para o negócio; foco é clareza |

---

## 15. Plano de Implementação Sugerido

### Fase 1 — Estrutura e dados (client)

1. Extrair o cálculo/agrupamento da prévia para função pura (ex.: `buildSchedulePreview(occurrences)`) reutilizada por prévia, confirmação e envio.
2. Estados novos no `NovoAluno`: `scheduleResult` (aulas criadas), `detailLessonId`, uso do `studentId` criado no fluxo.

### Fase 2 — Prévia e confirmação (RF-001, RF-002)

1. Renderizar a prévia detalhada (lista + resumo, scroll interno, agrupamento por dia).
2. Criar o estado de sucesso com lista do que foi criado + ações (Editar/Ver na agenda/Agendar outra) e caso de lote parcial.

### Fase 3 — Painel "Aulas agendadas" (RF-003, RF-004, RF-005, RF-007)

1. Habilitar `lessons.list` quando houver `studentId` (novo ou edição).
2. Renderizar painel (5 próximas + Ver todas) com editar/excluir, estados de loading/vazio/erro.
3. Reusar `LessonDetailModal`/`AgendarModal` para edição e `lessons.delete` com confirmação.

### Fase 4 — Fluxo e integrações (RF-006)

1. Condicionar o `setLocation("/alunos")` a `!scheduleTouched`.
2. Garantir refetch do painel após cada mutation (create/createBatch/delete/update).
3. Ajustar navegação "Ver na agenda" e "Agendar outra".

### Fase 5 — Testes e verificação

1. `pnpm check` (sem novos erros vs. baseline), `pnpm test` e `pnpm build`.
2. Testes da função pura da prévia (ordenação, agrupamento, limite 200).
3. QA manual da matriz de CA-001 a CA-009 em desktop e mobile, incluindo o fluxo real "Cadastrar Aluno e Agendar Aula".

---

## Checklist do Analista

- [x] Problema, objetivo e contexto definidos (com evidência em arquivo/linha).
- [x] Usuários envolvidos identificados.
- [x] Escopo incluído e fora do escopo explícitos (edição de série fica para v2).
- [x] Requisitos funcionais com IDs, fluxo, exceções e dados.
- [x] Regras de negócio explícitas (prévia = envio, confirmação real, escopo multi-tenant, navegação).
- [x] Fluxos principal, alternativos, erro, cancelamento, sem dados e permissão negada.
- [x] 20 casos extremos mapeados.
- [x] Dados e ausência de migração documentados.
- [x] Permissões e segurança (reuso de endpoints e gates existentes).
- [x] Erros esperados vs. internos separados.
- [x] Loading/vazio/sucesso/erro definidos (RF-007).
- [x] Critérios de aceite objetivos (CA-001 a CA-009).
- [x] Riscos e dependências mapeados.
- [x] Métricas de sucesso propostas.
- [x] Plano de implementação em fases.
