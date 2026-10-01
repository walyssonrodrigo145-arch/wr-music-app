# Análise: Emusys × MusicPro

Documento gerado durante a migração da escola **Espaço Musical Edu Oliveira**
(8 anos de dados, setembro/2026). Base: uso real do sistema Emusys (extração completa
de alunos, financeiro, agenda, contratos e folha de professores) + documentação oficial
do Emusys + inspeção do schema/código do MusicPro.

---

## 1. O que o Emusys tem que vale trazer para o MusicPro

### 1.1 Presença por QR Code / biometria + app do professor
O Emusys registra presença por **QR Code na sala**, leitor biométrico ou app do professor.
No MusicPro já existe confirmação do aluno pelo portal e o professor marca status na aula,
mas **não há registro rápido de presença em 1 clique** (QR fixo por sala/escola ou botão
"cheguei" no portal do professor). É o item de maior valor operacional diário.
**Proposta:** QR Code dinâmico por escola (e opcional por sala) + tela "Registrar presença"
no portal do professor com validação de janela de horário.

### 1.2 Disponibilidade de professores (grade) e reservas de tempo
O Emusys tem grade semanal de disponibilidade por professor (blocos arrastáveis) usada para
matrículas/turmas, e "reserva de tempo" (médico, ensaio, reunião).
O MusicPro tem horários da escola e `slotOffers`, mas **não a grade de disponibilidade**
nem bloqueios pessoais do professor.
**Proposta:** CRUD de disponibilidade por professor (blocos por dia) + bloqueios pontuais;
usar no AgendarModal para filtrar horários livres.

### 1.3 Créditos de horas (pacotes de sala/treino) para alunos e professores
No Emusys dá para vender/como cortesia "pacotes de horas" que o aluno/professor usa para
reservar sala de treino; gera fatura se cobrado.
MusicPro não tem esse conceito.
**Proposta:** saldo de horas por usuário + reserva de sala consumindo saldo + cobrança
opcional (reusa paymentDues).

### 1.4 Conciliação bancária + Caixa/Tesouraria
Emusys tem fechamento de caixa, cofre (tesouraria), conciliação de extratos e repasses de
cartão. O MusicPro cobra via Asaas/MP/InfinitePay e mostra relatórios, mas **não concilia**
nem tem caixa/cofre.
**Proposta:** importar extrato (OFX/CSV) e casar com `payment_dues`/`expenses`; caixa diário
com fechamento (útil para escolas com pagamento em dinheiro).

### 1.5 Métricas de retenção (evasão e permanência)
Emusys: gráfico de taxa de evasão, tempo médio de permanência, métricas do CRM e por
professor. MusicPro tem relatórios financeiros/pedagógicos fortes, mas não essas visões.
**Proposta:** painel simples: coorte de entrada × saída (usa `students.startDate`,
`deletedAt`/`exitReason` do Histórico — já temos os campos!).

### 1.6 CRM com fila de espera, tarefas e links públicos
Emusys: funil com estágios, fila de espera, tarefas por lead, aulas experimentais (individual
e turma), links de auto-cadastro/agendamento. MusicPro já tem `crmLeads` e link de
auto-matrícula; faltam **fila de espera** e **tarefas/lembretes do funil**.
**Proposta:** status "fila_espera" + tarefas (data/hora/responsável) no CRM.

### 1.7 Comunicação em massa (comunicados/e-mails)
Emusys: comunicados push para app e e-mails com modelos. MusicPro tem base de campanhas
(`campaigns`) e notificações FCM.
**Proposta:** transformar "Comunicados" em campanha simples reusando a infra de campanhas.

### 1.8 Regras comerciais de cobrança
Emusys: desconto p/ pagamento antecipado ("desconto condicional"), recebimento no mês,
"cortesia", multas de 4% + juros no contrato-modelo.
MusicPro já tem juros/multa no BillingEngine e planos/bolsas; **desconto antecipado**
configurável é o que falta.
**Proposta:** campo de desconto por antecipação no BillingEngine.

### O que o MusicPro JÁ tem e o Emusys não (não regredir)
Portal do aluno/professor com metas, plano diário, repertório e memória pedagógica;
gamificação/rankings; NF-e; integrações de pagamento modernas (Asaas/MP/InfinitePay);
app PWA; histórico de alunos arquivados com motivo de saída e winback por WhatsApp.

---

## 2. Pagamento de professores: como o Emusys faz e o que melhorar no nosso

### 2.1 Modelo do Emusys (verificado na conta real + manual)
- Valor definido **por curso** e **por duração da aula** (ex.: 50min ≠ 60min), por professor;
- Tabela de **aula experimental** por duração, com exceções por professor;
- **Hora avulsa** (aula extra) com valor próprio por professor;
- Página "Pagamento por Aluno": **Total de Créditos de Aulas + lançamentos avulsos
  (créditos/débitos) − pagamentos/adiantamentos = Resultado a pagar**, com histórico datado;
- **Extrato com memória de cálculo** (faltas, reagendamentos, substituições, feriados e
  recessos, meses com 5 semanas) que o **professor aprova pelo app**;
- Configurações gerais numeradas (ex.: **#188 "Paga feriados e/ou recessos"**);
- **Créditos de horas** de professor para uso de sala (com ou sem cobrança);
- Avaliações de alunos (a cada 5 aulas) e comunicados.

Exemplo real da folha de agosto/2026 do cliente: Adrian 15h → R$ 480,00;
Eduardo 80h → R$ 180,00; Nathan 15h → R$ 345,00; Paulo 80h → R$ 330,00 (total R$ 1.335,00).
Os valores não são "hora × tarifa" — são somas de créditos por curso/regra, o que confirma a
necessidade de regras por curso/duração.

### 2.2 O que o MusicPro já tem (e é mais estruturado)
- `teacher_payment_rules` **versionadas** (por_aula, percentual, fixo_mensal, híbrido;
  base bruto/recebido/líquido/manual; fechamento semanal/quinzenal/mensal);
- `teacher_payment_rule_conditions` por situação (aula realizada, reposição, experimental,
  gratuita, extra, avulsa, falta aluno/professor, cancelamento aluno/escola) com ações
  (remunerar, não remunerar, parcial, descontar, valor diferente, gerar reposição);
- `professor_payments` com créditos/débitos, ajustes, **snapshot da regra + memória de cálculo**,
  status aberto/aprovado/pago.

### 2.3 Melhorias sugeridas (inspiradas no Emusys)
1. **Matriz de valores por curso × duração** na regra (hoje "amountPerClass" é único).
   Vira: `teacher_payment_rate_entries (ruleId, instrumentId/curso, duraçãoMin, valor)`.
2. **Toggle de feriado/recesso** explícito na regra (equivalente ao config #188) — hoje
   depende de condição "cancelamento_escola"; tornar semântico e visível.
3. **Aprovação do extrato pelo professor no portal** (o status "aprovado" existe; adicionar
   a ação do professor + notificação + trava de edição pós-aprovação).
4. **Adiantamentos e estornos como lançamentos tipados** (hoje `adjustments` é JSON solto;
   criar `professor_payment_entries` com tipo pagamento/adiantamento/estorno/crédito/débito,
   data, conta e histórico — como a aba Pagamento por Aluno do Emusys).
5. **Extrato detalhado visível ao professor** (dias/aulas com status e valor), reaproveitando
   o `calculationMemory` que já é salvo.
6. **Hora avulsa e experimental por duração**, configuráveis por professor.
7. **Créditos de horas de professor** (liga com o item 1.3) para reserva de salas.
8. **Relatório "Horas × Aulas dadas no mês" por professor** (o Emusys imprime isso da aba
   Aulas Dadas; útil para conferência do professor).

---

## 3. Observações da migração (para repetir em outros clientes)
- O financeiro do Emusys permite **várias faturas no mesmo mês** por aluno (2 cursos);
  bancos antigos do MusicPro têm o índice `uniq_payment_dues_org_student_month` que impede
  isso — remover antes de importar (o código já tem fallback para a ausência).
- Valores exportados pelo Emusys usam **ponto decimal** ("130.00"); linhas de TOTAL usam
  formato BR ("1.234,56") — o parser do kit trata os dois.
- A agenda completa sai do relatório de aulas (PDF por matrícula) — 18 mil aulas extraídas
  com 0 divergências para o cliente de referência; aulas passadas entram como `concluida`,
  futuras como `agendada` e as faltas recentes são casadas com o relatório de "Aulas Não
  Efetivadas".
- Kit reutilizável: `migracao-emusys/` (login 2FA, extrações, consolidação, importação
  transacional, arquivamento e financeiro 1:1).
