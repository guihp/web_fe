# Visão geral

## O que é

O **Painel Web da Fé Merchandising** é o sistema usado pela operação e gestão para acompanhar:

- Merchandising em loja (treinamentos, atividades, pesquisa, validades, **catálogo das indústrias**)
- Representações / comercial (Price, Sucesso do cliente, vendas)
- Financeiro (contratos, composição, comissões)
- Administração (usuários, indústrias, filiais, regionais, etc.)

Há também um **aplicativo mobile** separado para alguns perfis de campo; este documento trata do **painel web**.

## Para quem é

| Perfil | Uso típico |
|--------|------------|
| **Equipe interna** (Gerente, Supervisor, Financeiro, RH, Analista admin, Vendedor, etc.) | Opera o painel conforme as seções liberadas no cadastro |
| **Gerente** | Acesso amplo; único que gerencia usuários e o hub Administrador |
| **Indústria (externo)** | Só **vê** Validades, Atividades, Sucesso do cliente e **Price** **da própria indústria** |
| **Cliente (externo)** | Só **vê** Validades, Atividades, Sucesso do cliente e **Price** do **seu grupo de lojas** (ex.: todas as lojas Mateus) |

## Como o usuário navega

1. Entra na tela de **Login** (abas Equipe / Indústria / Cliente).
2. Cai na **Home** com os **balões** (módulos) liberados.
3. Dentro de cada módulo, acessa as **seções** (telas) permitidas.

## Princípios atuais

- Dados de negócio ficam no **Supabase** (banco + arquivos).
- Permissões de tela vêm do cadastro do usuário (`nível de acesso` / seções).
- Nomes de **indústria** são padronizados em **MAIÚSCULAS** (ex.: `PREDILECTA`).
- Lançamentos de venda **exigem categoria** (relevante a partir de agosto/2026 para comissão por categoria).

## O que este painel não é

- Não substitui o app mobile de promotores/degustação (há mensagem de login apontando o mobile para cargos não liberados no web, conforme regra vigente).
- Usuário externo **não edita** Validades, Atividades nem move cards no Sucesso do cliente — só acompanha.

## Créditos (só documentação)

O painel foi criado pela **IAFE TECH**. Autores e colaboração (todos colaboradores da IAFE TECH) estão listados em [`docs/README.md`](./README.md). Essa informação **não é exibida** nas telas do aplicativo.

O **Catálogo das indústrias** foi desenhado por **Matheus Lucas** (Analista de Marketing); a primeira versão foi feita com a ajuda de **Helry Araujo Rodrigues**. Hoje o catálogo **roda dentro do App** (Merchandising), no mesmo deploy Coolify.
