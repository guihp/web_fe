import { useCallback, useEffect, useState } from 'react';
import BackToPortal from '../components/layout/BackToPortal';
import { useToast } from '../context/ToastContext';
import {
  VALIDADE_PAGE_SIZE,
  daysUntilVencimento,
  fetchAllValidades,
  fetchValidades,
  fetchValidadesFilterOptions,
  isExpiringSoon,
  type Validade,
  type ValidadeMesOption,
  type ValidadeStatusFilter,
} from '../services/validadeService';
import { exportValidadesXlsx } from '../utils/xlsxIO';
import './BaseDadosVendas.css';
import './Validades.css';

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

export default function Validades() {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [uf, setUf] = useState('Todos');
  const [industria, setIndustria] = useState('Todos');
  const [mes, setMes] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState<ValidadeStatusFilter>('all');
  const [ufs, setUfs] = useState<string[]>([]);
  const [industrias, setIndustrias] = useState<string[]>([]);
  const [meses, setMeses] = useState<ValidadeMesOption[]>([]);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Validade[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadFilterOptions = useCallback(async () => {
    try {
      const opts = await fetchValidadesFilterOptions();
      setUfs(opts.ufs);
      setIndustrias(opts.industrias);
      setMeses(opts.meses);
    } catch {
      /* filtros opcionais */
    }
  }, []);

  const loadValidades = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchValidades({
        search,
        uf: uf === 'Todos' ? undefined : uf,
        industria: industria === 'Todos' ? undefined : industria,
        mes: mes === 'Todos' ? undefined : mes,
        status: statusFilter,
        page,
        pageSize: VALIDADE_PAGE_SIZE,
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
  }, [search, uf, industria, mes, statusFilter, page, showToast]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadValidades();
  }, [loadValidades]);

  const toggleStatusFilter = (next: ValidadeStatusFilter) => {
    setStatusFilter((prev) => (prev === next ? 'all' : next));
    setPage(1);
  };
  const totalPages = Math.max(1, Math.ceil(total / VALIDADE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * VALIDADE_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * VALIDADE_PAGE_SIZE, total);

  const handleExport = async () => {
    try {
      const all = await fetchAllValidades();
      exportValidadesXlsx(all);
      showToast(
        all.length === 0
          ? 'Planilha exportada (somente cabeçalhos — não há validades).'
          : `${all.length} validades exportadas.`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na exportação.', 'error');
    }
  };

  return (
    <div className="base-vendas-page validades-page">
      <BackToPortal to="/merchandising" label="Voltar ao Merchandising" />

      <header className="base-vendas-header">
        <h1 className="page-title">Validades</h1>
        <p className="base-vendas-subtitle">
          Produtos próximos do vencimento — itens com menos de 1 mês ficam destacados
        </p>
      </header>

      <section className="card base-vendas-card">
        <div className="base-vendas-card-top">
          <h2>Validades ({total} total)</h2>
          <div className="base-vendas-actions">
            <button type="button" className="base-vendas-btn outline" onClick={handleExport}>
              <span>⬇</span> Exportar Dados
            </button>
          </div>
        </div>

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
            <option value="Todos">Mês</option>
            {meses.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

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
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: 24 }}>
                      Nenhuma validade encontrada.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const soon = isExpiringSoon(item.data_vencimento);
                    return (
                      <tr key={item.id} className={rowClassName(item)}>
                        <td className={soon ? 'col-emphasis' : undefined}>{item.codigo ?? '—'}</td>
                        <td className={soon ? 'col-emphasis col-produto' : 'col-produto'}>
                          {item.descricao ?? '—'}
                        </td>
                        <td className={soon ? 'col-vencimento' : undefined}>
                          {formatData(item.data_vencimento)}
                        </td>
                        <td className={soon ? 'col-emphasis' : undefined}>{item.lojas ?? '—'}</td>
                        <td>{item.uf ?? '—'}</td>
                        <td>{item.industria ?? '—'}</td>
                        <td>{item.promotor ?? '—'}</td>
                        <td>{formatPreco(item.preco)}</td>
                        <td>{item.qtde_unit ?? '—'}</td>
                        <td>{item.lote ?? '—'}</td>
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
      </section>
    </div>
  );
}
