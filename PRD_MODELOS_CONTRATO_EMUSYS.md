# PRD — Editor de Modelos de Contrato (estilo Emusys) na aba Contratos

## 1. Visão Geral

### Problema
Hoje os modelos de contrato ficam em **Configurações → Modelos de Contrato** e são editados num **textarea único** com variáveis `{{...}}`. Isso dificulta:
- organizar o contrato em seções (título, contratante, contratada, cláusulas, parágrafos);
- editar/reordenar blocos sem mexer no texto inteiro;
- enxergar o resultado final.

A Emusys usa um editor **estruturado por itens** (Tipo do item / Título / Texto), com linhas como "CONTRATO DE PRESTAÇÃO DE SERVIÇO", "CONTRATANTE", "CONTRATADA", "CLÁUSULA 1ª", "Parágrafo Único".

### Objetivo
1. Criar um **editor visual em blocos** para os modelos de contrato (padrão Emusys).
2. **Migrar** a gestão de modelos de Configurações para a página **Contratos** (nova aba "Modelos de Contrato").
3. **Remover** a aba "Modelos de Contrato" de Configurações.
4. Preservar 100% do fluxo de assinatura: o modelo continua entregando o `content` (texto final) para o Assinafy.

### Contexto
- Página: `client/src/pages/Contratos.tsx` (hoje só lista contratos, sem abas).
- Componente atual: `client/src/components/integrations/ModelosContratoTab.tsx`.
- Backend: `contractTemplates` em `server/routers/contratosRouters.ts`; tabela `contract_templates` (`content` texto).
- Variáveis: `{{student_name}}`, `{{monthly_fee}}`, etc. + `autoInsertVariables` (IA/regex).

---

## 2. Usuários Envolvidos

- **Admin da escola**: cria/edita modelos e envia contratos (único que via hoje a aba).
- **Professor**: continua vendo apenas a lista de contratos (sem a aba de modelos).

---

## 3. Escopo

### Incluído
- Nova coluna `contract_templates.blocks` (JSON dos blocos), mantendo `content` como texto renderizado.
- Editor em blocos: tipo, título, texto; adicionar, editar, duplicar, mover ↑/↓, excluir; prévia ao vivo.
- Conversão automática de modelos antigos (sem `blocks`) em blocos ao abrir.
- Paleta de variáveis inserindo no bloco em foco.
- Botão "Substituir variáveis (IA)" aplicado ao conteúdo e redistribuído nos blocos.
- Abas na página Contratos: **Contratos** e **Modelos de Contrato** (admin).
- Remoção da aba de modelos das Configurações.

### Fora do escopo
- Alterar o fluxo de envio/assinatura (Assinafy) — continua usando `content`.
- Editar contratos já gerados a partir do modelo.
- Versionamento/histórico de modelos.
- Modelos globais compartilhados entre escolas.

---

## 4. Requisitos Funcionais

### RF-001 — Editor em blocos
Cada modelo é uma lista de blocos `{ type, title, text }`, com tipos: Título, Contratante, Contratada, Cláusula, Parágrafo Único, Texto, Assinaturas, Data/Local.

### RF-002 — Ações por bloco
Adicionar no fim, inserir abaixo, duplicar, mover para cima/baixo, excluir (mínimo 1 bloco).

### RF-003 — Prévia ao vivo
Painel de prévia renderiza título + texto na ordem, destacando variáveis `{{...}}`.

### RF-004 — Variáveis
Chips inserem a variável no bloco em foco (ou no último bloco editado). Botão de IA substitui padrões do texto colado e redistribui nos blocos.

### RF-005 — Salvar
Salva `name`, `description`, `blocks` (JSON) e `content` (renderizado dos blocos). `content` continua obrigatório para o Assinafy.

### RF-006 — Compatibilidade
Modelo sem `blocks` → converte `content` em blocos (parágrafos; linhas em CAIXA ALTA viram títulos/cláusulas) sem alterar o texto original ao salvar.

### RF-007 — Migração de navegação
Página Contratos ganha abas; Configurações perde a aba "Modelos de Contrato".

### RF-008 — Permissão
Aba "Modelos de Contrato" visível apenas para admin (professor vê só contratos).

---

## 5. Regras de Negócio

### RN-001 — `content` é a fonte da assinatura
`content` = `renderBlocks(blocks)` (título + texto, separados por linha em branco). Nunca enviar JSON ao provedor.

### RN-002 — Conversão não destrutiva
A conversão de legado só acontece ao abrir o editor; nada é gravado até o usuário salvar.

### RN-003 — Exclusão
Excluir modelo = desativar (`active = false`), como hoje; o último modelo não pode ser desativado pela UI.

### RN-004 — Assinaturas
Blocos de assinatura são texto (linhas de assinatura), sem integração nova.

---

## 6. Fluxos

### Fluxo principal
```text
Admin abre Contratos → aba Modelos de Contrato
↓
Escolhe um modelo (ou "Novo Modelo")
↓
Editor em blocos: ajusta tipo/título/texto, adiciona cláusulas, insere variáveis
↓
Prévia ao vivo
↓
Salvar → grava blocks + content
↓
Modelo disponível no envio de contratos
```

### Fluxos alternativos
- Modelo legado (sem blocks) → converte ao abrir.
- Botão IA → substitui variáveis no texto renderizado e re-distribui.

### Fluxos de erro
- Nome vazio / conteúdo curto → toast e não salva.
- Falha de rede → toast de erro; nada é perdido no editor.

---

## 7. Casos Extremos

- Conteúdo legado sem linhas em branco → cada linha vira um bloco.
- Bloco vazio → ignorado na renderização final.
- Último bloco excluído → bloqueado (mínimo 1).
- Variável duplicada → permitido (o provedor substitui todas).
- Modelo com `blocks` inválido/corrompido → fallback para conversão do `content`.
- Textos muito longos → textarea com altura máxima e scroll; prévia com scroll.

---

## 8. Dados Envolvidos

| Tabela | Campo | Tipo | Regra |
| --- | --- | --- | --- |
| `contract_templates` | `blocks` | text (JSON) | opcional; legado cai no `content` |
| `contract_templates` | `content` | text | obrigatório (renderizado) |

Sem novas tabelas; ALTER idempotente no bootstrap.

---

## 9. Permissões e Segurança

- Procedures `contractTemplates.*` continuam `protectedProcedure` com isolamento por `organizationId`.
- Aba restrita a admin na UI; backend permanece acessível a staff (comportamento atual).

---

## 10. Tratamento de Erros

- **Esperado:** nome/conteúdo inválidos, modelo não encontrado, JSON de blocos inválido (fallback).
- **Interno:** erros de banco/rede → mensagens genéricas; detalhes só em log.

---

## 11. Requisitos Não Funcionais

- RNF-001: helpers de blocos puros e testados (parse/render/legado).
- RNF-002: responsivo (tabela de blocos vira cartões no celular).
- RNF-003: dark mode e tipografia do design system.
- RNF-004: sem regressão no envio de contratos (mesmo `content`).

---

## 12. Critérios de Aceite

- CA-001: admin cria modelo com 3 blocos, salva e reabre mantendo tipo/título/texto.
- CA-002: `content` salvo contém os textos na ordem dos blocos.
- CA-003: modelo legado abre convertido em blocos e, ao salvar, mantém o texto original.
- CA-004: professor não vê a aba de modelos.
- CA-005: Configurações não exibe mais "Modelos de Contrato".
- CA-006: envio de contrato continua funcionando com o `content` renderizado.

---

## 13. Riscos e Dependências

- **Risco:** heurística de conversão de legado imprecisa — mitigada por prévia e edição manual.
- **Dependência:** `contractService` (conteúdos padrão) e `autoInsertVariables`.

---

## 14. Métricas de Sucesso

- Tempo para editar uma cláusula (sem mexer no texto todo).
- Nº de modelos com blocos salvos após a migração.

---

## 15. Plano de Implementação

### Fase 1 — Dados e helpers
Coluna `blocks` + `shared/contractBlocks.ts` (parse/render/legado) + testes.

### Fase 2 — Backend
`create/update` aceitam `blocks`.

### Fase 3 — Frontend
Novo `components/contratos/ModelosContratoTab.tsx` (editor Emusys) + abas em Contratos.

### Fase 4 — Limpeza
Remover aba/import de Configurações e o componente antigo.

### Fase 5 — Testes e release
`pnpm check`, vitest, build e `shared/releases.ts`.
