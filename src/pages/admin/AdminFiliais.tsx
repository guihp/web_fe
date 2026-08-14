import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ExcluirFilialModal from '../../components/admin/ExcluirFilialModal';
import FilialFormModal from '../../components/admin/FilialFormModal';
import AppIcon from '../../components/icons/AppIcon';
import { useToast } from '../../context/ToastContext';
import {
  createLoja,
  deleteLoja,
  fetchLojas,
  fetchRegionais,
  formatCnpjDisplay,
  formatLojaNome,
  updateLoja,
  type Loja,
  type LojaFormInput,
  type RegionalOption,
} from '../../services/lojasService';
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

export default function AdminFiliais() {
  const { showToast } = useToast();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [regionalFilter, setRegionalFilter] = useState('todas');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Loja | null>(null);
  const [toDelete, setToDelete] = useState<Loja | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [lojasData, regionaisData] = await Promise.all([fetchLojas(), fetchRegionais()]);
      setLojas(lojasData);
      setRegionais(regionaisData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar filiais.';
      setError(message);
      showToast(message, 'error');
      setLojas([]);
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
    return lojas.filter((loja) => {
      if (regionalFilter !== 'todas') {
        const regional = regionais.find((r) => String(r.id) === regionalFilter);
        if (regional) {
          const matchId = loja.regional_id === regional.id;
          const matchName = (loja.regional ?? '') === regional.Nome;
          if (!matchId && !matchName) return false;
        }
      }
      if (!term) return true;
      const haystack = [
        formatLojaNome(loja),
        loja.cnpj ?? '',
        loja.regional ?? '',
        loja.cidade ?? '',
        loja.estado ?? '',
        String(loja.codigo ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [lojas, regionalFilter, regionais, search]);

  const sortLojas = (rows: Loja[]) =>
    [...rows].sort((a, b) => (a.codigo ?? 999999) - (b.codigo ?? 999999));

  const handleCreate = async (values: LojaFormInput) => {
    const created = await createLoja(values);
    setLojas((prev) => sortLojas([...prev, created]));
    showToast('Filial cadastrada com sucesso.', 'success');
  };

  const handleUpdate = async (values: LojaFormInput) => {
    if (!editing) return;
    const updated = await updateLoja(editing.id, values, editing.status);
    setLojas((prev) => sortLojas(prev.map((row) => (row.id === updated.id ? updated : row))));
    showToast('Filial atualizada com sucesso.', 'success');
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteLoja(toDelete.id);
      setLojas((prev) => prev.filter((row) => row.id !== toDelete.id));
      showToast('Filial excluída com sucesso.', 'success');
      setToDelete(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível excluir a filial.', 'error');
    } finally {
      setDeleting(false);
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
          <h1 className="page-title">Filiais</h1>
          <p className="admin-subtitle">Cadastre filiais vinculadas às regionais</p>
        </div>
        <div className="filiais-header-actions">
          <button
            type="button"
            className="filiais-btn-outline"
            onClick={() => showToast('Importação de Excel em breve.', 'info')}
          >
            <span aria-hidden>↑</span>
            Importar Excel
          </button>
          <button type="button" className="filiais-btn-primary" onClick={() => setShowCreate(true)}>
            + Nova Filial
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
              placeholder="Buscar filial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="filiais-regional-filter"
            value={regionalFilter}
            onChange={(e) => setRegionalFilter(e.target.value)}
          >
            <option value="todas">Todas as regionais</option>
            {regionais.map((r) => (
              <option key={r.id} value={r.id}>
                {r.Nome}
              </option>
            ))}
          </select>
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
            <p className="filiais-empty">Carregando filiais...</p>
          ) : filtered.length === 0 ? (
            <p className="filiais-empty">Nenhuma filial encontrada.</p>
          ) : (
            <table className="filiais-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cód</th>
                  <th>CNPJ</th>
                  <th>Regional</th>
                  <th>Cidade/UF</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((loja) => (
                  <tr key={loja.id}>
                    <td className="filiais-nome">{formatLojaNome(loja)}</td>
                    <td>{loja.codigo ?? '—'}</td>
                    <td>{formatCnpjDisplay(loja.cnpj)}</td>
                    <td>
                      <span className="filiais-regional-cell">
                        <span aria-hidden>
                          <AppIcon name="pin" size={14} />
                        </span>
                        {loja.regional || '—'}
                      </span>
                    </td>
                    <td>
                      {loja.cidade && loja.estado
                        ? `${loja.cidade}/${loja.estado}`
                        : loja.cidade || loja.estado || '—'}
                    </td>
                    <td>
                      <span className="filiais-status">{loja.status || 'Ativo'}</span>
                    </td>
                    <td className="filiais-actions-cell">
                      <div
                        className="filiais-menu-wrap"
                        ref={menuOpenId === loja.id ? menuRef : undefined}
                      >
                        <button
                          type="button"
                          className="filiais-row-menu"
                          aria-label="Mais opções"
                          aria-expanded={menuOpenId === loja.id}
                          onClick={() =>
                            setMenuOpenId((current) => (current === loja.id ? null : loja.id))
                          }
                        >
                          ⋯
                        </button>
                        {menuOpenId === loja.id && (
                          <div className="filiais-row-dropdown" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setMenuOpenId(null);
                                setEditing(loja);
                              }}
                            >
                              <IconEdit />
                              Editar
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="danger"
                              onClick={() => {
                                setMenuOpenId(null);
                                setToDelete(loja);
                              }}
                            >
                              <IconTrash />
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showCreate && (
        <FilialFormModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {editing && (
        <FilialFormModal
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={handleUpdate}
        />
      )}

      {toDelete && (
        <ExcluirFilialModal
          loja={toDelete}
          deleting={deleting}
          onClose={() => setToDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
