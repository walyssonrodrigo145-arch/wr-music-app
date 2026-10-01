# Verificação da Migração da Agenda — Emusys → MusicPro (org 33)

**Escola:** Espaço Musical Edu Oliveira (organizationId = 33)
**Auditoria:** 2026-10-01, somente leitura — **nenhuma alteração feita em produção, nenhum commit/deploy**
**Fontes:** `aulas-parseadas.json` (18.014 aulas de 554 matrículas via relatórios PDF do Emusys) + `agenda-futuro.json` (1.430 aulas da tela de agenda, 2026-10-01 a 2027-09-10) + apoio `export-teste.csv` / `relatorio-aulas-150.*` / `alunos-todos.json`
**Destino:** banco de produção (`wrmusic`), tabela `lessons` da org 33 — 18.216 aulas (18.214 com `notes LIKE 'Importado do Emusys%'` + 2 manuais)

---

## 1. Resumo executivo

| Métrica | Resultado |
|---|---|
| Cobertura de existência (aula da fonte existe no destino) | **18.214 / 18.214 = 100,00%** |
| Aulas da fonte FALTANDO | **0** |
| Duplicatas no destino (mesmo aluno + horário) | **0** |
| Aulas EXTRA no destino | **2**, ambas **manuais** (não vieram do Emusys) — sem perda de dados |
| DIVERGENTES campo a campo | **71**: 44 = conversão aprovada p/ turma (586/591) + 27 = sala "RESIDENCIA" sem cadastro |
| Fidelidade plena (aluno+data+hora+sala+professor+instrumento) | **99,61%** (18.143/18.214); **99,85%** excluindo a conversão aprovada de 586/591 |
| Alunos com aula na fonte | 549 → **todos os 549 têm aulas no destino** |
| Horários fora de 07:00–22:00 | 0 |
| `duration` nulo/0 | 0 |
| Status/lessonType inválidos | 0 |
| Aulas futuras de aluno inativo/deletado | 0 |

**Veredito: APROVADO com ressalvas.** A migração copiou a agenda 1:1 sem perder nenhuma aula. Restam (a) 27 aulas antigas de "RESIDENCIA" sem sala (`studioRoomId = null` porque a sala não existe no MusicPro), (b) 2 aulas de hoje 18:00 das irmãs 586/591 que ficaram fora da conversão de turma por um detalhe de fuso, (c) 114 conflitos de sala futuros e 1 série de alunos ainda `individual` — esses dois últimos são dados herdados da agenda original, não defeitos da importação, mas pedem decisão operacional.

---

## 2. Método e acesso

1. Fonte carregada dos JSONs em `%TEMP%\opencode\emusys-edu\` (normalização de encoding: `VIOLǟO`→violão etc. via NFD + remoção de acentos).
2. Acesso de leitura ao banco de produção pelo mesmo padrão do `fix-turma-barbara-sala2.js`:
   - túnel `ssh2` para `179.197.76.174` (root) → `172.18.0.2:5432`;
   - `postgres.js` `{ user: 'postgres', database: 'wrmusic' }`;
   - variáveis `SSH2_PATH`, `POSTGRES_PATH`, `VPS_CREDS` (host/user/senha da VPS) e `PROD_DB_PASSWORD` (senha do container, lida do `.env` do repo). **Nenhuma credencial foi gravada no repo.**
3. Comparação "hora de parede": o banco guarda horário naive e o container roda `TZ=America/Sao_Paulo`; por isso a auditoria comparou **direto** `scheduledAt::date` + `to_char(scheduledAt,'HH24:MI')` com `data`/`hora` da fonte.
4. Para cada aula da fonte foi resolvido o aluno pela **mesma regra do importador** (`07-importar-aulas.js`: nome normalizado exato → fallback primeiro+último nome), o professor pela mesma regra (`resolveProf`), a sala por nome normalizado e o instrumento pelas mesmas `INSTR_RULES` do kit.
5. Chave de cobertura: `(studentId, data, hora)`. `agenda-futuro.json` foi unida à fonte (1.222 aulas já constavam dos PDFs; 201 novas; 7 duplicatas por apelido — ver §4).

### Scripts de auditoria (pasta `%TEMP%\opencode\emusys-edu\`)

| Script | Função |
|---|---|
| `audit-inspect-fonte.js` | Estatísticas dos JSONs fonte |
| `audit-01-connect.js` | Conexão, schema, contagens basais |
| `audit-02-cobertura.js` | Cobertura 1:1 → `audit-resultado.json` |
| `audit-03-sanidades.js` | Salas, enums, sanidades, conflitos (1ª versão) → `audit-resultado-2.json` |
| `audit-04-focado.js` | Conflitos reais (mesmo dia), homônimos, caso "Bia", séries → `audit-resultado-3.json` |
| `audit-05-678.js` / `audit-06-bia.js` | Caso matrícula 678 / apelido "Bia" |
| `audit-07-detalhes.js` | Detalhe dos 27 RESIDENCIA, 586/591, pares em conflito, combinações de série |
| `audit-08-turma-nuance.js` | Nuance da conversão parcial 586/591 |

Consulta-base do destino (idêntica nos scripts):

```sql
SELECT l.id, l."studentId", s.name AS aluno,
       l."scheduledAt"::date::text AS dia,
       to_char(l."scheduledAt",'HH24:MI') AS hora,
       l.status, l."lessonType", l."recurringGroupId", l."studioRoomId", r.name AS sala,
       l."userId", u.name AS prof, l."instrumentId", i.name AS instr, l.notes, l.duration
FROM lessons l
JOIN students s ON s.id = l."studentId"
LEFT JOIN studio_rooms r ON r.id = l."studioRoomId"
LEFT JOIN users u ON u.id = l."userId"
LEFT JOIN instruments i ON i.id = l."instrumentId"
WHERE l."organizationId" = 33;
```

---

## 3. Contagens

### 3.1 Totais

| Item | Quantidade |
|---|---|
| Aulas no relatório PDF (18.014 registros brutos) | 18.014 |
| Matrículas com aulas | 551 de 554 |
| Aulas da tela de agenda (`agenda-futuro.json`) | 1.430 |
| — já presentes nos PDFs (mesma chave) | 1.222 |
| — novas (2ª matrícula / agenda) | 201 |
| — apelido "Bia" (já importadas via PDF da matrícula 678) | 7 |
| **União única da fonte** | **18.214** |
| Destino: aulas importadas (`notes LIKE 'Importado do Emusys%'`) | **18.214** |
| Destino: aulas manuais (fora do Emusys) | 2 |
| **Destino total** | **18.216** |
| Alunos com aula na fonte | 549 |
| Alunos da fonte com aula no destino | **549 (100%)** |
| Alunos na org 33 | 559 (550 com aulas: 549 da fonte + Valdiney, manual) |

Observação: os 18.014 registros brutos contêm 1 duplicata interna de PDF (mesmo aluno+horário em 2019, matrículas distintas), deduplicada pelo importador — deixa a união em 18.214.

### 3.2 Por ano

| Ano | PDF | Agenda novas | União (esperado) | Destino | Δ |
|---|---:|---:|---:|---:|---:|
| 2017 | 48 | 0 | 48 | 48 | 0 |
| 2018 | 1.349 | 0 | 1.349 | 1.349 | 0 |
| 2019 | 2.491 | 0 | 2.490¹ | 2.490 | 0 |
| 2020 | 1.631 | 0 | 1.631 | 1.631 | 0 |
| 2021 | 2.005 | 0 | 2.005 | 2.005 | 0 |
| 2022 | 2.217 | 0 | 2.217 | 2.217 | 0 |
| 2023 | 1.561 | 0 | 1.561 | 1.561 | 0 |
| 2024 | 2.003 | 0 | 2.003 | 2.003 | 0 |
| 2025 | 1.931 | 0 | 1.931 | 1.931 | 0 |
| 2026 | 2.027 | 59 | 2.086 | 2.088² | +2 |
| 2027 | 751 | 142 | 893 | 893 | 0 |
| **Total** | **18.014** | **201** | **18.214** | **18.216** | +2 |

¹ 1 duplicata interna do PDF (mesma aula em 2 matrículas) — deduplicada corretamente.
² 2 aulas manuais de Valdiney Gomes Maria dos Santos (não Emusys).

---

## 4. Cobertura 1:1 por aluno — FALTANDO / EXTRA / DIVERGENTE

### 4.1 FALTANDO — **0**

Nenhuma aula da união PDF+agenda ficou de fora. Os 549 alunos resolvidos da fonte têm todas as suas aulas no destino.

Caso especial investigado (não é falta): o aluno da agenda **matrícula 678 aparece como "Bia"** (apelido), nome que não casa com o PDF da mesma matrícula, cujo titular é **Valdenise Pires Macedo**. As 7 aulas de out/nov 2026 do "Bia" **já estavam importadas via PDF** (mesmas datas/horas/sala, chave idêntica — confirmado): são duplicatas de exibição, não aula perdida. Idem para as demais entradas.

### 4.2 EXTRA — **2** (manuais, fora do Emusys)

| ID | Aluno | Data/hora | Sala | Tipo | Status | Notes |
|---|---|---|---|---|---|---|
| #6923 | Valdiney Gomes Maria dos Santos | 2026-09-19 18:00 | Sala 5 | individual | concluida | `null` |
| #6924 | Valdiney Gomes Maria dos Santos | 2026-09-26 18:00 | Sala 5 | individual | agendada | `null` |

Ambas **não** têm `notes` de importação — são aulas criadas no MusicPro (provavelmente antes/durante a migração). Não são erro.

### 4.3 DIVERGENTE — **71** (sala: 71; professor: 0; instrumento: 0)

Agrupado (repetidos consolidados; listas completas em `%TEMP%\opencode\emusys-edu\audit-resultado.json`):

| Grupo | Qtde | Aluno(s) | Divergência | Classificação |
|---|---:|---|---|---|
| A | 44 (22+22) | Bárbara Lorenzoni Agrizzi Avanza (#586) e Eduarda Agrizzi Gonçalves (#591), aulas futuras 2026-10-08→2027-03-04 | fonte `SALA 3` → destino `Sala 2`, `lessonType=turma`, `recurringGroupId=emusys-turma-piano-sala2` | **Esperado** (conversão aprovada) |
| B | 27 | IZABELA AGRIZZI FERNANDES (#1409, 15 aulas, 2018-06-08→2018-09-21) e MARCOS FAMILIA (#1526, 12 aulas, 2018-10-20→2019-01-12) | fonte `RESIDENCIA` → destino `studioRoomId = NULL` | **A corrigir** — não existe sala "Residência" no MusicPro |

Grupo B — IDs: `#8356–#8370` (15) e `#9249–#9260` (12); todas `concluida`, professor mapeado corretamente (Eduardo Santos/Joilson Santos), `notes` preserva `RESIDENCIA`. Impacto histórico/fidelidade (médio), sem efeito operacional futuro.

### 4.4 Cobertura de professor e instrumento

0 divergências: em 100% das 18.143 aulas "OK" o `userId` (professor) e o `instrumentId` batem com o mapeamento do kit; as 71 divergências são **somente de sala**.

---

## 5. Sanidades internas (org 33)

| Verificação | Resultado |
|---|---|
| Duplicatas exatas (mesmo `studentId` + `scheduledAt`) | **0 grupos** (nenhuma duplicata, nem agendada nem histórica) |
| Horários fora de 07:00–22:00 | **0** |
| `duration` nulo ou 0 | **0** (todas 60 min; agenda futurou `duracao` corretamente) |
| Status inválidos | **0** — enum: `agendada, concluida, cancelada, remarcada, falta, a_repor`; usados apenas os 3 primeiros válidos |
| `lessonType` inválidos | **0** — enum: `individual, turma, online`; distribuição 18.172 individual + 44 turma |
| Agendadas no passado | **3** — #22956 (Leonardo Bisineli, hoje 15:00, importada), #25376 (Carlos Eduardo, 30/09 18:00, importada), #6924 (Valdiney, manual) |
| Concluída/falta no futuro | **0** |
| Futuras de aluno inativo/deletado | **0** |
| Alunos homônimos | 2 grupos, ambos inativos/deletados: #1319/#1320 "ELIAN ITALO…" e #1455/#1456 "JULIA GRIFFO…" — sem aulas futuras, sem impacto |

Observação sobre #22956/#25376: são aulas importadas cujo status ficou `agendada` (o importador classifica como `concluida` só se `data < hoje`; no caso da #22956 é do próprio dia). Ajuste de status é trivial e cosmético (baixo).

---

## 6. Conflitos de sala futuros (mesma sala, horários sobrepostos, dias iguais)

Excluindo aulas do mesmo `recurringGroupId` (a turma piano Sala 2 não gera conflito interno). **Restam 114 pares-evento em 5 pares distintos de alunos:**

| Par | Qtde | Sala / horário | A | B | Observação |
|---|---:|---|---|---|---|
| #595 × #612 | 38 | Sala 1, 20:00 (60min) | Fernando Tessarolo — Violão, prof. Adrian Zanetti | Maria Tatiani S. Ferreira — Canto, prof. Edu Oliveira | mesmo horário, sala e dia; professores/instrumentos diferentes |
| #587 × #629 | 26 | Sala 3, 16:00/16:30 (60min) | Caio Porto Gomes — Piano, prof. Nathan Silva | Vitor Wingler de Jesus — Bateria, prof. Paulinho Pêpo | sobreposição de 30 min |
| #608 × #628 | 25 | Sala 1, 18:00 (60min) | Maria Clara Agrizzi Gonçalves — Violão, prof. Adrian Zanetti | Vitor Alves Avanza — Violão, prof. Adrian Zanetti | mesmo professor/sala/horário — candidato a turma (§7) |
| #583 × #585 | 18 | Sala 3, 19:00 (60min) | Adriel de Souza Batista — Violão, prof. Adrian Zanetti | Arthur Ribeiro Alves Fantin — Bateria, prof. Paulinho Pêpo | mesmo horário, professores/instrumentos diferentes |
| #605 × #627 | 7 | Sala 1, 18:00 (60min) | Lieny Pereira Sá Rocha Ferreira — Canto, prof. Whalter Guilhermino | Vinicius de Paula Serafim — Contrabaixo, prof. Adrian Zanetti | mesmo horário, professores/instrumentos diferentes |

Períodos: par #595×#612 de 2026-10-01 a 2027-06-17; #587×#629 de 2026-10-02 a 2027-04-16; #608×#628 de 2026-10-08 a 2027-03-25; #583×#585 de 2026-10-08 a 2027-02-04; #605×#627 de 2026-10-06 a 2026-11-17.

Esses choques **vieram da própria agenda do Emusys** (a importação é fiel 1:1 — sala, professor e horário conferem com a fonte). Não são bug de migração, mas exigem decisão da escola. O caso #595×#612 (mesma sala/horário, todos os dias de aula) é o mais crítico operacionalmente.

---

## 7. Séries ATUAIS/FUTURAS — pares/trios ainda `individual` (candidatos a turma)

| Combinação | Qtde | Período | Sala/hora | Professor | Situação |
|---|---:|---|---|---|---|
| Maria Clara Agrizzi Gonçalves (#608) + Vitor Alves Avanza (#628) | **25 aulas** | 2026-10-08 → 2027-03-25 (semanal, quintas) | Sala 1, 18:00 | Adrian Zanetti | ambas `individual`, mesmo professor/sala/horário — **candidato claro a `turma`**, no mesmo formato aplicado a 586/591 |
| Bárbara (#586) + Eduarda (#591) | 22 aulas | 2026-10-08 → 2027-03-04 | Sala 2, 18:00 | Edu Oliveira | já convertida para `turma` (`emusys-turma-piano-sala2`) ✔ |

Nenhum trio. Os outros pares em conflito (§6) têm professores/instrumentos diferentes; se a escola quiser transformá-los em turma, precisa alinhar professor único.

### Nuance na conversão aprovada de 586/591

A conversão pegou **22 + 22 = 44 aulas**, mas **as 2 aulas de hoje (2026-10-01 18:00) ficaram de fora** — #24681 (Bárbara) e #24633 (Eduarda) continuam `individual` na **Sala 3**, enquanto a série toda virou `turma` na Sala 2. Causa: o `UPDATE` do `fix-turma-barbara-sala2.js` usou `"scheduledAt" >= now()` e o `now()` do banco está em **UTC**, então o horário de parede de hoje 18:00 (16:00 BRT/19:00 UTC no momento do fix) foi tratado como passado. Recomendo incluir essas 2 aulas na conversão (junto com `student_enrollments`, se aplicável) — **não foi feito nesta auditoria**.

---

## 8. Veredito e lista priorizada

**Batimento global**
- **Existência: 100,00%** (0 aulas faltando de 18.214; 0 duplicatas).
- **Fidelidade plena (aluno+data+hora+sala+professor+instrumento): 99,61%** (18.143/18.214).
- **Excluindo a conversão aprovada de 586/591: 99,85%** (18.187/18.214) — restam 27 aulas de "RESIDENCIA" sem sala.
- Os 2 registros extras são manuais e não indicam perda; a agenda futura da tela foi 100% absorvida (201 novas + 1.222 coincidentes + 7 apelidos).

**Priorizado**

| Nível | Item | Ação sugerida |
|---|---|---|
| **Crítico** | Nenhum | — |
| **Alto** | 2 aulas de hoje 18:00 de #586/#591 ainda `individual`/Sala 3 (#24681, #24633) — conversão parcial por fuso | Incluir na turma `emusys-turma-piano-sala2` (corrigir cláusula para comparar hora de parede) |
| **Alto (operacional)** | 114 conflitos de sala futuros (5 pares, §6) herdados do Emusys | Revisar agenda com a escola; priorizar #595×#612 (38 ocorrências) |
| **Médio** | 27 aulas `RESIDENCIA` com `studioRoomId = null` (#8356–#8370, #9249–#9260) | Criar sala "Residência" (ou mapear para uma sala existente) e atualizar as 27 aulas |
| **Médio** | Série #608 + #628 `individual` (25 aulas) | Avaliar conversão para `turma` como fizeram com 586/591 |
| **Baixo** | 3 `agendada` no passado (#22956, #25376, #6924) | Marcar como concluída, se aplicável |
| **Baixo** | 7 entradas "Bia" (matrícula 678) e 2 homônimos inativos | Sem ação — duplicatas de exibição / cadastros antigos deletados |
| **Baixo** | 2 aulas manuais de Valdiney (fora do Emusys) | Sem ação — legítimas |

> Conclusão: **a migração da agenda está fiel e completa** — nenhuma aula da fonte ficou de fora e todas as 18.214 importadas foram rastreadas 1:1 até a fonte (PDF e/ou tela de agenda). As ressalvas são de cadastro de sala histórica (27), de uma conversão de turma parcial (2 aulas de hoje) e de conflitos/séries que já existiam no Emusys e agora estão visíveis no MusicPro.
