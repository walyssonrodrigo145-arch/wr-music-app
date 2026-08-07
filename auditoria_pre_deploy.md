# AUDITORIA PRÉ-DEPLOY (QA SÊNIOR - WRAUDITOR)

## Data: 2026-08-07
## Alteração: Correção da Exibição do Nome da Escola (SchoolName Branding Fallback)

### 1. Resumo das Alterações
- `server/routers.ts`:
  - No procedimento `auth.me`, incluída a seleção da coluna `name` na tabela `organizations`.
  - A busca em `settings` foi alterada para selecionar prioritariamente o registro que possuir `schoolName` preenchido e não-vazio.
  - Definido o fallback estruturado: `schoolName = (userSet?.schoolName) || org?.name || null`.
  - No procedimento `settings.updateSchool`, adicionada a atualização síncrona da coluna `organizations.name` sempre que um novo `schoolName` for salvo.

### 2. Validação QA / Checklist
- [x] Nenhuma rota ou contrato tRPC foi quebrado.
- [x] O campo `schoolName` agora é retornado corretamente no payload de `auth.me`.
- [x] Ao salvar em Configurações, tanto `settings` quanto `organizations` recebem o nome da escola atualizado.
- [x] A invalidação de cache `utils.auth.me.invalidate()` no cliente garante que o nome "WR Escola de Música" substitua "MusicPro" na sidebar.

### 3. Parecer Final
- **Status:** APROVADO para Deploy.
- **Nível de Risco:** Baixo (0 erros críticos ou altos).
