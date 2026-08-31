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
| Atividades | `/atividades` | Gestores: visitas enviadas aos promotores. **Promotor/Demonstradora:** Meu roteiro (lojas vinculadas → check-in → indústria → fotos antes/depois; sem GPS) |
| Lançar vencimentos | `/atividades/lancar-vencimentos` | Formulário de validade (internos); código reduzido preenche produto/indústria via `codigos`; envia ao webhook n8n `comercial1` |
| Validades | `/validades` | Lista + gráfico dos produtos que mais venceram no mês; filtros UF, indústria, mês, status e ordenação; exportação (internos); externos só o próprio escopo |

No hub **Merchandising**, **todos** os usuários logados (internos e externos) veem o bloco **Senha do dia** (tabela `senhas`, calendário de hoje em America/Sao_Paulo).

### Validades — detalhes

- Destaca itens a vencer em menos de 30 dias e itens já vencidos.
- Ordenação: **vencimento** (padrão), **últimas lançadas → primeiras** ou **primeiras → últimas** (campo `created_at`).
- Toggle **Lista / Gráfico**: ranking dos produtos que **mais venceram** no mês (soma de `qtde_unit`), top 12; filtros UF/indústria/mês; externos só veem o próprio escopo.
- **Registrar venda** (só **Gerente**, **Supervisor**, **Analista admin**): venda parcial reduz `qtde_unit`; **tudo vendido** marca `todos_vendidos` e some da lista **daquela loja**. No gráfico, a quantidade do produto cai; o produto só some do gráfico do mês se zerar em **todas** as lojas.
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
| Avisos | `/fe-representacoes/avisos` | **Só Gerente:** enviar aviso de salário ou feriado (modelos editáveis); folha de ponto automática no dia 25 |
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

- **Internos (demais cargos):** lançamentos de vendas, Sucesso do cliente, kanban financeiro e **avisos** (salário / feriado / folha).
- **Promotor / Demonstradora:** só **avisos** (pagamento, feriado, folha) e **aniversário** — sem vendas/kanbans.
- **Externos (indústria/cliente):** apenas movimentações do **Sucesso do cliente** do próprio escopo. Externos **não** recebem avisos. Se não houver nada no escopo, a lista fica vazia.

### Avisos (equipe interna)

- Tabela `avisos` + RPC `enviar_aviso` (Gerente, tipos `salario` e `feriado`).
- Folha (`tipo = folha`): job `pg_cron` `aviso-folha-dia-25` (todo dia 25 ~09:00 BRT), sem envio manual.
- Push: Edge Function `send-web-push` com `kind = aviso` só para inscritos internos (`notify_aviso`).
