# Relatório de Auditoria Pré-Deploy - Google OAuth redirect_uri_mismatch Fix

## Causa Raiz Estrutural Identificada (Auditoria WRAUDITOR)

1. **Redirect URI Nulo/Localhost em Produção (`server/_core/googleAuth.ts` & `env.ts`):**
   - O servidor estava utilizando o fallback `http://localhost:3000` / `http://localhost:5000` para construir a `redirect_uri` do Google OAuth quando a variável `APP_URL` não estava configurada na VPS.
   - O Google OAuth rejeitava as requisições vindas da VPS com erro `400: redirect_uri_mismatch` pois esperava a URL oficial cadastrada no console.
   - **Correção:** 
     1. Atualizado `env.ts` para usar `https://wrmusicpro.com.br` como fallback em produção.
     2. Criado o método dinâmico `getRedirectUri(req)` em `googleAuth.ts` para detectar o domínio do cabeçalho HTTP (`x-forwarded-host`/`x-forwarded-proto`), garantindo que a URL enviada ao Google seja `https://wrmusicpro.com.br/api/auth/google/callback`.

---

## Instruções para o Desenvolvedor no Google Cloud Console

No **Google Cloud Console** (https://console.cloud.google.com/apis/credentials):
1. Selecione o projeto do Google OAuth.
2. Em **Origens JavaScript autorizadas**, cadastre:
   - `https://wrmusicpro.com.br`
   - `http://localhost:3000` (para ambiente local)
3. Em **URIs de redirecionamento autorizados**, cadastre:
   - `https://wrmusicpro.com.br/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback` (para ambiente local)

---

## Validação e Deploy
- **Git Status:** `server/_core/env.ts` e `server/_core/googleAuth.ts` atualizados.
- **Deploy:** Commit, push e execução do script de deploy `upload_and_deploy_fixed.js` via `devopsmaster`.
