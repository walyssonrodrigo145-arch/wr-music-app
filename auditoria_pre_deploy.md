# Relatório de Auditoria Pré-Deploy - Dynamic Subdomain Support for Google OAuth

## Causa Raiz Estrutural Identificada (Auditoria WRAUDITOR)

1. **Suporte Dinâmico a Subdomínio no Google OAuth (`server/_core/googleAuth.ts`):**
   - Ao tentar realizar o login com Google acessando o subdomínio `analytics.wrmusicpro.com.br`, o servidor precisa gerar a URL de redirecionamento correspondente ao subdomínio exato (`https://analytics.wrmusicpro.com.br/api/auth/google/callback`).
   - **Correção:** A função `getRedirectUri(req)` foi aprimorada para extrair o host dinâmico da requisição HTTP (`analytics.wrmusicpro.com.br` ou `wrmusicpro.com.br`), garantindo que tanto o domínio principal quanto o subdomínio façam a autenticação via Google com precisão.

---

## Dados exatos para adicionar no Google Cloud Console

Para o login funcionar tanto no domínio principal quanto no subdomínio do Analytics:

### 1. Origens JavaScript autorizadas:
- `https://analytics.wrmusicpro.com.br`
- `https://wrmusicpro.com.br`
- `http://localhost:3000`

### 2. URIs de redirecionamento autorizados:
- `https://analytics.wrmusicpro.com.br/api/auth/google/callback`
- `https://wrmusicpro.com.br/api/auth/google/callback`
- `http://localhost:3000/api/auth/google/callback`

---

## Validação e Deploy
- **Git Status:** `server/_core/googleAuth.ts` atualizado.
- **Deploy:** Commit, push e execução do script `upload_and_deploy_fixed.js` via `devopsmaster`.
