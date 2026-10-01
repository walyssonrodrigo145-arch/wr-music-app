# PRD — Novo Cadastro de Alunos (Wizard estilo Emusys)

Versão: 1.0 — 01/10/2026
Referência visual: fluxo de matrícula do Emusys (4 telas: Criação rápida → Cursos e Aulas → Financeiro → Dados Pessoais → Resumo)
Base de código: `client/src/pages/NovoAluno.tsx` (`/alunos/novo` e `/alunos/:id/editar`), `client/src/pages/Alunos.tsx`

---

## 1. Visão Geral

### Problema
O cadastro atual (`NovoAluno.tsx`) é uma página única com cards soltos (Dados Pessoais, Acadêmico, Contato, Planos & Bolsas, Agendamento). O usuário precisa "descobrir" a ordem, o agendamento e o plano ficam separados do financeiro, não há prévia do que será criado (aulas e parcelas) e não existe um caminho rápido para matricular (só nome + responsável). Resultado: cadastro lento, erro de digitação de datas/valores e retrabalho na recepção.

### Objetivo
Substituir por um **wizard guiado de 4 passos** (mais uma matrícula expressa), no padrão do Emusys:
**Cursos e Aulas → Financeiro → Dados Pessoais → Resumo**, com **prévia visual de aulas e parcelas**, validação de conflitos em tempo real e criação transacional (aluno + cursos + aulas + faturas).

### Contexto (o que já existe e será reutilizado)
| Bloco | Base atual | Reuso no wizard |
|---|---|---|
| Aluno | `students.create/update` (validação de plano, e-mail único, limites, menor→responsável) | Passo 3 chama a mesma mutation |
| Múltiplos cursos | `students.syncCourses` (criar/atualizar/encerrar matrículas) | Passo 1 monta a lista e o concluir sincroniza |
| Aulas | `lessons.checkConflicts` + `lessons.createBatch` (com tela de conflitos e "marcar/pular") | Passo 1 valida em tempo real e o concluir agenda |
| Planos | `schoolPlans` (`nome, aulasPorSemana, duracaoMeses, valorMensal, valorCheio, taxaInscricao, diasLimite, postergarDiaUtil`) | Passo 2 (Plano de pagamento) |
| Faturas | Geração em lote existente no Financeiro (`payment_dues`) | Passo 2 vira prévia + opção "gerar no concluir" |
| Feriados/Calendário | `schoolHolidays.list` + tela Configurações → Calendário | Aviso no passo 1 e descontos de feriados na prévia |
| Disponibilidade | `getFreeSlotsForDay` / painel "Horários Livres Hoje" da Agenda | Chips de horário no passo 1 + "Selecionar na agenda" |
| Responsável | `guardianName/Phone/Email` + regra de menor | Passo 3 (obrigatório se menor) |

---

## 2. Usuários Envolvidos
- **Admin/recepção:** cria e edita matrículas (todos os passos).
- **Professor (com `alunos_editar`):** cria/edita, limitado aos próprios alunos e sem campos financeiros quando não tiver `alunos_mensalidade` (regra atual mantida).
- **Aluno:** não usa o wizard (portal apenas).

---

## 3. Escopo

### Incluído
1. **Matrícula Expressa** (modal): Nome do Aluno + Nome do Responsável (opcional) → cria aluno "cadastro incompleto" e cai no Passo 1 do wizard.
2. **Wizard de 4 passos** com stepper, Voltar/Continuar, rascunho entre passos e tabela de resumo lateral.
3. Passo 1 — **Cursos e Aulas** (1 a 4 cursos, cada um com instrumento, professor, modalidade, dia/horário, sala, modo, primeira/última aula ou nº de aulas), com conflitos e feriados validados ao vivo.
4. Passo 2 — **Financeiro** com valor da parcela em destaque, plano, nº parcelas, 1ª parcela, vencimento, desconto, taxa de matrícula e **prévia mês a mês (aulas + parcela)** com "Alterar Datas".
5. Passo 3 — **Dados Pessoais** (PF/PJ, dados do aluno, contatos, responsável, endereço) reaproveitando o formulário atual.
6. Passo 4 — **Resumo**: tudo o que será criado; concluir cria aluno, cursos, aulas e (opcional) faturas; opção de liberar acesso ao portal.
7. Edição (`/alunos/:id/editar`) usa o MESMO wizard, abrindo direto no passo desejado.
8. Remoção do `StudentModal.tsx` morto e consolidação de um único fluxo de criação/edição.

### Fora do escopo (desta versão)
- Pronome e País de Origem (campos que não existem hoje — ver §16 Perguntas).
- Contrato digital dentro do wizard (continua no menu Contratos).
- Assinatura/checkout online no concluir.
- Redesenho do fluxo de matrícula em turma (o wizard cria individual/online; turma continua no fluxo atual).

---

## 4. Requisitos Funcionais

### RF-001 — Matrícula Expressa
**Descrição:** botão "Matrícula rápida" na lista de Alunos abre modal com Nome* e Nome do Responsável (opcional) → cria o aluno (`status: ativo`, demais campos vazios) e abre o wizard no Passo 1 já vinculado.
**Atores:** admin/recepção.
**Exceções:** nome duplicado → aviso com opção "continuar mesmo assim" (não bloqueia).
**Dados:** `students` (name, guardianName).

### RF-002 — Passo 1: Cursos e Aulas
**Descrição:** lista de 1–4 cursos (RF-004 do PRD v1.1). Cada curso contém:
- **Curso/Instrumento\*** (select dos instrumentos)
- **Professor\*** (professores ativos; arquivado só se já vinculado)
- **Modalidade\***: aulas por semana (1–3) + duração (usa `settings.lessonDuration` como padrão; permite 30/45/50/60/90)
- **Dia da semana\*** e **Horário\*** (chips dos horários livres do professor/sala via `getFreeSlotsForDay`; botão "Selecionar na agenda" abre a grade)
- **Sala\*** (opcional se aula online) e **Modo\*** (Presencial/Online + link quando online)
- **Primeira aula\*** (default: próxima data válida), **Última aula** OR **Nº de aulas\*** (48/24/12/… — um campo calcula o outro)
**Fluxo:** alterar qualquer campo → valida conflitos do professor e da sala (`checkConflicts`) e feriados do calendário escolar → mostra aviso âmbar (conflito) ou âmbar de feriado ("05/10/2026 é feriado: X — a aula será criada mesmo assim?").
**Exceções:** conflito → permite "Marcar/Pular" como no fluxo atual de lote; feriado → confirma.
**Dados:** `student_enrollments` + ocorrências de `lessons` (prévia).

### RF-003 — Passo 2: Financeiro
**Descrição:** painel esquerdo com **valor da parcela em destaque**, Plano de pagamento* (`schoolPlans` ativos; opção "Livre/Manual"), Forma de pagamento (opcional), Nº de parcelas* (deriva de `duracaoMeses` do plano, editável), Data da 1ª parcela*, Dia de vencimento* (`diasLimite` do plano ou padrão da escola), Desconto, Taxa de matrícula (do plano), Observação.
**Painel direito — Resumo cursos e aulas:** um cartão por curso (curso + professor + primeira aula) e **grade mês a mês** com as datas das aulas (verde) e o valor da parcela do mês; botão **"Alterar Datas"** (reabre o cálculo de primeira/última aula sem perder valores).
**Exceções:** plano sem `duracaoMeses` → nº parcelas livre; desconto não pode exceder o valor da parcela.
**Dados:** `schoolPlans`, `payment_dues` (prévia; criação opcional no concluir).

### RF-004 — Passo 3: Dados Pessoais
**Descrição:** PF/PJ (usa `personType` + campos fiscais), Nome*, CPF (validação atual), RG, Data de Nascimento* (menor → bloco de responsável obrigatório), E-mail, Telefone/WhatsApp*, Outros telefones, Endereço, Responsável (nome/telefone/e-mail) com o mesmo toggle atual.
**Exceções:** CPF/e-mail já cadastrados → aviso com link para o aluno existente; menor sem responsável → bloqueia o avanço.

### RF-005 — Passo 4: Resumo e Conclusão
**Descrição:** resumo completo (aluno, cursos, aulas previstas, financeiro, acesso ao portal). Botão **"Concluir matrícula"** executa, nesta ordem: `students.create/update` → `students.syncCourses` → `lessons.createBatch` → geração de faturas (se "gerar agora" marcado) → convite do portal (se marcado). Barra de progresso por etapa; em falha, informa o que já foi criado e o que faltou (nada é "meio-criado" sem aviso).
**Exceções:** conflito de última hora em aula/fatura → concluir abre a tela de conflitos (já existente) antes de finalizar.

### RF-006 — Edição com o mesmo wizard
**Descrição:** `/alunos/:id/editar` abre o wizard preenchido; cada passo salva apenas o que mudou (reuso de `students.update`/`syncCourses`); permitir sair a qualquer momento (botão "Salvar e sair" no passo 3/4).

### RF-007 — Rascunho local
**Descrição:** enquanto não concluir, o wizard guarda o estado em `sessionStorage` (por usuário) para não perder o preenchimento ao navegar; "Descartar rascunho" limpa.

---

## 5. Regras de Negócio

### RN-001 — Curso 1 é o principal
O primeiro curso define `students.instrumentId` e `students.professorId` (dono do aluno), como hoje no `syncCourses`.

### RN-002 — Uma aula recorrente por curso
Cada curso gera ocorrências com a modalidade escolhida (aulas/semana), dia, horário, sala e modo; a prévia mostra exatamente o que será criado (com feriados descontados apenas se o usuário aceitar pular).

### RN-003 — Última aula × Nº de aulas
Informar um calcula o outro (máximo 200 ocorrências, como o fluxo atual). Última aula nunca anterior à primeira; nº de aulas > 0.

### RN-004 — Conflitos
Professor ou sala já ocupados no horário → aviso âmbar por ocorrência, com "Pular" ou "Ajustar" (nove repetição do fluxo `checkConflicts`/`createBatch`). Nunca criar em cima de outro compromisso sem confirmação.

### RN-005 — Feriados e recessos
Datas do Calendário Escolar aparecem marcadas na prévia; ao gerar, o sistema oferece pular (padrão) ou manter (exceção justificada em observação).

### RN-006 — Financeiro do plano
Plano com `duracaoMeses` define nº de parcelas; `taxaInscricao` vira fatura separada quando > 0; desconto por parcela (valor fixo); `diasLimite` do plano define o dia de vencimento sugerido (com `postergarDiaUtil` respeitado pelo motor financeiro).

### RN-007 — Geração de faturas é opcional e explícita
O wizard NÃO cria faturas sem a marcação "Gerar faturas agora" (padrão: marcado quando há plano/valor). Nunca duplicar fatura do mesmo aluno/mês (dedupe do motor atual).

### RN-008 — Menor de idade exige responsável
Data de nascimento < 18 anos → nome + telefone do responsável obrigatórios (regra existente mantida).

### RN-009 — Permissões
Admin: tudo. Professor com `alunos_editar`: cria/edita. Sem `alunos_mensalidade`: Passo 2 fica somente leitura (valores ocultos) e faturas não entram no concluir. Aluno: sem acesso.

### RN-010 — Planos da escola respeitam o catálogo
Só planos `ativo` da própria organização aparecem; o valor da parcela pode ser sobrescrito manualmente (ficando registrado como "manual").

### RN-011 — Matrícula expressa fica "incompleta"
Aluno criado pela Matrícula Expressa recebe selo "cadastro incompleto" na lista até completar os passos 1–3 (completar cria cursos/financeiro).

---

## 6. Fluxos

### Fluxo principal (matrícula completa)
```text
Recepção → Alunos → "Novo aluno"
↓
Passo 1: cursos, professor, modalidade, dia/horário/sala, primeira/última aula
↓ (valida conflitos + feriados ao vivo)
Passo 2: plano, valor da parcela, parcelas, vencimento, desconto, taxa
↓ (prévia mês a mês de aulas + parcelas)
Passo 3: dados do aluno + responsável (obrigatório se menor)
↓
Passo 4: resumo → Concluir matrícula
↓
Aluno criado + cursos + aulas agendadas + faturas (se marcado) + convite do portal (se marcado)
```

### Fluxos alternativos
- **Matrícula Expressa:** Nome + Responsável → cria aluno → abre Passo 1.
- **Edição:** `/alunos/:id/editar` → wizard preenchido → salvar por passo.
- **Voltar/Continuar:** navegação livre entre passos concluídos; passos futuros exigem os obrigatórios.

### Fluxo de erro
- Falha ao criar aluno → nada mais é criado; toast claro e rascunho preservado.
- Falha no meio (aulas/faturas) → tela "Parcialmente concluído" com ações "tentar novamente" e "continuar sem".
- Sessão expirada → rascunho preservado e aviso para entrar novamente.

### Fluxo sem dados / permissão negada
- Sem instrumentos/professores/salas cadastrados → passo 1 mostra estado vazio com atalho "Cadastrar instrumento/sala".
- Professor sem `alunos_editar` → botão "Novo aluno" oculto (já ocorre) e rota protegida no servidor (corrigido na auditoria).

---

## 7. Casos Extremos
- Nome duplicado na Matrícula Expressa (permitir, mas avisar).
- Dois cursos com o mesmo instrumento (bloquear — regra atual).
- Professor arquivado vinculado a matrícula existente (permitir manter; bloquear novo).
- Sala lotada em uma ocorrência e livre em outra (pular só as conflitantes).
- Feriado no meio do período (pular por padrão).
- Última aula antes da primeira / nº de aulas 0 → bloquear.
- Virada de mês/ano na grade de parcelas (parcela cai no próximo dia útil conforme regra do plano).
- Data da 1ª parcela retroativa (permitir, mas marcar em vermelho na prévia).
- Desconto maior que a parcela → bloquear.
- Plano inativado entre o passo 2 e o concluir → recalcular com aviso.
- Aluno já com fatura no mês previsto → dedupe (não duplicar).
- Aba fechada/recarregada → rascunho restaura (RN-007/RF-007).
- Duplo clique em "Concluir" → idempotente (botão desabilita; servidor deduplica).
- PJ sem CPF (usa `fiscalCpfCnpj` do CNPJ).
- Mais de 4 cursos → bloquear (limite atual).

---

## 8. Dados Envolvidos
| Entidade | Uso no wizard | Observação |
|---|---|---|
| `students` | criação/edição (dados pessoais, fiscal, contatos, responsável) | sem mudanças de schema (exceto §16 Q1/Q2) |
| `student_enrollments` | 1 por curso (instrumento, professor, aulas/semana, dia, hora, sala, duração/período) | campos já existem (`lessonsPerWeek`, `weekday`, `timeStr`, `studioRoomId`, `startDate`, `endDate`, `durationMonths`) |
| `lessons` | ocorrências futuras geradas no concluir | reuso `createBatch` |
| `school_plans` | planos do passo 2 | já existente |
| `payment_dues` | prévia + geração opcional | reuso do motor atual |
| `school_holidays` | marcação na prévia | já existente |
| `contracts` | pós-conclusão (fora do escopo) | — |
| `sessionStorage` | rascunho | chave por usuário |

Índices: nenhum novo obrigatório (a auditoria já adicionou `contracts(studentId)`).

---

## 9. Permissões e Segurança
| Ação | Admin | Professor c/ `alunos_editar` | Professor sem | Aluno |
|---|---|---|---|---|
| Abrir wizard | ✅ | ✅ | ❌ | ❌ |
| Passo 1 (cursos/aulas) | ✅ | ✅ | ❌ | ❌ |
| Passo 2 (financeiro) | ✅ | ✅ (sem `alunos_mensalidade` = somente leitura) | ❌ | ❌ |
| Passo 3/4 e concluir | ✅ | ✅ | ❌ | ❌ |
- Validações no servidor (auditoria recente): `alunos_editar` em `students.update/syncCourses`; limites de plano; professor arquivado; isolamento por organização.
- Nenhum segredo financeiro é devolvido ao client.

---

## 10. Tratamento de Erros
- **Esperado:** mensagens por campo (CPF, e-mail duplicado, conflito, feriado, desconto inválido) com foco no primeiro erro; nunca perder o preenchimento.
- **Interno:** "Não foi possível concluir a matrícula. Tente novamente." + detalhes só nos logs; estado parcial sempre informado ao usuário.
- **Rede/timeout:** retry por etapa; botão desabilitado durante operações.

---

## 11. Requisitos Não Funcionais
- **RNF-001 Performance:** prévia de aulas/parcelas deve responder em < 500 ms (cálculo local + uma chamada de conflitos debounced).
- **RNF-002 Responsividade:** wizard 100% usável no celular (passos em coluna única; resumo vira seção colapsável; botões fixos no rodapé).
- **RNF-003 Dark mode:** usa tokens do design system (nada de cores fixas).
- **RNF-004 Acessibilidade:** foco visível, labels/aria nos campos e stepper navegável por teclado.
- **RNF-005 Persistência:** rascunho local sobrevive a refresh; expira em 24h.
- **RNF-006 Compatibilidade:** mesma cobertura de testes (586+) sem regressões; novos testes para cálculo de datas/valores.

---

## 12. Critérios de Aceite
### CA-001 — Matrícula Expressa
**Dado** que estou na lista de Alunos, **quando** uso "Matrícula rápida" com nome + responsável, **então** o aluno é criado e o wizard abre no Passo 1, com selo "cadastro incompleto" na lista.

### CA-002 — Conflito em tempo real
**Dado** o professor "Adrian" ocupado às terças 18:00, **quando** escolho esse horário, **então** vejo aviso âmbar com opção de pular/ajustar antes de continuar.

### CA-003 — Feriado
**Dado** 12/10/2026 marcado como feriado no Calendário, **quando** a prévia cruzar essa data, **então** a data aparece marcada e o sistema pergunta se deve pular (padrão pular).

### CA-004 — Prévia financeira
**Dado** o plano "Semestral 6x R$ 140", **quando** abro o Passo 2, **então** o valor da parcela em destaque é R$ 140,00 e a grade mostra 6 parcelas com as datas das aulas de cada mês.

### CA-005 — Alterar Datas
**Dado** a prévia atual, **quando** clico em "Alterar Datas" e mudo a primeira aula, **então** aulas e parcelas recalculam juntas, mantendo valores.

### CA-006 — Conclusão transacional
**Dado** que preenchi tudo, **quando** concluo, **então** aluno + cursos + aulas + faturas (se marcado) são criados e vejo o resumo final com link para o aluno.

### CA-007 — Falha parcial
**Dado** falha ao gerar faturas, **então** aluno/cursos/aulas continuam criados e recebo aviso do que faltou, com "tentar novamente".

### CA-008 — Menor sem responsável
**Dado** nascimento há menos de 18 anos, **quando** avanço sem responsável, **então** o passo 3 bloqueia com mensagem clara.

### CA-009 — Permissões
**Dado** professor sem `alunos_mensalidade`, **então** o Passo 2 é somente leitura (valores ocultos) e faturas não são geradas.

### CA-010 — Rascunho
**Dado** preenchimento parcial, **quando** atualizo a página, **então** os dados são restaurados e posso continuar.

### CA-011 — Edição
**Dado** um aluno existente, **quando** abro editar, **então** o wizard vem preenchido e salvar altera apenas o que mudou (sem duplicar cursos/aulas).

### CA-012 — Não regressão
**Quando** o wizard entra em produção, **então** a suíte continua verde e o fluxo antigo de agendamento em lote segue funcionando para turmas.

---

## 13. Riscos e Dependências
**Riscos**
- Cálculo de datas/parcelas divergir do Financeiro → mitigar reutilizando o mesmo motor e cobrindo com testes.
- Muitas chamadas de `checkConflicts` na digitação → debounce + chamada por curso, não por tecla.
- Mudança grande de UI → liberar por trás de rota nova e manter `/alunos/novo` redirecionando com aviso "novo cadastro" (1 release).

**Dependências**
- `students.create/update/syncCourses`, `lessons.checkConflicts/createBatch`, `schoolPlans.list`, geração de `payment_dues`, `schoolHolidays.list`, `getFreeSlotsForDay`.
- Permissões corrigidas na auditoria (já em produção).

---

## 14. Métricas de Sucesso
- Tempo médio de cadastro completo < 3 min (meta vs. atual).
- % de matrículas com aulas já agendadas no ato (meta: > 90%).
- Redução de retrabalho: faturas geradas no cadastro vs. ajustes manuais no Financeiro.
- Uso da Matrícula Expressa como porta de entrada (> 30% dos novos cadastros).

---

## 15. Plano de Implementação Sugerido
### Fase 1 — Estrutura
1. Criar `client/src/pages/aluno-cadastro/` com `WizardProvider` (estado, rascunho, navegação) e stepper visual.
2. Migrar os campos atuais de `NovoAluno.tsx` para os componentes de passo (`StepCursos`, `StepFinanceiro`, `StepDados`, `StepResumo`), mantendo validações.
### Fase 2 — Passo 1 e 2 (maior valor)
3. `StepCursos`: multi-cursos + chips de horários (`getFreeSlotsForDay`) + `checkConflicts` debounced + feriados.
4. `StepFinanceiro`: planos + cálculo de parcelas + grade prévia + "Alterar Datas".
### Fase 3 — Conclusão e Expressa
5. `StepResumo` com execução encadeada e tratamento de falha parcial; geração opcional de faturas.
6. Matrícula Expressa na lista + selo "cadastro incompleto".
7. Edição pelo mesmo wizard; remover `StudentModal.tsx` morto.
### Fase 4 — Testes e Deploy
8. Testes: cálculo data↔nº aulas, parcelas/desconto/taxa, conflito, feriado, permissões, rascunho, falha parcial.
9. `pnpm check && pnpm test && pnpm build`; release em `shared/releases.ts`; deploy.

---

## 16. Perguntas objetivas (precisam de resposta antes da Fase 1)

1. **"Pronome"** (Ela/Ele/Outros) e **"País de Origem** existem no Emusys, mas não temos esses campos. Criamos os campos no cadastro do aluno (2 colunas novas) ou deixamos fora desta versão?
2. **Forma de pagamento** no Passo 2: só registramos por fatura (Pix/Boleto/Cartão/Dinheiro, como já é hoje) ou o wizard precisa criar cobrança no gateway no ato (Asaas/Mercado Pago/InfinitePay)?
3. **Gerar faturas no concluir**: padrão ligado sempre que houver plano/valor, ou opt-in manual a cada cadastro?
4. **Matrícula Expressa** entra já nesta versão (Recomendo sim) e pode ser usada também por professor com `alunos_editar` (e não apenas admin)?
5. **Turmas**: o wizard cobre aula individual/online. Cadastro de turma continua no fluxo atual ou também deve ganhar um passo próprio numa próxima versão?

---

# REVISÃO 1.1 — 01/10/2026 (decisão do solicitante)

**Escopo reduzido e fechado:** o objetivo é APENAS **reorganizar o fluxo do cadastro atual em passos + resumo final**, no espírito do Emusys.

### Decisões
1. **NÃO criar campos novos** (Pronome, País de Origem e quaisquer outros ficam de fora).
2. **NÃO renomear** campos, labels, valores de selects nem procedimentos existentes.
3. **NÃO adicionar funcionalidades** (sem Matrícula Expressa, sem cobrança no gateway no ato, sem geração de faturas nova — o comportamento de salvar continua o mesmo de hoje).
4. O que muda é só a **navegação visual**: stepper com 4 passos agrupando os blocos que JÁ existem, botões Voltar/Continuar e um **Passo 4 — Resumo** (somente leitura) com o botão de salvar (o `handleSave` atual).

### Mapeamento dos blocos atuais → passos (sem alterar conteúdo)
| Passo | Conteúdo atual reaproveitado |
|---|---|
| 1 — Cursos e Aulas | Card "Acadêmico" (Instrumento, Nível, Professor, Sala, Data de Início, Tipo de Aula + link online) + seção "Cursos do aluno" + seção de **agendamento de aulas** já existente (slots semanais + preview) |
| 2 — Financeiro | Card "Planos & Bolsas" (cadastro) + campos **Valor/Mensalidade, Periodicidade de Cobrança e Vencimento (Dia)** movidos do card Acadêmico para um card próprio (mesmos inputs/handlers) |
| 3 — Dados Pessoais | Cards "Dados Pessoais" + "Contato" (+ endereço/fiscal já existentes) |
| 4 — Resumo | Somente leitura: cursos + professores, agenda (slots/aulas que serão criadas, reaproveitando o painel "Aulas agendadas"), financeiro (plano, mensalidade, periodicidade, vencimento), dados do aluno e responsável; botão **Concluir** = `handleSave` atual |

### Critérios de aceite (revisados)
- **CA-101:** o formulário continua com exatamente os mesmos campos/valores de hoje (nenhum campo novo, nenhum renomeado).
- **CA-102:** Voltar/Continuar navegam entre os 4 passos; o stepper mostra o passo atual (1–4) como no Emusys.
- **CA-103:** o Passo 4 mostra o resumo do que foi preenchido (incluindo as aulas previstas quando houver agendamento) e salva com o botão atual.
- **CA-104:** nenhuma mutation/validação/fluxo de salvamento foi alterado; edição (`/alunos/:id/editar`) funciona igual.
- **CA-105:** suíte de testes continua verde (586+).
