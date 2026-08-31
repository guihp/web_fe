# Domínio e dados

Visão orientada ao **negócio**. Nomes técnicos entre parênteses ajudam a IA e o time de produto.

## Pessoas e acesso

| Conceito | Onde vive | Observação |
|----------|-----------|------------|
| Usuário | `usuarios` | Interno (CPF) ou externo (indústria / cliente) |
| Tipo | `tipo_usuario` | `interno` \| `industria` \| `cliente` |
| Indústria vinculada | `industria_id` → `industrias` | Login externo por nome |
| Grupo cliente | `cliente_grupo` | Ex.: MATEUS |
| CNPJ de login | `login_cnpj` | Só cliente externo |
| Permissões | `nivel_acesso` | JSON com módulos e seções |

## Cadastros mestres

| Conceito | Tabela | Uso |
|----------|--------|-----|
| Indústria | `industrias` | Nome padronizado (MAIÚSCULO); vendas, validades, comissão |
| Loja / PDV | `lojas` | Filiais comerciais; CNPJ; regional; cidade; estado |
| Usuário × loja | `usuario_lojas` | Até 7 PDVs por Promotor/Demonstradora |
| Regional | `regionais` | Agrupamento geográfico / gestão |
| Empresa FE | `empresas` + `filiais` | Dados da própria empresa Fé |
| Cliente (base) | `baseCliente` | CDC, CNPJ, fantasia, razão social |

## Vendas

| Conceito | Tabela | Campos-chave |
|----------|--------|----------------|
| Venda | `baseVendas` | data, cdc, numero_pedido, valor, industria, **categoria**, vendedor, cliente, cnpj, cidade, estado, mes, ano |
| Meta / projeção | `metas_projecao` | Metas por indústria/período vs realizado |

Categoria de venda (exemplos usados no app): FEIJÃO, GOMA, MILHO, REGULAR, FOOD, MANTEIGA, QUEIJO, EMPORIO, DOCE.

## Comissão

| Conceito | Tabela / RPC | Uso |
|----------|--------------|-----|
| % por indústria | `industria_percentual` | percentual + categoria opcional |
| Resultado calculado | `comissao_industria` | valor_venda, % aplicado, valor_comissao por indústria/mês/ano/região |
| Cálculo | RPC `calcular_comissoes` | Recalcular na tela de Comissão |

Região nas comissões costuma aparecer como `MA/PI` ou `PA` (a partir do estado da venda).

## Merchandising operacional

| Conceito | Tabela | Uso |
|----------|--------|-----|
| Validade | `validades` | lojas (texto), industria, produto, lote, data_vencimento, UF, promotor, `qtde_unit`, **`todos_vendidos`** (boolean; some da lista quando true) |
| Pesquisa de preço (Price) | `pesquisa` | `tipo_pesquisa` (`interna`\|`externa`), produto (`descricao`), industria, loja, UF, `preco_varejo`, `preco_atacado`, `preco_custo` (internas), **`mes`** (ex.: AGOSTO) |
| Atividade | `atividades` / `atividade_dia` | Ações em loja / dia |
| Treinamento | `treinamento` | Catálogo; PDF em storage |

No Price, o filtro de mês usa os valores existentes em `pesquisa.mes`: se houver só um, seleciona esse; se houver vários, inicia no **mês vigente** (e o usuário pode trocar).

## Sucesso do cliente

| Conceito | Tabela | Uso |
|----------|--------|-----|
| Pedido (origem) | `baseVendas` | Cards do kanban |
| Status do pedido | `pedido_kanban` | Um status por `venda_id` |

## Financeiro / contratos

| Conceito | Tabela | Uso |
|----------|--------|-----|
| Contrato | `contratos` | Merchandising / ações; composição de cobrança |
| Filiais do contrato | `contrato_filiais` | Lojas cobertas |
| Faturamento / kanban | `contrato_faturamento` | Colunas de processo |
| Anexos | `contrato_anexos` | Arquivos |
| Histórico | `contrato_historico` | Eventos |
| Comissão mensal contrato | `contrato_comissao_mes` | Quando aplicável |

## Arquivos (Storage)

| Bucket | Conteúdo típico |
|--------|-----------------|
| `perfil-fotos` | Foto de perfil do usuário |
| `pdf_treinamento` | PDFs de treinamento |
| `contrato-anexos` | Anexos de contratos |
| `atividade-fotos` | Fotos de atividades (quando usado) |

## Padronização de nomes

- **Indústria:** função/padrão `industria_padrao` / `toIndustriaPadrao` — remove sufixos tipo ALIMENTOS, LTDA, etc., e deixa maiúsculo.
- Isso evita duplicar “Predilecta” vs “PREDILECTA ALIMENTOS” em filtros e comissões.
