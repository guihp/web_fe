import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CreateClienteModal from '../../components/clientes/CreateClienteModal';
import DeleteClienteModal from '../../components/clientes/DeleteClienteModal';
import EditClienteModal from '../../components/clientes/EditClienteModal';
import InativarClienteModal from '../../components/clientes/InativarClienteModal';
import { useToast } from '../../context/ToastContext';
import {
  CLIENTE_PAGE_SIZE,
  fetchAllClientes,
  fetchClientes,
  setClienteStatus,
  upsertClientesBatch,
} from '../../services/clienteService';
import type { BaseCliente } from '../../utils/vendasDomain';
import {
  downloadClienteTemplate,
  exportClientesXlsx,
  parseClientesXlsx,
} from '../../utils/xlsxIO';
import '../Administrador.css';
import '../BaseDadosVendas.css';
import './AdminFiliais.css';

const FILTRO_ESTADOS = ['Todos', 'MARANHÃO', 'MARANHAO', 'PIAUÍ', 'PIAUI', 'PARÁ', 'PARA'];
const FILTRO_STATUS = ['Todos', 'Ativo', 'Inativo'];

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

function IconPause() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 5v14l11-7Z" />
    </svg>
  );
}

export default function AdminClientes() {
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [page, setPage] = useState(1);
  const [clientes, setClientes] = useState<BaseCliente[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editCliente, setEditCliente] = useState<BaseCliente | null>(null);
  const [deleteCliente, setDeleteCliente] = useState<BaseCliente | null>(null);
  const [toggling, setToggling] = useState<BaseCliente | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const loadClientes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchClientes({
        search,
        estado: estado === 'Todos' ? undefined : estado,
        status: statusFilter === 'Todos' ? undefined : statusFilter,
        page,
        pageSize: CLIENTE_PAGE_SIZE,
      });
      setClientes(result.data);
      setTotal(result.total);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar clientes.', 'error');
      setClientes([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, estado, statusFilter, page, showToast]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  const totalPages = Math.max(1, Math.ceil(total / CLIENTE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * CLIENTE_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * CLIENTE_PAGE_SIZE, total);

  const handleExport = async () => {
    try {
      const all = await fetchAllClientes();
      exportClientesXlsx(all);
      showToast('Exportação concluída.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na exportação.', 'error');
    }
  };

  const handleImport = async (file: File) => {
    try {
      const rows = await parseClientesXlsx(file);
      const count = await upsertClientesBatch(rows);
      showToast(`${count} clientes importados.`, 'success');
      loadClientes();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro na importação.', 'error');
    }
  };

  const handleToggleStatus = async () => {
    if (!toggling) return;
    const next = (toggling.status || 'Ativo') === 'Ativo' ? 'Inativo' : 'Ativo';
    setSavingStatus(true);
    try {
      await setClienteStatus(toggling.id, next);
      showToast(next === 'Inativo' ? 'Cliente inativado.' : 'Cliente ativado.', 'success');
      setToggling(null);
      loadClientes();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível alterar o status.',
        'error',
      );
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="base-vendas-page">
      <Link to="/administrador" className="admin-section-back">
        <span aria-hidden>←</span>
        Voltar ao Administrador
      </Link>

      <header className="base-vendas-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="base-vendas-subtitle">Cadastre e gerencie os clientes para pedidos</p>
        </div>
      </header>

      <section className="card base-vendas-card">
        <div className="base-vendas-card-top">
          <h2>Clientes Cadastrados ({total} total)</h2>
          <div className="base-vendas-actions">
            <button type="button" className="base-vendas-btn outline" onClick={handleExport}>
              <span>⬇</span> Exportar Dados
            </button>
            <button type="button" className="base-vendas-btn outline" onClick={downloadClienteTemplate}>
              <span>⬇</span> Baixar Modelo
            </button>
            <button
              type="button"
              className="base-vendas-btn outline"
              onClick={() => fileRef.current?.click()}
            >
              <span>⬆</span> Importar Excel
            </button>
            <button type="button" className="base-vendas-btn primary" onClick={() => setShowCreate(true)}>
              + Novo Cliente
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
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
            placeholder="Pesquisar clientes..."
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
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setPage(1);
            }}
          >
            {FILTRO_ESTADOS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'Todos' ? 'Estado' : opt}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {FILTRO_STATUS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'Todos' ? 'Status' : opt}
              </option>
            ))}
          </select>
        </div>

        <div className="base-vendas-table-wrap">
          {loading ? (
            <p style={{ padding: 24 }}>Carregando clientes...</p>
          ) : (
            <table className="base-vendas-table">
              <thead>
                <tr>
                  <th>CDC</th>
                  <th>CNPJ</th>
                  <th>Nome Fantasia</th>
                  <th>Razão Social</th>
                  <th>Cidade</th>
                  <th>Estado</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                ) : (
                  clientes.map((item) => {
                    const status = item.status || 'Ativo';
                    const isAtivo = status === 'Ativo';
                    return (
                      <tr key={item.id}>
                        <td>{item.cdc}</td>
                        <td>{item.cnpj}</td>
                        <td className="col-cliente">{item.nome_fantasia}</td>
                        <td>{item.razao_social}</td>
                        <td>{item.cidade}</td>
                        <td>{item.estado}</td>
                        <td>
                          <span className={`filiais-status ${isAtivo ? '' : 'inativo'}`}>
                            {status}
                          </span>
                        </td>
                        <td className="col-actions">
                          <div className="action-group">
                            <button
                              type="button"
                              className="action-btn"
                              aria-label="Editar"
                              title="Editar"
                              onClick={() => setEditCliente(item)}
                            >
                              <IconEdit />
                            </button>
                            <button
                              type="button"
                              className={`action-btn ${isAtivo ? 'danger' : ''}`}
                              aria-label={isAtivo ? 'Inativar' : 'Ativar'}
                              title={isAtivo ? 'Inativar' : 'Ativar'}
                              onClick={() => setToggling(item)}
                            >
                              {isAtivo ? <IconPause /> : <IconPlay />}
                            </button>
                            <button
                              type="button"
                              className="action-btn danger"
                              aria-label="Excluir"
                              title="Excluir"
                              onClick={() => setDeleteCliente(item)}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </td>
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

      {showCreate && (
        <CreateClienteModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            showToast('Cliente cadastrado com sucesso.', 'success');
            loadClientes();
          }}
        />
      )}

      {editCliente && (
        <EditClienteModal
          cliente={editCliente}
          onClose={() => setEditCliente(null)}
          onSuccess={() => {
            showToast('Cliente atualizado.', 'success');
            loadClientes();
          }}
        />
      )}

      {toggling && (
        <InativarClienteModal
          cliente={toggling}
          saving={savingStatus}
          onClose={() => setToggling(null)}
          onConfirm={handleToggleStatus}
        />
      )}

      {deleteCliente && (
        <DeleteClienteModal
          cliente={deleteCliente}
          onClose={() => setDeleteCliente(null)}
          onSuccess={() => {
            showToast('Cliente excluído.', 'success');
            loadClientes();
          }}
        />
      )}
    </div>
  );
}
