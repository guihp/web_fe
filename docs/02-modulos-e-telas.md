# Módulos e telas

## Home (Portal)

Rota: `/`

Mostra os **balões** liberados para o usuário. Cada balão leva ao hub ou à primeira seção disponível do módulo.

Balões atuais: **Merchandising**, **Fé Representações**, **Financeiro**, **Administrador** (Gerente).

---

## Merchandising

Hub: `/merchandising`

| Seção | Rota | O que faz |
|-------|------|-----------|
| Treinamentos | `/treinamento` | Materiais e PDFs de capacitação |
| Atividades | `/atividades` | Visitas / ações de merchandising em PDV |
| Validades | `/validades` | Produtos próximos do vencimento ou vencidos; filtros UF, indústria, mês, status; exportação (internos) |

### Validades — detalhes

- Destaca itens a vencer em menos de 30 dias e itens já vencidos.
- Exportar dados: disponível para internos; bloqueado para externos.
- Externos só veem o recorte da indústria ou do grupo de lojas.

### Atividades — detalhes (externos)

- Externos **vêem** atividades dos promotores no escopo (indústria = marca; cliente = lojas do grupo), em **somente leitura**.
- Internos criam/editam/cancelam/excluem.

---

## Fé Representações

Hub: `/fe-representacoes`

| Seção | Rota | O que faz |
|-------|------|-----------|
| Price | `/fe-representacoes/price` | Internas/externas por **mês**; export/import de custos; markup/margem + gráfico; externos em leitura com escopo |
| Sucesso do cliente | `/fe-representacoes/sucesso-cliente` | Kanban de pedidos a partir das vendas lançadas; status arrastável (internos) |
| Relatórios | `/fe-representacoes/relatorios` | Relatórios comerciais |
| Projeção de metas | `/fe-representacoes/projecao-metas` | Metas vs realizado |
| Vendas (dashboard) | `/fe-representacoes/vendas` | KPIs (com % MA/PI e PA), realizado x meta, barras/pizza por indústria |
| Lançamento de vendas | `/fe-representacoes/lancamento` | Incluir/editar/cancelar vendas |
| Cadastro de clientes | `/fe-representacoes/clientes` | Cadastro operacional de clientes |
| Base de clientes | `/fe-representacoes/base-clientes` | Base tabular de clientes |
| Base de dados | `/fe-representacoes/base-vendas` | Base tabular de vendas |

No cadastro de usuário interno, o card **Fé Representações** permite liberar Price/Sucesso e **escolher se libera Vendas** (cada tela `vendas.*` separadamente).

### Sucesso do cliente — detalhes

Colunas do kanban (status):

1. Enviado ou gerado  
2. Faturado  
3. Em trânsito  
4. Aguardando recebimento  
5. Entregue finalizado  

Filtros: mês, ano, indústria, vendedor, estado, busca. Externos não alteram status.

### Dashboard de vendas

- Valores das barras por indústria ficam **ao lado** da barra, com **%** e linha de **Total**.
- Comparativo mensal: toggle **rosca (Meta)** / **pizza (Indústria)**.

### Rotas legadas (redirect)

- `/merchandising/price`, `/administrador/price` → `/fe-representacoes/price`
- `/merchandising/sucesso-cliente`, `/administrador/sucesso-cliente`, `/administrador/perfis` → `/fe-representacoes/sucesso-cliente`
- `/vendas`, `/lancamento`, `/relatorios`, `/projecao-metas`, `/clientes`, `/base-clientes`, `/base-vendas` → equivalentes em `/fe-representacoes/...`
- `/comissao` → Financeiro na aba Comissão

### Lançamento de vendas

Campos típicos: data, CDC, pedido, valor, indústria, **categoria** (obrigatória), vendedor, cliente, CNPJ, cidade, estado, mês, ano.  
Pode disparar webhook de vendas (integração n8n), quando configurado.

---

## Financeiro

Rota base: `/financeiro` (abas internas)

| Aba / seção | O que faz |
|-------------|-----------|
| Contratos / visão geral | Contratos de merchandising e ações; KPIs e gráficos |
| Composição | Composição de cobrança dos contratos (modelo, comissão, etc.) |
| Comissão | Acompanhamento de comissões |

---

## Administrador

Hub: `/administrador` (somente **Gerente**)

| Seção | Rota | O que faz |
|-------|------|-----------|
| Usuários | `/administrador/usuarios` | Criar/editar internos e externos; permissões por seção |
| Empresa | `/administrador/empresa` | Dados da matriz |
| Regionais | `/administrador/regionais` | Cadastro de regionais |
| Filiais | `/administrador/filiais` | Filiais vinculadas |
| Indústrias | `/administrador/industrias` | Indústrias parceiras |
| Clientes | `/administrador/clientes` | Clientes admin |
| Metas | `/administrador/metas` | Metas |
| Colaboradores | `/colaboradores` | Gestão de colaboradores |

Price **não** fica mais no Administrador — só em **Fé Representações**.

---

## Notificações

- **Internos:** lançamentos de vendas, Sucesso do cliente e kanban financeiro.
- **Externos (indústria/cliente):** apenas movimentações do **Sucesso do cliente** do próprio escopo. Se não houver nada no escopo, a lista fica vazia.
