# Migração Emusys → MusicPro

Kit para migrar os dados de uma escola do **Emusys** (sistema antigo) para o **MusicPro**,
via acesso à API interna do Emusys (login com código 2FA por e-mail) e importação
transacional direto no banco de dados de produção do MusicPro.

Foi usado com sucesso na migração da escola "Espaço Musical Edu Oliveira"
(554 alunos, 5.714 faturas de 2018–2027, 552 contratos com PDF) em setembro/2026.

## Pré-requisitos

- Rodar **de dentro do repositório do MusicPro** (usa as dependências `ssh2`, `postgres`
  e `playwright-core` já instaladas; se rodar fora, `npm i ssh2 postgres playwright-core`).
- Windows com **Edge** ou **Chrome** instalado (o robô de login usa o navegador do sistema).
- Acesso SSH à VPS de produção do MusicPro (para túnel de banco + upload de arquivos).
- Conta do cliente no Emusys (e-mail + senha) e acesso ao e-mail dele para o código 2FA.

## Configuração

1. Copie `config.example.json` para `config.json` e preencha tudo.
   **`config.json` está no .gitignore — nunca commite credenciais.**
2. No MusicPro, crie antes a organização do cliente e pegue:
   - `target.organizationId` — id da org (tabela `organizations`)
   - `target.adminUserId` — id do usuário admin da org (tabela `users`)
   - Opcional: `target.professorOverrides` mapeando o nome do professor no Emusys
     (ex.: `"EDUARDO DE OLIVEIRA SANTOS": 1652`) para usuários já existentes no MusicPro.

## Passo a passo (ordem importa!)

```bash
cd migracao-emusys

# 1) Login no Emusys (abre navegador headless; dispara o código 2FA no e-mail do cliente)
#    Quando o robô pedir, coloque o código em .estado/codigo.txt (o log avisa)
node 01-login.js

# 2) Extrações (podem rodar em qualquer ordem após o login)
node 02-extrair-alunos.js       # lista completa + fichas (cursos/planos/horários)
node 02-extrair-financeiro.js   # faturas por ano (TODOS os status, com data de pagamento)
node 02-extrair-contratos.js    # contratos + PDFs + modelo de contrato do Emusys
node 02-extrair-aulas.js        # relatório de aulas (histórico + agendamentos futuros)

# 3) Consolidação (gera saida/import-data.json + planilhas em saida/tabelas/)
node 03-consolidar.js

# 4) Importação no MusicPro — SEMPRE simule antes!
node 04-importar.js             # alunos/professores/matrículas/faturas/contratos
node 04-importar.js --commit    # grava em transação única
node 04-enviar-pdfs.js          # sobe os PDFs dos contratos para o storage da VPS
node 07-importar-aulas.js       # aulas (agenda + histórico)
node 07-importar-aulas.js --commit

# 5) Extras (opcional, conforme combinado com o cliente)
node 05-arquivar-inativos.js --commit        # manda ex-alunos para o Histórico
node 06-reconstruir-financeiro.js --commit   # recria o financeiro 1:1 com o Emusys
node 08-registrar-modelo-contrato.js --commit # cria o template de contrato do cliente

```

## O que a importação faz

| Etapa | Tabelas | Observações |
|---|---|---|
| 04 | `users` + `professores` | cria professores que não existirem (sem senha; sem e-mail quando desconhecido) |
| 04 | `instruments` | reaproveita instrumentos existentes por nome/similaridade; cria os que faltam |
| 04 | `students` | casa por nome com alunos já existentes (atualiza só campos vazios); cria os demais como `inativo`/`ativo` |
| 04 | `student_enrollments` | uma por curso/horário da ficha (dia, hora, sala, professor, valor) |
| 04 | `payment_dues` | histórico financeiro completo (status pago/pendente/atrasado + data real de pagamento) |
| 04 | `contracts` | status `assinado` + `signedDocumentUrl` apontando para os PDFs |
| 05 | `students` | arquiva quem ficou `inativo` (Histórico), com motivo e data de conclusão quando existir |
| 06 | `payment_dues` | apaga e recria o financeiro da org 1:1 com as planilhas do Emusys |

Os PDFs dos contratos sobem para o volume `uploads_data` da VPS em
`uploads/contracts-emusys/` (ajuste os nomes no config).

## Regras importantes (aprendidas na prática)

1. **Backup antes de qualquer `--commit`:**
   `docker exec wr-music-app-db-1 pg_dump -U postgres wrmusic | gzip > /root/backup_pre_migracao.sql.gz`
2. **Índice único de faturas:** bancos antigos podem ter o índice
   `uniq_payment_dues_org_student_month` (1 fatura por aluno/mês). O Emusys permite
   várias (2 cursos no mesmo mês). O importador **aborta** se o índice existir —
   rode antes: `DROP INDEX uniq_payment_dues_org_student_month;`
   (o próprio código do MusicPro já suporta a ausência dele — há fallback para 42P10).
3. **Valores do Emusys** vêm no formato `130.00` (ponto decimal) — o parser do kit
   já trata os dois formatos (US e BR).
4. **Auto-lembretes:** alunos importados entram com `allowAutoReminders = false`
   (evita disparo em massa); o cliente ativa depois se quiser.
5. A sessão do Emusys expira em algumas horas (e o PHP pode invalidar) — se algum
   script falhar com "SESSAO CAIU", rode o `01-login.js` de novo.
6. O código 2FA vai para o e-mail do CLIENTE — combine antes com ele para repassar.
7. **Fuso horário (crítico):** o MusicPro lê colunas `timestamp` como UTC (Drizzle: `new Date(valor + '+0000')`) e o navegador exibe em America/Sao_Paulo. Portanto o banco deve guardar o **instante UTC** da hora de parede (`parede + offset`: 3h no padrão, 2h nos verões de 2017–2019). O `07-importar-aulas.js` faz isso com `new Date('AAAA-MM-DDThh:mm:ss')` (fuso de Brasília) — **nunca** envie strings tipo data como parâmetro: o postgres.js as interpreta no fuso local **e** as envia como timestamptz, somando o offset duas vezes (já causou bug de +6h). Se precisar gravar valor exato, passe um `Date` (`toISOString()`).
8. A agenda futura do Emusys também pode ser puxada dia a dia (`{_x:"J6RNdl1", tipoTela:"Gestao", dia:"AAAA-MM-DD"}`) — cada célula traz `inicio` (minutos), `duracao`, aluno no `hint` e `Matricula_ID`. Útil para conferir/completar as aulas futuras.
9. Alunos com **mais de uma matrícula ativa** (2 cursos) têm o relatório principal só da primeira: as aulas da segunda vêm pela agenda (item 8). Sem isso, o aluno "some" da agenda futura.

## Estrutura

```
migracao-emusys/
  config.json          (criado por você; ignorado no git)
  .estado/             (sessão do Emusys e código 2FA; ignorado no git)
  saida/               (extrações e consolidação; ignorado no git)
    http2/             respostas cruas do Emusys (auditoria)
    exports/           planilhas CSV nativas do Emusys
    contratos/         contratos em JSON (com PDF em base64)
    contratos-pdf/     PDFs prontos
    tabelas/           planilhas consolidadas p/ conferência
    import-data.json   dado final usado pelo importador
  lib/                 cliente HTTP, parsers e utilidades
  01-login.js
  02-extrair-*.js
  03-consolidar.js
  04-importar.js
  05-arquivar-inativos.js
  06-reconstruir-financeiro.js
```

## Roteiro de conferência pós-importação

- `04-importar.js` imprime o plano (novos/atualizados) e o resultado da transação.
- `06-reconstruir-financeiro.js` imprime os totais por ano/status para comparar com:
  - tela Financeiro → Contas a Receber → Por Ano → Todos (Emusys)
  - linhas `TOTAL:` dos CSVs em `saida/exports/`
- Abra o MusicPro do cliente: Alunos (ativos + Histórico), Financeiro, Contratos.
