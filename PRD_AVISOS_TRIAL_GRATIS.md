# PRD — Avisos de assinatura corretos no período de teste grátis

## 1. Visão Geral

### Problema
Escolas com `organizations.subscriptionStatus = "trialing"` (período de teste grátis do MusicPro) recebem avisos com texto de cobrança de assinante:
- Modal de lembrete: **"Sua mensalidade do MusicPro vence em X"** + plano/valor.
- Banner de pendência: **"Mensalidade do MusicPro pendente"** / "Sua assinatura venceu em X. Regularize...".

Isso é incorreto: o cliente ainda **não é assinante** e não tem mensalidade. A comunicação certa é sobre o **fim do teste grátis** e a necessidade de pagar para continuar.

### Objetivo
No status `trialing`, todos os avisos devem dizer apenas:
1. Que o **período de teste grátis** está expirando/terminou (com os dias/validade);
2. Que **para continuar usando o sistema é necessário realizar o pagamento**.

Nunca exibir "mensalidade", "assinatura vencida", plano ou valor nesse estado.

### Contexto
- Componentes: `client/src/components/dashboard/SubscriptionAlerts.tsx`
  (`SubscriptionRenewalModal` e `SubscriptionOverdueBanner`).
- Regras puras: `shared/subscriptionAlerts.ts`.
- Fonte dos dados: `platform.mySubscription` (`subscriptionStatus`, `trialEndsAt`, `currentPeriodEnd`, `planName`, `planPriceMonthly`).
- Trial dura 7 dias (`authRouters`), status inicial `trialing`.

---

## 2. Usuários Envolvidos

- **Admin da escola em trial** (quem vê os avisos).
- **Professor**: não vê os avisos (componentes só renderizam para admin).
- **SuperAdmin**: acompanha status/trial no painel (fora do escopo).

---

## 3. Escopo

### Incluído
- Copy trial-específica no modal de renovação e no banner de pendência.
- Fonte única e testável da copy em `shared/subscriptionAlerts.ts`.
- Manter inalterada a experiência do assinante (`active`/`pending`/`past_due`).

### Fora do escopo
- Alterar regras de acesso/bloqueio (`App.tsx`, `trpc.ts`).
- Alterar valores, cobranças ou o Asaas.
- Alterar o `PlanSelectionModal` e a página `/assinatura` (já falam de "avaliação grátis").
- Enviar e-mail/WhatsApp de cobrança (não existe hoje).

---

## 4. Requisitos Funcionais

### RF-001 — Modal de lembrete no trial
**Descrição:** quando `status = trialing` e faltam 0–3 dias, o modal exibe:
- Eyebrow: "Teste grátis";
- Título: "Seu período de teste grátis termina hoje / amanhã / em X dias";
- Corpo: "Seu período de teste grátis do MusicPro termina em {data}. Para continuar usando o sistema, realize o pagamento.";
- CTA: "Realizar pagamento" → `/assinatura`;
- **Sem** plano e **sem** valor.

### RF-002 — Banner de trial encerrado
**Descrição:** quando `status = trialing` e a data passou:
- Título: "Período de teste grátis encerrado";
- Corpo: "Seu período de teste grátis do MusicPro terminou em {data}. Para continuar usando o sistema, realize o pagamento.";
- CTA: "Realizar pagamento";
- **Sem** plano e **sem** valor.

### RF-003 — Assinante permanece igual
**Descrição:** com status diferente de `trialing`, a copy atual é mantida ("Sua mensalidade do MusicPro vence..." / "Mensalidade do MusicPro pendente", com plano e valor quando houver).

### RF-004 — Copy em fonte única
**Descrição:** as funções puras `buildRenewalNoticeCopy` e `buildOverdueBannerCopy` (em `shared/subscriptionAlerts.ts`) decidem a copy; o componente apenas renderiza e destaca a data em negrito.

---

## 5. Regras de Negócio

### RN-001 — Trial nunca fala de mensalidade
**Regra:** em `trialing`, os textos não podem conter "mensalidade", "assinatura venceu" nem valor/plano.
**Exemplo válido:** "Seu período de teste grátis termina em 3 dias. Para continuar usando o sistema, realize o pagamento."
**Exemplo inválido:** "Sua mensalidade do MusicPro vence em 3 dias. Valor: R$ 99,00."
**Consequência:** a copy é escolhida pelo status (`resolveSubscriptionAlertKind`), não pelo vencimento.

### RN-002 — Fonte da data
**Regra:** em trial a data é `trialEndsAt`; assinante usa `currentPeriodEnd` (fallback `trialEndsAt`) — regra atual de `useSubscriptionAlertInfo`, inalterada.

### RN-003 — Janela e frequência do modal
**Regra:** modal aparece de 0 a 3 dias do vencimento, 1x/dia (localStorage) — inalterado.

---

## 6. Fluxos

### Fluxo principal (trial expirando)
```text
Admin entra no sistema
↓
mySubscription retorna trialing + trialEndsAt
↓
Faltam 0–3 dias → modal "teste grátis termina em X dias / realize o pagamento"
↓
Admin clica "Realizar pagamento" → /assinatura
```

### Fluxo alternativo (trial encerrado)
```text
trialEndsAt < hoje e status trialing
↓
App redireciona para /checkout (regra existente de acesso)
↓
(se ainda visível) banner "Período de teste grátis encerrado" + pagamento
```

### Fluxos de erro
- `mySubscription` indisponível → componentes não renderizam (estado atual).
- Data inválida/ausente → `computeDaysLeft` retorna null → sem aviso.

---

## 7. Casos Extremos

- `daysLeft = 0` → "termina hoje"; `1` → "amanhã"; `2–3` → "em X dias".
- Trial vencido (`daysLeft < 0`) → banner com "terminou em {data}".
- `status = trialing` sem `trialEndsAt` → sem aviso.
- Status `pending`/`past_due`/`canceled` → copy de assinante.
- `planPriceMonthly = 0` → linha de valor não aparece (já existente).
- Mudança de status entre renders → copy acompanha o novo status.

---

## 8. Dados Envolvidos

| Origem | Campo | Uso |
| --- | --- | --- |
| `organizations` | `subscriptionStatus` | decide trial × assinante |
| `organizations` | `trialEndsAt` / `currentPeriodEnd` | data exibida |
| `systemPlans` | `name`, `priceMonthly` | só para assinante |

Sem alteração de banco.

---

## 9. Permissões e Segurança

- Dados vêm de `platform.mySubscription` (`protectedProcedure`) da própria organização.
- Componentes só renderizam para `user.role === "admin"`.
- Nenhuma exposição nova de dados; sem valores/plano para trial.

---

## 10. Tratamento de Erros

- **Esperado:** sem assinatura/erro de query → não exibe aviso.
- **Interno:** erros de rede/DB não são exibidos nos componentes (comportamento atual).

---

## 11. Requisitos Não Funcionais

- RNF-001: funções de copy puras e cobertas por testes (vitest).
- RNF-002: nenhuma mudança de layout além do texto/CTA.
- RNF-003: acessibilidade: título e corpo legíveis em dark mode (classes atuais mantidas).
- RNF-004: zero impacto em performance (cálculo síncrono trivial).

---

## 12. Critérios de Aceite

- CA-001: **Dado** admin com `trialing` e 3 dias restantes, **quando** o modal abrir, **então** o texto fala de teste grátis + pagamento, sem "mensalidade", plano ou valor.
- CA-002: **Dado** admin com `trialing` vencido, **quando** o banner aparecer, **então** exibe "Período de teste grátis encerrado" + pagamento, sem "mensalidade".
- CA-003: **Dado** admin com status `active`, **quando** o modal/banner aparecer, **então** a copy de assinante permanece idêntica à atual.
- CA-004: **Dado** `daysLeft = 0/1`, **então** o título usa "hoje"/"amanhã".
- CA-005: CTA leva a `/assinatura` nos dois casos de trial.

---

## 13. Riscos e Dependências

- **Risco:** status `trialing` com `currentPeriodEnd` preenchido — mitigado por a decisão ser pelo status (RN-001).
- **Dependência:** `shared/subscriptionAlerts.ts` (client + testes) e `platform.mySubscription`.

---

## 14. Métricas de Sucesso

- Zero avisos de "mensalidade" para escolas em teste grátis.
- Aumento da conversão trial → pagamento via CTA correto.

---

## 15. Plano de Implementação

### Fase 1 — Copy em fonte única
`buildRenewalNoticeCopy` / `buildOverdueBannerCopy` + `resolveSubscriptionAlertKind` em `shared/subscriptionAlerts.ts`.

### Fase 2 — Componentes
`SubscriptionRenewalModal` e `SubscriptionOverdueBanner` renderizam a copy e escondem plano/valor em trial.

### Fase 3 — Testes
Casos trial/assinante/hoje/amanhã no vitest.

### Fase 4 — Verificação e release
`pnpm check`, testes focados, build e entrada em `shared/releases.ts`.
