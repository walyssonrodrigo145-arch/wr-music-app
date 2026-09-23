# PRD — Envio da cobrança: Boleto (PDF + linha digitável) ou Link do checkout

## 1. Visão Geral

### Problema
Hoje o lembrete/cobrança enviado ao aluno leva apenas o **link do checkout** do gateway (`{link_pagamento}` → `invoiceUrl`). Escolas que cobram por **boleto** precisam abrir a cobrança, copiar a linha digitável/PDF e enviar manualmente — ou o aluno precisa abrir o link para gerar o boleto.

### Objetivo
Criar um **modo de envio da cobrança** por escola:
1. **Link do checkout** (padrão, comportamento atual);
2. **Boleto**: gera a cobrança como BOLETO no Asaas e envia **o PDF do boleto anexado** no WhatsApp + a **linha digitável** no texto da mensagem.

### Contexto
- Geração de lembretes: `reminders.generatePaymentReminders` (`server/routers/comunicacaoRouters.ts`).
- Envio manual: `reminders.sendViaBot` (texto/mídia via Evolution; já suporta `document` PDF).
- Envio automático: `automationJob.ts` (regras de cobrança) via `sendSmartWhatsAppNotification`.
- Geração avulsa: `paymentDues.generateAsaasCharge` (já gera BOLETO e devolve `bankSlipUrl` + `identificationField`).
- Settings por usuário/escola (`settings`), como `paymentGateway`/`asaasEnabled`.

---

## 2. Usuários Envolvidos

- **Admin da escola**: escolhe o modo e gera/envia as cobranças.
- **Professor**: gera lembretes com as próprias configurações (mesmo comportamento de gateway).
- **Aluno/Responsável**: recebe a mensagem no WhatsApp.

---

## 3. Escopo

### Incluído
- Setting `chargeSendMode`: `link` (padrão) | `boleto`, editável em Configurações → Integrações.
- No modo boleto (somente **Asaas**): cobrança criada com `billingType = BOLETO`; persistência de `asaasBankSlipUrl` e `asaasIdentificationField` na mensalidade.
- Mensagem do lembrete com a **linha digitável** (substitui `{link_pagamento}`/`{pix}` ou é anexada ao final).
- Envio do **PDF do boleto** como documento no WhatsApp (manual e automático), com fallback para texto se a mídia falhar.
- Modo link: comportamento atual inalterado.

### Fora do escopo
- Boleto em Mercado Pago/InfinitePay (não oferecem boleto) — nesses gateways o modo cai para link.
- Alterar uma cobrança já existente de outro tipo (PIX/cartão) para boleto — mantém o link.
- Pagamento por boleto no portal do aluno/checkout público.
- Reenvio automático de boleto vencido com novo vencimento.

---

## 4. Requisitos Funcionais

### RF-001 — Configuração do modo
Configurações → Integrações → "Modo de envio da cobrança": **Link do checkout** (padrão) ou **Boleto (PDF + linha digitável)**. Persistido junto do "Salvar Integração".

### RF-002 — Geração no modo boleto
Ao gerar lembrete/cobrança com modo boleto e Asaas ativo: se a mensalidade **não tem cobrança**, cria no Asaas com `billingType = BOLETO`, salva `asaasId`, `asaasBillingType`, `asaasPaymentLink`, `asaasBankSlipUrl` e `asaasIdentificationField`.

### RF-003 — Mensagem com linha digitável
No modo boleto: `{link_pagamento}`/`{link_cobranca}`/`{link}`/`{payment_link}` são substituídos pela **linha digitável**; sem tag no template, anexa bloco:
`🧾 *Boleto (linha digitável):*\n{código}\n📎 O boleto em PDF está anexado nesta conversa.`
Sem código disponível → mantém o link (fallback).

### RF-004 — Envio do PDF
No envio (manual `sendViaBot` e automático), se modo boleto e a mensalidade tem `asaasBankSlipUrl`, envia o PDF como **documento** com a mensagem na legenda. Se o envio de mídia falhar, reenvia como texto (a linha digitável já está no corpo).

### RF-005 — Cobrança já existente
Se a mensalidade já tem cobrança Asaas **BOLETO** com dados salvos → usa. Se já tem cobrança de **outro tipo** → mantém o link (não cria segunda cobrança).

### RF-006 — Geração avulsa
`generateAsaasCharge` (modal "Gerar Cobrança") passa a **persistir** `bankSlipUrl` e `identificationField` ao gerar boleto.

---

## 5. Regras de Negócio

### RN-001 — Boleto é exclusivo do Asaas
`paymentGateway !== "asaas"` → modo boleto é ignorado (envia link).

### RN-002 — Nunca duplicar cobrança
Modo boleto só cria cobrança nova quando a mensalidade não possui cobrança. Cobrança existente nunca é substituída automaticamente.

### RN-003 — Fallback seguro
Sem PDF e/ou sem linha digitável → envia o link (comportamento atual). Falha de mídia → texto.

### RN-004 — Configuração por usuário (como o gateway)
O modo é lido da settings do usuário que gera o lembrete (mesma regra de `paymentGateway`).

---

## 6. Fluxos

### Fluxo principal (manual)
```text
Admin escolhe "Boleto" em Integrações e salva
↓
Lembretes → Gerar lembretes de cobrança
↓
Mensalidade sem cobrança → Asaas cria BOLETO (PDF + linha digitável salvos)
↓
Mensagem recebe a linha digitável
↓
Admin envia pelo robô → PDF anexado (documento) + mensagem
```

### Fluxo alternativo (automático)
```text
Regra de cobrança do automationJob
↓
Modo boleto + Asaas → cria BOLETO e inclui linha digitável
↓
whatsappAutoSend → PDF anexado (fallback texto)
```

### Fluxos de erro
- Asaas indisponível/erro → mantém link/PIX da mensalidade (não bloqueia o lembrete).
- Aluno sem telefone → lembrete não é enviado (regra atual).
- Falha ao enviar mídia → texto.

---

## 7. Casos Extremos

- Template sem tag de link → bloco de boleto é anexado ao final.
- Linha digitável indisponível (Asaas ainda processando) → usa link.
- Mensalidade já paga/cancelada → não gera (regra atual).
- Mensalidade com cobrança PIX antiga e modo boleto → link (RN-002).
- `bankSlipUrl` expirado/404 → fallback texto.
- Boleto com valor atualizado (juros/multa) → valor do BillingEngine é o usado na cobrança (regra atual do automation; no lembrete manual usa `due.amount`).
- Duplo clique em "Gerar lembretes" → deduplicação por `refId`/status (regra atual).
- Gateway trocado após gerar → o envio usa os dados salvos na mensalidade.

---

## 8. Dados Envolvidos

| Tabela | Campo novo | Tipo | Regra |
| --- | --- | --- | --- |
| `settings` | `chargeSendMode` | varchar(20) | `'link'` default; `'boleto'` opcional |
| `payment_dues` | `asaasBankSlipUrl` | text | URL do PDF (BOLETO) |
| `payment_dues` | `asaasIdentificationField` | text | Linha digitável (BOLETO) |

Sem novas tabelas; ALTERs idempotentes no bootstrap.

---

## 9. Permissões e Segurança

- `settings.updateAsaasIntegration` e `reminders.*` continuam em `protectedProcedure` com isolamento por `organizationId`/`userId`.
- URLs de boleto são geradas pelo Asaas (não expõem chaves).
- Nenhum dado sensível novo é logado.

---

## 10. Tratamento de Erros

- **Esperado:** sem linha digitável/PDF → link; mídia falhou → texto; gateway não-Asaas → link.
- **Interno:** erros de API do Asaas/Evolution são logados no servidor e não quebram o lembrete.

---

## 11. Requisitos Não Funcionais

- RNF-001: helpers de decisão/copy puros e testáveis (`shared/billing.ts`).
- RNF-002: nenhuma chamada extra à API do Asaas no envio (dados persistidos na geração).
- RNF-003: modo link sem regressão (testes existentes continuam passando).
- RNF-004: UI do seletor em dark mode e mobile.

---

## 12. Critérios de Aceite

- CA-001: modo `link` → mensagem e envio idênticos ao comportamento atual.
- CA-002: modo `boleto` + Asaas + mensalidade sem cobrança → cobrança BOLETO criada e `asaasBankSlipUrl`/`asaasIdentificationField` salvos.
- CA-003: mensagem no modo boleto contém a linha digitável; sem tag no template, bloco anexado.
- CA-004: envio no modo boleto anexa o PDF como documento; falha de mídia cai para texto.
- CA-005: modo boleto + Mercado Pago/InfinitePay → link.
- CA-006: mensalidade com cobrança de outro tipo → link (sem duplicar cobrança).

---

## 13. Riscos e Dependências

- **Risco:** boleto do Asaas tem taxa/compensação em dias úteis — comunicação deixa claro o vencimento.
- **Risco:** URL do PDF pode expirar; fallback texto cobre.
- **Dependência:** Asaas (`createAsaasCharge`, `getAsaasIdentificationField`), Evolution (`sendMedia` document), `BillingEngine` para valores.

---

## 14. Métricas de Sucesso

- Redução de envios manuais de boleto (copiar/colar).
- Aumento de pagamentos por boleto identificados no Asaas.

---

## 15. Plano de Implementação

### Fase 1 — Dados
Colunas `chargeSendMode`, `asaasBankSlipUrl`, `asaasIdentificationField` + bootstrap.

### Fase 2 — Regras puras
`resolveChargeSendMode`, `buildBoletoMessageBlock` em `shared/billing.ts` + testes.

### Fase 3 — Backend
`updateAsaasIntegration`, `generateAsaasCharge` (persistir boleto), `generatePaymentReminders`, `sendViaBot`, `automationJob`, `whatsappRouting` (mídia).

### Fase 4 — Frontend
Seletor do modo em Configurações → Integrações + aviso de que boleto é só Asaas.

### Fase 5 — Testes e release
Vitest + `pnpm check` + build + entrada em `shared/releases.ts`.
