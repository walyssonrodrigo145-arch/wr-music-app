# PRD — Aulas em Turma: adicionar e remover alunos

## 1. Visão Geral

### Problema
Hoje a turma é criada no agendamento (`lessons.createTurma`) e, depois de criada, **não há como incluir ou tirar um aluno**. Para qualquer ajuste (aluno novo na turma, aluno que saiu, troca de horário de um aluno), o professor precisa excluir a turma inteira e recriar — perdendo chamada, observações e histórico.

### Objetivo
Permitir, no detalhe da aula em turma:
1. **Adicionar** alunos à sessão (e opcionalmente às próximas aulas da mesma turma);
2. **Remover** um aluno da sessão (e opcionalmente das próximas aulas);
3. Sem duplicar linhas, sem conflito de horário e preservando a chamada já registrada.

### Contexto
- Modelo: cada aluno da turma é uma linha em `lessons` com o mesmo `recurringGroupId`, `title`, `scheduledAt` e `lessonType = 'turma'`.
- Criação: `lessons.createTurma` (`server/routers/lessonsRouters.ts:1719`).
- Detalhe/chamada: `getTurmaDetails` e `updateTurmaAttendance`; UI em `client/src/components/modals/LessonDetailModal.tsx`.

---

## 2. Usuários Envolvidos

- **Professor**: gerencia as turmas dos próprios alunos.
- **Admin/Owner**: gerencia turmas de qualquer aluno da escola.

---

## 3. Escopo

### Incluído
- Botão **Adicionar aluno** no detalhe da turma (lista de alunos elegíveis, com seleção múltipla).
- Botão **remover** por aluno na lista da chamada.
- Opção **"Aplicar às próximas aulas da turma"** (padrão desligado = só a sessão atual).
- Validações: aluno da escola/professor, sem duplicar, sem conflito de horário, somente turma agendada.
- Cancelamento dos lembretes pendentes do aluno removido.

### Fora do escopo
- Alterar data/hora/sala da turma (já existe "Editar Agendamento").
- Transferir aluno entre turmas diferentes.
- Recriar automaticamente chamada/faltas do aluno removido.
- Adicionar/remover em massa por planilha.

---

## 4. Requisitos Funcionais

### RF-001 — Adicionar alunos
**Descrição:** no detalhe da turma agendada, "Adicionar aluno" abre a lista de alunos marcados como `turma` que ainda não estão na sessão; o usuário seleciona um ou vários e confirma.
**Fluxo:** abre picker → seleciona → "Adicionar N aluno(s)" → backend cria as linhas da sessão (e das futuras, se marcado) → chamada atualiza.

### RF-002 — Remover aluno
**Descrição:** cada aluno da chamada tem um botão de remover; confirma e o backend apaga a linha da sessão (e das futuras, se marcado).
**Exceção:** se o aluno removido for o da aula aberta, o modal fecha após o sucesso.

### RF-003 — Aplicar às próximas aulas
**Descrição:** um toggle "Aplicar às próximas aulas da turma" na seção da chamada controla se add/remove valem só para a sessão atual ou também para as futuras agendadas do mesmo `recurringGroupId`.

### RF-004 — Somente turma agendada
**Descrição:** add/remove só ficam disponíveis quando a sessão está `agendada`. Turmas concluídas/faltas/canceladas mantêm o histórico intacto.

### RF-005 — Sem conflito e sem duplicidade
**Descrição:** o backend valida janela de horário (overlap) por aluno e ignora alunos já presentes na sessão.

---

## 5. Regras de Negócio

### RN-001 — Identidade da turma
A sessão é identificada por `recurringGroupId` + janela de ±1 minuto do `scheduledAt`. Turmas legadas sem groupId usam `title` + `lessonType='turma'` + janela.

### RN-002 — Escopo de dados
Só alunos da organização (e do professor, quando não admin) podem ser adicionados; o professor só gerencia aulas que criou (`userId`).

### RN-003 — Remover = apagar a linha do aluno
Não altera as linhas dos outros alunos nem o `recurringGroupId` da turma.

### RN-004 — Futuras
"Aplicar às próximas" considera apenas aulas futuras com status `agendada` (a partir da data da sessão).

### RN-005 — Lembretes
Ao remover, lembretes pendentes da(s) aula(s) apagada(s) são cancelados.

---

## 6. Fluxos

### Fluxo principal (adicionar)
```text
Professor abre a turma no calendário
↓
Detalhe da turma (agendada) → "Adicionar aluno"
↓
Seleciona alunos elegíveis (checkbox) e marca/não "Aplicar às próximas"
↓
Backend valida (org/professor, duplicidade, conflito) e insere as linhas
↓
Chamada e calendário atualizados
```

### Fluxo principal (remover)
```text
Detalhe da turma → lixeira no aluno
↓
Confirmação
↓
Backend apaga a linha (e futuras, se marcado) + cancela lembretes
↓
Chamada atualizada (fecha o modal se era o aluno aberto)
```

### Fluxos de erro
- Aluno com outra aula no mesmo horário → erro com o nome do aluno.
- Aluno de outro professor (não admin) → erro de permissão.
- Turma concluída/cancelada → botões indisponíveis + erro se forçado.
- Turma não encontrada na data → erro claro.

---

## 7. Casos Extremos

- Adicionar aluno já presente → retorno "já está na turma" (sem duplicar).
- Duplo clique no adicionar/remover → botões desabilitados durante a mutation.
- Turma com linhas duplicadas legadas → remoção é por `lessonId` (precisa).
- Aplicar às futuras sem `recurringGroupId` (legado) → casa por título/tipo.
- Sessão futura já concluída (data passada não remarcada) → não é alterada.
- Aluno removido com presença registrada → bloqueado (status não agendado).
- Lista de elegíveis vazia → mensagem "todos os alunos já estão na turma".
- Mais de 50 alunos por operação → limitado no schema.

---

## 8. Dados Envolvidos

| Tabela | Campos | Operação |
| --- | --- | --- |
| `lessons` | `studentId`, `title`, `scheduledAt`, `duration`, `notes`, `instrumentId`, `studioRoomId`, `recurringGroupId`, `lessonType`, `status`, `userId` | insert (add) / delete (remove) |
| `reminders` | `lessonId`, `status` | update → `cancelado` |

Sem novas tabelas/colunas.

---

## 9. Permissões e Segurança

- `protectedProcedure` (professor/admin), sempre com `organizationId`.
- Não-admin: aluno precisa ser do professor e a aula precisa ser dele (`lessons.userId`).
- Nada de outro tenant é lido/alterado; erros sem stack/SQL.

---

## 10. Tratamento de Erros

- **Esperado:** "Turma não encontrada nesta data.", "Só é possível alterar turmas agendadas.", "Conflito: {aluno} já possui aula neste horário.", "Um ou mais alunos não pertencem ao seu perfil."
- **Interno:** falhas de banco → mensagem genérica + log.

---

## 11. Requisitos Não Funcionais

- RNF-001: feedback de loading nos botões e toasts de sucesso/erro.
- RNF-002: mobile-first (picker em lista com scroll, alvos de toque ≥ 40px).
- RNF-003: sem N+1 desnecessário (checagens em lote por data).
- RNF-004: limite de 50 alunos por operação.

---

## 12. Critérios de Aceite

- CA-001: adicionar 2 alunos cria 2 linhas na sessão e eles aparecem na chamada.
- CA-002: adicionar com "Aplicar às próximas" cria as linhas em todas as sessões futuras agendadas da turma.
- CA-003: remover um aluno apaga só a linha dele e mantém os demais.
- CA-004: aluno com aula no mesmo horário não é adicionado (erro com nome).
- CA-005: turma concluída não permite add/remove.
- CA-006: aluno de outro professor é rejeitado para usuário não-admin.
- CA-007: lembretes pendentes da aula removida ficam cancelados.

---

## 13. Riscos e Dependências

- **Risco:** turmas legadas sem `recurringGroupId` — fallback por título/tipo documentado.
- **Risco:** aplicar às futuras em turmas com muitas semanas — limitado às `agendada` futuras.
- **Dependência:** `lessons.getTurmaDetails` (UI), `students.list` (picker), `reminders`.

---

## 14. Métricas de Sucesso

- Redução de exclusões/recriações de turma.
- Turmas com composição ajustada sem perda de chamada.

---

## 15. Plano de Implementação

### Fase 1 — Backend
`lessons.addTurmaStudents` e `lessons.removeTurmaStudent` + helper puro `canManageTurmaStudents` + testes.

### Fase 2 — Frontend
`LessonDetailModal`: toggle "Aplicar às próximas", picker de alunos e botão remover por aluno.

### Fase 3 — Verificação e release
`pnpm check`, vitest, build e `shared/releases.ts`.
