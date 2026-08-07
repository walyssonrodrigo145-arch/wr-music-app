# AUDITORIA PRÉ-DEPLOY (QA SÊNIOR - WRAUDITOR)

## Data: 2026-08-07
## Alteração: Correção do Bug de Exclusão de Organização no Super Admin (file_comments)

### 1. Resumo das Alterações
- `server/superAdminRouter.ts` — Procedimento `deleteOrganization`:
  - **Antes:** `tx.delete(fileComments).where(eq(fileComments.organizationId, orgId))` — não capturava registros com `organizationId NULL`.
  - **Depois:** A deleção é feita em dois passos dentro da mesma transação:
    1. Busca todos os `student_files.id` da organização e deleta `file_comments` por `fileId` via `inArray` — cobre 100% dos registros associados, independente do `organizationId`.
    2. Fallback por `organizationId` direto para garantir limpeza completa.
  - A ordem `fileComments → studentFiles` permanece preservada.

### 2. Validação QA / Checklist
- [x] A transação continua sendo atômica (rollback automático em caso de falha).
- [x] Zero alterações de schema ou migrations.
- [x] `studentFiles` e `inArray` já estavam importados no arquivo — sem novas dependências.
- [x] Sem quebra de rotas ou contratos tRPC.
- [x] Cobre o caso de borda: registros com `organizationId NULL`.

### 3. Parecer Final
- **Status:** APROVADO para Deploy.
- **Nível de Risco:** Muito Baixo.
