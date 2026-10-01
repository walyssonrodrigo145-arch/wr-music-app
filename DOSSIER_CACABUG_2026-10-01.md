# 🕵️‍♂️ Relatório de Caça aos Bugs — MusicPro

**Data/Hora:** 01/10/2026 (auditoria completa em 4 frentes: Admin principal, Admin config/negócio, Professor+Aluno, Módulos recém-alterados)
**Módulos varridos:** 100% das rotas do `App.tsx`, sidebar (admin/professor/aluno), Dashboard, Alunos (+modais), Aulas/Agenda, Financeiro (Mensalidades/Despesas/Folha), Relatórios, Configurações (todas as abas + Calendário Escolar), Professores, Contratos, Leads/CRM, Comunicados, Reposições, Salas, Portal do Aluno (todas as páginas), QR/check-in.
**Método:** leitura estática integral + verificação de contratos tRPC/Zod front×back + `pnpm check` (exit 0) + `pnpm test` (**52 arquivos / 588 testes passando**).
**Status Geral:** 🚨 **3 CRÍTICOS, 16 ALTOS, 18 MÉDIOS, 13 BAIXOS** (inclui 1 falha total e 3 parciais nos critérios de aceite do PRD v1.1)

> Observação: a última entrega (cursos do aluno + conclusão + responsável no financeiro + painel de inadimplentes) **já está em produção**. Esta auditoria roda sobre esse estado; as correções abaixo serão uma nova leva.

---

## 🚨 1. Bugs Críticos (impacto direto / quebra de fluxo ou segurança)

### C-1 — Folha de Pagamento sem controle de papel
- **Tela:** `client/src/pages/ProfessorExtract.tsx` / rota `/folha` (`App.tsx:274`)
- **Descrição:** professor com a permissão `/folha` liberada dispara recálculo da folha **da escola inteira** ao abrir a página e vê pagamentos de todos os colegas. Via API, qualquer autenticado (inclusive aluno) pode `list/calculateAll/approve/markPaid/createManual`.
- **Causa raiz:** `ProfessorExtract.tsx:88-96` (efeito sem `isAdmin`); `financeiroRouters.ts:2325-2364` e `:2399-2582` (procedures `protectedProcedure` sem papel).
- **Correção:** `adminProcedure` nas mutações; `list/getDetails` filtrando pelo professor logado quando não-admin; guard no cliente.

### C-2 — Leads/CRM: 8 botões mudos (nada é persistido)
- **Tela:** `client/src/pages/leads/LeadsApp.tsx`
- **Descrição:** "Concluir" follow-up (`:711`), "Gerar Proposta" (`:732`), "Reenviar Contrato" (`:760`), "Boas-Vindas" (`:953`), "Responder no WhatsApp" (`:989`), "Salvar Config." (`:1096`) e os submits dos modais Novo Follow-up (`:1417`) e Ajustar Metas (`:1473`) só exibem `toast.success`. As procedures **existem** (`crm.createFollowUp:584`, `crm.saveGoal:362`, `crm.getGoals:334`) e não são chamadas. Agendar experimental (`:1294`) descarta data/hora. Em banco vazio, a UI usa **dados fictícios** (`SAMPLE_LEADS`, `:34-42`).
- **Correção:** ligar cada ação à procedure (ou remover), remover sample em produção, persistir data/hora da experimental.

### C-3 — Credenciais expostas a qualquer autenticado
- **Tela/API:** `fiscal.company.get`, `settings.get`
- **Descrição:** `fiscal.company.get` devolve `focusApiKey` em claro para qualquer autenticado (`fiscalRouter.ts:20-34`; schema `drizzle/schema.ts:2058`). `settings.get` devolve segredos descriptografados e, com token vazio, injeta `process.env.EVOLUTION_API_KEY` (`db.ts:1949-1981`; `plataformaRouters.ts:96`).
- **Correção:** `adminProcedure` + mascarar chaves (`hasApiKey: boolean`); nunca devolver secrets em payload.

---

## ⚠️ 2. Bugs Altos

### A-1 — IDOR em `lessons.list({ studentId })`
`lessonsRouters.ts:342-379`: o filtro só usa `organizationId + studentId`. Professor (ou aluno autenticado) lê aulas, notas e telefones de alunos alheios enumerando IDs. **Correção:** aplicar o mesmo guard de `getById` (`:319-322`) e bloquear `role === "aluno"`.

### A-2 — `students.create` aberto a qualquer autenticado
`studentsRouters.ts:581-650`: professor sem `alunos_editar` e até **aluno** podem criar cadastros. **Correção:** `professorProcedure` + `alunos_editar` (padrão `assertCanImportStudents`).

### A-3 — Procedures administrativas só `protectedProcedure` (professor altera a escola)
`plataformaRouters.ts:184` (`settings.updateSchool` — nome/CNPJ/logo/horários), `:604/:640` (Asaas/financeiro), `:267` (IA); `contratosRouters.ts:600/713/756` (Assinafy); `schoolPlansRouters.ts:77/101/129` (preços/planos); `studioRoomsRouter.ts:230/272/317` (apagar salas); `fiscalRouter.ts:116/148/180`; `avaliacoesRouters.ts:109/131/145/242`. **Correção:** migrar para `adminProcedure`.

### A-4 — `alunos_editar` não é validado no servidor (CA-015 FALHA)
`studentsRouters.ts:798 (update) / :1075 (updateStatus) / :1144 (archive) / :983 (syncCourses)`: só checa dono/org. Professor sem a permissão salva via rota direta `/alunos/:id/editar`. No cliente, `Alunos.tsx:630-634` (card mobile) mostra `StatusBadge` sem `canEdit`, e `StudentDetailsModal.tsx:187-228` mostra mensalidade/editar/excluir sem guards. **Correção:** `assertCanEditStudentData` no server + guards no mobile/modal.

### A-5 — Arquivar professor não bloqueia login
`reportsRouters.ts:665-681` grava `archivedAt`, mas o login (`authRouters.ts:426-486`) e o `requireUser` (`_core/trpc.ts:14-57`) não checam. Professor arquivado continua entrando. **Correção:** validar `professores.archivedAt` no login/contexto.

### A-6 — Excluir professor não reatribui folha/aulas
`reportsRouters.ts:651-659`: só reatribui alunos/reminders/settings; `professorPayments` e `lessons.userId` ficam órfãos (pagamentos somem dos JOINs). O confirm promete reatribuição total (`Professores.tsx:658`). **Correção:** reatribuir/arquivar folha e aulas antes do delete; alinhar texto.

### A-7 — Módulo Fiscal inacessível
`NotasFiscais` importada sem `<Route>` (`App.tsx:58`); aba `fiscal` existe no render mas não em `TABS` (`Configuracoes.tsx:47-62` vs `:1161`); links "Configurar Fiscal"/"Completar Cadastro" caem em "Perfil" (`NotasFiscais.tsx:281/311`); notificação aponta para rota inexistente (`FiscalService.ts:362`). Idem aba `salas` (`:2666` inalcançável). **Correção:** registrar rota + aba (ou deep-link `?tab=fiscal`) e corrigir links.

### A-8 — Conclusão por contrato não implementada (CA-004/RN-001/RN-007 FALHA)
`db.ts:1793-1836` só consulta `student_enrollments`. Aluno sem matrícula e com contrato assinado com `endDate` **não** mostra "Conclui em"; falta o fallback "Contrato · Conclui em" e índice `contracts(studentId)` (`schema.ts:875-899`). O release afirma que a data vem de contrato — hoje incorreto. **Correção:** agregar `MAX(contracts.endDate)` com status válidos + linha sintética de contrato + índice.

### A-9 — Curso 1 dessincronizado e ordem não determinística (risco de trocar instrumentos)
`StudentModal.tsx:271-278/175-195` e `NovoAluno.tsx:825-853/1726`: trocar instrumento/professor principal **não** liga `coursesDirty` (sync não roda) e, quando roda, `primary?.teacherUserId` (antigo) vence o novo. Sem `ORDER BY` nas queries de cursos (`studentsRouters.ts:60-79`, `db.ts:1798-1818`), a UI pode remapear instrumentos entre matrículas (passa na validação e troca Canto↔Guitarra). **Correção:** curso 1 = `instrumentId === students.instrumentId`; `orderBy(enrollments.id)`; sincronizar dentro do `students.update` (1 transação).

### A-10 — Portal do Aluno: Avisos sem conteúdo
`student/Avisos.tsx:111-114` exibe texto fixo; o `content` real chega (`portalRouters.ts:356-363`) e é ignorado. **Correção:** renderizar `aviso.content`.

### A-11 — Aluno pode gerar token de presença (fraude de check-in)
`attendance.generateToken` é `protectedProcedure` (`lessonsRouters.ts:2182-2216`): qualquer aluno gera QR válido (100 anos) e se marca presente. **Correção:** `professorProcedure`/`adminProcedure` no gerador; token de recepção.

### A-12 — Permissões do portal cosméticas (acesso por URL direta)
`getPayments/getLessons/getMaterials/getExercises/getProgress/getFileUrl` não checam `canSee*` (`portalRouters.ts:379/439/516/526/547`); aluno com `canSeeFinanceiro:false` vê faturas em `/aluno/pagamentos`. **Correção:** helper central de permissão no server.

### A-13 — `getTeacherSchedule` IDOR (agenda/telefone)
`portalRouters.ts:984-993` busca a aula só por `id + organizationId`; aluno obtém agenda/telefone do professor de aula alheia. **Correção:** incluir `lessons.studentId = studentId`.

### A-14 — Agenda mobile: filtro de professor nunca casa
`MobileAgenda.tsx:486` usa `p.id` (professores.id) enquanto o backend devolve `teacherId = userId` (`db.ts:1902`). Escolher professor zera a lista. **Correção:** usar `p.userId` (desktop já usa, `Aulas.tsx:454`).

### A-15 — Agendamento rápido desktop ignora dia/horário clicado
`Aulas.tsx:930` passa `selectedDate || currentDate` (estado mobile), e o clique no dia/slot só mexe em `currentDate` (`:577/:900`). Aula pode nascer no dia errado. **Correção:** `initialDate={currentDate}` + propagar `initialTime` do slot.

### A-16 — Mensalidades: ações de Mercado Pago erradas
`MensalidadesTab.tsx:1211-1248`: com `mpPaymentId`, o dropdown cai no ramo Asaas — "Copiar Link Asaas" mudo e "Cancelar no Asaas" chama a API errada; no mobile (`:1386-1393`) aparece "Gerar Link" (risco de cobrança duplicada). **Correção:** branch explícito para MP (copiar/cancelar) como no `PaymentDueDetailPanel.tsx:113-115` + `isGatewayEnabled` no mobile.

### A-17 — `reschedule.respond/delete` e `extraRequests.delete` sem vínculo
`lessonsRouters.ts:2460-2473/2553-2559`: qualquer autenticado aprova/recusa/exclui solicitações alheias. **Correção:** replicar o check de dono/professor de `extraRequests.respond` (`:2524-2531`).

### A-18 — Professor co-instrutor (multi-cursos) não vê aluno nem aulas
`db.ts:1785-1789` (`getStudentsWithInstrument`) e `:1861-1871` (`getRecentLessons`) filtram só `students.professorId`. Quem é `teacherUserId` de uma matrícula (recurso novo de múltiplos cursos) fica de fora. **Correção:** incluir `inArray(students.id, subquery studentEnrollments.teacherUserId = userId)`.

---

## ⚠️ 3. Bugs Médios e Baixos (UX / fallbacks / autorização secundária)

**Médios**
1. `syncCourses` rejeita professor **arquivado já vinculado** → salvar cursos de aluno dele falha (`studentsRouters.ts:1013-1020`).
2. `syncCourses` antes do update + sem unicidade → se o update falhar, cursos já mudaram; corrida pode criar 2 matrículas ativas do mesmo instrumento (M-6 do relatório focado).
3. `overdue` para professor filtra por **criador** da dívida, não pelo dono do aluno (`financeiroRouters.ts:1603-1613`).
4. Alunos.tsx soma inadimplência incluindo arquivados no card "Mensalidades em atraso" (`Alunos.tsx:98/751` — falta `{onlyActive:true}`; Dashboard já usa).
5. Responsável não aparece no painel de detalhe da mensalidade (`getById` sem `guardianName`; `PaymentDueDetailPanel.tsx:133-137`).
6. Card **mobile** de Alunos sem professor/conclusão/cursos (`Alunos.tsx:605-667` vs desktop `:507-538`) — CA-003/010 parciais.
7. "Marcar como Pagas" em lote com sucesso otimista (`MensalidadesTab.tsx:1481-1485`).
8. "WhatsApp" em massa de Alunos é envio falso (`Alunos.tsx:798-809` — abre `wa.me` sem destinatário).
9. Botão "Conversão" (experimental→aluno) beco sem saída (`AgendarModal.tsx:1012-1015`; `/alunos?create=true` ignorado).
10. Excluir aula única sem confirmação (`Aulas.tsx:299-313`).
11. Relatórios: sem loading/erro por bloco e "Conversão 82%" hardcoded (`Relatorios.tsx:168-187/589`).
12. "Gerar para Todos" pode gerar 0 para o admin (filtro `professorId = ctx.user.id`; `financeiroRouters.ts:1139-1148`).
13. Mensalidade com `studentName` nulo some da lista (`MensalidadesTab.tsx:845`).
14. Calendário Escolar: "Adicionar data" cria no ano corrente mesmo visualizando outro ano (`CalendarioEscolar.tsx:122-128`).
15. Toggle "Arquivados" mostra ativos junto (`Professores.tsx:236`).
16. Exportar dados: botões travados quando `refetch` vazio (`ExportDataSection.tsx:16-18`).
17. Comunicados: sem `onError` e lixeira só em hover (invisível no toque) (`Comunicados.tsx:55-68/258`).
18. Regras de Cobrança: "regra padrão da escola" sem UI (nunca `isSchoolDefault:true`) e botão por instrumento cria `instrumentId:0` (`PaymentRulesDialog.tsx:96/272-274/423`).

**Baixos**
1. `StudentModal` é código morto (criar/editar usam as rotas) e tem fluxo latente de credenciais (`Alunos.tsx:58/62/814-821`).
2. Turmas duplicadas/rotuladas no mobile (`MobileAgenda.tsx:395` — usar `title` e agrupar).
3. Query/estado inúteis na Agenda (`Aulas.tsx:81/53/410-412`).
4. Avatar da sidebar colapsada mudo (`AppSidebar.tsx:489-494`).
5. Relatórios: anos fixos 2023–2026 e `bg-purple-50` no dark (`Relatorios.tsx:1139/1153`).
6. `NotFound` nunca renderizado (`App.tsx:35/183-185/290-292`).
7. Admin-only client sem guard de superadmin (`App.tsx:281-283`; backend protege).
8. `printAgenda.ts` ainda sem botão (P0 da agenda pendente — não é bug, é backlog).
9. `syncCourses`: sem `deletedAt`/org no update final, sem refine de ids duplicados (`studentsRouters.ts:1066-1069/1034-1055`).
10. Curso sem data exibe "Em andamento" no modal de detalhe (RN-007 pede linha sem a parte "Conclui em").
11. `guardianName` sem trim (renderiza "Responsável:  ") (`MensalidadesTab.tsx:1091/1297`).
12. NovoAluno reinicializa o form a cada refetch (`getForEdit` com `staleTime:0`) descartando edições não salvas (`NovoAluno.tsx:228-280`).
13. Portal: PIX "copia e cola" pode ser URL (QR não exibido); confirmação de presença não invalida cache; comprovante sem validação de tamanho/tipo; botão de recibo clicável sem arquivo; títulos do header desatualizados; chat aceita destinatário arbitrário; `repositions.my`/`getExerciseDetails` sem fallback de vínculo.

---

## ✅ 4. Checagem do PRD v1.1 (CA/RN)

| Item | Status | Evidência |
|---|---|---|
| CA-001 Responsável exibido | ✅ OK | `MensalidadesTab.tsx:1091/1297`; ressalva: painel de detalhe (Médio 5) |
| CA-002 Sem responsável | ✅ OK | render condicional |
| CA-003 Professor exibido | ⚠️ PARCIAL | desktop OK; card mobile sem professor (`Alunos.tsx:605-667`) |
| CA-004 Conclusão por contrato | ❌ FALHA | A-8 (`db.ts` só matrículas) |
| CA-005 Conclusão por matrícula | ✅ OK | `addMonthsClamped` verificado (clamp de mês correto) |
| CA-006 Sem contrato e sem plano | ✅ OK | `courses: []` → nada renderiza |
| CA-007 Contrato cancelado ignorado | ✅ OK (por omissão) | contratos nem são lidos ainda |
| CA-008 Isolamento por org | ✅ OK | filtros em todas as queries novas |
| CA-009 Não regressão | ✅ OK | `pnpm check` 0 erros; 588 testes verdes (sem testes dos campos novos) |
| CA-010 Conclusão por curso | ⚠️ PARCIAL | desktop/modal OK; mobile sem linhas; risco A-9 (ordem) |
| CA-011 Curso sem data | ✅ OK (ressalva RN-007 no modal) |
| CA-012 Adicionar 2º curso | ✅ OK (risco A-9 de ordem) |
| CA-013 Remover curso | ✅ OK | encerra sem apagar (teste cobre) |
| CA-014 Instrumento repetido | ✅ OK | server + client + teste |
| CA-015 Sem permissão | ❌ FALHA | A-4 (server não valida `alunos_editar`) |

Segurança específica: **não** é possível sequestrar matrícula de outro aluno via `syncCourses` (filtro inclui `studentId`; id alheio vira insert do aluno correto) — ressalvas Baixo 9.

---

## 📊 5. Resumo de Cobertura

| Módulo | Rotas | Botões | Modais | Backend tRPC | Status |
|---|---|---|---|---|---|
| Dashboard admin | OK | OK | OK | OK | ✅ aprovado (painel Inadimplentes corrigido) |
| Alunos (lista/modais/rotas) | OK | 2 achados | StudentModal morto | `students.*` OK (payloads batem) | ⚠️ A-4, M-4, M-6, mobile M-6 |
| Aulas/Agenda | OK | A-14, A-15, M-10 | OK | `lessons.*` com IDOR A-1/A-17, co-instrutor A-18 | ⚠️ |
| Financeiro/Mensalidades | OK | A-16, M-7 | OK (detalhe sem responsável M-5) | `paymentDues.*` OK; `overdue` escopo M-3 | ⚠️ |
| Folha | OK | OK na UI | OK | 🔴 C-1 | 🚨 |
| Relatórios | OK | hardcode M-11 | PDF "em breve" (ok) | OK | ⚠️ |
| Configurações (todas as abas) | fiscal/salas sem aba (A-7) | OK | OK | 🔴 C-3, A-3 | 🚨 |
| Calendário Escolar | OK | M-14 | OK | `schoolHolidays.*` admin OK | ⚠️ |
| Professores | OK | M-15 | OK | A-5, A-6 | ⚠️ |
| Contratos | OK | reenvio sem botão (Médio 18 do relatório 2) | OK | A-3 (sem admin) | ⚠️ |
| Leads/CRM | OK | 🔴 C-2 (8 mudos) | 2 submits fake | procedures existem e não são usadas | 🚨 |
| Comunicados | OK | M-17 | OK | `announcements.*` OK | ⚠️ |
| Reposições | OK | OK | OK | OK (admin) | ✅ aprovado |
| Portal do Aluno | OK | baixos | OK | A-10..A-13 | ⚠️ |

---

## 📢 Encaminhamento para @wrauditor

"@wrauditor, o relatório de caça aos bugs foi finalizado: **3 CRÍTICOS, 16 ALTOS, 18 MÉDIOS e 13 BAIXOS**, com **CA-004 e CA-015 falhando** e CA-003/010 parciais no mobile. Sugiro a seguinte fila de correção:

**P0 (segurança/dados — engsoftware + asaasespecialista quando aplicável):**
1. Folha de pagamento com `adminProcedure` + filtro por professor (C-1)
2. `alunos_editar` no servidor (update/status/archive/syncCourses) + guards no mobile/modal (A-4)
3. IDOR `lessons.list({studentId})` e `getTeacherSchedule`; vínculo em reschedule/extraRequests (A-1/A-13/A-17)
4. Segredos mascarados (Fiscal/Evolution) + adminProcedure nas procedures administrativas (C-3/A-3)
5. Bloqueio de login de professor arquivado (A-5) e reatribuição no delete (A-6)

**P1 (correção funcional do PRD v1.1 — engsoftware + dbguru + layoutespecialista):**
6. Conclusão por contrato + índice `contracts(studentId)` (A-8)
7. Curso 1 sincronizado + `ORDER BY` determinístico + sync dentro do update (A-9)
8. Card mobile de Alunos com cursos/professor/conclusão (M-6) e responsável no painel de detalhe (M-5)

**P2 (UX/robustez):**
9. Leads: ligar os 8 botões às procedures e remover dados fictícios (C-2)
10. Portal: conteúdo dos Avisos, permissões server-side, PIX correto (A-10..A-12)
11. Demais médios/baixos conforme tabela."

**Artefatos:** este dossiê, os relatórios por frente (4 agentes) e a suíte (588 testes) servem de base para o `wrauditor` delegar aos especialistas (`engsoftware`, `dbguru`, `layoutespecialista`, `asaasespecialista`).
