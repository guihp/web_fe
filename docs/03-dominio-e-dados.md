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
| Validade | `validades` | lojas (texto; na UI/export vira `código - nome` via cadastro `lojas`), industria, produto, lote, data_vencimento, UF, promotor, `qtde_unit`, **`todos_vendidos`** (boolean; some da lista quando true) |
| Pesquisa de preço (Price) | `pesquisa` | `tipo_pesquisa` (`interna`\|`externa`), produto (`descricao`), industria, loja, UF, `preco_varejo`, `preco_atacado`, `preco_custo` (internas), **`mes`** (ex.: AGOSTO), `promotor`. Rascunhos de **Fazer pesquisa** usam descrição `[RASCUNHO] Aguardando captura pela câmera`. |
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

## Gestão de Veículos

| Conceito | Tabela | Uso |
|----------|--------|-----|
| Veículo | `veiculos` | Frota (placa única); `consumo_medio_km_l` = **autonomia (km/L)** obrigatória no cadastro; situacao disponivel/em_uso/manutencao/inativo |
| Responsabilidade | `veiculo_responsabilidades` | Vínculo usuário ↔ veículo (`programado` → `em_uso` → `aguardando_aprovacao` → `finalizado`) |
| Manutenção | `veiculo_manutencoes` | Aberta/concluída; bloqueia atribuição |
| Retirada / Entrega | `veiculo_retiradas` / `veiculo_entregas` | Foto do hodômetro, km (máscara BR), status da prestação |
| Gastos | `veiculo_abastecimentos`, `veiculo_lavagens`, `veiculo_despesas` | Comprovantes (URLs no Storage) |
| Aprovação / auditoria | `veiculo_aprovacoes`, `veiculo_auditoria` | Log permanente |
| Config | `veiculo_config` | Preço padrão sugerido do litro; fórmula oficial sempre por autonomia |

**Cálculo de combustível (oficial):**  
`(km_rodados ÷ autonomia_km_l) × preco_combustivel`  
Ex.: 13 km ÷ 30 km/L × R$ 5,99 ≈ R$ 2,60.

**Fluxo:** retirada (foto + km) → uso → entrega (foto + km + lavagem/abastecimentos) → aprovação. Ao **aprovar** (ou confirmar débito), a responsabilidade fica `finalizado` e o veículo volta a `disponivel`.

Storage: bucket `veiculo-anexos` (público; fotos de hodômetro/comprovantes/frota).

Migrations relevantes: `20260915180000_gestao_veiculos.sql`, `20260916140000_veiculos_autonomia_km_l.sql`, `20260916143000_combustivel_por_autonomia.sql`, `20260916150000_veiculos_notif_realtime.sql`.

## Arquivos (Storage)

| Bucket | Conteúdo típico |
|--------|-----------------|
| `perfil-fotos` | Foto de perfil do usuário |
| `pdf_treinamento` | PDFs de treinamento |
| `contrato-anexos` | Anexos de contratos |
| `atividade-fotos` | Fotos de atividades (URLs em `atividade_dia.foto_antes_url` / `foto_depois_url`; galeria do Ebook digital) |
| `veiculo-anexos` | Fotos de hodômetro, comprovantes e frota (Gestão de Veículos) |

## Padronização de nomes

- **Indústria:** função/padrão `industria_padrao` / `toIndustriaPadrao` — remove sufixos tipo ALIMENTOS, LTDA, etc., e deixa maiúsculo.
- Isso evita duplicar “Predilecta” vs “PREDILECTA ALIMENTOS” em filtros e comissões.
