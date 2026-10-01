# PRD — Responsável no Financeiro + Professor e Conclusão em Alunos

Versão: 1.0 — 01/10/2026
Referência visual: telas do Emusys ("Contas a Receber" com "Responsável" no nome do aluno;
"Alunos e Ex-Alunos" com "-Prof." e coluna "Conclusão" por matrícula).

---

## 1. Visão Geral

### Problema
1. **Financeiro:** na lista de mensalidades o operador vê apenas o nome do aluno. Quando quem
   paga é o responsável (pai/mãe), o financeiro não sabe com quem falar sobre cobrança.
   O Emusys exibe "Nome do Aluno - **Responsável: Nome**" dentro da própria lista.
2. **Alunos:** a lista não mostra **com quem o aluno estuda** (professor) nem **quando as
   aulas terminam** (conclusão do contrato/plano). O Emusys mostra por matrícula
   "-Prof. X" e a data de "Conclusão", que é o período contratado.

### Objetivo
- Exibir o **responsável** (quando cadastrado) nas telas financeiras de mensalidades.
- Exibir o **professor do aluno** na lista de Alunos.
- Exibir a **data de conclusão** na lista de Alunos **somente** quando ela for determinável:
  - existir **contrato com data de expiração** (`contracts.endDate`) — ou
  - existir **plano selecionado** com duração/período calculável (matrícula ativa).
  - Não havendo nenhum dos dois, o campo/linha de conclusão **não aparece**.

### Contexto (estado atual do MusicPro)
| Área | Onde | Situação hoje |
|---|---|---|
| Financeiro (mensalidades) | `client/src/pages/financeiro/MensalidadesTab.tsx` (linhas 157/365/1084/1287) | Mostra só `payment.studentName` |
| Financeiro (dados) | `server/routers/financeiroRouters.ts` (`paymentDues.list`, ~linha 154; select `studentName` ~186) | Não retorna responsável |
| Alunos (lista) | `client/src/pages/Alunos.tsx` (nome na linha 497, instrumento na 511) | Mostra nome/instrumento/status; sem professor e sem conclusão |
| Alunos (dados) | `server/db.ts` → `getStudentsWithInstrument` (linha 1736) | Retorna `schoolPlanId`, `startDate`, mas **não** professor nem datas de fim |
| Responsável | `students.guardianName` / `guardianPhone` | Campos já existem e foram populados na migração |
| Contrato | `contracts` | Tem `endDate` (período) e status (`assinado`, `enviado`, `aguardando_assinatura`, …) |
| Matrícula/Plano | `student_enrollments` + `school_plans` + `students.schoolPlanId` | `durationMonths`, `startDate`, `endDate`, `planId`, `status` |

---

## 2. Usuários Envolvidos

- **Admin da escola:** vê tudo (financeiro e alunos).
- **Professor (com permissões):** vê Alunos (se tiver `alunos_editar` vê também; sem isso, leitura).
  No Financeiro, só com permissão de financeiro (`alunos_mensalidade`/financeiro) — regra já existente.
- **Aluno (portal):** não é afetado por este PRD.

---

## 3. Escopo

### Incluído
1. `paymentDues.list` passa a retornar `guardianName` do aluno.
2. UI de mensalidades (Financeiro) mostra "Responsável: X" abaixo do nome do aluno, quando existir.
3. `getStudentsWithInstrument` passa a retornar `professorName` e os campos derivados de conclusão:
   `contractEndDate`, `enrollmentEndDate`, `schoolPlanId` (já existe).
4. UI de Alunos mostra "Prof. Nome" e, quando aplicável, "Conclui em DD/MM/AAAA".

### Fora do escopo
- Editar responsável nessas telas (cadastro continua no perfil do aluno).
- Enviar cobrança automaticamente para o responsável (o sistema já tem esse fluxo à parte).
- Relatório de conclusões/filtro "conclui em X dias" (pode virar próximo PRD).
- Alterar contratos/matrículas/planos.
- Mostrar conclusão por curso separadamente (hoje a lista é 1 linha por aluno) — ver RN-003.

---

## 4. Requisitos Funcionais

### RF-001 — Responsável no Financeiro
**Descrição:** a listagem de mensalidades exibe "Responsável: {guardianName}" abaixo do nome do
aluno quando `students.guardianName` estiver preenchido.
**Atores:** admin e usuários com permissão financeira.
**Pré-condições:** aluno com responsável cadastrado; mensalidade existente.
**Fluxo principal:**
1. Usuário abre Financeiro → Mensalidades;
2. Sistema lista as faturas com Aluno + (Responsável quando houver);
3. Ao clicar para WhatsApp/cobrança, o telefone usado continua sendo o do responsável quando
   o `guardianPhone` existir (comportamento atual — não muda).
**Exceções:** sem responsável → mostrar apenas o nome do aluno (sem a linha).
**Dados:** `payment_dues.studentId` → `students.guardianName`.

### RF-002 — Professor na lista de Alunos
**Descrição:** cada aluno exibe o nome do professor responsável (`students.professorId` → `users.name`).
**Atores:** admin/professor conforme permissões já existentes.
**Fluxo principal:** abrir Alunos → cada card mostra "Prof. {nome}".
**Exceções:** aluno sem professor definido → mostrar "Sem professor" em tom suave.
**Dados:** `users.name` via `students.professorId`.

### RF-003 — Conclusão na lista de Alunos (condicional)
**Descrição:** exibir "Conclui em DD/MM/AAAA" no card do aluno quando existir data determinável:
1. **Contrato:** `contracts.endDate` do contrato **ativo** (ver RN-001) — usar a **maior** `endDate`
   entre os contratos ativos do aluno; ou
2. **Matrícula/Plano:** `student_enrollments.endDate` OU `startDate + durationMonths` da matrícula
   ativa mais recente (ver RN-002).
**Exceções:** sem contrato com `endDate` e sem matrícula calculável → **não renderizar** o campo.
**Dados:** `contracts.endDate/status`, `student_enrollments.endDate/startDate/durationMonths/status`.

---

## 5. Regras de Negócio

### RN-001 — Contrato "ativo" para fins de conclusão
**Regra:** consideram-se contratos válidos para conclusão os com `endDate` preenchido e status
em `('assinado', 'enviado', 'aguardando_assinatura')`. Contratos `rascunho`, `cancelado`,
`expirado` e `erro` são ignorados.
**Válido:** contrato assinado, `endDate = 2027-08-11` → conclusão 11/08/2027.
**Inválido:** contrato cancelado com `endDate` futuro → não conta.
**Consequência:** se nenhum contrato válido tiver `endDate`, cai para a regra da matrícula (RN-002).

### RN-002 — Conclusão por matrícula/plano
**Regra:** entre as matrículas com `status = 'ativo'`, considerar
`conclusaoMatricula = enrollment.endDate ?? addMonths(enrollment.startDate, durationMonths)`.
Se `endDate` e `startDate/durationMonths` não existirem, **a matrícula não produz data**.
**Válido:** `startDate=2026-05-08, durationMonths=12` → conclusão 08/05/2027.
**Inválido:** plano selecionado (`schoolPlanId`) sem matrícula com início/duração → sem data.

### RN-003 — Múltiplos vínculos (aluno com 2 cursos/contratos)
**Regra (assunção a confirmar):** exibir a **maior** data entre os vínculos ativos — é a data em
que o último vínculo termina ("aluno matriculado até"). Alternativa futura: listar por curso como
no Emusys (fora do escopo desta versão).

### RN-004 — Plano selecionado como condição de exibição
**Regra:** "plano selecionado" = `students.schoolPlanId IS NOT NULL` **ou** existir matrícula ativa
com `planId`. Isso **não cria data por si só** — apenas caracteriza o aluno como "com plano".
A data continua vindo de RN-001/RN-002. Sem data determinável, não se mostra nada (nem "—").

### RN-005 — Responsável não é o pagador obrigatório
**Regra:** exibir o responsável é **informativo**. Não altera status de cobrança, WhatsApp e
relatórios existentes (que já usam `guardianPhone` quando presente).

### RN-006 — Isolamento por organização e soft-delete
**Regra:** todas as consultas continuam filtradas por `organizationId` e ignoram alunos com
`deletedAt` (arquivados) — comportamento já existente que não muda.

---

## 6. Fluxos

### Fluxo principal — Financeiro
```text
Admin abre Financeiro → Mensalidades
↓
Sistema carrega faturas (paymentDues.list)
↓
Card/linha mostra: Aluno + Responsável (se houver)
↓
Usuário usa as ações já existentes (cobrar, marcar pago, WhatsApp...)
↓
Resultado esperado: nome do responsável visível no mesmo cartão
```

### Fluxo principal — Alunos
```text
Admin abre Alunos
↓
Sistema carrega alunos (getStudentsWithInstrument)
↓
Card mostra: Nome, Instrumento, Prof. {professor}
↓
Se houver conclusão determinável → linha "Conclui em DD/MM/AAAA"
↓
Senão → card sem a linha de conclusão
```

### Fluxos alternativos
- **Sem responsável:** apenas Aluno (sem quebra de layout).
- **Sem professor:** "Sem professor" em `text-muted-foreground`.
- **Professor vendo o próprio aluno:** mostra "Prof. (você)" ou o próprio nome (decisão de UI:
  manter o nome, sem destaque).
- **Sem dados (lista vazia):** estados vazios atuais permanecem.

### Fluxos de erro
- Falha ao carregar lista → mantém comportamento atual (estado de erro/tentativa novamente).
- Campo novo ausente em versões antigas do servidor (deploy parcial) → UI usa fallback opcional
  (`student.guardianName ?? null`), sem quebrar.

---

## 7. Casos Extremos

- Responsável cadastrado mas vazio/em branco → tratar como ausente (trim).
- Nome de responsável muito longo → truncar com ellipsis (1 linha).
- Aluno com 2+ contratos, um vencido e outro vigente → considerar somente o vigente (RN-001).
- Contrato assinado sem `endDate` (só `expiresAt` de assinatura) → **não** usar `expiresAt` como
  conclusão (é validade do link) — cair para matrícula.
- Matrícula com `durationMonths = 1` e sem `endDate` → conclusão = início + 1 mês.
- Matrícula encerrada não deve gerar conclusão (status ≠ ativo ignorado).
- Virada de mês/ano no cálculo `addMonths` → usar soma de meses no calendário (ex.: 31/01 + 1 mês = 28/02).
- Fuso horário: datas são `date` (sem hora) — exibir `DD/MM/AAAA` sem conversão de fuso.
- Aluno arquivado (Histórico) → não aparece na lista (RN-006).
- Professor arquivado → o nome continua vindo de `users.name` (histórico preservado) e aparece
  normalmente no card do aluno.
- Aluno sem contrato e sem plano → nenhuma linha de conclusão (não mostrar "—" nem "sem conclusão").
- Duplo carregamento/refetch → consultas idempotentes, sem efeitos colaterais.

---

## 8. Dados Envolvidos

### Leitura no Financeiro
| Fonte | Campo | Uso |
|---|---|---|
| `payment_dues` | `studentId`, `amount`, `dueDate`, `status` | já existente |
| `students` | `name`, `guardianName` | novo campo no select |

### Leitura em Alunos (extensão de `getStudentsWithInstrument`)
| Campo derivado | Origem | Regra |
|---|---|---|
| `professorName` | `users.name` via `students.professorId` (leftJoin) | RN-002 do RF-002 |
| `contractEndDate` | `MAX(contracts.endDate)` com status válidos | RN-001 |
| `enrollmentEndDate` | `MAX(COALESCE(enrollments.endDate, enrollments.startDate + durationMonths))` com `status='ativo'` | RN-002 |
| `schoolPlanId` | já retornado | RN-004 |

### Índices
- `contracts (studentId)` e `student_enrollments (studentId)` — verificar existência; criar se
  ausente (o volume por aluno é baixo, mas as listas têm centenas de alunos).

### Sem mudanças de schema
Nenhuma coluna/tabela nova. **Apenas leitura adicional.**

---

## 9. Permissões e Segurança

| Recurso | Admin | Professor (com perm.) | Professor (sem perm.) |
|---|---|---|---|
| Ver responsável no Financeiro | Sim | Sim (se tem financeiro) | Não (lista já é bloqueada) |
| Ver professor no card do aluno | Sim | Sim (é o próprio ou colega) | Sim |
| Ver conclusão | Sim | Sim | Sim |

- Todas as extensões de select continuam sob `protectedProcedure` + filtro `organizationId`.
- Nenhum dado sensível novo é exposto (nome do responsável já consta no cadastro do aluno).
- Nenhuma mensagem de erro nova necessária; erros permanecem genéricos ao usuário.

---

## 10. Tratamento de Erros

- **Esperado:** campos opcionais ausentes → renderização condicional; nunca erro visual.
- **Interno:** falha de query → comportamento padrão da tela (estado de erro existente).
  Sem stack trace ao usuário (regra global do sistema).
- **Deploy parcial (front novo + back antigo):** campos ausentes → `?? null` e não renderiza.

---

## 11. Requisitos Não Funcionais

- **RNF-001 — Performance:** as extensões não podem transformar a lista em N+1. Usar subconsultas
  agregadas (ou LATERAL) no mesmo SELECT; meta: tempo da lista de Alunos sem aumento perceptível
  (ex.: ≤ +20% do tempo atual para 600 alunos).
- **RNF-002 — Responsividade:** textos novos truncam em 1 linha; não quebram os cards no mobile
  (Alunos e Mensalidades têm layout responsivo existente).
- **RNF-003 — Consistência visual:** usar tokens do design system (`text-muted-foreground`,
  badges existentes); nada de novos estilos hardcoded.
- **RNF-004 — Compatibilidade:** professor/painel admin; dark mode; PWA.
- **RNF-005 — Sem regressão:** os campos existentes (nome/instrumento/status/mensalidade)
  permanecem com o mesmo comportamento.

---

## 12. Critérios de Aceite

### CA-001 — Responsável exibido
**Dado que** o aluno tem `guardianName = "Bárbara Avanza"`,
**Quando** o admin abrir Financeiro → Mensalidades,
**Então** a fatura do aluno mostra "Responsável: Bárbara Avanza" abaixo do nome.

### CA-002 — Sem responsável
**Dado que** o aluno não tem responsável cadastrado,
**Quando** a lista carregar,
**Então** nenhuma linha de responsável aparece (sem "null" e sem espaço vazio).

### CA-003 — Professor exibido
**Dado que** o aluno pertence ao professor "Adrian Zanetti",
**Quando** a lista de Alunos carregar,
**Então** o card mostra "Prof. Adrian Zanetti".

### CA-004 — Conclusão por contrato
**Dado que** o aluno tem contrato com `status='assinado'` e `endDate=2027-08-11`,
**Quando** a lista carregar,
**Então** o card mostra "Conclui em 11/08/2027".

### CA-005 — Conclusão por plano/matrícula sem contrato
**Dado que** o aluno não tem contrato com `endDate`, mas tem matrícula ativa
`startDate=2026-05-08, durationMonths=12`,
**Quando** a lista carregar,
**Então** o card mostra "Conclui em 08/05/2027".

### CA-006 — Sem contrato e sem plano
**Dado que** o aluno não tem contrato com `endDate` e não tem matrícula calculável,
**Quando** a lista carregar,
**Então** o card **não** mostra nenhuma linha de conclusão.

### CA-007 — Filtro de status do contrato
**Dado que** o único contrato do aluno está `cancelado` com `endDate` futura,
**Quando** a lista carregar,
**Então** a conclusão **não** é exibida (cai para RN-002 e, se não houver, some).

### CA-008 — Isolamento
**Dado** dois alunos de organizações diferentes com dados semelhantes,
**Quando** cada escola abrir a lista,
**Então** cada uma vê apenas os seus dados.

### CA-009 — Não regressão
**Quando** as listas carregarem,
**Então** nome, instrumento, status, mensalidade e ações continuam funcionando como antes.

---

## 13. Riscos e Dependências

**Riscos**
- *Dados incompletos:* muitas matrículas importadas não têm `endDate` — por isso a RN-002 aceita o
  cálculo por `startDate + durationMonths`; ainda assim alguns alunos não terão data (esperado).
- *Performance:* subconsultas em listas grandes (559 alunos no cliente referência) — mitigar com
  agregação no próprio SELECT e índice por `studentId`.
- *Ambiguidade:* múltiplos vínculos (RN-003) — decisão "maior data" assumida; confirmar com o solicitante.

**Dependências**
- Tabelas `contracts` e `student_enrollments` já existentes e populadas.
- `paymentDues.list` e `getStudentsWithInstrument` são usados por outras telas (mobile Alunos,
  financeiro) → mudanças são **aditivas** (novos campos).

---

## 14. Métricas de Sucesso

- Financeiro: redução de idas ao cadastro do aluno para descobrir o responsável (contar cliques
  ou simplesmente ausência de reclamação/uso do fluxo manual de busca).
- Alunos: % de alunos com conclusão visível (esperado: alto para os ativos reais; baixo para
  ex-alunos arquivados — que não aparecem).
- 0 regressões na suíte (582+ testes) e tempo de carregamento das listas estável.

---

## 15. Plano de Implementação Sugerido

### Fase 1 — Backend (leitura)
1. `financeiroRouters.ts` → adicionar `guardianName` ao select de `paymentDues.list`.
2. `server/db.ts` → em `getStudentsWithInstrument`, adicionar:
   - `leftJoin(professores/users)` para `professorName`;
   - subconsultas agregadas `contractEndDate` e `enrollmentEndDate`.
3. Garantir índices `contracts(studentId)` e `student_enrollments(studentId)` se ausentes.

### Fase 2 — Frontend
4. `MensalidadesTab.tsx`: subtítulo "Responsável: X" (3 pontos de render: desktop, mobile e modal).
5. `Alunos.tsx`: linha "Prof. X" + "Conclui em DD/MM/AAAA" (condicional, com truncamento).

### Fase 3 — Testes
6. Testes de servidor: `getStudentsWithInstrument` retorna campos novos; `paymentDues.list` com
   responsável; regras RN-001/002/006 (status de contrato, cálculo de mês, aluno arquivado).
7. Testes de UI (se houver padrão no repo) / checklist manual nas duas telas com dark mode e mobile.

### Fase 4 — Deploy
8. `pnpm check && pnpm test && pnpm build`; entrada em `shared/releases.ts`
   ("Financeiro mostra o responsável + Alunos mostra professor e conclusão"); deploy produção.

---

## 16. Assunções a Confirmar

1. **RN-003:** aluno com vários vínculos → mostramos a **maior** data de conclusão.
2. **RN-004:** "plano selecionado" sem duração/início não gera data — o campo simplesmente não
   aparece (não mostramos "—").
3. O nome do responsável exibido é apenas informativo (não altera cobrança).

---

# REVISÃO 1.1 — 01/10/2026 (aprovada pelo solicitante)

## 17. Mudança aprovada: conclusão **por curso** (não a maior data)

**Substitui a RN-003 original.**

### RN-007 — Conclusão listada por curso
**Regra:** o card do aluno lista **um item por matrícula ativa** (`student_enrollments.status = 'ativo'`),
no formato: `{Instrumento} · Prof. {Professor} · Conclui em {DD/MM/AAAA}`.
A conclusão de cada curso = `enrollment.endDate` ou, quando ausente,
`enrollment.startDate + durationMonths`. Curso sem data calculável exibe apenas
`{Instrumento} · Prof. {Professor}` (sem a parte de conclusão).

**Fallback (sem matrículas cadastradas):** se o aluno tiver **contrato válido com `endDate`**
(RN-001), exibir uma linha única `Contrato · Conclui em {data}`. Sem matrículas e sem contrato
com data → nenhuma linha de curso/conclusão.

**Exemplo válido:** Marcos — "Guitarra · Prof. Edu · Conclui em 11/08/2027" (1 linha por curso).
**Exemplo inválido:** curso encerrado aparecendo na lista (status ≠ ativo é ignorado).

Critérios de aceite adicionais:

### CA-010 — Conclusão por curso
**Dado que** o aluno tem 2 matrículas ativas, com conclusões diferentes,
**Quando** a lista carregar,
**Então** o card mostra **duas linhas**, cada uma com seu instrumento, professor e data.

### CA-011 — Curso sem data
**Dado que** uma matrícula ativa não tem `endDate` nem `startDate/durationMonths`,
**Quando** a lista carregar,
**Então** a linha daquele curso aparece sem a parte "Conclui em".

---

## 18. Nova funcionalidade aprovada: múltiplos cursos nas configurações do aluno

### 18.1 Visão geral
**Problema:** hoje o cadastro do aluno assume 1 curso. Alunos que fazem 2+ cursos (ex.: guitarra
+ canto) não têm como ser configurados pela interface.
**Objetivo:** na **edição do aluno** (modal `StudentModal`), permitir definir **quantos cursos**
o aluno fará; a partir de 2, cada curso extra tem seu **instrumento/curso** e seu **professor**
(podendo ser diferente do professor principal).

### 18.2 Requisitos funcionais (novos)

#### RF-004 — Seletor de quantidade de cursos
**Descrição:** no modal do aluno, seção "Cursos", um seletor de 1 a 4 cursos.
**Regras:** com 1 curso, nenhuma linha extra aparece (fluxo atual preservado). Com N>1, são
exibidas N linhas de curso.

#### RF-005 — Linhas de curso (instrumento + professor)
**Descrição:** cada linha tem: **Instrumento/Curso** (select dos instrumentos da escola) e
**Professor** (select dos professores ativos). A **linha 1** inicia com o instrumento e o
professor atuais do aluno; as linhas extras iniciam vazias (exigem escolha para salvar).
**Exceções:** não permitir dois cursos com o mesmo instrumento na mesma lista.

#### RF-006 — Persistência dos cursos
**Descrição:** ao salvar o aluno, o sistema sincroniza as matrículas
(`student_enrollments`): linhas novas viram matrículas `ativo`; linhas editadas são atualizadas;
matrículas que saíram da lista viram `encerrado` (nunca são apagadas — histórico preservado).
**Dados criados (linha nova):** `startDate = hoje`, `durationMonths = 12`, `monthlyFee = mensalidade do aluno`,
`status='ativo'`; horário/sala/plano ficam para ajuste posterior (fora do escopo).

### 18.3 Regras de negócio (novas)

#### RN-008 — Curso 1 = curso principal
**Regra:** o primeiro curso atualiza também `students.instrumentId` (mantém lista, filtros e
relatórios consistentes com o curso principal). Os demais cursos não alteram o campo do aluno.

#### RN-009 — Professor por curso
**Regra:** cada matrícula guarda seu `teacherUserId`. O professor do curso 1 é refletido em
`students.professorId` (dono do aluno, regra atual do sistema); professores dos cursos extras
valem apenas para a matrícula.

#### RN-010 — Sincronização não destrutiva
**Regra:** remover um curso na interface **encerra** a matrícula (`status='encerrado'`), sem
apagar aulas/faturas/contratos ligados. Re-adicionar cria nova matrícula.

#### RN-011 — Aluno arquivado/reativado
**Regra:** alunos arquivados não aparecem na lista; reativação (Histórico) mantém os cursos como
estavam.

### 18.4 Dados
| Entidade | Campo | Uso |
|---|---|---|
| `student_enrollments` | existentes (`instrumentId`, `teacherUserId`, `startDate`, `durationMonths`, `status`, `organizationId`) | sem mudança de schema |
| `students.instrumentId` | atualizado pelo curso 1 | RN-008 |

### 18.5 Permissões
- Editar cursos: somente quem já pode editar o aluno (admin; professor somente com
  `alunos_editar`, igual à regra atual do `students.update`).

### 18.6 Critérios de aceite (novos)

### CA-012 — Adicionar 2º curso
**Dado que** o aluno tem 1 curso (Guitarra/Prof. Edu),
**Quando** o admin selecionar 2 cursos, escolher Canto/Prof. Nathan e salvar,
**Então** o aluno passa a ter 2 matrículas ativas e o card lista as duas linhas.

### CA-013 — Remover curso
**Dado que** o aluno tem 2 cursos,
**Quando** o admin reduzir para 1 curso e salvar,
**Então** a matrícula removida vira `encerrado` (histórico preservado) e some da lista.

### CA-014 — Instrumento repetido
**Dado que** o curso 1 é Guitarra,
**Quando** o admin tentar adicionar Guitarra como curso 2,
**Então** o sistema bloqueia com mensagem clara ("Instrumento já selecionado em outro curso").

### CA-015 — Sem permissão
**Dado que** um professor sem `alunos_editar` abre o aluno,
**Quando** tentar alterar os cursos,
**Então** o salvamento é recusado pelo servidor (FORBIDDEN) e nada muda.

### 18.7 Fora do escopo (desta versão)
- Definir horário/sala/valor por curso no modal (ajustável depois em Matrículas/Agenda).
- Cobranças separadas por curso (financeiro atual permanece por aluno).
- Limite de cursos por plano da escola.

### 18.8 Plano de implementação (aditivo)
- **Backend:** `studentsRouters` ganha `syncCourses({ studentId, courses[] })` (validação RN-008/009/010
  e permissão); `getStudentsWithInstrument` passa a devolver `courses[]` (instrumento, professor,
  conclusão) + `professorName`.
- **Frontend:** seção "Cursos" no `StudentModal` (quantidade + linhas instrumento/professor);
  lista de Alunos renderiza as linhas por curso; Mensalidades exibe o responsável.
- **Testes:** sync cria/atualiza/encerra; curso 1 atualiza `students.instrumentId`; professor sem
  permissão = FORBIDDEN; conclusão por curso com/sem data.
