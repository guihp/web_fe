import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import InativarRegionalModal from '../../components/admin/InativarRegionalModal';
import RegionalFormModal from '../../components/admin/RegionalFormModal';
import AppIcon from '../../components/icons/AppIcon';
import { useToast } from '../../context/ToastContext';
import {
  createRegional,
  fetchRegionaisAdmin,
  setRegionalStatus,
  updateRegional,
  type Regional,
  type RegionalFormInput,
} from '../../services/regionaisService';
import '../Administrador.css';
import './AdminFiliais.css';

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

export default function AdminRegionais() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<Regional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Regional | null>(null);
  const [toggling, setToggling] = useState<Regional | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchRegionaisAdmin());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar regionais.';
      setError(message);
      showToast(message, 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (menuOpenId == null) return;

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpenId(null);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpenId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const haystack = [row.Nome, row.codigo ?? '', row.descricao ?? '', row.status ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search]);

  const handleCreate = async (values: RegionalFormInput) => {
    const created = await createRegional(values);
    setRows((prev) => [...prev, created]);
    showToast('Regional cadastrada com sucesso.', 'success');
  };

  const handleUpdate = async (values: RegionalFormInput) => {
    if (!editing) return;
    const updated = await updateRegional(editing.id, values);
    setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    showToast('Regional atualizada com sucesso.', 'success');
  };

  const handleToggleStatus = async () => {
    if (!toggling) return;
    const next = (toggling.status || 'Ativo') === 'Ativo' ? 'Inativo' : 'Ativo';
    setSavingStatus(true);
    try {
      const updated = await setRegionalStatus(toggling.id, next);
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      showToast(
        next === 'Inativo' ? 'Regional inativada.' : 'Regional ativada.',
        'success',
      );
      setToggling(null);
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
    <div className="filiais-page">
      <Link to="/administrador" className="admin-section-back">
        <span aria-hidden>←</span>
        Voltar ao Administrador
      </Link>

      <header className="filiais-header">
        <div>
          <h1 className="page-title">Regionais</h1>
          <p className="admin-subtitle">Cadastre e gerencie as regionais (grupos principais)</p>
        </div>
        <div className="filiais-header-actions">
          <button type="button" className="filiais-btn-primary" onClick={() => setShowCreate(true)}>
            + Nova Regional
          </button>
        </div>
      </header>

      <section className="card filiais-card">
        <div className="filiais-toolbar">
          <div className="filiais-search">
            <span aria-hidden>
              <AppIcon name="search" size={16} />
            </span>
            <input
              type="search"
              placeholder="Buscar regional..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="filiais-error-banner">
            <p>{error}</p>
            <button type="button" className="filiais-btn-outline" onClick={load}>
              Tentar novamente
            </button>
          </div>
        )}

        <div className="filiais-table-wrap">
          {loading ? (
            <p className="filiais-empty">Carregando regionais...</p>
          ) : filtered.length === 0 ? (
            <p className="filiais-empty">Nenhuma regional encontrada.</p>
          ) : (
            <table className="filiais-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const status = row.status || 'Ativo';
                  const isAtivo = status === 'Ativo';
                  return (
                    <tr key={row.id}>
                      <td className="filiais-nome">{row.Nome}</td>
                      <td>{row.codigo || '—'}</td>
                      <td>{row.descricao?.trim() ? row.descricao : '—'}</td>
                      <td>
                        <span className={`filiais-status ${isAtivo ? '' : 'inativo'}`}>
                          {status}
                        </span>
                      </td>
                      <td className="filiais-actions-cell">
                        <div
                          className="filiais-menu-wrap"
                          ref={menuOpenId === row.id ? menuRef : undefined}
                        >
                          <button
                            type="button"
                            className="filiais-row-menu"
                            aria-label="Mais opções"
                            aria-expanded={menuOpenId === row.id}
                            onClick={() =>
                              setMenuOpenId((current) => (current === row.id ? null : row.id))
                            }
                          >
                            ⋯
                          </button>
                          {menuOpenId === row.id && (
                            <div className="filiais-row-dropdown" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setEditing(row);
                                }}
                              >
                                <IconEdit />
                                Editar
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className={isAtivo ? 'danger' : undefined}
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setToggling(row);
                                }}
                              >
                                <IconTrash />
                                {isAtivo ? 'Inativar' : 'Ativar'}
                              </button>
                            </div>
                          )}
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

      {showCreate && (
        <RegionalFormModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {editing && (
        <RegionalFormModal
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={handleUpdate}
        />
      )}

      {toggling && (
        <InativarRegionalModal
          regional={toggling}
          saving={savingStatus}
          onClose={() => setToggling(null)}
          onConfirm={handleToggleStatus}
        />
      )}
    </div>
  );
}
