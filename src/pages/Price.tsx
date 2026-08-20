import { useCallback, useEffect, useRef, useState } from 'react';
import PriceInternoChart from '../components/price/PriceInternoChart';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  PRICE_PAGE_SIZE,
  calcMargemFromMarkup,
  calcMarkupExibido,
  calcMarkupPercent,
  fetchAllPesquisas,
  fetchPesquisaIndustrias,
  fetchPesquisaMeses,
  fetchPesquisas,
  formatMoneyInput,
  formatPct,
  parseMoney,
  pickDefaultMes,
  updatePesquisaCusto,
  updatePesquisasCustoBatch,
  type PesquisaItem,
  type TipoPesquisa,
} from '../services/priceService';
import { formatBRL } from '../utils/currency';
import { exportPesquisasXlsx, parsePesquisasCustoXlsx } from '../utils/xlsxIO';
import './BaseDadosVendas.css';
import './Price.css';

type ViewMode = 'lista' | 'grafico';

function money(value: number | null): string {
  if (value == null) return '—';
  return formatBRL(value);
}

function CostCell({
  id,
  value,
  onSaved,
  readOnly,
}: {
  id: number;
  value: number | null;
  onSaved: (next: number | null) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(() => formatMoneyInput(value));
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setDraft(formatMoneyInput(value));
  }, [id, value]);

  if (readOnly) {
    return <span className="col-num">{money(value)}</span>;
  }

  const save = async () => {
    const trimmed = draft.trim();
    const parsed = trimmed === '' ? null : parseMoney(trimmed);
    if (trimmed !== '' && parsed == null) {
      showToast('Custo inválido. Use formato 12,50.', 'error');
      setDraft(formatMoneyInput(value));
      return;
    }
    if (parsed === value || (parsed == null && value == null)) return;
    if (parsed != null && parsed < 0) {
      showToast('Custo não pode ser negativo.', 'error');
      setDraft(formatMoneyInput(value));
      return;
    }

    setSaving(true);
    try {
      await updatePesquisaCusto(id, parsed);
      onSaved(parsed);
      setDraft(formatMoneyInput(parsed));
      showToast('Custo salvo.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar custo.', 'error');
      setDraft(formatMoneyInput(value));
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      className="price-custo-input"
      type="text"
      inputMode="decimal"
      aria-label="Preço de custo"
      value={draft}
      disabled={saving}
      placeholder="0,00"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export default function Price() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const somenteLeitura = Boolean(user?.somente_leitura);
  const scopeIndustria =
    user?.tipo_usuario === 'industria' ? user.industria_nome ?? undefined : undefined;
  const scopeClienteGrupo =
    user?.tipo_usuario === 'cliente' ? user.cliente_grupo ?? undefined : undefined;

  const [tipo, setTipo] = useState<TipoPesquisa>('interna');
  const [search, setSearch] = useState('');
  const [industria, setIndustria] = useState('Todas');
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PesquisaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [multiplicadorPct, setMultiplicadorPct] = useState(100);
  const [multDraft, setMultDraft] = useState('100');
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [chartItems, setChartItems] = useState<PesquisaItem[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    if (scopeIndustria) setIndustria(scopeIndustria);
  }, [scopeIndustria]);

  const scopeFilters = {
    scopeIndustria,
    scopeClienteGrupo,
  };

  const loadIndustrias = useCallback(async () => {
    try {
      const list = await fetchPesquisaIndustrias(tipo, { ...scopeFilters, mes: mes || undefined });
      setIndustrias(
        scopeIndustria ? list.filter((i) => i === scopeIndustria) : list,
      );
    } catch {
      setIndustrias([]);
    }
  }, [tipo, scopeIndustria, scopeClienteGrupo, mes]);

  const loadMeses = useCallback(async () => {
    try {
      const list = await fetchPesquisaMeses(tipo, scopeFilters);
      setMeses(list);
      setMes((prev) => {
        if (list.length === 0) return '';
        if (prev && list.includes(prev)) return prev;
        return pickDefaultMes(list);
      });
    } catch {
      setMeses([]);
      setMes('');
    }
  }, [tipo, scopeIndustria, scopeClienteGrupo]);

  const load = useCallback(async () => {
    if (!mes && meses.length > 0) return;
    setLoading(true);
    try {
      const result = await fetchPesquisas({
        tipo,
        search,
        industria: scopeIndustria
          ? undefined
          : industria === 'Todas'
            ? undefined
            : industria,
        mes: mes || undefined,
        page,
        pageSize: PRICE_PAGE_SIZE,
        ...scopeFilters,
      });
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar pesquisas.', 'error');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tipo, search, industria, mes, meses.length, page, showToast, scopeIndustria, scopeClienteGrupo]);

  useEffect(() => {
    if (!scopeIndustria) setIndustria('Todas');
    setPage(1);
    void loadMeses();
  }, [tipo, loadMeses, scopeIndustria]);

  useEffect(() => {
    void loadIndustrias();
  }, [loadIndustrias]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tipo !== 'interna') {
      setViewMode('lista');
    }
  }, [tipo]);

  useEffect(() => {
    if (tipo !== 'interna' || viewMode !== 'grafico') return;
    if (!mes && meses.length > 0) return;

    let cancelled = false;
    setChartLoading(true);
    fetchAllPesquisas({
      tipo: 'interna',
      search,
      industria: scopeIndustria
        ? undefined
        : industria === 'Todas'
          ? undefined
          : industria,
      mes: mes || undefined,
      ...scopeFilters,
    })
      .then((rows) => {
        if (!cancelled) setChartItems(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          showToast(err instanceof Error ? err.message : 'Erro ao carregar gráfico.', 'error');
          setChartItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tipo, viewMode, search, industria, mes, meses.length, showToast, items, scopeIndustria, scopeClienteGrupo]);

  const totalPages = Math.max(1, Math.ceil(total / PRICE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * PRICE_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PRICE_PAGE_SIZE, total);

  const handleExport = async () => {
    if (somenteLeitura) {
      showToast('Exportação indisponível para usuário externo.', 'info');
      return;
    }
    setExporting(true);
    try {
      const all = await fetchAllPesquisas({
        tipo,
        search,
        industria: scopeIndustria
          ? undefined
          : industria === 'Todas'
            ? undefined
            : industria,
        mes: mes || undefined,
        ...scopeFilters,
      });
      exportPesquisasXlsx(all, tipo);
      showToast(
        tipo === 'interna'
          ? all.length === 0
            ? 'Planilha gerada (vazia). Coluna preco_custo pronta para preencher.'
            : `${all.length} produtos exportados. Preencha a coluna preco_custo e importe depois.`
          : all.length === 0
            ? 'Planilha gerada (vazia).'
            : `${all.length} pesquisas externas exportadas.`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao exportar.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    if (somenteLeitura) {
      showToast('Importação indisponível para usuário externo.', 'info');
      return;
    }
    setImporting(true);
    try {
      const rows = await parsePesquisasCustoXlsx(file);
      const count = await updatePesquisasCustoBatch(rows);
      showToast(
        count === 0
          ? 'Nenhum custo atualizado (ids não encontrados ou não são internas).'
          : `${count} custo(s) atualizado(s).`,
        count === 0 ? 'error' : 'success',
      );
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao importar custos.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const patchCustoLocal = (id: number, preco_custo: number | null) => {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, preco_custo } : row)));
  };

  const commitMultiplicador = () => {
    const parsed = parseMoney(multDraft.replace('%', ''));
    if (parsed == null || parsed < 0) {
      showToast('Multiplicador inválido. Use um número ≥ 0 (ex.: 100).', 'error');
      setMultDraft(String(multiplicadorPct).replace('.', ','));
      return;
    }
    setMultiplicadorPct(parsed);
    setMultDraft(String(parsed).replace('.', ','));
  };

  return (
    <div className="base-vendas-page price-page">
      <BackToPortal to="/merchandising" label="Voltar ao Merchandising" />

      <header className="base-vendas-header">
        <h1 className="page-title">Price</h1>
        <p className="base-vendas-subtitle">
          {somenteLeitura
            ? scopeIndustria
              ? `Visualização da indústria ${scopeIndustria}: internas e externas (só produtos dessa marca).`
              : scopeClienteGrupo
                ? `Visualização do grupo ${scopeClienteGrupo}: apenas lojas desse grupo.`
                : 'Visualização somente leitura.'
            : 'Internas: custo editável (planilha ou tabela), multiplicador de markup (padrão 100%) e cálculo de markup/margem. Externas: consulta e exportação.'}
        </p>
      </header>

      <section className="card base-vendas-card">
        <div className="price-tipo-tabs" role="tablist" aria-label="Tipo de pesquisa">
          <button
            type="button"
            role="tab"
            aria-selected={tipo === 'interna'}
            className={`price-tipo-tab ${tipo === 'interna' ? 'active' : ''}`}
            onClick={() => setTipo('interna')}
          >
            Internas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tipo === 'externa'}
            className={`price-tipo-tab ${tipo === 'externa' ? 'active' : ''}`}
            onClick={() => setTipo('externa')}
          >
            Externas
          </button>
        </div>

        <div className="base-vendas-card-top">
          <h2>
            Pesquisas {tipo === 'interna' ? 'internas' : 'externas'} ({total})
          </h2>
          <div className="base-vendas-actions">
            {tipo === 'interna' && (
              <div className="price-view-toggle" role="group" aria-label="Visualização">
                <button
                  type="button"
                  className={viewMode === 'lista' ? 'active' : ''}
                  onClick={() => setViewMode('lista')}
                >
                  Lista
                </button>
                <button
                  type="button"
                  className={viewMode === 'grafico' ? 'active' : ''}
                  onClick={() => setViewMode('grafico')}
                >
                  Gráfico
                </button>
              </div>
            )}
            {!somenteLeitura && (
              <button
                type="button"
                className="base-vendas-btn outline"
                disabled={exporting || importing}
                onClick={() => void handleExport()}
              >
                <span>⬇</span> {exporting ? 'Exportando...' : 'Exportar Excel'}
              </button>
            )}
            {tipo === 'interna' && !somenteLeitura && (
              <>
                <button
                  type="button"
                  className="base-vendas-btn primary"
                  disabled={exporting || importing}
                  onClick={() => fileRef.current?.click()}
                >
                  <span>⬆</span> {importing ? 'Importando...' : 'Importar custos'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleImport(file);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="base-vendas-search">
          <input
            type="search"
            placeholder="Buscar produto, indústria, loja..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="base-vendas-filters">
          <select
            value={mes}
            disabled={meses.length === 0}
            onChange={(e) => {
              setMes(e.target.value);
              setPage(1);
            }}
            aria-label="Mês da pesquisa"
          >
            {meses.length === 0 ? (
              <option value="">Sem mês</option>
            ) : (
              meses.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0) + opt.slice(1).toLowerCase()}
                </option>
              ))
            )}
          </select>
          <select
            value={scopeIndustria ?? industria}
            disabled={Boolean(scopeIndustria)}
            onChange={(e) => {
              setIndustria(e.target.value);
              setPage(1);
            }}
          >
            {!scopeIndustria && <option value="Todas">Todas as indústrias</option>}
            {(scopeIndustria ? [scopeIndustria] : industrias).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {scopeClienteGrupo && (
            <span className="price-scope-badge">Lojas: {scopeClienteGrupo}</span>
          )}
          {tipo === 'interna' && (
            <label className="price-mult-field">
              <span>Multiplicador</span>
              <span className="price-mult-input-wrap">
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label="Multiplicador do markup em percentual"
                  value={multDraft}
                  onChange={(e) => setMultDraft(e.target.value)}
                  onBlur={commitMultiplicador}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                />
                <span className="price-mult-suffix">%</span>
              </span>
            </label>
          )}
        </div>

        {tipo === 'interna' && (
          <p className="price-formula-hint">
            Markup = ((PV − PC) / PC) × 100 × (multiplicador / 100). Margem = markup / (100 + markup)
            × 100. Com 100%, o markup exibido é o calculado sem ajuste.
          </p>
        )}

        {tipo === 'interna' && viewMode === 'grafico' ? (
          <div className="price-chart-section">
            <PriceInternoChart
              items={chartItems}
              multiplicadorPct={multiplicadorPct}
              loading={chartLoading}
            />
          </div>
        ) : (
          <>
            <div className="base-vendas-table-wrap">
              {loading ? (
                <p style={{ padding: 24 }}>Carregando pesquisas...</p>
              ) : items.length === 0 ? (
                <p style={{ padding: 24 }}>
                  Nenhuma pesquisa {tipo === 'interna' ? 'interna' : 'externa'} encontrada.
                </p>
              ) : (
                <table className="base-vendas-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Indústria</th>
                      <th>Loja</th>
                      <th>UF</th>
                      <th>Mês</th>
                      <th>Varejo (PV)</th>
                      <th>Atacado</th>
                      {tipo === 'interna' && (
                        <>
                          <th>Custo (PC)</th>
                          <th>Markup %</th>
                          <th>Margem %</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const markupBase = calcMarkupPercent(row.preco_varejo, row.preco_custo);
                      const markupExibido = calcMarkupExibido(markupBase, multiplicadorPct);
                      const margem = calcMargemFromMarkup(markupExibido);

                      return (
                        <tr key={row.id}>
                          <td className="col-nome">{row.descricao}</td>
                          <td>{row.industria}</td>
                          <td>{row.loja ?? '—'}</td>
                          <td>{row.uf ?? '—'}</td>
                          <td>{row.mes ?? '—'}</td>
                          <td className="col-num">{money(row.preco_varejo)}</td>
                          <td className="col-num">{money(row.preco_atacado)}</td>
                          {tipo === 'interna' && (
                            <>
                              <td className="col-num col-custo">
                                <CostCell
                                  id={row.id}
                                  value={row.preco_custo}
                                  readOnly={somenteLeitura}
                                  onSaved={(next) => patchCustoLocal(row.id, next)}
                                />
                              </td>
                              <td className="col-num">{formatPct(markupExibido)}</td>
                              <td className="col-num">{formatPct(margem)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {total > 0 && (
              <div className="base-vendas-pagination">
                <span>
                  {rangeStart}–{rangeEnd} de {total}
                </span>
                <div className="base-vendas-pagination-actions">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span>
                    Página {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
