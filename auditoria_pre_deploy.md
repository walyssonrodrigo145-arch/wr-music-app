# Relatório de Auditoria Pré-Deploy - BillingEngine & Financeiro

## Causa Raiz Estrutural Identificada (Auditoria WRAUDITOR)

Após auditoria aprofundada no fluxo de dados financeiro, foram identificadas 4 falhas estruturais que impediam a atualização em tempo real e a correta exibição de juros, multas e desconto antecipado:

1. **Coerção Estrita vs Strings do Postgres/Drizzle (`BillingEngine.ts` & `Configuracoes.tsx`):**
   - No JavaScript, comparações como `"0" !== 0` e `Boolean("0")` avaliam como `TRUE` para strings vindas do banco de dados (Ex: campos inteiros/booleanos serializados como `"0"` ou `"1"`).
   - **Correção:** Implementada verificação numérica explícita `Number(val) === 1` tanto no `extractSchoolSettings` do `BillingEngine` quanto na inicialização de estado das `Configuracoes`.

2. **Suporte a Separador Decimal em PT-BR (`Configuracoes.tsx`):**
   - Ao digitar valores como `0,3301` usando vírgula (padrão brasileiro), o método padrão `Number("0,3301")` retornava `NaN`, fazendo o recálculo dos juros falhar silenciosamente ou zerar.
   - **Correção:** Adicionado tratamento `parseFloat(String(val).replace(',', '.')) || 0` em todos os inputs numéricos de multas, juros e descontos.

3. **Invalidação de Cache de Consulta (`Configuracoes.tsx`):**
   - O salvamento de configurações invalidava apenas `utils.settings.get`, mantendo em cache a query `utils.paymentDues.list`.
   - **Correção:** Adicionada invalidação síncrona `utils.paymentDues.invalidate()` no `onSuccess` das configurações financeiras.

4. **Filtro de Renderização de Desconto Antecipado (`MensalidadesTab.tsx`):**
   - A tabela financeira só renderizava detalhamento quando `lateFeeAmount > 0` ou `interestAmount > 0`.
   - **Correção:** Incluída a condição `earlyDiscountAmount > 0` com a tag `-Desconto: R$ XX,XX` em tom esmeralda.

---

## Resultado dos Testes Automatizados

- **Vitest Unit Tests:** `server/services/BillingEngine.test.ts` (5/5 aprovados)
- **Git Status:** 3 arquivos atualizados com precisão (`server/services/BillingEngine.ts`, `client/src/pages/Configuracoes.tsx`, `client/src/pages/financeiro/MensalidadesTab.tsx`, `server/routers.ts`).
