# Changelog da documentação / produto

Formato: mais recente no topo.

## 2026-09-15

### App
- **Validades:** coluna Loja (lista, modal de venda e exportação Excel) no formato `código - nome` (igual ao Lançar vencimentos), cruzando com o cadastro `lojas`.
- **Catálogo das indústrias:** roda embutido no App (`/merchandising/catalogo` → `/catalogo/`); sem Vercel. Ajustes de navegação “voltar”, branding (isotipo Fé), layout mobile e escopo de acesso.
- Catálogo — acesso: **Acesso master** só Gerente / Supervisor / RH / Analista admin (internos). Externo **indústria** vê só a própria; externo **cliente** vê todas; externos sem gestão/Drive.

### Documentação
- Créditos do catálogo: desenhado por **Matheus Lucas** (Analista de Marketing); 1ª versão com apoio de **Helry Araujo Rodrigues**; hoje integrado ao painel.
- Atualizados `README`, `00`, `01`, `02`, `04`, `05` e este changelog para o estado atual (catálogo interno + Validades com código de loja).

## 2026-09-14

### App
- **Catálogo das indústrias** em `/merchandising/catalogo` (iframe de `/catalogo/`), sem site externo.
- API do catálogo no Supabase (Edge Functions + tabela `catalogo_fe_kv`); nginx/Vite proxy same-origin em `/api/catalog` e `/api/product-image`.
- Catálogo: **Acesso master** só Gerente / Supervisor / RH / Analista admin (internos). Externos sem gestão; indústria vê só o próprio catálogo; cliente vê todos.

### Documentação
- Módulos e deploy: catálogo Coolify + checklist Google OAuth (`localhost:5173` e domínio de produção).
- Regras de acesso do catálogo por cargo/tipo de usuário.

## 2026-09-09

### App
- **Ebook digital** (/merchandising/ebook): galeria de fotos dos promotores a partir de `atividade_dia` + Storage (`atividade-fotos`), com filtros, miniaturas selecionáveis e PDF das selecionadas. Acesso: Gerente, Supervisor, Analista admin e RH.
- Ebook: senha do dia no viewer/PDF; PDF mais leve; dica de filtros (indústria/UF/DEPOIS); responsivo e tema claro/escuro no modal.
- Ebook mobile: filtros recolhíveis, miniaturas alinhadas acima dos filtros e espaço para o FAB do menu.
- Textos de UI: removido traço longo (—) de mensagens visíveis.

### Documentação
- Módulos, regras e domínio atualizados para o Ebook digital.

## 2026-09-04

### App
- **Sino:** lista com retenção rolante de **48h**; badge só na criação (não-lido se `at` > última abertura). Encartes permanecem no sino ~48h após o início. Timestamps estáveis (sem “fim do dia”).
- Cards de promoção no Merchandising mais compactos no mobile; código do produto (`#codigo`) antes do nome no hub e no sino.

### Documentação
- Janela 48h + badge do sino em `02-modulos-e-telas.md` e `05-tecnologia-e-deploy.md`.

## 2026-09-03

### App
- Hub Merchandising: balão **Catálogo das indústrias** (só internos) abre `https://catalogo-fe.vercel.app/` em nova aba.
- Balão **Merchandising** passa a citar **pesquisa** na descrição da home.
- **Fazer pesquisa** (`/merchandising/pesquisas`): tela para internos lançarem pesquisa interna/externa na tabela `pesquisa` (Price). Lojas do promotor vs todas para gerente/supervisor; UFs MA/PI/PA. Layout mobile-first. Atalho na tela Price.
- Câmera/OCR de produto e preços fica para etapa seguinte (grava rascunho no banco).

### Documentação
- Módulos, regras, domínio e deploy atualizados (`00`, `02`, `03`, `04`, `05`).

## 2026-09-01

### App
- Preferência **Aviso de aniversário** (`notify_aniversario`, padrão ligado) para **todos** (interno, externo, Promotor/Demonstradora) no modal Instalar app e notificações.
- Sessão atualiza `data_nascimento` no bootstrap; sino resolve aniversário do banco se a sessão estiver antiga — só o próprio aniversariante vê a mensagem.
- **Meta batida** (mensal e anual, regionais MA/PI e PA): aviso no sino para cargos de liderança internos — Gerente, Supervisor, Analista admin, RH e Financeiro. Preferência `notify_meta` no modal (só esses cargos).
- Loja **230 — MATEUS SUPERMERCADOS S.A. MIX CAXIAS** (CAXIAS/MA) em `lojas`.
- Lançar vencimentos: busca de loja por nome/número + calendário opcional na data de vencimento.
- Sino: toque abre leitura completa da notificação (sheet no mobile); avisos sem corte de 160 chars; modal Instalar app melhor no celular.
- **Avisos:** popup de confirmação com prévia do título/mensagem e aviso de envio irreversível (sheet no celular).
- **Meu roteiro:** popup de confirmação antes de enviar fotos — mostra antes/depois, senha do dia e aviso de irreversível; prévias estáveis; sheet responsivo no celular.

### Documentação
- Preferência de aniversário em `02-modulos-e-telas.md`, `04-regras-de-negocio.md` e `05-tecnologia-e-deploy.md`.
- Aviso de meta batida nas mesmas docs.
- Confirmações de envio (avisos e Meu roteiro) em `02-modulos-e-telas.md` e `04-regras-de-negocio.md`.
## 2026-08-31

### App
- Avisos (só Gerente, em Fé Representações): enviar **salário** ou **feriado** com modelo editável; cai no sino e no push da equipe **interna**.
- Aviso de **folha de ponto** automático todo dia 25 (`pg_cron` + tabela `avisos`).
- Preferência push `notify_aviso`; externos não recebem avisos.
- Merchandising: **Senha do dia** no hub para **todos** os usuários logados (internos e externos); lê tabela `senhas` pelo dia BRT.
- Cadastro de usuários: campo obrigatório **data de nascimento** (`usuarios.data_nascimento`); legados podem ser preenchidos na edição.
- No dia do aniversário, o próprio usuário (interno ou externo) vê no sino uma mensagem de parabéns — só ele recebe.
- **Lançar vencimentos** (Atividades / Merchandising): formulário nativo para internos; POST idêntico ao webhook `comercial1` (ex-app validade.vercel.app).
- No código reduzido, o formulário consulta `public.codigos` e preenche automaticamente produto e indústria.
- Cadastro de Promotor/Demonstradora: até **7 lojas** em `usuario_lojas`; no app/web o campo vê só esses PDVs, check-in sem GPS (cidade/UF da loja), indústria e fotos antes/depois.
- Envio Antes/Depois grava automaticamente a **senha do dia** em `atividade_dia.senha_do_dia`.
- Ajustes de responsividade mobile (Meu roteiro, senha do dia, lançar vencimentos, safe-area).
- Sincronização de lojas: 25 PDVs novos; Assaí renomeado para **SENDAS**; aliases Mateus incluem Mix/Super/Posterus/Carone/Camino.

### Documentação
- Avisos em `02-modulos-e-telas.md`, `04-regras-de-negocio.md` e `05-tecnologia-e-deploy.md`.
- Senha do dia em `02-modulos-e-telas.md`.

## 2026-08-28

### App
- Qualquer dropdown/select operacional de indústria lista só status **Ativo** (lançamento/edição de vendas, atividades, metas, financeiro, relatórios, Validades/Price/Sucesso, usuário externo, comissão).
- Edição de venda/usuário mantém a indústria atual se ela estiver inativa (não some do formulário).
- Login tipo Indústria bloqueia cadastro inativo.

### Documentação
- Regra de indústrias ativas em selects operacionais em `04-regras-de-negocio.md`.

## 2026-08-25

### App
- Validades: filtro de **ordenação** — vencimento (padrão), últimas lançadas → primeiras, ou primeiras → últimas (`created_at`).
- Validades: toggle **Lista / Gráfico** — top produtos que mais venceram no mês (qtde), com escopo para externos.
- Validades: **Registrar venda** (Gerente / Supervisor / Analista admin) — parcial reduz qtde; total marca `todos_vendidos` e some da loja; gráfico só some o produto se zerar em todas as lojas do mês.
- Banco: coluna `validades.todos_vendidos` (boolean, default false).
- Banco: policy RLS de **UPDATE** em `validades` (necessário para registrar venda via app).

### Documentação
- Validades atualizadas em `02-modulos-e-telas.md`, `03-dominio-e-dados.md` e `04-regras-de-negocio.md`.

## 2026-08-24

### App
- Novo balão **Fé Representações** (`fe-representacoes`): Price, Sucesso do cliente e todas as telas de Vendas.
- Merchandising fica com Treinamentos, Atividades e Validades.
- Removido o balão separado **Vendas** e o atalho Price do Administrador.
- URLs novas sob `/fe-representacoes/...`; paths antigos redirecionam.
- Externos: Merchandising (Validades + Atividades no escopo) + Fé Representações (Price + Sucesso); sem Vendas; somente leitura.
- Cadastro interno: card Fé Representações com escolha de liberar ou não as seções de Vendas.

### Documentação
- Módulos, acesso e regras atualizados (`00`, `01`, `02`, `04`).
- Créditos IAFE TECH mantidos em `docs/README.md` (não aparecem na UI).

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
