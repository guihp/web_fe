# Módulos e telas

## Home (Portal)

Rota: `/`

Mostra os **balões** liberados para o usuário. Cada balão leva ao hub ou à primeira seção disponível do módulo.

---

## Merchandising

Hub: `/merchandising`

| Seção | Rota | O que faz |
|-------|------|-----------|
| Treinamentos | `/treinamento` | Materiais e PDFs de capacitação |
| Atividades | `/atividades` | Visitas / ações de merchandising em PDV |
| Validades | `/validades` | Produtos próximos do vencimento ou vencidos; filtros UF, indústria, mês, status; exportação (internos) |
| Price | `/merchandising/price` | Placeholder (conteúdo a definir) |
| Sucesso do cliente | `/merchandising/sucesso-cliente` | Kanban de pedidos a partir das vendas lançadas; status arrastável (internos) |

Rotas antigas `/administrador/sucesso-cliente` e `/administrador/perfis` redirecionam para Sucesso do cliente.

### Validades — detalhes

- Destaca itens a vencer em menos de 30 dias e itens já vencidos.
- Exportar dados: disponível para internos; bloqueado para externos.
- Externos só veem o recorte da indústria ou do grupo de lojas.

### Sucesso do cliente — detalhes

Colunas do kanban (status):

1. Enviado ou gerado  
2. Faturado  
3. Em trânsito  
4. Aguardando recebimento  
5. Entregue finalizado  

Filtros: mês, ano, indústria, vendedor, estado, busca. Externos não alteram status.

---

## Vendas

| Seção | Rota | O que faz |
|-------|------|-----------|
| Relatórios | `/relatorios` | Relatórios comerciais |
| Projeção de metas | `/projecao-metas` | Metas vs realizado |
| Vendas (dashboard) | `/vendas` | Visão geral de vendas |
| Lançamento de vendas | `/lancamento` | Incluir/editar/cancelar vendas |
| Cadastro de clientes | `/clientes` | Cadastro operacional de clientes |
| Base de clientes | `/base-clientes` | Base tabular de clientes |
| Base de dados | `/base-vendas` | Base tabular de vendas |

Rota legada `/vendas/lancamento` → `/lancamento`.  
Rota `/comissao` → Financeiro na aba Comissão.

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
| Comissão | Comissão por indústria: filtros ano/mês/região; percentuais; **Recalcular** grava no banco |
| Kanban / faturamento | Acompanhamento de faturamento de contratos (conforme UI atual) |
| Relatórios | Relatórios financeiros no módulo |

### Comissão — detalhes rápidos

- Um **% por indústria**, com **categoria opcional** ao lado (se escolher categoria, o cálculo usa só vendas dessa categoria).
- **Recalcular** calcula e **salva/substitui** valores do período.
- Alerta temporário (até 31/12/2026): categoria completa em todos os pedidos só a partir de **agosto/2026**; para anual/todos os meses, preferir **Geral (todas)**.

---

## Administrador

Hub: `/administrador` — **só Gerente** (e seções admin liberadas).

| Seção | Rota | O que faz |
|-------|------|-----------|
| Usuários | `/administrador/usuarios` | Criar/editar/inativar; internos e externos |
| Price | `/administrador/price` | Placeholder |
| Empresa | `/administrador/empresa` | Empresa e filiais da FE |
| Regionais | `/administrador/regionais` | Cadastro de regionais |
| Filiais | `/administrador/filiais` | Lojas/PDVs (`lojas`) |
| Indústrias | `/administrador/industrias` | Cadastro de indústrias |
| Clientes | `/administrador/clientes` | Cadastro admin de clientes |
| Metas | `/administrador/metas` | Metas administrativas |
| Colaboradores | `/colaboradores` | Gestão de colaboradores |

---

## Outros

| Item | Rota | Notas |
|------|------|-------|
| Login | `/login` | Público; quem já está logado é redirecionado |
| Qualquer rota inválida | `*` | Vai para a Home |

## Notificações (topo)

O sino no topo lista eventos recentes conforme o tipo de usuário:

- **Internos:** lançamentos de vendas, Sucesso do cliente e kanban financeiro.
- **Externos (indústria/cliente):** apenas movimentações do **Sucesso do cliente** do próprio escopo (mesma indústria ou mesmo grupo/CNPJ). Se não houver nada no escopo, a lista fica vazia.
