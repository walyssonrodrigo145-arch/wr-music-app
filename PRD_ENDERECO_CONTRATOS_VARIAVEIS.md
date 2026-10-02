# PRD — Endereço completo do aluno, variáveis de contrato e geração por impressão ou link

**Versão:** 1.0 • **Data:** 02/10/2026 • **Status:** Proposto (aguardando aprovação)
**Solicitante:** WR (admin)
**Base técnica:** levantamento factual do código (arquivos/linhas citados ao longo do documento)

---

## 1. Visão Geral

### Problema

1. O cadastro do aluno guarda o endereço em **um único campo de texto livre** (`students.address`, `drizzle/schema.ts:156`), insuficiente para preencher contratos com logradouro, número, complemento, bairro, CEP, cidade e UF separados.
2. O motor de contratos (`server/services/contractService.ts:215-247`) usa variáveis **genéricas em inglês** (`{{student_address}}`, `{{school_address}}`), pouco compreensíveis para o usuário — enquanto o Emusys usa variáveis simples em português ("Nome do Contratante", "CEP da Escola", "Meses de aula" etc.).
3. O motor já referencia colunas que **não existem** (`student.city`, `student.state` em `contractService.ts:371-375`; `guardian_rg`, `guardian_address` em `:396-400`), gerando placeholders vazios.
4. Não há dados estruturados da **CONTRATADA** (razão social, nº, bairro, CEP, UF, responsável legal com RG/CPF) — hoje só existem em `settings` campos soltos (`schoolAddress`, `schoolCity`) e o endereço estruturado de `organizations` não é lido por contratos.
5. Ao gerar contrato, o único caminho é **enviar para assinatura digital** (Assinafy). Não é possível **imprimir** um contrato para assinatura física.
6. O `guardianCpf` existe no banco e é lido pelo contrato, mas **não é editável nos fluxos administrativos** de aluno (`studentsRouters.ts:633/853/281-308`).

### Objetivo

- Aluno com **endereço estruturado** (CEP + número obrigatórios para busca), preenchido via **ViaCEP** (só digita CEP e número; resto automático).
- Contratos com **variáveis simples em português**, no padrão Emusys, organizadas por categoria (Contrato, Contratante, Contratada, Financeiro, Vigência) — mantendo compatibilidade com as 23 variáveis atuais.
- Dados da **CONTRATADA** (escola) completos no contrato: razão social, endereço estruturado e representante legal (nome/RG/CPF).
- Ao gerar contrato, o admin **escolhe**: **Imprimir** (para assinatura física) ou **Gerar link de assinatura** (Assinafy). **Os campos novos aparecem nos dois modos**, pois usam o mesmo motor de renderização.

### Contexto

- `contracts` guarda: status (`rascunho|enviado|assinado|cancelado|aguardando_assinatura|expirado|erro`), `templateContentSnapshot`, `monthlyFee`, `dueDay`, `startDate`, `endDate`, `assinafyDocId`, `assinafySignUrl`, URLs do assinado e eventos (`drizzle/schema.ts:875-901`, `:31`).
- O PDF é gerado com `pdf-lib` a partir do `template.content` substituindo `{{variavel}}` (`contractService.ts:103-185`, `:408`).
- A criação via Assinafy usa `runCreateAssinafyContract` (`server/routers/helpers.ts:243-386`), exige CNPJ válido (`:264-287`) e cria signatário/assignment (`AssinafyProvider.ts:211-257`).
- Já existe busca de CEP (ViaCEP + BrasilAPI) em `client/src/pages/LandingPage.tsx:139-160` e CSP liberado em `server/_core/index.ts:1166-1167`.
- Padrão de impressão existente: `client/src/lib/printAgenda.ts`.

---

## 2. Usuários Envolvidos

- **Administrador / quem tem permissão de editar alunos:** preenche endereço, gera/imprime/assina contratos, mantém modelos e dados da escola.
- **Professor (sem permissão de editar aluno):** não edita endereço; pode visualizar conforme regras atuais.
- **Aluno/Responsável:** assina o contrato pelo link (fluxo atual do portal/Assinafy); não altera o modelo.
- **Equipe financeira/admin da escola:** configura dados da escola (razão social, endereço, representante legal).

---

## 3. Escopo

### Incluído

1. Endereço estruturado do aluno com **ViaCEP** e máscara de CEP.
2. Endereço estruturado + representante legal da **escola** em Configurações → Escola.
3. Novas **variáveis em PT-BR** no padrão Emusys + categorias na paleta de variáveis do editor de modelos.
4. **Botão/nível de modalidade na geração do contrato: Imprimir ou Gerar link de assinatura.**
5. `guardianCpf` (e novo `guardianRg`) editáveis no fluxo admin.
6. Correção das referências a colunas inexistentes no `contractService`.

### Fora do escopo

- Endereço internacional / campo "País" (contratos assumem Brasil).
- Validação de endereço por geolocalização ou correios além do ViaCEP/BrasilAPI.
- Armazenamento do PDF impresso na VPS (o PDF é re-renderizado do snapshot quando necessário).
- Assinatura física com upload de contrato assinado (digitalização).
- Alteração do fluxo de assinatura do aluno no portal.
- Migração dos modelos já existentes para as novas variáveis (continuam funcionando).

---

## 4. Requisitos Funcionais

### RF-001 — Endereço estruturado do aluno

**Descrição:** Adicionar ao cadastro do aluno os campos: CEP, Logradouro, Número, Complemento, Bairro, Cidade, UF. O campo único `address` continua existindo (espelhado automaticamente) para compatibilidade com portal e variáveis antigas.
**Atores:** quem pode criar/editar aluno.
**Pré-condições:** estar em Novo Aluno / Editar Aluno.
**Fluxo principal:**
1. Admin edita o aluno no passo "Dados Pessoais".
2. Preenche o CEP (8 dígitos, com máscara `00000-000`).
3. Sistema busca o endereço e preenche logradouro, bairro, cidade e UF.
4. Admin informa o Número (e Complemento, se houver).
5. Ao salvar, os campos estruturados são gravados e o campo `address` é regravado como `"Logradouro, Número, Bairro, Cidade - UF, CEP"`.
**Exceções:** CEP não encontrado → mensagem clara e preenchimento manual liberado; CEP incompleto → não busca.
**Dados:** `students.cep/street/addressNumber/addressComplement/district/city/state` + `students.address`.

### RF-002 — Busca automática de CEP (ViaCEP com fallback BrasilAPI)

**Descrição:** Ativar busca de CEP no formulário do aluno, reaproveitando o padrão já existente (`LandingPage.tsx`).
**Atores:** quem pode criar/editar aluno.
**Fluxo principal:**
1. Ao digitar o 8º dígito do CEP (ou sair do campo), o sistema consulta `https://viacep.com.br/ws/{cep}/json/`.
2. Em caso de falha da ViaCEP, consulta `https://brasilapi.com.br/api/cep/v2/{cep}`.
3. Preenche automaticamente Logradouro, Bairro, Cidade e UF.
4. Foco vai para o campo Número.
5. Estado de loading visível no campo (spinner) e mensagem de erro inline se não encontrar.
**Exceções:** offline/timeout → não bloqueia o cadastro; admin preenche manualmente; resposta `{erro: true}` → "CEP não encontrado".
**Dados:** consulta externa (sem persistência).

### RF-003 — Dados completos da escola (CONTRATADA)

**Descrição:** Adicionar em Configurações → Escola: Razão Social, Número, Complemento, Bairro, CEP, UF (Cidade já existe) e Representante Legal: Nome, RG, CPF (e cidade do responsável derivada da cidade da escola).
**Atores:** administrador.
**Pré-condições:** aba Escola habilitada.
**Fluxo principal:** admin preenche e salva; dados ficam em `settings` (fonte usada pelos contratos) e passam a alimentar as novas variáveis.
**Exceções:** campos sem preenchimento saem como linha pontilhada no contrato (`__________`) — comportamento atual.
**Dados:** novas colunas em `settings` (ver seção 8).

### RF-004 — Variáveis simples em português (padrão Emusys)

**Descrição:** Suportar no motor de contratos um conjunto de variáveis em PT-BR, compreensíveis para o usuário, **mantendo as 23 variáveis atuais** funcionando. A paleta do editor passa a exibir as variáveis agrupadas por categoria com nomes amigáveis (ex.: "Nome do Contratante — `{{nome_contratante}}`").
**Atores:** administrador (edita modelos).
**Fluxo principal:**
1. Admin abre Modelos de Contrato → paleta "Variáveis".
2. Vê categorias: **Contrato**, **Contratante**, **Contratada**, **Financeiro**, **Vigência e Aulas**, **Legado (compatibilidade)**.
3. Clica e insere a variável no cursor.
4. Prévia ao vivo e PDF final substituem os valores.
**Exceções:** variável sem dado → o placeholder é substituído por linha pontilhada (mantém comportamento atual de remover placeholders não preenchidos; ajuste: para variáveis conhecidas sem valor, usar `__________`).
**Dados:** mapa de variáveis (`contractService.buildContractVariables`).

### RF-005 — Vigência, parcelas e aulas a partir do plano/matrícula

**Descrição:** Preencher as variáveis de vigência/financeiro/aulas com dados reais do plano/matrícula do aluno:
- `{{meses_aula}}` e `{{meses_pagamento}}` = duração em meses do plano (`schoolPlans.duracaoMeses`) ou da matrícula (`student_enrollments.durationMonths`);
- `{{quantidade_aulas_total}}` = aulas por semana × 4,333 × meses (reusar `computeTotalLessons` de `ContractExpiryEngine.ts:33-38`);
- `{{aulas_por_semana}}` = `schoolPlans.aulasPorSemana` ou `student_enrollments.lessonsPerWeek`;
- `{{nome_plano}}` = `schoolPlans.nome`;
- `{{valor_parcela}}` = valor mensal do contrato; `{{valor_parcela_sem_desconto}}` = `schoolPlans.valorCheio` quando o plano for bolsa; senão igual à parcela;
- `{{taxa_inscricao}}` = `schoolPlans.taxaInscricao`;
- `{{dia_vencimento}}` = dia de vencimento do contrato;
- `{{data_inicial}}`/`{{data_final}}` = `contracts.startDate`/`endDate`, sugerindo `endDate` = início + duração do plano quando o admin não informar.
**Atores:** sistema (na geração).
**Exceções:** aluno sem plano/matrícula → variáveis de aulas/valores sem correspondência saem `__________`; contrato continua gerável.

### RF-006 — Escolha "Imprimir" ou "Gerar link de assinatura"

**Descrição:** No modal de geração do contrato, o admin escolhe a modalidade:
- **Imprimir contrato:** gera o PDF com o MESMO motor/variáveis, abre a impressão do navegador, grava o contrato com status `rascunho`, número reservado, snapshot do conteúdo e evento `contrato_impresso`. **Não chama a Assinafy.**
- **Gerar link de assinatura:** fluxo atual (`contracts.createAssinafy`), com link copiável e compartilhável — disponível apenas com integração Assinafy ativa e CNPJ válido.
**Atores:** administrador (com permissão).
**Pré-condições:** modelo selecionado; CNPJ válido da escola (regra atual).
**Fluxo principal (Imprimir):**
1. Admin clica "Imprimir contrato".
2. Sistema reserva número (`CT-AAAA-NNNN`), renderiza o PDF e abre a janela de impressão.
3. Contrato aparece na lista da ficha do aluno com status "Rascunho" e ação "Imprimir novamente".
**Fluxo principal (Link):** igual ao atual, com o link exibido para copiar/compartilhar.
**Exceções:** popup bloqueado → oferecer "Baixar PDF"; Assinafy sem integração → botão de link desabilitado com aviso "Configure a integração em Configurações → Integrações".
**Dados:** `contracts` (status `rascunho`, `templateContentSnapshot`, datas, valores), `contractEvents`.

### RF-007 — Botão "Imprimir" nos contratos existentes

**Descrição:** Na ficha do aluno (lista de contratos) e na página Contratos, adicionar ação **Imprimir** para contratos `rascunho|enviado|aguardando_assinatura|assinado`, re-renderizando o PDF do snapshot (para assinado, usar o documento assinado quando disponível).
**Atores:** admin/permissão de contratos.

### RF-008 — `guardianCpf` e `guardianRg` no fluxo admin

**Descrição:** Incluir CPF do responsável (coluna já existente, hoje só preenchida pela matrícula pública) e novo RG do responsável no formulário do aluno, nas procedures `students.create/update` e nas leituras `getForEdit/getDetails`, com máscara.
**Atores:** quem pode criar/editar aluno.
**Exceções:** CPF inválido → validação com mensagem (mesma regra do CPF do aluno).

### RF-009 — Correção das referências inexistentes no motor de contratos

**Descrição:** Com os novos campos, corrigir `contractService.ts:371-375` (cidade/UF do aluno) e `:396-400` (`guardian_rg`, `guardian_address`) para usar colunas reais; `{{student_address}}` passa a usar o endereço estruturado (fallback para `students.address`).

---

## 5. Regras de Negócio

### RN-001 — Número obrigatório no endereço
**Regra:** para salvar aluno com CEP preenchido, Número é obrigatório (aceita "S/N").
**Inválido:** CEP preenchido e Número vazio → bloqueia com mensagem no campo.

### RN-002 — CEP não bloqueia cadastro
**Regra:** falha na busca de CEP nunca impede salvar; os campos permanecem editáveis manualmente.

### RN-003 — Fonte de verdade do endereço
**Regra:** campos estruturados são a verdade; `students.address` é **espelho** gerado automaticamente na gravação (para portal e variáveis legadas). Edição direta do texto livre deixa de existir no formulário.

### RN-004 — Contratante das variáveis novas
**Regra:** `{{nome_contratante}}`, `{{cpf_contratante}}`, `{{rg_contratante}}` e endereço do contratante resolvem para o **responsável** quando o aluno for menor de idade E houver CPF/nome do responsável cadastrado; caso contrário, para o **aluno**. *(Suposição A-01 — ver seção 16.)*

### RN-005 — Variável sem valor vira linha pontilhada
**Regra:** variáveis conhecidas sem dado são substituídas por `__________` (não somem silenciosamente). Variáveis desconhecidas continuam sendo removidas (comportamento atual).

### RN-006 — Impressão não cria assinatura
**Regra:** gerar por impressão cria contrato com status `rascunho` e **não** envia nada à Assinafy. O contrato pode ser impresso quantas vezes quiser.

### RN-007 — Link de assinatura exige integração + CNPJ
**Regra:** mantém regra atual: sem integração Assinafy ativa ou sem CNPJ válido, o botão "Gerar link de assinatura" fica desabilitado com o motivo visível.

### RN-008 — Mesmo PDF nas duas modalidades
**Regra:** imprimir e assinar usam o mesmo `prepareContractRender`/variáveis; qualquer campo novo aparece obrigatoriamente nos dois.

### RN-009 — Número do contrato reservado antes de renderizar
**Regra:** `{{numero_contrato}}` deve estar disponível no PDF; na pré-visualização sem gerar, exibir `CT-AAAA-____`.

### RN-010 — Datas sugeridas pelo plano
**Regra:** se `endDate` não for informado, sugerir início + `duracaoMeses` do plano/matrícula (não obrigatório; o admin pode alterar). Isso corrige contratos gerados pela matrícula pública sem término.

---

## 6. Fluxos

### Fluxo principal — Cadastro do aluno com ViaCEP
```text
Admin abre Novo/Editar Aluno
↓
Dados Pessoais → digita CEP (máscara)
↓
Sistema consulta ViaCEP (fallback BrasilAPI)
↓
Preenche Logradouro/Bairro/Cidade/UF e foca Número
↓
Admin confirma Número/Complemento
↓
Salva → grava campos estruturados + espelha em address
```

### Fluxo principal — Gerar contrato
```text
Admin (ficha do aluno) → Gerar Contrato
↓
Modal: modelo, mensalidade, datas (pré-sugeridas pelo plano)
↓
Escolhe modalidade
├─ Imprimir → reserva número → gera PDF → abre impressão → salva contrato "rascunho"
└─ Link → valida integração/CNPJ → cria na Assinafy → salva contrato "aguardando_assinatura" → mostra link
```

### Fluxos alternativos
- **Sem planos cadastrados:** variáveis de plano/aulas saem `__________`; datas preenchidas manualmente.
- **Sem integração Assinafy:** somente Imprimir disponível.
- **ViaCEP fora do ar:** BrasilAPI; se ambas falharem, preenchimento manual com aviso.

### Fluxos de erro
- CEP inválido/não encontrado → aviso inline, sem bloqueio.
- CNPJ ausente/inválido ao gerar link → toast com link para Configurações.
- Falha ao renderizar → "Não foi possível gerar o contrato. Tente novamente." (erro técnico só no log).
- Popup de impressão bloqueado → oferecer download do PDF.

### Fluxo sem dados / vazio
- Modelos: se a org não tiver modelos, mantém criação automática dos padrões (comportamento atual) — agora com as novas variáveis nos modelos padrão.
- Lista de contratos vazia → estado vazio atual.

### Fluxo de permissão negada
- Sem permissão de editar aluno: campos de endereço somente leitura/ocultos; sem ações de contrato.

---

## 7. Casos Extremos

1. CEP com 8 dígitos inexistente (ViaCEP `{erro:true}`) → mensagem, preenchimento manual.
2. CEP igual para escola e aluno → sem conflito (entidades distintas).
3. Número "s/n", "123A", "123/456" → aceitar como texto.
4. Aluno menor sem responsável → `contratante_*` cai para o aluno (RN-004) e assinatura continua no aluno (comportamento atual do signatário).
5. Aluno sem plano/matrícula → variáveis financeiras/vigência parciais; contrato gerável.
6. Contrato sem `startDate`/`endDate` → campos pontilhados; sugestão automática pelo plano (RN-010).
7. Duplo clique em "Imprimir"/"Gerar link" → botões desabilitados durante a operação; sem contratos duplicados.
8. Reserva de número simultânea (dois admins) → reutilizar `getNextContractNumber` dentro da transação de criação; se colidir, gerar novamente (número não é único no banco hoje — avaliar índice único por org).
9. Modelo antigo com `{{student_address}}` → continua funcionando com o endereço espelhado.
10. Modelo com variável nova sem dado → `__________` (RN-005).
11. Impressão em mobile → PDF abre em visualizador; impressão depende do SO (mensagem de fallback "Baixar PDF").
12. Virada de mês/ano ao gerar sequência de datas → usar a mesma regra existente de clamp de mês (`renewByStudent`, `contratosRouters.ts:252-279`).
13. Fuso horário de `data_hoje`/extenso → sempre America/Sao_Paulo.
14. Empresa sem representante legal cadastrado → variáveis do responsável da escola pontilhadas (contrato ainda imprimível; link de assinatura continua exigindo apenas CNPJ, regra atual).
15. Texto extenso (endereço longo) no PDF → quebra de linha do motor atual (pdf-lib) já trata; testar limite de 100 caracteres por campo.
16. Aluno com CPF do responsável preenchido mas sem nome → não usar dados parciais (RN-004 exige nome + CPF).

---

## 8. Dados Envolvidos

### Novas colunas — `students` (nulas, retrocompatíveis)

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `cep` | varchar(9) | Não | Máscara 00000-000; 8 dígitos para busca |
| `street` | varchar(255) | Não | Logradouro |
| `addressNumber` | varchar(20) | Não* | *Obrigatório se CEP preenchido (RN-001) |
| `addressComplement` | varchar(100) | Não | Livre |
| `district` | varchar(100) | Não | Bairro |
| `city` | varchar(100) | Não | Cidade (corrige referência do contractService) |
| `state` | varchar(2) | Não | UF |
| `guardianRg` | varchar(30) | Não | RG do responsável |

### Novas colunas — `settings` (dados da CONTRATADA)

| Campo | Tipo | Regra |
|---|---|---|
| `schoolRazaoSocial` | varchar(255) | Fallback para `schoolName` |
| `schoolAddressNumber` | varchar(20) | Número do endereço |
| `schoolAddressComplement` | varchar(100) | Complemento |
| `schoolAddressDistrict` | varchar(100) | Bairro |
| `schoolCep` | varchar(9) | CEP |
| `schoolState` | varchar(2) | UF (separar do texto atual `schoolCity`) |
| `schoolLegalRepName` | varchar(255) | Representante legal |
| `schoolLegalRepRg` | varchar(30) | RG do representante |
| `schoolLegalRepCpf` | varchar(14) | CPF do representante |

### Migrações / bootstrap

- Adicionar as colunas em `server/db.ts` (padrão `ensureSchemaConsistency`) e em `server/_core/migrate.ts`; adicionar ao schema Drizzle.
- Sem backfill obrigatório: dados antigos permanecem em `students.address`/`settings.schoolAddress` e são usados como fallback.

### Índice sugerido

- Único por organização em `contracts.contractNumber` (avaliar; hoje não existe) para suportar RN-009/edge case 8.

---

## 9. Permissões e Segurança

| Ação | Quem pode |
|---|---|
| Ver/editar endereço do aluno | Quem tem permissão de criar/editar aluno (server-side já aplicado) |
| Ver endereço | Quem vê o aluno (admin/professor conforme regra atual); portal do aluno vê o próprio |
| Editar dados da escola | Administrador (`settings.updateSchool`) |
| Editar modelos/variáveis | Administrador — **corrigir**: `contractTemplates.*` hoje é `protectedProcedure`; passar a exigir admin/permissão |
| Gerar/Imprimir contrato | Administrador/permissão de contratos |
| Gerar link de assinatura | Administrador/permissão + integração ativa |

- Validações também no servidor (nunca só esconder botão): CEP, UF (2 letras), tamanhos de coluna.
- Erros nunca expõem stack/query; mensagens amigáveis + log interno.

---

## 10. Tratamento de Erros

| Situação | Mensagem (UI) | Backend |
|---|---|---|
| CEP não encontrado | "CEP não encontrado. Preencha o endereço manualmente." | — |
| ViaCEP/BrasilAPI indisponível | "Não foi possível buscar o CEP agora. Preencha manualmente." | log de aviso |
| Número vazio com CEP | "Informe o número do endereço." | validação zod |
| Sem CNPJ ao gerar link | "Cadastre o CNPJ da escola para gerar contratos." (link p/ Configurações) | `PRECONDITION_FAILED` (regra atual) |
| Sem integração Assinafy | Botão desabilitado: "Configure a integração em Configurações → Integrações." | — |
| Falha ao gerar PDF | "Não foi possível gerar o contrato. Tente novamente." | log técnico |
| Popup bloqueado | "Permita pop-ups ou baixe o PDF." | — |

---

## 11. Requisitos Não Funcionais

- **RNF-001 Performance:** busca de CEP ≤ 3s com spinner; impressão/PDF ≤ 5s para templates típicos; geração de contrato não bloqueia a UI (botão em loading).
- **RNF-002 Responsividade:** novos campos em grid 1 coluna no mobile e 2 no desktop, seguindo o padrão do passo Dados Pessoais.
- **RNF-003 Segurança:** CSP já libera ViaCEP/BrasilAPI (`server/_core/index.ts:1166-1167`); não logar CPF/RG em texto claro.
- **RNF-004 Compatibilidade:** modelos existentes e variáveis antigas continuam funcionando sem migração.
- **RNF-005 Consistência:** campos novos no wizard, no `getForEdit/getDetails` e na ficha (detalhes do aluno).
- **RNF-006 Acessibilidade:** labels associados, máscara não impede digitação colando CEP.
- **RNF-007 Impressão:** PDF gerado no servidor (mesmo renderizador), aberto em nova aba; fallback de download.

---

## 12. Critérios de Aceite

- **CA-001** Dado que o admin digita um CEP válido, quando o campo perde o foco, então logradouro/bairro/cidade/UF são preenchidos e o foco vai para Número.
- **CA-002** Dado CEP não encontrado, quando a busca termina, então aparece aviso e o formulário permanece preenchível manualmente.
- **CA-003** Dado CEP preenchido e Número vazio, quando salva, então o sistema bloqueia com mensagem no campo Número.
- **CA-004** Dado aluno salvo com endereço estruturado, quando abre a ficha/editar, então os campos voltam preenchidos e o campo `address` está espelhado.
- **CA-005** Dado um modelo com `{{nome_contratante}}`, `{{cep_escola}}`, `{{meses_aula}}`, `{{quantidade_aulas_total}}`, `{{data_hoje_extenso}}` e dados preenchidos, quando gera o contrato (imprimir OU link), então o PDF mostra os valores corretos nos dois modos.
- **CA-006** Dado o modal de geração, quando escolhe "Imprimir", então abre a impressão com o PDF e o contrato fica "Rascunho" sem enviar para Assinafy.
- **CA-007** Dado o modal de geração com integração ativa, quando escolhe "Gerar link", então o comportamento atual é mantido e o link pode ser copiado.
- **CA-008** Dado integração Assinafy inativa, quando abre o modal, então "Gerar link" está desabilitado com o motivo visível e "Imprimir" funciona.
- **CA-009** Dado contrato salvo por impressão, quando reabre a ficha, então existe ação "Imprimir novamente" que re-renderiza do snapshot.
- **CA-010** Dado aluno menor com responsável (nome+CPF), quando gera contrato, então `{{*_contratante_*}}` usam os dados do responsável; sem responsável, usam os do aluno.
- **CA-011** Dado plano com 12 meses e 1 aula/semana, quando gera, então `{{quantidade_aulas_total}}` = 52 (12×4,333 arredondado) e `{{meses_pagamento}}` = 12.
- **CA-012** Dado contrato antigo com `{{student_address}}`, quando gera/imprime, então o endereço aparece (espelho), sem quebrar o modelo.
- **CA-013** Dado cadastro sem plano, quando gera, então variáveis sem dado saem `__________` e o contrato é gerado.

---

## 13. Riscos e Dependências

### Riscos
- **Dados duplicados de endereço da escola** (settings × organizations × fiscalCompanies) — mitigação: contratos continuam lendo `settings` com fallback para `organizations`.
- **Placeholders antigos em modelos de clientes** — mitigação: manter as 23 variáveis atuais (compatibilidade).
- **ViaCEP/BrasilAPI fora** — fallback duplo + manual (já mitigado).
- **Popup de impressão bloqueado em alguns navegadores** — fallback de download.
- **Re-render do snapshot de contratos assinados pode divergir do PDF assinado** — para assinados, priorizar `signedDocumentUrl` (documento oficial).
- **CNPJ obrigatório** continua bloqueando contratos; é regra vigente (não alterada).

### Dependências
- APIs públicas ViaCEP/BrasilAPI (CSP já liberada).
- Integração Assinafy (BYOK) para o modo link.
- `schoolPlans`/`student_enrollments` preenchidos para variáveis de vigência/aulas.
- Migração de colunas via bootstrap (`server/db.ts`) no deploy.

---

## 14. Métricas de Sucesso

- Redução do tempo de cadastro de aluno (menos digitação de endereço).
- % de contratos gerados por impressão vs. link (adoção).
- Redução de contratos com campos em branco (placeholders) no PDF.
- Nenhum contrato emitido com endereço incompleto quando o CEP foi informado.

---

## 15. Plano de Implementação Sugerido

### Fase 1 — Dados
1. Colunas em `students` e `settings` (schema + bootstrap `server/db.ts` + `server/_core/migrate.ts`).
2. Índice único opcional `contracts(organizationId, contractNumber)`.

### Fase 2 — Backend
3. `students.create/update/getForEdit/getDetails`: campos novos + `guardianCpf`/`guardianRg` + espelho de `address`.
4. `plataformaRouters.settings.updateSchool`: campos novos da escola.
5. `contractService.buildContractVariables`: novas variáveis PT-BR + categorias + fallbacks (contratante, escola, financeiro, vigência) + correção das colunas fantasma.
6. `prepareContractRender`: número do contrato antes do render; datas sugeridas pelo plano.
7. Nova procedure `contracts.printContract` (persiste rascunho + snapshot + evento; retorna PDF) e ajuste em `createAssinafy` para reutilizar o mesmo contexto.
8. Permissões: `contractTemplates.*` e geração/impressão para admin/permissão.

### Fase 3 — Frontend
9. Wizard (passo Dados Pessoais): campos estruturados + ViaCEP + máscara CEP (`client/src/lib/masks.ts`) + grid responsivo.
10. `StudentDetailsModal`/`StudentModal`: exibir/editar os campos novos (conforme permissão).
11. Configurações → Escola: campos novos + ViaCEP para o CEP da escola.
12. `ModelosContratoTab`: paleta categorizada com as novas variáveis (label amigável + placeholder).
13. `CreateContractModal`: botões "Imprimir contrato" e "Gerar link de assinatura" (com estados/desabilitados).
14. Ação "Imprimir" na lista de contratos (ficha e página Contratos).

### Fase 4 — Integrações
15. Reuso ViaCEP/BrasilAPI (extrair helper compartilhado a partir da `LandingPage`).
16. Impressão: abrir PDF em nova aba (padrão `printAgenda`) com fallback de download.

### Fase 5 — Testes
17. Vitest: construção de variáveis (contratante menor/maior, plano presente/ausente), datas sugeridas, espelho de endereço, categorização da paleta.
18. Manual/E2E: ViaCEP real, impressão nos 2 modos, contrato antigo, sem plano, sem Assinafy.

---

## 16. Decisões Pendentes (suposições marcadas)

- **A-01 (RN-004)** — Contratante = responsável quando menor? *Suposição adotada: sim, se nome+CPF do responsável existirem; senão aluno.*
- **A-02** — Manter `students.address` como espelho (não remover). *Suposição adotada: sim.*
- **A-03** — `{{valor_parcela_sem_desconto}}` = `valorCheio` do plano quando bolsa; senão igual à parcela. *Suposição adotada.*
- **A-04** — Contrato impresso nasce como `rascunho`; envio para assinatura depois é possível via fluxo existente? *Suposição adotada: sim (reaproveitar ação), sem novo botão nesta fase.*
- **A-05** — Sem campo "País" (Brasil fixo). *Suposição adotada.*

---

## 17. Anexo — Mapa de Variáveis

### Variáveis existentes (mantidas)

`{{school_name}}, {{school_cnpj}}, {{school_address}}, {{school_phone}}, {{school_email}}, {{student_name}}, {{student_cpf}}, {{student_rg}}, {{student_birth_date}}, {{student_email}}, {{student_phone}}, {{student_address}}, {{guardian_name}}, {{guardian_cpf}}, {{guardian_rg}}, {{guardian_phone}}, {{guardian_email}}, {{guardian_address}}, {{instrument}}, {{monthly_fee}}, {{due_date}}, {{contract_start_date}}, {{contract_end_date}}` (`contractService.ts:215-247`)

### Novas variáveis (padrão Emusys)

| Categoria | Variável | Equivalente Emusys | Fonte |
|---|---|---|---|
| Contrato | `{{numero_contrato}}` | Número do Contrato de Adesão | `contracts.contractNumber` |
| Contrato | `{{ano_atual}}` | / Ano Atual | ano da geração (BRT) |
| Contrato | `{{data_hoje}}` | — | data atual (BRT) |
| Contrato | `{{data_hoje_extenso}}` | Data de hoje Por Extenso | data atual por extenso (pt-BR) |
| Contratante | `{{nome_contratante}}` | Nome do Contratante | RN-004 |
| Contratante | `{{rg_contratante}}` | RG do Contratante | RN-004 |
| Contratante | `{{cpf_contratante}}` | CPF do Contratante | RN-004 |
| Contratante | `{{logradouro_contratante}}` | Logradouro do Contratante | aluno/responsável |
| Contratante | `{{numero_endereco_contratante}}` | Número do Endereço do Contratante | aluno/responsável |
| Contratante | `{{complemento_contratante}}` | — | aluno/responsável |
| Contratante | `{{bairro_contratante}}` | Bairro do Contratante | aluno/responsável |
| Contratante | `{{cep_contratante}}` | CEP do Contratante | aluno/responsável |
| Contratante | `{{cidade_contratante}}` | Cidade do Contratante | aluno/responsável |
| Contratante | `{{estado_contratante}}` | — | aluno/responsável |
| Contratada | `{{nome_fantasia_escola}}` | Nome Fantasia da Escola | `settings.schoolName` |
| Contratada | `{{razao_social_escola}}` | Razão Social da Escola | `settings.schoolRazaoSocial` |
| Contratada | `{{cnpj_escola}}` | CNPJ da Escola | `settings.schoolCnpj` |
| Contratada | `{{logradouro_escola}}` | Logradouro da Escola | `settings.schoolAddress` |
| Contratada | `{{numero_endereco_escola}}` | Número do Endereço da Escola | novo |
| Contratada | `{{complemento_escola}}` | — | novo |
| Contratada | `{{bairro_escola}}` | Bairro da Escola | novo |
| Contratada | `{{cep_escola}}` | CEP da Escola | novo |
| Contratada | `{{cidade_escola}}` | Cidade da Escola | `settings.schoolCity` |
| Contratada | `{{estado_escola}}` | Estado da Escola | novo |
| Contratada | `{{telefone_escola}}` | — | `settings.schoolPhone` |
| Contratada | `{{email_escola}}` | — | `settings.schoolEmail` |
| Contratada | `{{nome_responsavel_escola}}` | Nome do Responsável pela Escola | novo |
| Contratada | `{{rg_responsavel_escola}}` | RG do Responsável pela Escola | novo |
| Contratada | `{{cpf_responsavel_escola}}` | CPF do Responsável pela Escola | novo |
| Contratada | `{{cidade_responsavel_escola}}` | Cidade do Responsável pela Escola | cidade da escola |
| Financeiro | `{{valor_parcela}}` | Valor da Parcela | `contracts.monthlyFee` |
| Financeiro | `{{valor_parcela_sem_desconto}}` | Valor da Parcela sem Desconto | `schoolPlans.valorCheio` (bolsa) |
| Financeiro | `{{meses_pagamento}}` | Meses de pagamento | plano/matrícula |
| Financeiro | `{{taxa_inscricao}}` | — | `schoolPlans.taxaInscricao` |
| Financeiro | `{{dia_vencimento}}` | — | `contracts.dueDay` |
| Vigência | `{{data_inicial}}` | Data Inicial | `contracts.startDate` |
| Vigência | `{{data_final}}` | Data Final | `contracts.endDate` |
| Vigência | `{{meses_aula}}` | Meses de aula | plano/matrícula |
| Vigência | `{{aulas_por_semana}}` | — | plano/matrícula |
| Vigência | `{{quantidade_aulas_total}}` | Quantidade de Aulas no Total | `computeTotalLessons` |
| Vigência | `{{nome_plano}}` | — | `schoolPlans.nome` |
