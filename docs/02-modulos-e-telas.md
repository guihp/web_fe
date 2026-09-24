# Módulos e telas

## Home (Portal)

Rota: `/`

Mostra os **balões** liberados para o usuário. Cada balão leva ao hub ou à primeira seção disponível do módulo.

Balões atuais: **Merchandising**, **Fé Representações**, **Financeiro**, **Administrador** (Gerente), **Grupo Fé** (admin supremo ou usuários com sistemas liberados).

---

## Grupo Fé

Hub: `/grupo-fe`

Dashboard consolidado com KPIs (cards + gráficos) de:

| Sistema | Fonte |
|---------|--------|
| Fé Merchandising | DB local App Fé |
| IAFÉ Finance | Supabase Finance (via Edge Function) |
| IAFÉ Imobi | Supabase Imobi |
| Daily | Supabase Daily |

Visibilidade: `is_super_admin` ou ao menos um registro em `hub_usuario_sistemas`. Não usa `nivel_acesso`.

KPIs por sistema (cards no hub; dados via Edge Function `hub-metrics`):

| Sistema | Seções típicas |
|---------|----------------|
| Fé (`fe`) | Resumo, usuários ativos, vendas do mês, pedidos kanban |
| Finance (`finance`) | Resumo, clientes, assinaturas ativas, transações do mês |
| Imobi (`imobi`) | Resumo, empresas, usuários, leads, imóveis |
| Daily (`daily`) | Resumo, usuários, clientes/projetos, demandas da semana |

Zeros com status “Atualizado” costumam indicar secret/RLS errado no `hub-metrics` (ver `05`). Matriz de seções do hub: [07-permissoes-e-rotas.md](./07-permissoes-e-rotas.md).

---

## Merchandising

Hub: `/merchandising`

| Seção | Rota | O que faz |
|-------|------|-----------|
| Treinamentos | `/treinamento` | Materiais e PDFs de capacitação |
| Atividades | `/atividades` | Gestores: visitas enviadas aos promotores. **Promotor/Demonstradora:** Meu roteiro (lojas vinculadas → check-in → indústria → fotos antes/depois; sem GPS). Antes de enviar, confirma com prévia das fotos + senha do dia (irreversível). **Offline:** salva no aparelho e sincroniza ao reconectar. |
| Lançar vencimentos | `/atividades/lancar-vencimentos` | Formulário de validade (internos); código reduzido preenche produto/indústria via `codigos`; envia ao webhook n8n `comercial1`. **Offline:** enfileira e reenvia ao conectar. |
| Validades | `/validades` | Lista + gráfico dos produtos que mais venceram no mês; filtros UF, indústria, mês, status e ordenação; loja no formato `código - nome`; exportação (internos); externos só o próprio escopo. **Offline:** consulta o último snapshot em cache (sem registrar venda). |
| Lançar promoções/encarte | `/merchandising/encartes` | **Gerente / Supervisor / Analista admin:** importar Excel e lançar encartes na operação |
| Fazer pesquisa | `/merchandising/pesquisas` | **Internos:** lançar pesquisa interna ou externa (mesma tabela `pesquisa` do Price). Promotor/Demonstradora escolhem só lojas cadastradas; demais internos, todas. Fluxo: contexto → câmera com moldura (produto + etiqueta) → OCR Coolify → confirmação editável → `update` na `pesquisa`. |
| Ebook digital | `/merchandising/ebook` | **Gerente / Supervisor / Analista admin / RH:** galeria de fotos de `atividade_dia` (antes/depois no Storage), filtros, miniaturas e PDF das selecionadas. Sem webhook. |
| Catálogo das indústrias | `/merchandising/catalogo` | Consulta **dentro do App** (iframe de `/catalogo/`). **Acesso master** só Gerente / Supervisor / RH / Analista admin (internos). Externo **indústria** vê só a própria; externo **cliente** vê todas. Gestão/Drive usam login Google separado. **Offline:** consulta produtos já salvos no aparelho. |

No hub **Merchandising**, **todos** os usuários logados (internos e externos) veem o bloco **Senha do dia** (tabela `senhas`, calendário de hoje em America/Sao_Paulo).

### Catálogo das indústrias — detalhes

- **Origem:** desenhado pelo analista de marketing **Matheus Lucas**; primeira versão criada com apoio de **Helry Araujo Rodrigues**. Hoje roda **embutido no painel** (mesmo domínio / Coolify), não em site externo.
- Hub abre `/merchandising/catalogo`; assets em `public/catalogo/`; API same-origin (`/api/catalog`, `/api/product-image`) via Edge Functions Supabase.
- Botão voltar retorna ao Merchandising (`target="_parent"` quando em iframe).
- Externos não veem **Acesso master** / gestão; escopo por tipo (indústria vs cliente) conforme regras de acesso.

### Validades — detalhes

- Destaca itens a vencer em menos de 30 dias e itens já vencidos.
- Coluna **Loja** (e Excel / modal de venda): formato `código - nome` (ex.: `1 - MATEUS SUPERMERCADOS S.A. - BALSAS`), alinhado ao Lançar vencimentos; resolve pelo cadastro `lojas`.
- Ordenação: **vencimento** (padrão), **últimas lançadas → primeiras** ou **primeiras → últimas** (campo `created_at`).
- Toggle **Lista / Gráfico**: ranking dos produtos que **mais venceram** no mês (soma de `qtde_unit`), top 12; filtros UF/indústria/mês; externos só veem o próprio escopo.
- **Registrar venda** (só **Gerente**, **Supervisor**, **Analista admin**): venda parcial reduz `qtde_unit`; **tudo vendido** marca `todos_vendidos` e some da lista **daquela loja**. No gráfico, a quantidade do produto cai; o produto só some do gráfico do mês se zerar em **todas** as lojas.
- Exportar dados: disponível para internos; bloqueado para externos; Excel inclui o código da loja no mesmo formato da tela.
- Externos só veem o recorte da indústria ou do grupo de lojas.

### Atividades — detalhes (externos)

- Externos **vêem** atividades dos promotores no escopo (indústria = marca; cliente = lojas do grupo), em **somente leitura**.
- Internos criam/editam/cancelam/excluem.

---

## Fé Representações

Hub: `/fe-representacoes`

| Seção | Rota | O que faz |
|-------|------|-----------|
| Price | `/fe-representacoes/price` | Internas/externas por **mês**; export/import de custos; markup/margem + gráfico; externos em leitura com escopo; internos têm atalho **Fazer pesquisa** |
| Sucesso do cliente | `/fe-representacoes/sucesso-cliente` | Kanban de pedidos a partir das vendas lançadas; status arrastável (internos) |
| Avisos | `/fe-representacoes/avisos` | **Só Gerente:** enviar aviso de salário ou feriado (modelos editáveis); confirmação com prévia da mensagem antes do envio (irreversível); folha de ponto automática no dia 25 |
| Gestão de Veículos | `/fe-representacoes/veiculos` | Frota (CRUD + autonomia km/L: Gerente/Financeiro), meus veículos (retirada/entrega com foto de hodômetro, máscaras BR de data/km), aprovação (placa + marca/modelo; só Gerente/Financeiro), manutenção, quem está com o veículo, relatórios. Cargos: Gerente, Supervisor, Financeiro, RH, Analista admin, Vendedor. |
| Relatórios | `/fe-representacoes/relatorios` | **Relatórios de Crescimento** (comercial) — não confundir com a aba Relatórios do Financeiro |
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

Rota base: `/financeiro` — abas via `?tab=` (UI). No `nivel_acesso` existem sobretudo `financeiro.home`, `financeiro.composicao` e `financeiro.comissao`; Relatórios e Kanban usam o mesmo gate do módulo (quem acessa Financeiro vê as abas). Detalhe: [07-permissoes-e-rotas.md](./07-permissoes-e-rotas.md).

| Aba (`?tab=`) | O que faz |
|---------------|-----------|
| *(padrão)* Contratos | Contratos de merchandising e ações; KPIs e gráficos |
| `composicao` | Composição de cobrança dos contratos (modelo, comissão, etc.) |
| `relatorios` | Relatórios **financeiros** (contratos/faturamento) — distinto de `/fe-representacoes/relatorios` |
| `kanban` | Kanban de Faturamento (colunas de processo dos contratos) |
| `comissao` | Acompanhamento de comissões (`calcular_comissoes`, etc.) |

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
| Gestão de Veículos | `/administrador/veiculos` | Frota, responsabilidades, manutenção, quem está com o veículo, dashboard, config (preço sugerido do litro) e auditoria (Gerente) |
| Colaboradores | `/colaboradores` | Lista administrativa de **usuários** (mesma tabela `usuarios`; não é RH/folha separada) |

Price **não** fica mais no Administrador — só em **Fé Representações**.

---

## Notificações

- **Internos (demais cargos):** lançamentos de vendas, Sucesso do cliente, kanban financeiro, **avisos** (salário / feriado / folha) e, quando aplicável, **veículos** (atribuição, prestação, lembrete 7 dias após retirada).
- **Liderança (Gerente, Supervisor, Analista admin, RH, Financeiro):** além do acima, avisos de **meta mensal/anual batida** por regional (MA/PI e PA), com preferência `notify_meta` no modal Instalar app e notificações; Gerente/Financeiro também veem a **fila de aprovação** de veículos.
- **Promotor / Demonstradora:** **avisos** (pagamento, feriado, folha), **tarefas** novas, **encartes do dia de início**, **aniversário**.
- **Externos (indústria/cliente):** Sucesso do cliente do próprio escopo + **encartes do dia de início** (marca/loja no escopo). Externos **não** recebem avisos de RH.
- **Aniversário (todos):** no dia do aniversário, só o próprio usuário vê “Feliz aniversário!” no sino. Preferência `notify_aniversario` (padrão ligado) no modal Instalar app e notificações, para interno e externo.

### Janela e leitura do sino

- O sino mostra eventos das **últimas 48 horas** (retenção rolante desde o horário do evento). Itens mais antigos **saem** da lista.
- O **badge** (sinal vermelho) só aparece para itens **criados depois** da última abertura do sino. Abrir o sino zera o badge; os itens continuam na lista até completar 48h (já como lidos).
- Encartes no sino: a partir do **dia/hora de início** da promoção; permanecem ~48h.
- Tarefas no sino: a partir de `data_inicio`; só se ainda vigentes e dentro das 48h.

### Avisos (equipe interna)

- Tabela `avisos` + RPC `enviar_aviso` (Gerente, tipos `salario` e `feriado`).
- Folha (`tipo = folha`): job `pg_cron` `aviso-folha-dia-25` (todo dia 25 ~09:00 BRT), sem envio manual.
- Push: Edge Function `send-web-push` com `kind = aviso` só para inscritos internos (`notify_aviso`).
