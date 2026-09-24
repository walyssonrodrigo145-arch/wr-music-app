# PRD — Simulador de Planos e Preços (página pública `/planos`)

> Versão: 1.1 · Data: 2026-09-24 · Status: Implementado (v1.1) em 2026-09-24
> Revisão 1.1: total com N alunos em todos os cards (RN-011), teto de 200 excedentes no plano de 1.000 alunos com negociação acima de 1.200 (RN-012) e correção da "indicação fantasma" no cadastro (código de indicação agora é por sessão).
> Implementação: `shared/planPricing.ts`, `server/planPricing.test.ts`, `client/src/components/planos/PlanSimulator.tsx`, integração em `client/src/pages/SeoSite.tsx`, deep link `?plan=` em `client/src/pages/Cadastro.tsx`, release em `shared/releases.ts`.
> Autor: Skill `prdspec` (Análise de Sistemas / Product)
> Referência visual: simulador da emusys (print enviado pelo solicitante) + página atual `/planos` do MusicPro.

---

## 1. Visão Geral

### Problema

A página pública `/planos` (`shared/seo/core.ts:73-116`, renderizada por `client/src/pages/SeoSite.tsx`) **não exibe nenhum preço**. Ela só traz texto institucional, FAQ e um CTA para `/cadastro`. O visitante precisa sair da página (ir para a landing `/` ou para o cadastro) para descobrir quanto custa e **não consegue simular quanto pagaria** com a quantidade de alunos que ele tem — principalmente quando passa do limite do plano (alunos excedentes). Além disso, não há nenhuma comunicação explícita de que **não existe taxa de implantação** nem contrato de fidelidade, o que é um diferencial competitivo relevante (a emusys, por exemplo, cobra R$ 289 de implantação — print de referência).

### Objetivo

Adicionar à página `/planos` um **simulador interativo** que:

1. Liste **todos os planos ativos pagos cadastrados** no banco (`system_plans`), com preço mensal, limite de alunos e valor de aluno excedente.
2. Permita ao visitante informar quantos **alunos ativos pagantes** a escola tem e ver, em tempo real, o **valor do plano recomendado + cálculo explícito dos alunos excedentes**.
3. Deixe explícito: **sem taxa de implantação** e **sem contrato de fidelidade** (cancele quando quiser).
4. Converta o visitante levando-o ao `/cadastro` com o plano escolhido pré-selecionado.

### Contexto

- Os planos/preços **não estão no repositório**: vivem na tabela `system_plans` (`drizzle/schema.ts:1126-1144`), gerenciada pelo Super Admin (`/master-panel`, `server/superAdminRouter.ts:559-617`). Campos relevantes: `id`, `name`, `priceMonthly`, `priceYearly`, `maxStudents` (999999 = ilimitado na prática), `features`, `isPopular`, `order`, `allowExtraStudents`, `extraStudentPrice` (default `1.49`).
- A página `/planos` é pré-renderizada por `scripts/prerender.ts` (HTML sem JS para crawlers) e depois hidratada pelo React — **os preços só existirão no DOM após o JS rodar** (aceitável; decisão registrada em Fora do Escopo).
- Já existe a query pública correta para reutilizar: `publicData.getSignupPlans` (`server/routers/authRouters.ts:130-141`) — todos os planos ativos com `priceMonthly > 0`, **mesma fonte usada pelo `/cadastro`** (`client/src/pages/Cadastro.tsx:23`). Isso garante que o simulador nunca mostre um plano que o cadastro não ofereça.
- Já existe a regra de excedente no backend (`server/routers/helpers.ts:135-193`), com a fórmula:
  `excessCount = max(0, ativos − maxStudents)` · `excessFee = (allowExtra && excessCount > 0) ? excessCount × extraStudentPrice : 0` · `total = base + excessFee`.
  O simulador **deve espelhar exatamente essa fórmula** (ciclo mensal).
- A landing já comunica "Sem fidelidade. Cancele ou mude de plano quando quiser." (`client/src/pages/LandingPage.tsx:600`, `:1082-1089`, `:1582`). **Não existe taxa de implantação em lugar nenhum do código nem no banco** (auditado).
- Decisão do solicitante: **v1 somente mensal** (toggle anual desabilitado/sem toggle) até a regra de excedente no ciclo anual ser definida no backend.

---

## 2. Usuários Envolvidos

| Ator | Descrição | Como usa |
| --- | --- | --- |
| Visitante / prospect (principal) | Dono de escola de música, conservatório ou professor particular, majoritariamente em celular | Acessa `/planos`, informa a quantidade de alunos, vê o preço e vai para `/cadastro` |
| Visitante recorrente | Já conhece o produto e quer só conferir o preço da faixa dele | Usa o simulador e clica direto no CTA |
| Crawler / SEO | Googlebot e afins | Consome o HTML pré-renderizado (conteúdo institucional permanece; simulador é client-side) |
| Super Admin | Mantém planos e preços no `/master-panel` | **Não usa o simulador**; é o responsável pela fonte de dados (fora do escopo alterar) |

Observação: a página é pública — **não há autenticação, papel ou permissão de usuário envolvida no simulador**.

---

## 3. Escopo

### Incluído

1. Nova seção "simulador de planos" na página `/planos` (componente novo, client-side).
2. Grid com **todos os planos ativos pagos** (`getSignupPlans`): nome, preço mensal, limite de alunos, valor do excedente, selo "Mais escolhido" (`isPopular`).
3. Slider + campo numérico para a quantidade de **alunos ativos pagantes**.
4. Seleção automática do **plano recomendado** pela faixa de alunos + possibilidade de fixar ("simular com este plano") clicando em um card.
5. Cálculo em tempo real de: valor base, quantidade de excedentes, subtotal de excedentes e **total mensal**, com memória de cálculo explícita.
6. Tratamento de plano que **não aceita excedentes** (`allowExtraStudents = false`): aviso + recomendação automática do próximo plano que comporta a quantidade.
7. Selos de confiança: **"Sem taxa de implantação"** e **"Sem contrato — cancele quando quiser"** (+ teste grátis de 7 dias, já existente no contexto).
8. Estados de loading, erro e vazio.
9. CTA que leva a `/cadastro?plan=<id>` com o plano **pré-selecionado** (pequeno ajuste no `Cadastro.tsx`).
10. Função pura de cálculo testável + testes automatizados.
11. Entrada no "What's New" (`shared/releases.ts`) conforme regra do `AGENTS.md`.

### Fora do escopo

1. Criar/editar planos, preços ou política de excedente (continua no Super Admin).
2. Cobrança, checkout, Asaas, cupons (`/checkout`, `platform.checkout`, `platform.changePlan`).
3. Alterar a **landing page** (`LandingPage.tsx`) ou o simulador em outras páginas.
4. Toggle/valores de **ciclo anual** — v1 é somente mensal (decisão registrada).
5. Corrigir o preço hardcoded do `Checkout.tsx:148` ("R$ 49/499") e a meta description "a partir de R$ 49,99" (`shared/seo/core.ts:78`) — registrados como riscos/divergências pré-existentes.
6. Simulador dentro do app logado (`/assinatura` já tem a política de excedentes em `client/src/pages/Assinatura.tsx:229-268`).
7. Internacionalização, exportação de simulação, salvar simulação.

---

## 4. Requisitos Funcionais

### RF-001 — Carregar planos reais do banco

**Descrição:** a seção do simulador consome `trpc.publicData.getSignupPlans` (sem criar endpoint novo) e normaliza os dados com `parseBRL` (`client/src/lib/money.ts:11`).
**Atores:** visitante.
**Pré-condições:** banco acessível; existir ≥ 1 plano ativo com `priceMonthly > 0`.
**Fluxo principal:**
1. A página `/planos` renderiza.
2. O componente dispara a query (reaproveitando o cache do React Query, se a página já a tiver disparado).
3. Os planos são ordenados por `order` asc e, em empate, por `priceMonthly` asc (mesma ordenação do backend).
4. Os cards e o slider são montados.
**Exceções:** ver §10.
**Dados envolvidos:** `system_plans` (somente leitura).
**Campos usados:** `id`, `name`, `priceMonthly`, `maxStudents`, `allowExtraStudents`, `extraStudentPrice`, `isPopular`, `order`.

---

### RF-002 — Grid com todos os planos e preços

**Descrição:** exibir um card por plano retornado, contendo obrigatoriamente:

| Elemento | Regra de exibição |
| --- | --- |
| Nome | `name` |
| Preço | `formatBRL(priceMonthly)` + sufixo `/mês` |
| Limite | `maxStudents >= 999999` → "Alunos ilimitados"; senão "Até N alunos" |
| Excedente | `allowExtraStudents` → "+ R$ X,XX por aluno excedente/mês"; senão "Não aceita alunos excedentes" |
| Selo | `isPopular` → "Mais escolhido" |
| Ação | Clicar no card seleciona o plano para simulação (ver RF-005); o `id` selecionado fica com destaque visual |

**Atores:** visitante.
**Pré-condições:** planos carregados.
**Fluxo principal:** renderizar grid responsivo (1 coluna em telas < 640 px; 2–3 colunas acima).
**Exceções:** nenhum plano → seção inteira oculta (ver §10).
**Dados envolvidos:** dados de RF-001.

---

### RF-003 — Seleção da quantidade de alunos

**Descrição:** o visitante informa quantos **alunos ativos pagantes** a escola tem, por slider e por campo numérico sincronizados.

**Atores:** visitante.
**Pré-condições:** ≥ 1 plano carregado.
**Fluxo principal:**
1. O campo numérico e o slider compartilham o mesmo estado local (`number`, em alunos).
2. Arrastar o slider atualiza o número; digitar um número válido atualiza o slider.
3. A cada mudança, RF-004/RF-005 são recalculados imediatamente (sem chamada de rede).
4. Texto de apoio fixo: "Alunos ativos pagantes. Alunos bolsistas não entram na conta."
**Exceções:** valores fora do intervalo, vazios ou não numéricos são tratados em RN-005/§7.
**Dados envolvidos:** nenhum dado persistido — estado apenas local.

---

### RF-004 — Cálculo de excedentes e total (mensal)

**Descrição:** calcular e exibir, em tempo real e de forma explícita, o valor mensal do plano selecionado considerando excedentes.

**Atores:** visitante.
**Pré-condições:** plano selecionado + quantidade de alunos definida.
**Fluxo principal:**
1. Calcular `excedentes = max(0, alunos − maxStudents)`.
2. Calcular `subtotalExcedentes = excedentes × extraStudentPrice` (somente se `allowExtraStudents`).
3. Calcular `total = priceMonthly + subtotalExcedentes`.
4. Exibir a memória de cálculo:
   - **Dentro do limite:** "Plano até N alunos · sem excedentes" e o total = preço base.
   - **Com excedentes:** "{alunos − N} aluno(s) excedente(s) × R$ X,XX = R$ Y,YY/mês" + "{formatBRL(base)} + {formatBRL(subtotal)} = {formatBRL(total)}/mês".
5. Exibir o total em destaque (tipografia grande, como no print de referência).
**Exceções:** ver RN-003/RN-004.
**Dados envolvidos:** `priceMonthly`, `maxStudents`, `allowExtraStudents`, `extraStudentPrice`.

---

### RF-005 — Plano recomendado automático + seleção manual ("fixar")

**Descrição:** o simulador sugere o plano adequado à quantidade informada e permite o visitante escolher outro manualmente.

**Regras de seleção (detalhadas em RN-006):**
1. Por padrão, seleciona o **menor plano cujo `maxStudents >= alunos`**.
2. Se a quantidade exceder o limite de todos os planos finitos e existir plano "ilimitado" (`maxStudents >= 999999`), seleciona o ilimitado.
3. Se o plano derivado **não aceita excedentes** e a quantidade o excede, avança para o próximo plano que comporta (RN-004) — ainda que não haja excedente no plano derivado.
4. Ao clicar em um card (RF-002), o plano fica **fixado**; mudanças no slider **não** trocam a seleção fixada.
5. Quando fixado e diferente do recomendado, exibir link discreto "Usar plano recomendado" que remove a fixação e volta a derivar.
6. A fixação é apenas estado local (não persiste ao recarregar).
**Atores:** visitante.
**Pré-condições:** planos carregados.
**Fluxo principal:** slider movimenta → recomendação atualiza (se não fixado); card clicado → fixação.
**Exceções:** quantidade excede todos os planos e nenhum aceita excedente → estado "sob medida" (RN-004) com CTA de WhatsApp.
**Dados envolvidos:** dados de RF-001 + estado local.

---

### RF-006 — Plano sem excedentes: recomendação de upgrade

**Descrição:** quando o visitante simula uma quantidade que excede um plano com `allowExtraStudents = false`, o sistema **não calcula excedente** e sim recomenda o próximo plano que comporta a quantidade.

**Atores:** visitante.
**Pré-condições:** plano derivado/fixado com `allowExtraStudents = false` e `alunos > maxStudents`.
**Fluxo principal:**
1. Exibir alerta: "O plano {nome} não aceita alunos excedentes."
2. Localizar o menor plano com `maxStudents >= alunos` (preferindo planos que aceitam excedente em caso de empate) e exibi-lo como "Plano recomendado".
3. O CTA aponta para o plano recomendado.
**Exceções:** nenhum plano comporta a quantidade → §10 (estado "sob medida").
**Dados envolvidos:** dados de RF-001.

---

### RF-007 — Selos de confiança (sem implantação / sem contrato)

**Descrição:** exibir, de forma visível e não ambígua, próximo ao preço e ao CTA:

- **"Sem taxa de implantação"** (pode complementar: "Não cobramos implantação, adesão ou setup.")
- **"Sem contrato — cancele quando quiser"** (alinhado à copy já usada na landing)
- **"7 dias grátis, sem cartão"** (já é padrão do produto)

**Atores:** visitante.
**Pré-condições:** nenhuma.
**Fluxo principal:** renderizar os selos como itens com ícone (ex.: `CheckCircle2`, `ShieldCheck`).
**Exceções:** nenhuma.
**Dados envolvidos:** texto estático no client (não vem do banco).

---

### RF-008 — CTA com plano pré-selecionado

**Descrição:** o botão principal do simulador ("Criar conta e testar grátis") navega para `/cadastro?plan=<id do plano selecionado>`; o cadastro deve abrir com esse plano já selecionado.

**Atores:** visitante.
**Pré-condições:** plano selecionado; modificação necessária em `client/src/pages/Cadastro.tsx` (hoje só lê `?ref=`, linhas 45-53).
**Fluxo principal:**
1. Clique no CTA → `wouter` navega (ou `window.location`) para `/cadastro?plan=<id>`.
2. No `Cadastro.tsx`, ler `?plan=`; se o `id` existir em `getSignupPlans`, usar como `selectedPlanId` inicial (respeitando a regra de ciclo mensal, que é o default).
3. Se o `id` não existir/estiver inativo, manter o comportamento atual (primeiro plano popular ou primeiro da lista).
4. Preservar o fluxo de indicação (`?ref=`/localStorage) sem regressão.
**Exceções:** parâmetro inválido → fallback para o comportamento atual, sem erro visível.
**Dados envolvidos:** `system_plans.id`.

---

### RF-009 — Estados de UI (loading, erro, vazio)

**Descrição:** a seção nunca deixa a página quebrada nem o usuário sem feedback.

1. **Loading:** mostrar *skeleton* com a mesma altura da seção (~card 360 px + grid) para evitar layout shift; não exibir texto de preço.
2. **Erro:** mensagem "Não foi possível carregar os planos agora." + botão "Tentar novamente" (refetch). O restante da página `/planos` continua funcional.
3. **Vazio:** se `getSignupPlans` retornar lista vazia, **não renderizar** a seção (nem skeletons), mantendo o CTA institucional existente.
**Atores:** visitante.
**Pré-condições:** consulta em andamento/erro/lista vazia.
**Fluxo principal:** conforme acima.
**Dados envolvidos:** estado da query.

---

### RF-010 — Integração com a página `/planos` existente

**Descrição:** inserir a seção apenas na página com `kind === "plans"` (`client/src/pages/SeoSite.tsx:394-407`), preservando 100% do conteúdo atual (intro, seções, FAQ, aside CTA) por motivos de SEO e para não regredir a pré-renderização (`scripts/prerender.ts:75-83`).

**Atores:** visitante / crawler.
**Pré-condições:** rota `/planos`.
**Fluxo principal:** `SeoPageView` renderiza `<PlanSimulator />` entre o cabeçalho e as seções de conteúdo (proposta: após o bloco de capa/mídia e antes de `sections`).
**Exceções:** nenhuma.
**Dados envolvidos:** nenhum.

---

### RF-011 — "What's New"

**Descrição:** adicionar entrada no topo de `shared/releases.ts` (obrigatório pelo `AGENTS.md`): `version` única (ex.: `2026.09.24`), `date`, `title` ("Simulador de planos na página de preços"), `summary` e `items[]` com `type: "novo"`.

**Atores:** sistema.
**Pré-condições:** funcionalidade concluída.
**Dados envolvidos:** `shared/releases.ts`.

---

## 5. Regras de Negócio

### RN-001 — Fonte de verdade dos planos

**Regra:** o simulador usa exclusivamente `publicData.getSignupPlans` (planos `isActive = true` e `priceMonthly > 0`). Nenhum preço pode ser hardcoded no componente.
**Exemplo válido:** preço alterado no `/master-panel` reflete no próximo carregamento da página.
**Exemplo inválido:** componente com "R$ 49,99" fixo no JSX (prática existente no `Checkout.tsx:148`, que **não** deve ser copiada).
**Consequência:** divergência entre o simulador e o banco é considerada bug de severidade alta.

### RN-002 — Universo contado: alunos ativos pagantes

**Regra:** a simulação refere-se a **alunos ativos pagantes** da escola; bolsistas não entram na conta (mesma regra do enforcement do backend, que conta `students.status = 'ativo'`, `helpers.ts:145-147`).
**Consequência:** texto explicativo obrigatório junto ao campo (RF-003).

### RN-003 — Fórmula do excedente (espelho exato do backend, ciclo mensal)

**Regra:**
```
excedentes        = max(0, alunos − maxStudents)
subtotalExcedente = allowExtraStudents ? excedentes × extraStudentPrice : 0
totalMensal       = priceMonthly + subtotalExcedente
```
**Exemplo válido:** plano R$ 99,00, limite 30, excedente R$ 1,49, `allowExtraStudents = true`, alunos = 35 → 5 excedentes = R$ 7,45 → total R$ 106,45.
**Exemplo inválido:** cobrar excedente em plano com `allowExtraStudents = false`.
**Consequência:** exibir exatamente esses números; mesma base do que o Asaas cobrará (`helpers.ts:154-163`).

### RN-004 — Falta de excedente não bloqueia a simulação, mas recomenda upgrade

**Regra:** se `allowExtraStudents = false` e `alunos > maxStudents`, o valor do plano atual **não é exibido como total válido**; o simulador seleciona e exibe o menor plano que comporta a quantidade (aquele com `maxStudents >= alunos`; em empate, prefere `allowExtraStudents = true`) como **"Plano recomendado"**.
**Exemplo válido:** plano "Iniciante" até 20 alunos sem excedentes + 35 alunos → recomenda "Escola" até 50 alunos com o preço dele.
**Exemplo inválido:** mostrar "R$ 49,90/mês" para 35 alunos no plano de 20 sem excedentes.
**Consequência:** se **nenhum** plano comportar a quantidade (ex.: todos os planos finitos e sem excedente), exibir estado "sob medida": "Sua escola precisa de um plano sob medida." + CTA "Falar com um especialista" (WhatsApp `https://wa.me/5533984055949`, já usado em `LandingPage.tsx:803`).

### RN-005 — Normalização e limites de entrada

**Regra:**
- Valor vazio no input → não recalcular; manter o último valor válido até digitar número válido ou sair do campo (blur restaura o último válido).
- Valores negativos ou 0 → clamp para `sliderMin` (mínimo calculado em RN-007).
- Valores acima de `sliderMax` → clamp para `sliderMax`.
- Entrada não numérica → ignorada (mantém valor atual).
- Números fracionários → arredondar para inteiro mais próximo (`Math.round`).
**Consequência:** o total exibido nunca fica negativo, `NaN` ou `Infinity`.

### RN-006 — Derivação do plano recomendado (faixa)

**Regra:** dado `alunos`:
1. Ordenar planos por `maxStudents` asc (empate: preço asc).
2. Selecionar o primeiro com `maxStudents >= alunos`.
3. Se nenhum (incluindo os ilimitados), selecionar o plano com maior `maxStudents`.
4. Se o plano derivado não aceitar excedentes e estiver excedido, aplicar RN-004.
5. Plano com `maxStudents >= 999999` é tratado como "ilimitado" e **nunca** gera excedente (exibe "Alunos ilimitados").
**Exemplo válido:** planos 20/50/100; alunos = 35 → recomendado = plano 50.
**Exemplo inválido:** alunos = 35 e recomendação = plano 20 com excedentes quando existe plano 50 com total menor/igual — a recomendação é por **faixa**, não por menor preço total (otimização de custo fica fora do escopo v1 — ver §3).
**Consequência:** seleção previsível e alinhada ao print de referência (emusys), sem sugerir downgrade arriscado.

### RN-007 — Intervalo do slider

**Regra:**
```
limitesFinitos = planos com maxStudents < 999999
sliderMin      = max(1, min(limitesFinitos.maxStudents))   // se não houver finitos → 10
maiorFinito    = max(limitesFinitos.maxStudents)           // se não houver finitos → 500
sliderMax      = clamp( ceil( max(maiorFinito * 1.5, 500) / 50 ) * 50 , 50, 5000 )
valorInicial   = sliderMin
```
**Exemplo válido:** planos com limites 10/30/100 → sliderMin = 10, maiorFinito = 100, sliderMax = 500 (pois `max(150,500)=500`).
**Exemplo inválido:** slider limitado a 100 quando existe plano de 100 alunos — impossibilitaria simular excedentes no maior plano.
**Consequência:** passo de 1 aluno; extremos do slider mostram rótulos "10" e "500+".

### RN-008 — Fixação versus recomendação automática

**Regra:** clicar em um card fixa o plano para simulação; mover o slider/campo **não** altera a fixação. A fixação é limpa ao clicar em "Usar plano recomendado" ou ao recarregar a página.
**Consequência:** o visitante pode comparar "meu plano atual" com o recomendado sem perder referência.

### RN-009 — Arredondamento monetário

**Regra:** todos os cálculos de dinheiro são feitos em **centavos inteiros** (`Math.round(valor × 100)`) e convertidos para exibição apenas na borda (`formatBRL`). Nunca acumular floats diretamente.
**Exemplo válido:** `99.00 + 5 × 1.49 = 106.45` → `formatBRL` → `R$ 106,45`.
**Exemplo inválido:** `0.1 + 0.2` produzindo `R$ 106,449999...`.
**Consequência:** consistência financeira com o backend (tolerância de R$ 0,01 usada em `helpers.ts:169`).

### RN-010 — Ciclo mensal apenas (v1)

**Regra:** o simulador exibe apenas valores mensais. Não exibir toggle mensal/anual nem valor anual.
**Justificativa registrada:** o backend, no ciclo anual, soma o excedente **uma única vez** (`priceYearly + excessFee`, `helpers.ts:162-163`) — decisão de produto pendente. Enquanto isso não for resolvido, exibir anual poderia gerar expectativa divergente da cobrança.
**Consequência:** se um dia o toggle for adicionado, este PRD deve ser revisado junto com a regra de cobrança anual.

### RN-011 — Total em todos os cards (revisão 1.1)

**Regra:** todos os cards de plano exibem "Total com {N} alunos: R$ X/mês", somando o preço base com os excedentes calculados pelo `extraStudentPrice` **do próprio plano**. Quando o plano não cobre a quantidade, exibir "Não cobre {N} alunos" (âmbar); sem excedente, apenas "Total: R$ base/mês".
**Exemplo válido:** planos com excedente de R$ 1,49 e R$ 0,99 mostram totais diferentes para os mesmos 35 alunos.
**Exemplo inválido:** usar um valor de excedente único para todos os planos ou mostrar total só no card selecionado.
**Consequência:** o visitante compara o custo real de cada plano para o tamanho da escola dele.

### RN-012 — Teto de excedentes do plano de 1.000 alunos (revisão 1.1)

**Regra:** o plano cujo limite é 1.000 alunos aceita no máximo 200 alunos excedentes (1.200 no total). Acima disso, o simulador não apresenta preço calculado: exibe "Sob medida" e direciona para negociação (WhatsApp), mesmo que existam planos menores que aceitariam excedentes.
**Exemplo válido:** 1.100 alunos → 100 excedentes × valor do plano; 1.200 alunos → 200 excedentes (limite).
**Exemplo inválido:** calcular total para 1.201+ alunos no plano de 1.000 ou recomendar um plano menor com centenas de excedentes.
**Consequência:** `simulateMonthly` marca `needsNegotiation = true`; `recommendPlan` retorna `needsCustomQuote = true`; o CTA vira "Falar com um especialista". Planos diferentes de 1.000 alunos não têm teto.

---

## 6. Fluxos

### Fluxo principal

```text
Visitante acessa /planos
        ↓
Seção "Simulador" carrega os planos (getSignupPlans)
        ↓
Vê o card com plano recomendado para o valor inicial (menor limite)
        ↓
Ajusta a quantidade de alunos (slider ou campo)
        ↓
Sistema deriva o plano recomendado e recalcula em tempo real
        ↓
[Se exceder e permitido] mostra "N excedentes × R$ X = R$ Y" + total R$ Z/mês
[Se exceder e não permitido] mostra aviso + recomenda plano maior
        ↓
Vê selos "Sem taxa de implantação" / "Sem contrato" e clica no CTA
        ↓
/cadastro?plan=<id> com o plano pré-selecionado
```

### Fluxo alternativo A — Comparar plano fixado

1. Visitante clica em um card específico ("simular com este plano").
2. Plano fica fixado; slider continua recalculando excedentes **desse** plano.
3. Se a quantidade exceder e o plano não aceitar, aplica RN-004 mesmo com fixação.
4. Visitante clica em "Usar plano recomendado" → fixação limpa e recomendação volta.

### Fluxo alternativo B — Plano ilimitado

1. Planos 20/50 e um ilimitado (R$ 299).
2. Visitante move o slider além de 50.
3. Recomendação passa a ser o ilimitado; exibe "Alunos ilimitados" e o preço fixo, sem excedentes.

### Fluxo de erro — Falha ao carregar planos

1. Query falha (rede/500).
2. Seção exibe mensagem amigável + "Tentar novamente".
3. Conteúdo institucional e CTA do cabeçalho continuam funcionando.

### Fluxo de cancelamento — Saída sem converter

1. Visitante interage, não clica no CTA e sai.
2. Nenhum estado é persistido (sem cookies/storage).

### Fluxo sem dados — Nenhum plano ativo

1. Lista vazia.
2. Seção não é renderizada (sem skeletons). Página permanece com o CTA atual.

### Fluxo de permissão negada

Não se aplica: página e query são públicas (`publicProcedure`).

---

## 7. Casos Extremos

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| 1 | Campo de alunos vazio | Mantém último valor válido; não recalcula com vazio |
| 2 | Campo com texto ("abc"), colado, ou `e`/`+`/`-` | Ignora entrada inválida |
| 3 | Valor 0 ou negativo | Clamp para `sliderMin` |
| 4 | Valor maior que `sliderMax` (ex.: 100000) | Clamp para `sliderMax` |
| 5 | Valor fracionário (35,7) | Arredonda para 36 |
| 6 | Duplo clique no CTA | Navegação idempotente (link); sem duplicidade de ação |
| 7 | Clique repetido em card | Fixa o mesmo plano; sem efeito colateral |
| 8 | `allowExtraStudents = false` e excedido | RF-006/RN-004 |
| 9 | Plano com `maxStudents = 999999` | Exibe "ilimitado", sem excedentes |
| 10 | **Todos** os planos finitos e sem excedente, valor acima de todos | Estado "sob medida" + WhatsApp |
| 11 | Plano com `extraStudentPrice = 0` | Excedentes calculados, subtotal R$ 0,00 (exibir "+ R$ 0,00" ou "sem custo adicional" — decidir na implementação com o texto "sem custo adicional por aluno") |
| 12 | `priceMonthly` com string decimal ("99.00") | `parseBRL` converte corretamente |
| 13 | Lista de planos vazia | Seção oculta |
| 14 | Query lenta (>2 s) | Skeleton permanece; sem *layout shift* |
| 15 | API indisponível/timeout | Estado de erro com retry; demais blocos da página intactos |
| 16 | Sessão expirada | Irrelevante (página pública) |
| 17 | Um único plano cadastrado | Slider com min/max coerentes; recomendação = esse plano |
| 18 | Dois planos com o mesmo `maxStudents` | Desempate por menor preço |
| 19 | Plano mais caro com limite maior e outro mais barato com excedente mais barato | Recomendação por faixa (RN-006); sem cálculo de "melhor custo total" |
| 20 | Mudança de preço/plano no banco enquanto a página está aberta | Só reflete em novo carregamento/refetch (aceito) |
| 21 | Mobile com teclado aberto ao digitar | Campo numérico (`inputMode="numeric"`) permanece visível; layout sem quebra |
| 22 | Zoom/acessibilidade | Slider operável por teclado (setas), `aria-label` com valor |
| 23 | Valores absurdos no banco (ex.: preço negativo) | Filtro do backend (`> 0`); componente ignora inválidos e mantém a página estável |
| 24 | Mudança de mês/ano/fuso | Não se aplica (não há data no cálculo) |
| 25 | Console sem erros | Erros de rede tratados, não logados com dados sensíveis no client |

---

## 8. Dados Envolvidos

### Entidade consultada: `system_plans` (`drizzle/schema.ts:1126-1144`) — somente leitura

| Campo | Tipo no banco | Obrigatório | Uso no simulador |
| --- | --- | --- | --- |
| `id` | varchar(50) PK | Sim | Identificador do plano (CTA `?plan=`) |
| `name` | varchar(100) | Sim | Nome exibido |
| `priceMonthly` | decimal | Sim | Preço base mensal (`parseBRL`) |
| `priceYearly` | decimal | Sim | **Não usado na v1** (RN-010) |
| `maxStudents` | integer | Sim | Limite/faixa e excedentes; 999999 = ilimitado |
| `features` | text (JSON array) | Não | **Fora do escopo v1** (cards de preço não listam features; a landing já faz isso) |
| `isPopular` | boolean | Sim (default false) | Selo "Mais escolhido" |
| `order` | integer | Sim (default 0) | Ordenação |
| `allowExtraStudents` | boolean | Sim (default true) | Habilita/desabilita excedente |
| `extraStudentPrice` | decimal | Sim (default 1.49) | Valor por aluno excedente/mês |
| `isActive` / `showOnLanding` | boolean | Sim | Filtrados pela query (`isActive` apenas) |

### Estado local do componente (não persistido)

| Estado | Tipo | Inicial |
| --- | --- | --- |
| `alunos` | number (inteiro) | `sliderMin` (RN-007) |
| `planoFixadoId` | string \| null | `null` (recomendação automática) |
| `inputValue` | string | espelho do input numérico |

### Não há alteração de banco, migração, seed, índice ou soft delete neste PRD.

Função pura sugerida (testável, sem dependência de React): `shared/planPricing.ts` com:
```ts
type SimPlan = { id: string; name: string; priceMonthly: number; maxStudents: number;
                 allowExtraStudents: boolean; extraStudentPrice: number; isPopular?: boolean; order?: number };
type Simulation = { excessCount: number; excessSubtotal: number; total: number;
                    isExcessAllowed: boolean; isUnlimited: boolean; recommendedPlanId: string | null;
                    needsCustomQuote: boolean };
computePlanRange(plans: SimPlan[]): { min: number; max: number; initial: number }
simulate(plan: SimPlan, alunos: number): Simulation
recommendPlan(plans: SimPlan[], alunos: number): { plan: SimPlan | null; needsCustomQuote: boolean }
```
> Colocado em `shared/` para ser importado pelo client e testado pelo vitest existente (o `vitest.config.ts:17` só inclui `server/**/*.test.ts`; o teste importa a função pura de `@shared/planPricing`).

---

## 9. Permissões e Segurança

### Matriz de acesso

| Ação | Visitante (anônimo) | Usuário logado | Super Admin |
| --- | --- | --- | --- |
| Ver a seção do simulador em `/planos` | Sim | Sim | Sim |
| Informar quantidade de alunos / simular | Sim | Sim | Sim |
| Criar/editar planos e preços | Não | Não | Sim (fora do escopo) |
| Concluir cadastro | Sim (fluxo público) | N/A | N/A |

### Regras

1. **Nenhum endpoint novo** é criado; reutiliza-se `publicData.getSignupPlans` (`publicProcedure`) que já expõe somente o catálogo paginado de planos — dados públicos de marketing.
2. **Nenhuma mutação**: o simulador é 100% leitura/estado local.
3. **Sem PII**: não se coleta e-mail, telefone, CPF/CNPJ nem nome da escola no simulador; nada é persistido (sem cookies/storage).
4. **Sem isolamento multi-tenant** envolvido: não há dados de organização/aluno; a simulação é hipotética.
5. **Erros nunca expõem**: stack trace, query SQL, nome de tabela, credenciais ou detalhes do servidor ao usuário (mensagem genérica — §10). `console.error` no client não deve conter dados sensíveis (a query pública não tem).
6. **CTA de WhatsApp**: link estático, sem parâmetros com dados do usuário.
7. Não logar valores de simulação em analytics com identificação pessoal.

---

## 10. Tratamento de Erros

### Erros esperados (mensagem amigável ao usuário)

| Situação | Mensagem exibida | Ação disponível |
| --- | --- | --- |
| Falha ao carregar planos | "Não foi possível carregar os planos agora." | Botão "Tentar novamente" (refetch) |
| Lista de planos vazia | (nada — seção oculta) | CTA institucional existente |
| Plano sem excedente excedido | "O plano {nome} não aceita alunos excedentes. Veja o plano recomendado." | Selecionar recomendado / CTA |
| Quantidade acima de todos os planos | "Sua escola precisa de um plano sob medida." | "Falar com um especialista" (WhatsApp) |
| Entrada inválida no campo | (sem toast; o campo apenas mantém último valor válido) | — |
| Plano do `?plan=` inexistente no cadastro | (silencioso) fallback para o primeiro plano | — |

### Erros internos (nunca exibir detalhes)

- Qualquer exceção de renderização do componente deve ser contida por um *error boundary* local (ou fallback no próprio componente) para **não derrubar a página `/planos`**, exibindo o mesmo estado de erro amigável.
- Detalhes técnicos, se registrados, apenas via `console.error` sem dados sensíveis e nunca renderizados.

---

## 11. Requisitos Não Funcionais

### RNF-001 — Performance

- Zero requisições novas: usa a query existente; mudanças no slider são cálculo local (sem rede).
- Cálculo síncrono O(n_planos), tipicamente < 5 ms; UI responde a 60 fps ao arrastar.
- Sem *layout shift*: skeleton com altura reservada.

### RNF-002 — Responsividade

- Mobile-first: card do simulador empilhado (< 640 px), duas colunas (>= 768 px) — espelhando o print de referência.
- Campos com área de toque mínima de 44 px; input numérico com `inputMode="numeric"`.
- Testado em 360 px, 768 px e 1280 px de largura.

### RNF-003 — Acessibilidade

- Slider com `aria-label` ("Quantidade de alunos ativos pagantes") e `aria-valuetext` refletindo o valor.
- Campo numérico com `<Label>` associado.
- Cards clicáveis com `button`/`role` e foco visível; navegação por teclado.
- Contraste conforme tokens do design system (`client/src/index.css`); suporte a dark mode (tokens `.dark`).
- Selos com ícone + texto (nunca só cor).

### RNF-004 — Consistência visual

- Usar componentes do design system: `client/src/components/ui/card.tsx`, `button.tsx`, `slider.tsx`, `badge.tsx`, `skeleton.tsx`.
- Tipografia da marca (`font-outfit` para números/destaques), cantos `rounded-2xl/3xl`, sombras `shadow-primary/20` — mesmo padrão da landing e do `SeoSite.tsx`.

### RNF-005 — SEO

- O HTML pré-renderizado (`scripts/prerender.ts`) mantém todo o conteúdo institucional atual da página.
- Preços não entram no HTML pré-renderizado (evita dados obsoletos no cache de buscadores). Nada de alterar `title`/`description`/JSON-LD neste PRD.
- A seção deve ser renderizada de forma semanticamente correta (`section` + `h2`), sem esconder conteúdo de crawlers.

### RNF-006 — Formatação monetária

- Obrigatório usar `formatBRL`/`parseBRL` de `client/src/lib/money.ts` (regra do `AGENTS.md`); **não** reimplementar formatação.

### RNF-007 — Testabilidade

- Cálculo isolado em função pura (`shared/planPricing.ts`) coberto por testes no padrão vitest existente.
- `pnpm check`, `pnpm test` e `pnpm build` devem passar sem **novos** erros vs. o baseline documentado em `AGENTS.md` (33–41 erros TS pré-existentes no client).

### RNF-008 — Manutenibilidade

- Componente em `client/src/components/planos/` (novo domínio, conforme convenção do `AGENTS.md`), reutilizável pela landing no futuro.
- Sem `any` novo; sem comentários desnecessários (regra do repo).
- Nenhuma dependência nova.

---

## 12. Critérios de Aceite

### CA-001 — Exibir todos os planos cadastrados (sem hardcode)

**Dado que** existem 4 planos ativos com `priceMonthly > 0` no banco,
**Quando** um visitante abre `/planos`,
**Então** os 4 cards aparecem com nome, preço mensal, limite e política de excedente corretos, sem nenhum valor hardcoded no código (validação: alterar um preço no `/master-panel` e recarregar reflete o novo valor).

### CA-002 — Cálculo de excedente com plano que aceita

**Dado** um plano "Escola" (R$ 99,00/mês, até 30 alunos, excedente R$ 1,49, `allowExtraStudents = true`),
**Quando** o visitante informa 35 alunos,
**Então** o simulador exibe: "5 alunos excedentes × R$ 1,49 = R$ 7,45/mês" e total "R$ 106,45/mês" (mesmo número que o backend cobraria em `helpers.ts:154-163`).

### CA-003 — Dentro do limite

**Dado** o mesmo plano de CA-002,
**Quando** o visitante informa 25 alunos,
**Então** o simulador não mostra linha de excedentes e o total é R$ 99,00/mês.

### CA-004 — Plano sem excedente recomenda upgrade

**Dado** um plano "Iniciante" (até 20 alunos, `allowExtraStudents = false`) e um plano "Escola" (até 50),
**Quando** o visitante informa 35 alunos no plano Iniciante,
**Então** o sistema exibe o aviso de que o plano não aceita excedentes e o "Plano recomendado" passa a ser o "Escola", com CTA apontando para ele.

### CA-005 — Nenhum plano comporta a quantidade

**Dado** que todos os planos são finitos e sem excedente,
**Quando** o visitante informa quantidade acima do maior limite,
**Então** aparece "Sua escola precisa de um plano sob medida." com CTA de WhatsApp e **nenhum preço incorreto** é exibido.

### CA-006 — Recomendação por faixa

**Dado** planos com limites 20/50/100,
**Quando** o visitante informa 35 alunos,
**Então** o plano selecionado é o de limite 50.

### CA-007 — Fixação de plano

**Dado** que o visitante clicou no card de limite 20,
**Quando** ele move o slider para 35,
**Então** a simulação continua no plano de 20 (com excedentes, se permitido) e aparece o link "Usar plano recomendado".

### CA-008 — Selos de confiança

**Dado** que a seção está visível,
**Então** os textos "Sem taxa de implantação" e "Sem contrato — cancele quando quiser" estão visíveis e legíveis ao lado do CTA (verificável por inspeção visual e no DOM).

### CA-009 — CTA leva ao cadastro com plano pré-selecionado

**Dado** que o plano selecionado é o `id = "escola"`,
**Quando** o visitante clica em "Criar conta e testar grátis",
**Então** `/cadastro?plan=escola` abre com "Escola" já selecionado, mantendo o ciclo mensal e o fluxo de indicação (`?ref=`) funcionando.

### CA-010 — Estados de UI

**Dado** que a rede está lenta, falha ou o banco retorna vazio,
**Quando** a página carrega,
**Então**, respectivamente: (a) skeleton sem layout shift; (b) mensagem de erro com "Tentar novamente" e o resto da página intacto; (c) seção não renderizada.

### CA-011 — Entradas inválidas

**Dado** o campo numérico,
**Quando** o visitante digita "abc", vazio, negativo, `100000` ou `35,7`,
**Então** o sistema, respectivamente: ignora, mantém o último valor, usa o mínimo, usa o máximo e usa 36 — nunca exibindo `NaN`, `Infinity` ou valor negativo.

### CA-012 — Plano ilimitado

**Dado** um plano ilimitado e alunos acima do maior limite finito,
**Quando** o simulador recalcula,
**Então** seleciona o ilimitado, exibe "Alunos ilimitados" e **não** mostra excedentes.

### CA-013 — Testes automatizados do cálculo

**Dado** a função pura de cálculo,
**Quando** `pnpm vitest run server/planPricing.test.ts` roda,
**Então** todos os casos de CA-002, CA-003, CA-005, CA-006, CA-011 (clamp/arredondamento) e RN-009 passam.

### CA-014 — Regressão

**Dado** o repositório após a implementação,
**Quando** `pnpm check`, `pnpm test` e `pnpm build` rodam,
**Então** passam sem novos erros vs. o baseline do `AGENTS.md`.

### CA-015 — What's New

**Dado** o lançamento da funcionalidade,
**Então** `shared/releases.ts` possui uma entrada no topo com `version`, `date`, `title`, `summary` e `items[]` contendo a novidade.

### CA-016 — Total em todos os cards (revisão 1.1)

**Dado** planos com valores de excedente diferentes,
**Quando** o visitante informa 35 alunos,
**Então** todos os cards exibem o total mensal com os alunos informados, cada um com o próprio valor de excedente; planos que não cobrem a quantidade exibem aviso âmbar em vez de total.

### CA-017 — Teto de excedentes no plano de 1.000 (revisão 1.1)

**Dado** o plano de 1.000 alunos que aceita excedentes,
**Quando** o visitante informa 1.200 alunos, **Então** vê o total (base + 200 excedentes);
**Quando** informa 1.201 alunos, **Então** vê "Sob medida" com CTA de negociação (WhatsApp) e nenhum preço calculado, e a recomendação não cai para outro plano com centenas de excedentes.

---

## 13. Riscos e Dependências

### Riscos

| # | Risco | Impacto | Mitigação |
| --- | --- | --- | --- |
| R1 | Preços/limites reais não estão no repositório (só no banco de produção) | Testes e homologação dependem do banco | Testes com fixtures; validação manual comparando com `/master-panel`; QA em ambiente com dados reais |
| R2 | `Checkout.tsx:148` exibe preço hardcoded ("R$ 49/499"), divergente do banco | Visitante vê preço no simulador e outro no checkout | Fora do escopo v1; **recomendação**: abrir item de correção imediato (risco de confiança/comercial) |
| R3 | Meta description/JSON-LD de `/planos` diz "a partir de R$ 49,99" (`shared/seo/core.ts:78`) | Inconsistência com preços reais | Fora do escopo v1; revisar quando os preços de produção forem conhecidos |
| R4 | Backend no ciclo anual soma excedente 1× (`helpers.ts:162-163`) | Regra ambígua de cobrança anual | Toggle anual desabilitado (RN-010) até decisão formal; PRD registra a pendência |
| R5 | `server/db.ts:27-42` cria `system_plans` com schema antigo (integer/jsonb) se a tabela não existir | Ambientes novos podem divergir do drizzle | Pré-existente; não alterado por este PRD; monitorar no QA |
| R6 | Recomendação por faixa pode não ser o menor custo total (ex.: plano menor + excedente pode sair mais barato) | Visitante pode pagar mais do que o necessário | Decisão consciente v1 (RN-006); evolução futura: badge "melhor custo" |
| R7 | Alteração no `Cadastro.tsx` para ler `?plan=` | Regressão no fluxo de cadastro/indicação | CA-009 exige teste do fluxo com e sem `?plan=` e com `?ref=` |
| R8 | Layout shift/SEO por conteúdo client-side | CLS ruim / SEO | Skeleton com altura reservada (RNF-001); conteúdo institucional preservado no prerender |

### Dependências

| # | Dependência | Status |
| --- | --- | --- |
| D1 | `publicData.getSignupPlans` (`authRouters.ts:130-141`) | Existe |
| D2 | Tabela `system_plans` populada e mantida no Super Admin | Existe |
| D3 | `client/src/lib/money.ts` (`formatBRL`/`parseBRL`) | Existe |
| D4 | Componentes `ui/slider`, `ui/card`, `ui/button`, `ui/badge`, `ui/skeleton` | Existem |
| D5 | `shared/releases.ts` (regra do `AGENTS.md`) | Existe |
| D6 | Link de WhatsApp comercial (`LandingPage.tsx:803`) | Existe |
| D7 | Ajuste no `Cadastro.tsx` para `?plan=` | A implementar (RF-008) |
| D8 | Testes vitest (include de `server/**/*.test.ts`) | Existe (`vitest.config.ts:17`) |

---

## 14. Métricas de Sucesso

| Métrica | Como medir | Alvo sugerido (30 dias) |
| --- | --- | --- |
| CTR do CTA do simulador | Cliques em "Criar conta e testar grátis" na seção / visitas em `/planos` | ≥ 8% |
| Cadastros com plano pré-selecionado | Cadastros concluídos com `?plan=` / visitas que saíram do simulador | ≥ 30% |
| Uso do simulador | Interações com slider/cards por sessão em `/planos` | ≥ 25% das sessões |
| Redução de dúvidas comerciais | Tickets/mensagens de WhatsApp perguntando "quanto custa" | Redução de 30% |
| Conversão da página `/planos` | Cadastros iniciados a partir de `/planos` | +20% vs. baseline |

> Observação: qualquer instrumentação de analytics deve ser anônima (sem PII) — §9.

---

## 15. Plano de Implementação Sugerido

### Fase 1 — Estrutura e dados

1. Criar `shared/planPricing.ts`: tipos `SimPlan`/`Simulation`, `computePlanRange`, `simulate`, `recommendPlan` (puros, em centavos — RN-009).
2. Criar `server/planPricing.test.ts` cobrindo CA-002, CA-003, CA-005, CA-006, CA-011 (clamp/arredondamento), RN-009 e planos ilimitados.
3. Rodar `pnpm vitest run server/planPricing.test.ts`.

### Fase 2 — Frontend (componente)

1. Criar `client/src/components/planos/PlanSimulator.tsx` (ou pasta `components/planos/` com subcomponentes se passar de ~300 linhas):
   - Query `publicData.getSignupPlans` + normalização com `parseBRL`.
   - Card principal (slider + input + memória de cálculo + selos + CTA).
   - Grid de cards dos planos (RF-002) com fixação (RN-008).
   - Estados de loading/erro/vazio (RF-009).
2. Integrar em `SeoSite.tsx` no `SeoPageView` apenas quando `page.kind === "plans"` (RF-010), preservando o restante do layout.

### Fase 3 — Integrações

1. Ajustar `Cadastro.tsx` para ler `?plan=` e pré-selecionar (RF-008), preservando `?ref=`/localStorage.
2. CTA do simulador com `/cadastro?plan=<id>`.
3. Estados "sob medida" e "não aceita excedentes" com link de WhatsApp.
4. Adicionar entrada no topo de `shared/releases.ts` (RF-011).

### Fase 4 — Design e acessibilidade

1. Aplicar tokens/tipografia do design system (RNF-004), responsividade (RNF-002) e acessibilidade (RNF-003).
2. Revisão visual contra o print de referência (emusys) e a identidade MusicPro.

### Fase 5 — Testes e verificação

1. `pnpm check` — comparar com baseline do `AGENTS.md` (sem novos erros).
2. `pnpm vitest run server/planPricing.test.ts` + `pnpm test`.
3. `pnpm build` (inclui `scripts/prerender.ts` — conferir que `/planos` continua pré-renderizada e o sitemap intacto).
4. QA manual da matriz de CA-001 a CA-015 em desktop e mobile, com banco real (comparar preços com `/master-panel`).

### Fase 6 (fora do escopo v1, registrar como follow-up)

1. Decidir e corrigir a regra de excedente no ciclo anual (`helpers.ts:162-163`) e então habilitar o toggle anual no simulador.
2. Corrigir o preço hardcoded do `Checkout.tsx:148` e a meta description de `/planos`.
3. Avaliar badge "melhor custo total" (plano menor + excedente vs. plano maior).

---

## Checklist de qualidade do PRD

- [x] Problema, objetivo e contexto definidos.
- [x] Usuários envolvidos identificados (incluindo crawler e Super Admin).
- [x] Escopo incluído e fora do escopo explícitos.
- [x] Requisitos funcionais com IDs e dados de entrada/saída.
- [x] Regras de negócio explícitas (fórmula de excedente, faixas, clamps, arredondamento, ciclo mensal).
- [x] Fluxo principal, alternativos, erro, cancelamento, sem dados e permissão negada.
- [x] 25 casos extremos mapeados.
- [x] Dados envolvidos (campos, origem, estado local, ausência de migração).
- [x] Permissões e segurança (público, sem PII, sem endpoint novo, sem mutação, erros sem vazamento).
- [x] Erros esperados vs. internos separados.
- [x] Requisitos não funcionais (performance, responsividade, acessibilidade, SEO, formatação, testes).
- [x] Critérios de aceite objetivos e testáveis (CA-001 a CA-015).
- [x] Riscos e dependências mapeados.
- [x] Métricas de sucesso propostas.
- [x] Plano de implementação em fases.
- [x] Decisões do solicitante incorporadas: página `/planos`, ciclo mensal apenas, recomendação de plano maior quando não há excedente.
