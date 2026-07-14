import { useCallback, useEffect, useMemo, useState } from 'react';
import AddColaboradorModal from '../components/colaboradores/AddColaboradorModal';
import DeleteColaboradorModal from '../components/colaboradores/DeleteColaboradorModal';
import EditColaboradorModal from '../components/colaboradores/EditColaboradorModal';
import ViewColaboradorModal from '../components/colaboradores/ViewColaboradorModal';
import { fetchUsers, updateUserStatus } from '../services/userFetchService';
import type { Usuario } from '../utils/format';
import { formatCpf, formatLocal, formatPhone } from '../utils/format';
import './Colaboradores.css';

function IconView() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

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

export default function Colaboradores() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [collaborators, setCollaborators] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewUser, setViewUser] = useState<Usuario | null>(null);
  const [editUser, setEditUser] = useState<Usuario | null>(null);
  const [deleteUser, setDeleteUser] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadCollaborators = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchUsers();
      setCollaborators(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar colaboradores.';
      setError(message);
      setCollaborators([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return collaborators;

    return collaborators.filter((item) => {
      const local = formatLocal(item.cidade, item.estado_id).toLowerCase();
      const cpf = formatCpf(item.cpf);
      return (
        item.nome.toLowerCase().includes(term) ||
        (item.cargo ?? '').toLowerCase().includes(term) ||
        local.includes(term) ||
        cpf.includes(term) ||
        (item.telefone ?? '').includes(term) ||
        (item.email ?? '').toLowerCase().includes(term)
      );
    });
  }, [collaborators, search]);

  const allSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((item) => item.id)));
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;

    setDeleting(true);

    try {
      await updateUserStatus(deleteUser.id, false);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteUser.id);
        return next;
      });
      setDeleteUser(null);
      await loadCollaborators();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível excluir o colaborador.';
      window.alert(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="colaboradores-page">
      <div className="colaboradores-header">
        <h1 className="page-title">Lista de colaboradores</h1>
        <button type="button" className="btn-primary" onClick={() => setShowAddModal(true)}>
          <span>+</span> Adicionar Colaborador
        </button>
      </div>

      <div className="colaboradores-search">
        <span className="search-icon" aria-hidden>
          🔍
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar colaborador..."
        />
      </div>

      {error && (
        <div className="colaboradores-alert error">
          {error}
          <button type="button" onClick={loadCollaborators}>
            Tentar novamente
          </button>
        </div>
      )}

      <div className="colaboradores-table-wrap card">
        <table className="colaboradores-table">
          <thead>
            <tr>
              <th className="col-check">
                <button type="button" className="check-btn" onClick={toggleAll} aria-label="Selecionar todos">
                  {allSelected ? '☑' : '▢'}
                </button>
              </th>
              <th className="col-num">
                # <span className="sort-arrows">↕</span>
              </th>
              <th>NOME</th>
              <th>CARGO</th>
              <th>LOCAL</th>
              <th>CPF OU RG</th>
              <th className="col-actions">AÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="table-message">
                  Carregando colaboradores...
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="table-message">
                  Nenhum colaborador encontrado.
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((item, index) => {
                const isSelected = selected.has(item.id);
                return (
                  <tr key={item.id} className={isSelected ? 'selected' : ''}>
                    <td className="col-check">
                      <button
                        type="button"
                        className="check-btn"
                        onClick={() => toggleOne(item.id)}
                        aria-label={`Selecionar ${item.nome}`}
                      >
                        {isSelected ? '☑' : '▢'}
                      </button>
                    </td>
                    <td className="col-num">{index + 1}</td>
                    <td>
                      <div className="user-cell">
                        <span className="user-name">{item.nome}</span>
                        <span className="user-phone">{formatPhone(item.telefone)}</span>
                      </div>
                    </td>
                    <td>{item.cargo}</td>
                    <td>{formatLocal(item.cidade, item.estado_id)}</td>
                    <td>{formatCpf(item.cpf)}</td>
                    <td className="col-actions">
                      <div className="action-group">
                        <button
                          type="button"
                          className="action-btn"
                          aria-label="Visualizar"
                          onClick={() => setViewUser(item)}
                        >
                          <IconView />
                        </button>
                        <button
                          type="button"
                          className="action-btn"
                          aria-label="Editar"
                          onClick={() => setEditUser(item)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="action-btn danger"
                          aria-label="Excluir"
                          onClick={() => setDeleteUser(item)}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {viewUser && <ViewColaboradorModal user={viewUser} onClose={() => setViewUser(null)} />}

      {editUser && (
        <EditColaboradorModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={loadCollaborators}
        />
      )}

      {deleteUser && (
        <DeleteColaboradorModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={confirmDelete}
          deleting={deleting}
        />
      )}

      {showAddModal && (
        <AddColaboradorModal
          onClose={() => setShowAddModal(false)}
          onSuccess={loadCollaborators}
        />
      )}
    </div>
  );
}
