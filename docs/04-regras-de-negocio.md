# Regras de negócio

## Usuários e permissões

1. Só **Gerente** cria/edita usuários e acessa o hub Administrador completo.
2. Usuário **interno** inativo (`status = false`) não entra.
3. Usuário **externo** só vê Validades, Atividades, Sucesso do cliente e **Price**, em leitura (sem Vendas).
4. Indústria externa: dados filtrados pela indústria vinculada (Validades, Atividades, Sucesso do cliente e Price).
5. Cliente externo: dados filtrados pelo **grupo de nome de loja** (ex.: MATEUS) e afinidade de CNPJ (raiz do CNPJ de login); no Price/Atividades, o grupo MATEUS também casa bandeiras curtas (`Mix`, `Super Castanhal`).
6. Notificações de externos: Sucesso do cliente do próprio escopo + encartes recentes (sem avisos de RH). No dia do aniversário, o próprio usuário vê parabéns só no seu sino (preferência `notify_aniversario`, padrão ligada).
7. **Sino:** itens ficam na lista por **48h** desde o horário do evento; o **badge** só marca não-lido na criação (até a próxima abertura do sino).
8. **Promotor** e **Demonstradora**: no sino — **aniversário**, **avisos**, **tarefas novas** (início nas últimas 48h) e **encartes** (~48h após o início). Não recebem lançamento de venda nem kanbans comerciais.
9. **Meta batida** (mensal ou anual, regionais MA/PI e PA): só cargos de liderança internos — Gerente, Supervisor, Analista admin, RH e Financeiro — no sino (preferência `notify_meta`).
9. Promotor/Demonstradora têm até **7 lojas** em `usuario_lojas`. Em Atividades: check-in na loja (cidade/UF automáticos da tabela `lojas`, sem GPS), escolha de indústria e fotos antes/depois. Antes do envio, confirma com prévia das fotos + senha do dia — após confirmar é **irreversível**; a senha grava em `atividade_dia.senha_do_dia`.
10. Balão **Fé Representações** concentra Price, Sucesso, Avisos (Gerente) e Vendas; no cadastro interno, Vendas pode ser liberada ou não por seção.
11. Balão **Merchandising** inclui **Fazer pesquisa** para todos os usuários internos (não indústria/cliente).
12. **Ebook digital** (/merchandising/ebook): só **Gerente**, **Supervisor**, **Analista admin** e **RH**. Fotos vêm de `atividade_dia` + URLs públicas do bucket `atividade-fotos` (sem webhook). PDF só das miniaturas selecionadas.
13. **Catálogo das indústrias** (`/merchandising/catalogo`): consulta no App para internos e externos. **Acesso master** (gestão/Drive) só Gerente / Supervisor / RH / Analista admin internos. Externo indústria = só o próprio catálogo; externo cliente = todos. Sem gestão para externos.
14. **Gestão de Veículos:** uso em Fé Representações para Gerente, Supervisor, Financeiro, RH, Analista admin e Vendedor. **Aprovar/rejeitar valores e CRUD da frota:** só Gerente e Financeiro. Externos, Promotor e Demonstradora sem acesso. Sem tela em Merchandising.

## Avisos

1. Destinatários: somente usuários **internos** (sino + push). Indústria/cliente externo não recebem.
2. **Salário** e **feriado**: Gerente envia em `/fe-representacoes/avisos` com modelo editável. Antes do envio, confirma com prévia do título/mensagem — após confirmar é **irreversível**.
3. **Folha de ponto**: automática todo dia 25 (texto padrão no banco); ninguém dispara manualmente.
4. Preferência de push: `notify_aviso` (default ligado para internos).

## Price

1. Pesquisas em `pesquisa` com `tipo_pesquisa` `interna` ou `externa`.
2. Internas: custo (`preco_custo`), markup/margem e gráfico; export/import de custo só para internos.
3. Filtro por **`mes`**: um mês disponível → esse; vários → mês vigente (usuário pode trocar).
4. Externos não exportam nem editam custo.
5. **Fazer pesquisa** (`/merchandising/pesquisas`): internos escolhem tipo (interna = só nossas indústrias; externa = nosso produto ou concorrência), UF (MA/PI/PA), loja e fornecedor. Promotor/Demonstradora só veem lojas de `usuario_lojas`; gerente/supervisor e demais internos veem todas. Grava rascunho em `pesquisa` (câmera/OCR depois).

## Vendas

1. **Categoria é obrigatória** no lançamento de vendas.
2. Indústria deve ser salva/consultada na forma padronizada (maiúsculas).
3. Cancelar/editar venda atualiza a base e pode notificar webhook, se configurado.

## Validades

1. Listagem paginada com filtros (UF, indústria, mês de vencimento, status, ordenação).
2. Status “menos de 1 mês” = vence nos próximos 30 dias; “já vencido” = data anterior a hoje.
3. Exportação XLSX: só usuários internos (não externos); coluna loja no formato `código - nome`.
4. Para cliente externo, o vínculo é pelo **texto do campo loja** contendo o grupo (não há CNPJ na tabela de validades).
5. **Registrar venda** só **Gerente**, **Supervisor** e **Analista admin**: parcial reduz `qtde_unit`; total marca `todos_vendidos` (some da lista daquela loja). Gráfico agrega por produto no mês — some do gráfico só se zerar em todas as lojas.
6. Registros com `todos_vendidos = true` (ou qtde 0) não aparecem na lista/gráfico/exportação ativa.
7. Exibição da loja na lista/modal/Excel: `código - nome` (cadastro `lojas`), no mesmo padrão do Lançar vencimentos.
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

1. Cadastro de indústrias alimenta filtros de vendas, validades e comissão. A tela admin lista Ativo e Inativo.
2. Em **qualquer dropdown/select operacional** (lançamento e edição de vendas, atividades, projeção de metas, financeiro, relatórios, filtros de Validades/Price/Sucesso, usuário externo indústria, comissão), só entram indústrias com status **Ativo** (ou status vazio legado). Inativas não aparecem para novos lançamentos.
3. Ao **editar** registro já ligado a indústria inativa (venda ou usuário), a opção atual permanece no select só para não quebrar o formulário; não deve ser escolhida em cadastros novos.
4. Login tipo Indústria rejeita cadastro com status Inativo.
5. Filiais/lojas têm CNPJ e podem ligar a regionais.
6. Grupo Mateus (exemplo real de uso): várias lojas com a mesma raiz de CNPJ; o usuário cliente usa grupo `MATEUS`.

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
