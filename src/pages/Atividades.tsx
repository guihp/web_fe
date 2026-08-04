import { useCallback, useEffect, useState } from 'react';
import CancelAtividadeModal from '../components/atividades/CancelAtividadeModal';
import DeleteAtividadeModal from '../components/atividades/DeleteAtividadeModal';
import EditAtividadeModal from '../components/atividades/EditAtividadeModal';
import ViewAtividadeModal from '../components/atividades/ViewAtividadeModal';
import BackToPortal from '../components/layout/BackToPortal';
import { useAtividadeModal } from '../context/AtividadeModalContext';
import { useToast } from '../context/ToastContext';
import {
  fetchAtividadeStats,
  fetchAtividades,
  fetchPromotores,
  type AtividadeRow,
} from '../services/atividadesService';
import {
  canCancelAtividade,
  canEditAtividade,
  formatPeriodo,
  statusColor,
  statusLabel,
} from '../utils/atividadesDomain';
import type { Usuario } from '../utils/format';
import './Atividades.css';
import './BaseDadosVendas.css';

const TIPOS = ['Todos', 'Antes e Depois', 'Degustação'];
const STATUS_OPTIONS = ['Todos', 'Em andamento', 'Completo', 'Justificada', 'Cancelado'];

type Tab = 'acompanhamento' | 'historico';

export default function Atividades() {
  const { openAddAtividade, registerOnCreated } = useAtividadeModal();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>('acompanhamento');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Todos');
  const [tipo, setTipo] = useState('Todos');
  const [promotorId, setPromotorId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const [rows, setRows] = useState<AtividadeRow[]>([]);
  const [promotores, setPromotores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewRow, setViewRow] = useState<AtividadeRow | null>(null);
  const [editRow, setEditRow] = useState<AtividadeRow | null>(null);
  const [cancelRow, setCancelRow] = useState<AtividadeRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<AtividadeRow | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        tab,
        search: search || undefined,
        status: status !== 'Todos' ? (status === 'Em andamento' ? 'Pendente' : status) : undefined,
        tipo: tipo !== 'Todos' ? tipo : undefined,
        promotorId: promotorId ? Number(promotorId) : undefined,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
      };
      const data = await fetchAtividades(filters);
      setRows(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar atividades.', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, search, status, tipo, promotorId, dataInicio, dataFim, showToast]);

  useEffect(() => {
    fetchPromotores()
      .then(setPromotores)
      .catch(() => setPromotores([]));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unregister = registerOnCreated(() => {
      loadData();
    });
    return unregister;
  }, [registerOnCreated, loadData]);

  useEffect(() => {
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadData]);

  const stats = fetchAtividadeStats(rows);

  const handleSuccess = (message: string) => {
    showToast(message, 'success');
    loadData();
  };

  return (
    <div className="atividades-page">
      <BackToPortal />
      <header className="atividades-header">
        <div className="atividades-header-text">
          <h1 className="page-title">Atividades</h1>
          <p className="atividades-subtitle">
            Acompanhe o progresso e gerencie as atividades enviadas aos promotores
          </p>
        </div>
        <div className="base-vendas-actions">
          <button type="button" className="base-vendas-btn outline" onClick={loadData}>
            Atualizar
          </button>
          <button type="button" className="base-vendas-btn primary" onClick={openAddAtividade}>
            + Nova atividade
          </button>
        </div>
      </header>

      <div className="atividades-kpi-grid">
        <article className="atividades-kpi card">
          <p className="atividades-kpi-label">Total enviadas</p>
          <p className="atividades-kpi-value">{stats.total}</p>
        </article>
        <article className="atividades-kpi card pendente">
          <p className="atividades-kpi-label">Em andamento</p>
          <p className="atividades-kpi-value">{stats.pendentes}</p>
        </article>
        <article className="atividades-kpi card concluida">
          <p className="atividades-kpi-label">Concluídas</p>
          <p className="atividades-kpi-value">{stats.concluidas}</p>
        </article>
        <article className="atividades-kpi card justificada">
          <p className="atividades-kpi-label">Justificadas</p>
          <p className="atividades-kpi-value">{stats.justificadas}</p>
        </article>
        <article className="atividades-kpi card sync">
          <p className="atividades-kpi-label">Fotos não sincronizadas</p>
          <p className="atividades-kpi-value">{stats.naoSincronizadas}</p>
        </article>
      </div>

      <div className="atividades-tabs">
        <button
          type="button"
          className={`atividades-tab ${tab === 'acompanhamento' ? 'active' : ''}`}
          onClick={() => setTab('acompanhamento')}
        >
          Acompanhamento
        </button>
        <button
          type="button"
          className={`atividades-tab ${tab === 'historico' ? 'active' : ''}`}
          onClick={() => setTab('historico')}
        >
          Histórico
        </button>
      </div>

      <section className="card base-vendas-card">
        <div className="base-vendas-card-top">
          <h2>
            {tab === 'acompanhamento' ? 'Atividades em aberto' : 'Histórico de atividades'} ({rows.length})
          </h2>
        </div>

        <div className="base-vendas-search">
          <input
            type="search"
            placeholder="Buscar por loja, indústria, promotor ou tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="base-vendas-filters">
          <span className="filter-icon" aria-hidden>
            ⚙
          </span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                Status: {s}
              </option>
            ))}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                Tipo: {t}
              </option>
            ))}
          </select>
          <select value={promotorId} onChange={(e) => setPromotorId(e.target.value)}>
            <option value="">Promotor: Todos</option>
            {promotores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          <div className="atividades-period-filter">
            <span className="atividades-period-icon" aria-hidden>
              📅
            </span>
            <label className="atividades-date-field">
              <span>De</span>
              <input
                type="date"
                className="atividades-date-input"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                title="Período início"
              />
            </label>
            <span className="atividades-period-sep">até</span>
            <label className="atividades-date-field">
              <span>Até</span>
              <input
                type="date"
                className="atividades-date-input"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                title="Período fim"
                min={dataInicio || undefined}
              />
            </label>
            {(dataInicio || dataFim) && (
              <button
                type="button"
                className="atividades-period-clear"
                onClick={() => {
                  setDataInicio('');
                  setDataFim('');
                }}
                title="Limpar período"
                aria-label="Limpar período"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="base-vendas-table-wrap">
          {loading ? (
            <p className="atividades-loading-row">Carregando atividades...</p>
          ) : rows.length === 0 ? (
            <p className="atividades-empty">
              Nenhuma atividade encontrada com os filtros selecionados.
            </p>
          ) : (
            <table className="base-vendas-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Promotor</th>
                  <th>Loja</th>
                  <th>Indústria</th>
                  <th>Período</th>
                  <th>Status</th>
                  <th>Sync</th>
                  <th>Criado por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const color = statusColor(row.status);
                  return (
                    <tr key={row.id}>
                      <td>{row.tipo}</td>
                      <td>{row.responsavelNome}</td>
                      <td>{row.loja}</td>
                      <td>{row.industria}</td>
                      <td>{formatPeriodo(row.data_inicio, row.data_fim)}</td>
                      <td>
                        <span
                          className="atividades-status-badge"
                          style={{ background: `${color}22`, color }}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td>
                        {row.sincronizado ? (
                          <span className="atividades-sync-ok">OK</span>
                        ) : (
                          <span className="atividades-sync-warn">Pendente</span>
                        )}
                      </td>
                      <td>{row.criadorNome}</td>
                      <td>
                        <div className="atividades-actions-cell">
                          <button
                            type="button"
                            className="atividades-action-btn"
                            onClick={() => setViewRow(row)}
                          >
                            Ver
                          </button>
                          {canEditAtividade(row.status) && (
                            <button
                              type="button"
                              className="atividades-action-btn"
                              onClick={() => setEditRow(row)}
                            >
                              Editar
                            </button>
                          )}
                          {canCancelAtividade(row.status) && (
                            <button
                              type="button"
                              className="atividades-action-btn"
                              onClick={() => setCancelRow(row)}
                            >
                              Cancelar
                            </button>
                          )}
                          <button
                            type="button"
                            className="atividades-action-btn danger"
                            onClick={() => setDeleteRow(row)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {viewRow && (
        <ViewAtividadeModal
          atividade={viewRow}
          onClose={() => setViewRow(null)}
          canEdit={canEditAtividade(viewRow.status)}
          canCancel={canCancelAtividade(viewRow.status)}
          onEdit={() => {
            setEditRow(viewRow);
            setViewRow(null);
          }}
          onCancel={() => {
            setCancelRow(viewRow);
            setViewRow(null);
          }}
          onDelete={() => {
            setDeleteRow(viewRow);
            setViewRow(null);
          }}
        />
      )}

      {editRow && (
        <EditAtividadeModal
          atividade={editRow}
          onClose={() => setEditRow(null)}
          onSuccess={() => handleSuccess('Atividade atualizada com sucesso!')}
        />
      )}

      {cancelRow && (
        <CancelAtividadeModal
          atividade={cancelRow}
          onClose={() => setCancelRow(null)}
          onSuccess={() => handleSuccess('Atividade cancelada.')}
        />
      )}

      {deleteRow && (
        <DeleteAtividadeModal
          atividade={deleteRow}
          onClose={() => setDeleteRow(null)}
          onSuccess={() => handleSuccess('Atividade excluída.')}
        />
      )}
    </div>
  );
}
