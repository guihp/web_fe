# Acesso e usuários

## Tipos de login (tela Login)

| Aba | Tipo | Identificador | Senha |
|-----|------|---------------|-------|
| **Equipe** | Interno | **CPF** (11 dígitos) | Sim |
| **Indústria** | Externo | **Nome da indústria** (ex.: PREDILECTA) | Sim |
| **Cliente** | Externo | **CNPJ** (14 dígitos) | Sim |

Opção **Lembrar**: mantém a sessão no navegador; sem isso, a sessão vale até fechar a aba/janela.

**Esqueci a senha:** o usuário informa o identificador (CPF / indústria / CNPJ) e clica em **Esqueci minha senha**. Se houver **e-mail cadastrado** em `usuarios`, o Supabase Auth envia o link de recovery para `/redefinir-senha`. A nova senha é gravada no Auth e sincronizada em `usuarios.senha` (login por CPF continua igual).

Configuração Auth (painel Supabase → Authentication → URL Configuration):

- **Site URL (local):** `http://localhost:5174/redefinir-senha` (preferível; se ficar só em `/`, o app redireciona tokens de recovery para esta rota)
- **Redirect (local):** `http://localhost:5174/redefinir-senha`
- **Produção (após Coolify):** Site URL = `https://SEU-DOMINIO` e redirects `https://SEU-DOMINIO/redefinir-senha` (+ opcional `https://SEU-DOMINIO/**`).

Edge Functions: `request-password-reset` (público) e `sync-password-after-reset` (JWT da sessão de recovery).

## Tipos de usuário no cadastro

| Tipo | Quem cria | Vínculo | Telas |
|------|-----------|---------|-------|
| `interno` | Gerente | CPF + cargo + seções | Conforme `nível de acesso` |
| `industria` | Gerente | Indústria cadastrada (`industrias`) | Merchandising (Validades + Atividades) + Fé Representações (Price + Sucesso), leitura |
| `cliente` | Gerente | **Grupo** (ex.: MATEUS) + **CNPJ de login** | Merchandising (Validades + Atividades) + Fé Representações (Price + Sucesso), leitura |

Somente o cargo **Gerente** pode criar/editar usuários em **Administrador → Usuários**.

## Cargos internos (web)

Cargos usados no formulário / login web:

- Gerente
- Supervisor
- Financeiro
- RH
- Analista admin
- Vendedor
- Promotor
- Demonstradora

**Gerente** é o único que gerencia usuários e pode receber seções do módulo Administrador.

## Permissões (balões e seções)

Cada usuário interno tem um JSON de acesso (`nivel_acesso`) com:

- **módulos** (balões da home): Merchandising, **Fé Representações**, Financeiro, Administrador
- **seções** (telas dentro dos balões)

Regras importantes:

- **Validades** fica liberada para usuários internos autenticados (seção sempre disponível).
- **Catálogo das indústrias** (`/merchandising/catalogo`): consulta liberada a internos e externos no hub Merchandising. **Acesso master** (gestão) só Gerente / Supervisor / RH / Analista admin (internos).
- Externos **não** escolhem seções: recebem fixo Validades + Atividades + Sucesso do cliente + **Price** (sem Vendas); catálogo conforme escopo abaixo.
- Externos entram em **modo somente leitura** (`somente_leitura`).
- No card **Fé Representações**, o Gerente libera Price/Sucesso e pode **marcar ou não** as telas de Vendas por usuário.

## Escopo dos externos

### Indústria

- Vê validades cuja indústria é a dela.
- Vê **atividades** dos promotores dessa indústria (somente leitura).
- Vê pedidos do Sucesso do cliente dessa indústria.
- Vê **Price** (internas e externas) só com produtos da **própria indústria** (campo `industria`).
- No **Catálogo das indústrias**, vê **somente o catálogo da própria indústria** (sem Acesso master).
- Não exporta planilha de validades/price; não edita custos.
- Não arrasta status no kanban; não cria/edita atividades.

### Cliente

- **Grupo** (ex.: `MATEUS`): filtra validades pelo **nome da loja** contendo o grupo.
- No **Catálogo das indústrias**, vê **todos** os catálogos (consulta; sem acesso master).
- No Sucesso do cliente: pedidos cujo **cliente** contém o grupo e/ou **CNPJ** com a mesma raiz do CNPJ de login.
- No **Price**: lojas do grupo — para **MATEUS**, inclui nomes curtos das bandeiras (`Mix …`, `Super Castanhal`, etc.), não só o texto “MATEUS”.
- Nas **Atividades**: só lojas do grupo (mesmos tokens de bandeira quando aplicável).
- Ideia: um usuário “Mateus” acompanha **todas as lojas Mateus**, não só um CNPJ isolado.
- Mesmas restrições de leitura (sem export / sem editar / sem mover kanban / sem criar atividades).

## Auth híbrido (login vs recovery)

| Fluxo | Como funciona |
|-------|----------------|
| **Login do dia a dia** | Custom: consulta `usuarios`, verifica `senha` (`salt$sha256`), grava sessão no navegador (`localStorage` / `sessionStorage`, chave `fe_web_auth_session`). **Não** é JWT do Supabase Auth. |
| **Esqueci minha senha** | Supabase Auth (recovery) + Edge Functions `request-password-reset` / `sync-password-after-reset` → página `/redefinir-senha` sincroniza a nova senha em `usuarios.senha`. |
| **Requests ao PostgREST** | Usam a chave anon do projeto; a autorização de tela é no front (`ProtectedRoute` + `nivel_acesso`). Não assumir RLS “por usuário logado” no painel. |

Promotor / Demonstradora: bloqueados no login **web** salvo cargos liberados na allowlist do auth — fluxo de campo é tipicamente o app mobile.

Matriz completa sectionId ↔ rota ↔ cargo: [07-permissoes-e-rotas.md](./07-permissoes-e-rotas.md).

## Sessão

A sessão fica guardada no navegador (não usa login JWT do Supabase Auth no dia a dia). Ao sair, os dados da sessão são limpos.

## Hub Grupo Fé (admin supremo)

Além do Gerente (que gerencia usuários do App Fé), existe o flag `is_super_admin` na tabela `usuarios`:

- Vê o balão **Grupo Fé** com todos os sistemas (Fé, Finance, Imobi, Daily).
- Pode marcar outros usuários como admin supremo e liberar sistemas/seções do hub no formulário de usuários.
- Gerente **não** herda isso automaticamente.

Permissões do hub ficam em `hub_usuario_sistemas` e `hub_usuario_secoes` (não no JSON `nivel_acesso`).

**Primeiro seed:** rode no SQL do App Fé `UPDATE usuarios SET is_super_admin = true WHERE cpf = '…';` e faça login novamente. Detalhes em [05-tecnologia-e-deploy.md](./05-tecnologia-e-deploy.md).

## Notificações (sino)

| Tipo de usuário | O que aparece no sino |
|-----------------|------------------------|
| Interno | Lançamentos de venda, Sucesso do cliente e kanban financeiro |
| Indústria / Cliente | **Somente** Sucesso do cliente do próprio escopo; se não houver, a lista fica vazia |

Externos **não** veem notificações de vendas gerais nem do financeiro.
