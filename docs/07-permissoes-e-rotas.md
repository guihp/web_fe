# Permissões e rotas (matriz para a IA)

Fonte canônica no código: `src/data/portalModules.ts`, `src/data/hubPermissions.ts`, `src/utils/externalAccess.ts`, `src/components/auth/ProtectedRoute.tsx`.

Detalhes de produto por tela: [02-modulos-e-telas.md](./02-modulos-e-telas.md).  
Auth / tipos de usuário: [01-acesso-e-usuarios.md](./01-acesso-e-usuarios.md).

---

## Dois sistemas de permissão

| Sistema | Campo / tabelas | Controla |
|---------|-----------------|----------|
| **Painel App Fé** | `usuarios.nivel_acesso` (JSON: `modulos`, `secoes`, `perfil`) | Balões Merchandising, Fé Representações, Financeiro, Administrador |
| **Hub Grupo Fé** | `is_super_admin` + `hub_usuario_sistemas` + `hub_usuario_secoes` | Balão `/grupo-fe` e KPIs multi-sistema |

`grupo-fe.hub` **não** entra no JSON `nivel_acesso`.

---

## Matriz: sectionId ↔ rota ↔ módulo

### Merchandising

| sectionId | Rota | Título |
|-----------|------|--------|
| `merchandising.hub` | `/merchandising` | Hub Merchandising |
| `treinamentos.home` | `/treinamento` | Treinamentos |
| `atividades.home` | `/atividades` | Atividades |
| *(sem sectionId próprio)* | `/atividades/lancar-vencimentos` | Lançar vencimentos — herda prefixo `atividades`; internos via `canLancarVencimentos` |
| `validades.home` | `/validades` | Validades (**sempre** liberada a autenticados internos na sanitização) |
| `merchandising.encartes` | `/merchandising/encartes` | Lançar promoções/encarte |
| `merchandising.pesquisas` | `/merchandising/pesquisas` | Fazer pesquisa (gate adicional de tipo na página) |
| `merchandising.ebook` | `/merchandising/ebook` | Ebook digital |
| `merchandising.catalogo` | `/merchandising/catalogo` | Catálogo das indústrias (consulta liberada no hub; gestão na página) |

### Fé Representações

| sectionId | Rota | Título |
|-----------|------|--------|
| `fe-representacoes.hub` | `/fe-representacoes` | Hub |
| `fe-representacoes.price` | `/fe-representacoes/price` | Price |
| `fe-representacoes.sucesso` | `/fe-representacoes/sucesso-cliente` | Sucesso do cliente |
| `fe-representacoes.avisos` | `/fe-representacoes/avisos` | Avisos (**só Gerente**) |
| `fe-representacoes.veiculos` | `/fe-representacoes/veiculos` | Gestão de Veículos |
| `vendas.relatorios` | `/fe-representacoes/relatorios` | Relatórios de Crescimento (comercial) |
| `vendas.projecao-metas` | `/fe-representacoes/projecao-metas` | Projeção de metas |
| `vendas.dashboard` | `/fe-representacoes/vendas` | Vendas |
| `vendas.lancamento` | `/fe-representacoes/lancamento` | Lançamento de vendas |
| `vendas.clientes` | `/fe-representacoes/clientes` | Cadastro de clientes |
| `vendas.base-clientes` | `/fe-representacoes/base-clientes` | Base de clientes |
| `vendas.base-vendas` | `/fe-representacoes/base-vendas` | Base de dados |

### Financeiro

Seções no `nivel_acesso` (portal):

| sectionId | Rota | Nota |
|-----------|------|------|
| `financeiro.home` | `/financeiro` | Abre o módulo; aba padrão **Contratos** |
| `financeiro.composicao` | `/financeiro?tab=composicao` | |
| `financeiro.comissao` | `/financeiro?tab=comissao` | Alias legado: `vendas.comissao` |

**Abas da UI** (todas em `/financeiro?tab=…`; **não** são sectionIds separados):

| Aba (`?tab=`) | Nome | Relação com permissão |
|---------------|------|------------------------|
| *(vazio / contratos)* | Contratos | Quem tem qualquer `financeiro.*` (ou comissão legada) |
| `composicao` | Composição | Idem |
| `relatorios` | Relatórios (Financeiro) | Mesmo gate do hub financeiro — **não** confundir com `vendas.relatorios` |
| `kanban` | Kanban de Faturamento | Idem |
| `comissao` | Comissão | `financeiro.comissao` / `financeiro.home` / legado |

### Administrador (só cargo Gerente)

| sectionId | Rota |
|-----------|------|
| `administrador.hub` | `/administrador` |
| `administrador.usuarios` | `/administrador/usuarios` |
| `administrador.empresa` | `/administrador/empresa` |
| `administrador.regionais` | `/administrador/regionais` |
| `administrador.filiais` | `/administrador/filiais` |
| `administrador.industrias` | `/administrador/industrias` |
| `administrador.clientes` | `/administrador/clientes` |
| `administrador.metas` | `/administrador/metas` |
| `administrador.veiculos` | `/administrador/veiculos` |
| `administrador.colaboradores` | `/colaboradores` |

**Colaboradores** usa a mesma tabela `usuarios` (lista administrativa) — não há tabela HR separada.

### Grupo Fé

| sectionId | Rota | Gate |
|-----------|------|------|
| `grupo-fe.hub` | `/grupo-fe` | `is_super_admin` **ou** ≥1 sistema em `hub_usuario_sistemas` |

---

## Gates por cargo / tipo (além do JSON)

| Recurso | Regra |
|---------|--------|
| Gerenciar usuários / Admin | Cargo **Gerente** (`canManageUsers`) |
| Avisos | Só Gerente |
| Encartes | Gerente, Supervisor, Analista admin |
| Ebook / gestão catálogo | Gerente, Supervisor, Analista admin, RH |
| Veículos (uso) | Gerente, Supervisor, Financeiro, RH, Analista admin, Vendedor; só `tipo_usuario = interno` |
| Veículos (aprovar / CRUD frota) | Gerente, Financeiro |
| Lançar vencimentos | Internos (não indústria/cliente) |
| Fazer pesquisa | Liberado no hub para internos; página barra externo |
| Catálogo (consulta) | Liberado no hub para interno **e** externo; escopo na página |
| Validades | Sempre disponível na sanitização de seções internas |
| Senha do dia | Todos logados (interno e externo) |
| Promotor / Demonstradora no web | Bloqueados no login web salvo cargos em allowlist (ver auth); fluxo de campo tipicamente mobile |

---

## Defaults (`defaultSecoesForCargo`)

- **Gerente:** todas as seções do portal **exceto** `grupo-fe.*`.
- **Demais cargos internos:** seções de Merchandising + Fé Representações + Financeiro (sem Administrador, sem Grupo Fé); **sem** avisos; encartes/ebook/veículos só se o cargo passar no gate.

Label em `nivel_acesso.perfil`: Gerente → `Tela Padrão Gerente`; demais (incluindo não-Promotor) → rótulo `Tela Padrão Promotor` (quirk histórico — não inventar outros nomes).

---

## Externos

Seções fixas (`EXTERNAL_SECTION_IDS`):

- `validades.home`
- `atividades.home`
- `fe-representacoes.sucesso`
- `fe-representacoes.price`

**Exceção:** `merchandising.catalogo` e `merchandising.pesquisas` / Validades podem ser tratadas como liberadas no `userHasSectionAccess` mesmo fora dessa lista — catálogo: consulta ok; pesquisa: tipicamente só internos na prática da página. Externos em **somente leitura** nas telas de operação.

---

## Hub Grupo Fé — sistemas e seções KPI

| sistemaId | Nome | Seções (KPI) |
|-----------|------|--------------|
| `fe` | Fé Merchandising | `fe.resumo`, `fe.usuarios`, `fe.vendas`, `fe.kanban` |
| `finance` | IAFÉ Finance | `finance.resumo`, `finance.clientes`, `finance.assinaturas`, `finance.transacoes` |
| `imobi` | IAFÉ Imobi | `imobi.resumo`, `imobi.empresas`, `imobi.usuarios`, `imobi.leads`, `imobi.imoveis` |
| `daily` | Daily | `daily.resumo`, `daily.usuarios`, `daily.clientes`, `daily.semana` |

- Super admin: vê tudo.
- Com sistemas e **sem** seções explícitas: libera todas as seções daqueles sistemas.
- Com seções explícitas: só as marcadas.

---

## IDs legados (remap)

| Antigo | Atual |
|--------|--------|
| `vendas.comissao` | `financeiro.comissao` |
| `merchandising.price` / `administrador.price` | `fe-representacoes.price` |
| `merchandising.sucesso` / `administrador.sucesso` | `fe-representacoes.sucesso` |
| Módulo legado `vendas` | Expande para seções `vendas.*` |

Paths legados redirecionam (ver `02`). Rotas curtas `/vendas`, `/comissao`, etc. mapeiam via `sectionIdForPath`.
