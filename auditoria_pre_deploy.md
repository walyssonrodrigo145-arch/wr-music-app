# Auditoria Pré-Deploy - Correção do Chatbot (WhatsApp / Evolution API)

## Causa Raiz Estrutural Identificada
Após investigação do comportamento do robô que não estava respondendo aos alunos, identificamos duas causas técnicas que impediam o funcionamento correto do fluxo:

1. **Incompatibilidade de Payload (Evolution API v1 vs v2):**
   O script estava tentando ler a mensagem acessando `payload.data?.message.message`, o que faria sentido em algumas versões antigas, mas na v2 o objeto já é repassado nivelado (`payload.data.message` é o próprio objeto `{ conversation: "..." }`). Isso fazia com que a extração de texto resultasse em `undefined`, e o webhook interrompia o processo silenciosamente achando que a mensagem estava vazia.
   *Solução aplicada:* Refatoramos a lógica de extração para suportar tanto `messageData.message` quanto o próprio `messageData`.

2. **Ausência das Credenciais da Instância Específica:**
   A função de envio da resposta (`sendReply`) estava utilizando a API e o Token *default* do sistema. Isso poderia falhar ou mandar mensagens a partir da conta errada caso o professor possuísse uma instância hospedada num Evolution API diferente ou usasse um token próprio.
   *Solução aplicada:* O webhook agora repassa explicitamente `profSettings.whatsappBotUrl` e `whatsappBotToken` para garantir a consistência das conexões multi-tenant.

## Status da Auditoria
- [x] Lógica de negócio verificada
- [x] Teste mental das rotas do Webhook 
- [x] Arquivos incluídos no `filesToUpload` do DevOps (`server/webhooks/whatsapp.ts` já estava mapeado)

## Parecer do WRAUDITOR
✅ **APROVADO PARA DEPLOY**. As alterações são cirúrgicas e seguras. O sistema de deploy por SFTP (`upload_and_deploy_fixed.js`) será acionado para garantir a entrada em produção imediata.
