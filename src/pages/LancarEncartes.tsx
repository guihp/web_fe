import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import BackToPortal from '../components/layout/BackToPortal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { userHasSectionAccess } from '../data/portalModules';
import {
  ENCARTE_PAGE_SIZE,
  fetchEncartes,
  formatEncarteDateBr,
  insertEncartesBatch,
  lojaLabelForEncarte,
  type EncarteAviso,
  fetchAllEncartes,
} from '../services/encarteService';
import {
  downloadEncarteTemplate,
  exportEncartesXlsx,
  parseEncartesXlsx,
} from '../utils/xlsxIO';
import './BaseDadosVendas.css';
import './LancarEncartes.css';

function formatPreco(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function LancarEncartes() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<EncarteAviso[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const allowed = userHasSectionAccess(
    user?.cargo ?? '',
    user?.secoes_acesso,
    'merchandising.encartes',
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchEncartes(page, ENCARTE_PAGE_SIZE);
      setItems(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar encartes.', 'error');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  if (!allowed) {
    return <Navigate to="/merchandising" replace />;
  }

  const totalPages = Math.max(1, Math.ceil(total / ENCARTE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * ENCARTE_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * ENCARTE_PAGE_SIZE, total);

  const handleExport = async () => {
    try {
      const all = await fetchAllEncartes();
      exportEncartesXlsx(all);
      showToast(
        all.length === 0
          ? 'Planilha exportada (somente cabeçalhos).'
          : `${all.length} encartes exportados.`,
        'success',
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na exportação.', 'error');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const rows = await parseEncartesXlsx(file);
      const count = await insertEncartesBatch(rows);
      showToast(`${count} promoção(ões) lançada(s).`, 'success');
      setPage(1);
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na importação.', 'error');
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadEncarteTemplate();
      showToast('Modelo baixado. Preencha e use Importar Excel.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao baixar modelo.', 'error');
    }
  };

  return (
    <div className="base-vendas-page lancar-encartes-page">
      <BackToPortal />

      <header className="base-vendas-header">
        <h1 className="page-title">Lançar promoções/encarte</h1>
        <p className="base-vendas-subtitle">
          Importe o modelo Excel para cadastrar encartes. No dia de início, o aviso aparece no
          Merchandising e no sininho.
        </p>
      </header>

      <section className="card base-vendas-card">
        <div className="base-vendas-card-top">
          <h2>Encartes lançados ({total})</h2>
          <div className="base-vendas-actions">
            <button type="button" className="base-vendas-btn outline" onClick={handleExport}>
              <span>⬇</span> Exportar Dados
            </button>
            <button type="button" className="base-vendas-btn outline" onClick={handleDownloadTemplate}>
              <span>⬇</span> Baixar Modelo
            </button>
            <button
              type="button"
              className="base-vendas-btn primary"
              onClick={() => fileRef.current?.click()}
            >
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

        <div className="base-vendas-table-wrap">
          {loading ? (
            <p style={{ padding: 24 }}>Carregando encartes...</p>
          ) : (
            <table className="base-vendas-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Indústria</th>
                  <th>Preço</th>
                  <th>Tipo</th>
                  <th>Loja / escopo</th>
                  <th>Início</th>
                  <th>Fim</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 24 }}>
                      Nenhum encarte lançado. Baixe o modelo e importe.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="col-cliente">{item.produto ?? '—'}</td>
                      <td>{item.marca ?? '—'}</td>
                      <td className="col-valor">{formatPreco(item.preco)}</td>
                      <td>{item.tipo}</td>
                      <td>{lojaLabelForEncarte(item)}</td>
                      <td>{formatEncarteDateBr(item.dataPromocao)}</td>
                      <td>{formatEncarteDateBr(item.dataFim)}</td>
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
    </div>
  );
}
