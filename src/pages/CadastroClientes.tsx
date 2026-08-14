import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/icons/AppIcon';
import { useToast } from '../context/ToastContext';
import { emptyClienteForm, ESTADOS_CLIENTES, type ClienteForm } from '../data/clientesData';
import { createCliente } from '../services/clienteService';
import './CadastroClientes.css';

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

export default function CadastroClientes() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [form, setForm] = useState<ClienteForm>(emptyClienteForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateField = (field: keyof ClienteForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleClear = () => {
    setForm(emptyClienteForm());
    setError(null);
  };

  const handleSave = async () => {
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
      showToast(`Cliente ${form.nomeFantasia} cadastrado com sucesso!`, 'success');
      setForm(emptyClienteForm());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao cadastrar cliente.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="clientes-page">
      <header className="clientes-header">
        <h1 className="page-title">Cadastro de Clientes</h1>
        <p className="clientes-subtitle">Registre novos clientes no sistema</p>
      </header>

      <section className="card clientes-card">
        <div className="clientes-card-head">
          <h2>Dados do Cliente</h2>
        </div>

        <div className="clientes-grid">
          <label className="clientes-field">
            <span>
              CNPJ <em>*</em>
            </span>
            <input
              type="text"
              placeholder="00.000.000/0000-00"
              value={form.cnpj}
              onChange={(e) => updateField('cnpj', maskCnpj(e.target.value))}
            />
          </label>

          <label className="clientes-field">
            <span>
              CDC (Código) <em>*</em>
            </span>
            <input
              type="text"
              placeholder="Código do cliente (4 dígitos)"
              value={form.cdc}
              onChange={(e) => updateField('cdc', maskCdc(e.target.value))}
            />
          </label>

          <label className="clientes-field full">
            <span>
              Razão Social <em>*</em>
            </span>
            <input
              type="text"
              placeholder="Razão social da empresa"
              value={form.razaoSocial}
              onChange={(e) => updateField('razaoSocial', e.target.value)}
            />
          </label>

          <label className="clientes-field full">
            <span>
              Nome Fantasia <em>*</em>
            </span>
            <input
              type="text"
              placeholder="Nome fantasia da empresa"
              value={form.nomeFantasia}
              onChange={(e) => updateField('nomeFantasia', e.target.value)}
            />
          </label>

          <label className="clientes-field">
            <span>Cidade</span>
            <input
              type="text"
              placeholder="Nome da cidade"
              value={form.cidade}
              onChange={(e) => updateField('cidade', e.target.value)}
            />
          </label>

          <label className="clientes-field">
            <span>Estado</span>
            <div className="clientes-select-wrap">
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

        {error && <p className="clientes-feedback error">{error}</p>}

        <div className="clientes-actions">
          <button type="button" className="clientes-btn primary" disabled={saving} onClick={handleSave}>
            <AppIcon name="save" size={16} /> {saving ? 'SALVANDO...' : 'SALVAR'}
          </button>
          <button type="button" className="clientes-btn outline" onClick={handleClear}>
            <AppIcon name="trash" size={16} /> APAGAR
          </button>
          <button type="button" className="clientes-btn soft" onClick={() => navigate(-1)}>
            <AppIcon name="arrowLeft" size={16} /> VOLTAR
          </button>
        </div>
      </section>
    </div>
  );
}
