# Changelog da documentação / produto

Formato: mais recente no topo.

## 2026-08-22

### App
- Dashboard de Vendas: KPIs gerais mostram participação **MA/PI** e **PA** no total.
- Barras por indústria: **%** de cada indústria + linha **Total**; nomes normalizados; scroll se houver muitas indústrias.
- Comparativo mensal por região: toggle **Rosca (Meta)** / **Pizza (Indústria)** — pizza com participação de cada indústria no mês (MA/PI e Pará).
- Price (cliente **MATEUS**): filtro de loja passa a reconhecer nomes curtos das bandeiras (`Mix …`, `Super Castanhal`), além de “MATEUS”.

### Documentação
- Créditos: app criado pela **IAFE TECH**; autores e colaborador (Assistente IA) em `docs/README.md` (somente documentação; **não** aparece na UI).
- Dashboard (toggle pizza/rosca, % nas barras) atualizado em `02-modulos-e-telas.md`.
- Ajuste do escopo cliente no Price em `01-acesso-e-usuarios.md` e `04-regras-de-negocio.md`.

## 2026-08-20

### App
- **Price** permanece em **Merchandising** (`/merchandising/price`).
- Passo 1 (banco): `pesquisa.tipo_pesquisa` (`interna`|`externa`) + `pesquisa.preco_custo`.
- Passo 2: tela Price com abas Internas/Externas, busca, filtro por indústria e listagem (varejo, atacado; custo nas internas).
- Passo 3: **Exportar Excel** — externas completo; internas com coluna `preco_custo` **vazia** (para preencher e reimportar). Inclui `id` para casar na importação.
- Passo 4: **Importar custos** (Excel por `id`) + **edição manual** de `preco_custo` na tabela (só internas).
- Passo 5: **Multiplicador** (padrão 100%) + colunas **Markup %** e **Margem %** nas internas.
- Internas: toggle **Lista / Gráfico** — gráfico por produto com lojas no eixo X (Preço Varejo, Custo, Markup, Margem).
- Externos (indústria/cliente) também acessam **Price** em leitura: indústria só vê a própria marca; cliente só lojas do grupo (ex. MATEUS).
- Coluna **`mes`** em `pesquisa` + filtro por mês (1 mês → seleciona esse; vários → mês vigente, com troca manual).
- Admin `/administrador/price` redireciona para Merchandising.
- Fórmulas (referência): Markup% `((PV−PC)/PC)×100`; Markup exibido `× multiplicador%/100` (padrão 100%); Margem% `markup/(100+markup)×100`.

### Documentação
- Atualização da seção Price em `02-modulos-e-telas.md`.
- Tabela `pesquisa` (Price + `mes`) documentada em `03-dominio-e-dados.md`.
- Acesso externo ao Price em `00-visao-geral.md`, `01-acesso-e-usuarios.md` e `04-regras-de-negocio.md`.

## 2026-08-18

### App
- Dashboard de Vendas: incluído **Venda do Mês por Indústria — Pará** (antes só anual).
- Valores das barras por indústria saem de cima do laranja/azul e ficam em coluna à direita, com contraste alto.
- Conferência agosto/2026: MA/PI mensal bate com a base; Pará mensal concentra-se em PREDILECTA (~R$ 1,92M).

### Documentação
- Ajuste na seção de Vendas (dashboard) em `02-modulos-e-telas.md`.

## 2026-08-17 (notificações externos)

### App
- Notificações para usuários **indústria/cliente**: só eventos do **Sucesso do cliente** no escopo deles (indústria ou grupo/CNPJ). Sem lançamentos gerais nem kanban financeiro.

### Documentação
- (esta entrada)

## 2026-08-17

### Documentação

- Criada a pasta `docs/` com visão geral, acesso, módulos, domínio, regras e deploy.
- Objetivo: base para tirar dúvidas (humanos e futura IA).

### App (estado documentado nesta data)

- Painel web Fé Merchandising com módulos Merchandising, Vendas, Financeiro e Administrador.
- Login em três abas: Equipe (CPF), Indústria (nome), Cliente (CNPJ).
- Usuários externos somente leitura em Validades e Sucesso do cliente, com filtro por indústria ou grupo de lojas.
- Comissão unificada: % por indústria com categoria opcional; Recalcular persiste no banco; alerta de categoria até 31/12/2026.
- Categoria obrigatória no lançamento de vendas; indústrias padronizadas em maiúsculas.
- Deploy via Dockerfile + Coolify.

---

<!--
Ao atualizar o app, acrescente um bloco acima deste comentário, por exemplo:

## AAAA-MM-DD

### App
- …

### Documentação
- …
-->
