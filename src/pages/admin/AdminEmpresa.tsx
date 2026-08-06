import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmpresaFilialFormModal from '../../components/admin/EmpresaFilialFormModal';
import ModalShell from '../../components/colaboradores/ModalShell';
import { useToast } from '../../context/ToastContext';
import { maskPhoneInput } from '../../lib/cpf';
import {
  ESTADOS_EMPRESA,
  createFilial,
  deleteFilial,
  empresaToForm,
  fetchEmpresaPrincipal,
  fetchFiliaisByEmpresa,
  formatCnpjDisplay,
  formatCnpjInput,
  updateFilial,
  upsertEmpresa,
  type Empresa,
  type EmpresaFilial,
  type EmpresaFormInput,
  type FilialFormInput,
} from '../../services/empresaService';
import { formatPhone } from '../../utils/format';
import '../Administrador.css';
import './AdminFiliais.css';
import './AdminEmpresa.css';

function IconBuilding() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 21h16" />
      <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      <path d="M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1" />
    </svg>
  );
}

function IconBranches() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 10.5 5 4h14l2 6.5" />
      <path d="M4 10.5V20h16v-9.5" />
      <path d="M9 20v-5h6v5" />
    </svg>
  );
}

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

function IconSave() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

export default function AdminEmpresa() {
  const { showToast } = useToast();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [form, setForm] = useState<EmpresaFormInput>(empresaToForm(null));
  const [filiais, setFiliais] = useState<EmpresaFilial[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [showCreateFilial, setShowCreateFilial] = useState(false);
  const [editingFilial, setEditingFilial] = useState<EmpresaFilial | null>(null);
  const [deletingFilial, setDeletingFilial] = useState<EmpresaFilial | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const principal = await fetchEmpresaPrincipal();
      setEmpresa(principal);
      setForm(empresaToForm(principal));
      if (principal) {
        const list = await fetchFiliaisByEmpresa(principal.id);
        setFiliais(list);
      } else {
        setFiliais([]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar empresa.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (field: keyof EmpresaFormInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEmpresa = async () => {
    setSavingEmpresa(true);
    try {
      const saved = await upsertEmpresa(form, empresa?.id);
      setEmpresa(saved);
      setForm(empresaToForm(saved));
      showToast('Empresa salva com sucesso.', 'success');
      const list = await fetchFiliaisByEmpresa(saved.id);
      setFiliais(list);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar empresa.', 'error');
    } finally {
      setSavingEmpresa(false);
    }
  };

  const handleCreateFilial = async (data: FilialFormInput) => {
    if (!empresa?.id) {
      throw new Error('Salve a empresa matriz antes de cadastrar filiais.');
    }
    await createFilial(empresa.id, data);
    showToast('Filial cadastrada.', 'success');
    const list = await fetchFiliaisByEmpresa(empresa.id);
    setFiliais(list);
  };

  const handleUpdateFilial = async (data: FilialFormInput) => {
    if (!editingFilial || !empresa?.id) return;
    await updateFilial(editingFilial.id, data);
    showToast('Filial atualizada.', 'success');
    const list = await fetchFiliaisByEmpresa(empresa.id);
    setFiliais(list);
  };

  const handleDeleteFilial = async () => {
    if (!deletingFilial || !empresa?.id) return;
    setDeleting(true);
    try {
      await deleteFilial(deletingFilial.id);
      showToast('Filial excluída.', 'success');
      setDeletingFilial(null);
      const list = await fetchFiliaisByEmpresa(empresa.id);
      setFiliais(list);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir filial.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="empresa-page">
        <p className="filiais-empty">Carregando empresa...</p>
      </div>
    );
  }

  return (
    <div className="empresa-page">
      <Link to="/administrador" className="admin-section-back">
        <span aria-hidden>←</span>
        Voltar ao Administrador
      </Link>

      <header className="empresa-page-header">
        <div>
          <h1 className="page-title">Empresa</h1>
          <p className="admin-subtitle">Cadastro da empresa matriz e suas filiais</p>
        </div>
      </header>

      <section className="card empresa-card">
        <div className="empresa-card-head">
          <span className="empresa-card-icon" aria-hidden>
            <IconBuilding />
          </span>
          <div>
            <h2>Empresa Matriz</h2>
            <p>Dados cadastrais da empresa principal</p>
          </div>
        </div>

        <div className="empresa-form-grid">
          <label className="empresa-field">
            <span>CNPJ</span>
            <input
              value={form.cnpj}
              onChange={(e) => updateField('cnpj', formatCnpjInput(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </label>

          <label className="empresa-field">
            <span>Razão Social</span>
            <input
              value={form.razao_social}
              onChange={(e) => updateField('razao_social', e.target.value)}
              placeholder="Razão social"
            />
          </label>

          <label className="empresa-field">
            <span>Nome Fantasia</span>
            <input
              value={form.nome_fantasia}
              onChange={(e) => updateField('nome_fantasia', e.target.value)}
              placeholder="Nome fantasia"
            />
          </label>

          <label className="empresa-field">
            <span>Inscrição Estadual</span>
            <input
              value={form.inscricao_estadual}
              onChange={(e) => updateField('inscricao_estadual', e.target.value)}
              placeholder="Inscrição estadual"
            />
          </label>

          <label className="empresa-field empresa-field--wide">
            <span>Endereço</span>
            <input
              value={form.endereco}
              onChange={(e) => updateField('endereco', e.target.value)}
              placeholder="Endereço completo"
            />
          </label>

          <label className="empresa-field">
            <span>Cidade</span>
            <input
              value={form.cidade}
              onChange={(e) => updateField('cidade', e.target.value)}
              placeholder="Cidade"
            />
          </label>

          <label className="empresa-field">
            <span>Estado</span>
            <select value={form.estado} onChange={(e) => updateField('estado', e.target.value)}>
              {ESTADOS_EMPRESA.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>

          <label className="empresa-field">
            <span>CEP</span>
            <input
              value={form.cep}
              onChange={(e) => updateField('cep', e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="00000000"
            />
          </label>

          <label className="empresa-field">
            <span>Telefone</span>
            <input
              value={form.telefone}
              onChange={(e) => updateField('telefone', maskPhoneInput(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </label>

          <label className="empresa-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="contato@empresa.com"
            />
          </label>
        </div>

        <div className="empresa-form-actions">
          <button
            type="button"
            className="filiais-btn-primary"
            onClick={handleSaveEmpresa}
            disabled={savingEmpresa}
          >
            <IconSave />
            {savingEmpresa ? 'Salvando...' : 'Salvar Empresa'}
          </button>
        </div>
      </section>

      <section className="card empresa-card">
        <div className="empresa-card-head empresa-card-head--row">
          <div className="empresa-card-head-left">
            <span className="empresa-card-icon" aria-hidden>
              <IconBranches />
            </span>
            <div>
              <h2>Filiais da Empresa</h2>
              <p>Unidades vinculadas à empresa matriz</p>
            </div>
          </div>
          <button
            type="button"
            className="filiais-btn-primary"
            onClick={() => setShowCreateFilial(true)}
            disabled={!empresa?.id}
            title={!empresa?.id ? 'Salve a empresa matriz primeiro' : undefined}
          >
            + Nova Filial
          </button>
        </div>

        {!empresa?.id ? (
          <p className="filiais-empty">
            Salve a empresa matriz para poder anexar filiais (ex.: Fé Repre e Fé Pará).
          </p>
        ) : filiais.length === 0 ? (
          <p className="filiais-empty">Nenhuma filial vinculada ainda.</p>
        ) : (
          <div className="filiais-table-wrap">
            <table className="filiais-table empresa-filiais-table">
              <thead>
                <tr>
                  <th>Razão Social</th>
                  <th>CNPJ</th>
                  <th>Cidade/UF</th>
                  <th>Telefone</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filiais.map((item) => {
                  const isAtivo = (item.status || 'Ativo') === 'Ativo';
                  const cidadeUf = [item.cidade, item.estado].filter(Boolean).join('/') || '—';
                  return (
                    <tr key={item.id}>
                      <td className="filiais-nome">{item.razao_social}</td>
                      <td>{formatCnpjDisplay(item.cnpj)}</td>
                      <td>{cidadeUf}</td>
                      <td>{formatPhone(item.telefone)}</td>
                      <td>
                        <span className={`filiais-status ${isAtivo ? '' : 'inativo'}`}>
                          {item.status || 'Ativo'}
                        </span>
                      </td>
                      <td className="empresa-filiais-actions">
                        <button
                          type="button"
                          className="empresa-action-btn"
                          title="Editar"
                          onClick={() => setEditingFilial(item)}
                        >
                          <IconEdit />
                        </button>
                        <button
                          type="button"
                          className="empresa-action-btn danger"
                          title="Excluir"
                          onClick={() => setDeletingFilial(item)}
                        >
                          <IconTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCreateFilial && (
        <EmpresaFilialFormModal
          onClose={() => setShowCreateFilial(false)}
          onSubmit={handleCreateFilial}
        />
      )}

      {editingFilial && (
        <EmpresaFilialFormModal
          filial={editingFilial}
          onClose={() => setEditingFilial(null)}
          onSubmit={handleUpdateFilial}
        />
      )}

      {deletingFilial && (
        <ModalShell onClose={() => setDeletingFilial(null)} className="filiais-modal filiais-confirm-modal">
          <div className="filiais-modal-header">
            <div>
              <h2>Excluir filial?</h2>
              <p>
                Deseja excluir esta filial?{' '}
                <strong>{deletingFilial.razao_social}</strong>
              </p>
            </div>
            <button
              type="button"
              className="filiais-modal-close"
              onClick={() => setDeletingFilial(null)}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
          <div className="filiais-modal-actions">
            <button
              type="button"
              className="filiais-btn-outline"
              onClick={() => setDeletingFilial(null)}
              disabled={deleting}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="filiais-btn-danger"
              onClick={handleDeleteFilial}
              disabled={deleting}
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
