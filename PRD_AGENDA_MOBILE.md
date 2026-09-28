# PRD — Agenda Mobile (modelo calendário com marcadores + filtros)

> Versão: 1.0 · Data: 2026-09-25 · Status: Aguardando aprovação para implementação
> Autor: Skill `prdspec` (Análise de Sistemas / Product)
> Origem: solicitação do dono — "crie esse modelo de agenda para o mobile, com filtros e tudo mais de mês, semana e dia, voltado para escola de música" (referência visual: app Octmind — calendário mensal com pontinhos por tipo de evento + lista do dia + FAB).

---

## 1. Visão Geral

### Problema

A agenda atual do app (`client/src/pages/Aulas.tsx`) tem modos **mês/semana/dia/eventos** (`CalendarView = "mes" | "semana" | "dia" | "eventos"`, linhas 44-51), mas foi construída com foco **desktop**: a visão de mês é um calendário de células altas com cards de aula dentro, difícil de ler no celular, e os filtros ficam em uma barra densa (linhas 448-498). No mobile, o professor precisa abrir a agenda e enxergar rapidamente:

1. **O que tem no mês** (quais dias têm aulas e como estão — agendada/concluída/falta/cancelada);
2. **O que tem no dia selecionado**, em cards legíveis (aluno, instrumento, horário, sala, professor);
3. **Filtrar** por professor, sala, instrumento/modalidade e tipo de aula;
4. **Agendar rápido** a partir do dia que está olhando.

O modelo de referência (Octmind, print enviado) resolve isso com: calendário mensal compacto com **pontinhos coloridos por categoria**, legenda clicável, **"Eventos do dia"** em cards com tags, e **FAB "+"**.

### Objetivo

Criar uma **experiência de agenda mobile-first** dentro de `Aulas.tsx`, no padrão do print, adaptada para escola de música e alimentada pelos dados reais de aulas:

1. **Mês** com pontinhos por status de aula + **Semana** e **Dia** compactos.
2. **Lista do dia selecionado** com cards de aula (aluno, instrumento, horário, sala, professor, tags).
3. **Filtros** (professor, sala, instrumento/modalidade, tipo de aula) em painel/bottom sheet, com legenda clicável.
4. **Ações**: tocar no card abre o detalhe da aula (chamada/remarcar — modal já existente); FAB "+" abre o agendamento no dia selecionado (modal já existente).
5. **Desktop permanece como está** — a nova experiência entra no mobile (`< lg`).

### Contexto (decisões aprovadas pelo solicitante)

| # | Decisão | Valor aprovado |
|---|---|---|
| D1 | Onde aplicar | Agenda do app (admin/professor), **mobile-first**; desktop atual preservado |
| D2 | Eventos no calendário | **Aulas** (v1) — status: agendada, concluída, falta, cancelada (+ turma em destaque) |
| D3 | Filtros | **Professor**, **Tipo de evento/aula**, **Instrumento/modalidade**, **Sala** |
| D4 | Ações | Tocar no evento → **detalhe** (modal existente); **FAB "+"** → agendamento rápido no dia |

**O que já existe e será reutilizado (não recriar):**
- Dados: `lessons.listRange({ start, end })` (`server/routers/lessonsRouters.ts:1381`) já retorna título, `scheduledAt`, duração, status, `studentName`, sala, professor e instrumento.
- Cores por status: `AULA_STATUS_CONFIG` em `client/src/components/aulas/LessonCardDesktop.tsx` (importado em `Aulas.tsx:42`).
- Detalhe da aula: `LessonDetailModal` (`Aulas.tsx:1211`) — chamada, remarcar, status, excluir.
- Agendamento: `AgendarModal` com `initialDate` (`Aulas.tsx:1210`).
- Componentes de UI: `Sheet`/`Drawer` (bottom sheet de filtros), `Button`, `Badge`, `Skeleton`, `Calendar` icons.
- Modos mês/semana/dia/eventos e filtros de estado (`instrumentFilter`, `teacherFilter`, `statusFilterDesktop`, `lessonTypeFilter` — `Aulas.tsx:53-56, 209-226`) servem de base para a lógica de filtragem.
- `MobileTabBar` fixo embaixo (offset obrigatório para o FAB).

---

## 2. Usuários Envolvidos

| Ator | Uso |
| --- | --- |
| **Admin da escola** (principal no celular) | Abre a agenda para conferir o dia/semana, filtrar por professor/sala e agendar |
| **Professor** (com acesso a Aulas) | Vê as próprias aulas (filtro de professor travado no dele, como já ocorre hoje) e navega por dia/semana/mês |
| Aluno | **Fora do escopo** (já tem a própria agenda no portal) |
| Recepção/secretaria | Usa como admin, com os mesmos filtros |

---

## 3. Escopo

### Incluído

1. **Nova agenda mobile-first** em `Aulas.tsx`, exibida apenas em telas `< lg` (desktop intocado):
   - **Mês**: grade 7 colunas compacta, semana iniciando no **domingo** (`D S T Q Q S S`, como no print e no app), dia "hoje" destacado, **até 4 pontinhos** por dia (agregados por status, com “+N”), dias de outro mês esmaecidos.
   - **Semana**: faixa horizontal de 7 dias com indicador de quantidade/status; seleção do dia.
   - **Dia**: lista vertical do dia selecionado.
   - **Legenda clicável** (Agendada/Concluída/Falta/Cancelada) que liga/desliga cada status.
2. **Lista "Aulas do dia — {dd/MM/aaaa}"** com cards contendo: horário + duração, aluno (ou "Turma · N alunos"), instrumento, sala, professor e **tags de status** (padrão do print: nome, subtítulo e chips).
3. **Filtros em bottom sheet**: professor, sala, instrumento/modalidade, tipo de aula; contador de filtros ativos com "Limpar".
4. **Ações**: tocar no card → `LessonDetailModal`; FAB "+" → `AgendarModal` com `initialDate` = dia selecionado.
5. **Gestos e navegação**: swipe horizontal para trocar mês/semana/dia; setas ‹ › no cabeçalho; "Hoje" para voltar ao dia atual; pull-to-refresh (refetch de `listRange`).
6. **Estados**: loading (skeleton), vazio ("Nenhuma aula neste dia"), erro com "Tentar novamente", dia fechado (usa `settings.getSchoolHours` → "Escola fechada neste dia").
7. **Animação** com Framer Motion (transição de mês/dia, entrada em cascata dos cards).
8. **Release no What's New**.

### Fora do escopo (v1)

1. Portal do aluno (a agenda de lá continua como está) — decisão D1.
2. Marcações de **financeiro/comunicados/reposições** no calendário (D2 = apenas aulas na v1; extensível depois com a mesma infraestrutura de "eventos").
3. Visão de lista infinita ("eventos" dos próximos N dias) — o modo "eventos" atual continua no desktop; no mobile a lista é por dia.
4. Criar/editar cobranças, comunicados ou reposições a partir da agenda.
5. Drag-and-drop de aulas entre horários/dias.
6. Notificações push da agenda.

---

## 4. Requisitos Funcionais

### RF-001 — Visualização Mês (mobile)

**Descrição:** grade de calendário do mês com marcadores por status de aula.
**Atores:** admin, professor.
**Pré-condições:** usuário com acesso a Aulas.
**Fluxo principal:**

1. Usuário abre `Aulas` no celular → modo **Mês** por padrão.
2. Sistema carrega as aulas do intervalo do mês (com margem de 7 dias antes/depois para os dias vizinhos visíveis) via `lessons.listRange`.
3. Cada dia exibe até **4 pontinhos** (um por status presente: agendada, concluída, falta, cancelada); se houver mais de 4 aulas/status, mostra contador "+N" ao lado.
4. Dia atual recebe círculo de destaque; dia selecionado recebe fundo sólido.
5. Tocar num dia → seleciona e atualiza a lista do dia (RF-003).

**Exceções:** mês vazio → grade normal, com aviso no painel do dia; erro de API → estado de erro (RF-008).
**Dados:** `lessons.listRange` (id, scheduledAt, status, lessonType, studentName, instrumentId, roomId, teacherId).

### RF-002 — Visualizações Semana e Dia (mobile)

**Descrição:** faixa de 7 dias (semana) e foco em um dia, com o mesmo padrão visual.
**Atores:** admin, professor.
**Fluxo principal:**

1. Alternador no topo: **Mês · Semana · Dia** (segmented control de toque).
2. Semana: faixa horizontal com dia da semana, número e pontos de status; tocar seleciona o dia e mostra a lista abaixo.
3. Dia: cabeçalho com data por extenso e navegação ‹ › entre dias.
4. Swipe horizontal troca de período conforme o modo (mês a mês, semana a semana, dia a dia).

**Exceções:** nenhum dia selecionado na semana → seleciona hoje (ou o primeiro dia com aula).
**Dados:** mesmo de RF-001.

### RF-003 — Lista "Aulas do dia"

**Descrição:** cards do dia selecionado, ordenados por horário.
**Atores:** admin, professor.
**Fluxo principal:**

1. Título `Aulas do dia — {dd/MM/aaaa}` (padrão do print "Eventos do dia").
2. Card mostra: **horário** (`HH:mm` + duração), **aluno** (ou `Turma · N alunos`), **instrumento**, **sala**, **professor** (quando admin) e **tag(s) de status** coloridas (reuso de `AULA_STATUS_CONFIG`).
3. Aula experimental → tag "Experimental"; reposição → tag "Reposição" (quando identificável).
4. Tocar no card → `LessonDetailModal` do dia (RF-005).
5. Estado vazio: "Nenhuma aula neste dia" + atalho "Agendar aula".

**Exceções:** aula sem sala → "Sala a definir"; sem instrumento → "Instrumento a definir".
**Dados:** itens filtrados de `listRange`.

### RF-004 — Filtros (bottom sheet) e legenda clicável

**Descrição:** filtragem da agenda sem ocupar a tela.
**Atores:** admin, professor (com restrições — RN-004).
**Fluxo principal:**

1. Botão "Filtros" (com badge de contagem) abre `Sheet` inferior.
2. Opções: **Professor** (admin: todos; professor: fixo no próprio — desabilitado), **Sala**, **Instrumento**, **Modalidade** (Individual/Turma/Online), **Status** (agendada/concluída/falta/cancelada).
3. A legenda de cores do calendário também funciona como filtro (tocar liga/desliga o status).
4. "Aplicar" fecha o sheet; "Limpar" remove todos; filtros ativos aparecem como chips removíveis acima da lista.
5. Filtros são aplicados em memória (client) sobre o intervalo carregado — sem novas chamadas por filtro.

**Exceções:** combinação sem resultados → estado vazio específico "Nenhuma aula com os filtros selecionados" + "Limpar filtros".
**Dados:** `lessons.listRange` + listas auxiliares (`professores.list`, `studioRooms.list`, `instruments.list`).

### RF-005 — Detalhe da aula (reuso)

**Descrição:** abrir a aula selecionada no `LessonDetailModal` já existente (chamada, status, remarcar, excluir).
**Atores:** admin, professor (com as permissões já aplicadas no modal).
**Fluxo principal:** tocar no card → modal abre com os dados; ao fechar, a lista é atualizada se houve alteração (invalidação/refetch).
**Exceções:** aula removida em outra sessão → modal avisa/atualiza.
**Dados:** `lessons.getById` (usado pelo modal).

### RF-006 — FAB de agendamento rápido

**Descrição:** botão flutuante "+" posicionado acima da `MobileTabBar`, abrindo o `AgendarModal` com o dia selecionado.
**Atores:** admin, professor (com permissão de agenda).
**Fluxo principal:** toque no FAB → `AgendarModal(initialDate = selectedDate)` → ao criar, refetch de `listRange` e seleção do dia criado.
**Exceções:** dia fechado (escola fechada) → permitir agendar, mas avisar "Este dia está fora do expediente da escola" (não bloquear na v1).
**Dados:** `AgendarModal` existente.

### RF-007 — Navegação temporal e "Hoje"

**Descrição:** setas ‹ ›, swipe e botão "Hoje".
**Atores:** admin, professor.
**Fluxo principal:** ‹ › deslocam o período conforme o modo; swipe faz o mesmo em telas touch; "Hoje" volta para a data atual e seleciona o dia.
**Exceções:** swipe acidental durante rolagem vertical → o gesto só é capturado em movimento predominantemente horizontal (threshold definido em RN-005).
**Dados:** estado de UI.

### RF-008 — Estados, carregamento e atualização

**Descrição:** feedback completo em todos os estados.
**Atores:** todos.
**Fluxo principal:**

1. Loading inicial: skeleton do calendário + lista.
2. Troca de período: mantém o calendário e mostra shimmer discreto na lista enquanto busca o novo intervalo.
3. Erro: "Não foi possível carregar a agenda agora." + "Tentar novamente".
4. Pull-to-refresh refaz `listRange` do intervalo atual.
5. Após criar/editar/excluir aula: refetch do intervalo e atualização dos pontinhos.

**Dados:** estado de queries.

### RF-009 — Dia fechado (expediente da escola)

**Descrição:** usar `settings.getSchoolHours` (já existente) para marcar dias fechados.
**Atores:** todos.
**Fluxo principal:** dia sem expediente exibe "Escola fechada" na lista do dia (cinza discreto); no calendário, o dia pode ter um leve esmaecimento (sem competir com os pontinhos).
**Exceções:** se houver aulas no dia (ex.: evento especial), as aulas aparecem normalmente e o aviso some.
**Dados:** `settings.getSchoolHours`.

---

## 5. Regras de Negócio

### RN-001 — Fonte única de verdade das aulas

**Regra:** a agenda mobile usa `lessons.listRange` por intervalo; nenhuma consulta nova por status/filtro (filtros são locais).
**Exemplo válido:** trocar de mês busca o intervalo novo; marcar "Cancelada" na legenda não gera requisição.
**Exemplo inválido:** 4 chamadas por filtro.
**Consequência:** performance previsível.

### RN-002 — Agregação dos pontinhos

**Regra:** por dia, no máximo **4 pontinhos** (um por status presente: `agendada`, `concluida`, `falta`, `cancelada`). Se a soma de aulas do dia exceder 4, mostrar `+N` (N = total − 4).
**Exemplo válido:** 6 aulas (3 agendadas, 2 concluídas, 1 falta) → 3 pontinhos + "+6" (como no print da referência).
**Exemplo inválido:** 6 pontinhos estourando a célula.
**Consequência:** grade sempre legível a 360px.

### RN-003 — Ordem e cores dos status

**Regra:** as cores seguem `AULA_STATUS_CONFIG` (fonte única já usada no desktop). Ordem fixa de exibição: Agendada → Concluída → Falta → Cancelada.
**Exemplo válido:** consistência entre calendário, legenda, tags e chips de filtro.
**Exemplo inválido:** cor nova apenas no mobile.
**Consequência:** divergência visual = bug médio.

### RN-004 — Escopo do professor

**Regra:** professor vê apenas as próprias aulas (filtro de professor travado no dele, como já ocorre em `Aulas.tsx`); admin vê todos e pode filtrar.
**Exemplo válido:** professor abre o filtro e "Professor" está desabilitado com o nome dele.
**Exemplo inválido:** professor filtrando por outro professor.
**Consequência:** consistente com o backend atual.

### RN-005 — Gestos

**Regra:** swipe horizontal só é capturado quando o movimento horizontal domina (≥ 1,5× o vertical e > 30px); rolagem vertical nunca troca o período.
**Consequência:** evitar troca acidental ao rolar a lista.

### RN-006 — Data e fuso

**Regra:** agrupamentos por dia usam a data **local** (America/Sao_Paulo no servidor, dispositivo no client) — usar `parseISO`/helpers locais; nunca `new Date("YYYY-MM-DD")` para exibir.
**Exemplo válido:** aula às 23:30 aparece no dia correto.
**Consequência:** off-by-one é bug alto.

### RN-007 — Semana começa no domingo

**Regra:** grade inicia no domingo (`D S T Q Q S S`), consistente com a agenda atual.
**Consequência:** cabeçalho e faixa de semana seguem essa ordem.

### RN-008 — Filtros persistentes durante a sessão

**Regra:** filtros ficam em memória enquanto o usuário navega entre mês/semana/dia; ao recarregar a página, voltam ao padrão (todos) — deep link com querystring fica para v2.
**Consequência:** navegação sem perder contexto.

---

## 6. Fluxos

### Fluxo principal — Ver o dia e abrir a aula

```text
Admin abre Aulas no celular
        ↓
Mês atual com pontinhos por status (dia de hoje destacado)
        ↓
Toca no dia 22 → lista "Aulas do dia — 22/09/2026"
        ↓
Toca no card do João Victor (19:00 · Violão · Sala 2)
        ↓
LessonDetailModal abre (chamada/remarcar/status)
        ↓
Fecha → lista e pontinhos atualizados se algo mudou
```

### Fluxo alternativo A — Filtrar por professor e sala

```text
Filtros → bottom sheet
        ↓
Seleciona Professor "Bruno" + Sala "Sala 2" → Aplicar
        ↓
Chips ativos acima da lista; calendário e lista refletem o filtro
        ↓
Legenda: desliga "Cancelada" → some do calendário
```

### Fluxo alternativo B — Agendar rápido

```text
Dia 22 selecionado → FAB "+"
        ↓
AgendarModal abre com 22/09 pré-selecionado
        ↓
Cria a aula → toast → refetch → pontinho novo no dia 22
```

### Fluxo de erro — Falha ao carregar

```text
listRange falha
        ↓
"Não foi possível carregar a agenda agora." + Tentar novamente
        ↓
Calendário mantém o período anterior
```

### Fluxo sem dados

```text
Mês sem aulas
        ↓
Grade normal + "Nenhuma aula neste dia" no painel
```

### Fluxo de permissão negada

```text
Usuário sem acesso a Aulas
        ↓
Rota bloqueada pelo gate atual do MusicLayout/permissões (inalterado)
```

---

## 7. Casos Extremos

| # | Caso | Comportamento |
| --- | --- | --- |
| 1 | Muitas aulas no mesmo dia (10+) | 4 pontinhos + "+N"; lista com scroll normal |
| 2 | Aula às 23:30 | Aparece no dia correto (RN-006) |
| 3 | Aulas em dia de escola fechada | Aulas aparecem; aviso de fechado some |
| 4 | Virada de mês na grade (dias 30/1/2 visíveis) | Dias de outro mês esmaecidos e navegáveis (toque seleciona e muda de mês se necessário) |
| 5 | 29/02 em ano bissexto | Grade correta |
| 6 | Filtros combinados sem resultado | Estado vazio específico + "Limpar filtros" |
| 7 | Filtro de status deixa dia sem nenhum ponto | Dia sem pontinhos; lista vazia com aviso |
| 8 | Swipe durante rolagem da lista | Não troca período (RN-005) |
| 9 | Aula criada em outro dispositivo | Só aparece após refetch/pull-to-refresh (v1) |
| 10 | Aula excluída enquanto o detalhe está aberto | Modal fecha/atualiza com erro controlado |
| 11 | FAB sobrepondo a MobileTabBar | FAB com `bottom` acima da barra; área de toque ≥ 56px |
| 12 | Tela 320px | Grade não estoura; cards ocupam 100% |
| 13 | Dark mode | Cores dos pontinhos e tags com contraste AA |
| 14 | Sessão expirada | Erro controlado, sem vazar detalhes |
| 15 | Internet lenta | Skeleton; sem layout shift |
| 16 | Filtro "Turma" | Cards de turma com contagem de alunos |
| 17 | Aula experimental | Tag "Experimental" |
| 18 | Reposição | Tag "Reposição" quando `isReposition`/equivalente |
| 19 | Múltiplos status no mesmo dia | Até 4 pontinhos (um por status) |
| 20 | Primeiro acesso (sem aulas no mês) | Estado vazio amigável |
| 21 | Rolagem infinita do mês? | Não há — mês é fixo |
| 22 | Mudança de fuso do dispositivo | Agrupamento pelo horário local do dispositivo |
| 23 | Dois admins editando a mesma aula | Última gravação vence; lista atualiza no refetch |
| 24 | Acessibilidade | Dia-toque com `aria-label` ("22 de setembro, 6 aulas"), foco visível, leitores de tela |

---

## 8. Dados Envolvidos

**Nenhuma alteração de banco, migração ou FK.** Tudo em cima do que existe:

| Fonte | Uso |
| --- | --- |
| `lessons.listRange({ start, end })` (`lessonsRouters.ts:1381`) | Aulas do intervalo (id, título, `scheduledAt`, duração, status, aluno, sala, professor, instrumento, turma/experimental) |
| `lessons.getById` | Detalhe (modal existente) |
| `professores.list`, `studioRooms.list`, `instruments.list` | Opções dos filtros |
| `settings.getSchoolHours` | Marcar dias fechados (RF-009) |
| `AULA_STATUS_CONFIG` (client) | Cores/labels dos status (fonte única) |

**Estado de UI (client):** `periodMode` (`mes|semana|dia`), `selectedDate`, `filters` (professorId, roomId, instrumentId, lessonType, statusSet), `isFilterSheetOpen`.

---

## 9. Permissões e Segurança

| Ação | Admin | Professor | Sem acesso a Aulas |
| --- | --- | --- | --- |
| Ver a agenda mobile | Sim | Sim (só as próprias aulas) | Não (rota bloqueada pelo gate atual) |
| Filtrar por professor | Sim | Não (travado nele) | — |
| Abrir detalhe/chamada | Sim | Sim (próprias aulas) | — |
| Agendar | Sim | Sim (permissão atual) | — |

Regras: nenhum endpoint novo; validações de organização/permissão do backend permanecem. Erros exibidos são mensagens controladas (sem stack/SQL).

---

## 10. Tratamento de Erros

| Situação | Mensagem |
| --- | --- |
| Falha ao carregar | "Não foi possível carregar a agenda agora." + Tentar novamente |
| Falha ao agendar | Mensagem do servidor controlada (modal existente) |
| Aula inexistente no detalhe | "Aula não encontrada. A agenda foi atualizada." |
| Sem permissão | "Você não tem permissão para esta ação." |

Erros internos: "Ocorreu um erro ao processar sua solicitação. Tente novamente." — detalhes somente em logs.

---

## 11. Requisitos Não Funcionais

- **RNF-001 Performance:** ≤ 1 requisição por mudança de período; filtros locais; alvo de interação < 100ms ao trocar de dia; primeiro render do mês < 1s em 4G.
- **RNF-002 Mobile-first:** layout de 320px a 1023px; alvos de toque ≥ 44px (dias do calendário ≥ 40px com espaçamento); FAB ≥ 56px.
- **RNF-003 Acessibilidade:** `aria-label` nos dias (data + contagem), navegação por teclado externa, contraste AA no dark/light, foco visível.
- **RNF-004 Consistência:** tokens de tema, `font-outfit` em títulos, cores de status reutilizadas, animações com Framer Motion (transições de 150–250ms, entrada em cascata dos cards).
- **RNF-005 Resiliência:** pull-to-refresh, refetch após mutations, sem estado quebrado com dados parciais.
- **RNF-006 Compatibilidade:** PWA e app Capacitor (gestos não podem conflitar com o "voltar" do Android — swipe horizontal é interno da agenda).
- **RNF-007 SEO:** N/A (área autenticada).
- **RNF-008 Testabilidade:** função pura de agregação de pontinhos por dia + filtros testável (extraída para helper) com testes unitários.

---

## 12. Critérios de Aceite

### CA-001 — Mês com pontinhos
**Dado** um mês com aulas em vários dias e status,
**Quando** o admin abre a agenda no celular,
**Então** cada dia mostra até 4 pontinhos (um por status) e "+N" quando houver mais, com "hoje" destacado.

### CA-002 — Lista do dia
**Dado** o dia 22/09 selecionado com 2 aulas,
**Quando** a lista renderiza,
**Então** mostra "Aulas do dia — 22/09/2026" com cards contendo horário, aluno, instrumento, sala, professor e tag de status.

### CA-003 — Semana e dia
**Dado** o modo Semana,
**Quando** o usuário toca em outro dia,
**Então** a lista abaixo atualiza para o dia escolhido; o modo Dia mostra navegação ‹ › funcionando.

### CA-004 — Filtros
**Dado** o bottom sheet de filtros,
**Quando** o admin seleciona Professor "Bruno" + Sala "Sala 2" + status "Agendada" e aplica,
**Então** calendário e lista exibem apenas essas aulas, com chips ativos e opção de limpar.

### CA-005 — Legenda clicável
**Dado** a legenda com "Cancelada" ligada,
**Quando** o usuário toca em "Cancelada",
**Então** os pontinhos/tags e cards cancelados somem (e voltam ao tocar de novo).

### CA-006 — Detalhe da aula
**Dado** um card na lista,
**Quando** tocado,
**Então** o `LessonDetailModal` abre com os dados corretos e, ao fechar após uma alteração, lista/pontinhos são atualizados.

### CA-007 — Agendar pelo FAB
**Dado** o dia 22 selecionado,
**Quando** o admin toca no FAB "+" e cria a aula,
**Então** o `AgendarModal` abre com 22/09 e, ao salvar, a aula aparece na lista e um novo pontinho marca o dia.

### CA-008 — Swipe e "Hoje"
**Dado** o modo Mês,
**Quando** o usuário desliza para a esquerda,
**Então** avança para o próximo mês; "Hoje" retorna ao dia atual.

### CA-009 — Estados
**Dado** rede lenta, falha e dia sem aulas, respectivamente,
**Então** o sistema mostra skeleton, erro com "Tentar novamente" e o vazio "Nenhuma aula neste dia".

### CA-010 — Dia fechado
**Dado** um domingo sem expediente (conforme `getSchoolHours`),
**Quando** o dia é aberto,
**Então** aparece "Escola fechada" — e se houver aula cadastrada, as aulas aparecem normalmente.

### CA-011 — Professor
**Dado** um professor logado,
**Quando** abre a agenda e o painel de filtros,
**Então** vê apenas as próprias aulas e o filtro de professor está travado no nome dele.

### CA-012 — Desktop preservado
**Dado** um acesso em desktop (≥ 1024px),
**Então** a agenda atual permanece exatamente como hoje (a nova experiência é exclusiva do mobile).

### CA-013 — Testes/regressão
Helper de agregação com testes unitários; `pnpm check`, `pnpm test` e `pnpm build` sem novos erros vs. baseline.

### CA-014 — What's New
Entrada no topo de `shared/releases.ts` descrevendo a nova agenda mobile.

---

## 13. Riscos e Dependências

### Riscos

| # | Risco | Mitigação |
| --- | --- | --- |
| R1 | Conflito de gestos (swipe × scroll × voltar do Android) | RN-005 + teste em dispositivo real |
| R2 | Volume de aulas por mês grande em escolas grandes | Uma chamada por período + render com virtualização se necessário (> 300 itens) |
| R3 | Cores de status divergirem do desktop | Reuso de `AULA_STATUS_CONFIG` (RN-003) |
| R4 | FAB sobreposto à tab bar em aparelhos com safe-area | `bottom-[calc(...)]` considerando `env(safe-area-inset-bottom)` |
| R5 | Datas erradas por fuso | RN-006 + testes com 23:30 |
| R6 | `listRange` não trazer todos os campos necessários (turma, experimental, reposição) | Confirmar no início da Fase 2; complementar select se preciso |

### Dependências

- `lessons.listRange`, `professores.list`, `studioRooms.list`, `instruments.list`, `settings.getSchoolHours` — existentes.
- `LessonDetailModal`, `AgendarModal`, `MobileTabBar`, `Sheet`, `AULA_STATUS_CONFIG` — existentes.
- Permissões/gates atuais (`shared/permissions.ts`, MusicLayout) — inalterados.

---

## 14. Métricas de Sucesso

| Métrica | Como medir | Alvo |
| --- | --- | --- |
| Uso da agenda no celular | Sessões mobile em Aulas / sessões totais do app | +30% em 30 dias |
| Tempo para achar uma aula | Toques até abrir o detalhe | ≤ 2 toques |
| Agendamentos pelo FAB | Aulas criadas via FAB / total | ≥ 25% no mobile |
| Erros de navegação temporal | Reclamações de "dia errado" | 0 |

---

## 15. Plano de Implementação Sugerido

### Fase 1 — Estrutura e lógica pura
1. Helper puro `buildMonthGrid(date)` e `aggregateDayStatuses(lessons)` (pontinhos + "+N") em `client/src/lib/agenda.ts` (ou `shared/`), com testes unitários.
2. Tipos de filtros e modo (`mes|semana|dia`) e persistência em memória.

### Fase 2 — Componentes mobile
1. `MobileAgendaCalendar` (grade mês / faixa semana / dia) usando tokens, com animação Framer Motion.
2. `MobileDayLessonList` (cards do dia com tags e estados).
3. `MobileAgendaFilters` (bottom sheet com chips; legenda clicável).

### Fase 3 — Integração na página
1. Em `Aulas.tsx`: renderização condicional `isMobile` para a nova experiência, mantendo o desktop intacto.
2. FAB "+" acima da `MobileTabBar` integrado ao `AgendarModal(initialDate)`.
3. Pull-to-refresh + refetch após mutations; estados de loading/erro/vazio.

### Fase 4 — Polimento e acessibilidade
1. Contraste, `aria-labels`, safe-area, dark mode, gestos (RN-005).
2. Release em `shared/releases.ts`.

### Fase 5 — Testes e verificação
1. Testes unitários do helper de agregação/grade.
2. `pnpm check` · `pnpm test` · `pnpm build`.
3. QA manual dos CA-001 a CA-014 em 360px e 768px (Android + iPhone) e conferência de que o desktop (CA-012) não mudou.

---

## Checklist do Analista

- [x] Problema, objetivo e contexto (com referência visual e decisões D1–D4).
- [x] Usuários envolvidos identificados (admin, professor; aluno fora).
- [x] Escopo incluído e fora do escopo explícitos.
- [x] Requisitos funcionais com IDs (RF-001 a RF-009).
- [x] Regras de negócio explícitas (RN-001 a RN-008).
- [x] Fluxos principal, alternativos, erro, vazio e permissão negada.
- [x] 24 casos extremos mapeados.
- [x] Dados: reuso total, sem migração.
- [x] Permissões e segurança alinhadas ao gate atual.
- [x] Erros esperados vs. internos.
- [x] Estados de loading/vazio/erro/atualização definidos.
- [x] Critérios de aceite testáveis (CA-001 a CA-014).
- [x] Riscos e dependências mapeados.
- [x] Métricas de sucesso propostas.
- [x] Plano de implementação em 5 fases.
