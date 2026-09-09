import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import {
  deleteVenda,
  fetchAllVendas,
  fetchVendas,
  fetchVendasFilterOptions,
  upsertVendasBatch,
  VENDA_PAGE_SIZE,
} from '../services/vendaService';
import type { BaseVenda } from '../utils/vendasDomain';
import { formatBRL } from '../utils/currency';
import {
  downloadVendaTemplate,
  exportVendasXlsx,
  parseVendasXlsx,
} from '../utils/xlsxIO';
import ModalShell from '../components/colaboradores/ModalShell';
import EditVendaModal from '../components/vendas/EditVendaModal';
import './BaseDadosVendas.css';

function IconEdit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function BaseDadosVendas() {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [industria, setIndustria] = useState('Todas');
  const [mes, setMes] = useState('Todos');
  const [ano, setAno] = useState('Todos');
  const [estado, setEstado] = useState('Todos');
  const [vendedor, setVendedor] = useState('Todos');
  const [page, setPage] = useState(1);
  const [vendas, setVendas] = useState<BaseVenda[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<BaseVenda | null>(null);
  const [editItem, setEditItem] = useState<BaseVenda | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    industrias: ['Todas'],
    meses: ['Todos'],
    anos: ['Todos'],
    estados: ['Todos'],
    vendedores: ['Todos'],
  });

  useEffect(() => {
    fetchVendasFilterOptions()
      .then(setFilterOptions)
      .catch(() => undefined);
  }, []);

  const loadVendas = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchVendas({
        search,
        industria,
        mes,
        ano,
        estado,
        vendedor,
        page,
        pageSize: VENDA_PAGE_SIZE,
      });
      setVendas(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar vendas.', 'error');
      setVendas([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, industria, mes, ano, estado, vendedor, page, showToast]);

  useEffect(() => {
    loadVendas();
  }, [loadVendas]);

  const totalPages = Math.max(1, Math.ceil(total / VENDA_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * VENDA_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * VENDA_PAGE_SIZE, total);

  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      await deleteVenda(deleteItem.id);
      showToast(`Venda ${deleteItem.numero_pedido} excluída.`, 'success');
      setDeleteItem(null);
      loadVendas();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    try {
      const all = await fetchAllVendas();
      exportVendasXlsx(all);
      showToast(
        all.length === 0
          ? 'Planilha exportada (somente cabeçalhos, não há vendas).'
          : `${all.length} vendas exportadas.`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na exportação.', 'error');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const rows = await parseVendasXlsx(file);
      const count = await upsertVendasBatch(rows);
      showToast(`${count} vendas importadas.`, 'success');
      loadVendas();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na importação.', 'error');
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadVendaTemplate();
      showToast('Modelo baixado. Preencha e use Importar Excel.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao baixar modelo.', 'error');
    }
  };

  return (
    <div className="base-vendas-page">
      <header className="base-vendas-header">
        <h1 className="page-title">Base de Dados de Vendas</h1>
        <p className="base-vendas-subtitle">Visualize e pesquise todas as vendas registradas</p>
      </header>

      <section className="card base-vendas-card">
        <div className="base-vendas-card-top">
          <h2>Vendas Registradas ({total} total)</h2>
          <div className="base-vendas-actions">
            <button type="button" className="base-vendas-btn outline" onClick={handleExport}>
              <span>⬇</span> Exportar Dados
            </button>
            <button type="button" className="base-vendas-btn outline" onClick={handleDownloadTemplate}>
              <span>⬇</span> Baixar Modelo
            </button>
            <button type="button" className="base-vendas-btn primary" onClick={() => fileRef.current?.click()}>
              <span>⬆</span> Importar Excel
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="base-vendas-search">
          <input
            type="search"
            placeholder="Pesquisar vendas..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="base-vendas-filters">
          <span className="filter-icon" aria-hidden>
            ⚙
          </span>
          <select value={industria} onChange={(e) => handleFilterChange(setIndustria)(e.target.value)}>
            {filterOptions.industrias.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'Todas' ? 'Indústria' : opt}
              </option>
            ))}
          </select>
          <select value={mes} onChange={(e) => handleFilterChange(setMes)(e.target.value)}>
            {filterOptions.meses.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'Todos' ? 'Mês' : opt}
              </option>
            ))}
          </select>
          <select value={ano} onChange={(e) => handleFilterChange(setAno)(e.target.value)}>
            {filterOptions.anos.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'Todos' ? 'Ano' : opt}
              </option>
            ))}
          </select>
          <select value={estado} onChange={(e) => handleFilterChange(setEstado)(e.target.value)}>
            {filterOptions.estados.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'Todos' ? 'Estado' : opt}
              </option>
            ))}
          </select>
          <select value={vendedor} onChange={(e) => handleFilterChange(setVendedor)(e.target.value)}>
            {filterOptions.vendedores.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'Todos' ? 'Vendedor' : opt}
              </option>
            ))}
          </select>
        </div>

        <div className="base-vendas-table-wrap">
          {loading ? (
            <p style={{ padding: 24 }}>Carregando vendas...</p>
          ) : (
            <table className="base-vendas-table">
              <thead>
                <tr>
                  <th>CDC</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Indústria</th>
                  <th>Categoria</th>
                  <th>Vendedor</th>
                  <th>Estado</th>
                  <th>Mês</th>
                  <th>Ano</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {vendas.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: 24 }}>
                      Nenhuma venda encontrada.
                    </td>
                  </tr>
                ) : (
                  vendas.map((item) => (
                    <tr key={item.id}>
                      <td>{item.cdc}</td>
                      <td>{item.numero_pedido}</td>
                      <td className="col-cliente">{item.cliente}</td>
                      <td>{item.industria}</td>
                      <td>{item.categoria}</td>
                      <td>{item.vendedor}</td>
                      <td>{item.estado}</td>
                      <td>{item.mes}</td>
                      <td>{item.ano}</td>
                      <td className="col-valor">{formatBRL(item.valor)}</td>
                      <td className="col-actions">
                        <div className="action-group">
                          <button
                            type="button"
                            className="action-btn"
                            aria-label="Editar"
                            onClick={() => setEditItem(item)}
                          >
                            <IconEdit />
                          </button>
                          <button
                            type="button"
                            className="action-btn danger"
                            aria-label="Excluir"
                            onClick={() => setDeleteItem(item)}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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

      {editItem && (
        <EditVendaModal
          venda={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => {
            showToast('Venda atualizada.', 'success');
            loadVendas();
          }}
        />
      )}

      {deleteItem && (
        <ModalShell onClose={() => setDeleteItem(null)}>
          <div className="colab-modal-header">
            <h2>Excluir Venda</h2>
            <p>
              Excluir pedido <strong>{deleteItem.numero_pedido}</strong>?
            </p>
          </div>
          <div className="colab-actions">
            <button type="button" className="colab-btn danger" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
            <button type="button" className="colab-btn outline" onClick={() => setDeleteItem(null)}>
              Cancelar
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
