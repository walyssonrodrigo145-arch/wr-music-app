# PRD — Plano individual por aluno na Migração (Mensalidades)

## 1. Visão Geral

### Problema
Na migração de mensalidades (`Migração → Mensalidades (lote)`), o plano é escolhido **em lote** (um único plano para todos os alunos selecionados). Escolas que vêm de outro sistema costumam ter alunos em planos diferentes (instrumentos/durações/valores distintos), o que hoje obriga o usuário a repetir a operação várias vezes — uma por plano — ou aceitar vínculo/valores errados.

### Objetivo
Permitir que **cada aluno selecionado tenha o seu próprio plano** na migração, mantendo o plano em lote como **padrão/fallback** da operação. O plano individual define valor da mensalidade, duração (saldo de meses) e o vínculo no cadastro do aluno.

### Contexto
- Já existem: quantidade individual de aulas e de mensalidades por aluno (commits `5bff5bd` e repositório atual).
- Base: `client/src/pages/Migracao.tsx` (aba Mensalidades) + `server/routers/financeiroRouters.ts` (`paymentDues.migratePaymentDuesBatch`).
- Regras de saldo em `shared/billing.ts` (`computeRemainingMonths`, `periodicityStep`).

---

## 2. Usuários Envolvidos

- **Admin da escola**: migra o financeiro de todos os alunos.
- **Professor** (com permissão de acesso à página): migra apenas os próprios alunos.
- **SuperAdmin/Owner**: mesmo comportamento de admin.

---

## 3. Escopo

### Incluído
- Seletor de **plano por aluno** na lista de alunos da aba Mensalidades.
- Plano individual sobrepõe o plano em lote (padrão) da operação.
- Valor e duração (saldo de meses) calculados por aluno conforme o plano efetivo.
- Vínculo em lote no cadastro respeitando o plano individual de cada aluno.
- Relatório por aluno com o plano aplicado (nome, valor, geradas, restantes).
- Atalhos: "Aplicar plano padrão a todos" e "Aplicar meses padrão a todos".

### Fora do escopo
- Alterar o valor `monthlyFee` do cadastro do aluno.
- Emitir cobranças no Asaas/gateway (a migração continua sem emissão automática).
- Criar planos dentro da tela de migração.
- Migração por CSV de planos (a planilha de mensalidades permanece inalterada).

---

## 4. Requisitos Funcionais

### RF-001 — Plano individual por aluno
**Descrição:** ao marcar um aluno, a linha exibe um seletor de plano com as opções: `Manter plano atual / Sem plano`, e a lista de planos ativos da escola. A escolha é individual.

### RF-002 — Plano em lote como padrão
**Descrição:** o seletor "Plano do aluno (padrão)" continua existindo. Se o aluno não tiver escolha individual, o plano da operação é usado. Trocar o padrão recalcula as sugestões dos alunos **sem** escolha individual.

### RF-003 — Valor e duração por plano efetivo
**Descrição:** sem plano efetivo → `mensalidade do aluno → plano atual do cadastro → valor informado`. Com plano efetivo → `valor do plano → valor informado`; e o número de mensalidades é limitado ao saldo (`duração − lançadas × passo de periodicidade`).

### RF-004 — Vínculo individual no cadastro
**Descrição:** ao executar, cada aluno ativo com plano efetivo é vinculado ao seu plano (`students.schoolPlanId`), respeitando `applyPlanToStudents`.

### RF-005 — Relatório por aluno com plano
**Descrição:** a resposta e a tabela "Resumo por aluno" mostram o plano aplicado por aluno (quando houver).

### RF-006 — Seleção/validação no backend
**Descrição:** o backend aceita `studentPlans: [{ studentId, planId | null }]`. Cada plano individual é validado como **da escola e ativo**; plano inexistente/inativo → aluno pulado com motivo no relatório. Plano global inválido → erro da operação (comportamento atual).

---

## 5. Regras de Negócio

### RN-001 — Precedência do plano individual
**Regra:** escolha individual (inclusive "sem plano") vence o plano padrão da operação.
**Exemplo válido:** padrão = Plano A; aluno X com Plano B → X usa B.
**Exemplo válido:** aluno Y marcado "sem plano" com padrão A → Y segue a mensalidade atual (sem vínculo novo).

### RN-002 — Saldo restante por plano
**Regra:** restante = `max(0, duracaoMeses − lançadas × passo)`, onde `passo` vem da periodicidade do aluno (`periodicityStep`). Plano completo → pula o aluno e reporta o motivo.

### RN-003 — Idempotência
**Regra:** competências já lançadas continuam sendo ignoradas (índice único org+aluno+mês+ano). Rodar 2x não duplica.

### RN-004 — Somente alunos ativos
**Regra:** alunos inativos são pulados e **não mudam** de plano.

---

## 6. Fluxos

### Fluxo principal
```text
Usuário abre Migração → Mensalidades
↓
Seleciona período/valor/plano padrão (opcional)
↓
Marca alunos e (opcional) escolhe o plano de cada um
↓
Clica em "Gerar mensalidades"
↓
Backend valida planos (org + ativo) e propriedade dos alunos
↓
Por aluno: valor + saldo do plano efetivo → gera competências faltantes
↓
Vincula cada aluno ativo ao seu plano efetivo
↓
Retorna resumo por aluno (plano, lançadas antes, restantes, definido, geradas)
```

### Fluxos de erro
- Plano individual inválido/inativo → aluno pulado com motivo.
- Plano padrão inválido/inativo → `BAD_REQUEST` e nenhuma gravação.
- Aluno não pertence à escola/professor → ignorado (consulta só traz alunos "owned").
- Aluno sem valor (sem mensalidade, sem plano e sem valor informado) → pulado com motivo.

---

## 7. Casos Extremos

- Plano individual sem valor mensal → usa o valor informado; se 0 → pula.
- Aluno com mesmo plano individual e padrão → sem conflito (vínculo idempotente).
- `studentPlans` com aluno fora da seleção → ignorado.
- Entradas duplicadas para o mesmo aluno → última vence.
- Mais de 200 alunos → bloqueado no schema (`max(200)`).
- Período bimestral/trimestral/semestral/anual → saldo calculado pelo passo.
- Virada de mês/ano → `buildDueDateSeries` já cobre.
- Lista de planos vazia ou erro na query → aviso no card e selects com fallback.
- Usuário sem internet/timeout → toast de erro; nenhuma cobrança emitida.

---

## 8. Dados Envolvidos

| Tabela | Campos usados | Alteração |
| --- | --- | --- |
| `students` | `id`, `name`, `monthlyFee`, `dueDay`, `billingPeriodicity`, `schoolPlanId`, `status`, `professorId`, `organizationId` | update de `schoolPlanId` por aluno |
| `schoolPlans` | `id`, `nome`, `valorMensal`, `duracaoMeses`, `ativo`, `organizationId` | leitura |
| `paymentDues` | `studentId`, `month`, `year`, `amount`, `dueDate`, `status`, `billingPeriodicity` | insert idempotente |
| `migrationRuns` | `summary` (auditoria) | grava `plansApplied` + `perStudent` |

Sem migração de schema (nenhuma coluna nova).

---

## 9. Permissões e Segurança

- Procedure `professorProcedure`: exige usuário autenticado com papel da escola.
- Isolamento: alunos sempre filtrados por `organizationId` e (se não admin) `professorId`.
- Planos sempre validados por `organizationId` + `ativo = true` — nunca confiar no cliente.
- Nenhum dado de outra escola é lido/gravado; erros não expõem stack/SQL.

---

## 10. Tratamento de Erros

### Erros esperados
- "Plano indisponível para esta escola (inexistente ou inativo)." (plano padrão → 400)
- "Plano indisponível (inexistente ou inativo) — aluno pulado." (individual → relatório)
- "Plano já completo (x/y mensalidades)." (skip por aluno)
- "Sem valor de mensalidade (aluno sem mensalidade e sem plano com valor)."

### Erros internos
- Banco indisponível → "Banco de dados não disponível".
- Falha inesperada → toast "Erro na migração" sem detalhes internos.

---

## 11. Requisitos Não Funcionais

- RNF-001: feedback de loading nos botões e nos cálculos ("Calculando…").
- RNF-002: responsivo (mobile-first): selects ocupam a linha no celular sem overflow.
- RNF-003: nenhuma consulta N+1: planos e contagens em lote.
- RNF-004: operação limitada a 200 alunos e 12 competências por aluno.
- RNF-005: dark mode legível (contraste dos badges de plano/motivos).

---

## 12. Critérios de Aceite

- CA-001: **Dado** 2 alunos selecionados com planos diferentes, **quando** gerar, **então** cada um recebe mensalidades com o valor/duração do seu plano e é vinculado ao plano correto.
- CA-002: **Dado** plano padrão A e aluno com plano individual B, **quando** gerar, **então** B vence para esse aluno.
- CA-003: **Dado** aluno com plano completo, **quando** gerar, **então** ele é pulado com motivo contendo o nome do plano.
- CA-004: **Dado** plano individual inativo, **quando** gerar, **então** o aluno é pulado e os demais continuam.
- CA-005: **Dado** execução repetida, **quando** gerar duas vezes, **então** não há competências duplicadas.
- CA-006: **Dado** mobile, **quando** abrir a aba, **então** não há overflow horizontal e os controles continuam tocáveis.

---

## 13. Riscos e Dependências

- **Risco:** muitos planos distintos na mesma operação (agrupamos updates por plano — custo baixo).
- **Risco:** planos desativados entre a leitura e o envio → tratado como skip por aluno, sem derrubar o lote.
- **Dependência:** `shared/billing.ts` (fonte única do saldo) e `schoolPlans.list` ativo.
- **Dependência:** índice único de `paymentDues` (idempotência).

---

## 14. Métricas de Sucesso

- Reduzir de N operações (uma por plano) para 1 operação por turma migrada.
- Zero duplicidade de competências.
- Relatório cobrindo 100% dos alunos selecionados (gerados + motivos).

---

## 15. Plano de Implementação

### Fase 1 — Contrato e backend
`studentPlans` no input, resolução do plano efetivo, valor/saldo por aluno, vínculo agrupado, `plansApplied` + `perStudent` com plano, auditoria.

### Fase 2 — Frontend
Estado `planByStudent`, select por linha, badges "Plano atual", sugestões por saldo do plano efetivo, atalhos "Aplicar a todos".

### Fase 3 — Layout premium
Cabeçalho, tabs segmentadas, cards com glassmorphism, seções numeradas, tabela de resumo e responsividade.

### Fase 4 — Testes
Helpers puros no vitest + `pnpm check` + testes focados + build.
