import { useCallback, useEffect, useMemo, useState } from 'react';
import ValidadeVendaModal from '../components/validades/ValidadeVendaModal';
import ValidadesTopChart from '../components/validades/ValidadesTopChart';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  VALIDADE_PAGE_SIZE,
  canRegistrarVendaValidade,
  daysUntilVencimento,
  fetchAllValidades,
  fetchValidades,
  fetchValidadesFilterOptions,
  fetchValidadesTopVencidos,
  isExpiringSoon,
  registrarVendaValidade,
  type Validade,
  type ValidadeMesOption,
  type ValidadeSort,
  type ValidadeStatusFilter,
  type ValidadeTopProduto,
} from '../services/validadeService';
import {
  buildLojaLabelLookup,
  fetchLojas,
  formatLojaLabelFromStored,
} from '../services/lojasService';
import { exportValidadesXlsx } from '../utils/xlsxIO';
import './BaseDadosVendas.css';
import './Validades.css';

type ViewMode = 'lista' | 'grafico';

function formatPreco(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  if (!y || !m || !d) return value.slice(0, 10);
  return `${d}/${m}/${y}`;
}

function rowClassName(item: Validade): string | undefined {
  const days = daysUntilVencimento(item.data_vencimento);
  if (days == null) return undefined;
  if (days < 0) return 'row-expired';
  if (days <= 30) return 'row-expiring-soon';
  return undefined;
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function Validades() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const somenteLeitura = Boolean(user?.somente_leitura);
  const podeRegistrarVenda =
    !somenteLeitura && canRegistrarVendaValidade(user?.cargo);
  const scopeIndustria =
    user?.tipo_usuario === 'industria' ? user.industria_nome ?? undefined : undefined;
  const scopeClienteGrupo =
    user?.tipo_usuario === 'cliente' ? user.cliente_grupo ?? undefined : undefined;

  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [search, setSearch] = useState('');
  const [uf, setUf] = useState('Todos');
  const [industria, setIndustria] = useState('Todos');
  const [mes, setMes] = useState('Todos');
  const [sort, setSort] = useState<ValidadeSort>('vencimento_asc');
  const [statusFilter, setStatusFilter] = useState<ValidadeStatusFilter>('all');
  const [ufs, setUfs] = useState<string[]>([]);
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [meses, setMeses] = useState<ValidadeMesOption[]>([]);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Validade[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartRows, setChartRows] = useState<ValidadeTopProduto[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [vendaItem, setVendaItem] = useState<Validade | null>(null);
  const [lojaLabelLookup, setLojaLabelLookup] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    fetchLojas()
      .then((lojas) => {
        if (!cancelled) setLojaLabelLookup(buildLojaLabelLookup(lojas));
      })
      .catch(() => {
        /* rótulo cai no nome bruto */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scopeIndustria) setIndustria(scopeIndustria);
  }, [scopeIndustria]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const opts = await fetchValidadesFilterOptions();
      setUfs(opts.ufs);
      setIndustrias(
        scopeIndustria
          ? opts.industrias.filter((i) => i === scopeIndustria)
          : opts.industrias,
      );
      setMeses(opts.meses);
    } catch {
      /* filtros opcionais */
    }
  }, [scopeIndustria]);

  const loadValidades = useCallback(async () => {
    if (viewMode !== 'lista') return;
    setLoading(true);
    try {
      const result = await fetchValidades({
        search,
        uf: uf === 'Todos' ? undefined : uf,
        industria:
          scopeIndustria ||
          (industria === 'Todos' ? undefined : industria),
        mes: mes === 'Todos' ? undefined : mes,
        status: statusFilter,
        sort,
        page,
        pageSize: VALIDADE_PAGE_SIZE,
        scopeIndustria,
        scopeClienteGrupo,
      });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar validades.', 'error');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    viewMode,
    search,
    uf,
    industria,
    mes,
    statusFilter,
    sort,
    page,
    showToast,
    scopeIndustria,
    scopeClienteGrupo,
  ]);

  const loadChart = useCallback(async () => {
    if (viewMode !== 'grafico') return;
    setChartLoading(true);
    try {
      // Sem mês na lista → gráfico usa o mês atual (melhor leitura de “no mês”)
      const mesChart = mes === 'Todos' ? currentYearMonth() : mes;
      const rows = await fetchValidadesTopVencidos({
        uf: uf === 'Todos' ? undefined : uf,
        industria:
          scopeIndustria ||
          (industria === 'Todos' ? undefined : industria),
        mes: mesChart,
        scopeIndustria,
        scopeClienteGrupo,
      });
      setChartRows(rows);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar gráfico.', 'error');
      setChartRows([]);
    } finally {
      setChartLoading(false);
    }
  }, [viewMode, uf, industria, mes, showToast, scopeIndustria, scopeClienteGrupo]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadValidades();
  }, [loadValidades]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  const toggleStatusFilter = (next: ValidadeStatusFilter) => {
    setStatusFilter((prev) => (prev === next ? 'all' : next));
    setPage(1);
  };

  const handleViewMode = (next: ViewMode) => {
    setViewMode(next);
    if (next === 'grafico' && mes === 'Todos') {
      // Preferir mês vigente no gráfico; usuário pode trocar no select
      setMes(currentYearMonth());
    }
  };

  const chartPeriodLabel = useMemo(() => {
    const mesKey = mes === 'Todos' ? currentYearMonth() : mes;
    const hit = meses.find((m) => m.value === mesKey);
    if (hit) return hit.label;
    const [y, m] = mesKey.split('-');
    const names = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    const idx = Number(m) - 1;
    return `${names[idx] ?? m}/${y}`;
  }, [mes, meses]);

  const totalPages = Math.max(1, Math.ceil(total / VALIDADE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * VALIDADE_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * VALIDADE_PAGE_SIZE, total);

  const handleExport = async () => {
    if (somenteLeitura) {
      showToast('Exportação indisponível para usuário externo.', 'info');
      return;
    }
    try {
      const all = await fetchAllValidades({ scopeIndustria, scopeClienteGrupo });
      exportValidadesXlsx(
        all.map((v) => ({
          ...v,
          lojas: formatLojaLabelFromStored(v.lojas, lojaLabelLookup),
        })),
      );
      showToast(
        all.length === 0
          ? 'Planilha exportada (somente cabeçalhos, não há validades).'
          : `${all.length} validades exportadas.`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na exportação.', 'error');
    }
  };

  const handleRegistrarVenda = async (opts: {
    qtdeVendida?: number;
    tudoVendido?: boolean;
  }) => {
    if (!vendaItem) return;
    const updated = await registrarVendaValidade(vendaItem.id, opts);
    showToast(
      updated.todos_vendidos
        ? 'Marcado como tudo vendido, saiu da listagem desta loja.'
        : `Quantidade atualizada para ${updated.qtde_unit ?? 0} un.`,
      'success',
    );
    await loadValidades();
    if (viewMode === 'grafico') await loadChart();
  };

  return (
    <div className="base-vendas-page validades-page">
      <BackToPortal to="/merchandising" label="Voltar ao Merchandising" />

      <header className="base-vendas-header">
        <h1 className="page-title">Validades</h1>
        <p className="base-vendas-subtitle">
          Produtos próximos do vencimento, itens com menos de 1 mês ficam destacados
        </p>
        {somenteLeitura && (
          <p className="base-vendas-subtitle" style={{ marginTop: 8 }}>
            Modo visualização
            {scopeIndustria ? `, indústria ${scopeIndustria}` : ''}
            {scopeClienteGrupo ? `, grupo ${scopeClienteGrupo}` : ''}.
          </p>
        )}
      </header>

      <section className="card base-vendas-card">
        <div className="base-vendas-card-top">
          <h2>
            {viewMode === 'lista'
              ? `Validades (${total} total)`
              : 'Produtos que mais venceram'}
          </h2>
          <div className="base-vendas-actions">
            <div className="validades-view-toggle" role="group" aria-label="Visualização">
              <button
                type="button"
                className={viewMode === 'lista' ? 'active' : ''}
                onClick={() => handleViewMode('lista')}
              >
                Lista
              </button>
              <button
                type="button"
                className={viewMode === 'grafico' ? 'active' : ''}
                onClick={() => handleViewMode('grafico')}
              >
                Gráfico
              </button>
            </div>
            {viewMode === 'lista' && !somenteLeitura && (
              <button type="button" className="base-vendas-btn outline" onClick={handleExport}>
                <span>⬇</span> Exportar Dados
              </button>
            )}
          </div>
        </div>

        {viewMode === 'lista' && (
          <div className="base-vendas-search">
            <input
              type="search"
              placeholder="Pesquisar por código, produto, loja, promotor..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}

        <div className="base-vendas-filters validades-filters">
          <span className="filter-icon" aria-hidden>
            ⚙
          </span>
          <select
            value={uf}
            onChange={(e) => {
              setUf(e.target.value);
              setPage(1);
            }}
          >
            <option value="Todos">UF</option>
            {ufs.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            value={industria}
            disabled={Boolean(scopeIndustria)}
            onChange={(e) => {
              setIndustria(e.target.value);
              setPage(1);
            }}
          >
            <option value="Todos">Indústria</option>
            {industrias.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            value={mes}
            onChange={(e) => {
              setMes(e.target.value);
              setPage(1);
            }}
          >
            {viewMode === 'lista' && <option value="Todos">Mês</option>}
            {meses.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {viewMode === 'grafico' &&
              mes !== 'Todos' &&
              !meses.some((m) => m.value === mes) && (
                <option value={mes}>{chartPeriodLabel}</option>
              )}
          </select>
          {viewMode === 'lista' && (
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ValidadeSort);
                setPage(1);
              }}
              aria-label="Ordenação"
              title="Ordenação"
            >
              <option value="vencimento_asc">Vencimento (próximos primeiro)</option>
              <option value="lancamento_desc">Últimas lançadas → primeiras</option>
              <option value="lancamento_asc">Primeiras lançadas → últimas</option>
            </select>
          )}
        </div>

        {viewMode === 'lista' && (
          <div className="validades-legend" role="group" aria-label="Filtrar por situação">
            <button
              type="button"
              className={`validades-legend-btn soon ${statusFilter === 'soon' ? 'is-active' : ''}`}
              onClick={() => toggleStatusFilter('soon')}
              aria-pressed={statusFilter === 'soon'}
            >
              <span className="validades-legend-item soon" aria-hidden />
              Menos de 1 mês
            </button>
            <button
              type="button"
              className={`validades-legend-btn expired ${statusFilter === 'expired' ? 'is-active' : ''}`}
              onClick={() => toggleStatusFilter('expired')}
              aria-pressed={statusFilter === 'expired'}
            >
              <span className="validades-legend-item expired" aria-hidden />
              Já vencido
            </button>
            {statusFilter !== 'all' && (
              <button
                type="button"
                className="validades-legend-clear"
                onClick={() => {
                  setStatusFilter('all');
                  setPage(1);
                }}
              >
                Limpar filtro
              </button>
            )}
          </div>
        )}

        {viewMode === 'grafico' ? (
          <ValidadesTopChart
            data={chartRows}
            loading={chartLoading}
            periodLabel={chartPeriodLabel}
            emptyHint={
              scopeIndustria || scopeClienteGrupo
                ? 'Nenhum produto vencido no seu escopo neste período.'
                : 'Nenhum produto vencido neste período.'
            }
          />
        ) : (
          <>
            <div className="base-vendas-table-wrap">
              {loading ? (
                <p style={{ padding: 24 }}>Carregando validades...</p>
              ) : (
                <table className="base-vendas-table validades-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Produto</th>
                      <th>Data vencimento</th>
                      <th>Loja</th>
                      <th>UF</th>
                      <th>Indústria</th>
                      <th>Promotor</th>
                      <th>Preço</th>
                      <th>Qtde</th>
                      <th>Lote</th>
                      {podeRegistrarVenda && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={podeRegistrarVenda ? 11 : 10}
                          style={{ textAlign: 'center', padding: 24 }}
                        >
                          Nenhuma validade encontrada.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => {
                        const soon = isExpiringSoon(item.data_vencimento);
                        return (
                          <tr key={item.id} className={rowClassName(item)}>
                            <td className={soon ? 'col-emphasis' : undefined}>
                              {item.codigo ?? '—'}
                            </td>
                            <td className={soon ? 'col-emphasis col-produto' : 'col-produto'}>
                              {item.descricao ?? '—'}
                            </td>
                            <td className={soon ? 'col-vencimento' : undefined}>
                              {formatData(item.data_vencimento)}
                            </td>
                            <td className={soon ? 'col-emphasis' : undefined}>
                              {formatLojaLabelFromStored(item.lojas, lojaLabelLookup)}
                            </td>
                            <td>{item.uf ?? '—'}</td>
                            <td>{item.industria ?? '—'}</td>
                            <td>{item.promotor ?? '—'}</td>
                            <td>{formatPreco(item.preco)}</td>
                            <td>{item.qtde_unit ?? '—'}</td>
                            <td>{item.lote ?? '—'}</td>
                            {podeRegistrarVenda && (
                              <td>
                                <button
                                  type="button"
                                  className="validades-venda-btn"
                                  onClick={() => setVendaItem(item)}
                                >
                                  Venda
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <footer className="base-vendas-footer">
              <span>
                Mostrando {rangeStart} - {rangeEnd} de {total}
              </span>
              <div className="base-vendas-pagination">
                <button
                  type="button"
                  className="page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹ Anterior
                </button>
                <span>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  className="page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próxima ›
                </button>
              </div>
            </footer>
          </>
        )}
      </section>

      {vendaItem && (
        <ValidadeVendaModal
          item={vendaItem}
          lojaLabel={formatLojaLabelFromStored(vendaItem.lojas, lojaLabelLookup)}
          onClose={() => setVendaItem(null)}
          onConfirm={handleRegistrarVenda}
        />
      )}
    </div>
  );
}
