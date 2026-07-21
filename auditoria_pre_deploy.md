# Auditoria Pré-Deploy

## Resumo
Correção na funcionalidade de exportação de dados (Alunos e Aulas) na tela de Configurações (`exportData`).

## Causa Raiz
A query do procedimento `exportData` em `server/routers.ts` forçava o filtro `eq(students.professorId, ctx.user.id)` e `eq(lessons.userId, ctx.user.id)`. Quando um usuário administrador/proprietário gerava o relatório, como os alunos/aulas podiam ter outro professor vinculado (ou professorId nulo), a consulta retornava zero registros (array vazio).

## Verificação e Correção (QA)
1. **Filtros por Perfil/Role:** Ajustada a consulta no backend para verificar se o usuário é admin/proprietário (`isUserAdmin`). Se for admin, busca todos os alunos e aulas da organização (`organizationId`). Caso contrário, filtra pelo professor logado.
2. **Formatação de Dados Robusta:** Alterado o retorno para estruturar matrizes de dados diretas (`studentsData` e `lessonsData`), eliminando falhas de divisão de CSV via regex/split ao conter vírgulas em nomes ou títulos.
3. **Compatibilidade:** Mantido fallback para `studentsCsv` / `lessonsCsv`.

## Aval para Deploy
**Status:** APROVADO
O sistema está pronto para deploy.
