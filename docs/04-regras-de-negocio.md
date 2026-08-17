# Regras de negócio

## Usuários e permissões

1. Só **Gerente** cria/edita usuários e acessa o hub Administrador completo.
2. Usuário **interno** inativo (`status = false`) não entra.
3. Usuário **externo** só vê Validades e Sucesso do cliente, em leitura.
4. Indústria externa: dados filtrados pela indústria vinculada.
5. Cliente externo: dados filtrados pelo **grupo de nome de loja** (ex.: MATEUS) e afinidade de CNPJ (raiz do CNPJ de login).
6. Notificações de externos: só Sucesso do cliente do próprio escopo (sem vendas gerais nem financeiro).

## Vendas

1. **Categoria é obrigatória** no lançamento de vendas.
2. Indústria deve ser salva/consultada na forma padronizada (maiúsculas).
3. Cancelar/editar venda atualiza a base e pode notificar webhook, se configurado.

## Validades

1. Listagem paginada com filtros (UF, indústria, mês de vencimento, status).
2. Status “menos de 1 mês” = vence nos próximos 30 dias; “já vencido” = data anterior a hoje.
3. Exportação XLSX: só usuários internos (não externos).
4. Para cliente externo, o vínculo é pelo **texto do campo loja** contendo o grupo (não há CNPJ na tabela de validades).

## Sucesso do cliente

1. Cards nascem das vendas (`baseVendas`).
2. Status fica em `pedido_kanban` (um por venda).
3. Internos podem arrastar entre colunas; externos não.
4. Status padrão inicial: **Enviado ou gerado**.

## Comissão

1. Percentual é **único por indústria**; categoria ao lado é **opcional**.
2. Sem categoria (Geral): % sobre todas as vendas da indústria no período.
3. Com categoria: % só sobre vendas daquela categoria.
4. **Recalcular** grava/substitui os valores salvos no banco para o ano/mês filtrados.
5. Até **31/12/2026** o sistema mostra alerta: categoria completa nos pedidos só a partir de **agosto/2026**; para visão anual ou “todos os meses”, o ideal é não categorizar.

## Indústrias e lojas

1. Cadastro de indústrias alimenta filtros de vendas, validades e comissão.
2. Filiais/lojas têm CNPJ e podem ligar a regionais.
3. Grupo Mateus (exemplo real de uso): várias lojas com a mesma raiz de CNPJ; o usuário cliente usa grupo `MATEUS`.

## Financeiro / contratos

1. Contratos podem ter modelo de cobrança e composição (incluindo comissão por indústria/categoria, conforme telas de composição).
2. Kanban de faturamento acompanha o andamento do ciclo financeiro do contrato.

## Integrações

1. Webhooks n8n opcionais (vendas, senha de novo usuário, etc.) — configurados por variáveis de ambiente.
2. Versículo na tela de login vem de API externa (com fallback se falhar).

## Limitações conhecidas (contexto para a IA)

- Autenticação atual **não** é Supabase Auth; sessão é do próprio painel.
- Políticas de banco (RLS) ainda são amplas no ambiente de testes — endurecimento de segurança está **adiado** para depois do ciclo de feedback dos usuários.
- Validades de cliente externo dependem do **nome da loja** bater com o grupo; lançamentos mal escritos podem não aparecer.
