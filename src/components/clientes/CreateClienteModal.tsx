import { useState } from 'react';
import { emptyClienteForm, ESTADOS_CLIENTES, type ClienteForm } from '../../data/clientesData';
import { createCliente } from '../../services/clienteService';
import ModalShell from '../colaboradores/ModalShell';

type CreateClienteModalProps = {
  onClose: () => void;
  onSuccess: () => void;
};

function maskCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function maskCdc(value: string) {
  return value.replace(/\D/g, '').slice(0, 4);
}

export default function CreateClienteModal({ onClose, onSuccess }: CreateClienteModalProps) {
  const [form, setForm] = useState<ClienteForm>(emptyClienteForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof ClienteForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.cnpj.trim() || !form.cdc.trim() || !form.razaoSocial.trim() || !form.nomeFantasia.trim()) {
      setError('Preencha os campos obrigatórios: CNPJ, CDC, Razão Social e Nome Fantasia.');
      return;
    }

    if (form.cnpj.replace(/\D/g, '').length !== 14 && form.cnpj.replace(/\D/g, '').length > 0) {
      setError('Informe um CNPJ válido com 14 dígitos.');
      return;
    }

    if (form.cdc.replace(/\D/g, '').length !== 4) {
      setError('O CDC deve ter exatamente 4 dígitos.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createCliente(form);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="colab-modal-header">
        <h2>Novo Cliente</h2>
        <p>Cadastre um novo cliente na base</p>
      </div>

      <div className="colab-form">
        <div className="colab-row">
          <label className="colab-field">
            <span>CDC *</span>
            <input
              value={form.cdc}
              onChange={(e) => updateField('cdc', maskCdc(e.target.value))}
              placeholder="0000"
            />
          </label>
          <label className="colab-field">
            <span>CNPJ *</span>
            <input
              value={form.cnpj}
              onChange={(e) => updateField('cnpj', maskCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </label>
        </div>
        <label className="colab-field full">
          <span>Razão Social *</span>
          <input
            value={form.razaoSocial}
            onChange={(e) => updateField('razaoSocial', e.target.value)}
          />
        </label>
        <label className="colab-field full">
          <span>Nome Fantasia *</span>
          <input
            value={form.nomeFantasia}
            onChange={(e) => updateField('nomeFantasia', e.target.value)}
          />
        </label>
        <div className="colab-row">
          <label className="colab-field">
            <span>Cidade</span>
            <input value={form.cidade} onChange={(e) => updateField('cidade', e.target.value)} />
          </label>
          <label className="colab-field">
            <span>Estado</span>
            <div className="colab-select-wrap">
              <select value={form.estado} onChange={(e) => updateField('estado', e.target.value)}>
                {ESTADOS_CLIENTES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>
        {error && <p className="colab-error">{error}</p>}
        <div className="colab-actions">
          <button type="button" className="colab-btn primary" disabled={saving} onClick={handleSubmit}>
            {saving ? 'Salvando...' : 'Cadastrar'}
          </button>
          <button type="button" className="colab-btn outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
