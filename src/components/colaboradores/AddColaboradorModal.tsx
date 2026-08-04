import { useState } from 'react';
import { maskCpfInput, maskPhoneInput } from '../../lib/cpf';
import { saveUser } from '../../services/userService';
import ModalShell from './ModalShell';

const CARGOS = ['Dono', 'Gerente', 'Promotor', 'Degustação'];

type AddColaboradorModalProps = {
  onClose: () => void;
  onSuccess: () => void;
};

const emptyForm = {
  nome: '',
  email: '',
  telefone: '',
  cpf: '',
  endereco: '',
  cargo: '',
  senha: '',
};

export default function AddColaboradorModal({ onClose, onSuccess }: AddColaboradorModalProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const generatePassword = () => {
    updateField('senha', Math.random().toString(36).substring(2, 10));
  };

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.cpf.trim() || !form.cargo || !form.senha.trim()) {
      setError('Preencha nome, CPF, cargo e senha.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveUser({
        nome: form.nome,
        email: form.email,
        telefone: form.telefone,
        cpf: form.cpf,
        senha: form.senha,
        cargo: form.cargo,
        endereco: form.endereco,
      });
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar colaborador.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} className="form-modal">
      <div className="colab-modal-header">
        <h2>Adicionar Colaborador</h2>
        <p>Adicione novos colaboradores à sua equipe</p>
      </div>

      <div className="colab-form">
        <label className="colab-field full">
          <span>Nome completo</span>
          <input
            type="text"
            placeholder="Insira seu nome completo"
            value={form.nome}
            onChange={(e) => updateField('nome', e.target.value)}
          />
        </label>

        <label className="colab-field full">
          <span>E-mail</span>
          <input
            type="email"
            placeholder="Insira seu melhor e-mail"
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
          />
        </label>

        <label className="colab-field full">
          <span>Telefone</span>
          <input
            type="text"
            placeholder="Insira seu telefone"
            value={form.telefone}
            onChange={(e) => updateField('telefone', maskPhoneInput(e.target.value))}
          />
        </label>

        <label className="colab-field full">
          <span>CPF</span>
          <input
            type="text"
            placeholder="Insira seu cpf"
            value={form.cpf}
            onChange={(e) => updateField('cpf', maskCpfInput(e.target.value))}
          />
        </label>

        <label className="colab-field full">
          <span>Endereço</span>
          <input
            type="text"
            placeholder="Insira seu endereço"
            value={form.endereco}
            onChange={(e) => updateField('endereco', e.target.value)}
          />
        </label>

        <label className="colab-field full">
          <span>Cargo</span>
          <div className="colab-select-wrap">
            <select value={form.cargo} onChange={(e) => updateField('cargo', e.target.value)}>
              <option value="">Selecionar o cargo</option>
              {CARGOS.map((cargo) => (
                <option key={cargo} value={cargo}>
                  {cargo}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="colab-field full">
          <span>Senha</span>
          <div className="colab-password-wrap">
            <input
              type="text"
              placeholder="Insira sua senha ou CLIQUE PARA GERAR"
              value={form.senha}
              onChange={(e) => updateField('senha', e.target.value)}
            />
            <button type="button" className="colab-generate-btn" onClick={generatePassword} aria-label="Gerar senha">
              ↻
            </button>
          </div>
        </label>
      </div>

      {error && <p className="colab-form-error">{error}</p>}

      <div className="colab-modal-actions">
        <button type="button" className="colab-btn-save" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" className="colab-btn-cancel" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
      </div>
    </ModalShell>
  );
}
