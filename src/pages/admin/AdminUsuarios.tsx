import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AppIcon from '../../components/icons/AppIcon';
import UsuarioFormModal from '../../components/admin/UsuarioFormModal';
import DeleteColaboradorModal from '../../components/colaboradores/DeleteColaboradorModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  PORTAL_MODULES,
  canManageUsers,
  parseModulosFromNivelAcesso,
} from '../../data/portalModules';
import { fetchUsers, updateUserStatus } from '../../services/userFetchService';
import type { Usuario } from '../../utils/format';
import { formatCpf, formatLocal, formatPhone } from '../../utils/format';
import '../Colaboradores.css';
import '../Administrador.css';
import './AdminUsuarios.css';

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function modulosLabels(user: Usuario) {
  const ids = parseModulosFromNivelAcesso(user.nivel_acesso, user.cargo);
  return ids
    .map((id) => PORTAL_MODULES.find((m) => m.id === id)?.title ?? id)
    .join(', ');
}

export default function AdminUsuarios() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [toDelete, setToDelete] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);
  const allowed = canManageUsers(user?.cargo);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar usuários.';
      setError(message);
      showToast(message, 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed, load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) => {
      const local = formatLocal(item.cidade, item.estado_id).toLowerCase();
      return (
        item.nome.toLowerCase().includes(term) ||
        (item.cargo ?? '').toLowerCase().includes(term) ||
        local.includes(term) ||
        formatCpf(item.cpf).includes(term) ||
        (item.telefone ?? '').includes(term) ||
        (item.email ?? '').toLowerCase().includes(term) ||
        modulosLabels(item).toLowerCase().includes(term)
      );
    });
  }, [users, search]);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  const confirmDelete = async () => {
    if (!toDelete) return;
    if (toDelete.id === user?.id) {
      showToast('Você não pode inativar a própria conta.', 'error');
      setToDelete(null);
      return;
    }

    setDeleting(true);
    try {
      await updateUserStatus(toDelete.id, false);
      showToast('Usuário inativado.', 'success');
      setToDelete(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir usuário.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-section-page admin-usuarios-page">
      <Link to="/administrador" className="admin-section-back">
        <span aria-hidden>←</span>
        Voltar ao Administrador
      </Link>

      <header className="colaboradores-header">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="admin-subtitle">
            Crie, edite e defina quais balões cada usuário pode acessar.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          <span>+</span> Novo Usuário
        </button>
      </header>

      <div className="colaboradores-search">
        <span className="search-icon" aria-hidden>
          <AppIcon name="search" size={16} />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, cargo, CPF ou módulo..."
        />
      </div>

      {error && (
        <div className="colaboradores-alert error">
          {error}
          <button type="button" onClick={load}>
            Tentar novamente
          </button>
        </div>
      )}

      <section className="card colaboradores-table-wrap">
        {loading ? (
          <p className="admin-usuarios-empty">Carregando usuários...</p>
        ) : filtered.length === 0 ? (
          <p className="admin-usuarios-empty">Nenhum usuário encontrado.</p>
        ) : (
          <table className="colaboradores-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Cargo</th>
                <th>Telefone</th>
                <th>Local</th>
                <th>Balões</th>
                <th className="admin-usuarios-th-actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="admin-usuarios-name">
                      <strong>{item.nome}</strong>
                      {item.email && <small>{item.email}</small>}
                    </div>
                  </td>
                  <td>{formatCpf(item.cpf)}</td>
                  <td>
                    <span className="admin-usuarios-cargo">{item.cargo}</span>
                  </td>
                  <td>{formatPhone(item.telefone)}</td>
                  <td>{formatLocal(item.cidade, item.estado_id)}</td>
                  <td>
                    <div className="admin-usuarios-modulos">
                      {parseModulosFromNivelAcesso(item.nivel_acesso, item.cargo).map((id) => {
                        const mod = PORTAL_MODULES.find((m) => m.id === id);
                        return (
                          <span key={id} className="admin-usuarios-modulo-tag" title={mod?.title}>
                            {mod ? <AppIcon name={mod.icon} size={14} /> : null} {mod?.title ?? id}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="admin-usuarios-td-actions">
                    <div className="admin-usuarios-actions">
                      <button
                        type="button"
                        className="admin-usuarios-action-btn"
                        onClick={() => setEditing(item)}
                      >
                        <IconEdit />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        className="admin-usuarios-action-btn danger"
                        onClick={() => setToDelete(item)}
                      >
                        <IconTrash />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showCreate && (
        <UsuarioFormModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            showToast('Usuário criado.', 'success');
            load();
          }}
        />
      )}

      {editing && (
        <UsuarioFormModal
          user={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            showToast('Usuário atualizado.', 'success');
            load();
          }}
        />
      )}

      {toDelete && (
        <DeleteColaboradorModal
          user={toDelete}
          deleting={deleting}
          onClose={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
