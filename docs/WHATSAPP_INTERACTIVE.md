# WhatsApp Interativo (Botões/Menus) — MusicPro

Camada própria de mensagens interativas para o WhatsApp via **Evolution API 2.3.7 (Baileys)**, com fallback automático e arquitetura pronta para migrar à API oficial (Meta Cloud) sem reescrever o negócio.

> **Princípio:** `INTERFACE → ACTION → VALIDATION → BUSINESS LOGIC → RESPONSE` — nunca `BOTÃO → EXECUÇÃO DIRETA`.

## Compatibilidade (verificada na instalação real — 16/09/2026)
Sonda executada na Evolution da VPS (`evoapicloud/evolution-api:latest`, versão **2.3.7**):

| Endpoint | Disponível | Schema exigido |
|---|---|---|
| `POST /message/sendButtons/{instance}` | ✅ | `buttons[].type` ("reply"), `buttonText.displayText` |
| `POST /message/sendList/{instance}` | ✅ | `footerText`, `buttonText`, `sections[].rows[].rowId` |
| `POST /message/sendPoll/{instance}` | ✅ (não usado) | `name`, `selectableCount`, `values` |
| `POST /message/sendText/{instance}` | ✅ | `text` |

Limites adotados: **máx 3 botões**, texto de botão ≤ 24 chars, corpo ≤ 1024, listas ≤ 10 itens.

## Arquitetura (`server/services/whatsapp/interactive/`)

```
Webhook (webhooks/whatsapp.ts)
  → isInteractiveMessage() (detecta clique SEM quebrar fluxo de texto)
  → handleInteractiveIncoming()   [index.ts]
      → ResponseNormalizer        [formatos Baileys → formato único]
      → resolveClickedButton()    [registro de envio + expiração §13]
      → idempotência (unique index message_id + button_id) §14
      → ActionRouter / Menus      [regra de negócio isolada por escola/role]
      → InteractiveMessageService [envio com cascata botões → lista → texto]
```

| Arquivo | Papel |
|---|---|
| `types.ts` | Modelo de botão/menu, LIMITS e `INTERACTIVE_CONFIG` (env) |
| `EvolutionProvider.ts` | **WhatsAppProvider** atual (sendText/sendButtons/sendList) + `validateInteractiveMessage` |
| `ResponseNormalizer.ts` | `normalizeInteractiveResponse` + `parseFallbackChoice` + `messageIdFrom` |
| `InteractiveMessageService.ts` | Envio com fallback em cascata + `resolveClickedButton` |
| `SessionService.ts` | Sessão por telefone (TTL 30 min, upsert/navigate/close) |
| `Menus.ts` | Menus main/alunos/agenda/financeiro + handlers de negócio |
| `index.ts` | Orquestrador chamado pelo webhook |

## Como criar um botão / uma action

1. Crie o botão no menu desejado em `Menus.ts` com `btn(id, text, action, params, order)`.
2. Registre o handler em `routeDynamic()` (ou no switch de `handleAction` p/ navegação).
3. A lógica de negócio fica em `server/services/**` quando reutilizável. O handler deve:
   - sempre validar `organizationId` (§16) e, quando aplicável, o `professorId` (§15);
   - responder via `sendInteractive()` (nunca `sendWhatsAppMessage` cru).

## Como criar um novo menu

```ts
// Menus.ts
case "relatorios_menu":
  return requireMenu(ctx, "relatorios", () => renderMenu(ctx, "relatorios"));

async function renderRelatoriosMenu(ctx: MenuCtx, context: any) {
  await sendInteractive(ctx.db, {
    organizationId: ctx.organizationId, userId: ctx.userId, phone: ctx.phone,
    menu: "relatorios", title: "📊 Relatórios", body: "O que deseja ver?",
    buttons: [btn("r1", "📈 Vendas", "relatorios_vendas", {}, 1),
              btn("r2", "⬅️ Voltar", "voltar_menu", {}, 2)],
    instanceName: ctx.instanceName, baseUrl: ctx.baseUrl, apiKey: ctx.apiKey,
  });
  return true;
}
```
- Máx 3 botões (extras entram automaticamente em lista/fallback).
- Restrição por papel: adicione o menu em `MENUS_ADMIN_ONLY` (§15).
- Confirmação de 2 etapas (§22): primeiro botão envia outro menu cujos botões carregam `action: "confirmar_X"` + `params: { entityId, entityType }`; o handler revalida tudo antes de executar.

## Fallback automático

`sendInteractive()` tenta: **botões → lista → texto numerado** e registra `interactive_messages` com o formato efetivamente usado (`type`). Respostas textuais ("1", "Agenda") são mapeadas de volta via `parseFallbackChoice` na sessão ativa. Falha total → log de erro, atendimento continua no fluxo existente.

## Confirmação de presença nos LEMBRETES de aula (PRD_LEMBRETE_INTERATIVO)

Quando a escola tem **"Botões Interativos" ATIVO**, o lembrete de aula enviado pelo
robô de automação (`automationJob`) sai **com botões clicáveis**:

```
📚 Lembrete de aula
{mensagem do lembrete}

[✅ Vou comparecer]  [❌ Não poderei ir]
```

- O clique **não exige login**: o aluno é identificado pelo número do WhatsApp
  (telefone do aluno OU do responsável — `phoneMatchesStudent`, org-scoped).
- A resposta grava `lessons.studentConfirmation` (`confirmado`/`nao_vai`) — o
  mesmo campo usado pelo Portal do Aluno (idempotente; repetir resposta não
  re-notifica).
- O professor recebe notificação in-app + push ("Presença Confirmada (WhatsApp)").
- **Expiração do clique: 24h** (`buttonExpirationMinutes: 1440` no lembrete).
- Fallback total: se `sendButtons/sendList` falharem, sai o texto numerado com o
  link do portal (`appendConfirmationLink` no caminho textual) — o aluno SEMPRE
  consegue responder.
- Ações: `confirmar_presenca_aula` / `nao_vai_aula` (handlers em `Menus.ts`,
  rota `routeDynamic`), idempotentes via `interactive_action_logs`.

## Configuração (§28)

| Env | Default | Função |
|---|---|---|
| `WHATSAPP_INTERACTIVE_ENABLED` | `true` | Master (master switch) |
| `WHATSAPP_BUTTONS_ENABLED` | `true` | Nível 1 da cascata |
| `WHATSAPP_LISTS_ENABLED` | `true` | Nível 2 |
| `WHATSAPP_INTERACTIVE_FALLBACK` | `true` | Nível 3 (texto) |
| `WHATSAPP_INTERACTIVE_SESSION_MINUTES` | `30` | TTL da sessão (5–240) |
| `WHATSAPP_BUTTON_EXPIRATION_MINUTES` | `10` | Validade do clique (§13) |
| `WHATSAPP_INTERACTIVE_MAX_RETRIES` | `3` | Tentativas por nível |

**Ativação por escola:** Configurações → Robô de WhatsApp → toggle **"Botões Interativos"** (`settings.whatsappInteractiveEnabled`, padrão OFF). Requer o Robô de Autoatendimento ativo.

## Segurança (§17)

- Webhook autenticado (`WHATSAPP_WEBHOOK_TOKEN` — já existente).
- Nunca confiar em `buttonId`/`action`/`displayText` recebidos: tudo resolvido pelo registro `interactive_messages` da escola.
- Idempotência: índice único `(messageId, buttonId)` em `interactive_action_logs` — replay/duplo clique não re-executa.
- Expiração de mensagem (§13) e de sessão (§12); tomada humana (`PAUSED_HUMAN`) desliga a camada interativa.
- Isolamento multi-tenant: TODA query leva `organizationId`; professor só vê seus alunos (§15/§16).
- IA fora do caminho de botões (§21): handlers são determinísticos, sem poder destrutivo (sem exclusão/cancelamento via botão nesta fase).

## Banco

| Tabela | Função |
|---|---|
| `interactive_sessions` | Sessão por telefone (menu atual/anterior, contexto, expiração) |
| `interactive_messages` | Mensagens interativas enviadas (buttons JSON, messageId, expiresAt) |
| `interactive_action_logs` | Log de ações + idempotência (status: processed/expired/duplicate/unauthorized/error) |

## Trocar de provider no futuro (§27)

Implemente `WhatsAppProvider` (Meta Cloud API) e troque a criação em `InteractiveMessageService.sendInteractive()` — menus, router, sessões e logs não mudam. Normalizadores novos entram em `ResponseNormalizer.ts`.
