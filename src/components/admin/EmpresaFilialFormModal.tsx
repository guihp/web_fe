import { useState, type FormEvent } from 'react';
import ModalShell from '../colaboradores/ModalShell';
import {
  ESTADOS_EMPRESA,
  formatCnpjInput,
  type EmpresaFilial,
  type FilialFormInput,
} from '../../services/empresaService';
import { maskPhoneInput } from '../../lib/cpf';

type EmpresaFilialFormModalProps = {
  filial?: EmpresaFilial | null;
  onClose: () => void;
  onSubmit: (form: FilialFormInput) => Promise<void>;
};

const emptyForm: FilialFormInput = {
  cnpj: '',
  razao_social: '',
  nome_fantasia: '',
  endereco: '',
  cidade: '',
  estado: 'MA',
  cep: '',
  telefone: '',
  email: '',
  status: 'Ativo',
};

export default function EmpresaFilialFormModal({
  filial,
  onClose,
  onSubmit,
}: EmpresaFilialFormModalProps) {
  const isEdit = Boolean(filial);
  const [form, setForm] = useState<FilialFormInput>(
    filial
      ? {
          cnpj: formatCnpjInput(filial.cnpj ?? ''),
          razao_social: filial.razao_social,
          nome_fantasia: filial.nome_fantasia ?? '',
          endereco: filial.endereco ?? '',
          cidade: filial.cidade ?? '',
          estado: filial.estado ?? 'MA',
          cep: filial.cep ?? '',
          telefone: filial.telefone ? maskPhoneInput(filial.telefone) : '',
          email: filial.email ?? '',
          status: filial.status || 'Ativo',
        }
      : emptyForm,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof FilialFormInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.razao_social.trim()) {
      setError('Informe a razão social da filial.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar filial.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="filiais-modal empresa-filial-modal">
      <div className="filiais-modal-header">
        <div>
          <h2>{isEdit ? 'Editar Filial' : 'Nova Filial'}</h2>
          <p>Unidade vinculada à empresa matriz (nome pode ser igual ou diferente).</p>
        </div>
        <button type="button" className="filiais-modal-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <form className="filiais-form" onSubmit={handleSubmit}>
        <label className="filiais-field full">
          <span>CNPJ</span>
          <input
            value={form.cnpj}
            onChange={(e) => update('cnpj', formatCnpjInput(e.target.value))}
            placeholder="00.000.000/0000-00"
          />
        </label>

        <label className="filiais-field full">
          <span>
            Razão Social <em>*</em>
          </span>
          <input
            value={form.razao_social}
            onChange={(e) => update('razao_social', e.target.value)}
            placeholder="Ex: Fé Representações | Pará"
            required
          />
        </label>

        <label className="filiais-field full">
          <span>Nome Fantasia</span>
          <input
            value={form.nome_fantasia}
            onChange={(e) => update('nome_fantasia', e.target.value)}
            placeholder="Ex: Fé Pará Representações"
          />
        </label>

        <label className="filiais-field full">
          <span>Endereço</span>
          <input
            value={form.endereco}
            onChange={(e) => update('endereco', e.target.value)}
            placeholder="Endereço completo"
          />
        </label>

        <div className="filiais-form-row cidade-estado">
          <label className="filiais-field">
            <span>Cidade</span>
            <input
              value={form.cidade}
              onChange={(e) => update('cidade', e.target.value)}
              placeholder="Cidade"
            />
          </label>
          <label className="filiais-field estado">
            <span>Estado</span>
            <select value={form.estado} onChange={(e) => update('estado', e.target.value)}>
              {ESTADOS_EMPRESA.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="filiais-form-row">
          <label className="filiais-field">
            <span>CEP</span>
            <input
              value={form.cep}
              onChange={(e) => update('cep', e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="00000000"
            />
          </label>
          <label className="filiais-field">
            <span>Telefone</span>
            <input
              value={form.telefone}
              onChange={(e) => update('telefone', maskPhoneInput(e.target.value))}
              placeholder="(00) 00000-0000"
            />
          </label>
        </div>

        <label className="filiais-field full">
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="contato@empresa.com"
          />
        </label>

        {isEdit && (
          <label className="filiais-field full">
            <span>Status</span>
            <select value={form.status} onChange={(e) => update('status', e.target.value)}>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </label>
        )}

        {error && <p className="filiais-form-error">{error}</p>}

        <div className="filiais-modal-actions">
          <button type="button" className="filiais-btn-outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="filiais-btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
