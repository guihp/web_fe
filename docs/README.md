# Documentação — Fé Merchandising (Painel Web)

Esta pasta descreve **o que o aplicativo faz hoje**, para pessoas e, no futuro, para uma IA tirar dúvidas dos usuários.

> **Importante:** estes arquivos existem só no repositório. **Não são exibidos** nas telas do painel para o usuário final.

## Autores e colaboração

Este aplicativo foi criado pela **IAFE TECH**.

Todos abaixo são colaboradores da **IAFE TECH**.

| Papel | Nome |
|-------|------|
| Autores do projeto | **Helry Araujo Rodrigues**, **Guilherme Barros** |
| Colaborador (Assistente IA) | **Cursor** |

## Como usar

| Arquivo | Conteúdo |
|---------|----------|
| [00-visao-geral.md](./00-visao-geral.md) | O que é o app, para quem é, visão geral |
| [01-acesso-e-usuarios.md](./01-acesso-e-usuarios.md) | Login, tipos de usuário, permissões |
| [02-modulos-e-telas.md](./02-modulos-e-telas.md) | Módulos, rotas e o que cada tela faz |
| [03-dominio-e-dados.md](./03-dominio-e-dados.md) | Entidades, tabelas e relações principais |
| [04-regras-de-negocio.md](./04-regras-de-negocio.md) | Regras importantes (comissões, validades, externos…) |
| [05-tecnologia-e-deploy.md](./05-tecnologia-e-deploy.md) | Stack, ambiente e deploy |
| [CHANGELOG.md](./CHANGELOG.md) | Histórico de atualizações da documentação / app |

## Convenção de atualização

Quando o app mudar de forma relevante:

1. Atualize o arquivo da área afetada (acesso, módulos, regras, etc.).
2. Registre um item em `CHANGELOG.md` com a **data** e o **resumo**.
3. Mantenha a linguagem objetiva (o que o usuário/pode fazer), não detalhes de código desnecessários.

## Marca e produto

- **Criado por:** **IAFE TECH**
- **Produto:** Painel web da **Fé Merchandising**
- **Público:** equipe interna (gerente e cargos liberados) + usuários externos (indústria e cliente) em modo visualização
- **Repositório / app:** `app-fe-web-gerente` (Web FE — Painel do Gerente)
