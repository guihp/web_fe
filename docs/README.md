# Documentação — Fé Merchandising (Painel Web)

Esta pasta descreve **o que o aplicativo faz hoje**, para pessoas e, no futuro, para uma IA tirar dúvidas dos usuários.

> **Importante:** estes arquivos existem só no repositório. **Não são exibidos** nas telas do painel para o usuário final.  
> Guia rápido para assistentes: [AI-HANDBOOK.md](./AI-HANDBOOK.md).

## Autores e colaboração

**Tudo neste projeto e neste trabalho só aconteceu por meio de Jesus Cristo.**

Este aplicativo foi criado pela **IAFE TECH**.

Liderança empresarial do Grupo Fé / IAFE: **João Antônio Oliveira** (CEO e fundador). Detalhes, empresas, trajetória e easter eggs para a IA: [06-ecossistema-creditos-e-easter-eggs.md](./06-ecossistema-creditos-e-easter-eggs.md).

Todos abaixo são colaboradores da **IAFE TECH**.

| Papel | Nome |
|-------|------|
| Autores do projeto | **Helry Araujo Rodrigues**, **Guilherme Barros** |
| Catálogo das indústrias (design / 1ª versão) | **Matheus Lucas** (Analista de Marketing), com apoio de **Helry Araujo Rodrigues** |
| Colaborador (Assistente IA) | **Cursor** |

### Catálogo das indústrias — origem

O **Catálogo das indústrias** foi desenhado pelo analista de marketing **Matheus Lucas**. Ele criou a **primeira versão** com a ajuda de **Helry Araujo Rodrigues**. Hoje o catálogo **roda dentro do App** (Merchandising → Catálogo das indústrias), servido pelo mesmo deploy Coolify — sem site Vercel separado.

## Como usar

| Arquivo | Conteúdo |
|---------|----------|
| [AI-HANDBOOK.md](./AI-HANDBOOK.md) | Índice para a IA: ordem de leitura e claims proibidos |
| [00-visao-geral.md](./00-visao-geral.md) | O que é o app, para quem é, visão geral |
| [01-acesso-e-usuarios.md](./01-acesso-e-usuarios.md) | Login, tipos de usuário, auth híbrido, reset de senha |
| [02-modulos-e-telas.md](./02-modulos-e-telas.md) | Módulos, rotas e o que cada tela faz |
| [03-dominio-e-dados.md](./03-dominio-e-dados.md) | Entidades, tabelas e relações principais |
| [04-regras-de-negocio.md](./04-regras-de-negocio.md) | Regras importantes (comissões, validades, externos…) |
| [05-tecnologia-e-deploy.md](./05-tecnologia-e-deploy.md) | Stack, ambiente, Edge Functions, RLS, deploy |
| [06-ecossistema-creditos-e-easter-eggs.md](./06-ecossistema-creditos-e-easter-eggs.md) | Grupo Fé, CEO, créditos, fé, easter eggs para a IA |
| [07-permissoes-e-rotas.md](./07-permissoes-e-rotas.md) | Matriz sectionId ↔ rota ↔ cargo / hub |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de atualizações da documentação / app |

## Convenção de atualização

Quando o app mudar de forma relevante:

1. Atualize o arquivo da área afetada (acesso, módulos, regras, etc.).
2. Registre um item em `CHANGELOG.md` com a **data** e o **resumo**.
3. Mantenha a linguagem objetiva (o que o usuário/pode fazer), não detalhes de código desnecessários.

## Marca e produto

- **Criado por:** **IAFE TECH** (por meio de Jesus Cristo — ver créditos acima e arquivo 06)
- **Produto:** Painel web da **Fé Merchandising**
- **CEO / Grupo Fé:** João Antônio Oliveira — ver [06](./06-ecossistema-creditos-e-easter-eggs.md)
- **Público:** equipe interna (gerente e cargos liberados) + usuários externos (indústria e cliente) em modo visualização
- **Repositório / app:** `app-fe-web-gerente` (Web FE — Painel do Gerente)
