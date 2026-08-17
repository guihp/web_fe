# Acesso e usuários

## Tipos de login (tela Login)

| Aba | Tipo | Identificador | Senha |
|-----|------|---------------|-------|
| **Equipe** | Interno | **CPF** (11 dígitos) | Sim |
| **Indústria** | Externo | **Nome da indústria** (ex.: PREDILECTA) | Sim |
| **Cliente** | Externo | **CNPJ** (14 dígitos) | Sim |

Opção **Lembrar**: mantém a sessão no navegador; sem isso, a sessão vale até fechar a aba/janela.

Esqueci a senha: o usuário deve **contactar o administrador** (não há reset self-service no web).

## Tipos de usuário no cadastro

| Tipo | Quem cria | Vínculo | Telas |
|------|-----------|---------|-------|
| `interno` | Gerente | CPF + cargo + seções | Conforme `nível de acesso` |
| `industria` | Gerente | Indústria cadastrada (`industrias`) | Só Validades + Sucesso do cliente (leitura) |
| `cliente` | Gerente | **Grupo** (ex.: MATEUS) + **CNPJ de login** | Só Validades + Sucesso do cliente (leitura) |

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

- **módulos** (balões da home): Merchandising, Vendas, Financeiro, Administrador
- **seções** (telas dentro dos balões)

Regras importantes:

- **Validades** fica liberada para usuários internos autenticados (seção sempre disponível).
- Externos **não** escolhem seções: recebem fixo Validades + Sucesso do cliente.
- Externos entram em **modo somente leitura** (`somente_leitura`).

## Escopo dos externos

### Indústria

- Vê validades cuja indústria é a dela.
- Vê pedidos do Sucesso do cliente dessa indústria.
- Não exporta planilha de validades.
- Não arrasta status no kanban.

### Cliente

- **Grupo** (ex.: `MATEUS`): filtra validades pelo **nome da loja** contendo o grupo.
- No Sucesso do cliente: pedidos cujo **cliente** contém o grupo e/ou **CNPJ** com a mesma raiz do CNPJ de login.
- Ideia: um usuário “Mateus” acompanha **todas as lojas Mateus**, não só um CNPJ isolado.
- Mesmas restrições de leitura (sem export / sem mover kanban).

## Sessão

A sessão fica guardada no navegador (não usa login JWT do Supabase Auth neste momento). Ao sair, os dados da sessão são limpos.
