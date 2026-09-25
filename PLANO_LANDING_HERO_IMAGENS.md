# Plano — Mais imagens e menos texto na tela principal da landing

> Versão: 1.0 · Data: 2026-09-24 · Status: Proposta (aguardando escolha da opção)
> Objetivo: reduzir a densidade de texto do hero e usar mais imagens do sistema, aproveitando o que já existe no Super Admin (sem criar banco novo).

---

## 1. Problema e objetivo

**Problema:** o topo da landing (`/`) concentra muito texto (badge, título, parágrafo, botões, 3 cards) e **uma única imagem** (a Capa da home). A percepção é de "parede de texto", e a imagem fica sozinha.

**Objetivo:**
1. Aumentar a presença visual do hero com **mais imagens reais do sistema**.
2. Enxugar os textos sem perder a mensagem (título + 1 linha + CTA).
3. Tudo administrável pelo Super Admin (trocar imagem sem deploy).

**O que já existe (reaproveitar):**
- `SeoMediaManager` (Super Admin → Imagens das Páginas Públicas → **Página inicial**): já aceita **Capa** (1), **Galeria** (N), **Mobile** (N) e **Desktop** (N).
- A landing já lê a **Capa da home** (`getSeoMedia["/"].cover[0]`) — implementado no release `2026.09.24.2`.
- `MediaGallery` já renderiza galeria de prints com lightbox em outras páginas (`components/seo/MobileShowcase.tsx`).
- `HeroSlider` (carrossel abaixo do hero) tem gestão própria de slides no Super Admin.

**Não precisa de:** migração, endpoint novo, upload novo. A galeria da home já é persistida; falta **exibir**.

---

## 2. Opções de layout

### Opção A — Capa grande + miniaturas clicáveis no hero (recomendada)
- Coluna direita do hero: **imagem principal grande** (Capa da home) e, abaixo/ao lado, **3–4 miniaturas** (Galeria da home) que trocam a imagem principal ao clicar (ou abrem lightbox).
- Textos: título atual + **1 linha** de apoio + botões + selos (remover o parágrafo longo para uma linha curta).
- Como funciona sem novo código de dados: a galeria já vem em `getSeoMedia["/"].gallery`; a Capa é a imagem principal. Se não houver galeria, cai para o placeholder atual.
- **Prós:** reaproveita o gerenciador, visual rico, fácil de explicar. **Contras:** precisa de pelo menos 2 imagens cadastradas para brilhar.

### Opção B — Seção "Por dentro do sistema" logo abaixo do hero
- Mantém o hero mais limpo (1 imagem) e adiciona uma **faixa de galeria (3–6 imagens)** logo em seguida, com título curto.
- **Prós:** simples, excelente no mobile, não mexe no hero. **Contras:** o HeroSlider atual já ocupa essa área; seria preciso decidir se substitui ou complementa.

### Opção C — Slides no lugar da imagem única do hero
- O hero passa a exibir um **carrossel de Capa + Galeria** (troca automática a cada X segundos, com indicadores).
- **Prós:** mais movimento e mais imagens no topo. **Contras:** competindo com o HeroSlider logo abaixo (dois carrosséis na mesma tela); mais complexo de acessibilidade.

### Recomendação
**A + enxugar textos** (com possibilidade de somar B depois). É o menor risco, reusa 100% do que já existe e resolve os dois incômodos (texto demais e pouca imagem).

---

## 3. Requisitos da proposta (se A for aprovada)

- **RF-1** — Hero exibe a Capa da home (já existe) como imagem principal, com `fetchpriority="high"` e placeholder enquanto não houver imagem.
- **RF-2** — Abaixo da imagem principal, miniaturas da **Galeria da home** (máx. 4); clicar troca a imagem principal com transição suave; a ativa fica destacada.
- **RF-3** — Clique na imagem principal abre **lightbox** (comportamento do `MediaGallery` já existente) — opcional na v1.
- **RF-4** — Enxugar textos do hero: badge + título (2 linhas máx.) + **1 linha** de apoio + 2 botões + 3 selos curtos ("100% Online", "7 dias grátis", "WhatsApp automático").
- **RF-5** — Fallback: sem galeria, mantém a imagem principal; sem Capa, mostra o placeholder atual (nunca "quebra").
- **RF-6** — Mobile: imagem principal em largura total, miniaturas em linha com scroll horizontal; textos sem parágrafo longo.
- **RF-7** — Admin: nenhuma tela nova — usar **Página inicial → Capa/Galeria** no `SeoMediaManager`. Atualiza no próximo carregamento.

## 4. Regras e casos extremos

- Só exibir miniaturas se `gallery.length > 1`; com 0 ou 1, comportamento atual.
- Imagem quebrada (URL inválida) → placeholder (mesma regra do hero hoje).
- Trocar de imagem principal não deve gerar salto de layout: manter `aspect-video`/altura fixa no container.
- Ordem das miniaturas segue o campo **Ordem** do gerenciador; itens com o switch desligado não aparecem (regra já aplicada pelo `groupSeoMedia`).
- Acessibilidade: miniaturas são `<button>` com `aria-label` ("Ver imagem 2 de 4") e `aria-current`; setas do teclado trocam a imagem.

## 5. Critérios de aceite

- **CA-1** Dado que há Capa + 3 imagens na Galeria da home, quando abro `/`, então vejo a Capa grande e 3 miniaturas; clicar na 2ª troca a imagem principal.
- **CA-2** Sem galeria, vejo o hero atual (imagem única) sem erro.
- **CA-3** Sem Capa, vejo o placeholder (sem imagem quebrada).
- **CA-4** No mobile (360px), textos enxutos e miniaturas em rolagem horizontal sem overflow.
- **CA-5** Trocar uma imagem no Super Admin reflete na landing sem deploy.

## 6. Fases de implementação

1. **Fase 1 — Hero enxuto** (textos + 1 linha + selos) — baixo risco, ganho imediato.
2. **Fase 2 — Miniaturas da galeria** no hero (RF-2/RF-5/RF-6).
3. **Fase 3 — Lightbox** (RF-3) e polimento (transições, a11y).
4. **Fase 4 — Testes** (`pnpm check/test/build`) + QA visual desktop/mobile + release no What's New.

## 7. Decisão necessária

1. Opção **A** (miniaturas no hero), **B** (faixa de galeria abaixo do hero) ou **C** (carrossel no hero)?
2. O parágrafo atual do hero pode ser reduzido para **1 linha**? (sugestão: "Agenda, mensalidades e WhatsApp automático em um só lugar — para escolas de música.")
3. O `HeroSlider` (carrossel atual abaixo do hero) permanece como está, ou a Opção B o substitui?
