# Como funcionam AULAS e TURMAS no Emusys

**Escola analisada:** Espaço Musical Edu Oliveira (migrada para o MusicPro, org 33)
**Objetivo:** documentar, com evidências, o modelo funcional de aulas/turmas do Emusys para orientar o que o MusicPro deve igualar ou melhorar.
**Natureza:** documentação funcional — nenhuma alteração em produção, nenhum deploy.
**Data da análise:** 2026-10-01.

## Como esta análise foi feita (e limitações)

- Fontes: capturas de tela em `%TEMP%\opencode\emusys-edu\` (`ag-*.png`, `agenda-card.png`, `menu-nmn_*.png`, `admin-menu.png`) e respostas cruas da API interna salvas em `http2/` (`0001__agenda-base.json`, `0001__agf-2026-10-01.json`, `0002__agenda-legenda.json`, `0001__ficha-150.json`, `0014__escola-KIK1L11.json`, `0003__at-JcKNSL1.json`, `0003__disponibilidade.json` etc.).
- Dados consolidados: `aulas-parseadas.json` (554 matrículas, 18.014 aulas, 0 divergências com o "Total de Aulas" dos relatórios), `agenda-futuro.json` (1.430 aulas futuras, 46 alunos, 2026-10-01→2027-09-10), `import-data.json` (548 blocos de matrícula com curso/plano/agenda/professor/faltas/reposições) e `emusys-consolidado/planilhas/*.csv` (turmas, aulas não efetivadas, cancelamentos).
- Auditoria de destino: `migracao-emusys/VERIFICACAO-AGENDA-EMUSYS.md` (cobertura 1:1 da agenda importada).
- **Limitação 1 — sessão viva não utilizada:** a análise se apoia nos artefatos da sessão de recon. Um login novo no Emusys exige código 2FA por e-mail (fluxo `pw-login3.js` + `code.txt`), que depende do cliente; por isso não foram feitas novas consultas.
- **Limitação 2 — troca de modo da agenda não capturou:** o script `pw-agenda-modos.js` clicou em "Semana / Professores / Salas / Todos / Com aula / Dia", mas as imagens `ag-modo-*.png` são todas idênticas à visão **Dia** (o rádio "Dia" permanece marcado). A descrição dos outros modos abaixo vem dos controles visíveis na tela (rádios **Dia/Semana**, **Professores/Salas**, toggles **Todos/Com aula**) e dos parâmetros da API (`modoSemana`, `mostraTodos`, `Pessoa_ID_Prof`, `Turma_ID`), não de prints distintos.

---

## 1) Como o Emusys agenda uma aula

Uma aula no Emusys é um **registro ligado a uma matrícula**, não a um "calendário solto". A célula da agenda (resposta `J6RNdl1`) traz os campos:

| Campo | Exemplo (30/09/2026) | Significado |
|---|---|---|
| `Matricula_ID` / `Pessoa_ID` | `697` / `734` | matrícula e pessoa do aluno |
| `RegPres_ID` | `37569` | identificador do registro de presença daquela aula |
| `inicio` | `1080` | minutos desde 00:00 (1080 = 18:00) |
| `duracao` | `60` | duração em minutos (o padrão da escola é 60) |
| `hint` | `<b>Maria Clara ... , 13 anos</b><br>Responsável: Bárbara` | tooltip com nome, idade, responsável/contato e curso |
| linha (`nomeSala`) | `ADRIAN`, `EDU OLIVEIRA`, `SALA 1`… | recurso da linha (professor ou sala, conforme o modo) |

- **Recorrência:** definida pelo horário fixo da matrícula — a ficha mostra, por exemplo, `Terça-feira das 18:00 às 19:00 na SALA 1`. O relatório de aulas (`02-extrair-aulas.js`) lista uma aula por semana, de forma finita (ex.: 48 aulas semanais de abr/2026 a mar/2027).
- **Ajustes pontuais sem quebrar a série:** menu de contexto da aula (`ag-aula-contexto.png` / `0001__aula-contexto.json`): *Marcar Presença Manual, Cancelar aula, Mover Agendamento, Alterar Professor, Alterar Sala, Alterar Modo (Online / Presencial), Dados do Aluno, Dados do Responsável*.
- **Aula experimental:** a ficha tem duas opções — *"Novo agendamento de aula Experimental **Individual**"* e *"Novo agendamento de aula Experimental **em Turma**"*. Há uma tela de Aulas Experimentais (`0003__at-JcKNSL1.json`) com filtros *Aluno(a) Presente, Aluno(a) Matriculado, Aula Cancelada, Aluno(a) Faltou*, integrada ao CRM ("Leads novos que se matricularam pós aula experimental") e com fatura própria (tipo 19 "Aula Experimental"; havia 1 fatura de R$ 80 em 2022 em `import-data.json`). O Emusys também prevê "Remuneração Aula Experimental" do professor (`0010__escola-JHMTHN1.json`).
- **Aula extra:** botão *"Agendar Aula Extra"* na ficha (avulsa, fora da série).
- **Calendário escolar:** tela "Feriados e Recessos da Escola" (`0010__ag-JA3hIq1.json`).
- **Duração:** 60 min em 100% das 1.430 aulas futuras; há turma legada de 80 min (TÉCNICA VOCAL 20:00–21:20).

## 2) Aula individual vs grupo/turma

O Emusys **tem** o conceito de Turma, mas a escola operava majoritariamente com matrículas individuais compartilhando o mesmo slot.

**2.1 O recurso "Turma" existe (Escola → Turmas)**
- Grid `0014__escola-KIK1L11.json`: `Turma_ID | Nome | Disciplina | Dias | Data Inicio | Data Final | Professor | Nr. de Alunos` + botões "Nova Turma" e "Histórico".
- `emusys-consolidado/planilhas/turmas.csv` (4 turmas, todas com "0 Alunos"): `AIC_Ter_16` (Aprenda Inglês Cantando), `TVSG_Qui_20` (Técnica Vocal em Grupo), `VSGI_Sex_19` (Violão Grupo Igreja), `VSG_Sex_19` (Violão **Dupla**) — 3 com "(Disciplina Inativa)".
- A agenda e a ficha dão suporte a turma: parâmetro `Turma_ID` no contexto da aula, menu "Agendamento Individual" no card (título exibido ao clicar numa aula individual), legenda com a regra "Se for turma, o professor esteve presente" e estado "Turma sem alunos ou matrícula trancada".

**2.2 Na prática, os alunos eram matrículas separadas no mesmo slot**
- `import-data.json` (matrículas ativas) mostra 5 slots recorrentes com 2–3 alunos na MESMA sala/horário:

| Slot recorrente | Alunos | Professor(es) / Curso |
|---|---|---|
| Quinta 18:00–19:00 · SALA 3 | Bárbara Lorenzoni + Eduarda Agrizzi + Josué Douglas | Eduardo (Piano) + Paulo (Bateria) |
| Quinta 18:00–19:00 · SALA 1 | Maria Clara Agrizzi + Vitor Alves Avanza | Adrian (Violão) — mesmo prof./curso |
| Quinta 19:00–20:00 · SALA 3 | Adriel de Souza Batista + Arthur Ribeiro Fantin | Adrian (Violão) + Paulo (Bateria) |
| Quinta 20:00–21:00 · SALA 1 | Fernando Tessarolo + Maria Tatiani Santos | Adrian (Violão) + Eduardo (Canto) |
| Terça 18:00–19:00 · SALA 1 | Lieny Rocha Ferreira + Vinicius de Paula Serafim | Whalter (Canto) + Adrian (Contrabaixo) |

- `agenda-futuro.json`: **106 slots** com 2+ alunos no mesmo dia/hora/sala (ex.: `2026-10-01|18:00|SALA 1 => Maria Clara + Vitor`; `18:00|SALA 3 => Eduarda + Bárbara + Josué`).
- Ou seja: (a) há **aulas realmente compartilhadas** (mesmo professor/curso — irmãos/duplas), e (b) o Emusys **não bloqueia conflito de sala** — a mesma sala recebe até 3 alunos e 2 professores simultâneos. A auditoria pós-importação (`VERIFICACAO-AGENDA-EMUSYS.md`, §6) encontrou 114 conflitos futuros herdados, em 5 pares.
- **Na ficha/matrícula:** cada curso gera um bloco independente (curso, plano, valor, agenda, professor, presença, faltas, reposições). Não há campo "turma" na ficha; dupla/grupo apareciam como **nome de curso** ("VIOLÃO SEMESTRAL DUPLA", "TÉCNICA VOCAL SEMESTRAL EM GRUPO").
- **Na agenda (visão capturada):** modo Dia com linhas por professor (ADRIAN, EDU OLIVEIRA, Nathan, PAULO e "Sem Acompanhamento") e colunas de hora; blocos azuis = disponibilidade; cards mostram `PrimeiroNome` + `SALA n`, com tooltip completo. Cada aluno é um card próprio, mesmo no mesmo horário/sala; as irmãs Bárbara+Eduarda aparecem lado a lado em 18:00/SALA 3 (`agenda-card.png`, `ag-modo-Dia.png`).
- **Nas matrículas compartilhadas:** não há "matrícula de turma"; cada aluno tem sua matrícula e seu preço, e a dupla só existe por coincidência de slot (por isso a conversão para `lessonType='turma'` no MusicPro foi feita por script, ver §5).

## 3) Chamada, status e reposição

A legenda da agenda (`0002__agenda-legenda.json`, idêntica em `0002__agenda-week.json`) define os estados visuais:

| Estado (legenda) | Leitura |
|---|---|
| Agendamento futuro | aula ainda não aconteceu |
| Aluno esteve presente. Se for turma, o professor esteve presente. | presença normal |
| Aluno esteve presente e professor faltou. | falta do professor (não penaliza aluno) |
| Aluno faltou mas o professor esteve presente. **Sem direito a reposição** | falta do aluno |
| Aluno faltou e o professor também. **Possível direito a reposição** | ambos faltaram |
| Agendamento em breve ou em andamento | janela atual |
| Turma sem alunos ou matrícula trancada | slot vazio/bloqueado |

- **Marcar presença:** ação "Marcar Presença Manual" no menu da aula; no contexto de turma, um único registro de presença do professor pode representar a turma.
- **Cancelamento/remarcação pelo app do aluno:** gera notificação e pedido de reposição com dois estados — "Reposição **Aguardando Autorização**" e "Reposição **Autorizada**" (dashboard em `recon-body.txt`).
- **Fluxo de justificativa:** telas "Cancelamentos e Justificativas" (`0004__at-K6Gj151.json`; CSV `cancelamentos-justificativas.csv` com motivos em texto livre e status "Solicitado / A reposição pode ser autorizada ou negada") e "Solicitações de Reagendamento" (`0002__at-Jb94jK1.json`). O motivo pode ser lançado pelo aluno **ou** pelo professor; há o caso "Justificada pelo app pelo aluno" quando o professor faltou.
- **Reflexo nos relatórios/ficha:** a ficha mostra `46% de Presença`, `Aulas a Repor: 0`, `Faltas: 13` e o progresso `11/24`; o Emusys tem relatório/CSV "Aulas Não Efetivadas" (`emusys-consolidado/planilhas/aulas-nao-efetivadas.csv`) e o dashboard "aulas agendadas hoje / já aconteceram / experimentais / cancelamentos".
- **Como a migração tratou:** `07-importar-aulas.js` mapeia passado→`concluida`, futuro→`agendada` e aulas listadas em "Aulas Não Efetivadas"→`falta` (via CSV de export). O status de reposição em si não foi migrado como linha do tempo.

## 4) Matrícula, plano e geração de aulas

O bloco da ficha (`0001__ficha-150.json`, `import-data.json`) contém:

| Campo | Exemplo |
|---|---|
| Curso | `VIOLÃO POPULAR` |
| Plano / parcelas / valor | `Plano Semestral 6 Parcelas de R$ 140.00, 5 pagas, 1 vencida` |
| Progresso / presença | `11/24` e `46% de Presença` |
| Agenda fixa | `Terça-feira das 18:00 às 19:00 na SALA 1` |
| Professor | `Prof. EDUARDO DE OLIVEIRA SANTOS` |
| Pendências | `Aulas a Repor: 0`, `Faltas: 13`, `Não há mais aulas agendadas` |
| Ações | Nova Matrícula, **Renovar Matrícula**, Aula Experimental (individual/em turma), Agendar Aula Extra, Imprimir aulas, Declaração |

- **Periodicidade e volume:** o plano define o TOTAL de aulas. Correlação real (`import-data.json` × `aulas-parseadas.json`): **Trimestral = 12**, **Semestral = 24**, **Anual = 48** (há contratos de 96 = 2 anos) e **Livre = variável** (4 a 48). O relatório "Total de Aulas" bate 100% com a lista de aulas (0 divergências em 554 matrículas).
- **Até quando gera:** gera as N aulas semanais até esgotar o plano (a última aula do relatório cai no fim do contrato; ex.: Maria Clara 48 aulas de 24/04/2026 a 25/03/2027). Não é recorrência infinita: ao terminar aparece "Não há mais aulas agendadas" e a escola usa **Renovar Matrícula**.
- **Renovação:** tela "Renovação de Matrículas" (`0016__escola-LaZihr1.json`) lista "Matrículas vencendo nos próximos 30 dias".
- **Segundo curso:** alunos com mais de uma matrícula têm relatórios/agendas separados — o relatório principal só cobre a 1ª matrícula e o restante vem pela tela de agenda (README do kit, itens 8–9; `reconciliar-cursos.js`).
- **Cobrança:** cada matrícula tem suas parcelas (1.850 faturas abertas/vencidas no relatório financeiro) — o plano financeiro acompanha o plano de aulas.

## 5) O que o MusicPro deveria igualar ou melhorar (acionável)

1. **Turma como slot de 1ª classe, desde a matrícula:** permitir matricular N alunos no mesmo horário/sala/professor e já gerar `lessons` com `lessonType='turma'` + `recurringGroupId` comum. Hoje isso foi feito por script pós-importação (`fix-turma-barbara-sala2.js` → `emusys-turma-piano-sala2`); o modelo do MusicPro (enum `lessonType` + `recurringGroupId` em `drizzle/schema.ts:220`) suporta, falta o fluxo de entrada.
2. **Semântica de conflito compatível com a realidade da escola:** o Emusys **não** bloqueia sala ocupada (até 2 professores e 3 alunos no mesmo slot). A regra do MusicPro (bloqueia sala) precisa de exceções explícitas: mesmo `recurringGroupId`, sala compartilhada/capacidade ou "sobreposição autorizada" — senão o legado (114 conflitos herdados, 5 séries) vira erro operacional. Prever também turma de dupla (mesmo professor/curso) e de professor diferente.
3. **Multi-curso/multi-slot por aluno:** garantir que o 2º curso gere aulas e apareça na agenda (o Emusys exige puxar a 2ª matrícula separadamente; no MusicPro, `reconciliar-cursos.js` reconciliou `student_enrollments` por instrumento/curso). Exibir os dois horários na ficha do aluno.
4. **Progresso contratual visível ("aulas dadas/total"):** mostrar `11/24`, `13/48`, presença %, faltas e "aulas a repor" na ficha do aluno, e alertar "não há mais aulas agendadas" quando o saldo zera. O MusicPro já tem `contracts.lessonsGiven` e `ContractExpiryEngine` (`computeTotalLessons/computeLessonsRemaining`) — falta expor com a clareza da ficha do Emusys.
5. **Geração finita por contrato, respeitando o calendário:** gerar exatamente N aulas (12/24/48/96) do plano em vez de apenas "N meses"; considerar feriados/recessos (o Emusys tem a tela "Feriados e Recessos da Escola") para não entregar menos aulas que o contratado.
6. **Chamada com 4 estados e dono da falta:** registrar (a) presente, (b) presente com falta do professor, (c) falta do aluno sem reposição, (d) falta de ambos com direito a reposição — herdando o workflow de autorização da reposição (Solicitado → Autorizado) e notificação ao aluno/app.
7. **Relatórios operacionais equivalentes:** "Aulas Não Efetivadas", "Cancelamentos e Justificativas" (com motivo em texto e status) e "Solicitações de Reagendamento", todos exportáveis — hoje são CSVs do Emusys que a escola usava para conferência.
8. **Agenda por recurso + disponibilidade:** visão Dia/Semana alternando linhas entre Professor e Sala, toggle "Todos/Com aula", linha "Sem Acompanhamento" (aluno sem professor) e blocos de disponibilidade/reserva (tela `Disponibilidade` com RESIDENCIA e SALA 1–5). Facilita achar horário vago ao matricular.
9. **Ações de contexto não destrutivas:** "Mover Agendamento" (uma aula, sem quebrar a série), "Alterar Professor/Sala", "Alterar Modo Online/Presencial", "Marcar Presença Manual" e "Agendar Aula Extra" — espelhar o menu do Emusys (`ag-aula-contexto.png`).
10. **Aula experimental ponta a ponta:** suportar experimental **individual e em turma**, com desfecho (presente / matriculado / cancelado / faltou), conversão medida no CRM e remuneração do professor (o MusicPro já tem `isExperimental` no schema e o item "aula_experimental" em `PaymentRulesDialog.tsx`; falta fechar o ciclo de resultado/conversão).

### Anexo — inventário de evidências

| Evidência | O que prova |
|---|---|
| `ag-modo-Dia.png`, `agenda-card.png`, `ag-v1-dia.png` | agenda Dia com linhas por professor, disponibilidade e cards de aluno lado a lado |
| `ag-aula-contexto.png`, `http2/0001__aula-contexto.json` | menu da aula e título "Agendamento Individual" |
| `http2/0001__agf-2026-10-01.json` | campos `inicio`, `duracao`, `hint`, `RegPres_ID`, `Matricula_ID`, `Pessoa_ID` |
| `http2/0002__agenda-legenda.json` / `0002__agenda-week.json` | 7 estados da legenda (presença/faltas/reposição/turma) |
| `http2/0014__escola-KIK1L11.json`, `planilhas/turmas.csv` | entidade Turma (campos, histórico, turmas de dupla/grupo inativas) |
| `http2/0001__ficha-150.json` | plano, progresso X/total, presença, faltas, aulas a repor, experimental individual/em turma, aula extra, renovação |
| `http2/0003__at-JcKNSL1.json`, `0001__at-KrhpJV1.json`, `0010__escola-JHMTHN1.json` | tela de experimentais, CRM e remuneração de experimental |
| `http2/0003__disponibilidade.json`, `0010__ag-JA3hIq1.json`, `0016__escola-LaZihr1.json` | disponibilidade/recursos, feriados/recessos, renovação em 30 dias |
| `agenda-modos-posts.json` | payloads da agenda (`J6RNdl1`, `J6...` com `Turma_ID`, `mostraTodos`, `modoSemana`) |
| `planilhas/aulas-nao-efetivadas.csv`, `cancelamentos-justificativas.csv` | relatórios operacionais de falta/cancelamento |
| `aulas-parseadas.json`, `agenda-futuro.json`, `import-data.json` | 18.014 aulas/554 matrículas; 1.430 futuras/46 alunos; 5 slots com 2–3 alunos |
| `migracao-emusys/README.md`, `07-importar-aulas.js` | regras de importação (status, fuso, 2ª matrícula, auto-lembretes) |
| `migracao-emusys/VERIFICACAO-AGENDA-EMUSYS.md` | auditoria pós-import: 114 conflitos de sala herdados e séries candidatas a turma |
